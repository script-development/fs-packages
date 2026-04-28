# Contributing

## Prerequisites

- **Node.js** 22+
- **npm** 11+

Clone the repository and install dependencies:

```bash
git clone https://github.com/script-development/fs-packages.git
cd fs-packages
npm install
```

## Development Workflow

### Building

All packages build with [tsdown](https://tsdown.dev/) (Rolldown/oxc), producing dual ESM + CJS output with TypeScript declarations:

```bash
npm run build
```

::: warning Build before typecheck
Cross-package type resolution requires built `.d.mts` files. Always run `npm run build` before `npm run typecheck`. The CI pipeline enforces this order.
:::

### Testing

Tests use [vitest](https://vitest.dev/) with the workspace configuration. Every package must maintain **100% code coverage**:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run mutation testing (90% threshold per package)
npm run test:mutation
```

Browser-dependent tests use [happy-dom](https://github.com/nicedaycode/happy-dom) as the test environment. Annotate test files with:

```typescript
// @vitest-environment happy-dom
```

### Linting and Formatting

```bash
# Lint with oxlint
npm run lint

# Format with oxfmt
npm run format

# Check formatting without writing
npm run format:check
```

### Package Quality

Every package is checked by [publint](https://publint.dev/) (correct exports) and [attw](https://arethetypeswrong.github.io/) (correct types):

```bash
npm run lint:pkg
```

## The 8-Gate CI Pipeline

Every pull request must pass all 8 gates in order:

| Gate            | Command                 | What it checks                               |
| --------------- | ----------------------- | -------------------------------------------- |
| 1. Audit        | `npm audit`             | No known vulnerabilities in dependencies     |
| 2. Format       | `npm run format:check`  | Code follows oxfmt formatting rules          |
| 3. Lint         | `npm run lint`          | No oxlint violations                         |
| 4. Build        | `npm run build`         | All packages compile successfully            |
| 5. Typecheck    | `npm run typecheck`     | No TypeScript errors in strict mode          |
| 6. Package lint | `npm run lint:pkg`      | Package exports are correct (publint + attw) |
| 7. Coverage     | `npm run test:coverage` | 100% code coverage per package               |
| 8. Mutation     | `npm run test:mutation` | 90% mutation score per package               |

::: tip Why mutation testing?
100% code coverage means every line of code was executed during tests. It does not mean every line was actually **verified**. Mutation testing changes your code (introduces "mutants") and checks whether your tests catch the change. A 90% mutation score means your tests detect 90% of possible bugs — not just that they run the code.
:::

## Adding a New Package

### 1. Create the package directory

```bash
mkdir -p packages/{name}/src packages/{name}/tests
```

### 2. Set up package.json

```json
{
    "name": "@script-development/fs-{name}",
    "version": "0.0.0",
    "type": "module",
    "exports": {
        ".": {
            "import": {"types": "./dist/index.d.mts", "default": "./dist/index.mjs"},
            "require": {"types": "./dist/index.d.cts", "default": "./dist/index.cjs"}
        }
    },
    "main": "./dist/index.cjs",
    "module": "./dist/index.mjs",
    "types": "./dist/index.d.mts",
    "files": ["dist"],
    "scripts": {
        "build": "tsdown",
        "typecheck": "tsc --noEmit",
        "lint:pkg": "publint && attw --pack .",
        "test:mutation": "stryker run"
    },
    "publishConfig": {"access": "public"}
}
```

If your package uses Vue, add it as a peer dependency:

```json
{"peerDependencies": {"vue": "^3.5.0"}}
```

### 3. Set up configuration files

Every package needs these configuration files. Copy them from an existing package and adjust:

- `tsconfig.json` — extends the root `tsconfig.base.json`
- `tsdown.config.ts` — identical across packages
- `vitest.config.ts` — uses `defineProject` with 100% coverage thresholds
- `stryker.config.mjs` — 90% mutation threshold

### 4. Write the code

Follow the conventions:

- **Single entry point:** `src/index.ts` is the sole barrel export. Named exports only.
- **Factory pattern:** Export a `createXxxService()` function that returns a plain object.
- **No default exports.**

### 5. Create a changeset

```bash
npx changeset
```

Select your package, choose the version bump type (major/minor/patch), and write a description of the change. Changesets are how we track what changed and generate changelogs.

## Conventions

### Factory Functions

Every service package exports a `createXxxService()` factory:

```typescript
export function createExampleService(config: ExampleConfig): ExampleService {
    // private state here
    const state = ref(initialValue);

    // return public API as plain object
    return {
        value: computed(() => state.value),
        doSomething() {
            /* ... */
        },
    };
}
```

### Types

Export all types that consumers need. Use named exports, never default:

```typescript
// src/index.ts
export {createExampleService} from './example-service';
export type {ExampleService, ExampleConfig} from './types';
```

### Peer Dependencies

If your package depends on another `@script-development/fs-*` package, declare it as a **peer dependency**, not a regular dependency. This prevents duplicate installations:

```json
{"peerDependencies": {"@script-development/fs-http": "^1.0.0"}}
```

### Testing

Write tests alongside your source code in the `tests/` directory. Use `describe` + `it` blocks:

```typescript
import {describe, expect, it} from 'vitest';
import {createExampleService} from '../src';

describe('createExampleService', () => {
    it('returns the initial value', () => {
        const service = createExampleService({initial: 42});
        expect(service.value.value).toBe(42);
    });
});
```

## Publishing

Packages are published to npm via **OIDC Trusted Publishing** — no stored tokens. The publish workflow triggers automatically when changesets are merged to `main`.

To prepare a release:

1. Create your changes on a branch
2. Run `npx changeset` to describe what changed
3. Open a PR — CI runs all 8 gates
4. After merge, the changeset bot creates a "Version Packages" PR
5. Merging that PR triggers the publish workflow
