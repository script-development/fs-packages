// @vitest-environment jsdom
import type { AxiosResponseError, HttpService } from "@script-development/fs-http";
import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from "axios";

import { createLoadingService, registerLoadingMiddleware } from "../src";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RequestMiddleware = (config: InternalAxiosRequestConfig) => void;
type ResponseMiddleware = (response: AxiosResponse) => void;
type ErrorMiddleware = (error: AxiosError<AxiosResponseError>) => void;

const createMockHttpService = () => {
  const requestMiddlewares: RequestMiddleware[] = [];
  const responseMiddlewares: ResponseMiddleware[] = [];
  const errorMiddlewares: ErrorMiddleware[] = [];

  const triggerRequest = (config: Partial<InternalAxiosRequestConfig> = {}) => {
    const fullConfig = { url: "/test", ...config } as InternalAxiosRequestConfig;
    for (const middleware of requestMiddlewares) {
      middleware(fullConfig);
    }
    return fullConfig;
  };

  const triggerResponse = (config: InternalAxiosRequestConfig) => {
    const response = { config, data: {}, status: 200 } as AxiosResponse;
    for (const middleware of responseMiddlewares) {
      middleware(response);
    }
  };

  const triggerError = (config?: InternalAxiosRequestConfig) => {
    const error = {
      config,
      message: "Error",
      isAxiosError: true,
    } as AxiosError<AxiosResponseError>;
    for (const middleware of errorMiddlewares) {
      middleware(error);
    }
  };

  const httpService: HttpService = {
    getRequest: vi.fn(),
    postRequest: vi.fn(),
    putRequest: vi.fn(),
    patchRequest: vi.fn(),
    deleteRequest: vi.fn(),
    downloadRequest: vi.fn(),
    previewRequest: vi.fn(),
    streamRequest: vi.fn(),
    registerRequestMiddleware: vi.fn((fn: RequestMiddleware) => {
      requestMiddlewares.push(fn);
      return () => {
        const index = requestMiddlewares.indexOf(fn);
        if (index > -1) requestMiddlewares.splice(index, 1);
      };
    }),
    registerResponseMiddleware: vi.fn((fn: ResponseMiddleware) => {
      responseMiddlewares.push(fn);
      return () => {
        const index = responseMiddlewares.indexOf(fn);
        if (index > -1) responseMiddlewares.splice(index, 1);
      };
    }),
    registerResponseErrorMiddleware: vi.fn((fn: ErrorMiddleware) => {
      errorMiddlewares.push(fn);
      return () => {
        const index = errorMiddlewares.indexOf(fn);
        if (index > -1) errorMiddlewares.splice(index, 1);
      };
    }),
  };

  return { httpService, triggerRequest, triggerResponse, triggerError };
};

