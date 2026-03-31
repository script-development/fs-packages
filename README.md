# fs-packages

Shared frontend service packages for the script-development ecosystem.

## Packages

| Package                                        | Description                                     | Version                                                                                                                     |
| ---------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| [@script-development/fs-http](./packages/http) | Framework-agnostic HTTP service with middleware | ![version](https://img.shields.io/github/package-json/v/script-development/fs-packages?filename=packages/http/package.json) |

## Development

```bash
npm install          # Install all dependencies
npm run build        # Build all packages
npm run test         # Run all tests
npm run lint         # Lint all packages
npm run format       # Format all packages
```

## Adding a Package

1. Create `packages/{name}/` with `package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`
2. Name it `@script-development/fs-{name}`
3. Add tests with 100% coverage threshold
4. Create a changeset: `npx changeset`

## Publishing

Packages are published to GitHub Packages via changesets. After merging changes:

1. `npx changeset` — describe the change and version bump
2. `npx changeset version` — apply version bumps and generate changelog
3. Commit the version bump
4. Push to main — CI publishes automatically

## Consuming

Add to your project's `.npmrc`:

```
@script-development:registry=https://npm.pkg.github.com
```

Then install:

```bash
npm install @script-development/fs-http
```
