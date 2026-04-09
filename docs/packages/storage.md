# fs-storage

localStorage service factory with prefix namespacing.

```bash
npm install @script-development/fs-storage
```

## What It Does

`fs-storage` wraps `localStorage` in a service that namespaces all keys under a prefix. This prevents key collisions when multiple applications or modules share the same browser storage.

## Basic Usage

```typescript
import { createStorageService } from "@script-development/fs-storage";

const storage = createStorageService("myapp");

// Stores as "myapp:username" in localStorage
storage.put("username", "Alice");

// Retrieves from "myapp:username"
const name = storage.get<string>("username"); // "Alice"

// Remove a single key
storage.remove("username");

// Remove all keys with this prefix
storage.clear();
```

## Automatic Serialization

The service handles JSON serialization automatically. You can store any value that's JSON-serializable:

```typescript
// Objects and arrays are JSON-stringified on put, parsed on get
storage.put("settings", { theme: "dark", language: "en" });
const settings = storage.get<Settings>("settings"); // { theme: "dark", language: "en" }

// Numbers, booleans, arrays — all work
storage.put("count", 42);
storage.put("enabled", true);
storage.put("tags", ["admin", "editor"]);
```

## Default Values

The `get` method accepts a default value that is returned when the key doesn't exist:

```typescript
// Returns "guest" if "role" hasn't been stored
const role = storage.get("role", "guest"); // "guest"
```

::: tip Smart parsing behavior
When you pass a **string** default value, the stored value is returned as a raw string (no JSON parsing). When you pass a **non-string** default or no default, the service attempts to JSON-parse the stored value. This lets you store and retrieve both plain strings and complex objects predictably.
:::

## Prefix Namespacing

The prefix is prepended to every key with a `:` separator:

```typescript
const userStorage = createStorageService("user");
const cacheStorage = createStorageService("cache");

userStorage.put("name", "Alice");  // localStorage key: "user:name"
cacheStorage.put("name", "stale"); // localStorage key: "cache:name"

userStorage.get("name");  // "Alice"
cacheStorage.get("name"); // "stale"

// clear() only removes keys with the matching prefix
userStorage.clear();  // removes "user:*", leaves "cache:*" intact
```

This is particularly useful when:
- Multiple apps run on the same domain
- Different features store data independently
- You want to clear one feature's cache without affecting others

## Used By Other Packages

`fs-storage` provides the storage shape that other packages accept. For example, `fs-theme` needs a storage contract — and `fs-storage` matches it naturally:

```typescript
import { createStorageService } from "@script-development/fs-storage";
import { createThemeService } from "@script-development/fs-theme";

const storage = createStorageService("myapp");
const theme = createThemeService(storage);
// Theme preference is persisted under "myapp:theme"
```

`fs-adapter-store` also uses storage for offline persistence of domain state.

## API Reference

### `createStorageService(prefix)`

| Parameter | Type | Description |
|-----------|------|-------------|
| `prefix` | `string` | Required. Prepended to all keys as `prefix:key` |

### Service Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `put(key, value)` | `void` | Store a value (JSON-stringified if not a string) |
| `get<T>(key)` | `T \| undefined` | Retrieve a value, attempting JSON parse |
| `get<T>(key, defaultValue)` | `T` | Retrieve with fallback default |
| `remove(key)` | `void` | Remove a single key |
| `clear()` | `void` | Remove all keys with this prefix |
