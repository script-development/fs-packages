# @script-development/fs-http

## 0.2.0 — 2026-04-30

### Minor Changes

- **fs-http**: Adds `timeout?: number` to `HttpServiceOptions` with a 30000ms default. Pass `timeout: 0` to disable (consumer accepts Doctrine #8 responsibility). Behavior change: previously-unset timeouts no longer hang indefinitely. Closes 3-spy convergent finding 2026-04-30.

## 0.1.0

### Minor Changes

- Initial release of @script-development/fs-http — framework-agnostic HTTP service factory with middleware architecture, based on proven patterns from BIO and kendo territories.
