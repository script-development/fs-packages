/**
 * Retrieve a value from storage.
 *
 * @remarks
 * Parsing behavior depends on the default value type:
 * - No default or non-string default: Attempts JSON.parse, falls back to raw string on failure
 * - String default: Returns the raw stored string without JSON parsing
 *
 * This prevents unintended conversions (e.g., stored "5e3" becoming number 5000).
 *
 * @example
 * ```ts
 * storage.put('key', '5e3');
 * storage.get('key');           // Returns number 5000 (JSON parsed)
 * storage.get('key', '');       // Returns string "5e3" (raw)
 * ```
 */
export interface Get {
  <T>(key: string): T | undefined;
  <T>(key: string, defaultValue: T): T;
}

export interface StorageService {
  put: (key: string, value: unknown) => void;
  get: Get;
  remove: (key: string) => void;
  clear: () => void;
}
