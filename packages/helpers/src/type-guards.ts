/**
 * Type guard that checks if an object has an `id` property,
 * distinguishing existing resources from new ones.
 */
export const isExisting = <T extends { id: number }>(obj: T | Omit<T, "id">): obj is T =>
  "id" in obj;
