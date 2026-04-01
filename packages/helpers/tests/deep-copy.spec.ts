import { deepCopy } from "../src";
import { describe, expect, it } from "vitest";

describe("deepCopy", () => {
  it("should return primitives as-is", () => {
    expect(deepCopy(42)).toBe(42);
    expect(deepCopy("hello")).toBe("hello");
    expect(deepCopy(true)).toBe(true);
    expect(deepCopy(null)).toBeNull();
    expect(deepCopy(undefined)).toBeUndefined();
  });

  it("should deep copy plain objects", () => {
    const original = { a: 1, b: { c: 2 } };

    const copy = deepCopy(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.b).not.toBe(original.b);
  });

  it("should deep copy arrays", () => {
    const original = [1, [2, 3], { a: 4 }];

    const copy = deepCopy(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy[1]).not.toBe(original[1]);
    expect(copy[2]).not.toBe(original[2]);
  });

  it("should deep copy Date instances", () => {
    const original = new Date("2026-01-01");

    const copy = deepCopy(original);

    expect(copy).toEqual(original);
    expect(copy).not.toBe(original);
    expect(copy.getTime()).toBe(original.getTime());
  });

  it("should deep copy nested objects with arrays", () => {
    const original = { items: [{ id: 1, name: "test" }], count: 1 };

    const copy = deepCopy(original);

    expect(copy).toEqual(original);
    expect(copy.items).not.toBe(original.items);
    expect(copy.items[0]).not.toBe(original.items[0]);
  });

  it("should handle empty objects", () => {
    expect(deepCopy({})).toEqual({});
  });

  it("should handle empty arrays", () => {
    expect(deepCopy([])).toEqual([]);
  });

  it("should produce a mutable copy from readonly input", () => {
    const original = { a: 1, b: { c: 2 } } as const;

    const copy = deepCopy(original);
    copy.a = 99;
    copy.b.c = 99;

    expect(copy.a).toBe(99);
    expect(copy.b.c).toBe(99);
    expect(original.a).toBe(1);
  });
});
