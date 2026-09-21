#!/usr/bin/env node
// Gate 6 (lint:pkg) enforcer — per-manifest publish-readiness assertions.
//
// 1. publint + attw — treats publint suggestions/warnings/errors as fatal.
//    publint 0.3.18 CLI does not expose a flag to fail on suggestions
//    (--strict only promotes warnings → errors). This wrapper fills that gap:
//    it runs publint per workspace, captures stdout, strips ANSI SGR codes,
//    and fails the gate if any package emits a "Suggestions:", "Warnings:", or
//    "Errors:" block. attw --pack runs after publint per package and preserves
//    its own exit code.
//    Motivated by enforcement queue #33 and the PR #35 regression: publint
//    suggestions about the "git+" URL prefix silently re-drifted across 10
//    packages because the gate tolerated them.
//
//    ANSI invariance (enforcement queue #63): publint colors its block headers
//    when it detects a color-capable environment (TTY or FORCE_COLOR). In CI,
//    publint emitted ANSI-wrapped headers (e.g. "\x1b[1m\x1b[34mSuggestions:\x1b[39m\x1b[22m"),
//    so PUBLINT_BLOCK_RE — anchored on a bare "Suggestions:" line — never matched
//    and the gate silently no-op'd (false-NEGATIVE: a real Warning/Error block
//    would have sailed through CI undetected). Verified against raw CI logs:
//    the gate had been a no-op in CI since publint 0.3.21 landed 2026-05-11,
//    while locally (plain-text, non-TTY) the regex matched and the gate fired
//    correctly. Fix: spawn publint with NO_COLOR=1 AND strip residual ANSI from
//    captured stdout before the regex match — belt-and-suspenders so the verdict
//    is identical in every color environment (plain, TTY, FORCE_COLOR=1).
//
// 2. engines.node presence — closes enforcement queue #31 (drift-prevention
//    gate, deployed 2026-05-12). Every workspace package.json AND the root
//    package.json must declare a non-empty `engines.node` string. Value is NOT
//    validated (presence-only — the queue-31 target is "any new package added
//    to the Armory ships with the declaration"; value alignment across the
//    corpus is a separate doctrine question). The declarations themselves
//    landed 2026-04-22 via commit 0605d99 — this gate prevents regression on
//    new packages and on edits that strip the field.
//
// 3. module-eval side-effect freedom — closes enforcement queue #93 (promotes
//    the `sideEffects:false` manifest claim landed by queue #70 / PR #101 from
//    an unenforced Level-4/Level-6 promise to a Level-1 gate). `sideEffects:
//    false` is a PACKAGE-GLOBAL bundler promise: a consumer's bundler assumes
//    NO module in the package has load-time side effects and may tree-shake any
//    module whose exports are unused. If a future author adds a top-level effect
//    (a bare `import './register'`, a module-eval `console.warn(...)`, an
//    `Object.defineProperty(...)`, a prototype patch), the manifest still says
//    `false`, the bundler drops the module, and the effect SILENTLY VANISHES at
//    the consumer with zero gate signal. This check parses every package source
//    module with the TypeScript compiler API (already a devDep — Gate 5 `tsc`,
//    no new dependency) and asserts the top-level statement list contains only
//    side-effect-free declaration kinds (imports WITH specifiers, re-exports,
//    type/function declarations, `const`/`let`/`var` whose INITIALIZER and
//    binding pattern are load-safe, `export default`/`export =` of a load-safe
//    expression, ambient-or-load-safe `namespace` declarations, and class
//    declarations with no definition-time member effect). A variable initializer
//    is load-safe iff it is a literal / function-or-class definition / reference
//    / pure construction (`new WeakMap()`) / a pure composition of those —
//    anything that INVOKES code at load (a call, IIFE, or assignment, e.g.
//    `export const x = register()`) FAILS, as does a bare ExpressionStatement, a
//    specifier-less import, top-level control flow, a destructuring default that
//    evaluates (`const {a = register()} = obj`), a class with a `static {}`
//    block / `static` field initializer / computed member name / decorator that
//    runs at class-definition time, a non-const `enum` with a call-bearing member
//    initializer (`enum E { A = side() }`), or a non-ambient `namespace` whose
//    body evaluates. A package whose `src/` yields zero readable source files also
//    fails (a vacuous assertion is not a pass). Scope is all source modules
//    (`.ts`/`.tsx`/`.mts`/`.cts`, declaration + test files excluded) under
//    `packages/*/src/**` — the correct match for a package-global flag (a side
//    effect in a non-re-exported imported module is still covered by the
//    bundler's assumption).

