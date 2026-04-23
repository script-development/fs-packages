// @vitest-environment happy-dom
import type {HttpService} from '@script-development/fs-http';
import type {LoadingService} from '@script-development/fs-loading';
import type {StorageService} from '@script-development/fs-storage';
import type {AxiosResponse} from 'axios';
import type {Ref} from 'vue';

import {describe, expect, it, vi} from 'vitest';
import {computed, ref} from 'vue';

import type {
    Adapted,
    Adapter,
    AdapterStoreBroadcast,
    AdapterStoreConfig,
    AdapterStoreModule,
    Item,
    NewAdapted,
} from '../src/types';

import {createAdapterStoreModule} from '../src/adapter-store';
import {EntryNotFoundError} from '../src/errors';

type TestNew = Omit<TestItem, 'id'>;
type TestStorageService = Pick<StorageService, 'get' | 'put'>;
type TestLoadingService = Pick<LoadingService, 'ensureLoadingFinished'>;

interface TestItem extends Item {
    id: number;
    name: string;
    createdAt: string;
    updatedAt: string;
}

type TestAdapted = Adapted<TestItem> & {testMethod: () => string};
type TestNewAdapted = NewAdapted<TestItem> & {testMethod: () => string};

/**
 * Mock adapter function for tests.
 *
 * Exception to test encapsulation rule: This adapter is defined globally because
 * inlining it in each test (~25 lines) severely impacts readability. The adapter
 * is stateless and does not affect test isolation.
 */
function createTestAdapter(storeModule: AdapterStoreModule<TestItem>): TestNewAdapted;
function createTestAdapter(storeModule: AdapterStoreModule<TestItem>, resourceGetter: () => TestItem): TestAdapted;
function createTestAdapter(
    storeModule: AdapterStoreModule<TestItem>,
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
        Object.defineProperty(adapted, 'reset', {
            value: vi.fn(),
            enumerable: true,
            configurable: false,
            writable: false,
        });
        Object.defineProperty(adapted, 'update', {
            value: vi.fn(),
            enumerable: true,
            configurable: false,
            writable: false,
        });
        Object.defineProperty(adapted, 'patch', {
            value: vi.fn(),
            enumerable: true,
            configurable: false,
            writable: false,
        });
        Object.defineProperty(adapted, 'delete', {
            value: vi.fn(),
            enumerable: true,
            configurable: false,
            writable: false,
        });
        Object.defineProperty(adapted, 'testMethod', {
            value: () => `adapted-${resourceGetter().id}`,
            enumerable: true,
            configurable: false,
            writable: false,
        });

        return adapted;
    }
    return {
        name: '',
        mutable: ref({name: ''}) as Ref<TestNew>,
        reset: vi.fn(),
        create: vi.fn(),
        testMethod: () => 'new-adapted',
    } as unknown as TestNewAdapted;
}

/**
 * Creates a capturing adapter that stores the storeModule for later access.
 *
 * Exception to test encapsulation rule: This factory is defined globally for the same
 * readability reasons as createTestAdapter. Each call creates a fresh capture context,
 * maintaining test isolation.
 */
function createCapturingAdapter(): {
    adapter: Adapter<TestItem, TestAdapted, TestNewAdapted>;
    getCapturedStoreModule: () => AdapterStoreModule<TestItem> | null;
} {
    let capturedStoreModule: AdapterStoreModule<TestItem> | null = null;

    function adapter(storeModule: AdapterStoreModule<TestItem>): TestNewAdapted;
    function adapter(storeModule: AdapterStoreModule<TestItem>, resourceGetter: () => TestItem): TestAdapted;
    function adapter(
        storeModule: AdapterStoreModule<TestItem>,
        resourceGetter?: () => TestItem,
    ): TestAdapted | TestNewAdapted {
        capturedStoreModule = storeModule;
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
            Object.defineProperty(adapted, 'reset', {
                value: vi.fn(),
                enumerable: true,
                configurable: false,
                writable: false,
            });
            Object.defineProperty(adapted, 'update', {
                value: vi.fn(),
                enumerable: true,
                configurable: false,
                writable: false,
            });
            Object.defineProperty(adapted, 'patch', {
                value: vi.fn(),
                enumerable: true,
                configurable: false,
                writable: false,
            });
            Object.defineProperty(adapted, 'delete', {
                value: vi.fn(),
                enumerable: true,
                configurable: false,
                writable: false,
            });
            Object.defineProperty(adapted, 'testMethod', {
                value: () => `adapted-${resourceGetter().id}`,
                enumerable: true,
                configurable: false,
                writable: false,
            });

            return adapted;
        }
        return {
            name: '',
            mutable: ref({name: ''}) as Ref<TestNew>,
            reset: vi.fn(),
            create: vi.fn(),
            testMethod: () => 'new-adapted',
        } as unknown as TestNewAdapted;
    }

    return {
        adapter: adapter as Adapter<TestItem, TestAdapted, TestNewAdapted>,
        getCapturedStoreModule: () => capturedStoreModule,
    };
}

