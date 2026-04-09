# fs-theme

Reactive dark/light mode service with system preference detection and storage persistence.

```bash
npm install @script-development/fs-theme
```

**Peer dependencies:** `vue ^3.5.0`

## What It Does

`fs-theme` manages theme state (dark or light) as a reactive Vue ref, persists the choice to storage, and respects the user's system preference as a default. It doesn't render anything — it controls a boolean and lets you decide how your UI responds.

## Basic Usage

```typescript
import { createStorageService } from "@script-development/fs-storage";
import { createThemeService } from "@script-development/fs-theme";

const storage = createStorageService("myapp");
const theme = createThemeService(storage);

// Reactive boolean — true means dark mode
theme.isDark.value; // true or false

// Toggle between dark and light
theme.toggleTheme();
```

In a Vue component:

```vue
<script setup lang="ts">
import { theme } from "@/services";
</script>

<template>
  <button @click="theme.toggleTheme()">
    {{ theme.isDark.value ? "Switch to Light" : "Switch to Dark" }}
  </button>
</template>
```

## How It Resolves the Theme

When created, the service determines the initial theme in this order:

1. **Stored preference** — checks storage for a previously saved choice
2. **System preference** — falls back to the OS/browser preference via `matchMedia`
3. **Default** — dark mode if neither is available

Every toggle saves the new preference to storage automatically.

## Loose Coupling with Storage

`fs-theme` doesn't import `fs-storage`. Instead, it defines a **structural contract** — any object with `get()` and `put()` methods works:

```typescript
interface ThemeStorageContract {
  get<T>(key: string): T | undefined;
  put(key: string, value: unknown): void;
}
```

This means you can pass any compatible storage implementation:

```typescript
// fs-storage works because it matches the contract
const theme = createThemeService(createStorageService("myapp"));

// A simple object works too — useful in tests
const fakeStorage = {
  data: {} as Record<string, unknown>,
  get<T>(key: string) {
    return this.data[key] as T | undefined;
  },
  put(key: string, value: unknown) {
    this.data[key] = value;
  },
};
const theme = createThemeService(fakeStorage);
```

::: tip Why structural typing?
This is the [Architecture](/architecture#structural-typing-duck-types) pattern in action. The theme service doesn't need to know about the storage package. It just needs something that can store and retrieve values. This makes the package independently testable and usable with any storage backend.
:::

## System Preference Detection

The `getSystemThemePreference()` utility reads the OS/browser theme setting:

```typescript
import { getSystemThemePreference } from "@script-development/fs-theme";

const systemTheme = getSystemThemePreference(); // "dark" or "light"
```

This is used internally during initialization but is also exported for direct use — for example, showing the user what their system preference is.

## API Reference

### `createThemeService(storage)`

| Parameter | Type                   | Description                                 |
| --------- | ---------------------- | ------------------------------------------- |
| `storage` | `ThemeStorageContract` | Any object with `get()` and `put()` methods |

### Service Properties

| Property        | Type           | Description                              |
| --------------- | -------------- | ---------------------------------------- |
| `isDark`        | `Ref<boolean>` | Reactive theme state. `true` = dark mode |
| `toggleTheme()` | `() => void`   | Toggle theme and persist to storage      |

### Utilities

| Function                     | Returns             | Description                      |
| ---------------------------- | ------------------- | -------------------------------- |
| `getSystemThemePreference()` | `"dark" \| "light"` | Read OS/browser theme preference |

### Types

| Type                   | Description                              |
| ---------------------- | ---------------------------------------- |
| `Theme`                | `"dark" \| "light"`                      |
| `ThemeService`         | Service object returned by the factory   |
| `ThemeStorageContract` | Shape required for the storage parameter |
