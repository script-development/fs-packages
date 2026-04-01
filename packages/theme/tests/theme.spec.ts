// @vitest-environment jsdom
import { createThemeService, getSystemThemePreference } from "../src";
import type { ThemeStorageContract } from "../src";
import { beforeEach, describe, expect, it, vi } from "vitest";

const createMockStorage = (initial?: Record<string, unknown>): ThemeStorageContract => {
  const store = new Map<string, unknown>(Object.entries(initial ?? {}));

  return {
    get: <T>(key: string): T | undefined => store.get(key) as T | undefined,
    put: (key: string, value: unknown): void => {
      store.set(key, value);
    },
  };
};

describe("getSystemThemePreference", () => {
  it("should return 'light' when system prefers light", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true } as MediaQueryList);

    expect(getSystemThemePreference()).toBe("light");

    vi.restoreAllMocks();
  });

  it("should return 'dark' when system prefers dark", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false } as MediaQueryList);

    expect(getSystemThemePreference()).toBe("dark");

    vi.restoreAllMocks();
  });

  it("should return 'dark' when matchMedia is not available", () => {
    const original = window.matchMedia;
    Object.defineProperty(window, "matchMedia", { value: undefined, writable: true });

    expect(getSystemThemePreference()).toBe("dark");

    Object.defineProperty(window, "matchMedia", { value: original, writable: true });
  });
});

describe("createThemeService", () => {
  beforeEach(() => {
    document.documentElement.removeAttribute("data-theme");
  });

  describe("initialization", () => {
    it("should use stored theme when available", () => {
      const storage = createMockStorage({ theme: "light" });

      const service = createThemeService(storage);

      expect(service.isDark.value).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });

    it("should fall back to system preference when no stored theme", () => {
      window.matchMedia = vi.fn().mockReturnValue({ matches: false } as MediaQueryList);
      const storage = createMockStorage();

      const service = createThemeService(storage);

      expect(service.isDark.value).toBe(true);
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);

      vi.restoreAllMocks();
    });

    it("should apply dark theme by removing data-theme attribute", () => {
      document.documentElement.setAttribute("data-theme", "light");
      const storage = createMockStorage({ theme: "dark" });

      createThemeService(storage);

      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    });

    it("should apply light theme by setting data-theme attribute", () => {
      const storage = createMockStorage({ theme: "light" });

      createThemeService(storage);

      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    });
  });

  describe("toggleTheme", () => {
    it("should toggle from dark to light", () => {
      const storage = createMockStorage({ theme: "dark" });
      const service = createThemeService(storage);

      service.toggleTheme();

      expect(service.isDark.value).toBe(false);
      expect(document.documentElement.getAttribute("data-theme")).toBe("light");
      expect(storage.get("theme")).toBe("light");
    });

    it("should toggle from light to dark", () => {
      const storage = createMockStorage({ theme: "light" });
      const service = createThemeService(storage);

      service.toggleTheme();

      expect(service.isDark.value).toBe(true);
      expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
      expect(storage.get("theme")).toBe("dark");
    });

    it("should persist theme to storage on each toggle", () => {
      const storage = createMockStorage({ theme: "dark" });
      const service = createThemeService(storage);

      service.toggleTheme();
      expect(storage.get("theme")).toBe("light");

      service.toggleTheme();
      expect(storage.get("theme")).toBe("dark");
    });
  });
});