describe('createAdapterStoreModule', () => {
    describe('getAll', () => {
        it('should return computed with empty array when no items', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };

            // Act
            const store = createAdapterStoreModule(config);

            // Assert
            expect(store.getAll.value).toEqual([]);
        });

        it('should return computed with all adapted items', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
                {id: 2, name: 'Item 2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveAll();

            // Assert
            expect(store.getAll.value).toHaveLength(2);
            expect(store.getAll.value[0]?.testMethod()).toBe('adapted-1');
            expect(store.getAll.value[1]?.testMethod()).toBe('adapted-2');
        });

        it('should update when items are added to state', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const store = createAdapterStoreModule(config);
            expect(store.getAll.value).toHaveLength(0);
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);

            // Act
            await store.retrieveAll();

            // Assert
            expect(store.getAll.value).toHaveLength(1);
        });
    });

    describe('getById', () => {
        it('should return computed with undefined for non-existent id', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };

            // Act
            const store = createAdapterStoreModule(config);

            // Assert
            expect(store.getById(999).value).toBeUndefined();
        });

        it('should return computed with adapted item for existing id', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Act
            const result = store.getById(1);

            // Assert
            expect(result.value).toBeDefined();
            expect(result.value?.testMethod()).toBe('adapted-1');
        });

        it('should update when item is modified', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const store = createAdapterStoreModule(config);
            vi.mocked(httpService.getRequest).mockResolvedValue({
                data: [{id: 1, name: 'Original', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'}],
            } as AxiosResponse<TestItem[]>);
            await store.retrieveAll();
            const computed = store.getById(1);
            expect(computed.value?.name).toBe('Original');
            vi.mocked(httpService.getRequest).mockResolvedValue({
                data: [{id: 1, name: 'Updated', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'}],
            } as AxiosResponse<TestItem[]>);

            // Act
            await store.retrieveAll();

            // Assert
            expect(computed.value?.name).toBe('Updated');
        });
    });

    describe('getOrFailById', () => {
        it('should wait for loading to finish before checking', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const store = createAdapterStoreModule(config);

            // Act
            try {
                await store.getOrFailById(1);
            } catch {
                // Expected to throw
            }

            // Assert
            expect(loadingService.ensureLoadingFinished).toHaveBeenCalled();
        });

        it('should return adapted item when found', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Act
            const result = await store.getOrFailById(1);

            // Assert
            expect(result.testMethod()).toBe('adapted-1');
        });

        it('should return reactive adapted item that reflects store updates', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Original', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            const result = await store.getOrFailById(1);
            expect(result.name).toBe('Original');

            // Act — simulate a store update (e.g. from a patch/update response)
            const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
            storeModule.setById({
                id: 1,
                name: 'Updated',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            });

            // Assert — the same adapted object should reflect the updated data via getters
            expect(result.name).toBe('Updated');
        });

        it('should throw EntryNotFoundError when item not found', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const store = createAdapterStoreModule(config);

            // Act & Assert
            await expect(store.getOrFailById(999)).rejects.toThrow(EntryNotFoundError);
            await expect(store.getOrFailById(999)).rejects.toThrow('test-items with id 999 not found');
        });
    });

    describe('generateNew', () => {
        it('should return new adapted resource from adapter', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const store = createAdapterStoreModule(config);

            // Act
            const result = store.generateNew();

            // Assert
            expect(result.testMethod()).toBe('new-adapted');
        });
    });

    describe('retrieveById', () => {
        it('should call httpService.getRequest with domainName and id', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            vi.mocked(httpService.getRequest).mockResolvedValue({
                data: {
                    id: 7,
                    name: 'Item 7',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                } satisfies TestItem,
            } as AxiosResponse<TestItem>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveById(7);

            // Assert
            expect(httpService.getRequest).toHaveBeenCalledWith('test-items/7');
        });

        it('should insert the returned item into the store', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            vi.mocked(httpService.getRequest).mockResolvedValue({
                data: {
                    id: 7,
                    name: 'Item 7',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                } satisfies TestItem,
            } as AxiosResponse<TestItem>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveById(7);

            // Assert
            expect(store.getById(7).value?.testMethod()).toBe('adapted-7');
        });

        it("should refresh an existing item's adapted view after re-retrieval", async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            vi.mocked(httpService.getRequest).mockResolvedValueOnce({
                data: {
                    id: 1,
                    name: 'Original',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                } satisfies TestItem,
            } as AxiosResponse<TestItem>);
            const store = createAdapterStoreModule(config);
            await store.retrieveById(1);
            expect(store.getById(1).value?.name).toBe('Original');
            vi.mocked(httpService.getRequest).mockResolvedValueOnce({
                data: {
                    id: 1,
                    name: 'Updated',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-02T00:00:00Z',
                } satisfies TestItem,
            } as AxiosResponse<TestItem>);

            // Act
            await store.retrieveById(1);

            // Assert
            expect(store.getById(1).value?.name).toBe('Updated');
        });

        it('should persist to storage service', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            vi.mocked(httpService.getRequest).mockResolvedValue({
                data: {
                    id: 3,
                    name: 'Item 3',
                    createdAt: '2024-01-01T00:00:00Z',
                    updatedAt: '2024-01-01T00:00:00Z',
                } satisfies TestItem,
            } as AxiosResponse<TestItem>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveById(3);

            // Assert
            expect(storageService.put).toHaveBeenCalledWith(
                'test-items',
                expect.objectContaining({3: expect.any(Object) as unknown}),
            );
        });

        it('should propagate http errors and leave state untouched', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            vi.mocked(httpService.getRequest).mockRejectedValue(new Error('network down'));
            const store = createAdapterStoreModule(config);

            // Act & Assert
            await expect(store.retrieveById(1)).rejects.toThrow('network down');
            expect(store.getById(1).value).toBeUndefined();
            expect(storageService.put).not.toHaveBeenCalled();
        });
    });

    describe('retrieveAll', () => {
        it('should call httpService.getRequest with domainName', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            vi.mocked(httpService.getRequest).mockResolvedValue({data: [] as TestItem[]} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveAll();

            // Assert
            expect(httpService.getRequest).toHaveBeenCalledWith('test-items');
        });

        it('should store items in state as-is from response', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
                {id: 2, name: 'Item 2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveAll();

            // Assert
            expect(store.getAll.value).toHaveLength(2);
        });

        it('should persist to storage service', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveAll();

            // Assert
            expect(storageService.put).toHaveBeenCalledWith('test-items', expect.any(Object));
        });
    });

    describe('broadcast integration', () => {
        const captureBroadcast = (): {
            broadcast: AdapterStoreBroadcast<TestItem>;
            subscribe: ReturnType<typeof vi.fn>;
            unsubscribe: ReturnType<typeof vi.fn>;
            getHandlers: () => {onUpdate: (item: TestItem) => void; onDelete: (id: number) => void};
        } => {
            let handlers: {onUpdate: (item: TestItem) => void; onDelete: (id: number) => void} | null = null;
            const unsubscribe = vi.fn();
            const subscribe = vi.fn((h: typeof handlers) => {
                handlers = h;
                return unsubscribe;
            });
            return {
                broadcast: {subscribe} as AdapterStoreBroadcast<TestItem>,
                subscribe,
                unsubscribe,
                getHandlers: () => {
                    if (!handlers) throw new Error('subscribe was not called');
                    return handlers;
                },
            };
        };

        it('should call subscribe exactly once at construction with onUpdate and onDelete', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, subscribe} = captureBroadcast();

            // Act
            createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });

            // Assert
            expect(subscribe).toHaveBeenCalledTimes(1);
            expect(subscribe).toHaveBeenCalledWith({
                onUpdate: expect.any(Function) as unknown,
                onDelete: expect.any(Function) as unknown,
            });
        });

        it('should apply onUpdate events to the store without calling http', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, getHandlers} = captureBroadcast();
            const store = createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });

            // Act
            getHandlers().onUpdate({
                id: 9,
                name: 'Pushed Item',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });

            // Assert
            expect(store.getById(9).value?.name).toBe('Pushed Item');
            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('should replace existing items and refresh adapted views via onUpdate', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, getHandlers} = captureBroadcast();
            const store = createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });
            getHandlers().onUpdate({
                id: 1,
                name: 'Original',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });
            expect(store.getById(1).value?.name).toBe('Original');

            // Act
            getHandlers().onUpdate({
                id: 1,
                name: 'Updated',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            });

            // Assert
            expect(store.getById(1).value?.name).toBe('Updated');
        });

        it('should persist onUpdate events to storage', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, getHandlers} = captureBroadcast();
            createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });

            // Act
            getHandlers().onUpdate({
                id: 4,
                name: 'Item 4',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });

            // Assert
            expect(storageService.put).toHaveBeenCalledWith(
                'test-items',
                expect.objectContaining({4: expect.any(Object) as unknown}),
            );
        });

        it('should apply onDelete events to the store without calling http', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, getHandlers} = captureBroadcast();
            const store = createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });
            getHandlers().onUpdate({
                id: 5,
                name: 'Doomed',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });
            expect(store.getById(5).value).toBeDefined();

            // Act
            getHandlers().onDelete(5);

            // Assert
            expect(store.getById(5).value).toBeUndefined();
            expect(httpService.getRequest).not.toHaveBeenCalled();
        });

        it('should be a no-op when onDelete is fired for an unknown id', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, getHandlers} = captureBroadcast();
            const store = createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });

            // Act & Assert
            expect(() => getHandlers().onDelete(404)).not.toThrow();
            expect(store.getAll.value).toHaveLength(0);
        });

        it('should persist onDelete events to storage', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {broadcast, getHandlers} = captureBroadcast();
            createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
                broadcast,
            });
            getHandlers().onUpdate({
                id: 6,
                name: 'Item 6',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            });
            vi.mocked(storageService.put).mockClear();

            // Act
            getHandlers().onDelete(6);

            // Assert
            expect(storageService.put).toHaveBeenCalledWith(
                'test-items',
                expect.not.objectContaining({6: expect.anything()}),
            );
        });

        it('should not attempt to subscribe when broadcast is omitted', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};

            // Act & Assert
            expect(() =>
                createAdapterStoreModule<TestItem, TestAdapted, TestNewAdapted>({
                    domainName: 'test-items',
                    adapter: createTestAdapter,
                    httpService,
                    storageService,
                    loadingService,
                }),
            ).not.toThrow();
        });
    });

    describe('localStorage persistence', () => {
        it('should initialize state from storage', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storedItems = {
                1: {id: 1, name: 'Stored Item', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            };
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue(storedItems)};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };

            // Act
            const store = createAdapterStoreModule(config);

            // Assert
            expect(storageService.get).toHaveBeenCalledWith('test-items', {});
            expect(store.getById(1).value).toBeDefined();
        });

        it('should persist state changes to storage on retrieveAll', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);

            // Act
            await store.retrieveAll();

            // Assert
            expect(storageService.put).toHaveBeenCalledWith(
                'test-items',
                expect.objectContaining({1: expect.any(Object) as unknown}),
            );
        });
    });

    describe('memoization', () => {
        it('should return the same adapted object reference when state has not changed', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Act
            const firstAccess = store.getAll.value[0];
            const secondAccess = store.getAll.value[0];

            // Assert
            expect(firstAccess).toBe(secondAccess);
        });

        it('should return a new adapted object after setById, with properties reflecting the update', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            const beforeUpdate = store.getById(1).value;

            // Act
            const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
            storeModule.setById({
                id: 1,
                name: 'Updated',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            });
            const afterUpdate = store.getById(1).value;

            // Assert — new adapted object reference (cache invalidated by setById)
            expect(beforeUpdate).not.toBe(afterUpdate);
            // Display properties reflect the updated store data
            expect(afterUpdate?.name).toBe('Updated');
        });

        it('should propagate setById changes through computed chain', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Original', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // A downstream computed that wraps getById — mirrors how Vue components consume stores
            const derivedName = computed(() => store.getById(1).value?.name);
            expect(derivedName.value).toBe('Original');

            // Act — simulate a store update (e.g. from an update response)
            const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
            storeModule.setById({
                id: 1,
                name: 'Updated',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            });

            // Assert — the downstream computed must re-evaluate
            expect(derivedName.value).toBe('Updated');
        });

        it('should clear adapted cache on deleteById', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Access to populate cache and capture storeModule
            expect(store.getById(1).value).toBeDefined();

            // Act
            const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
            storeModule.deleteById(1);

            // Assert
            expect(store.getById(1).value).toBeUndefined();
        });

        it('should clear all caches on retrieveAll', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            const beforeRetrieve = store.getAll.value[0];

            // Act
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            await store.retrieveAll();
            const afterRetrieve = store.getAll.value[0];

            // Assert — new frozen references, so adapted objects must be new
            expect(beforeRetrieve).not.toBe(afterRetrieve);
        });

        it('should return the same computed ref for the same id across multiple getById calls', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Act
            const firstRef = store.getById(1);
            const secondRef = store.getById(1);

            // Assert
            expect(firstRef).toBe(secondRef);
        });

        it('should return different computed refs for different ids', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
                {id: 2, name: 'Item 2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Act
            const ref1 = store.getById(1);
            const ref2 = store.getById(2);

            // Assert
            expect(ref1).not.toBe(ref2);
        });

        it('should create a new computed ref for same id after retrieveAll clears cache', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            const refBefore = store.getById(1);

            // Act
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            await store.retrieveAll();
            const refAfter = store.getById(1);

            // Assert
            expect(refBefore).not.toBe(refAfter);
        });

        it('should create a new computed ref for same id after deleteById clears cache', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            const refBefore = store.getById(1);
            expect(refBefore.value).toBeDefined();

            // Act
            const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
            storeModule.deleteById(1);
            const refAfter = store.getById(1);

            // Assert
            expect(refBefore).not.toBe(refAfter);
        });

        it('should reuse cached adapted entries for untouched ids when state changes for a different id', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
                {id: 2, name: 'Item 2', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            const itemOneBefore = store.getById(1).value;
            const itemTwoBefore = store.getById(2).value;
            expect(itemOneBefore).toBeDefined();
            expect(itemTwoBefore).toBeDefined();

            // Act — setById for id 2 only. Clears adaptedCache for 2; id 1 remains cached.
            const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
            storeModule.setById({
                id: 2,
                name: 'Item 2 Updated',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-02T00:00:00Z',
            });

            // Assert — id 1 returns the same cached adapted reference; id 2 is freshly adapted.
            expect(store.getById(1).value).toBe(itemOneBefore);
            expect(store.getById(2).value).not.toBe(itemTwoBefore);
        });

        it('should return cached adapted object via getById when state has not changed', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter: createTestAdapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();

            // Act
            const firstValue = store.getById(1).value;
            const secondValue = store.getById(1).value;

            // Assert
            expect(firstValue).toBe(secondValue);
        });
    });

    describe('storeModule methods', () => {
        it('should update state and persist when setById is called via adapter', () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const store = createAdapterStoreModule(config);
            store.generateNew();
            const newItem: TestItem = {
                id: 1,
                name: 'New Item',
                createdAt: '2024-01-01T00:00:00Z',
                updatedAt: '2024-01-01T00:00:00Z',
            };

            // Act
            const capturedStoreModule = getCapturedStoreModule();
            expect(capturedStoreModule).not.toBeNull();
            const storeModule = capturedStoreModule as unknown as AdapterStoreModule<TestItem>;
            storeModule.setById(newItem);

            // Assert
            expect(store.getById(1).value).toBeDefined();
            expect(storageService.put).toHaveBeenCalledWith('test-items', expect.any(Object));
        });

        it('should remove from state and persist when deleteById is called via adapter', async () => {
            // Arrange
            const httpService: Pick<HttpService, 'getRequest'> = {getRequest: vi.fn()};
            const storageService: TestStorageService = {put: vi.fn(), get: vi.fn().mockReturnValue({})};
            const loadingService: TestLoadingService = {ensureLoadingFinished: vi.fn().mockResolvedValue(undefined)};
            const {adapter, getCapturedStoreModule} = createCapturingAdapter();
            const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
                domainName: 'test-items',
                adapter,
                httpService,
                storageService,
                loadingService,
            };
            const items: TestItem[] = [
                {id: 1, name: 'Item 1', createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z'},
            ];
            vi.mocked(httpService.getRequest).mockResolvedValue({data: items} as AxiosResponse<TestItem[]>);
            const store = createAdapterStoreModule(config);
            await store.retrieveAll();
            expect(store.getById(1).value).toBeDefined();
            vi.mocked(storageService.put).mockClear();

            // Act
            const capturedStoreModule = getCapturedStoreModule();
            expect(capturedStoreModule).not.toBeNull();
            const storeModule = capturedStoreModule as unknown as AdapterStoreModule<TestItem>;
            storeModule.deleteById(1);

            // Assert
            expect(store.getById(1).value).toBeUndefined();
            expect(storageService.put).toHaveBeenCalledWith('test-items', expect.any(Object));
        });
    });
});
