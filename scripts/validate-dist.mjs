#!/usr/bin/env node
// Dist-validation gate — asserts every workspace package's published tarball
// carries its four REQUIRED dual-format build artifacts, present and non-empty.
//
// WHY THIS EXISTS (PR-time, not just release-time):
//   The same assertion previously lived ONLY inline in .github/workflows/publish.yml,
//   gated behind `environment: npm-publish` + `paths: packages/*/package.json` — so
//   it fired at RELEASE time and never on a PR. An empty/missing-dist regression (the
//   exact class of the fs-http 0.1.1 / 0.1.2 empty-tarball incident — see territory
//   pulse 2026-04-22) was therefore invisible until publish, after merge. This script
//   is the single source of truth for the assertion so the PR-time gate (ci.yml, after
//   `npm run build`) and the release-time gate (publish.yml, before `changeset publish`)
//   CANNOT drift: both invoke `npm run validate:dist`.
//
// CONTRACT:
//   For each packages/*/package.json, runs `npm pack --dry-run --json` and inspects
//   the would-be-published file list. Each of the four REQUIRED paths must be present
//   and have size > 0. A missing path or a 0-byte artifact fails the gate (exit 1) with
//   a GitHub `::error::` annotation per offending package/artifact.
//
//   `npm pack --dry-run` reflects the real published tarball (honors `files`/`.npmignore`/
//   `exports`), so this catches both "build never ran" (no dist) and "build emitted an
//   empty file" regressions, AND a package whose `files` manifest stops shipping dist.
//
// SCOPE: presence + non-emptiness of the four dual-format entry artifacts only. It does
//   NOT validate artifact contents, type correctness (attw covers that in lint:pkg), or
//   any non-entry file. The build must have run before this script (CI orders it after
//   `npm run build`).

import {spawnSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';

const PACKAGES_DIR = 'packages';

// The four dual-format (ESM + CJS) entry artifacts every package's tsdown build emits
// and every manifest ships. Paths are tarball-relative (npm pack --dry-run --json
// reports `dist/index.mjs`, not an absolute path).
const REQUIRED = ['dist/index.mjs', 'dist/index.cjs', 'dist/index.d.mts', 'dist/index.d.cts'];

const listPackageDirs = () =>
    readdirSync(PACKAGES_DIR)
        .map((name) => path.join(PACKAGES_DIR, name))
        .filter((dir) => {
            // A stray file in packages/ is legitimately not a package — skip it. The dir
            // statSync is intentionally uncaught: a race/EACCES on an entry readdir just
            // returned is a real I/O fault and must fail the gate loud, never vanish.
            if (!statSync(dir).isDirectory()) {
                return false;
            }
            try {
                return statSync(path.join(dir, 'package.json')).isFile();
            } catch (err) {
                // Only a genuinely-absent manifest (ENOENT) means "not a package" — skip.
                // EACCES / EIO / a transient race on a real package's manifest must NOT be
                // swallowed into a silent skip: dropping a package from validation is the
                // exact silent-pass this gate exists to prevent. Fail loud instead.
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
        })
        .sort();

const packageName = (dir) => JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).name ?? dir;

// Returns the tarball file list from `npm pack --dry-run --json`, or null on failure.
const packFileList = (dir) => {
    const result = spawnSync('npm', ['pack', '--dry-run', '--json'], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        shell: false,
    });
    if (result.status !== 0) {
        process.stderr.write(result.stderr ?? '');
        return null;
    }
    try {
        const parsed = JSON.parse(result.stdout);
        return parsed[0]?.files ?? null;
    } catch {
        return null;
    }
};

const main = () => {
    const dirs = listPackageDirs();

    // Floor assertion: a zero-package result means packages/ is present but empty (a
    // catastrophic checkout/artifact failure), or every entry was filtered out. With no
    // dirs the loop never runs, failures stays empty, and the gate would PASS on nothing
    // validated — a silent green. Refuse it.
    if (dirs.length === 0) {
        process.stderr.write(
            '::error::validate:dist found 0 packages under packages/ — refusing to pass with nothing validated (empty checkout or missing artifact?)\n',
        );
        process.exit(1);
    }

    const failures = [];

    for (const dir of dirs) {
        const name = packageName(dir);
        process.stdout.write(`\n--- validate:dist ${name} (${dir}) ---\n`);

        const files = packFileList(dir);
        if (files === null) {
            const msg = `${name}: \`npm pack --dry-run --json\` failed or returned no file list`;
            process.stdout.write(`::error::${msg}\n`);
            failures.push(msg);
            continue;
        }

        for (const required of REQUIRED) {
            const entry = files.find((f) => f.path === required);
            if (entry === undefined) {
                const msg = `${name} is missing ${required} in published tarball`;
                process.stdout.write(`::error::${msg}\n`);
                failures.push(msg);
            } else if (entry.size === 0) {
                const msg = `${name} ${required} is 0 bytes`;
                process.stdout.write(`::error::${msg}\n`);
                failures.push(msg);
            } else {
                process.stdout.write(`  ${required}: ${entry.size} bytes OK\n`);
            }
        }
    }

    if (failures.length > 0) {
        process.stderr.write(`\nDist validation FAILED (${failures.length}). Refusing empty or incomplete tarballs:\n`);
        for (const f of failures) {
            process.stderr.write(`  - ${f}\n`);
        }
        process.exit(1);
    }

    process.stdout.write(
        `\nvalidate:dist gate PASS — ${dirs.length} packages: required dist/ artifacts present and non-empty.\n`,
    );
};

main();
