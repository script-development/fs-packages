# fs-toast

Component-agnostic toast notification queue.

```bash
npm install @script-development/fs-toast
```

**Peer dependencies:** `vue ^3.5.0`

## What It Does

`fs-toast` manages a FIFO queue of toast notifications — it handles ordering, limits, and cleanup. You provide your own Vue component for how toasts look. The service manages when they appear and disappear; your component manages what they look like.

## Basic Usage

### 1. Create Your Toast Component

```vue
<!-- MyToast.vue -->
<script setup lang="ts">
defineProps<{
  message: string;
  type: "success" | "error" | "info";
  onClose: () => void; // injected automatically by the service
}>();
</script>

<template>
  <div :class="['toast', `toast--${type}`]">
    {{ message }}
    <button @click="onClose">×</button>
  </div>
</template>
```

The service automatically injects an `onClose` prop that removes the toast from the queue.

### 2. Create the Service

```typescript
import { createToastService } from "@script-development/fs-toast";
import MyToast from "@/components/MyToast.vue";

const toast = createToastService(MyToast);
```

### 3. Mount the Container

Mount the container component once in your app root:

```vue
<!-- App.vue -->
<template>
  <div id="app">
    <router-view />
    <toast.ToastContainerComponent />
  </div>
</template>
```

### 4. Show Toasts

```typescript
// Props are type-checked against your component (minus onClose)
toast.show({ message: "User saved", type: "success" });
toast.show({ message: "Something went wrong", type: "error" });
toast.show({ message: "New version available", type: "info" });
```

## Queue Behavior

Toasts are managed as a **FIFO queue** (first in, first out). When the maximum is exceeded, the oldest toast is removed:

```typescript
// Maximum 3 visible toasts at a time
const toast = createToastService(MyToast, 3);

toast.show({ message: "First" }); // visible: [First]
toast.show({ message: "Second" }); // visible: [First, Second]
toast.show({ message: "Third" }); // visible: [First, Second, Third]
toast.show({ message: "Fourth" }); // visible: [Second, Third, Fourth] — First removed
```

The default maximum is 4. The minimum is 1.

## Programmatic Dismissal

`show()` returns a unique ID that you can use to hide a specific toast:

```typescript
const id = toast.show({ message: "Processing...", type: "info" });

// Later: remove it programmatically
toast.hide(id);
```

## Type Safety

Props passed to `show()` are type-checked against your component's prop definitions (with `onClose` excluded since it's injected):

```typescript
// If your component defines: { message: string, type: "success" | "error" }

toast.show({ message: "OK", type: "success" }); // compiles
toast.show({ message: "OK", type: "warning" }); // compile error — "warning" not valid
toast.show({ title: "OK" }); // compile error — "title" doesn't exist
```

This catches toast-related bugs at build time, not at runtime.

## API Reference

### `createToastService(component, maxToasts?)`

| Parameter   | Type        | Description                                         |
| ----------- | ----------- | --------------------------------------------------- |
| `component` | `Component` | Your toast Vue component                            |
| `maxToasts` | `number`    | Maximum visible toasts (default: `4`, minimum: `1`) |

### Service Properties

| Property                  | Type                   | Description                     |
| ------------------------- | ---------------------- | ------------------------------- |
| `show(props)`             | `(props) => string`    | Show a toast, returns unique ID |
| `hide(id)`                | `(id: string) => void` | Remove a toast by ID            |
| `ToastContainerComponent` | `Component`            | Mount this in your app root     |
