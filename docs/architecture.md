# Architecture

This page explains the design decisions behind the package collection. If you're looking for "how do I use this?" — start with [Getting Started](/getting-started). This page answers "why is it built this way?"

## The Factory Pattern

Every package exports a `createXxxService()` function that returns a plain object:

```typescript
const http = createHttpService("https://api.example.com");
const storage = createStorageService("myapp");
const loading = createLoadingService();
```

### Why not classes?

Classes create hidden coupling. When you `new` a class, you commit to an inheritance chain, a `this` binding, and often a global singleton pattern. Our factories return plain objects — there's no prototype chain, no `this` to lose, no base class to accidentally override.

```typescript
// What you get back is just an object with methods
const http = createHttpService("https://api.example.com");

// You can destructure it, pass individual methods around, or store it — no surprises
const { getRequest, postRequest } = http;
```

### Why not singletons?

Singletons are convenient until you need two instances. A factory lets you create as many instances as you need:

```typescript
// Two HTTP services pointing at different APIs
const apiHttp = createHttpService("https://api.example.com");
const authHttp = createHttpService("https://auth.example.com");

// Two storage services with different prefixes
const userStorage = createStorageService("user");
const cacheStorage = createStorageService("cache");
```

In testing, factories make setup trivial — create a fresh service per test, no global state to reset.

## Loose Coupling

Packages avoid importing each other directly. Instead, they define the **shape** of what they need and accept anything that matches.

### Structural Typing (Duck Types)

The clearest example is `fs-theme`. It needs something that can `get()` and `put()` values — but it doesn't care whether that's `fs-storage`, a wrapper around IndexedDB, or a mock:

```typescript
// fs-theme defines what it needs
interface ThemeStorageContract {
  get<T>(key: string): T | undefined;
  put(key: string, value: unknown): void;
}

// fs-storage happens to match — but theme doesn't import it
const storage = createStorageService("myapp");
const theme = createThemeService(storage); // works because the shape matches
```

::: tip What does this buy you?
In tests, you can pass a plain object instead of a real storage service:

```typescript
const fakeStorage = { get: () => undefined, put: () => {} };
const theme = createThemeService(fakeStorage);
```

No mocking library, no dependency injection framework. Just an object with the right shape.
:::

### Why peer dependencies?