describe("registerLoadingMiddleware", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should register all three middleware types", () => {
    const { httpService } = createMockHttpService();
    const loadingService = createLoadingService();

    registerLoadingMiddleware(httpService, loadingService);

    expect(httpService.registerRequestMiddleware).toHaveBeenCalledOnce();
    expect(httpService.registerResponseMiddleware).toHaveBeenCalledOnce();
    expect(httpService.registerResponseErrorMiddleware).toHaveBeenCalledOnce();
  });

  it("should increment loading on request start", () => {
    const { httpService, triggerRequest } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    expect(loadingService.activeCount.value).toBe(0);

    triggerRequest();

    expect(loadingService.activeCount.value).toBe(1);
    expect(loadingService.isLoading.value).toBe(true);
  });

  it("should decrement loading on successful response", () => {
    const { httpService, triggerRequest, triggerResponse } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    const config = triggerRequest();
    triggerResponse(config);

    expect(loadingService.activeCount.value).toBe(0);
    expect(loadingService.isLoading.value).toBe(false);
  });

  it("should decrement loading on error response", () => {
    const { httpService, triggerRequest, triggerError } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    const config = triggerRequest();
    triggerError(config);

    expect(loadingService.activeCount.value).toBe(0);
    expect(loadingService.isLoading.value).toBe(false);
  });

  it("should track multiple concurrent requests", () => {
    const { httpService, triggerRequest, triggerResponse } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    const config1 = triggerRequest({ url: "/users" });
    const config2 = triggerRequest({ url: "/posts" });

    expect(loadingService.activeCount.value).toBe(2);

    triggerResponse(config1);
    expect(loadingService.activeCount.value).toBe(1);
    expect(loadingService.isLoading.value).toBe(true);

    triggerResponse(config2);
    expect(loadingService.activeCount.value).toBe(0);
    expect(loadingService.isLoading.value).toBe(false);
  });

  it("should auto-decrement loading after timeout", () => {
    const { httpService, triggerRequest } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService, { timeoutMs: 5000 });

    triggerRequest();
    expect(loadingService.activeCount.value).toBe(1);

    vi.advanceTimersByTime(5000);

    expect(loadingService.activeCount.value).toBe(0);
    expect(loadingService.isLoading.value).toBe(false);
  });

  it("should not auto-decrement if response arrives before timeout", () => {
    const { httpService, triggerRequest, triggerResponse } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService, { timeoutMs: 5000 });

    const config = triggerRequest();
    triggerResponse(config);

    vi.advanceTimersByTime(5000);

    expect(loadingService.activeCount.value).toBe(0);
  });

  it("should not double-decrement if timeout fires after response", () => {
    const { httpService, triggerRequest, triggerResponse } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService, { timeoutMs: 5000 });

    const config1 = triggerRequest({ url: "/users" });
    triggerRequest({ url: "/posts" });
    expect(loadingService.activeCount.value).toBe(2);

    triggerResponse(config1);
    expect(loadingService.activeCount.value).toBe(1);

    vi.advanceTimersByTime(5000);

    expect(loadingService.activeCount.value).toBe(0);
  });

  it("should disable timeout when timeoutMs is 0", () => {
    const { httpService, triggerRequest } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService, { timeoutMs: 0 });

    triggerRequest();
    expect(loadingService.activeCount.value).toBe(1);

    vi.advanceTimersByTime(60000);

    expect(loadingService.activeCount.value).toBe(1);
  });

  it("should handle response when timeout is disabled", () => {
    const { httpService, triggerRequest, triggerResponse } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService, { timeoutMs: 0 });

    const config = triggerRequest();
    expect(loadingService.activeCount.value).toBe(1);

    triggerResponse(config);

    expect(loadingService.activeCount.value).toBe(0);
  });

  it("should ignore duplicate response for same request", () => {
    const { httpService, triggerRequest, triggerResponse } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    const config = triggerRequest();
    expect(loadingService.activeCount.value).toBe(1);

    triggerResponse(config);
    expect(loadingService.activeCount.value).toBe(0);

    triggerResponse(config);

    expect(loadingService.activeCount.value).toBe(0);
  });

  it("should use default 30 second timeout", () => {
    const { httpService, triggerRequest } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    triggerRequest();

    vi.advanceTimersByTime(29999);
    expect(loadingService.activeCount.value).toBe(1);

    vi.advanceTimersByTime(1);
    expect(loadingService.activeCount.value).toBe(0);
  });

  it("should stop tracking after unregister is called", () => {
    const { httpService, triggerRequest } = createMockHttpService();
    const loadingService = createLoadingService();
    const { unregister } = registerLoadingMiddleware(httpService, loadingService);

    unregister();
    triggerRequest();

    expect(loadingService.activeCount.value).toBe(0);
  });

  it("should clear pending timeouts on unregister", () => {
    const { httpService, triggerRequest } = createMockHttpService();
    const loadingService = createLoadingService();
    const { unregister } = registerLoadingMiddleware(httpService, loadingService, {
      timeoutMs: 5000,
    });

    triggerRequest();
    expect(loadingService.activeCount.value).toBe(1);

    unregister();

    vi.advanceTimersByTime(5000);

    expect(loadingService.activeCount.value).toBe(1);
  });

  it("should handle error without config gracefully", () => {
    const { httpService, triggerRequest, triggerError } = createMockHttpService();
    const loadingService = createLoadingService();
    registerLoadingMiddleware(httpService, loadingService);

    triggerRequest();
    expect(loadingService.activeCount.value).toBe(1);

    triggerError(undefined);

    expect(loadingService.activeCount.value).toBe(1);
  });
});
