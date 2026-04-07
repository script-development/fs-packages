// @vitest-environment happy-dom
import type { HttpService } from "@script-development/fs-http";
import type { StorageService } from "@script-development/fs-storage";
import type { LoadingService } from "@script-development/fs-loading";
import type {
  Adapted,
  Adapter,
  AdapterStoreConfig,
  AdapterStoreModule,
  Item,
  NewAdapted,
} from "../src/types";
import type { AxiosResponse } from "axios";
import type { Ref } from "vue";

import { EntryNotFoundError } from "../src/errors";
import { createAdapterStoreModule } from "../src/adapter-store";
import { describe, expect, it, vi } from "vitest";
import { ref } from "vue";

type TestNew = Omit<TestItem, "id">;
type TestStorageService = Pick<StorageService, "get" | "put">;
type TestLoadingService = Pick<LoadingService, "ensureLoadingFinished">;

interface TestItem extends Item {
  id: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

type TestAdapted = Adapted<TestItem> & { testMethod: () => string };
type TestNewAdapted = NewAdapted<TestItem> & { testMethod: () => string };

/**
 * Mock adapter function for tests.
 *
 * Exception to test encapsulation rule: This adapter is defined globally because
 * inlining it in each test (~25 lines) severely impacts readability. The adapter
 * is stateless and does not affect test isolation.
 */
function createTestAdapter(storeModule: AdapterStoreModule<TestItem>): TestNewAdapted;
function createTestAdapter(
  storeModule: AdapterStoreModule<TestItem>,
  resourceGetter: () => TestItem,
): TestAdapted;
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

