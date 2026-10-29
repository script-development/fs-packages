import Vue from '@vitejs/plugin-vue';
import {playwright} from '@vitest/browser-playwright';
import {defineConfig} from 'vitest/config';

// Browser-mode test layer (real Chromium via the Playwright provider) — deliberately OUTSIDE
// the workspace glob (vitest.workspace.ts matches `packages/*/vitest.config.ts`, and the
// happy-dom project config excludes `tests/browser/**`), so the default root `vitest run`
// never picks these specs up. Run via the root `npm run test:browser` script.
//
// Scope: contract + interaction only — computed-style `--ui-*` assertions, real-CDP event
// walks, floating-ui positioning, and axe audits. Unit behaviour stays in the happy-dom
// suite, which also owns the 100% coverage gate — no coverage thresholds here.
export default defineConfig({
    // Anchor the project root here: the config is invoked from the monorepo root
    // (`npm run test:browser` passes --config), and vitest resolves `include` against
    // the CWD root, not the config file's directory.
    root: import.meta.dirname,
    plugins: [Vue()],
    test: {
        name: 'ui-form-browser',
        include: ['tests/browser/**/*.browser.spec.ts'],
        // Spec files must run SERIALLY: the suite asserts real `:focus-visible` state, and a
        // parallel sibling page holding OS focus makes the focused document inactive — the
        // focus ring then legitimately never computes (observed: styles.browser.spec.ts focus
        // test failing in the full run, green in isolation). A few small files; cost is seconds.
        fileParallelism: false,
        browser: {enabled: true, headless: true, provider: playwright(), instances: [{browser: 'chromium'}]},
    },
});
