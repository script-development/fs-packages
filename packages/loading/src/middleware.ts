import type { HttpService } from "@script-development/fs-http";
import type { InternalAxiosRequestConfig } from "axios";

import type { LoadingMiddlewareOptions, LoadingMiddlewareResult, LoadingService } from "./types";

export const registerLoadingMiddleware = (
  httpService: HttpService,
  loadingService: LoadingService,
  options: LoadingMiddlewareOptions = {},
): LoadingMiddlewareResult => {
  const { timeoutMs = 30000 } = options;

  const requestTimeouts = new Map<InternalAxiosRequestConfig, ReturnType<typeof setTimeout>>();
  const completedRequests = new WeakSet<InternalAxiosRequestConfig>();

  const stopLoadingForRequest = (config: InternalAxiosRequestConfig): void => {
    if (completedRequests.has(config)) return;
    completedRequests.add(config);

    const timeout = requestTimeouts.get(config);
    if (timeout) {
      clearTimeout(timeout);
      requestTimeouts.delete(config);
    }

    loadingService.stopLoading();
  };

  const unregisterRequest = httpService.registerRequestMiddleware((config) => {
    loadingService.startLoading();

    if (timeoutMs > 0) {
      const timeout = setTimeout(() => {
        stopLoadingForRequest(config);
      }, timeoutMs);
      requestTimeouts.set(config, timeout);
    }
  });

  const unregisterResponse = httpService.registerResponseMiddleware((response) => {
    stopLoadingForRequest(response.config);
  });

  const unregisterError = httpService.registerResponseErrorMiddleware((error) => {
    if (error.config) {
      stopLoadingForRequest(error.config);
    }
  });

  const unregister = (): void => {
    unregisterRequest();
    unregisterResponse();
    unregisterError();

    for (const timeout of requestTimeouts.values()) {
      clearTimeout(timeout);
    }
    requestTimeouts.clear();
  };

  return { unregister };
};
