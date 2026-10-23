import {defineConfig} from 'tsdown';
import Vue from 'unplugin-vue/rolldown';

import {baseConfig} from '../../tsdown.base.ts';

// First SFC-carrying package in the monorepo: the tsdown (rolldown) pipeline is kept
// so the dual-format dist contract (index.{mjs,cjs} + index.d.{mts,cts}) that
// validate:dist enforces still holds; unplugin-vue teaches it to compile `.vue`.
// tsdown auto-externalises dependencies + peerDependencies, so `vue` and the
// `@floating-ui/vue` runtime dep are left unbundled without an explicit list.
export default defineConfig({
    ...baseConfig,
    dts: {...baseConfig.dts, vue: true},
    plugins: [Vue({isProduction: true, template: {compilerOptions: {comments: false}}})],
});
