import type {Adapted, Item, NewAdapted} from '@script-development/fs-adapter-store';
import type {ComputedRef} from 'vue';

/**
 * Options for {@link createCachedAdapterStoreModule}.
 *
 * Intentionally minimal in v1: only `cacheKey` is exposed. No `staleAfterMs`,
 * no `onMissingServerHash`, no `hashExtractor`, no `hashStorageKey`, no
 * `legacyHeaderName`. The hash-or-fetch protocol is the contract; opting out
 * of any leg of it requires re-thinking the protocol itself, which is a
 * separate concern.
 */
export interface CachedAdapterStoreOptions {
    /**
     * The cache key used both as the lookup key inside the `x-fs-cache-hashes`
     * response header AND as the localStorage key for the persisted hash
     * (`${cacheKey}.cache-hash`). The backend is expected to stamp this exact
     * key in the header value whenever the underlying data changes.
     */
    cacheKey: string;
}

/**
 * Public API of a cached-adapter-store wrapper. Strictly narrower than
 * `StoreModuleForAdapter`: `retrieveAll` and `retrieveById` are deliberately
 * absent. Retrieval is owned by the wrapper — middleware-driven for steady
 * state, `prime()` for cold-start.
 *
 * NOT assignable to `StoreModuleForAdapter<T, E, N>`. This is intentional:
 * a "cached store" that lets consumers re-introduce ad-hoc retrieval is
 * not a cached store. If you need the unwrapped contract, use
 * `createAdapterStoreModule` directly.
 *
 * @see Architecture Locks #12 and #13 in
 *      `orders/fs-packages/fs-cached-adapter-store-public-surface-narrowing-engineer-deployment.md`
 *      (Commander 2026-05-13 reversal of scaffold Lock #11 + new Locks #12/#13).
 */
export interface CachedStoreModuleForAdapter<
    T extends Item,
    E extends Adapted<T, object> = Adapted<T>,
    N extends NewAdapted<T, object> = NewAdapted<T>,
> {
    getAll: ComputedRef<E[]>;
    getById: (id: number) => ComputedRef<E | undefined>;
    getOrFailById: (id: number) => Promise<E>;
    generateNew: () => N;
    /**
     * Idempotent bootstrap. Call once at the consumer's preferred initialization
     * point (app boot, route enter, root component setup) to guarantee data is
     * loaded even if no server response has yet stamped `x-fs-cache-hashes` for
     * this cacheKey. Subsequent calls dedupe against the shared in-flight ref
     * and short-circuit once a successful `inner.retrieveAll` has completed.
     *
     * No-op when `localHash !== null` AND a successful inner retrieve has already
     * happened in this session — at that point the response middleware is the
     * authoritative trigger for any subsequent re-fetches.
     */
    prime: () => Promise<void>;
}
