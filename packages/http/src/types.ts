import type {AxiosError, AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig} from 'axios';

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
    /**
     * Request timeout in milliseconds. Defaults to 30_000 (30s).
     * Set 0 to disable (caller takes responsibility per Doctrine #8).
     * Per-request override available via the `AxiosRequestConfig.timeout`
     * parameter on each method.
     */
    timeout?: number;
};

export type HttpService = {
    getRequest: <T = unknown>(endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
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
    deleteRequest: <T = unknown>(endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<T>>;
    /**
     * GET an endpoint as a Blob, intended for save-to-disk flows. Returns the
     * full AxiosResponse so callers can read headers (e.g. content-type) before
     * handing off to a download utility such as `fs-helpers`' `triggerDownload`.
     *
     * No DOM side effects — fs-http is transport-only (fs-packages issue #59).
     */
    downloadRequest: (endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<Blob>>;
    /**
     * GET an endpoint as a Blob, intended for inline-display flows. Identical
     * transport to `downloadRequest`; the separate name communicates intent.
     *
     * Callers manage object-URL lifecycle: `URL.createObjectURL(response.data)`
     * to render and `URL.revokeObjectURL(...)` on cleanup.
     */
    previewRequest: (endpoint: string, options?: AxiosRequestConfig) => Promise<AxiosResponse<Blob>>;
    streamRequest: (endpoint: string, data: unknown, signal?: AbortSignal) => Promise<Response>;
    registerRequestMiddleware: (fn: RequestMiddlewareFunc) => UnregisterMiddleware;
    registerResponseMiddleware: (fn: ResponseMiddlewareFunc) => UnregisterMiddleware;
    registerResponseErrorMiddleware: (fn: ResponseErrorMiddlewareFunc) => UnregisterMiddleware;
};
