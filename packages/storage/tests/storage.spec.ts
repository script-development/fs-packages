// @vitest-environment happy-dom
import { createStorageService } from "../src";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Overrides a localStorage method for testing error paths.
 * Returns a cleanup function that restores the original method.
 */
const overrideStorageMethod = <K extends "setItem" | "getItem" | "removeItem">(
  method: K,
  implementation: Storage[K],
): (() => void) => {
  const spy = vi.spyOn(localStorage, method).mockImplementation(implementation as never);
  return () => spy.mockRestore();
};

describe("storage service", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("createStorageService", () => {
    it("should return all expected methods", () => {
      const storage = createStorageService("test");

      expect(storage).toHaveProperty("put");
      expect(storage).toHaveProperty("get");
      expect(storage).toHaveProperty("remove");
      expect(storage).toHaveProperty("clear");
    });
  });

  describe("put", () => {
    it("should store string values with prefix", () => {
      const storage = createStorageService("test");

      storage.put("testKey", "testValue");

      expect(localStorage.getItem("test:testKey")).toBe("testValue");
    });

    it("should stringify non-string values", () => {
      const storage = createStorageService("test");
      const value = { name: "test", count: 42 };

      storage.put("testKey", value);

      expect(localStorage.getItem("test:testKey")).toBe('{"name":"test","count":42}');
    });

    it("should stringify arrays", () => {
      const storage = createStorageService("test");

      storage.put("testKey", [1, 2, 3]);

      expect(localStorage.getItem("test:testKey")).toBe("[1,2,3]");
    });

    it("should stringify boolean values", () => {
      const storage = createStorageService("test");

      storage.put("testKey", true);

      expect(localStorage.getItem("test:testKey")).toBe("true");
    });

    it('should stringify null to "null"', () => {
      const storage = createStorageService("test");

      storage.put("testKey", null);

      expect(localStorage.getItem("test:testKey")).toBe("null");
    });

    it('should stringify undefined to "undefined"', () => {
      const storage = createStorageService("test");

      storage.put("testKey", undefined);

      expect(localStorage.getItem("test:testKey")).toBe("undefined");
    });

    it("should log error when quota is exceeded", () => {
      const storage = createStorageService("test");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const quotaError = new DOMException("Quota exceeded", "QuotaExceededError");
      const restore = overrideStorageMethod("setItem", () => {
        throw quotaError;
      });

      storage.put("key", "value");

      expect(consoleSpy).toHaveBeenCalledWith("localStorage quota exceeded");

      restore();
      consoleSpy.mockRestore();
    });

    it("should log other errors", () => {
      const storage = createStorageService("test");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const genericError = new Error("Some error");
      const restore = overrideStorageMethod("setItem", () => {
        throw genericError;
      });

      storage.put("key", "value");

      expect(consoleSpy).toHaveBeenCalledWith(genericError);

      restore();
      consoleSpy.mockRestore();
    });
  });

  describe("get", () => {
    it("should return undefined when key does not exist", () => {
      const storage = createStorageService("test");

      const result = storage.get("nonExistentKey");

      expect(result).toBeUndefined();
    });

    it("should return default value when key does not exist", () => {
      const storage = createStorageService("test");

      const result = storage.get("nonExistentKey", "default");

      expect(result).toBe("default");
    });

    it("should return parsed JSON for object values", () => {
      const storage = createStorageService("test");
      const value = { name: "test", count: 42 };
      localStorage.setItem("test:testKey", JSON.stringify(value));

      const result = storage.get<typeof value>("testKey");

      expect(result).toEqual({ name: "test", count: 42 });
    });

    it("should return parsed JSON for array values", () => {
      const storage = createStorageService("test");
      localStorage.setItem("test:testKey", "[1,2,3]");

      const result = storage.get<number[]>("testKey");

      expect(result).toEqual([1, 2, 3]);
    });

    it("should return raw string when default is a string", () => {
      const storage = createStorageService("test");
      localStorage.setItem("test:testKey", "5e3");

      const result = storage.get("testKey", "default");

      expect(result).toBe("5e3");
    });

    it("should return string value when JSON parse fails", () => {
      const storage = createStorageService("test");
      localStorage.setItem("test:testKey", "not-json");

      const result = storage.get<string>("testKey");

      expect(result).toBe("not-json");
    });

    it("should return boolean values correctly", () => {
      const storage = createStorageService("test");
      localStorage.setItem("test:testKey", "true");

      const result = storage.get<boolean>("testKey");

      expect(result).toBe(true);
    });

    it("should return null when stored value was null", () => {
      const storage = createStorageService("test");
      storage.put("testKey", null);

      const result = storage.get<null>("testKey");

      expect(result).toBeNull();
    });

    it('should return string "undefined" when stored value was undefined', () => {
      const storage = createStorageService("test");
      storage.put("testKey", undefined);

      const result = storage.get<string>("testKey");

      expect(result).toBe("undefined");
    });

    it("should return default value and log error on storage access failure", () => {
      const storage = createStorageService("test");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const securityError = new DOMException("Access denied", "SecurityError");
      const restore = overrideStorageMethod("getItem", () => {
        throw securityError;
      });

      const result = storage.get("key", "fallback");

      expect(result).toBe("fallback");
      expect(consoleSpy).toHaveBeenCalledWith(securityError);

      restore();
      consoleSpy.mockRestore();
    });
  });

  describe("clear", () => {
    it("should only clear items with matching prefix", () => {
      const storage = createStorageService("app");
      localStorage.setItem("app:key1", "value1");
      localStorage.setItem("app:key2", "value2");
      localStorage.setItem("other:key", "value3");
      localStorage.setItem("unprefixed", "value4");

      storage.clear();

      expect(localStorage.getItem("app:key1")).toBeNull();
      expect(localStorage.getItem("app:key2")).toBeNull();
      expect(localStorage.getItem("other:key")).toBe("value3");
      expect(localStorage.getItem("unprefixed")).toBe("value4");
    });

    it("should log errors and continue clearing remaining keys on failure", () => {
      const storage = createStorageService("app");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const genericError = new Error("Removal failed");
      localStorage.setItem("app:key1", "value1");
      localStorage.setItem("app:key2", "value2");
      const restore = overrideStorageMethod("removeItem", () => {
        throw genericError;
      });

      storage.clear();

      expect(consoleSpy).toHaveBeenCalledWith(genericError);
      expect(consoleSpy).toHaveBeenCalledTimes(2);

      restore();
      consoleSpy.mockRestore();
    });
  });

  describe("remove", () => {
    it("should remove specific prefixed item from localStorage", () => {
      const storage = createStorageService("test");
      localStorage.setItem("test:key1", "value1");
      localStorage.setItem("test:key2", "value2");

      storage.remove("key1");

      expect(localStorage.getItem("test:key1")).toBeNull();
      expect(localStorage.getItem("test:key2")).toBe("value2");
    });

    it("should not affect items with different prefix", () => {
      const storage = createStorageService("auth");
      localStorage.setItem("auth:token", "abc123");
      localStorage.setItem("other:token", "xyz789");

      storage.remove("token");

      expect(localStorage.getItem("auth:token")).toBeNull();
      expect(localStorage.getItem("other:token")).toBe("xyz789");
    });

    it("should not throw when removing non-existent key", () => {
      const storage = createStorageService("test");

      expect(() => storage.remove("nonExistentKey")).not.toThrow();
    });

    it("should log errors on removal failure", () => {
      const storage = createStorageService("test");
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const genericError = new Error("Removal failed");
      const restore = overrideStorageMethod("removeItem", () => {
        throw genericError;
      });

      storage.remove("key");

      expect(consoleSpy).toHaveBeenCalledWith(genericError);

      restore();
      consoleSpy.mockRestore();
    });
  });

  describe("prefix isolation", () => {
    it("should isolate storage between different prefixes", () => {
      const authStorage = createStorageService("auth");
      const settingsStorage = createStorageService("settings");

      authStorage.put("token", "auth-token");
      settingsStorage.put("token", "settings-token");

      expect(authStorage.get("token")).toBe("auth-token");
      expect(settingsStorage.get("token")).toBe("settings-token");
      expect(localStorage.getItem("auth:token")).toBe("auth-token");
      expect(localStorage.getItem("settings:token")).toBe("settings-token");
    });
  });
});