    Object.defineProperty(adapted, "mutable", {
      value: ref({ ...resourceGetter() }) as Ref<TestNew>,
      enumerable: true,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(adapted, "reset", {
      value: vi.fn(),
      enumerable: true,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(adapted, "update", {
      value: vi.fn(),
      enumerable: true,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(adapted, "patch", {
      value: vi.fn(),
      enumerable: true,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(adapted, "delete", {
      value: vi.fn(),
      enumerable: true,
      configurable: false,
      writable: false,
    });
    Object.defineProperty(adapted, "testMethod", {
      value: () => `adapted-${resourceGetter().id}`,
      enumerable: true,
      configurable: false,
      writable: false,
    });

    return adapted;
  }
  return {
    name: "",
    mutable: ref({ name: "" }) as Ref<TestNew>,
    reset: vi.fn(),
    create: vi.fn(),
    testMethod: () => "new-adapted",
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
  function adapter(
    storeModule: AdapterStoreModule<TestItem>,
    resourceGetter: () => TestItem,
  ): TestAdapted;
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

      Object.defineProperty(adapted, "mutable", {
        value: ref({ ...resourceGetter() }) as Ref<TestNew>,
        enumerable: true,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(adapted, "reset", {
        value: vi.fn(),
        enumerable: true,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(adapted, "update", {
        value: vi.fn(),
        enumerable: true,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(adapted, "patch", {
        value: vi.fn(),
        enumerable: true,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(adapted, "delete", {
        value: vi.fn(),
        enumerable: true,
        configurable: false,
        writable: false,
      });
      Object.defineProperty(adapted, "testMethod", {
        value: () => `adapted-${resourceGetter().id}`,
        enumerable: true,
        configurable: false,
        writable: false,
      });

      return adapted;
    }
    return {
      name: "",
      mutable: ref({ name: "" }) as Ref<TestNew>,
      reset: vi.fn(),
      create: vi.fn(),
      testMethod: () => "new-adapted",
    } as unknown as TestNewAdapted;
  }

  return {
    adapter: adapter as Adapter<TestItem, TestAdapted, TestNewAdapted>,
    getCapturedStoreModule: () => capturedStoreModule,
  };
}

describe("createAdapterStoreModule", () => {
  describe("getAll", () => {
    it("should return computed with empty array when no items", () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
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

    it("should return computed with all adapted items", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          name: "Item 2",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);

      // Act
      await store.retrieveAll();

      // Assert
      expect(store.getAll.value).toHaveLength(2);
      expect(store.getAll.value[0]?.testMethod()).toBe("adapted-1");
      expect(store.getAll.value[1]?.testMethod()).toBe("adapted-2");
    });

    it("should update when items are added to state", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const store = createAdapterStoreModule(config);
      expect(store.getAll.value).toHaveLength(0);
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);

      // Act
      await store.retrieveAll();

      // Assert
      expect(store.getAll.value).toHaveLength(1);
    });
  });

  describe("getById", () => {
    it("should return computed with undefined for non-existent id", () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
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

    it("should return computed with adapted item for existing id", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();

      // Act
      const result = store.getById(1);

      // Assert
      expect(result.value).toBeDefined();
      expect(result.value?.testMethod()).toBe("adapted-1");
    });

    it("should update when item is modified", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const store = createAdapterStoreModule(config);
      vi.mocked(httpService.getRequest).mockResolvedValue({
        data: [
          {
            id: 1,
            name: "Original",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
      } as AxiosResponse<TestItem[]>);
      await store.retrieveAll();
      const computed = store.getById(1);
      expect(computed.value?.name).toBe("Original");
      vi.mocked(httpService.getRequest).mockResolvedValue({
        data: [
          {
            id: 1,
            name: "Updated",
            createdAt: "2024-01-01T00:00:00Z",
            updatedAt: "2024-01-01T00:00:00Z",
          },
        ],
      } as AxiosResponse<TestItem[]>);

      // Act
      await store.retrieveAll();

      // Assert
      expect(computed.value?.name).toBe("Updated");
    });
  });

  describe("getOrFailById", () => {
    it("should wait for loading to finish before checking", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
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

    it("should return adapted item when found", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();

      // Act
      const result = await store.getOrFailById(1);

      // Assert
      expect(result.testMethod()).toBe("adapted-1");
    });

    it("should throw EntryNotFoundError when item not found", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const store = createAdapterStoreModule(config);

      // Act & Assert
      await expect(store.getOrFailById(999)).rejects.toThrow(EntryNotFoundError);
      await expect(store.getOrFailById(999)).rejects.toThrow("test-items with id 999 not found");
    });
  });

  describe("generateNew", () => {
    it("should return new adapted resource from adapter", () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const store = createAdapterStoreModule(config);

      // Act
      const result = store.generateNew();

      // Assert
      expect(result.testMethod()).toBe("new-adapted");
    });
  });

  describe("retrieveAll", () => {
    it("should call httpService.getRequest with domainName", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      vi.mocked(httpService.getRequest).mockResolvedValue({
        data: [] as TestItem[],
      } as AxiosResponse<TestItem[]>);
      const store = createAdapterStoreModule(config);

      // Act
      await store.retrieveAll();

      // Assert
      expect(httpService.getRequest).toHaveBeenCalledWith("test-items");
    });

    it("should store items in state as-is from response", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          name: "Item 2",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);

      // Act
      await store.retrieveAll();

      // Assert
      expect(store.getAll.value).toHaveLength(2);
    });

    it("should persist to storage service", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);

      // Act
      await store.retrieveAll();

      // Assert
      expect(storageService.put).toHaveBeenCalledWith("test-items", expect.any(Object));
    });
  });

  describe("localStorage persistence", () => {
    it("should initialize state from storage", () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storedItems = {
        1: {
          id: 1,
          name: "Stored Item",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      };
      const storageService: TestStorageService = {
        put: vi.fn(),
        get: vi.fn().mockReturnValue(storedItems),
      };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };

      // Act
      const store = createAdapterStoreModule(config);

      // Assert
      expect(storageService.get).toHaveBeenCalledWith("test-items", {});
      expect(store.getById(1).value).toBeDefined();
    });

    it("should persist state changes to storage on retrieveAll", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);

      // Act
      await store.retrieveAll();

      // Assert
      expect(storageService.put).toHaveBeenCalledWith(
        "test-items",
        expect.objectContaining({ 1: expect.any(Object) as unknown }),
      );
    });
  });

  describe("memoization", () => {
    it("should return the same adapted object reference when state has not changed", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();

      // Act
      const firstAccess = store.getAll.value[0];
      const secondAccess = store.getAll.value[0];

      // Assert
      expect(firstAccess).toBe(secondAccess);
    });

    it("should return the same adapted object after setById, with reactive properties reflecting the update", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const { adapter, getCapturedStoreModule } = createCapturingAdapter();
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();
      const beforeUpdate = store.getById(1).value;

      // Act
      const storeModule = getCapturedStoreModule() as unknown as AdapterStoreModule<TestItem>;
      storeModule.setById({
        id: 1,
        name: "Updated",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-02T00:00:00Z",
      });
      const afterUpdate = store.getById(1).value;

      // Assert — same adapted object reference (reactive getters, no cache invalidation)
      expect(beforeUpdate).toBe(afterUpdate);
      // Display properties reflect the updated store data via getter
      expect(afterUpdate?.name).toBe("Updated");
    });

    it("should clear adapted cache on deleteById", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const { adapter, getCapturedStoreModule } = createCapturingAdapter();
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
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

    it("should clear all caches on retrieveAll", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();
      const beforeRetrieve = store.getAll.value[0];

      // Act
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      await store.retrieveAll();
      const afterRetrieve = store.getAll.value[0];

      // Assert — new frozen references, so adapted objects must be new
      expect(beforeRetrieve).not.toBe(afterRetrieve);
    });

    it("should return the same computed ref for the same id across multiple getById calls", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();

      // Act
      const firstRef = store.getById(1);
      const secondRef = store.getById(1);

      // Assert
      expect(firstRef).toBe(secondRef);
    });

    it("should return different computed refs for different ids", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
        {
          id: 2,
          name: "Item 2",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();

      // Act
      const ref1 = store.getById(1);
      const ref2 = store.getById(2);

      // Assert
      expect(ref1).not.toBe(ref2);
    });

    it("should create a new computed ref for same id after retrieveAll clears cache", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();
      const refBefore = store.getById(1);

      // Act
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      await store.retrieveAll();
      const refAfter = store.getById(1);

      // Assert
      expect(refBefore).not.toBe(refAfter);
    });

    it("should create a new computed ref for same id after deleteById clears cache", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const { adapter, getCapturedStoreModule } = createCapturingAdapter();
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
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

    it("should return cached adapted object via getById when state has not changed", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter: createTestAdapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
      const store = createAdapterStoreModule(config);
      await store.retrieveAll();

      // Act
      const firstValue = store.getById(1).value;
      const secondValue = store.getById(1).value;

      // Assert
      expect(firstValue).toBe(secondValue);
    });
  });

  describe("storeModule methods", () => {
    it("should update state and persist when setById is called via adapter", () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const { adapter, getCapturedStoreModule } = createCapturingAdapter();
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter,
        httpService,
        storageService,
        loadingService,
      };
      const store = createAdapterStoreModule(config);
      store.generateNew();
      const newItem: TestItem = {
        id: 1,
        name: "New Item",
        createdAt: "2024-01-01T00:00:00Z",
        updatedAt: "2024-01-01T00:00:00Z",
      };

      // Act
      const capturedStoreModule = getCapturedStoreModule();
      expect(capturedStoreModule).not.toBeNull();
      const storeModule = capturedStoreModule as unknown as AdapterStoreModule<TestItem>;
      storeModule.setById(newItem);

      // Assert
      expect(store.getById(1).value).toBeDefined();
      expect(storageService.put).toHaveBeenCalledWith("test-items", expect.any(Object));
    });

    it("should remove from state and persist when deleteById is called via adapter", async () => {
      // Arrange
      const httpService: Pick<HttpService, "getRequest"> = { getRequest: vi.fn() };
      const storageService: TestStorageService = { put: vi.fn(), get: vi.fn().mockReturnValue({}) };
      const loadingService: TestLoadingService = {
        ensureLoadingFinished: vi.fn().mockResolvedValue(undefined),
      };
      const { adapter, getCapturedStoreModule } = createCapturingAdapter();
      const config: AdapterStoreConfig<TestItem, TestAdapted, TestNewAdapted> = {
        domainName: "test-items",
        adapter,
        httpService,
        storageService,
        loadingService,
      };
      const items: TestItem[] = [
        {
          id: 1,
          name: "Item 1",
          createdAt: "2024-01-01T00:00:00Z",
          updatedAt: "2024-01-01T00:00:00Z",
        },
      ];
      vi.mocked(httpService.getRequest).mockResolvedValue({ data: items } as AxiosResponse<
        TestItem[]
      >);
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
      expect(storageService.put).toHaveBeenCalledWith("test-items", expect.any(Object));
    });
  });
});
