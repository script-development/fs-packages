#!/usr/bin/env node
/**
 * Release-pipeline invariant gate.
 *
 * Guards ONE class of defect: coupling the publish pipeline's *artifact* clock to
 * its *human-approval* clock. `publish` sits behind the `npm-publish` deployment
 * environment, whose approval is wall-clock unbounded; build artifacts expire on a
 * fixed timer. When the second is shorter than the first, a release that waits too
 * long for approval becomes unpublishable on that run — and the error it produces
 * ("Artifact not found for name: build-output") blames the upload, not the delay.
 *
 * Fired live 2026-07-27 (WR-0615): retention-days was 1, ui-inputs 0.10.1 merged
 * 07-24 and was approved 07-27, and publish died on arrival. Three days of a Major
 * WCAG fix sat undelivered, and the obvious recovery ("Re-run failed jobs") re-runs
 * `publish` alone against the same absent artifact and fails identically.
 *
 * Deliberately narrow. This is NOT a general workflow linter — it asserts the three
 * properties that make the coupling impossible, and nothing else.
 *
 * Zero dependencies by design: this repo mints the fleet's npm publish credentials
 * via OIDC, so a guard on release convenience does not justify a new dependency in
 * its tree. The step splitter below is indentation-based, which is sufficient for a
 * file this small and fails loudly (not silently) if the shape ever changes.
 */
import {existsSync, readFileSync} from 'node:fs';

const WORKFLOW = '.github/workflows/publish.yml';

/**
 * Minimum artifact retention, in days. Sized against the *approval* clock — how long
 * a release may plausibly wait on a human — not against pipeline runtime.
 *
 * Pinned to 90 (the GitHub maximum) because CLAUDE.md certifies exactly that number
 * as enforced here. An earlier 30-day floor left a 30-89 band that the doc claimed
 * was machine-guarded and this gate would have waved through — a guarantee asserted
 * by an artifact but checked by nothing, which is the failure mode that terminates
 * the search: a reader sees the claim, believes the property is guarded, stops
 * looking. Raised rather than re-wording the doc down, because retention costs
 * nothing within GitHub's limits and the whole point of WR-0615 is that the
 * approval clock is unbounded — any lower ceiling is a smaller version of the bug.
 *
 * Changing this is a deliberate act: update CLAUDE.md § Release Pipeline in the
 * same commit, or the divergence simply reappears pointing the other way.
 */
const MIN_RETENTION_DAYS = 90;

const source = readFileSync(WORKFLOW, 'utf8');
const lines = source.split('\n');
const failures = [];

/**
 * Split the file into step blocks. A step starts at a line matching `- ` and runs
 * until the next line at the same or lower indentation that also starts a list item
 * or a new mapping key.
 */
const stepBlocks = () => {
    const blocks = [];
    let current = null;
    for (const [index, line] of lines.entries()) {
        const start = /^(\s*)- /.exec(line);
        if (start) {
            if (current) blocks.push(current);
            current = {indent: start[1].length, lines: [line], startLine: index + 1};
            continue;
        }
        if (!current) continue;
        const indent = /^(\s*)\S/.exec(line);
        if (indent && indent[1].length <= current.indent) {
            blocks.push(current);
            current = null;
            continue;
        }
        current.lines.push(line);
    }
    if (current) blocks.push(current);
    return blocks.map((block) => ({...block, text: block.lines.join('\n')}));
};

const steps = stepBlocks();

/**
 * One job's own lines, and nothing else.
 *
 * The reason this exists rather than another whole-file regex: an unanchored
 * `source.match` answers "does this string appear ANYWHERE", which is a different
 * question from "does the publish job carry it". A condition moved onto a sibling job,
 * or left behind in a comment, satisfies the first and fails the second — and the
 * failure is silent in the expensive direction, because the gate keeps reporting PASS
 * while `publish` runs unconditioned. (crit, PR #221.)
 */
const jobBlock = (name) => {
    const start = lines.findIndex((line) => new RegExp(`^(\\s+)${name}:\\s*$`).test(line));
    if (start === -1) return null;
    const indent = /^(\s*)/.exec(lines[start])[1].length;
    let end = start + 1;
    let keyIndent = null;
    while (end < lines.length) {
        const match = /^(\s*)\S/.exec(lines[end]);
        if (match && match[1].length <= indent) break;
        // The job's OWN keys, at the first indentation level inside it. Anything deeper
        // belongs to a step, and a step's `if:` must never be mistaken for the job's —
        // that mistake produces a red whose message points at the wrong line, which is
        // worse than a miss: it sends the reader to a file that is not the problem.
        if (match && (keyIndent === null || match[1].length < keyIndent)) keyIndent = match[1].length;
        end += 1;
    }
    return {startLine: start + 1, keyIndent: keyIndent ?? indent + 4, text: lines.slice(start, end).join('\n')};
};

