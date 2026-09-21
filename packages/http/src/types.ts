import type {AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from 'axios';

import type {GuardedMiddlewareErrorHandler} from './guarded';

export type AxiosResponseError = Record<string, unknown>;

export type RequestMiddlewareFunc = (request: InternalAxiosRequestConfig) => void;
export type ResponseMiddlewareFunc = (response: AxiosResponse) => void;
export type ResponseErrorMiddlewareFunc = (error: AxiosError<AxiosResponseError>) => void;

export type UnregisterMiddleware = () => void;

/**
 * Options for a `register*Middleware` call (ADR-0037).
 *
 * `guard` (default `true`): wrap the middleware body in `guarded()` so a
 * side-effect throw cannot corrupt the interceptor chain. Pass `{guard: false}`
 * to register the raw body unguarded — the deliberate escape hatch for a case
 * that genuinely wants a throw to propagate. No such case exists today.
 */
export interface RegisterMiddlewareOptions {
    guard?: boolean;
}

export interface HttpServiceOptions {
    headers?: Record<string, string>;
    withCredentials?: boolean;
    withXSRFToken?: boolean;
    smartCredentials?: boolean;
    /**
     * Request timeout in milliseconds. Defaults to 30_000 (30s).
     * Set 0 to disable (caller takes responsibility per Doctrine #8).
     * Per-request override available via the `AxiosRequestConfig.timeout`
     * parameter on each method.
     */
    timeout?: number;
    /**
     * Handler invoked when an auto-guarded middleware body throws (ADR-0037).
     * Becomes the `onError` passed to `guarded()` for every middleware
     * registered on this service (unless the middleware opts out with
     * `{guard: false}`). Unset ⇒ `guarded()`'s default loud `console.error`.
     * Route it to an error tracker (Sentry, kendo-error-tracker) to surface the
     * swallowed failure elsewhere. Must not re-throw.
     */
    onMiddlewareError?: GuardedMiddlewareErrorHandler;
}

export interface HttpService {
    getRequest: <T = unknown>(endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    postRequest: <T = unknown>(
        endpoint: string,
        data: unknown,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<T>>;
    putRequest: <T = unknown>(
        endpoint: string,
        data: unknown,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<T>>;
    patchRequest: <T = unknown>(
        endpoint: string,
        data: unknown,
        options?: AxiosRequestConfig,
    ) => Promise<AxiosResponse<T>>;
    deleteRequest: <T = unknown>(endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    /**
     * GET an endpoint as a Blob, intended for save-to-disk flows. Returns the
     * full AxiosResponse so callers can read headers (e.g. content-type) before
     * handing off to a download utility such as `fs-helpers`' `triggerDownload`.
     *
     * No DOM side effects — fs-http is transport-only (fs-packages issue #59).
     */
    downloadRequest: (endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<Blob>>;
    /**
     * GET an endpoint as a Blob, intended for inline-display flows. Identical
     * transport to `downloadRequest`; the separate name communicates intent.
     *
     * Callers manage object-URL lifecycle: `URL.createObjectURL(response.data)`
     * to render and `URL.revokeObjectURL(...)` on cleanup.
     */
    previewRequest: (endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<Blob>>;
    /**
     * Register a request middleware. The body runs synchronously in FIFO order
     * before each request leaves the service. See the shared middleware contract
     * below — the same invariants govern all three `register*` functions.
     *
     * Middleware contract (fs-http 0.6.0, ADR-0037; pinned by
     * `tests/middleware-contract.spec.ts`):
     * - **Guarded by default.** The body is wrapped in `guarded()`, so a
     *   synchronous throw is loud-swallowed (`onMiddlewareError` / `console.error`)
     *   and cannot reject a resolved 200 nor mask the real API error. Pass
     *   `{guard: false}` to run the raw body — then a sync throw propagates.
     * - **Sync-only, fire-and-forget.** The loop never `await`s the body. A
     *   Promise-returning body is not awaited; `guarded()` catches sync throws
     *   only — an async rejection escapes as an unhandled rejection. Keep bodies
     *   synchronous.
     * - **FIFO, per-instance, not idempotent.** Runs in registration order;
     *   each service instance owns independent stacks; registering the same
     *   reference twice fires it twice.
     * - **Mutation visible down the chain; response objects are not reused.**
     * @returns an idempotent `unregister` that removes this registration.
     */
    registerRequestMiddleware: (fn: RequestMiddlewareFunc, opts?: RegisterMiddlewareOptions) => UnregisterMiddleware;
    /**
     * Register a response (success-path) middleware. Runs synchronously in FIFO
     * order on every resolved response, before the caller's `await` resumes. Same
     * middleware contract as {@link HttpService.registerRequestMiddleware}
     * (guarded-by-default, sync-only/fire-and-forget, FIFO, per-instance,
     * not idempotent, mutation-visible, response-not-reused).
     * @returns an idempotent `unregister` that removes this registration.
     */
    registerResponseMiddleware: (fn: ResponseMiddlewareFunc, opts?: RegisterMiddlewareOptions) => UnregisterMiddleware;
    /**
     * Register a response-error middleware. Runs synchronously in FIFO order for
     * **axios errors only** (non-axios errors reject without invoking any error
     * middleware). Guarded by default: with the guard, a throwing body cannot
     * mask the original `AxiosError`; under `{guard: false}` a sync throw
     * replaces it. Same middleware contract as
     * {@link HttpService.registerRequestMiddleware}.
     * @returns an idempotent `unregister` that removes this registration.
     */
    registerResponseErrorMiddleware: (
        fn: ResponseErrorMiddlewareFunc,
        opts?: RegisterMiddlewareOptions,
    ) => UnregisterMiddleware;
}
