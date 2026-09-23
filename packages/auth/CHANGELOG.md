# @script-development/fs-auth

## 0.2.0

### Minor Changes

- **Breaking:** `loadSession()` returns `SessionRead | undefined` instead of `void`. It answers the state THIS read wrote — captured where the write happens, never `state.value` after the await — together with the `me` answer's `status` and `body`. `undefined` means a newer read overtook this one: it wrote nothing, so it has nothing to report. A consumer assigning the call somewhere typed `void` stops compiling. See `DECISIONS.md` D23.
- **Breaking:** `LoginOutcome` gains a fourth arm, `{kind: 'unconfirmed', status, body}`. A login POST the server **accepted** whose confirming `me` did not establish a session is no longer reported as `refused` — the credentials are not what went wrong, and a consumer must not be able to reach for the credential-refusal sentence. `refused` now means the POST itself was refused or never answered, and its `status` is always the POST's; `unconfirmed` carries the `me` answer's, with `state.value` distinguishing `outage` from `signed_out`. An exhaustive `switch` on `kind` stops compiling, which is the point. See `DECISIONS.md` D22.
- No new session state: the machine stays at four. A consumer derives `rate_limited`, `network` or `blocked` from what these two shapes carry — documented as the consumer's classification, not the package's.

## 0.1.1

### Patch Changes

- First version published through the CI lane (OIDC Trusted Publishing, provenance attestation). No source change: `0.1.0` was bootstrapped out-of-band with a token because Trusted Publishing cannot create a package name, so it carries no provenance. This release is the positive control that the Trusted Publisher grant works.

## 0.1.0

### Minor Changes

- 248b5a2: Add fs-auth package (ADR-0050) — Sanctum SPA-cookie session store, safe-redirect guard and auth registrars for fs-http + fs-router. Hand-published 2026-09-17 with a temporary token (bootstrap, no provenance).
