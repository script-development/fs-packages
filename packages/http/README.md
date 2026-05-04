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

Per **Doctrine #8 library-author extension** (war-room CLAUDE.md, 2026-04-22), the factory applies a **30000ms default timeout** with `timeout: 0` opt-out and per-request override. See [the docs site Timeout section](https://packages.script.nl/packages/http#timeout) for the full surface contract.

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
