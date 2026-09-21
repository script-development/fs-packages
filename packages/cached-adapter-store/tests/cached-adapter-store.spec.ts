// @vitest-environment happy-dom
import type {
    Adapted,
    Adapter,
    AdapterStoreConfig,
    AdapterStoreModule,
    Item,
    NewAdapted,
} from '@script-development/fs-adapter-store';
import type {
    HttpService,
    RequestMiddlewareFunc,
    ResponseErrorMiddlewareFunc,
    ResponseMiddlewareFunc,
    UnregisterMiddleware,
} from '@script-development/fs-http';
import type {LoadingService} from '@script-development/fs-loading';
import type {StorageService} from '@script-development/fs-storage';
import type {AxiosResponse, InternalAxiosRequestConfig} from 'axios';
import type {Ref} from 'vue';

import {createStorageService} from '@script-development/fs-storage';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ref} from 'vue';

import {createCachedAdapterStoreModule, encodeSubscribeHeader, subscriptionKeysFor} from '../src/cached-adapter-store';

type TestStorageService = Pick<StorageService, 'get' | 'put'>;
type TestLoadingService = Pick<LoadingService, 'ensureLoadingFinished'>;

interface TestItem extends Item {
    id: number;
    name: string;
}

type TestNew = Omit<TestItem, 'id'>;
type TestAdapted = Adapted<TestItem> & {tag: () => string};
type TestNewAdapted = NewAdapted<TestItem> & {tag: () => string};

function makeTestAdapter(storeModule: AdapterStoreModule<TestItem>): TestNewAdapted;
function makeTestAdapter(storeModule: AdapterStoreModule<TestItem>, resourceGetter: () => TestItem): TestAdapted;
function makeTestAdapter(
    _storeModule: AdapterStoreModule<TestItem>,
    resourceGetter?: () => TestItem,
): TestAdapted | TestNewAdapted {
    if (resourceGetter) {
        const adapted = {} as TestAdapted;
        const source = resourceGetter();
        for (const key of Object.keys(source)) {
            Object.defineProperty(adapted, key, {
                get: () => resourceGetter()[key as keyof TestItem],
                enumerable: true,
                configurable: false,
            });
        }
        Object.defineProperty(adapted, 'mutable', {
            value: ref({...resourceGetter()}) as Ref<TestNew>,
            enumerable: true,
            configurable: false,
            writable: false,
        });
        Object.defineProperty(adapted, 'reset', {value: vi.fn(), enumerable: true});
        Object.defineProperty(adapted, 'update', {value: vi.fn(), enumerable: true});
        Object.defineProperty(adapted, 'patch', {value: vi.fn(), enumerable: true});
        Object.defineProperty(adapted, 'delete', {value: vi.fn(), enumerable: true});
        Object.defineProperty(adapted, 'tag', {value: () => `adapted-${resourceGetter().id}`, enumerable: true});
        return adapted;
    }
    return {
        name: '',
        mutable: ref({name: ''}) as Ref<TestNew>,
        reset: vi.fn(),
        create: vi.fn(),
        tag: () => 'new-adapted',
    } as unknown as TestNewAdapted;
}

type FakeHttpService = HttpService & {
    deliver: (response: AxiosResponse) => void;
    getResponseMiddlewares: () => ResponseMiddlewareFunc[];
    /** Fire every registered request middleware against `request` (outbound path). */
    fireRequest: (request: InternalAxiosRequestConfig) => void;
    getRequestMiddlewares: () => RequestMiddlewareFunc[];
};

/**
 * Minimal axios request config for exercising the outbound request middleware.
 * `headers` is a plain mutable object — the middleware assigns
 * `request.headers['x-fs-cache-hashes-subscribe'] = ...` directly.
 */
const makeRequest = (headers: Record<string, unknown> = {}): InternalAxiosRequestConfig =>
    ({headers}) as unknown as InternalAxiosRequestConfig;

