# @script-development/fs-http

Framework-agnostic HTTP service factory with middleware architecture.

## Installation

```bash
npm install @script-development/fs-http
```

## Usage

```typescript
import {createHttpService} from '@script-development/fs-http';

const http = createHttpService('https://api.example.com', {withCredentials: true, smartCredentials: true});

// Standard requests
const response = await http.getRequest<User[]>('/users');
await http.postRequest('/users', {name: 'Alice'});

// Middleware
const unregister = http.registerRequestMiddleware((request) => {
    request.headers.set('X-Custom', 'value');
});

// Later: clean up
unregister();
```

## API

### `createHttpService(baseURL, options?)`

Creates a new HTTP service instance.

**Options:**

- `headers` — Additional default headers
- `withCredentials` — Send cookies cross-origin (default: `true`)
- `withXSRFToken` — Include XSRF token header (default: `false`)
- `smartCredentials` — Auto-toggle `withCredentials` based on request host matching base URL host (default: `false`)
- `timeout` — Request timeout in milliseconds (default: `30000`). Pass `0` to disable; pass any positive number to override.

### Timeout

The factory applies a **30000ms (30s) default timeout** to every request. This default is the Armory's compliance posture for the war-room **Doctrine #8 library-author extension** (CLAUDE.md, 2026-04-22):

> Library-author extension (2026-04-22) — Shared HTTP factory packages (e.g., `@script-development/fs-http`) must expose a compliant timeout surface: a default, a required option, or a documented contract plus consumer-level enforcement. Inheriting framework defaults at the library layer silently propagates the violation to every consumer territory.

To override the service-wide default, pass `timeout` in the options:

```typescript
// Tighten for a fast-API service
const http = createHttpService('https://api.example.com', {timeout: 5_000});
```

To disable the default and accept Doctrine #8 responsibility at the consumer layer (e.g., AI streaming endpoints with their own timeout discipline), pass `timeout: 0`:

```typescript
const http = createHttpService('https://ai.example.com', {timeout: 0});
```

Per-request overrides remain available via the existing `AxiosRequestConfig.timeout` parameter on each method:

```typescript
// Service default (30000ms) for most calls; per-call override for the long one
await http.postRequest('/generate-report', payload, {timeout: 120_000});
```

The constant is also exported as `DEFAULT_TIMEOUT_MS` for consumers that want to reference it explicitly.

### Request Methods

- `getRequest<T>(endpoint, options?)` — GET request
- `postRequest<T>(endpoint, data, options?)` — POST request
- `putRequest<T>(endpoint, data, options?)` — PUT request
- `patchRequest<T>(endpoint, data, options?)` — PATCH request
- `deleteRequest<T>(endpoint, options?)` — DELETE request
- `downloadRequest(endpoint, documentName, type?)` — Download file as blob (browser-only)
- `previewRequest(endpoint)` — Get object URL for inline preview (browser-only)
- `streamRequest(endpoint, data, signal?)` — Streaming POST via native fetch (browser-only)

### Middleware

- `registerRequestMiddleware(fn)` — Returns unregister function
- `registerResponseMiddleware(fn)` — Returns unregister function
- `registerResponseErrorMiddleware(fn)` — Returns unregister function

### Utilities

- `isAxiosError<T>(error)` — Type-safe axios error check