import {spawnSync} from 'node:child_process';
import {readdirSync, readFileSync, statSync} from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const PACKAGES_DIR = 'packages';
const ROOT_MANIFEST = 'package.json';
const PUBLINT_BLOCK_RE = /^(Suggestions|Warnings|Errors):$/m;
// SGR / ANSI escape sequences (CSI ... final-byte). publint wraps its block
// headers in these when color is enabled (CI default, FORCE_COLOR), which
// otherwise defeats PUBLINT_BLOCK_RE's bare-line anchors. See header note,
// enforcement queue #63.
const ANSI_RE = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, 'g');

const stripAnsi = (text) => text.replace(ANSI_RE, '');

const listPackageDirs = () =>
    readdirSync(PACKAGES_DIR)
        .map((name) => path.join(PACKAGES_DIR, name))
        .filter((dir) => {
            // A stray file in packages/ is legitimately not a package — skip it.
            // The dir statSync is intentionally uncaught: a race/EACCES on an entry
            // readdir just returned is a real I/O fault and must fail loud.
            if (!statSync(dir).isDirectory()) {
                return false;
            }
            try {
                return statSync(path.join(dir, 'package.json')).isFile();
            } catch (err) {
                // Only a genuinely-absent manifest (ENOENT) means "not a package".
                // EACCES / EIO / a transient race must NOT be swallowed into a skip
                // that silently drops a package from the gate.
                if (err.code === 'ENOENT') {
                    return false;
                }
                throw err;
            }
        })
        .sort();

const readManifest = (manifestPath) => JSON.parse(readFileSync(manifestPath, 'utf8'));

const packageName = (dir) => readManifest(path.join(dir, 'package.json')).name ?? dir;

const checkEnginesNode = (manifestPath, label) => {
    const pkg = readManifest(manifestPath);
    if (pkg.engines === undefined || pkg.engines === null) {
        return `${label}: engines field missing (queue #31 — engines.node presence required)`;
    }
    const node = pkg.engines.node;
    if (typeof node !== 'string' || node.trim() === '') {
        return `${label}: engines.node missing or not a non-empty string (queue #31)`;
    }
    return null;
};

// --- queue #93: module-eval side-effect freedom ---------------------------

// Test files are excluded — they legitimately contain top-level
// `describe`/`expect`/`vi.mock` expression statements and never ship to the
// registry. In this tree tests live in `packages/*/tests/` (siblings of
// `src/`), so the `src/**` walk already excludes them; the suffix/dir guards
// below are belt-and-suspenders in case a future package co-locates specs
// under `src/`.
const TEST_FILE_RE = /\.(spec|test)\.(ts|tsx|mts|cts)$/;
const TEST_DIR_RE = /(^|[/\\])(__tests__|tests?)([/\\]|$)/;
// A package's shippable TS sources. `sideEffects:false` is package-global, so
// the gate must reach every transpiled module, not just `.ts` — a `.tsx` /
// `.mts` / `.cts` source ships top-level statements just the same. Declaration
// files (`.d.ts` / `.d.mts` / `.d.cts`) are type-only and emit no runtime.
const SOURCE_EXT_RE = /\.(ts|tsx|mts|cts)$/;
const DECLARATION_EXT_RE = /\.d\.(ts|mts|cts)$/;