const makeFakeHttpService = (): FakeHttpService => {
    const responseMiddlewares: ResponseMiddlewareFunc[] = [];
    const requestMiddlewares: RequestMiddlewareFunc[] = [];
    const responseErrorMiddlewares: ResponseErrorMiddlewareFunc[] = [];
    const unregisterFrom =
        <T>(array: T[], item: T): UnregisterMiddleware =>
        () => {
            const index = array.indexOf(item);
            if (index > -1) array.splice(index, 1);
        };
    const service: FakeHttpService = {
        getRequest: vi.fn(),
        postRequest: vi.fn(),
        putRequest: vi.fn(),
        patchRequest: vi.fn(),
        deleteRequest: vi.fn(),
        downloadRequest: vi.fn(),
        previewRequest: vi.fn(),
        registerRequestMiddleware: (fn: RequestMiddlewareFunc) => {
            requestMiddlewares.push(fn);
            return unregisterFrom(requestMiddlewares, fn);
        },
        registerResponseMiddleware: (fn: ResponseMiddlewareFunc) => {
            responseMiddlewares.push(fn);
            return unregisterFrom(responseMiddlewares, fn);
        },
        registerResponseErrorMiddleware: (fn: ResponseErrorMiddlewareFunc) => {
            responseErrorMiddlewares.push(fn);
            return unregisterFrom(responseErrorMiddlewares, fn);
        },
        deliver: (response: AxiosResponse) => {
            for (const middleware of responseMiddlewares) middleware(response);
        },
        getResponseMiddlewares: () => responseMiddlewares,
        fireRequest: (request: InternalAxiosRequestConfig) => {
            for (const middleware of requestMiddlewares) middleware(request);
        },
        getRequestMiddlewares: () => requestMiddlewares,
    };
    return service;
};

const makeResponse = (headers: Record<string, string>): AxiosResponse =>
    ({data: null, status: 200, statusText: 'OK', headers, config: {} as unknown}) as unknown as AxiosResponse;

const encodeHashHeader = (map: Record<string, string>): string => `v1.${encodeURIComponent(JSON.stringify(map))}`;

const makeConfig = (
    httpService: FakeHttpService,
    storageService: TestStorageService,
    loadingService: TestLoadingService,
    domainName = 'lanes',
): AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> => ({
    domainName,
    adapter: makeTestAdapter as Adapter<TestItem, TestAdapted, TestNewAdapted>,
    httpService,
    storageService,
    loadingService,
});

const makeStorageService = (initial: Record<string, unknown> = {}): TestStorageService => {
    const store: Record<string, unknown> = {...initial};
    return {
        get: vi.fn(<T>(key: string, defaultValue?: T): T | undefined => {
            if (key in store) return store[key] as T;
            return defaultValue;
        }) as TestStorageService['get'],
        put: vi.fn((key: string, value: unknown) => {
            store[key] = value;
        }),
    };
};

/**
 * Reusable test rig that proves "would skip if currentServerHash === 'X' OR would
 * fetch otherwise". Tests that need a mutation-discriminating no-signal assertion
 * persist 'X' to storage AND seed the malformed response with a payload that
 * would parse to {lanes: 'X'} ONLY if the parser is broken. After delivery, we
 * call prime() and assert whether httpService.getRequest fired.
 *
 * If the parser correctly rejects → currentServerHash null → fetch (1 call).
 * If the parser incorrectly accepts → currentServerHash 'X' === localHash 'X'
 *   → skip (0 calls). The assertion `getRequest.toHaveBeenCalledTimes(1)`
 *   discriminates between these two outcomes.
 */
const setupMalformDiscriminator = (cacheKey = 'lanes') => {
    const httpService = makeFakeHttpService();
    const storageService = makeStorageService({[`${cacheKey}.cache-hash`]: 'X'});
    const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
    vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
    const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
        makeConfig(httpService, storageService, loadingService, cacheKey),
        {cacheKey},
    );
    return {httpService, storageService, store};
};

