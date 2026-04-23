# fs-packages — The Armory

Shared frontend service packages monorepo under the `@script-development` npm scope.

## Stack

- **Language:** TypeScript 5.9+ (strict mode, `verbatimModuleSyntax`)
- **Build:** tsdown (Rolldown/oxc) — dual ESM + CJS output
- **Test:** vitest 4 (100% coverage threshold) + Stryker (90% mutation threshold)
- **Lint:** oxlint (explicit config at `.oxlintrc.json`)
- **Format:** oxfmt
- **Package lint:** publint + attw (Are The Types Wrong) — `lint:pkg` enforces fail-on-any-advisory via `scripts/lint-pkg.mjs` (suggestions, warnings, and errors all treat as fatal — publint CLI default and `--strict` both exit 0 on suggestions). Motivated by enforcement queue #33 + the PR #35 `git+` prefix regression that silently drifted across 10 packages because the unenforced gate only printed the suggestion.
- **Publish:** OIDC Trusted Publishing to public npm registry (no stored tokens)
- **CI:** 8-gate pipeline: audit → format → lint → build → typecheck → lint:pkg → coverage → mutation

## Packages (10)

| Package          | Vue | Description                                                                                                      |
| ---------------- | --- | ---------------------------------------------------------------------------------------------------------------- |
| fs-http          | No  | HTTP service factory with middleware architecture                                                                |
| fs-storage       | No  | localStorage service factory with prefix namespacing                                                             |
| fs-helpers       | No  | Tree-shakeable utilities: deep copy, type guards, case conversion                                                |
| fs-theme         | Yes | Reactive dark/light mode with storage persistence                                                                |
| fs-loading       | Yes | Loading state service with HTTP middleware                                                                       |
| fs-adapter-store | Yes | Reactive adapter-store pattern with CRUD resource adapters                                                       |
| fs-toast         | Yes | Component-agnostic toast queue (FIFO)                                                                            |
| fs-dialog        | Yes | Component-agnostic dialog stack (LIFO) with error middleware                                                     |
| fs-translation   | Yes | Type-safe reactive i18n with dot-notation keys                                                                   |
| fs-router        | Yes | Type-safe router service factory with CRUD navigation, middleware pipeline, and custom components for Vue Router |

## Conventions

- **Factory pattern:** All packages export `createXxxService()` factory functions returning plain service objects. No classes, no singletons.
- **Single entry point:** Each package has `src/index.ts` as the sole barrel export. Named exports only, no defaults.
- **Peer dependencies:** Vue-dependent packages declare `vue` as a peer dep. Inter-package dependencies are peers too.
- **Loose coupling:** Prefer structural typing (duck types) over direct package imports where possible. `fs-theme`'s `ThemeStorageContract` is the exemplar.
- **Test environment:** Browser-dependent tests use `// @vitest-environment happy-dom` file-level comments.
- **Identical build config:** All packages share the same `tsdown.config.ts` structure.

## Commands

| Command                 | Purpose                                        |
| ----------------------- | ---------------------------------------------- |
| `npm run build`         | Build all packages (tsdown)                    |
| `npm run typecheck`     | Type-check all packages (requires build first) |
| `npm test`              | Run all tests                                  |
| `npm run test:coverage` | Run tests with coverage (100% threshold)       |
| `npm run test:mutation` | Run Stryker mutation testing (90% threshold)   |
| `npm run lint`          | Lint with oxlint                               |
| `npm run format:check`  | Check formatting with oxfmt                    |
| `npm run format`        | Fix formatting with oxfmt                      |
| `npm run lint:pkg`      | Run publint + attw on all packages             |
| `npm audit`             | Check for dependency vulnerabilities           |

**Build before typecheck.** Cross-package type resolution requires built `.d.mts` files. The CI pipeline enforces this order.

## Lint Rules

