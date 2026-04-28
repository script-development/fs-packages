# fs-loading

Reactive loading state service with counter-based tracking and HTTP middleware integration.

```bash
npm install @script-development/fs-loading
```

**Peer dependencies:** `vue ^3.5.0`, `@script-development/fs-http ^1.0.0`

## What It Does

`fs-loading` tracks whether your application is currently loading data. It uses a **counter** instead of a boolean — multiple concurrent requests each increment the counter, and loading stays true until all of them complete. It integrates with `fs-http` via middleware so you don't have to manually track each request.

## Basic Usage

### Manual Tracking

```typescript
import {createLoadingService} from '@script-development/fs-loading';

const loading = createLoadingService();

loading.isLoading.value; // false

loading.startLoading();
loading.isLoading.value; // true

loading.startLoading(); // second concurrent operation
loading.isLoading.value; // still true (counter = 2)

loading.stopLoading();
loading.isLoading.value; // still true (counter = 1)

loading.stopLoading();
loading.isLoading.value; // false (counter = 0)
```

### Automatic HTTP Integration

The real power is the middleware integration. Register it once and every HTTP request automatically tracks loading state:

```typescript
import {createHttpService} from '@script-development/fs-http';
import {createLoadingService, registerLoadingMiddleware} from '@script-development/fs-loading';

const http = createHttpService('https://api.example.com');
const loading = createLoadingService();

// Wire them together
registerLoadingMiddleware(http, loading);

// Now every request automatically updates loading state
await http.getRequest('/users'); // isLoading: true → false
await http.postRequest('/users', data); // isLoading: true → false
```

In a Vue component:

```vue
<script setup lang="ts">
import {loading} from '@/services';
</script>

<template>
    <div v-if="loading.isLoading.value" class="spinner" />
    <main v-else>
        <slot />
    </main>
</template>
```

## Timeout Protection

Long-running or stuck requests can leave loading state active forever. The middleware supports a timeout that automatically decrements the counter:

```typescript
registerLoadingMiddleware(http, loading, {
    timeoutMs: 30000, // 30 seconds — auto-recover if a request hangs
});
```

Set `timeoutMs: 0` to disable the timeout entirely.

::: tip Why a counter?
A boolean `isLoading` flag fails when you have concurrent requests. Request A starts → `isLoading = true`. Request B starts. Request A finishes → `isLoading = false`. But Request B is still in flight! The counter prevents this: A starts (1), B starts (2), A finishes (1), B finishes (0). Loading only becomes false when everything is done.
:::

## Waiting for Loading to Finish

`ensureLoadingFinished()` returns a promise that resolves when the counter reaches zero. Useful when you need to wait for all pending operations before proceeding:

```typescript
// Wait for all in-flight requests to complete
await loading.ensureLoadingFinished();

// Now safe to proceed — no pending operations
```

## Cleanup

The `registerLoadingMiddleware` function returns an object with an `unregister` method that removes all middleware and clears pending timeouts:

```typescript
const {unregister} = registerLoadingMiddleware(http, loading);

// Later: clean up everything
unregister();
```

## API Reference

### `createLoadingService()`

Returns a loading service with counter-based state tracking. No parameters.

### Service Properties

| Property                  | Type                        | Description                       |
| ------------------------- | --------------------------- | --------------------------------- |
| `isLoading`               | `ComputedRef<boolean>`      | `true` when counter > 0           |
| `activeCount`             | `DeepReadonly<Ref<number>>` | Current counter value (read-only) |
| `startLoading()`          | `() => void`                | Increment counter                 |
| `stopLoading()`           | `() => void`                | Decrement counter (floor at 0)    |
| `ensureLoadingFinished()` | `() => Promise<void>`       | Resolves when counter reaches 0   |

### `registerLoadingMiddleware(httpService, loadingService, options?)`

| Parameter           | Type             | Description                                                    |
| ------------------- | ---------------- | -------------------------------------------------------------- |
| `httpService`       | `HttpService`    | The HTTP service to hook into                                  |
| `loadingService`    | `LoadingService` | The loading service to update                                  |
| `options.timeoutMs` | `number`         | Auto-recovery timeout in ms (default: `30000`, `0` = disabled) |

**Returns:** `{ unregister: () => void }`
