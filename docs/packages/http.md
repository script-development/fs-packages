# fs-http

HTTP service factory with middleware architecture.

```bash
npm install @script-development/fs-http
```

## What It Does

`fs-http` wraps [axios](https://axios-http.com/) in a factory pattern, giving you typed HTTP methods and a middleware pipeline for intercepting requests and responses. It's framework-agnostic — no Vue dependency.

## Basic Usage

```typescript
import {createHttpService} from '@script-development/fs-http';

const http = createHttpService('https://api.example.com');

// All methods are generic — pass your response type
const response = await http.getRequest<User[]>('/users');
const users = response.data;

// POST with data
await http.postRequest<User>('/users', {name: 'Alice', email: 'alice@example.com'});

// PUT, PATCH, DELETE
await http.putRequest<User>('/users/1', updatedUser);
await http.patchRequest<User>('/users/1', {name: 'Bob'});
await http.deleteRequest('/users/1');
```

## Configuration

```typescript
const http = createHttpService('https://api.example.com', {
    // Request timeout in milliseconds (default: 30000, pass 0 to disable)
    timeout: 30_000,

    // Send cookies with cross-origin requests (default: true)
    withCredentials: true,

    // Include XSRF token header (default: false)
    withXSRFToken: false,

    // Auto-toggle credentials based on same-origin check (default: false)
    smartCredentials: true,

    // Additional default headers
    headers: {'X-Custom-Header': 'value'},
});
```

### Smart Credentials

When `smartCredentials` is enabled, the service automatically includes credentials for same-origin requests and excludes them for cross-origin requests. This is useful when your application talks to both your own API and third-party services.

## Timeout

The factory ships a compliant timeout surface per the **Doctrine #8 library-author extension** (war-room CLAUDE.md, 2026-04-22).

> Library-author extension (2026-04-22) — Shared HTTP factory packages (e.g., `@script-development/fs-http`) must expose a compliant timeout surface: a default, a required option, or a documented contract plus consumer-level enforcement. Inheriting framework defaults at the library layer silently propagates the violation to every consumer territory.

### Default

Every request method that goes through the axios pipeline — `getRequest`, `postRequest`, `putRequest`, `patchRequest`, `deleteRequest` — inherits a **30000ms (30s) default timeout** when no override is provided. This default is the Armory's compliance posture: consumer territories that adopt fs-http inherit Doctrine #8 enforcement automatically rather than re-implementing it per call.

### Service-wide Override

Pass `timeout` in the options to tighten (or relax) the service-wide default for every request the service issues:

```typescript
// Tighten for a fast-API service
const http = createHttpService('https://api.example.com', {timeout: 5_000});
```

### Service-wide Opt-out

Pass `timeout: 0` to disable the default. The consumer accepts Doctrine #8 enforcement at the call layer — typical use cases are AI streaming endpoints with their own timeout discipline, where a bounded request timeout is wrong by construction:

```typescript
const http = createHttpService('https://ai.example.com', {timeout: 0});
```

### Per-request Override

The existing `AxiosRequestConfig.timeout` parameter on each method overrides the service-wide value for a single call. Use this when most calls fit the service default but a specific endpoint needs different latency tolerance:

```typescript
// Service default (30000ms) for most calls; per-call override for the long one
await http.postRequest('/generate-report', payload, {timeout: 120_000});
```

### `DEFAULT_TIMEOUT_MS`

The default is also exported as a barrel-level constant for consumers that want to reference it explicitly (e.g., to derive a related timeout, or to assert parity in a test):

```typescript
import {DEFAULT_TIMEOUT_MS} from '@script-development/fs-http';
```

## Middleware

The middleware system lets you intercept requests at three points in the lifecycle. Every registration returns an unregister function:

### Request Middleware

Runs before each request is sent. Use it for authentication headers, request logging, or request modification:

```typescript
const unregister = http.registerRequestMiddleware((config) => {
    const token = getAuthToken();
    if (token) {
        config.headers.set('Authorization', `Bearer ${token}`);
    }
});

// Later: stop intercepting
unregister();
```

### Response Middleware

Runs after a successful response. Use it for response logging, analytics, or cache invalidation:

```typescript
const unregister = http.registerResponseMiddleware((response) => {
    console.log(`${response.config.method} ${response.config.url} → ${response.status}`);
});
```

### Response Error Middleware

Runs when a request fails. Use it for global error handling, authentication redirects, or error reporting:

```typescript
const unregister = http.registerResponseErrorMiddleware((error) => {
    if (error.response?.status === 401) {
        redirectToLogin();
    }

    if (error.response?.status === 500) {
        reportToSentry(error);
    }
});
```

::: tip Composing middleware
Other packages hook into these middleware points. `fs-loading` registers request + response + error middleware to track loading state. `fs-dialog` can register error middleware to show error dialogs. You can stack as many middleware handlers as you need — they all run independently.
:::

## File Operations

### Download

Downloads a file and triggers a browser save dialog:

```typescript
await http.downloadRequest('/reports/annual', 'annual-report', 'application/pdf');
```

### Preview

Creates a blob URL for inline preview (images, PDFs):

```typescript
const blobUrl = await http.previewRequest('/documents/123/preview');
// Use in an <img> or <iframe> src
```

### Streaming

Uses the native `fetch` API for streaming responses (useful for server-sent events or AI completions):

```typescript
const response = await http.streamRequest('/ai/generate', {prompt: 'Hello'}, abortController.signal);

const reader = response.body?.getReader();
```

## Error Handling

Use the `isAxiosError` type guard to safely check errors:

```typescript
import {isAxiosError} from '@script-development/fs-http';

try {
    await http.postRequest('/users', data);
} catch (error) {
    if (isAxiosError<{message: string}>(error)) {
        // error.response?.data is typed as { message: string }
        console.error(error.response?.data.message);
    }
}
```

## API Reference

### `createHttpService(baseURL, options?)`

| Parameter                  | Type                     | Description                                                            |
| -------------------------- | ------------------------ | ---------------------------------------------------------------------- |
| `baseURL`                  | `string`                 | Base URL for all requests                                              |
| `options.timeout`          | `number \| undefined`    | Request timeout in milliseconds (default: `30000`; pass `0` to disable) |
| `options.headers`          | `Record<string, string>` | Default headers                                                        |
| `options.withCredentials`  | `boolean`                | Send cookies cross-origin (default: `true`)                            |
| `options.withXSRFToken`    | `boolean`                | Include XSRF token (default: `false`)                                  |
| `options.smartCredentials` | `boolean`                | Auto-toggle credentials by origin (default: `false`)                   |

### Constants

| Constant             | Type           | Description                                                                              |
| -------------------- | -------------- | ---------------------------------------------------------------------------------------- |
| `DEFAULT_TIMEOUT_MS` | `const number` | Service-wide default timeout in milliseconds (`30000`); barrel-exported for consumer use |

### Service Methods

| Method                                      | Returns                     |
| ------------------------------------------- | --------------------------- |
| `getRequest<T>(endpoint, options?)`         | `Promise<AxiosResponse<T>>` |
| `postRequest<T>(endpoint, data, options?)`  | `Promise<AxiosResponse<T>>` |
| `putRequest<T>(endpoint, data, options?)`   | `Promise<AxiosResponse<T>>` |
| `patchRequest<T>(endpoint, data, options?)` | `Promise<AxiosResponse<T>>` |
| `deleteRequest<T>(endpoint, options?)`      | `Promise<AxiosResponse<T>>` |
| `downloadRequest(endpoint, name, type?)`    | `Promise<AxiosResponse>`    |
| `previewRequest(endpoint)`                  | `Promise<string>`           |
| `streamRequest(endpoint, data, signal?)`    | `Promise<Response>`         |

### Middleware Registration

| Method                                | Returns                |
| ------------------------------------- | ---------------------- |
| `registerRequestMiddleware(fn)`       | `UnregisterMiddleware` |
| `registerResponseMiddleware(fn)`      | `UnregisterMiddleware` |
| `registerResponseErrorMiddleware(fn)` | `UnregisterMiddleware` |
