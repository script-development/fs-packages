import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MockAdapter from "axios-mock-adapter";
import axios from "axios";

import { createHttpService, isAxiosError } from "../src/index";

const BASE_URL = "https://api.example.com";

let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);

  // Stub browser globals
  vi.stubGlobal("document", {
    createElement: vi.fn(() => ({
      href: "",
      download: "",
      click: vi.fn(),
    })),
    cookie: "",
  });

  vi.stubGlobal("window", {
    URL: {
      createObjectURL: vi.fn(() => "blob:http://localhost/fake-object-url"),
    },
  });

  vi.stubGlobal(
    "Blob",
    vi.fn(function MockBlob(
      this: { parts: unknown[]; options: unknown },
      parts: unknown[],
      options?: unknown,
    ) {
      this.parts = parts;
      this.options = options;
    }),
  );

  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve(new Response("streamed", { status: 200 }))),
  );
});

afterEach(() => {
  mock.restore();
  vi.unstubAllGlobals();
});

describe("createHttpService", () => {
  describe("factory creation", () => {
    it("returns an object with all interface methods", () => {
      // Arrange & Act
      const service = createHttpService(BASE_URL);

      // Assert
      expect(service).toHaveProperty("getRequest");
      expect(service).toHaveProperty("postRequest");
      expect(service).toHaveProperty("putRequest");
      expect(service).toHaveProperty("patchRequest");
      expect(service).toHaveProperty("deleteRequest");
      expect(service).toHaveProperty("downloadRequest");
      expect(service).toHaveProperty("previewRequest");
      expect(service).toHaveProperty("streamRequest");
      expect(service).toHaveProperty("registerRequestMiddleware");
      expect(service).toHaveProperty("registerResponseMiddleware");
      expect(service).toHaveProperty("registerResponseErrorMiddleware");
    });
  });

  describe("default options", () => {
    it("creates axios instance with correct defaults", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, { ok: true });
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.getRequest("/test");

      // Assert
      expect(response.config.baseURL).toBe("https://api.example.com/");
      expect(response.config.withCredentials).toBe(true);
      expect(response.config.withXSRFToken).toBe(false);
      expect(response.config.headers.Accept).toBe("application/json");
    });
  });

  describe("custom options", () => {
    it("respects withCredentials: false", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL, { withCredentials: false });

      // Act
      const response = await service.getRequest("/test");

      // Assert
      expect(response.config.withCredentials).toBe(false);
    });

    it("includes custom headers merged with defaults", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL, {
        headers: { "X-Custom": "value" },
      });

      // Act
      const response = await service.getRequest("/test");

      // Assert — custom header present AND default Accept preserved
      expect(response.config.headers["X-Custom"]).toBe("value");
      expect(response.config.headers.Accept).toBe("application/json");
    });

    it("respects withXSRFToken: true", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL, { withXSRFToken: true });

      // Act
      const response = await service.getRequest("/test");

      // Assert
      expect(response.config.withXSRFToken).toBe(true);
    });
  });

  describe("standard request methods", () => {
    it("GET request calls correct method", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/users`).reply(200, [{ id: 1 }]);
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.getRequest("/users");

      // Assert
      expect(response.status).toBe(200);
      expect(response.data).toEqual([{ id: 1 }]);
    });

    it("GET request passes options", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/users`).reply(200, []);
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.getRequest("/users", { params: { page: 1 } });

      // Assert
      expect(response.config.params).toEqual({ page: 1 });
    });

    it("POST request sends data", async () => {
      // Arrange
      mock.onPost(`${BASE_URL}/users`).reply(201, { id: 2 });
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.postRequest("/users", { name: "Alice" });

      // Assert
      expect(response.status).toBe(201);
      expect(JSON.parse(response.config.data)).toEqual({ name: "Alice" });
    });

    it("POST request passes options", async () => {
      // Arrange
      mock.onPost(`${BASE_URL}/users`).reply(201, {});
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.postRequest(
        "/users",
        {},
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      // Assert
      expect(response.config.headers["Content-Type"]).toBe("multipart/form-data");
    });

    it("PUT request sends data", async () => {
      // Arrange
      mock.onPut(`${BASE_URL}/users/1`).reply(200, { id: 1, name: "Bob" });
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.putRequest("/users/1", { name: "Bob" });

      // Assert
      expect(response.status).toBe(200);
      expect(JSON.parse(response.config.data)).toEqual({ name: "Bob" });
    });

    it("PUT request passes options", async () => {
      // Arrange
      mock.onPut(`${BASE_URL}/users/1`).reply(200, {});
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.putRequest("/users/1", {}, { timeout: 5000 });

      // Assert
      expect(response.config.timeout).toBe(5000);
    });

    it("PATCH request sends data", async () => {
      // Arrange
      mock.onPatch(`${BASE_URL}/users/1`).reply(200, { id: 1 });
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.patchRequest("/users/1", { name: "Charlie" });

      // Assert
      expect(response.status).toBe(200);
      expect(JSON.parse(response.config.data)).toEqual({ name: "Charlie" });
    });

    it("PATCH request passes options", async () => {
      // Arrange
      mock.onPatch(`${BASE_URL}/users/1`).reply(200, {});
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.patchRequest("/users/1", {}, { timeout: 3000 });

      // Assert
      expect(response.config.timeout).toBe(3000);
    });

    it("DELETE request calls correct method", async () => {
      // Arrange
      mock.onDelete(`${BASE_URL}/users/1`).reply(204);
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.deleteRequest("/users/1");

      // Assert
      expect(response.status).toBe(204);
    });

    it("DELETE request passes options", async () => {
      // Arrange
      mock.onDelete(`${BASE_URL}/users/1`).reply(204);
      const service = createHttpService(BASE_URL);

      // Act
      const response = await service.deleteRequest("/users/1", { timeout: 1000 });

      // Assert
      expect(response.config.timeout).toBe(1000);
    });
  });

  describe("request middleware", () => {
    it("registered middleware is called on every request", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL);
      const middlewareFn = vi.fn();
      service.registerRequestMiddleware(middlewareFn);

      // Act
      await service.getRequest("/first");
      await service.getRequest("/second");

      // Assert
      expect(middlewareFn).toHaveBeenCalledTimes(2);
    });

    it("preserves execution order", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL);
      const order: number[] = [];
      service.registerRequestMiddleware(() => order.push(1));
      service.registerRequestMiddleware(() => order.push(2));
      service.registerRequestMiddleware(() => order.push(3));

      // Act
      await service.getRequest("/test");

      // Assert
      expect(order).toEqual([1, 2, 3]);
    });
  });

  describe("response middleware", () => {
    it("registered middleware is called on successful responses", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, { ok: true });
      const service = createHttpService(BASE_URL);
      const middlewareFn = vi.fn();
      service.registerResponseMiddleware(middlewareFn);

      // Act
      await service.getRequest("/test");

      // Assert
      expect(middlewareFn).toHaveBeenCalledTimes(1);
      expect(middlewareFn).toHaveBeenCalledWith(expect.objectContaining({ status: 200 }));
    });
  });

  describe("error middleware", () => {
    it("registered middleware is called on axios errors", async () => {
      // Arrange
      mock.onGet(/.*/).reply(500, { error: "server" });
      const service = createHttpService(BASE_URL);
      const errorFn = vi.fn();
      service.registerResponseErrorMiddleware(errorFn);

      // Act & Assert
      await expect(service.getRequest("/fail")).rejects.toThrow();
      expect(errorFn).toHaveBeenCalledTimes(1);
    });

    it("non-axios errors are rejected without middleware", async () => {
      // Arrange
      mock.onGet(/.*/).reply(() => {
        throw new TypeError("Network failure");
      });
      const service = createHttpService(BASE_URL);
      const errorFn = vi.fn();
      service.registerResponseErrorMiddleware(errorFn);

      // Act & Assert
      await expect(service.getRequest("/fail")).rejects.toThrow();
      expect(errorFn).not.toHaveBeenCalled();
    });
  });

  describe("middleware unregister", () => {
    it("calling the returned function removes request middleware", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL);
      const middlewareFn = vi.fn();
      const unregister = service.registerRequestMiddleware(middlewareFn);

      // Act
      await service.getRequest("/first");
      unregister();
      await service.getRequest("/second");

      // Assert
      expect(middlewareFn).toHaveBeenCalledTimes(1);
    });

    it("calling the returned function removes response middleware", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL);
      const middlewareFn = vi.fn();
      const unregister = service.registerResponseMiddleware(middlewareFn);

      // Act
      await service.getRequest("/first");
      unregister();
      await service.getRequest("/second");

      // Assert
      expect(middlewareFn).toHaveBeenCalledTimes(1);
    });

    it("calling the returned function removes error middleware", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/fail`).reply(500, {});
      const service = createHttpService(BASE_URL);
      const errorFn = vi.fn();
      const unregister = service.registerResponseErrorMiddleware(errorFn);

      // Act
      await expect(service.getRequest("/fail")).rejects.toThrow();
      unregister();
      await expect(service.getRequest("/fail")).rejects.toThrow();

      // Assert
      expect(errorFn).toHaveBeenCalledTimes(1);
    });

    it("unregistering a non-existent middleware is a no-op", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL);
      const middlewareFn = vi.fn();
      const unregister = service.registerRequestMiddleware(middlewareFn);

      // Act — double unregister should not throw
      unregister();
      unregister();

      // Assert
      await service.getRequest("/test");
      expect(middlewareFn).not.toHaveBeenCalled();
    });
  });

  describe("smart credentials", () => {
    it("sets withCredentials true for same-host requests", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL, { smartCredentials: true });

      // Act
      const response = await service.getRequest("/same-host");

      // Assert
      expect(response.config.withCredentials).toBe(true);
    });

    it("sets withCredentials false for cross-host requests", async () => {
      // Arrange
      mock.onGet(/.*/).reply(200, {});
      const service = createHttpService(BASE_URL, { smartCredentials: true });

      // Act
      const response = await service.getRequest("https://external.com/api/data");

      // Assert
      expect(response.config.withCredentials).toBe(false);
    });
  });

  describe("downloadRequest", () => {
    it("makes GET with responseType blob and creates download link", async () => {
      // Arrange
      const blobData = "file-content";
      mock.onGet(`${BASE_URL}/download/file.pdf`).reply(200, blobData, {
        "content-type": "application/pdf",
      });
      const service = createHttpService(BASE_URL);
      const clickFn = vi.fn();
      const mockLink = { href: "", download: "", click: clickFn };
      const createElementFn = vi.fn(() => mockLink);
      vi.stubGlobal("document", {
        createElement: createElementFn,
        cookie: "",
      });

      // Act
      const response = await service.downloadRequest("/download/file.pdf", "report.pdf");

      // Assert
      expect(response.config.responseType).toBe("blob");
      expect(createElementFn).toHaveBeenCalledWith("a");
      expect(mockLink.download).toBe("report.pdf");
      expect(mockLink.href).toBe("blob:http://localhost/fake-object-url");
      expect(clickFn).toHaveBeenCalledTimes(1);

      // Verify Blob was constructed with response data and correct type
      const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
      expect(BlobMock).toHaveBeenCalledWith([blobData], { type: "application/pdf" });
    });

    it("uses explicit type override when provided", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/download/file`).reply(200, "data", {
        "content-type": "application/octet-stream",
      });
      const service = createHttpService(BASE_URL);
      const clickFn = vi.fn();
      vi.stubGlobal("document", {
        createElement: vi.fn(() => ({ href: "", download: "", click: clickFn })),
        cookie: "",
      });

      // Act
      await service.downloadRequest("/download/file", "doc.xlsx", "application/xlsx");

      // Assert — type override takes precedence over header
      const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
      expect(BlobMock).toHaveBeenCalledWith(["data"], { type: "application/xlsx" });
      expect(clickFn).toHaveBeenCalled();
    });

    it("maps known content-type headers", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/download/spreadsheet`).reply(200, "data", {
        "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const service = createHttpService(BASE_URL);
      const clickFn = vi.fn();
      vi.stubGlobal("document", {
        createElement: vi.fn(() => ({ href: "", download: "", click: clickFn })),
        cookie: "",
      });

      // Act
      await service.downloadRequest("/download/spreadsheet", "report.xlsx");

      // Assert — OOXML content-type mapped to application/xlsx
      const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
      expect(BlobMock).toHaveBeenCalledWith(["data"], { type: "application/xlsx" });
      expect(clickFn).toHaveBeenCalled();
    });

    it("throws when no content type is available", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/download/unknown`).reply(200, "data", {});
      const service = createHttpService(BASE_URL);

      // Act & Assert
      await expect(service.downloadRequest("/download/unknown", "file.bin")).rejects.toThrow(
        "No content type found",
      );
    });
  });

  describe("previewRequest", () => {
    it("makes GET with responseType blob and returns object URL", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/preview/doc`).reply(200, "blob-data", {
        "content-type": "application/pdf",
      });
      const service = createHttpService(BASE_URL);

      // Act
      const url = await service.previewRequest("/preview/doc");

      // Assert
      expect(url).toBe("blob:http://localhost/fake-object-url");
      const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
      expect(BlobMock).toHaveBeenCalledWith(["blob-data"], { type: "application/pdf" });
      expect(window.URL.createObjectURL).toHaveBeenCalled();
    });

    it("uses fallback content type when header is missing", async () => {
      // Arrange
      mock.onGet(`${BASE_URL}/preview/doc`).reply(200, "blob-data", {});
      const service = createHttpService(BASE_URL);

      // Act
      const url = await service.previewRequest("/preview/doc");

      // Assert
      expect(url).toBe("blob:http://localhost/fake-object-url");
      const BlobMock = globalThis.Blob as unknown as ReturnType<typeof vi.fn>;
      expect(BlobMock).toHaveBeenCalledWith(["blob-data"], { type: "application/octet-stream" });
    });
  });

  describe("streamRequest", () => {
    it("calls native fetch with correct parameters", async () => {
      // Arrange
      const service = createHttpService(BASE_URL);
      const mockFetch = vi.fn(() => Promise.resolve(new Response("ok")));
      vi.stubGlobal("fetch", mockFetch);

      // Act
      await service.streamRequest("/stream", { prompt: "hello" });

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/stream",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ prompt: "hello" }),
          headers: expect.objectContaining({
            "content-type": "application/json",
            accept: "application/json",
          }),
        }),
      );
    });

    it("passes abort signal", async () => {
      // Arrange
      const service = createHttpService(BASE_URL);
      const controller = new AbortController();
      const mockFetch = vi.fn(() => Promise.resolve(new Response("ok")));
      vi.stubGlobal("fetch", mockFetch);

      // Act
      await service.streamRequest("/stream", {}, controller.signal);

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ signal: controller.signal }),
      );
    });

    it("strips multiple trailing slashes from base URL", async () => {
      // Arrange
      const service = createHttpService("https://api.example.com///");
      const mockFetch = vi.fn(() => Promise.resolve(new Response("ok")));
      vi.stubGlobal("fetch", mockFetch);

      // Act
      await service.streamRequest("/stream", {});

      // Assert — multiple trailing slashes collapsed
      expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/stream", expect.any(Object));
    });

    it("reads XSRF token from cookies", async () => {
      // Arrange
      const service = createHttpService(BASE_URL);
      vi.stubGlobal("document", {
        createElement: vi.fn(),
        cookie: "XSRF-TOKEN=abc123; other=value",
      });
      const mockFetch = vi.fn(() => Promise.resolve(new Response("ok")));
      vi.stubGlobal("fetch", mockFetch);

      // Act
      await service.streamRequest("/stream", {});

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-XSRF-TOKEN": "abc123",
          }),
        }),
      );
    });

    it("omits XSRF header when no cookie present", async () => {
      // Arrange
      const service = createHttpService(BASE_URL);
      vi.stubGlobal("document", {
        createElement: vi.fn(),
        cookie: "other=value",
      });
      const mockFetch = vi.fn(() => Promise.resolve(new Response("ok")));
      vi.stubGlobal("fetch", mockFetch);

      // Act
      await service.streamRequest("/stream", {});

      // Assert
      const callArgs = mockFetch.mock.calls[0]![1] as RequestInit;
      const headers = callArgs.headers as Record<string, string>;
      expect(headers).not.toHaveProperty("X-XSRF-TOKEN");
    });

    it("decodes URL-encoded XSRF token", async () => {
      // Arrange
      const service = createHttpService(BASE_URL);
      vi.stubGlobal("document", {
        createElement: vi.fn(),
        cookie: "XSRF-TOKEN=abc%3D123",
      });
      const mockFetch = vi.fn(() => Promise.resolve(new Response("ok")));
      vi.stubGlobal("fetch", mockFetch);

      // Act
      await service.streamRequest("/stream", {});

      // Assert
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-XSRF-TOKEN": "abc=123",
          }),
        }),
      );
    });
  });
});

describe("isAxiosError", () => {
  it("returns true for axios errors", async () => {
    // Arrange
    const mock = new MockAdapter(axios);
    mock.onGet("http://test.com/fail").reply(500);

    // Act
    let caughtError: unknown;
    try {
      await axios.get("http://test.com/fail");
    } catch (error) {
      caughtError = error;
    }

    // Assert
    expect(isAxiosError(caughtError)).toBe(true);
    mock.restore();
  });

  it("returns false for non-axios errors", () => {
    // Arrange
    const error = new Error("regular error");

    // Act & Assert
    expect(isAxiosError(error)).toBe(false);
  });

  it("returns false for non-error values", () => {
    // Act & Assert
    expect(isAxiosError("string")).toBe(false);
    expect(isAxiosError(null)).toBe(false);
    expect(isAxiosError(undefined)).toBe(false);
    expect(isAxiosError(42)).toBe(false);
  });
});