/** One of a job's own top-level keys, ignoring identically-named keys inside its steps. */
const jobKey = (job, key) => new RegExp(`^ {${job.keyIndent}}${key}:\\s*(.+)$`, 'm').exec(job.text);

// 1. Retention must outlive a plausible approval wait.
const retentions = [...source.matchAll(/^\s*retention-days:\s*(\d+)/gm)];
if (retentions.length === 0) {
    failures.push(
        `no 'retention-days' found in ${WORKFLOW}. The build artifact would inherit the repository default, ` +
            `which is not a deliberate choice against the approval window. Set it explicitly (>= ${MIN_RETENTION_DAYS}).`,
    );
}
for (const match of retentions) {
    const days = Number(match[1]);
    if (days < MIN_RETENTION_DAYS) {
        failures.push(
            `retention-days is ${days}, below the ${MIN_RETENTION_DAYS}-day minimum. The 'publish' job waits on the ` +
                `'npm-publish' environment approval, which has NO time limit — sizing retention against pipeline ` +
                `runtime instead of the approval window makes any release approved more than ${days} day(s) after ` +
                `merge unpublishable on its own run (WR-0615).`,
        );
    }
}

// 2. The artifact download must be soft — never a hard dependency of publishing.
const download = steps.find((step) => step.text.includes('actions/download-artifact'));
if (!download) {
    failures.push(`no 'actions/download-artifact' step found in ${WORKFLOW}; this gate's assumptions no longer hold.`);
} else if (!/^\s*continue-on-error:\s*true\s*$/m.test(download.text)) {
    failures.push(
        `the 'actions/download-artifact' step (line ${download.startLine}) is missing 'continue-on-error: true'. ` +
            `A hard download makes the release fail outright when the artifact has expired, with an error that ` +
            `blames the upload rather than the approval delay (WR-0615).`,
    );
}

// 3. A rebuild fallback must exist, conditioned on the download's outcome.
const fallback = steps.find(
    (step) => /if:.*\.outcome\s*!=\s*'success'/.test(step.text) && /npm run build/.test(step.text),
);
if (!fallback) {
    failures.push(
        `no rebuild fallback found in ${WORKFLOW}. Expected a step guarded by ` +
            `"if: steps.<download-id>.outcome != 'success'" that runs 'npm run build', so an expired or deleted ` +
            `artifact is rebuilt from the same pinned commit instead of blocking the release (WR-0615).`,
    );
} else if (!/::warning/.test(fallback.text)) {
    failures.push(
        `the rebuild fallback (line ${fallback.startLine}) recovers silently. It must emit a '::warning' naming the ` +
            `approval delay as the cause — a silent recovery is how this defect stayed invisible for three days.`,
    );
}

/**
 * Second invariant, added 2026-08-26: the OIDC approval request must be raised only by
 * an actual release.
 *
 * `publish` sits behind a human approval that mints publish credentials for the whole
 * fleet. The workflow trigger is `paths: packages/*` + `/package.json`, which is a proxy
 * for "a version changed" and not the same thing — dependabot edits package manifests
 * too. Seven runs reached the approval gate with nothing to publish (six dependabot
 * merges on 2026-08-24, one echo-string edit in #220) before this was closed.
 *
 * Guarded here rather than trusted, because the failure is silent in the expensive
 * direction: if the condition is ever dropped, nothing breaks and nothing is logged —
 * the queue of pointless approvals simply returns, and an approver trained to wave them
 * through is the actual risk. Asserting all three legs (the job runs, publish depends on
 * it, publish is conditioned on its output) because any one alone is satisfiable while
 * the gate does nothing.
 */
const detectStep = steps.find((step) => /scripts\/detect-publishable\.mjs/.test(step.text));
if (!detectStep) {
    failures.push(
        `no step running 'scripts/detect-publishable.mjs' found in ${WORKFLOW}. Without it, every push touching a ` +
            `package manifest raises an OIDC approval request, including dependency bumps that publish nothing.`,
    );
}

