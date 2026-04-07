# fs-packages

Shared frontend service packages for the script-development ecosystem, published to the public npm registry under the `@script-development` scope.

## Packages

| Package                                                          | Description                                                                                          |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| [@script-development/fs-adapter-store](./packages/adapter-store) | Reactive adapter-store pattern with domain state management and CRUD resource adapters               |
| [@script-development/fs-dialog](./packages/dialog)               | Component-agnostic dialog stack service for Vue 3 — LIFO management with error middleware            |
| [@script-development/fs-helpers](./packages/helpers)             | Tree-shakeable shared utility helpers: deep copy, type guards, and case conversion                   |
| [@script-development/fs-http](./packages/http)                   | Framework-agnostic HTTP service factory with middleware architecture                                 |
| [@script-development/fs-loading](./packages/loading)             | Reactive loading state service with counter-based tracking and HTTP middleware                       |
| [@script-development/fs-storage](./packages/storage)             | Framework-agnostic localStorage service factory with prefix namespacing                              |
| [@script-development/fs-theme](./packages/theme)                 | Reactive theme service with dark/light mode, system preference detection, and storage persistence    |
| [@script-development/fs-toast](./packages/toast)                 | Component-agnostic toast queue service for Vue 3 — FIFO management                                   |
| [@script-development/fs-translation](./packages/translation)     | Type-safe reactive i18n service for Vue 3 — multi-locale, dot-notation keys, parameter interpolation |

## Development

```bash
npm install          # Install all dependencies
npm run build        # Build all packages
npm run test         # Run all tests
npm run lint         # Lint all packages
npm run format       # Format all packages
```

## Adding a Package

1. Create `packages/{name}/` with `package.json`, `tsconfig.json`, `tsdown.config.ts`, `vitest.config.ts`
2. Name it `@script-development/fs-{name}`
3. Add tests with 100% coverage threshold
4. Add mutation testing with 90% score threshold
5. Create a changeset: `npx changeset`

## Publishing

Packages are published to the **public npm registry** via OIDC Trusted Publishing. After merging changes:

1. `npx changeset` — describe the change and version bump
2. `npx changeset version` — apply version bumps and generate changelog
3. Commit the version bump
4. Push to main — CI publishes automatically with provenance attestation

## Consuming

Install directly from npm:

```bash
npm install @script-development/fs-http
```