Lint configuration lives at `.oxlintrc.json` (repo-root, no per-package overrides). The explicit config declares three defaults so rule additions/removals land as a deliberate diff rather than silent upstream drift when oxlint bumps:

- **Plugins:** `typescript`, `unicorn`, `oxc` — the three plugins enabled by oxlint's own defaults.
- **Categories:** `correctness: "error"` — all 107 Correctness rules fail CI (was `warn`, so violations were silently tolerated pre-config).
- **`perf`, `suspicious`, `pedantic`, `style`, `restriction`, `nursery`:** unset — library posture is Correctness-only, opt-in per-rule for anything else.

To add a rule, set it in the `rules` object (e.g. `"perf/no-accumulating-spread": "error"`). To disable a default, set it to `"off"`. To opt into a whole category, add it to `categories` (be deliberate — `pedantic` has false positives, `nursery` is unstable). See `npx oxlint --rules` for the full catalog with default-on/off markers.

## Adding a Package

1. Create `packages/{name}/` with `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`
2. Name it `@script-development/fs-{name}`
3. Use `defineProject` from `vitest/config` in the vitest config
4. Add 100% coverage threshold and 90% mutation threshold
5. Bump version in the new package's `package.json` (manual — no changeset `.md` files)

## War Room ADR Projections

Distilled operational rules from cross-project Architecture Decision Records. Canonical source: [adrs.script.nl](https://adrs.script.nl). This section is maintained by the War Room — do not edit directly.
Last synced: 2026-04-17

### Applicable

#### ADR-0013: Adapter-Store Pattern

- Published here as `fs-adapter-store`. This territory is the canonical home of the pattern.
- Preserve the reactive adapter-store contract: `createAdapterStoreModule()` factory returning a module with `resourceAdapter` for CRUD plus typed `Adapted<T>` / `NewAdapted<T>` records.
- Changes to the pattern's surface (function signatures, exported types) are breaking for every consumer — treat them as major version decisions and coordinate with consumer territories (kendo, BIO).

#### ADR-0015: ADR Governance

- War Room ADRs are canonical at `adrs.script.nl`. Projections (this section) are distilled into territory CLAUDE.md by the War Room.
- Do not amend projections in this file directly. Propose amendments through the war room; the update propagates here.
- fs-packages is a full territory under the war room (not exempt like BIO).

#### ADR-0017: Page Integration Tests

- Kendo, BIO, and Entreezuil mock only `@script-development/fs-http` when running page integration tests. fs-http is the mock target; its public API (`createHttpService`, middleware hooks, `isAxiosError`) is the contract consumers depend on.
- Do not introduce breaking changes to fs-http's public API without coordinating with consumer territories' mock-server infrastructure.

### Not Applicable (Library Territory Rationale)

The following cross-project ADRs do not apply to fs-packages because it has no Laravel/PHP backend, no HTTP API surface, no database, and no app-UI:

- **ADR-0001** Audit Logging — Laravel/DB-backed; N/A.
- **ADR-0002** Cascade Deletion & Selective Soft Deletes — Laravel/DB-backed; N/A.
- **ADR-0009** Unified ResourceData Pattern — Laravel JSON response shape; N/A.
- **ADR-0011** Action Class Architecture — PHP `final readonly` action classes; N/A.
- **ADR-0012** FormRequest → DTO Flow — Laravel request pipeline; N/A.
- **ADR-0014** Domain-Driven Frontend Structure — App-level vertical slices by business domain; fs-packages is horizontal library infrastructure, not an app. N/A.
- **ADR-0016** Config Attribute Injection — PHP `#[Config]` attribute; N/A.
- **ADR-0019** Explicit Model Hydration — Eloquent model hydration; N/A.

Kendo-only or territory-scoped ADRs (0003, 0004, 0006, 0008, 0018) do not apply cross-territory.

### Internal / War-Room-Only

ADR-0005 (Spy System), ADR-0007 (Soldiers + Briefings), ADR-0010 (Squad System) govern war room operations, not territory code. No projection required.