const publishJob = jobBlock('publish');
if (!publishJob) {
    failures.push(`could not find the 'publish' job in ${WORKFLOW}; this gate's assumptions no longer hold.`);
} else {
    const needs = jobKey(publishJob, 'needs');
    if (!needs) {
        failures.push(
            `could not find the 'publish' job's 'needs:' in ${WORKFLOW}; this gate's assumptions no longer hold.`,
        );
    } else if (!/detect/.test(needs[1])) {
        failures.push(
            `the 'publish' job does not list 'detect' in its needs (found: ${needs[1].trim()}). The release-signal ` +
                `check cannot gate a job that does not depend on it.`,
        );
    }

    // Read from the publish job's OWN lines. The previous form of this leg matched the
    // whole file, so the condition passed wherever it appeared — including on another
    // job, or orphaned in a comment while 'publish' ran unconditioned (crit, PR #221).
    const condition = jobKey(publishJob, 'if');
    if (!condition || !/needs\.detect\.outputs\.publishable/.test(condition[1])) {
        failures.push(
            `the 'publish' job's own 'if:' does not branch on 'needs.detect.outputs.publishable' ` +
                `(found: ${condition ? condition[1].trim() : 'no if: at all'}). Depending on 'detect' without ` +
                `branching on its output runs the check and then ignores it — the approval request is raised regardless.`,
        );
    } else if (!/needs\.detect\.outputs\.publishable\s*!=\s*'false'/.test(condition[1])) {
        // The direction is the guarantee, not a style choice. `== 'true'` reads every
        // way of NOT hearing an answer — detect crashing, its output write throwing —
        // as "nothing to publish", which is the one error this pipeline may never make.
        failures.push(
            `the 'publish' job branches on the release signal in the fail-OPEN direction ` +
                `(found: ${condition[1].trim()}). It must be "needs.detect.outputs.publishable != 'false'": only a ` +
                `POSITIVE "nothing to publish" may suppress the job, because "== 'true'" also suppresses it when ` +
                `'detect' failed or never wrote its output — silently dropping a real release and reporting success.`,
        );
    } else if (!/needs\.build\.result\s*==\s*'success'/.test(condition[1])) {
        failures.push(
            `the 'publish' job's 'if:' overrides the implicit needs-gate (found: ${condition[1].trim()}) without ` +
                `re-asserting "needs.build.result == 'success'". An '!cancelled()'-style condition lets 'publish' ` +
                `run on a FAILED build, which is a different release defect than the one being fixed.`,
        );
    }
}

/**
 * Fourth leg: the decision itself must be executed by a gate that runs on PRs.
 *
 * The three legs above assert the wiring in `publish.yml` as TEXT — they never invoke
 * `detect-publishable`. `publish.yml`'s 'detect' job runs it only on push to main, so
 * without a PR-time test its branches reach the OIDC gate unexecuted, and an inverted
 * comparison ships fully green (crit blocker, PR #221). The test file and the vitest
 * project that collects it are asserted together: either one alone is satisfiable while
 * nothing runs.
 */
const DETECT_TEST = 'scripts/detect-publishable.test.mjs';
if (!existsSync(DETECT_TEST)) {
    failures.push(
        `${DETECT_TEST} is missing. The release-signal decision logic would then run for the first time on 'main', ` +
            `inside the approval gate it exists to make trustworthy.`,
    );
}
const vitestConfig = (() => {
    try {
        return readFileSync('vitest.config.ts', 'utf8');
    } catch (error) {
        return `__unreadable: ${error.message}`;
    }
})();
if (!/scripts\/\*\*\/\*\.test\.mjs/.test(vitestConfig)) {
    failures.push(
        `vitest.config.ts no longer collects 'scripts/**/*.test.mjs'. 'test.projects' is scoped to workspace ` +
            `packages, so a script test outside an explicit project is silently never run — the test file exists, ` +
            `the gate reports PASS, and nothing executes the release decision before it gates production.`,
    );
}

if (failures.length > 0) {
    console.error(`validate:workflows gate FAIL — ${WORKFLOW}:\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
}

console.log(
    `validate:workflows gate PASS — ${WORKFLOW}: artifact retention >= ${MIN_RETENTION_DAYS}d, ` +
        `download is soft, rebuild fallback present and loud, the OIDC approval is gated on a real release signal ` +
        `in the fail-closed direction, and that signal's decision logic is exercised at PR time.`,
);
