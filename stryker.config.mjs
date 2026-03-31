/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    testRunner: "vitest",
    vitest: {
        dir: "packages",
    },
    mutate: ["packages/*/src/**/*.ts", "!packages/*/src/**/types.ts"],
    thresholds: {
        high: 95,
        low: 90,
        break: 90,
    },
    reporters: ["clear-text", "html", "progress"],
    htmlReporter: {
        fileName: "reports/mutation/index.html",
    },
    incremental: true,
    incrementalFile: "reports/mutation/.incremental.json",
    cleanTempDir: "always",
};
