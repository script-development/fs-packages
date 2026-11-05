/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
    testRunner: 'vitest',
    vitest: {configFile: 'vitest.config.ts'},
    // Every branchy .ts the package ships (WR-0897): the form code, the listbox composable and the
    // internal helpers; and the components' <script setup>, minus the Vue macro arguments Stryker
    // cannot instrument yet (see stryker-vue-macros.mjs).
    mutate: [
        'src/form/**/*.ts',
        '!src/form/types.ts',
        'src/composables/**/*.ts',
        'src/internal/**/*.ts',
        'src/components/**/*.vue',
    ],
    plugins: ['@stryker-mutator/*', './stryker-vue-macros.mjs'],
    ignorers: ['vue-macros'],
    thresholds: {high: 95, low: 90, break: 90},
    reporters: ['clear-text', 'progress', 'json', 'html'],
    jsonReporter: {fileName: 'reports/mutation/mutation.json'},
    htmlReporter: {fileName: 'reports/mutation/mutation.html'},
    incremental: true,
    incrementalFile: '.stryker-incremental.json',
    cleanTempDir: 'always',
};
