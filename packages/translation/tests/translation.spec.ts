import { createTranslationService } from "../src/index";
import { describe, expect, it } from "vitest";

const translations = {
  en: {
    common: { save: "Save", cancel: "Cancel" },
    errors: {
      required: "{field} is required",
      minLength: "{field} must be at least {min} characters",
    },
    social: { invited: "{name} invited {name}" },
  },
  nl: {
    common: { save: "Opslaan", cancel: "Annuleren" },
    errors: {
      required: "{field} is verplicht",
      minLength: "{field} moet minimaal {min} tekens bevatten",
    },
    social: { invited: "{name} heeft {name} uitgenodigd" },
  },
} as const;

describe("translation service", () => {
  describe("createTranslationService", () => {
    it("should return t function and locale ref", () => {
      // Act
      const service = createTranslationService(translations, "en");

      // Assert
      expect(service).toHaveProperty("t");
      expect(service).toHaveProperty("locale");
    });

    it("should set default locale", () => {
      // Act
      const service = createTranslationService(translations, "nl");

      // Assert
      expect(service.locale.value).toBe("nl");
    });
  });

  describe("t", () => {
    it("should return computed with translation for given key", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const result = t("common.save");

      // Assert
      expect(result.value).toBe("Save");
    });

    it("should return translation for nested keys", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const result = t("errors.required", { field: "Name" });

      // Assert
      expect(result.value).toBe("Name is required");
    });

    it("should interpolate multiple params", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const result = t("errors.minLength", { field: "Password", min: "8" });

      // Assert
      expect(result.value).toBe("Password must be at least 8 characters");
    });

    it("should replace all occurrences of the same parameter", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const result = t("social.invited", { name: "Alice" });

      // Assert
      expect(result.value).toBe("Alice invited Alice");
    });

    it("should update reactively when locale changes", () => {
      // Arrange
      const { t, locale } = createTranslationService(translations, "en");
      const save = t("common.save");

      // Assert initial value
      expect(save.value).toBe("Save");

      // Act
      locale.value = "nl";

      // Assert updated value
      expect(save.value).toBe("Opslaan");
    });

    it("should update interpolated translations when locale changes", () => {
      // Arrange
      const { t, locale } = createTranslationService(translations, "en");
      const required = t("errors.required", { field: "Email" });

      // Assert initial value
      expect(required.value).toBe("Email is required");

      // Act
      locale.value = "nl";

      // Assert updated value
      expect(required.value).toBe("Email is verplicht");
    });

    it("should return key when section does not exist", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act - cast to bypass type checking for testing runtime behavior
      const result = t("nonexistent.key" as "common.save");

      // Assert
      expect(result.value).toBe("nonexistent.key");
    });

    it("should return key when translation name does not exist", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act - cast to bypass type checking for testing runtime behavior
      const result = t("common.nonexistent" as "common.save");

      // Assert
      expect(result.value).toBe("common.nonexistent");
    });

    it("should return key when key has no dot separator", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act - cast to bypass type checking for testing runtime behavior
      const result = t("nodot" as "common.save");

      // Assert
      expect(result.value).toBe("nodot");
    });

    it("should return key when key has multiple dots", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act - cast to bypass type checking for testing runtime behavior
      const result = t("too.many.dots" as "common.save");

      // Assert
      expect(result.value).toBe("too.many.dots");
    });
  });

  describe("locale", () => {
    it("should be a reactive ref", () => {
      // Arrange
      const { locale } = createTranslationService(translations, "en");

      // Act
      locale.value = "nl";

      // Assert
      expect(locale.value).toBe("nl");
    });
  });

  describe("type safety", () => {
    it("should enforce all locales have the same structure", () => {
      // Type safety: Record<TLocale, TSchema> ensures all locales share the same structure.
      // Mismatched structures (e.g., nl having extra keys) would cause a TypeScript error.
      const validTranslations = {
        en: { common: { save: "Save" } },
        nl: { common: { save: "Opslaan" } },
      } as const;

      const { t } = createTranslationService(validTranslations, "en");
      expect(t("common.save").value).toBe("Save");
    });

    it("should only allow keys with exactly two parts (section.name)", () => {
      // The NoDot<S> type ensures section and key names cannot contain dots.
      // This prevents keys like "a.b.c" at compile time by rejecting:
      // - Section names with dots (e.g., "common.nested")
      // - Key names with dots (e.g., "save.now")
      // Keys must be exactly "section.name" format with no extra dots.
      const { t } = createTranslationService(translations, "en");
      expect(t("common.save").value).toBe("Save");
    });
  });

  describe("missing locale data", () => {
    it("should return key when locale data section is missing", () => {
      // Arrange — switch to a locale that doesn't have the section
      const sparse = {
        en: { common: { save: "Save" }, errors: { required: "{field} is required" } },
        nl: { common: { save: "Opslaan" }, errors: { required: "{field} is verplicht" } },
      } as const;

      const { t, locale } = createTranslationService(sparse, "en");

      // Act — request a key from a section that exists
      const result = t("common.save");
      expect(result.value).toBe("Save");

      // Switch to a hypothetical locale with missing data (cast to bypass types)
      locale.value = "fr" as "en";

      // Assert — returns the key as fallback
      expect(result.value).toBe("common.save");
    });
  });

  describe("memoization", () => {
    it("should return the same computed ref for the same key", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const first = t("common.save");
      const second = t("common.save");

      // Assert
      expect(first).toBe(second);
    });

    it("should return different computed refs for different keys", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const save = t("common.save");
      const cancel = t("common.cancel");

      // Assert
      expect(save).not.toBe(cancel);
    });

    it("should return the same computed ref for the same key and params", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");
      const params = { field: "Name" };

      // Act
      const first = t("errors.required", params);
      const second = t("errors.required", params);

      // Assert
      expect(first).toBe(second);
    });

    it("should return different computed refs for same key with different params", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const nameRequired = t("errors.required", { field: "Name" });
      const emailRequired = t("errors.required", { field: "Email" });

      // Assert
      expect(nameRequired).not.toBe(emailRequired);
      expect(nameRequired.value).toBe("Name is required");
      expect(emailRequired.value).toBe("Email is required");
    });

    it("should return different computed refs for same key with and without params", () => {
      // Arrange
      const { t } = createTranslationService(translations, "en");

      // Act
      const withParams = t("errors.required", { field: "Name" });
      const withoutParams = t("errors.required");

      // Assert
      expect(withParams).not.toBe(withoutParams);
    });
  });
});