// Recursively collect TS source files under a package's `src/` dir,
// skipping declaration files and test files/dirs.
const listSourceFiles = (srcDir) => {
    const out = [];
    let entries;
    try {
        entries = readdirSync(srcDir, {withFileTypes: true});
    } catch (err) {
        // A genuinely-absent src/ (ENOENT) yields no files — the caller (main)
        // treats a zero-file package as a failure, since a package with no
        // readable sources cannot be ASSERTED side-effect-free. Any other error
        // — EACCES, EIO, a transient CI I/O fault — must NOT be swallowed into an
        // empty list that prints a green PASS: that turns the side-effect gate
        // into the silent failure it exists to catch. Fail loud.
        if (err.code === 'ENOENT') {
            return out;
        }
        throw err;
    }
    for (const entry of entries) {
        const full = path.join(srcDir, entry.name);
        if (entry.isDirectory()) {
            if (TEST_DIR_RE.test(`/${entry.name}/`)) {
                continue;
            }
            out.push(...listSourceFiles(full));
        } else if (entry.isFile()) {
            if (!SOURCE_EXT_RE.test(entry.name)) {
                continue;
            }
            if (DECLARATION_EXT_RE.test(entry.name)) {
                continue;
            }
            if (TEST_FILE_RE.test(entry.name)) {
                continue;
            }
            out.push(full);
        }
    }
    return out;
};

const isAssignmentOperatorKind = (kind) =>
    kind >= ts.SyntaxKind.FirstAssignment && kind <= ts.SyntaxKind.LastAssignment;

// In the modern TS AST, decorators live in the combined `modifiers` array
// alongside keyword modifiers. A decorator is a CALL evaluated at the
// declaration's definition time — for a top-level class that is module load.
const hasModifier = (node, kind) => (node.modifiers ?? []).some((m) => m.kind === kind);

const hasDecorator = (node) => hasModifier(node, ts.SyntaxKind.Decorator);

// Does defining this class run no observable side effect at module load? A class
// DECLARATION only declares — but several member shapes evaluate at
// class-definition time (= module load for a top-level class): a `static {}`
// block, a `static` field INITIALIZER, any computed member NAME, and any
// decorator (class- or member-level). Methods, accessors, and instance-field
// initializers do NOT run at definition (instance fields run at construction),
// so they are safe.
const isLoadSafeClass = (node) => {
    if (hasDecorator(node)) {
        return false;
    }
    for (const member of node.members ?? []) {
        if (hasDecorator(member)) {
            return false;
        }
        // A computed member name (`[key()]() {}`, `static [k()] = 1`) is
        // evaluated when the class is defined, regardless of static-ness.
        if (member.name?.kind === ts.SyntaxKind.ComputedPropertyName && !isLoadSafeExpression(member.name.expression)) {
            return false;
        }
        if (member.kind === ts.SyntaxKind.ClassStaticBlockDeclaration) {
            return false;
        }
        if (
            member.kind === ts.SyntaxKind.PropertyDeclaration &&
            hasModifier(member, ts.SyntaxKind.StaticKeyword) &&
            !isLoadSafeExpression(member.initializer)
        ) {
            return false;
        }
    }
    return true;
};

// Does binding this name run no observable side effect at module load? A plain
// identifier binds inertly; an object/array binding pattern's DEFAULT
// initializers (`const {a = register()} = obj`) and computed property keys
// evaluate at load, and nested patterns recurse.
const isLoadSafeBindingName = (name) => {
    if (name.kind !== ts.SyntaxKind.ObjectBindingPattern && name.kind !== ts.SyntaxKind.ArrayBindingPattern) {
        return true;
    }
    for (const element of name.elements) {
        if (element.kind === ts.SyntaxKind.OmittedExpression) {
            continue;
        }
        if (
            element.propertyName?.kind === ts.SyntaxKind.ComputedPropertyName &&
            !isLoadSafeExpression(element.propertyName.expression)
        ) {
            return false;
        }
        if (element.initializer !== undefined && !isLoadSafeExpression(element.initializer)) {
            return false;
        }
        if (!isLoadSafeBindingName(element.name)) {
            return false;
        }
    }
    return true;
};

// Is an object-literal property load-side-effect-free? A method/get/set member
// only DEFINES a function (not invoked at load); a shorthand references a
// binding; a spread / property value / computed key must itself be load-safe.
const isLoadSafeProperty = (prop) => {
    switch (prop.kind) {
        case ts.SyntaxKind.ShorthandPropertyAssignment:
        case ts.SyntaxKind.MethodDeclaration:
        case ts.SyntaxKind.GetAccessor:
        case ts.SyntaxKind.SetAccessor:
            return true;
        case ts.SyntaxKind.SpreadAssignment:
            return isLoadSafeExpression(prop.expression);
        case ts.SyntaxKind.PropertyAssignment:
            if (prop.name?.kind === ts.SyntaxKind.ComputedPropertyName && !isLoadSafeExpression(prop.name.expression)) {
                return false;
            }
            return isLoadSafeExpression(prop.initializer);
        default:
            return false;
    }
};

