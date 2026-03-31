import type {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";

export type AxiosResponseError = Record<string, unknown>;

export type RequestMiddlewareFunc = (request: InternalAxiosRequestConfig) => void;
export type ResponseMiddlewareFunc = (response: AxiosResponse) => void;
export type ResponseErrorMiddlewareFunc = (error: AxiosError<AxiosResponseError>) => void;

export type UnregisterMiddleware = () => void;

export type HttpServiceOptions = {
  headers?: Record<string, string>;
  withCredentials?: boolean;
  withXSRFToken?: boolean;
  smartCredentials?: boolean;
};

export type HttpService = {
  getRequest: <T = unknown>(
    endpoint: string,
    options?: AxiosRequestConfig,
  ) => Promise<AxiosResponse<T>>;
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
  deleteRequest: <T = unknown>(
    endpoint: string,
    options?: AxiosRequestConfig,
  ) => Promise<AxiosResponse<T>>;
  downloadRequest: (
    endpoint: string,
    documentName: string,
    type?: string,
  ) => Promise<AxiosResponse>;
  previewRequest: (endpoint: string) => Promise<string>;
  streamRequest: (endpoint: string, data: unknown, signal?: AbortSignal) => Promise<Response>;
  registerRequestMiddleware: (fn: RequestMiddlewareFunc) => UnregisterMiddleware;
  registerResponseMiddleware: (fn: ResponseMiddlewareFunc) => UnregisterMiddleware;
  registerResponseErrorMiddleware: (fn: ResponseErrorMiddlewareFunc) => UnregisterMiddleware;
};
