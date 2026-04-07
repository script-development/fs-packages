# fs-packages — The Armory

Shared frontend service packages monorepo under the `@script-development` npm scope.

## Stack

- **Language:** TypeScript 5.9+ (strict mode, `verbatimModuleSyntax`)
- **Build:** tsdown (Rolldown/oxc) — dual ESM + CJS output
- **Test:** vitest 4 (100% coverage threshold) + Stryker (90% mutation threshold)
- **Lint:** oxlint
- **Format:** oxfmt
- **Package lint:** publint + attw (Are The Types Wrong)
- **Publish:** OIDC Trusted Publishing to public npm registry (no stored tokens)
- **CI:** 8-gate pipeline: audit → format → lint → build → typecheck → lint:pkg → coverage → mutation

## Packages (9)

| Package          | Vue | Description                                                       |
| ---------------- | --- | ----------------------------------------------------------------- |
| fs-http          | No  | HTTP service factory with middleware architecture                 |
| fs-storage       | No  | localStorage service factory with prefix namespacing              |
| fs-helpers       | No  | Tree-shakeable utilities: deep copy, type guards, case conversion |
| fs-theme         | Yes | Reactive dark/light mode with storage persistence                 |
| fs-loading       | Yes | Loading state service with HTTP middleware                        |
| fs-adapter-store | Yes | Reactive adapter-store pattern with CRUD resource adapters        |
| fs-toast         | Yes | Component-agnostic toast queue (FIFO)                             |
| fs-dialog        | Yes | Component-agnostic dialog stack (LIFO) with error middleware      |
| fs-translation   | Yes | Type-safe reactive i18n with dot-notation keys                    |

## Conventions

- **Factory pattern:** All packages export `createXxxService()` factory functions returning plain service objects. No classes, no singletons.
- **Single entry point:** Each package has `src/index.ts` as the sole barrel export. Named exports only, no defaults.
- **Peer dependencies:** Vue-dependent packages declare `vue` as a peer dep. Inter-package dependencies are peers too.
- **Loose coupling:** Prefer structural typing (duck types) over direct package imports where possible. `fs-theme`'s `ThemeStorageContract` is the exemplar.
- **Test environment:** Browser-dependent tests use `// @vitest-environment happy-dom` file-level comments.
- **Identical build config:** All packages share the same `tsdown.config.ts` structure.

## Build Order

Build before typecheck. Cross-package type resolution requires built `.d.mts` files. The CI pipeline enforces this order.

## Adding a Package

1. Create `packages/{name}/` with `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`
2. Name it `@script-development/fs-{name}`
3. Use `defineProject` from `vitest/config` in the vitest config
4. Add 100% coverage threshold and 90% mutation threshold
5. Create a changeset: `npx changeset`