// Does evaluating this expression at module load run no observable side effect?
// Allowlist / default-deny: a value/function/class literal, a reference, or a
// pure composition of those is safe; anything that INVOKES code at load — a
// CallExpression, `new`, an IIFE, an assignment, `await`, a tagged template —
// is a side effect (`const _ = Object.defineProperty(globalThis, ...)`,
// `export const x = register()`, `const y = (() => { patch(); return 1 })()`).
// Unknown kinds fail closed: a side-effect gate must not pass on the unrecognized.
const isLoadSafeExpression = (expr) => {
    if (expr === undefined) {
        return true;
    }
    switch (expr.kind) {
        case ts.SyntaxKind.NumericLiteral:
        case ts.SyntaxKind.BigIntLiteral:
        case ts.SyntaxKind.StringLiteral:
        case ts.SyntaxKind.NoSubstitutionTemplateLiteral:
        case ts.SyntaxKind.RegularExpressionLiteral:
        case ts.SyntaxKind.TrueKeyword:
        case ts.SyntaxKind.FalseKeyword:
        case ts.SyntaxKind.NullKeyword:
        case ts.SyntaxKind.Identifier: // bare reference, incl. `undefined`
        // Function definitions — declared here, not invoked at load.
        case ts.SyntaxKind.ArrowFunction:
        case ts.SyntaxKind.FunctionExpression:
            return true;
        // A class *definition* is inert UNLESS a member evaluates at definition
        // time (static block / static field initializer / computed name /
        // decorator) — `isLoadSafeClass` walks the members for exactly that.
        case ts.SyntaxKind.ClassExpression:
            return isLoadSafeClass(expr);
        // Transparent wrappers — recurse into the inner expression.
        case ts.SyntaxKind.ParenthesizedExpression:
        case ts.SyntaxKind.AsExpression:
        case ts.SyntaxKind.SatisfiesExpression:
        case ts.SyntaxKind.TypeAssertionExpression:
        case ts.SyntaxKind.NonNullExpression:
            return isLoadSafeExpression(expr.expression);
        // Property / element access is pure read for tree-shaking purposes
        // (`const x = Foo.bar`); the threat is *calling*, not referencing.
        case ts.SyntaxKind.PropertyAccessExpression:
            return isLoadSafeExpression(expr.expression);
        case ts.SyntaxKind.ElementAccessExpression:
            return isLoadSafeExpression(expr.expression) && isLoadSafeExpression(expr.argumentExpression);
        case ts.SyntaxKind.NewExpression:
            // Construction is a pure allocation — idiomatic module-private state
            // (`new WeakMap()`, `new Map()`, `new Set()`). Unlike a bare call it
            // installs nothing; the realistic load-time threats the gate guards
            // (`Object.defineProperty(...)`, `register()`, an IIFE) are all *calls*.
            // Still recurse into the callee + args so `new Foo(register())` and
            // `new (getCtor())()` cannot smuggle a call through.
            return (
                isLoadSafeExpression(expr.expression) &&
                (expr.arguments === undefined || expr.arguments.every(isLoadSafeExpression))
            );
        case ts.SyntaxKind.PrefixUnaryExpression: {
            const op = expr.operator;
            // -1 / +1 / !flag / ~bits are pure; ++x / --x mutate.
            if (
                op === ts.SyntaxKind.MinusToken ||
                op === ts.SyntaxKind.PlusToken ||
                op === ts.SyntaxKind.ExclamationToken ||
                op === ts.SyntaxKind.TildeToken
            ) {
                return isLoadSafeExpression(expr.operand);
            }
            return false;
        }
        case ts.SyntaxKind.ConditionalExpression:
            return (
                isLoadSafeExpression(expr.condition) &&
                isLoadSafeExpression(expr.whenTrue) &&
                isLoadSafeExpression(expr.whenFalse)
            );
        case ts.SyntaxKind.BinaryExpression:
            // Pure operators only; the assignment family (`=`, `+=`, `&&=`, …) mutates.
            if (isAssignmentOperatorKind(expr.operatorToken.kind)) {
                return false;
            }
            return isLoadSafeExpression(expr.left) && isLoadSafeExpression(expr.right);
        case ts.SyntaxKind.TemplateExpression:
            return expr.templateSpans.every((span) => isLoadSafeExpression(span.expression));
        case ts.SyntaxKind.ArrayLiteralExpression:
            return expr.elements.every((el) =>
                el.kind === ts.SyntaxKind.SpreadElement
                    ? isLoadSafeExpression(el.expression)
                    : isLoadSafeExpression(el),
            );
        case ts.SyntaxKind.ObjectLiteralExpression:
            return expr.properties.every(isLoadSafeProperty);
        default:
            return false;
    }
};

