# fs-translation

Type-safe reactive i18n service with multi-locale support.

```bash
npm install @script-development/fs-translation
```

**Peer dependencies:** `vue ^3.5.0`

## What It Does

`fs-translation` provides internationalization with two guarantees you don't get from most i18n libraries:

1. **Compile-time key validation** — misspelled translation keys are caught by TypeScript, not by users
2. **Reactive locale switching** — changing the locale updates all translated text automatically via Vue's reactivity system

## Basic Usage

### Define Your Translations

Translations are organized as a two-level nested object: **sections** containing **keys**:

```typescript
const translations = {
  en: {
    common: {
      save: "Save",
      cancel: "Cancel",
      delete: "Delete",
    },
    users: {
      title: "Users",
      empty: "No users found",
      created: "User {name} created",
    },
  },
  nl: {
    common: {
      save: "Opslaan",
      cancel: "Annuleren",
      delete: "Verwijderen",
    },
    users: {
      title: "Gebruikers",
      empty: "Geen gebruikers gevonden",
      created: "Gebruiker {name} aangemaakt",
    },
  },
};
```

### Create the Service

```typescript
import { createTranslationService } from "@script-development/fs-translation";

const translation = createTranslationService(translations, "en");
```

### Use in Components

```vue
<script setup lang="ts">
import { translation } from "@/services";
</script>

<template>
  <h1>{{ translation.t("users.title").value }}</h1>
  <p v-if="!users.length">{{ translation.t("users.empty").value }}</p>
  <button>{{ translation.t("common.save").value }}</button>
</template>
```

## Type-Safe Keys

Translation keys are validated at compile time using TypeScript's template literal types. The `t()` function only accepts keys that exist in your translation schema:

```typescript
translation.t("common.save"); // compiles — "common.save" exists
translation.t("common.delete"); // compiles — "common.delete" exists
translation.t("common.submit"); // compile error — "common.submit" doesn't exist
translation.t("invalid.key"); // compile error — "invalid" section doesn't exist
```

Keys use dot notation: `"section.key"`. This catches typos before your code ever runs.

## Parameter Interpolation

Use `{param}` placeholders in translation strings and pass values at call time:

```typescript
// Translation: "User {name} created"
const message = translation.t("users.created", { name: "Alice" });
// Result: "User Alice created"
```

```vue
<template>
  <p>{{ translation.t("users.created", { name: userName }).value }}</p>
</template>
```

## Switching Locales

The `locale` property is a reactive `Ref`. Assign to it to switch languages — all `t()` results update automatically:

```typescript
translation.locale.value = "nl";
// Every ComputedRef from t() now returns Dutch translations
```

```vue
<script setup lang="ts">
import { translation } from "@/services";
</script>

<template>
  <select v-model="translation.locale.value">
    <option value="en">English</option>
    <option value="nl">Nederlands</option>
  </select>

  <!-- Updates automatically when locale changes -->
  <h1>{{ translation.t("users.title").value }}</h1>
</template>
```

::: tip Why is t() a ComputedRef?
Because it needs to update reactively when the locale changes. If `t()` returned a plain string, you'd have to re-call it every time the locale changes. By returning a `ComputedRef`, Vue's reactivity system handles it — the template re-renders automatically.
:::

## Memoization

The service caches `ComputedRef` instances by key and params combination. Calling `t("common.save")` in 10 different components returns the same `ComputedRef` instance — no duplicate work.

## API Reference

### `createTranslationService(translations, defaultLocale)`

| Parameter       | Type                       | Description                 |
| --------------- | -------------------------- | --------------------------- |
| `translations`  | `Record<TLocale, TSchema>` | Translation data per locale |
| `defaultLocale` | `TLocale`                  | The initial active locale   |

### Service Properties

| Property          | Type                                    | Description                                 |
| ----------------- | --------------------------------------- | ------------------------------------------- |
| `t(key, params?)` | `(key, params?) => ComputedRef<string>` | Translate a key with optional params        |
| `locale`          | `Ref<TLocale>`                          | Current locale — assign to switch languages |

### Translation Schema

Translations must be a two-level nested object:

```typescript
{
  section: {
    key: "Translation string with optional {param} placeholders";
  }
}
```

Section names and key names must not contain dots (the dot is the separator in `t("section.key")`).
