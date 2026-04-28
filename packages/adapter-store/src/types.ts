import type {Writable} from '@script-development/fs-helpers';
import type {HttpService} from '@script-development/fs-http';
import type {LoadingService} from '@script-development/fs-loading';
import type {StorageService} from '@script-development/fs-storage';
import type {ComputedRef, Ref} from 'vue';

/** Base constraint for all domain items — must have a numeric id. */
export type Item = {id: number};

/** Default type for new resources — strips the id field. Territories can override. */
export type DefaultNew<T extends Item> = Omit<T, 'id'>;

/**
 * Internal store module contract passed to adapters.
 * NOT part of the public API — adapters use this to mutate store state
 * after successful CRUD operations.
 */
export type AdapterStoreModule<T extends Item> = {setById: (item: T) => void; deleteById: (id: number) => void};

/** Base of a resource adapter: readonly resource + mutable ref + reset. */
type BaseResourceAdapter<T extends object> = Readonly<T> & {
    /** Reactive, mutable copy of the resource. */
    mutable: Ref<Writable<T>>;
    /** Reset the mutable state to the original resource. */
    reset: () => void;
};

/** Adapter for an existing resource. Provides update, patch, and delete. */
export type Adapted<T extends Item, N extends object = DefaultNew<T>> = BaseResourceAdapter<T> & {
    update(): Promise<T>;
    patch(partialItem: Partial<N>): Promise<T>;
    delete(): Promise<void>;
};

/** Adapter for a new resource (without id). Provides create. */
export type NewAdapted<T extends Item, N extends object = DefaultNew<T>> = BaseResourceAdapter<N> & {
    create(): Promise<T>;
};

/** Callable adapter type — overloaded for existing vs new resources. */
export type Adapter<T extends Item, E extends Adapted<T, object>, N extends NewAdapted<T, object>> = {
    (storeModule: AdapterStoreModule<T>): N;
    (storeModule: AdapterStoreModule<T>, resourceGetter: () => T): E;
};

/**
 * Contract for binding server-initiated events (e.g. WebSocket broadcasts)
 * to an adapter-store. The store calls `subscribe` once at construction and
 * routes incoming events straight into its internal mutation path. The
 * handlers are never exposed on the public store API, so consumers cannot
 * acquire them to bypass HTTP.
 */
export type AdapterStoreBroadcast<T extends Item> = {
    subscribe: (handlers: {onUpdate: (item: T) => void; onDelete: (id: number) => void}) => () => void;
};

/** Configuration for createAdapterStoreModule. */
export type AdapterStoreConfig<T extends Item, E extends Adapted<T, object>, N extends NewAdapted<T, object>> = {
    domainName: string;
    adapter: Adapter<T, E, N>;
    httpService: Pick<HttpService, 'getRequest'>;
    storageService: Pick<StorageService, 'get' | 'put'>;
    loadingService: Pick<LoadingService, 'ensureLoadingFinished'>;
    broadcast?: AdapterStoreBroadcast<T>;
};

/** Public API of a store module. */
export type StoreModuleForAdapter<T extends Item, E extends Adapted<T, object>, N extends NewAdapted<T, object>> = {
    getAll: ComputedRef<E[]>;
    getById: (id: number) => ComputedRef<E | undefined>;
    getOrFailById: (id: number) => Promise<E>;
    generateNew: () => N;
    retrieveById: (id: number) => Promise<void>;
    retrieveAll: () => Promise<void>;
};
