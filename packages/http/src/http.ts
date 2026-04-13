import type { AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";

import axios from "axios";

import type {
  HttpService,
  HttpServiceOptions,
  RequestMiddlewareFunc,
  ResponseErrorMiddlewareFunc,
  ResponseMiddlewareFunc,
  UnregisterMiddleware,
  AxiosResponseError,
} from "./types";
import { isAxiosError } from "./utils";

const HEADERS_TO_TYPE: Record<string, string> = {
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "application/xlsx",
};

const unregister = <T>(array: T[], item: T): UnregisterMiddleware => {
  return () => {
    const index = array.indexOf(item);
    if (index > -1) array.splice(index, 1);
  };
};

export const createHttpService = (baseURL: string, options?: HttpServiceOptions): HttpService => {
  const apiUrl = new URL(baseURL);

  const http = axios.create({
    baseURL: apiUrl.toString(),
    withCredentials: options?.withCredentials ?? true,
    withXSRFToken: options?.withXSRFToken ?? false,
    headers: { Accept: "application/json", ...options?.headers },
  });

  // Middleware stacks
  const requestMiddleware: RequestMiddlewareFunc[] = [];
  const responseMiddleware: ResponseMiddlewareFunc[] = [];
  const responseErrorMiddleware: ResponseErrorMiddlewareFunc[] = [];

  // Smart credentials: toggle withCredentials based on request host matching base host
  if (options?.smartCredentials) {
    const prepareExternalRequest: RequestMiddlewareFunc = (request: InternalAxiosRequestConfig) => {
      const requestUrl = new URL(http.getUri(request));
      request.withCredentials = apiUrl.host === requestUrl.host;
    };

    requestMiddleware.push(prepareExternalRequest);
  }

  // Wire up interceptors
  http.interceptors.request.use((request) => {
    for (const middleware of requestMiddleware) middleware(request);

    return request;
  });

  http.interceptors.response.use(
    (response) => {
      for (const middleware of responseMiddleware) middleware(response);

      return response;
    },
    (error) => {
      if (!isAxiosError<AxiosResponseError>(error)) return Promise.reject(error);

      for (const middleware of responseErrorMiddleware) middleware(error);

      return Promise.reject(error);
    },
  );

  // Standard request methods
  const getRequest = <T = unknown>(endpoint: string, options?: AxiosRequestConfig) =>
    http.get<T>(endpoint, options);

  const postRequest = <T = unknown>(
    endpoint: string,
    data: unknown,
    options?: AxiosRequestConfig,
  ) => http.post<T>(endpoint, data, options);

  const putRequest = <T = unknown>(endpoint: string, data: unknown, options?: AxiosRequestConfig) =>
    http.put<T>(endpoint, data, options);

  const patchRequest = <T = unknown>(
    endpoint: string,
    data: unknown,
    options?: AxiosRequestConfig,
  ) => http.patch<T>(endpoint, data, options);

  const deleteRequest = <T = unknown>(endpoint: string, options?: AxiosRequestConfig) =>
    http.delete<T>(endpoint, options);

  // Browser-dependent methods

  const getContentType = (headerContentType?: string, type?: string): string => {
    if (type) return type;
    if (headerContentType) return HEADERS_TO_TYPE[headerContentType] || headerContentType;
    throw new Error("No content type found");
  };

  const downloadRequest = async (endpoint: string, documentName: string, type?: string) => {
    const response = await http.get(endpoint, { responseType: "blob" });
    const { data, headers } = response;

    const actualType = getContentType(headers["content-type"], type);

    const blob = new Blob([data], { type: actualType });
    const link = document.createElement("a");
    link.href = window.URL.createObjectURL(blob);
    link.download = documentName;
    link.click();

    return response;
  };

  const previewRequest = async (endpoint: string): Promise<string> => {
    const response = await http.get(endpoint, { responseType: "blob" });
    const contentType: string = response.headers["content-type"] ?? "application/octet-stream";
    const blob = new Blob([response.data], { type: contentType });

    return window.URL.createObjectURL(blob);
  };

  const streamRequest = (
    endpoint: string,
    data: unknown,
    signal?: AbortSignal,
  ): Promise<Response> => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
    };

    const xsrfToken = document.cookie.match(/XSRF-TOKEN=([^;]+)/)?.[1];
    if (xsrfToken) headers["X-XSRF-TOKEN"] = decodeURIComponent(xsrfToken);

    const base = apiUrl.toString().replace(/\/+$/, "");

    // Honor the service's withCredentials config. Previously hardcoded to
    // "include", which silently overrode consumer opt-outs. Note: smartCredentials
    // is a no-op here because streamRequest only accepts relative endpoints
    // (base + endpoint is string concatenation), so requests are always same-host.
    const includeCredentials: boolean = options?.withCredentials ?? true;

    return fetch(base + endpoint, {
      signal,
      method: "POST",
      credentials: includeCredentials ? "include" : "same-origin",
      headers,
      body: JSON.stringify(data),
    });
  };

  // Middleware registration
  const registerRequestMiddleware = (fn: RequestMiddlewareFunc): UnregisterMiddleware => {
    requestMiddleware.push(fn);

    return unregister(requestMiddleware, fn);
  };

  const registerResponseMiddleware = (fn: ResponseMiddlewareFunc): UnregisterMiddleware => {
    responseMiddleware.push(fn);

    return unregister(responseMiddleware, fn);
  };

  const registerResponseErrorMiddleware = (
    fn: ResponseErrorMiddlewareFunc,
  ): UnregisterMiddleware => {
    responseErrorMiddleware.push(fn);

    return unregister(responseErrorMiddleware, fn);
  };

  return {
    getRequest,
    postRequest,
    putRequest,
    patchRequest,
    deleteRequest,
    downloadRequest,
    previewRequest,
    streamRequest,
    registerRequestMiddleware,
    registerResponseMiddleware,
    registerResponseErrorMiddleware,
  };
};
