/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    testRunner: 'vitest',
    vitest: {configFile: 'vitest.config.ts'},
    // Every branchy .ts the package ships (WR-0897): the form code, the listbox composable and the
    // internal helpers. The .vue components are covered by the coverage gate and the browser suite.
    mutate: ['src/form/**/*.ts', '!src/form/types.ts', 'src/composables/**/*.ts', 'src/internal/**/*.ts'],
    thresholds: {high: 95, low: 90, break: 90},
    reporters: ['clear-text', 'progress', 'json', 'html'],
    jsonReporter: {fileName: 'reports/mutation/mutation.json'},
    htmlReporter: {fileName: 'reports/mutation/mutation.html'},
    incremental: true,
    incrementalFile: '.stryker-incremental.json',
    cleanTempDir: 'always',
};
