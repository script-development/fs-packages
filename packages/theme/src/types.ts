import type { Ref } from "vue";

export type Theme = "dark" | "light";

/**
 * Minimal storage contract for theme persistence.
 *
 * Intentionally mirrors the `get`/`put` shape of `@script-development/fs-storage`'s
 * `StorageService` interface — any fs-storage instance satisfies this contract without
 * importing it. This keeps the packages loosely coupled: fs-theme depends on a shape,
 * not a package.
 */
export type ThemeStorageContract = {
  get: <T>(key: string) => T | undefined;
  put: (key: string, value: unknown) => void;
};

export type ThemeService = {
  isDark: Ref<boolean>;
  toggleTheme: () => void;
};