describe('createCachedAdapterStoreModule', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('public API surface (narrowed — no retrieveAll / no retrieveById)', () => {
        it('returns exactly {getAll, getById, getOrFailById, generateNew, prime}', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );
            expect(store.getAll).toBeDefined();
            expect(typeof store.getById).toBe('function');
            expect(typeof store.getOrFailById).toBe('function');
            expect(typeof store.generateNew).toBe('function');
            expect(typeof store.prime).toBe('function');
        });

        it('does NOT expose retrieveAll on the returned module', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );
            expect(store).not.toHaveProperty('retrieveAll');
        });

        it('does NOT expose retrieveById on the returned module', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );
            expect(store).not.toHaveProperty('retrieveById');
        });

        it('returned object has exactly five enumerable keys', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );
            expect(Object.keys(store).sort()).toEqual(
                ['generateNew', 'getAll', 'getById', 'getOrFailById', 'prime'].sort(),
            );
        });
    });

    describe('prime() behavior', () => {
        it('cold start: localHash null, no header seen → fires inner.retrieveAll exactly once', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            await store.prime();

            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
            expect(httpService.getRequest).toHaveBeenCalledWith('lanes');
        });

        it('localHash set but no header seen → fires inner.retrieveAll exactly once', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'abc'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            await store.prime();

            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('already in sync (localHash === header hash, both non-null) → prime() does NOT fire inner', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'matching-hash'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'matching-hash'})}));

            // Middleware-triggered fetch should be skipped (equal hash).
            // The subsequent prime() should also be skipped — same reasoning.
            await store.prime();

            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('hash mismatch on cold-start with header already seen → prime() fires inner once and persists the new hash on success', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'old-hash'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'new-hash'})}));

            // The middleware-triggered fetch fires asynchronously; prime() dedupes against it.
            await store.prime();

            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'new-hash');
        });

        it('idempotency: two rapid prime() calls → exactly one inner fetch (in-flight dedup)', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            let resolveGet!: (value: AxiosResponse<TestItem[]>) => void;
            const pending = new Promise<AxiosResponse<TestItem[]>>((resolve) => {
                resolveGet = resolve;
            });
            vi.mocked(httpService.getRequest).mockReturnValue(pending);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            const first = store.prime();
            const second = store.prime();

            resolveGet({data: []} as AxiosResponse<TestItem[]>);
            await Promise.all([first, second]);

            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('post-success no-op: after one successful prime(), a second prime() returns immediately without invoking inner', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            // First prime: cold-start, header arrives before fetch resolves.
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'persisted'})}));
            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);

            // Second prime: hasCompletedAtLeastOnce && localHash !== null → no-op.
            // We do NOT stamp a new header here; the post-success short-circuit
            // is what's being pinned. Even without a new header, prime() must
            // not fire a second fetch.
            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('post-success no-op requires localHash !== null — if persist did not happen (no header seen), a second prime() can fire again', async () => {
            // Pins the `localHash.value !== null` guard in prime(). After a
            // successful inner fetch where no header was ever observed,
            // `localHash` remains null (persist-after-success skipped because
            // currentServerHash was null). A subsequent prime() must NOT
            // short-circuit; it must call into the trigger, which itself
            // proceeds to fetch again because the skip-if-equal guard's
            // `localHash !== null` clause is false.
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            await store.prime();
            await store.prime();

            expect(httpService.getRequest).toHaveBeenCalledTimes(2);
        });
    });

    describe('middleware-driven trigger', () => {
        it('response with hash differing from localHash (cold) → middleware fires inner.retrieveAll exactly once', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'fresh-hash'})}));

            // Wait for the fire-and-forget trigger to settle.
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'fresh-hash');
        });

        it('response with hash differing from localHash (warm) → middleware fires inner once and updates persisted hash', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'old-hash'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'new-hash'})}));

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'new-hash');
        });

        it('response with hash equal to localHash → middleware does NOT fire inner.retrieveAll', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'same-hash'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'same-hash'})}));

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('response with header missing entirely → middleware does NOT fire inner', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'X'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'content-type': 'application/json'}));

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('response with header malformed (5a: wrong version prefix) → middleware does NOT fire inner', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'X'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v2.${encodeURIComponent('{"lanes":"X"}')}`}));

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('response with header malformed (5b: truncated JSON) → middleware does NOT fire inner', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'X'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('{"lanes":"X"')}`}));

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('response with header valid but missing our cacheKey (5c) → middleware does NOT fire inner', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'X'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({teams: 'X', users: 'X'})}));

            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(httpService.getRequest).not.toHaveBeenCalled();
        });
    });

    describe('prime + middleware race coordination', () => {
        it('prime() is in flight and a mid-flight response with a different hash arrives → exactly ONE inner fetch (in-flight dedup is shared)', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            let resolveGet!: (value: AxiosResponse<TestItem[]>) => void;
            const pending = new Promise<AxiosResponse<TestItem[]>>((resolve) => {
                resolveGet = resolve;
            });
            vi.mocked(httpService.getRequest).mockReturnValue(pending);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            // prime() kicks off the inner fetch (inflight set).
            const primePromise = store.prime();

            // Mid-flight, a response arrives carrying a different hash. The
            // middleware should observe the in-flight ref and skip firing a
            // second fetch.
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'mid-flight-hash'})}));

            resolveGet({data: []} as AxiosResponse<TestItem[]>);
            await primePromise;
            // Drain any fire-and-forget tasks queued by the middleware.
            await new Promise((resolve) => setTimeout(resolve, 0));

            // Once-per-burst contract: only ONE inner fetch fires for the
            // overlapping prime() + mid-flight response. v1 simplification —
            // a later mismatched response is the responsibility of the NEXT
            // header to be observed.
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'mid-flight-hash');
        });
    });

    describe('persist-after-success timing', () => {
        it('persists localHash to storageService only after inner.retrieveAll succeeds', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            // Header arrives — middleware bumps currentServerHash AND triggers
            // the inner fetch. At this synchronous point in test execution,
            // the inner fetch promise has been created (the trigger called
            // `inner.retrieveAll()`) but the inflight closure has not yet
            // observed the resolution — but vi.mocked already returns a
            // resolved promise, so persist may complete on a microtask. To
            // assert the "ONLY after success" invariant cleanly, we hold the
            // fetch in a pending state below.
            let resolveGet!: (value: AxiosResponse<TestItem[]>) => void;
            const pending = new Promise<AxiosResponse<TestItem[]>>((resolve) => {
                resolveGet = resolve;
            });
            vi.mocked(httpService.getRequest).mockReturnValue(pending);

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'server-hash'})}));
            // Allow the fire-and-forget trigger to schedule the inner call.
            await new Promise((resolve) => setTimeout(resolve, 0));
            // At this point, inner.retrieveAll is still pending — assert NO persist yet.
            expect(storageService.put).not.toHaveBeenCalledWith('lanes.cache-hash', expect.anything());

            // Now resolve the inner fetch. Through prime() we also synchronize.
            resolveGet({data: []} as AxiosResponse<TestItem[]>);
            await store.prime();

            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'server-hash');
        });

        it('does NOT persist localHash when inner.retrieveAll rejects (prime path)', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockRejectedValue(new Error('network died'));
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'server-hash'})}));

            // The middleware-fired trigger and prime() both share inflight.
            // prime() awaits and surfaces the rejection.
            await expect(store.prime()).rejects.toThrow('network died');

            expect(storageService.put).not.toHaveBeenCalledWith('lanes.cache-hash', expect.anything());
        });

        it('does NOT persist localHash when inner.retrieveAll rejects (middleware path) — failing inner does not leave a persisted hash', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockRejectedValue(new Error('boom'));
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            // Middleware-triggered fetch (fire-and-forget). The middleware path
            // swallows the rejection internally via `.catch(() => {})`.
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'server-hash'})}));

            // Drain microtasks to let the inflight closure observe the rejection
            // and the swallow handler run.
            await new Promise((resolve) => setTimeout(resolve, 0));
            await new Promise((resolve) => setTimeout(resolve, 0));

            expect(storageService.put).not.toHaveBeenCalledWith('lanes.cache-hash', expect.anything());
        });

        it('does NOT persist when prime succeeds but no server hash has been received yet', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            await store.prime();

            // Discriminating assertion: if `if (serverHashSnapshot !== null)`
            // were mutated to `if (true)`, storageService.put would be called
            // with ('lanes.cache-hash', null). We assert it was NEVER called
            // with that key at all.
            expect(storageService.put).not.toHaveBeenCalledWith('lanes.cache-hash', expect.anything());
            expect(storageService.put).not.toHaveBeenCalledWith('lanes.cache-hash', null);
        });

        it('captures the current server hash at success time, not at receipt time', async () => {
            // If a later response carries a different hash AFTER prime returns
            // but the snapshot was taken correctly, the persisted hash
            // matches the data that was actually retrieved.
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'A'})}));
            await store.prime();

            // Persisted hash matches the in-memory currentServerHash at success time.
            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'A');
        });
    });

    describe('idempotent middleware registration', () => {
        it('registers exactly one response middleware when multiple wrappers share an httpService', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};

            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'teams'),
                {cacheKey: 'teams'},
            );

            expect(httpService.getResponseMiddlewares()).toHaveLength(1);
        });

        it('still updates currentServerHash for every registered cacheKey when sharing one middleware', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({
                'lanes.cache-hash': 'lanes-hash',
                'teams.cache-hash': 'teams-hash',
            });
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};

            const laneStore = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );
            const teamStore = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'teams'),
                {cacheKey: 'teams'},
            );

            httpService.deliver(
                makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'lanes-hash', teams: 'teams-hash'})}),
            );

            await laneStore.prime();
            await teamStore.prime();
            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('ignores unregistered cacheKeys without affecting any setter', async () => {
            // Pins the `if (handler)` lookup in the iteration. If that check
            // were flipped to `if (true)`, calling `undefined(hash)` would
            // throw, but the wrapper's try/catch would swallow it. The
            // discriminating assertion: a registered store's currentServerHash
            // must be SET correctly even when an unregistered key arrives
            // alongside it in the same response.
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService({'lanes.cache-hash': 'matching'});
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );
            // 'unknown' is NOT a registered cacheKey on this httpService.
            // The middleware must skip it (handlers.get returns undefined) and
            // STILL process 'lanes'.
            httpService.deliver(
                makeResponse({'x-fs-cache-hashes': encodeHashHeader({unknown: 'whatever', lanes: 'matching'})}),
            );

            await store.prime();

            // Registered key was applied → skip.
            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('registers a fresh middleware for a different httpService instance', () => {
            const httpA = makeFakeHttpService();
            const httpB = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};

            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpA, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpB, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            expect(httpA.getResponseMiddlewares()).toHaveLength(1);
            expect(httpB.getResponseMiddlewares()).toHaveLength(1);
        });
    });

    describe('parser branches (mutation-discriminating via prime())', () => {
        // Each test uses setupMalformDiscriminator:
        //   - storage has localHash = 'X'
        //   - inner getRequest is mocked
        //   - middleware sees a malformed header → parser returns null →
        //     no setter fires → currentServerHash stays null
        //   - prime() then fires (localHash 'X', currentServerHash null →
        //     not equal → fetch). 1 call to getRequest.
        //   - If parser INCORRECTLY accepts → currentServerHash 'X' === localHash 'X'
        //     → skip (0 calls).

        it('rejects header value when not a string (e.g., array form)', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            const response = {
                data: null,
                status: 200,
                statusText: 'OK',
                config: {},
                headers: {'x-fs-cache-hashes': ['v1.something'] as unknown as string},
            } as unknown as AxiosResponse;
            httpService.deliver(response);

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects header value missing the v1. prefix', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeURIComponent(JSON.stringify({lanes: 'X'}))}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects header value with wrong version prefix (v2.)', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(
                makeResponse({'x-fs-cache-hashes': `v2.${encodeURIComponent(JSON.stringify({lanes: 'X'}))}`}),
            );

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects malformed URI sequence after the v1. prefix', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': 'v1.%E0%A4%A'}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects malformed JSON after v1. prefix (truncated brace)', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('{"lanes":"X"')}`}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects valid JSON that parses to null', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('null')}`}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects valid JSON array (not an object)', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('["lanes","X"]')}`}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects valid JSON primitive (string/number)', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('"X"')}`}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects valid JSON object where a value is not a string', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('{"lanes":42}')}`}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects absent x-fs-cache-hashes header entirely', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects absent response.headers object', async () => {
            const {httpService, store} = setupMalformDiscriminator();
            const responseWithoutHeaders = {
                data: null,
                status: 200,
                statusText: 'OK',
                config: {},
            } as unknown as AxiosResponse;
            httpService.deliver(responseWithoutHeaders);

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('rejects valid v1. payload missing the wrapper-registered cacheKey', async () => {
            // Pins the `if (map === null) return` early-return and the
            // handler-key lookup: the map has well-formed keys but NOT 'lanes',
            // so the handler for 'lanes' never fires → currentServerHash stays
            // null → prime() fires.
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({teams: 'X', users: 'X'})}));

            await store.prime();
            expect(httpService.getRequest).toHaveBeenCalledTimes(1);
        });

        it('ACCEPTS valid v1. payload with matching cacheKey and value (positive control)', async () => {
            // Positive control matching the negative tests above. With
            // localHash 'X' persisted and a valid v1. payload {lanes: 'X'},
            // the parser correctly accepts → currentServerHash = 'X' →
            // localHash === currentServerHash → skip-when-equal short-circuits
            // BOTH the middleware-triggered fetch AND the prime() call → 0 calls.
            const {httpService, store} = setupMalformDiscriminator();
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'X'})}));

            await store.prime();
            expect(httpService.getRequest).not.toHaveBeenCalled();
        });
    });

    describe('exception-safe response middleware (Architecture Lock #10)', () => {
        it('5a: malformed v1 prefix → no throw', () => {
            const {httpService} = setupMalformDiscriminator();
            expect(() =>
                httpService.deliver(
                    makeResponse({'x-fs-cache-hashes': `v2.${encodeURIComponent(JSON.stringify({lanes: 'X'}))}`}),
                ),
            ).not.toThrow();
        });

        it('5b: malformed JSON → no throw', () => {
            const {httpService} = setupMalformDiscriminator();
            expect(() =>
                httpService.deliver(makeResponse({'x-fs-cache-hashes': `v1.${encodeURIComponent('{"lanes":"X"')}`})),
            ).not.toThrow();
        });

        it('5c: valid JSON but missing the cacheKey → no throw, no state change', () => {
            const {httpService} = setupMalformDiscriminator();
            expect(() =>
                httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({teams: 'X', users: 'X'})})),
            ).not.toThrow();
        });

        it('5-success: valid v1. header for our cacheKey → currentServerHash updated; localHash persisted after middleware-triggered retrieveAll succeeds', async () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'fresh-hash'})}));

            // Middleware triggers inner fetch; prime() rendezvous with it.
            await store.prime();

            expect(storageService.put).toHaveBeenCalledWith('lanes.cache-hash', 'fresh-hash');
        });

        it('parser-null path returns early without entering the iteration (no debug log on no-signal)', () => {
            // Discriminating the `if (map === null) return` guard. If the
            // guard were flipped, the iteration body would execute against a
            // null map and Object.entries(null) would throw, caught by the
            // outer try/catch and surfaced as a debug log. We assert the
            // debug log was NOT called on a clean no-signal response.
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            // Deliver a response WITHOUT the cache header — parser returns null.
            httpService.deliver(makeResponse({'content-type': 'application/json'}));

            expect(debugSpy).not.toHaveBeenCalled();
        });

        it('pathological response.headers (getter throws) → middleware catches and does not abort the chain', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            const response = {data: null, status: 200, statusText: 'OK', config: {}} as unknown as AxiosResponse;
            Object.defineProperty(response, 'headers', {
                get: () => {
                    throw new Error('headers getter exploded');
                },
            });

            expect(() => httpService.deliver(response)).not.toThrow();
            expect(debugSpy).toHaveBeenCalledWith(
                '[fs-cached-adapter-store] response middleware caught error',
                expect.any(Error),
            );
        });

        it('inner.retrieveAll rejection on the middleware path does NOT propagate back through the middleware to abort the caller', async () => {
            // The middleware path is fire-and-forget; a rejection inside
            // `triggerInnerRetrieveAll` (i.e., inner.retrieveAll rejects)
            // must NOT escape back through the middleware to the caller's
            // request. We simulate by:
            //   1. mocking inner.getRequest to reject
            //   2. delivering a header that triggers the inner fetch
            //   3. asserting the deliver call itself returned cleanly
            //   4. draining microtasks and asserting no unhandled rejection
            //      surfaced (the `.catch(() => {})` swallow in the trigger
            //      ensures this)
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockRejectedValue(new Error('inner exploded'));
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService),
                {cacheKey: 'lanes'},
            );

            // Track unhandled rejections during the test.
            let unhandled: unknown = null;
            const onUnhandled = (reason: unknown): void => {
                unhandled = reason;
            };
            process.on('unhandledRejection', onUnhandled);

            try {
                expect(() =>
                    httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({lanes: 'fresh'})})),
                ).not.toThrow();

                // Drain microtasks several times to ensure the rejection has
                // been processed by the swallow handler.
                await new Promise((resolve) => setTimeout(resolve, 0));
                await new Promise((resolve) => setTimeout(resolve, 0));
                await new Promise((resolve) => setTimeout(resolve, 0));

                expect(unhandled).toBeNull();
            } finally {
                process.off('unhandledRejection', onUnhandled);
            }
        });
    });

    describe('outbound subscribe-header emission (ADR-0032 Option A)', () => {
        it('registers exactly one request middleware per HttpService', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            expect(httpService.getRequestMiddlewares()).toHaveLength(1);
        });

        it('stamps the exact v1.<urlencoded JSON array> header for a single registered cacheKey', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            const request = makeRequest();
            httpService.fireRequest(request);

            // Exact string assertion — the mutation gate must catch a weakened
            // encoding, not just "a header exists". `["lanes"]` urlencoded.
            expect(request.headers['x-fs-cache-hashes-subscribe']).toBe(`v1.${encodeURIComponent('["lanes"]')}`);
            expect(request.headers['x-fs-cache-hashes-subscribe']).toBe('v1.%5B%22lanes%22%5D');
        });

        it('emits a flat ARRAY (not a {key:hash} object) — request payload shape is asymmetric to the response header', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            const request = makeRequest();
            httpService.fireRequest(request);

            const raw = request.headers['x-fs-cache-hashes-subscribe'] as string;
            const decoded: unknown = JSON.parse(decodeURIComponent(raw.slice('v1.'.length)));
            expect(Array.isArray(decoded)).toBe(true);
            expect(decoded).toEqual(['lanes']);
        });

        it('multi-store on one HttpService → BOTH keys present in the emitted array (D1: registry keys ARE the subscription set)', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'labels'),
                {cacheKey: 'labels'},
            );

            // Still exactly one request middleware despite two stores.
            expect(httpService.getRequestMiddlewares()).toHaveLength(1);

            const request = makeRequest();
            httpService.fireRequest(request);

            expect(request.headers['x-fs-cache-hashes-subscribe']).toBe(
                `v1.${encodeURIComponent('["lanes","labels"]')}`,
            );
        });

        it('reads registry keys LIVE at fire time — a store added after the first request is reflected on the next', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            const first = makeRequest();
            httpService.fireRequest(first);
            expect(first.headers['x-fs-cache-hashes-subscribe']).toBe(`v1.${encodeURIComponent('["lanes"]')}`);

            // Register a second store on the SAME httpService AFTER the first request fired.
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'labels'),
                {cacheKey: 'labels'},
            );

            const second = makeRequest();
            httpService.fireRequest(second);
            expect(second.headers['x-fs-cache-hashes-subscribe']).toBe(
                `v1.${encodeURIComponent('["lanes","labels"]')}`,
            );
        });

        it('does not clobber pre-existing request headers (only sets the subscribe key)', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            const request = makeRequest({authorization: 'Bearer tok', 'content-type': 'application/json'});
            httpService.fireRequest(request);

            expect(request.headers['authorization']).toBe('Bearer tok');
            expect(request.headers['content-type']).toBe('application/json');
            expect(request.headers['x-fs-cache-hashes-subscribe']).toBe(`v1.${encodeURIComponent('["lanes"]')}`);
        });

        it('exception-safe: a throwing headers setter does NOT propagate out of the middleware', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );

            // A request whose headers object throws on the subscribe-key assignment.
            const headers: Record<string, unknown> = {};
            Object.defineProperty(headers, 'x-fs-cache-hashes-subscribe', {
                set: () => {
                    throw new Error('headers setter exploded');
                },
                configurable: true,
            });
            const request = makeRequest(headers);

            expect(() => httpService.fireRequest(request)).not.toThrow();
            expect(debugSpy).toHaveBeenCalledWith(
                '[fs-cached-adapter-store] request middleware caught error',
                expect.any(Error),
            );
        });
    });

    describe('subscriptionKeysFor accessor (ADR-0032 D1, direct unit — mutation gate)', () => {
        it('returns [] for an HttpService that was never registered (empty-registry guard)', () => {
            const unregistered = makeFakeHttpService();
            // Never passed to createCachedAdapterStoreModule → not in the registry.
            expect(subscriptionKeysFor(unregistered)).toEqual([]);
        });

        it('returns the registered cacheKeys in insertion order for a registered HttpService', () => {
            const httpService = makeFakeHttpService();
            const storageService = makeStorageService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'lanes'),
                {cacheKey: 'lanes'},
            );
            createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, 'labels'),
                {cacheKey: 'labels'},
            );

            expect(subscriptionKeysFor(httpService)).toEqual(['lanes', 'labels']);
        });
    });

    describe('encodeSubscribeHeader (direct unit — mutation gate)', () => {
        it('encodes a single key as v1.<urlencoded JSON array>', () => {
            expect(encodeSubscribeHeader(['lanes'])).toBe('v1.%5B%22lanes%22%5D');
            expect(encodeSubscribeHeader(['lanes'])).toBe(`v1.${encodeURIComponent('["lanes"]')}`);
        });

        it('encodes multiple keys preserving order', () => {
            expect(encodeSubscribeHeader(['lanes', 'labels'])).toBe(`v1.${encodeURIComponent('["lanes","labels"]')}`);
        });

        it('encodes an empty array as v1.%5B%5D (the JSON empty array, urlencoded)', () => {
            expect(encodeSubscribeHeader([])).toBe('v1.%5B%5D');
            expect(encodeSubscribeHeader([])).toBe(`v1.${encodeURIComponent('[]')}`);
        });

        it('carries the v1. version prefix verbatim', () => {
            expect(encodeSubscribeHeader(['x']).startsWith('v1.')).toBe(true);
        });
    });

    describe('numeric-hash coercion regression (enforcement queue #130; mirrors wijs #122)', () => {
        it('an all-numeric persisted hash round-trips through REAL fs-storage as a STRING → an equal server hash skips inner fetch (no spurious cold-load)', async () => {
            // Exercises the real fs-storage put(raw) → get(string-default → raw)
            // contract rather than the stub above (which ignores the default and
            // is therefore blind to this bug). A `crc32b(uuid())` hash like
            // '55776784' is all-numeric with no leading zero. Under the OLD
            // `get(hashStorageKey, null)` read, the non-string default drove
            // fs-storage's JSON.parse branch, coercing '55776784' → Number
            // 55776784. `localHash` (Number) then never strict-equals the string
            // server hash, so skip-when-equal never matched → a redundant
            // retrieveAll() on every cold load. kendo is live-exposed (its
            // backend emits crc32b(uuid()) hashes). The fix reads with a string
            // default so the raw string is returned verbatim.
            localStorage.clear();
            const numericHash = '55776784';
            const cacheKey = 'lanes';
            // Real fs-storage, persisted via the SAME service the wrapper reads.
            const storageService = createStorageService('fs-cas-numeric-test');
            storageService.put(`${cacheKey}.cache-hash`, numericHash);

            const httpService = makeFakeHttpService();
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            vi.mocked(httpService.getRequest).mockResolvedValue({data: []} as AxiosResponse<TestItem[]>);
            const store = createCachedAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>(
                makeConfig(httpService, storageService, loadingService, cacheKey),
                {cacheKey},
            );

            // Server reports the SAME all-numeric hash (as a JSON string in the header).
            httpService.deliver(makeResponse({'x-fs-cache-hashes': encodeHashHeader({[cacheKey]: numericHash})}));
            await store.prime();
            // Drain the fire-and-forget middleware trigger.
            await new Promise((resolve) => setTimeout(resolve, 0));

            // Equal string hashes → skip-when-equal short-circuits BOTH the
            // middleware-triggered fetch and prime(). Under the old numeric
            // coercion, localHash would be Number 55776784 !== String
            // '55776784' → fetch fires and this assertion fails.
            expect(httpService.getRequest).not.toHaveBeenCalled();

            localStorage.clear();
        });
    });
});
