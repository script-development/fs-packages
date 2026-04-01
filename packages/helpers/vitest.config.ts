import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "helpers",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      thresholds: {
        lines: 100,
        branches: 100,
        functions: 100,
        statements: 100,
      },
    },
  },
});
