# fs-helpers

Tree-shakeable utility functions: deep copy, type guards, and case conversion.

```bash
npm install @script-development/fs-helpers
```

## What It Does

`fs-helpers` provides a small set of utility functions used across multiple packages and applications. Every function is individually importable — your bundler only includes what you use.

## Deep Copy

Creates a deep clone of objects, arrays, and dates. Faster than `structuredClone` for typical application data:

```typescript
import { deepCopy } from "@script-development/fs-helpers";

const original = {
  name: "Alice",
  roles: ["admin", "editor"],
  createdAt: new Date(),
};

const copy = deepCopy(original);
copy.roles.push("viewer");

original.roles; // ["admin", "editor"] — unchanged
copy.roles;     // ["admin", "editor", "viewer"]
```

### Writable Types

`deepCopy` returns a `Writable<T>` type — the same shape as the input but with all `readonly` modifiers removed. This is useful when you need a mutable copy of a readonly object:

```typescript
interface User {
  readonly id: number;
  readonly name: string;
}

const user: User = { id: 1, name: "Alice" };
const mutable = deepCopy(user);
mutable.name = "Bob"; // allowed — Writable<User> removes readonly
```

::: warning Supported types
`deepCopy` handles primitives, plain objects, arrays, Date, and null. It does **not** handle Map, Set, RegExp, functions, or circular references. For those cases, use `structuredClone`.
:::

## Type Guards

### isExisting

Checks whether an object has an `id` property — useful for distinguishing between new (unsaved) and existing (saved) domain objects:

```typescript
import { isExisting } from "@script-development/fs-helpers";

interface User {
  id: number;
  name: string;
}

type NewUser = Omit<User, "id">;

function saveUser(user: User | NewUser) {
  if (isExisting(user)) {
    // TypeScript knows: user is User (has id)
    updateUser(user.id, user);
  } else {
    // TypeScript knows: user is NewUser (no id)
    createUser(user);
  }
}
```

## Case Conversion

Convert between `camelCase` and `snake_case` with full type safety:

```typescript
import { toCamelCaseTyped, deepCamelKeys, deepSnakeKeys } from "@script-development/fs-helpers";
```

### toCamelCaseTyped

Converts a `snake_case` object to `camelCase` with preserved TypeScript types:

```typescript
interface User {
  firstName: string;
  lastName: string;
  createdAt: string;
}

// API returns snake_case
const apiResponse = { first_name: "Alice", last_name: "Smith", created_at: "2026-01-01" };

const user = toCamelCaseTyped<User>(apiResponse);
// { firstName: "Alice", lastName: "Smith", createdAt: "2026-01-01" }
// Typed as User — not Record<string, unknown>
```

### deepCamelKeys / deepSnakeKeys

Deep conversion for nested objects (re-exported from [string-ts](https://github.com/gustavoguichard/string-ts)):

```typescript
const apiData = {
  user_name: "Alice",
  user_settings: {
    dark_mode: true,
    font_size: 14,
  },
};

const camelData = deepCamelKeys(apiData);
// { userName: "Alice", userSettings: { darkMode: true, fontSize: 14 } }

const snakeData = deepSnakeKeys(camelData);
// Back to { user_name: "Alice", user_settings: { dark_mode: true, font_size: 14 } }
```

## API Reference

### Functions

| Function | Signature | Description |
|----------|-----------|-------------|
| `deepCopy` | `<T>(toCopy: T) => Writable<T>` | Deep clone for objects, arrays, dates |
| `isExisting` | `<T extends {id: number}>(obj) => obj is T` | Type guard for objects with an `id` |
| `toCamelCaseTyped` | `<T extends object>(data) => T` | Type-safe snake_case to camelCase |
| `deepCamelKeys` | `(obj) => DeepCamelKeys` | Deep snake_case to camelCase |
| `deepSnakeKeys` | `(obj) => DeepSnakeKeys` | Deep camelCase to snake_case |

### Types

| Type | Description |
|------|-------------|
| `Writable<T>` | Removes all `readonly` modifiers from `T` |
| `DeepSnakeKeys<T>` | Recursively converts keys to snake_case |
