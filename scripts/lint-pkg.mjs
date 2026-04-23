#!/usr/bin/env node
// Gate 6 (lint:pkg) enforcer — treats publint suggestions/warnings/errors as fatal.
//
// publint 0.3.18 CLI does not expose a flag to fail on suggestions (--strict
// only promotes warnings → errors). This wrapper fills that gap: it runs
// publint per workspace, captures stdout, and fails the gate if any package
// emits a "Suggestions:", "Warnings:", or "Errors:" block. attw --pack runs
// after publint per package and preserves its own exit code.
//
// See enforcement queue #33 and the PR #35 regression that motivated this
// tightening: publint suggestions about the "git+" URL prefix silently
// re-drifted across 10 packages because the gate tolerated them.

import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PACKAGES_DIR = "packages";
const PUBLINT_BLOCK_RE = /^(Suggestions|Warnings|Errors):$/m;

function listPackageDirs() {
  return readdirSync(PACKAGES_DIR)
    .map((name) => join(PACKAGES_DIR, name))
    .filter((dir) => {
      try {
        return statSync(dir).isDirectory() && statSync(join(dir, "package.json")).isFile();
      } catch {
        return false;
      }
    })
    .sort();
}

function packageName(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  return pkg.name ?? dir;
}

function runCaptured(cmd, args, cwd) {
  const result = spawnSync(cmd, args, {
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
    shell: false,
  });
  const stdout = result.stdout ?? "";
  const stderr = result.stderr ?? "";
  process.stdout.write(stdout);
  process.stderr.write(stderr);
  return { stdout, stderr, status: result.status ?? 1 };
}

function main() {
  const dirs = listPackageDirs();
  const failures = [];

  for (const dir of dirs) {
    const name = packageName(dir);
    process.stdout.write(`\n--- lint:pkg ${name} (${dir}) ---\n`);

    const publint = runCaptured("npx", ["publint", "run"], dir);
    const publintBlock = PUBLINT_BLOCK_RE.exec(publint.stdout);
    if (publint.status !== 0) {
      failures.push(`${name}: publint exited ${publint.status}`);
    } else if (publintBlock) {
      failures.push(
        `${name}: publint emitted "${publintBlock[1]}:" block (fail-on-suggestion gate)`,
      );
    }

    const attw = runCaptured("npx", ["attw", "--pack"], dir);
    if (attw.status !== 0) {
      failures.push(`${name}: attw exited ${attw.status}`);
    }
  }

  if (failures.length > 0) {
    process.stderr.write(`\n\nlint:pkg gate FAILED (${failures.length}):\n`);
    for (const f of failures) {
      process.stderr.write(`  - ${f}\n`);
    }
    process.exit(1);
  }

  process.stdout.write(
    `\nlint:pkg gate PASS — ${dirs.length} packages clean (publint suggestions/warnings/errors all treated as fatal).\n`,
  );
}

main();
