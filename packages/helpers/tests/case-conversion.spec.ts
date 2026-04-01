import { toCamelCaseTyped, deepCamelKeys, deepSnakeKeys } from "../src";
import { describe, expect, it } from "vitest";

describe("toCamelCaseTyped", () => {
  it("should convert snake_case keys to camelCase", () => {
    const input = { first_name: "John", last_name: "Doe" };

    const result = toCamelCaseTyped<{ firstName: string; lastName: string }>(input);

    expect(result).toEqual({ firstName: "John", lastName: "Doe" });
  });

  it("should handle nested objects", () => {
    const input = { user_data: { first_name: "John" } };

    const result = toCamelCaseTyped<{ userData: { firstName: string } }>(input);

    expect(result).toEqual({ userData: { firstName: "John" } });
  });

  it("should handle already camelCase data", () => {
    const input = { firstName: "John" };

    const result = toCamelCaseTyped<{ firstName: string }>(input);

    expect(result).toEqual({ firstName: "John" });
  });
});

describe("re-exports", () => {
  it("should re-export deepCamelKeys from string-ts", () => {
    expect(typeof deepCamelKeys).toBe("function");
    expect(deepCamelKeys({ snake_case: 1 })).toEqual({ snakeCase: 1 });
  });

  it("should re-export deepSnakeKeys from string-ts", () => {
    expect(typeof deepSnakeKeys).toBe("function");
    expect(deepSnakeKeys({ camelCase: 1 })).toEqual({ camel_case: 1 });
  });
});
