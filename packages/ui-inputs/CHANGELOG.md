# @script-development/ui-inputs

## 0.17.3 — 2026-11-13

### Patch Changes

- **`TextInput` no longer writes its value into the DOM (EZ-0124).** Vue sets a bound `:value` on a native input as an attribute as well as a property, so the text, a typed password included, showed as `value="…"` in the page source, to anything that reads it: a CSS attribute selector, a session recorder, an extension. `TextInput` now sets the property alone, for every `type`, as Vue's own `v-model` does. A selector or test that read the `value` attribute reads the property instead. A native `form.reset()` now empties the field instead of leaving it, again as with `v-model`, and emits nothing.

## 0.17.2 — 2026-10-20

### Patch Changes

- **`dist` no longer ships source maps or source comments.** The tarball carried a `.map` beside every bundle, each holding the full source text in `sourcesContent`, and the bundled JavaScript kept the source comments. Both are gone: the JavaScript keeps only the comments a bundler or coverage tool reads (region markers, `@__PURE__` annotations, coverage-ignore directives), and the type files keep their JSDoc. The components' template comments are no longer compiled in either: each one used to render as an HTML comment node in the consumer's DOM. Behaviour and types are otherwise unchanged. A debugger stepping into this package now shows the bundled JavaScript instead of the TypeScript source.

## 0.17.1 — 2026-10-17

### Patch Changes

- **A checked `Checkbox`, a selected `RadioGroup` option and an on `Switch` are visible under forced colours (WR-1339).** In a high-contrast theme the checked box, the radio dot, the switch track and its thumb were painted in author colours the theme discards, so checked and unchecked rendered pixel-identical and a switch did not render at all (measured in Chromium's emulated forced-colors palette). `styles.css` now paints them in system colours there: `Highlight` / `HighlightText` for checked and indeterminate, a `CanvasText` track outline and thumb on the switch, `GrayText` for the disabled variants. An invalid control (`invalid` on any input, select, Checkbox, RadioGroup or Switch) also painted identical to a valid one there; it now carries a dashed `CanvasText` outline, which gives way to the focus ring while focused. No `--ui-*` token changes.
- **An option of a `RadioGroup` with no selection no longer paints as selected (WR-2299).** With `modelValue: null` every radio matches `:indeterminate`, and the checkbox's mixed-state fill was applied to it, so every option looked chosen. The indeterminate fill now applies to checkboxes only, with and without forced colours.

## 0.17.0 — 2026-10-03

### Added

- **Typeahead on `SingleSelect`, `MultiSelect` and `GroupSelect` (WR-1991).** A typed character moves the highlight to the next option starting with it, a quickly typed string matches by prefix, and the string resets after 500 ms or when the list closes, however it closes. The string keeps its first 64 characters. With nothing highlighted, SingleSelect and GroupSelect search from the chosen option, as a native `<select>` does; MultiSelect searches from the top. On a closed control a match opens the list on that option; nothing commits until Enter. Case is ignored one character at a time, so typed `ΟΣ` finds both `ΟΣ` and `ΟΣΑ` (a whole-word lowercase would read the first as `ος`), and `İ` finds and cycles the labels starting with `İ`. An emoji key such as `🍎` counts as one character. The comboboxes are unchanged: their typed characters are the query.

### Changed

- **Closing `SingleSelect` or `MultiSelect` with a click on the trigger now clears the highlight (WR-1991).** Before, the highlighted option survived a trigger close and reappeared, with its `aria-activedescendant`, when the list reopened. Every other way of closing already cleared it, and `GroupSelect` cleared it on a trigger close too.
- **`TextInput` and `Textarea` no longer emit while an IME is composing (WR-1990).** Like Vue's own `v-model` on a text field, the candidate `input` events of a Japanese/Chinese/Korean input method emit nothing and the composed value is emitted once on `compositionend`, or on a `change` that ends the composition without one, as Vue does. Plain typing still emits on every keystroke. A consumer that reacted to each candidate (one sibling territory sent a request per candidate) now sees one value.
- **`alphabeticalSort` now defaults to `false` (WR-1991, Commander ruling 2026-10-03).** `SingleSelect`, `MultiSelect`, `Combobox` and `MultiCombobox` render options in the order you pass them unless you set `alphabeticalSort`. Uses that relied on the old default, found on 2026-10-03 at each repo's checked-out HEAD (direct uses with no `alphabeticalSort` binding; every other fleet use already passes `:alphabetical-sort="false"`): one shared select wrapper in one sibling territory, and five components (two pages, a modal and two showcase components) in another. Add `alphabetical-sort` to keep the sorted order.
- **The select family's attrs now reach the combobox element (WR-1991).** On `SingleSelect`, `MultiSelect`, `GroupSelect`, `Combobox`, `MultiCombobox` and `GroupCombobox`, every attr except `class` and `style` now lands on the element carrying `role="combobox"` (the trigger button or the text input) instead of the root `<div>`, so `aria-label`/`aria-labelledby` finally name the control. `class` and `style` stay on the root. A `data-*` selector or a listener you bound on one of these components now finds the control rather than the wrapper: `@focus`/`@blur` start firing (they never bubbled to the wrapper), and an `@keydown` runs on the control before the component's own handler. Fleet census on 2026-10-03: of 33 direct uses in 8 repos, 4 pass a fall-through attr, all of them `class` (two wrapper components in one sibling territory, two uses each), which stays put.

## 0.16.0 — 2026-10-03

### Minor Changes

- **Behaviour change: a disabled `Checkbox`, `Switch`, `CheckboxGroup` or `RadioGroup` now runs none of the `click`, `input` or `change` listeners you bind on it, in either phase (WR-0918).** Before, a dispatched event on a disabled control still ran a fall-through handler, and a dispatched click also flipped the native input while the model stayed put. A real pointer on an option's label text in a disabled group still reached a `@click` bound on the group. If your code relied on hearing those events from a disabled control, it no longer will. Enabled controls are unchanged, including the order in which your listeners and `update:modelValue` run. Props and emits are unchanged.

### Patch Changes

- **A declined or deferred change no longer leaves the native control flipped (WR-1922).** `Checkbox`, `Switch`, `CheckboxGroup` and `RadioGroup` now set the input back to the bound value once the host has rendered, so a host that asks first or awaits a save shows the model, not the browser's click. A change taken at once is unchanged. Wrappers that re-assert `checked` themselves (a sibling territory's `Switch`) can drop that code on this version.

## 0.15.0 — 2026-09-29

### Patch Changes

- **Published object-shape type aliases are now declared as `interface` (WR-1633).** Runtime is unchanged. An `interface` has no implicit index signature, so a converted type is no longer assignable to `Record<string, unknown>` without one (0 consumers measured across 64,338 fleet files). Declaration merging becomes possible, which is additive.