// Top-level control-flow statement kinds — each EXECUTES at module load, so all
// are side effects. Mapped to a human label so an ally reading a CI failure
// needn't decode raw TS AST enum names.
const CONTROL_FLOW_KINDS = new Set([
    ts.SyntaxKind.IfStatement,
    ts.SyntaxKind.ForStatement,
    ts.SyntaxKind.ForInStatement,
    ts.SyntaxKind.ForOfStatement,
    ts.SyntaxKind.WhileStatement,
    ts.SyntaxKind.DoStatement,
    ts.SyntaxKind.SwitchStatement,
    ts.SyntaxKind.TryStatement,
    ts.SyntaxKind.ThrowStatement,
    ts.SyntaxKind.LabeledStatement,
    ts.SyntaxKind.WithStatement,
    ts.SyntaxKind.Block,
]);

// Classify a top-level statement. Returns null if the statement is
// side-effect-free (permitted), or a short human-readable description of the
// offending construct if it is a module-eval side effect.
//
// Permitted at module top level:
//   - import declarations WITH at least one specifier binding
//   - export ... from / export * / export { ... } re-export declarations
//   - export default / export = of a load-safe expression (function / arrow /
//     side-effect-free class definition / literal / reference)
//   - interface / type alias / enum declarations
//   - ambient or load-safe `namespace` (module) declarations
//   - const / let / var with a load-safe initializer and binding pattern
//   - function declarations; class declarations with no definition-time member effect
// Everything else — a bare ExpressionStatement (call / assignment), top-level
// control flow (if/for/while/try/labeled/block), or a class/namespace whose body
// evaluates at definition time — is a side effect.
const classifyTopLevelStatement = (node) => {
    switch (node.kind) {
        case ts.SyntaxKind.ImportDeclaration: {
            // A specifier-less import (`import './side-effect'`) has no
            // importClause and exists solely for its load-time effect.
            if (node.importClause === undefined) {
                return "specifier-less side-effect import (`import '...'`)";
            }
            return null;
        }
        case ts.SyntaxKind.ImportEqualsDeclaration:
        case ts.SyntaxKind.ExportDeclaration:
        case ts.SyntaxKind.InterfaceDeclaration:
        case ts.SyntaxKind.TypeAliasDeclaration:
        case ts.SyntaxKind.FunctionDeclaration:
            return null;
        case ts.SyntaxKind.EnumDeclaration: {
            // A `const enum` is fully erased — no runtime emit. A non-const enum
            // compiles to a load-time IIFE that EVALUATES each member initializer
            // at module eval, so a call-bearing initializer (`enum E { A = side()
            // }`) is a module-eval side effect. Permit only load-safe initializers,
            // mirroring the static-field / binding-default / namespace-body checks.
            if (hasModifier(node, ts.SyntaxKind.ConstKeyword)) {
                return null;
            }
            for (const member of node.members) {
                if (!isLoadSafeExpression(member.initializer)) {
                    return 'top-level enum member initializer evaluates at module load (call / new / IIFE / assignment)';
                }
            }
            return null;
        }
        case ts.SyntaxKind.ClassDeclaration:
            // A class declaration is inert UNLESS a member evaluates at definition
            // time — a `static {}` block, a `static` field initializer, a computed
            // member name, or any decorator (all run at module load).
            if (!isLoadSafeClass(node)) {
                return 'class definition runs at module load (static block / static field initializer / computed member name / decorator)';
            }
            return null;
        case ts.SyntaxKind.ModuleDeclaration: {
            // An ambient (`declare namespace`) or type-only namespace emits no
            // runtime. A non-ambient namespace with runtime content compiles to a
            // load-time IIFE, so recurse into its body and require every inner
            // statement to be a load-safe declaration. `namespace A.B { … }` nests
            // a ModuleDeclaration whose body is the ModuleBlock — walk down to it.
            if (hasModifier(node, ts.SyntaxKind.DeclareKeyword)) {
                return null;
            }
            let body = node.body;
            while (body !== undefined && body.kind === ts.SyntaxKind.ModuleDeclaration) {
                body = body.body;
            }
            if (body !== undefined && body.kind === ts.SyntaxKind.ModuleBlock) {
                for (const statement of body.statements) {
                    const offense = classifyTopLevelStatement(statement);
                    if (offense !== null) {
                        return `namespace body — ${offense}`;
                    }
                }
            }
            return null;
        }
        case ts.SyntaxKind.VariableStatement: {
            // A `const`/`let`/`var` DECLARATION is permitted, but its INITIALIZER
            // is evaluated at module load — `const _ = Object.defineProperty(...)`,
            // `export const x = register()`, `const y = (() => { patch(); })()` are
            // module-eval side effects that tree-shake away silently under
            // sideEffects:false. Permit only load-safe initializers (literals,
            // function/class definitions, references, and pure compositions); the
            // binding NAME is also load-eval'd via destructuring defaults / computed
            // keys (`const {a = register()} = obj`), so check it too.
            for (const decl of node.declarationList.declarations) {
                if (!isLoadSafeExpression(decl.initializer)) {
                    return 'top-level variable initializer evaluates at module load (call / new / IIFE / assignment)';
                }
                if (!isLoadSafeBindingName(decl.name)) {
                    return 'top-level destructuring default / computed key evaluates at module load (call / new / IIFE / assignment)';
                }
            }
            return null;
        }
        case ts.SyntaxKind.ExportAssignment: {
            // Both `export default <expr>` and `export = <expr>` (the latter has
            // isExportEquals === true) EVALUATE <expr> at module load, so the
            // default/assignment is side-effect-free iff the expression is
            // load-safe — a function / arrow / inert class definition / literal /
            // reference passes; `export default someCall()` does not.
            if (!isLoadSafeExpression(node.expression)) {
                return node.isExportEquals === true
                    ? 'export = of an evaluated expression'
                    : 'export default of an evaluated expression';
            }
            return null;
        }
        case ts.SyntaxKind.ExpressionStatement:
            return 'top-level expression statement (call / assignment evaluates at module load)';
        default:
            if (CONTROL_FLOW_KINDS.has(node.kind)) {
                return 'top-level control-flow statement (runs at module load)';
            }
            return `top-level ${ts.SyntaxKind[node.kind] ?? 'statement'} (not a side-effect-free declaration)`;
    }
};

