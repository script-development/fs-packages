import type { Theme, ThemeService, ThemeStorageContract } from "./types";

import { ref } from "vue";

const STORAGE_KEY = "theme";

const applyTheme = (theme: Theme): void => {
  if (theme === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
};

export const getSystemThemePreference = (): Theme =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";

export const createThemeService = (storage: ThemeStorageContract): ThemeService => {
  const stored = storage.get<Theme>(STORAGE_KEY) ?? getSystemThemePreference();
  applyTheme(stored);

  const isDark = ref(stored === "dark");

  const toggleTheme = (): void => {
    isDark.value = !isDark.value;
    const theme: Theme = isDark.value ? "dark" : "light";
    storage.put(STORAGE_KEY, theme);
    applyTheme(theme);
  };

  return { isDark, toggleTheme };
};
