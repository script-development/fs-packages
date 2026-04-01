import type { DeepSnakeKeys } from "string-ts";

import { deepCamelKeys, deepSnakeKeys } from "string-ts";

export { deepCamelKeys, deepSnakeKeys };

/**
 * Convert a snake_case API response to the camelCase generic T.
 *
 * Runtime transformation via `deepCamelKeys` aligns keys with T's shape;
 * the cast is safe because the transformation is exhaustive.
 */
export const toCamelCaseTyped = <T extends object>(data: T | DeepSnakeKeys<T>): T =>
  deepCamelKeys(data) as unknown as T;
