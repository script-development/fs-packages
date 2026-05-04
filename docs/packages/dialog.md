# fs-dialog

Component-agnostic dialog stack with error middleware.

```bash
npm install @script-development/fs-dialog
```

**Peer dependencies:** `vue ^3.5.0`

## What It Does

`fs-dialog` manages a LIFO stack of modal dialogs. It handles stacking, backdrop behavior, scroll locking, and error capture. You provide your own Vue components — the service manages the lifecycle.

## Basic Usage

### 1. Create the Service

```typescript
import {createDialogService} from '@script-development/fs-dialog';

const dialog = createDialogService();
```

### 2. Mount the Container

```vue
<!-- App.vue -->
<template>
    <div id="app">
        <router-view />
        <dialog.DialogContainerComponent />
    </div>
</template>
```

### 3. Open Dialogs

```typescript
import ConfirmDialog from '@/components/ConfirmDialog.vue';

dialog.open(ConfirmDialog, {
    title: 'Delete user?',
    message: 'This action cannot be undone.',
    onConfirm: () => deleteUser(userId),
});
```

Props are type-checked against your component's definitions — same pattern as `fs-toast`.

## Stack Behavior

Dialogs are managed as a **LIFO stack** (last in, first out). Opening a new dialog pushes it on top of the stack:

```typescript
dialog.open(SettingsDialog, {
    /* ... */
}); // stack: [Settings]
dialog.open(ConfirmDialog, {
    /* ... */
}); // stack: [Settings, Confirm]

// Confirm is on top, Settings is behind it
```

Each dialog renders inside a native `<dialog>` element using `showModal()`, which provides:

- **Backdrop** — clicking outside the topmost dialog is detected
- **Scroll lock** — body scrolling is disabled while dialogs are open
- **Focus trapping** — keyboard focus stays within the dialog
- **ESC key handling** — managed by the service, not the browser default

## Closing Dialogs

### Close All

`closeAll()` clears the entire stack:

```typescript
dialog.closeAll();
```

### Close from Within

Your dialog component can close itself. A common pattern is to accept callback props:

```vue
<!-- ConfirmDialog.vue -->
<script setup lang="ts">
const props = defineProps<{title: string; message: string; onConfirm: () => void; onCancel: () => void}>();
</script>

<template>
    <div class="dialog">
        <h2>{{ title }}</h2>
        <p>{{ message }}</p>
        <button @click="onConfirm">Confirm</button>
        <button @click="onCancel">Cancel</button>
    </div>
</template>
```

```typescript
dialog.open(ConfirmDialog, {
    title: 'Delete?',
    message: 'This cannot be undone.',
    onConfirm: () => {
        deleteUser(userId);
        dialog.closeAll();
    },
    onCancel: () => dialog.closeAll(),
});
```

## Error Middleware

Errors thrown inside dialog components are caught via Vue's `onErrorCaptured`. You can register middleware to handle them:

```typescript
dialog.registerErrorMiddleware((error, {closeAll}) => {
    if (error instanceof ValidationError) {
        showValidationFeedback(error);
        return false; // stop propagation — error is handled
    }

    // return true to pass the error to the next middleware
    return true;
});
```

Multiple middleware handlers form a pipeline. Return `false` to stop propagation, `true` to pass the error to the next handler.

::: tip Combining with fs-http error middleware
A powerful pattern: register HTTP error middleware that opens an error dialog, and register dialog error middleware that handles errors within dialogs. The two systems compose naturally:

```typescript
// HTTP errors → open error dialog
http.registerResponseErrorMiddleware((error) => {
    if (error.response?.status === 403) {
        dialog.open(ForbiddenDialog, {message: 'Access denied'});
    }
});

// Errors inside dialogs → handle gracefully
dialog.registerErrorMiddleware((error, {closeAll}) => {
    console.error('Dialog error:', error);
    closeAll();
    return false;
});
```

:::

## Async Components

Dialog content is wrapped in `<Suspense>`, so you can use async setup in your dialog components:

```typescript
// Lazy-loaded dialog — only fetched when opened
dialog.open(
    defineAsyncComponent(() => import('@/components/HeavyDialog.vue')),
    {id: 42},
);
```

## v-model Synchronization

The service supports `v-model` prop updates — if your dialog emits `update:modelValue` events, the internal state stays in sync.

## Accessibility — Host ARIA Attributes

Native `<dialog>` elements need an accessible name (and usually a description) so screen readers announce more than a generic "dialog". `dialog.open()` accepts a third options arg that applies ARIA attributes directly to the host `<dialog>` element — your inner component does not need to walk `closest('dialog')` from a template ref.

```typescript
dialog.open(
    ConfirmDialog,
    {title: 'Delete user?', message: 'This action cannot be undone.'},
    {ariaLabelledBy: 'confirm-dialog-title', ariaDescribedBy: 'confirm-dialog-message'},
);
```

```vue
<!-- ConfirmDialog.vue — the ids match the host attributes above -->
<template>
    <div>
        <h2 id="confirm-dialog-title">{{ title }}</h2>
        <p id="confirm-dialog-message">{{ message }}</p>
    </div>
</template>
```

For dialogs without a visible title element, use `ariaLabel` instead:

```typescript
dialog.open(
    IconOnlyDialog,
    {
        /* … */
    },
    {ariaLabel: 'Delete confirmation'},
);
```

All three options are independent and optional — pass any combination. Options omitted leave the corresponding attribute off the `<dialog>` element entirely (no empty-string attributes).

## API Reference

### `createDialogService()`

Returns a dialog service. No parameters.

### Service Properties

| Property                           | Type                                                      | Description                  |
| ---------------------------------- | --------------------------------------------------------- | ---------------------------- |
| `open(component, props, options?)` | `(component, props, options?: DialogOpenOptions) => void` | Push a dialog onto the stack |
| `closeAll()`                       | `() => void`                                              | Clear the entire stack       |
| `registerErrorMiddleware(handler)` | `(handler) => UnregisterMiddleware`                       | Register an error handler    |
| `DialogContainerComponent`         | `Component`                                               | Mount this in your app root  |

### `DialogOpenOptions`

```typescript
interface DialogOpenOptions {
    ariaLabel?: string; // sets aria-label on the host <dialog>
    ariaLabelledBy?: string; // sets aria-labelledby on the host <dialog>
    ariaDescribedBy?: string; // sets aria-describedby on the host <dialog>
}
```

### Error Handler Signature

```typescript
type DialogErrorHandler = (error: Error, context: {closeAll: () => void}) => boolean; // false = handled, true = pass to next handler
```