When packages do depend on each other (like `fs-loading` using `fs-http`'s middleware), the dependency is declared as a **peer dependency**. This means:

1. Your application installs a single copy of each package
2. Packages share the same instance at runtime
3. There are no version conflicts from nested `node_modules`

```json
// fs-loading's package.json
{
  "peerDependencies": {
    "@script-development/fs-http": "^1.0.0",
    "vue": "^3.5.0"
  }
}
```

## Middleware Architecture

Several packages support **middleware** — functions you register to intercept and react to events. Every middleware registration returns an **unregister function** for clean teardown.

### The HTTP Middleware Pipeline

`fs-http` provides three middleware hooks that form a request lifecycle:

```typescript
const http = createHttpService("https://api.example.com");

// 1. Before the request goes out
const unregReq = http.registerRequestMiddleware((config) => {
  config.headers.set("Authorization", `Bearer ${token}`);
});

// 2. When a successful response comes back
const unregRes = http.registerResponseMiddleware((response) => {
  trackAnalytics(response.config.url, response.status);
});

// 3. When a request fails
const unregErr = http.registerResponseErrorMiddleware((error) => {
  if (error.response?.status === 401) {
    redirectToLogin();
  }
});

// Clean up when done
unregReq();
unregRes();
unregErr();
```

### Cross-Package Middleware Composition

The middleware system enables packages to compose without direct coupling. `fs-loading` doesn't modify `fs-http` — it hooks into it:

```typescript
import { createHttpService } from "@script-development/fs-http";
import { createLoadingService, registerLoadingMiddleware } from "@script-development/fs-loading";

const http = createHttpService("https://api.example.com");
const loading = createLoadingService();

// This registers request + response + error middleware on the HTTP service
const { unregister } = registerLoadingMiddleware(http, loading);

// Now loading.isLoading automatically reflects pending HTTP requests
// When done, clean up all three middleware registrations at once:
unregister();
```

The same pattern appears in `fs-dialog` (error middleware) and `fs-router` (navigation middleware).

### Why the unregister pattern?

In single-page applications, services outlive individual components. If a component registers middleware and then unmounts, those handlers must be cleaned up to prevent memory leaks and stale behavior:

```typescript
// In a Vue composable or component setup
const unregister = http.registerResponseErrorMiddleware((error) => {
  showErrorNotification(error);
});

// Clean up on unmount
onUnmounted(() => {
  unregister();
});
```

## Component Agnosticism

`fs-toast` and `fs-dialog` manage **state and lifecycle** — the queue, the stack, the open/close logic — but they don't render anything. You provide the Vue component, they handle the plumbing:

```typescript
import { createToastService } from "@script-development/fs-toast";
import MyToast from "@/components/MyToast.vue"; // YOUR component

const toast = createToastService(MyToast);

// Show a toast — props are type-checked against your component
toast.show({ message: "Saved", type: "success" });
```

### Why not built-in components?

Built-in UI components force design decisions on you — colors, animations, positioning, accessibility patterns. Our projects have different design systems. By separating the service (queue management, stack management, lifecycle) from the presentation (your component), each project gets the behavior without the opinions.

The service provides a `ContainerComponent` that you mount once in your app root:

```vue
<template>
  <div id="app">
    <router-view />
    <toast.ToastContainerComponent />
    <dialog.DialogContainerComponent />
  </div>
</template>
```

The container handles rendering, ordering, and cleanup. Your components handle how things look.

## Reactivity Model

Vue-dependent packages use Vue's reactivity primitives (`Ref`, `ComputedRef`, `readonly`) directly — no wrapper layer, no custom observable pattern:

```typescript
const loading = createLoadingService();

loading.isLoading; // ComputedRef<boolean> — use in templates, watch, computed
loading.activeCount; // DeepReadonly<Ref<number>> — readable but not writable
```

This means services integrate naturally with Vue's ecosystem:

```vue
<script setup lang="ts">
import { watch } from "vue";
import { loading } from "@/services";

// Standard Vue reactivity — nothing special
watch(loading.isLoading, (isLoading) => {
  document.title = isLoading ? "Loading..." : "My App";
});
</script>
```

### Why not Pinia?

Pinia is a global state management solution. These packages are **service factories** — they create isolated instances with their own encapsulated state. The difference matters:

- **Pinia store:** One global instance per store definition. Great for app-wide state.
- **Service factory:** Create as many instances as needed. Great for domain-scoped state and testability.

`fs-adapter-store` is the bridge — it provides the reactive state management pattern (like Pinia) but as composable, per-domain instances (like a factory).

## Type Safety

TypeScript isn't just for autocomplete — it catches entire categories of bugs at compile time.

### Router Type Safety

`fs-router` extracts route names from your route definitions and validates navigation calls:

```typescript
const routes = [
  createCrudRoutes("/users", "users", Layout, {
    overview: UsersList,
    create: UserCreate,
    edit: UserEdit,
  }),
];

const router = createRouterService(routes);

router.goToEditPage("users", 42); // compiles — "users" exists and has an edit page
router.goToEditPage("projects", 42); // compile error — "projects" is not a valid route
```

### Translation Type Safety

`fs-translation` validates keys against your translation schema:

```typescript
const translation = createTranslationService(
  {
    en: {
      common: { save: "Save", cancel: "Cancel" },
      users: { title: "Users", empty: "No users found" },
    },
  },
  "en",
);

translation.t("common.save"); // compiles — "common.save" exists
translation.t("common.delete"); // compile error — "common.delete" doesn't exist
```

## The Dependency Graph

Packages form a directed graph with foundation packages at the bottom and domain packages at the top:

```
                  ┌──────────────┐     ┌────────────┐
                  │ adapter-store│     │   router   │
                  └──┬──┬──┬──┬─┘     └────────────┘
                     │  │  │  │
          ┌──────────┘  │  │  └──────────┐
          │             │  │             │
   ┌──────┴───┐  ┌─────┴──┴──┐  ┌───────┴─────┐
   │  helpers  │  │  loading  │  │   storage   │
   └──────────┘  └─────┬─────┘  └─────────────┘
                       │
                 ┌─────┴─────┐
                 │    http   │
                 └───────────┘

   ┌────────┐  ┌────────┐  ┌─────────────┐  ┌───────┐
   │  theme │  │  toast │  │ translation │  │dialog │
   └────────┘  └────────┘  └─────────────┘  └───────┘
```

- **Foundation packages** (http, storage, helpers) have no Vue dependency
- **Service packages** (theme, loading, toast, dialog, translation) depend on Vue and optionally on foundation packages
- **Domain packages** (adapter-store, router) compose multiple services into higher-level patterns
- **Cross-cutting:** theme uses structural typing to accept a storage-shaped object without importing fs-storage
