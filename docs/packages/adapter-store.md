# fs-adapter-store

Reactive state management with CRUD resource adapters.

```bash
npm install @script-development/fs-adapter-store
```

**Peer dependencies:** `vue ^3.5.0`, `@script-development/fs-http ^1.0.0`, `@script-development/fs-storage ^1.0.0`, `@script-development/fs-loading ^1.0.0`, `@script-development/fs-helpers ^1.0.0`

## What It Does

`fs-adapter-store` is the domain layer package. It provides reactive, per-domain state management with built-in CRUD operations. Think of it as a lightweight alternative to Pinia that's designed for REST API resources — it fetches data, stores it reactively, and gives you adapted objects with `update()`, `patch()`, `delete()`, and `create()` methods.

## The Big Picture

A typical application has domain resources — users, projects, invoices — that need to be:
1. **Fetched** from an API
2. **Stored** in reactive state
3. **Displayed** in components
4. **Edited** through forms
5. **Saved** back to the API

`fs-adapter-store` handles all of this with a single `createAdapterStoreModule()` call per resource.

## Basic Usage

### 1. Define Your Domain Type

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "editor" | "viewer";
}
```

### 2. Create the Store Module

```typescript
import { createAdapterStoreModule, resourceAdapter } from "@script-development/fs-adapter-store";
import { http, storage, loading } from "@/services";

const usersStore = createAdapterStoreModule<User>({
  domainName: "users",           // API endpoint: /users
  adapter: resourceAdapter,       // CRUD adapter factory
  httpService: http,              // for API calls
  storageService: storage,        // for offline persistence
  loadingService: loading,        // for waiting on data
});
```

### 3. Fetch and Display

```typescript
// Fetch all users from the API
await usersStore.retrieveAll();

// Reactive list of all users
const allUsers = usersStore.getAll; // ComputedRef<Adapted<User>[]>
```

```vue
<script setup lang="ts">
import { usersStore } from "@/stores";
</script>

<template>
  <ul>
    <li v-for="user in usersStore.getAll.value" :key="user.id">
      {{ user.name }} — {{ user.email }}
    </li>
  </ul>
</template>
```

### 4. Edit and Save

Each adapted resource has a `mutable` ref for editing and methods for saving:

```vue
<script setup lang="ts">
const user = usersStore.getById(42); // ComputedRef<Adapted<User> | undefined>
</script>

<template>
  <form v-if="user.value" @submit.prevent="user.value.update()">
    <input v-model="user.value.mutable.value.name" />
    <input v-model="user.value.mutable.value.email" />
    <button type="submit">Save</button>
    <button type="button" @click="user.value.reset()">Reset</button>
  </form>
</template>
```

### 5. Create New Resources

```typescript
const newUser = usersStore.generateNew();

newUser.mutable.value.name = "Alice";
newUser.mutable.value.email = "alice@example.com";

await newUser.create(); // POST /users → adds to store
```

## Adapted vs NewAdapted

The adapter pattern creates two distinct object types:

### Adapted (Existing Resources)

When a resource comes from the API (has an `id`), it's wrapped in an `Adapted` object:

```typescript
const user = usersStore.getById(1).value;

// Read original values (readonly, frozen)
user.id;    // 1
user.name;  // "Alice"
user.email; // "alice@example.com"

// Edit via mutable ref
user.mutable.value.name = "Bob";

// Save changes
await user.update();  // PUT /users/1 — sends full object
await user.patch({ name: "Bob" }); // PATCH /users/1 — sends partial update

// Discard edits
user.reset(); // mutable reverts to original values

// Delete
await user.delete(); // DELETE /users/1 — removes from store
```

### NewAdapted (Unsaved Resources)

When you create a new resource via `generateNew()`, it's wrapped in a `NewAdapted` object:

```typescript
const newUser = usersStore.generateNew();

// Default values (readonly, frozen)
newUser.name;  // "" (empty defaults)
newUser.email; // ""

// Edit via mutable ref
newUser.mutable.value.name = "Alice";

// Save to API
await newUser.create(); // POST /users → returns full User with id

// Reset to defaults
newUser.reset();
```

::: tip Why two types?
An existing resource has `update()`, `patch()`, and `delete()`. A new resource has only `create()`. TypeScript enforces this — you can't accidentally call `delete()` on something that hasn't been saved yet.
:::

## Waiting for Data

`getOrFailById` waits for loading to complete before looking up the resource. This is useful when navigating to a detail page where data might still be loading:

```typescript
try {
  const user = await usersStore.getOrFailById(42);
  // user is guaranteed to exist
} catch (error) {
  if (error instanceof EntryNotFoundError) {
    // user 42 doesn't exist in the store
    redirectTo404();
  }
}
```

## Offline Persistence

The store automatically persists state to the provided storage service. When the page reloads, stored data is available immediately while `retrieveAll()` fetches fresh data from the API. This provides a fast initial render without loading spinners.

## Custom New Types

By default, `generateNew()` creates an object with all fields except `id`. You can customize this with a third type parameter:

```typescript
interface CreateUserData {
  name: string;
  email: string;
  // no role — assigned server-side
}

const usersStore = createAdapterStoreModule<User, Adapted<User, CreateUserData>, CreateUserData>({
  domainName: "users",
  adapter: resourceAdapter,
  httpService: http,
  storageService: storage,
  loadingService: loading,
});

const newUser = usersStore.generateNew();
// newUser.mutable has only name and email — no role field
```

## Error Handling

The package exports two error classes:

```typescript
import { EntryNotFoundError, MissingResponseDataError } from "@script-development/fs-adapter-store";
```

- **`EntryNotFoundError`** — thrown by `getOrFailById` when the resource doesn't exist in the store
- **`MissingResponseDataError`** — thrown when a CRUD response doesn't contain a `data` field

## API Reference

### `createAdapterStoreModule(config)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `config.domainName` | `string` | Resource endpoint name (e.g., `"users"`) |
| `config.adapter` | `Adapter` | CRUD adapter factory (use `resourceAdapter`) |
| `config.httpService` | `Pick<HttpService, "getRequest">` | HTTP service for fetching |
| `config.storageService` | `Pick<StorageService, "get" \| "put">` | Storage for persistence |
| `config.loadingService` | `Pick<LoadingService, "ensureLoadingFinished">` | Loading service for sync |

### Store Module Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getAll` | `ComputedRef<Adapted[]>` | Reactive list of all adapted resources |
| `getById(id)` | `ComputedRef<Adapted \| undefined>` | Reactive lookup by ID |
| `getOrFailById(id)` | `Promise<Adapted>` | Wait for loading, throw if not found |
| `generateNew()` | `NewAdapted` | Create a new unsaved resource |
| `retrieveAll()` | `Promise<void>` | Fetch all from API and update state |

### Adapted Properties

| Property | Type | Description |
|----------|------|-------------|
| *(all resource fields)* | `readonly` | Original values from API |
| `mutable` | `Ref<Writable<T>>` | Editable copy |
| `reset()` | `() => void` | Revert mutable to original |
| `update()` | `() => Promise<T>` | PUT full resource |
| `patch(partial)` | `(partial) => Promise<T>` | PATCH partial update |
| `delete()` | `() => Promise<void>` | DELETE resource |

### NewAdapted Properties

| Property | Type | Description |
|----------|------|-------------|
| *(all new fields)* | `readonly` | Default values |
| `mutable` | `Ref<Writable<N>>` | Editable copy |
| `reset()` | `() => void` | Revert mutable to defaults |
| `create()` | `() => Promise<T>` | POST to create resource |
