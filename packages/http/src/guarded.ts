/**
 * Error handler invoked when a middleware body wrapped by {@link guarded} throws.
 * Receives the thrown value (typed `unknown`, since a throw can be anything).
 * Must not re-throw — doing so re-opens the exact failure `guarded` closes.
 */
export type GuardedMiddlewareErrorHandler = (error: unknown) => void;

/**
 * Default handler: surface the swallowed failure loudly (visible to `console`
 * and any error tracker that hooks it) without letting it propagate. Loud, not
 * silent — a swallowed middleware throw is still a bug the consumer should see.
 */
const defaultOnError: GuardedMiddlewareErrorHandler = (error) => {
    console.error('[fs-http] middleware body threw and was swallowed by guarded():', error);
};

/**
 * Wrap an `fs-http` middleware body so a side-effect throw (toast, store write,
 * router push, cache-hash parse) cannot corrupt the interceptor chain — i.e.
 * cannot reject a resolved 200 nor mask the real API error on the error path.
 *
 * `fs-http` invokes middleware synchronously and un-caught **by design** (the
 * library stays loud; the loops are never awaited). Since ADR-0037 the
 * `register*Middleware` functions apply `guarded` **by default** — every
 * registered body is loud-swallow-protected without the consumer doing
 * anything, and a consumer opts *out* per call with `{guard: false}`. This
 * export remains public for that opt-out escape hatch, for manual wrapping, and
 * for consumers on older fs-http where guarding was opt-in.
 *
 * All three middleware types (`RequestMiddlewareFunc`, `ResponseMiddlewareFunc`,
 * `ResponseErrorMiddlewareFunc`) share the `(arg) => void` shape, so this one
 * generic wraps any of them and stays assignable to the source type with zero
 * casts:
 *
 * ```ts
 * service.registerResponseMiddleware(guarded((response) => { ...may throw... }));
 * ```
 *
 * @param fn      the middleware body to protect.
 * @param onError handler for a thrown value; defaults to a loud `console.error`.
 *                Pass a custom handler to route the failure elsewhere (e.g. an
 *                error tracker). Do not re-throw from it.
 * @returns a middleware function of the same shape that never throws.
 */
export const guarded =
    <T>(fn: (arg: T) => void, onError: GuardedMiddlewareErrorHandler = defaultOnError): ((arg: T) => void) =>
    (arg: T) => {
        try {
            fn(arg);
        } catch (error) {
            onError(error);
        }
    };
