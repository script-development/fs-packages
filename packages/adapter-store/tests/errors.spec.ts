import { EntryNotFoundError, MissingResponseDataError } from "../src/errors";
import { describe, expect, it } from "vitest";

describe("EntryNotFoundError", () => {
  it("should create error with correct message", () => {
    // Act
    const error = new EntryNotFoundError("users", 42);

    // Assert
    expect(error.message).toBe("users with id 42 not found");
    expect(error.name).toBe("EntryNotFoundError");
  });

  it("should be an instance of Error", () => {
    // Act
    const error = new EntryNotFoundError("items", 1);

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(EntryNotFoundError);
  });
});

describe("MissingResponseDataError", () => {
  it("should create error with correct message", () => {
    // Act
    const error = new MissingResponseDataError("No data returned");

    // Assert
    expect(error.message).toBe("No data returned");
    expect(error.name).toBe("MissingResponseDataError");
  });

  it("should be an instance of Error", () => {
    // Act
    const error = new MissingResponseDataError("test");

    // Assert
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(MissingResponseDataError);
  });
});
