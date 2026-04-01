import { isExisting } from "../src";
import { describe, expect, it } from "vitest";

describe("isExisting", () => {
  it("should return true for objects with an id", () => {
    expect(isExisting({ id: 1, name: "test" })).toBe(true);
  });

  it("should return false for objects without an id", () => {
    expect(isExisting({ name: "test" })).toBe(false);
  });

  it("should narrow the type correctly", () => {
    const item: { id: number; name: string } | { name: string } = { id: 1, name: "test" };

    if (isExisting(item)) {
      // TypeScript should narrow to the type with id
      expect(item.id).toBe(1);
    }
  });
});