// Parse one source file and return an array of failure strings (one per
// offending top-level statement), or [] if the file is side-effect-free.
const checkSideEffectFreedom = (filePath, label) => {
    const src = readFileSync(filePath, 'utf8');
    // A `.tsx` source must parse as TSX — under plain TS the JSX `<T>` form is
    // mis-read as a type assertion. `.mts`/`.cts` parse fine as TS.
    const scriptKind = filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sourceFile = ts.createSourceFile(
        filePath,
        src,
        ts.ScriptTarget.Latest,
        /* setParentNodes */ false,
        scriptKind,
    );
    const fileFailures = [];
    for (const statement of sourceFile.statements) {
        const offense = classifyTopLevelStatement(statement);
        if (offense !== null) {
            const {line} = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile));
            fileFailures.push(
                `${label}: ${filePath}:${line + 1} — ${offense} (queue #93 — sideEffects:false requires module-eval side-effect freedom)`,
            );
        }
    }
    return fileFailures;
};

const runCaptured = (cmd, args, cwd, extraEnv) => {
    const result = spawnSync(cmd, args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf8',
        shell: false,
        env: extraEnv ? {...process.env, ...extraEnv} : process.env,
    });
    const stdout = result.stdout ?? '';
    const stderr = result.stderr ?? '';
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    return {stdout, stderr, status: result.status ?? 1};
};

