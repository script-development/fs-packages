import {PluginKind, declareValuePlugin} from '@stryker-mutator/api/plugin';

// The Vue compiler macros whose arguments the SFC compiler hoists out of setup(). A mutant inside one
// lands in module scope, away from Stryker's helpers, and the component no longer compiles
// (stryker-mutator/stryker-js#6178). Their arguments are skipped; everything else in <script setup>
// is mutated. When Stryker places these mutants itself, this ignorer goes and they are reported.
const MACROS = new Set(['defineProps', 'defineEmits', 'defineModel', 'defineOptions', 'defineSlots', 'withDefaults']);

const isMacroCall = (node) =>
    node?.type === 'CallExpression' && node.callee.type === 'Identifier' && MACROS.has(node.callee.name);

// A mutant belongs to a macro when it sits in the call (or is the call's own statement), or in the
// destructure the call initialises: `const {type = 'text'} = defineProps()` hoists those defaults too.
const inMacro = (path) =>
    Boolean(
        path.find(
            (current) =>
                isMacroCall(current.node) ||
                (current.isExpressionStatement() && isMacroCall(current.node.expression)) ||
                (current.isVariableDeclarator() && isMacroCall(current.node.init)),
        ),
    );

export const strykerPlugins = [
    declareValuePlugin(PluginKind.Ignore, 'vue-macros', {
        shouldIgnore: (path) => (inMacro(path) ? 'Vue compiler macro arguments are hoisted out of setup()' : undefined),
    }),
];