const main = () => {
    const dirs = listPackageDirs();
    const failures = [];

    // Root manifest engines.node presence check (queue #31). Root is not in
    // packages/*, so it gets a dedicated assertion before the per-package loop.
    process.stdout.write(`\n--- lint:pkg engines.node (root ${ROOT_MANIFEST}) ---\n`);
    const rootFailure = checkEnginesNode(ROOT_MANIFEST, 'workspace-root');
    if (rootFailure) {
        failures.push(rootFailure);
        process.stderr.write(`  ${rootFailure}\n`);
    } else {
        process.stdout.write(`  workspace-root: engines.node OK\n`);
    }

    for (const dir of dirs) {
        const name = packageName(dir);
        process.stdout.write(`\n--- lint:pkg ${name} (${dir}) ---\n`);

        const enginesFailure = checkEnginesNode(path.join(dir, 'package.json'), name);
        if (enginesFailure) {
            failures.push(enginesFailure);
            process.stderr.write(`  ${enginesFailure}\n`);
        }

        // Module-eval side-effect freedom across every source file (queue #93).
        const srcDir = path.join(dir, 'src');
        const sourceFiles = listSourceFiles(srcDir);
        if (sourceFiles.length === 0) {
            // No readable sources — a published package must have ≥1 src module;
            // an empty result means src/ is absent/empty. Asserting it
            // side-effect-free would be vacuous, so fail rather than green-PASS.
            const msg = `${name}: no readable source files under ${srcDir} — cannot assert module-eval side-effect freedom (queue #93)`;
            failures.push(msg);
            process.stderr.write(`  ${msg}\n`);
        } else {
            let sideEffectFailures = 0;
            for (const filePath of sourceFiles) {
                const fileFailures = checkSideEffectFreedom(filePath, name);
                for (const f of fileFailures) {
                    failures.push(f);
                    process.stderr.write(`  ${f}\n`);
                    sideEffectFailures += 1;
                }
            }
            if (sideEffectFailures === 0) {
                process.stdout.write(`  ${name}: ${sourceFiles.length} source file(s) side-effect-free OK\n`);
            }
        }

        // NO_COLOR=1 keeps publint's output plain regardless of runner color
        // settings; stripAnsi defends against any residual SGR codes so the
        // PUBLINT_BLOCK_RE verdict is identical in every environment (queue #63).
        const publint = runCaptured('npx', ['publint', 'run'], dir, {NO_COLOR: '1'});
        const publintBlock = PUBLINT_BLOCK_RE.exec(stripAnsi(publint.stdout));
        if (publint.status !== 0) {
            failures.push(`${name}: publint exited ${publint.status}`);
        } else if (publintBlock) {
            failures.push(`${name}: publint emitted "${publintBlock[1]}:" block (fail-on-suggestion gate)`);
        }

        // Asset exports (a shipped stylesheet, etc.) are intentionally untyped, so
        // attw's type-resolution check does not apply to them. Derive any *.css
        // export subpaths from the manifest and exclude them — otherwise a package
        // with a CSS export (ui-inputs, the first component package) fails attw for
        // a non-JS entrypoint legitimately having no type declarations.
        const attwArgs = ['attw', '--pack'];
        const exportsMap = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8')).exports ?? {};
        const cssEntrypoints = Object.entries(exportsMap)
            .filter(([, target]) => typeof target === 'string' && target.endsWith('.css'))
            .map(([key]) => key.replace(/^\.\//, ''));
        if (cssEntrypoints.length > 0) attwArgs.push('--exclude-entrypoints', ...cssEntrypoints);

        const attw = runCaptured('npx', attwArgs, dir);
        if (attw.status !== 0) {
            failures.push(`${name}: attw exited ${attw.status}`);
        }
    }

    if (failures.length > 0) {
        process.stderr.write(`\n\nlint:pkg gate FAILED (${failures.length}):\n`);
        for (const f of failures) {
            process.stderr.write(`  - ${f}\n`);
        }
        process.exit(1);
    }

    process.stdout.write(
        `\nlint:pkg gate PASS — ${dirs.length} packages + root clean (engines.node present; publint suggestions/warnings/errors all treated as fatal; every package source module asserted module-eval side-effect-free per sideEffects:false, queue #93).\n`,
    );
};

main();
