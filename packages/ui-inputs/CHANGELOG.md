# @script-development/ui-inputs

## 0.17.0 — 2026-10-03

### Added

- **Typeahead on `SingleSelect`, `MultiSelect` and `GroupSelect` (WR-1991).** A typed character moves the highlight to the next option starting with it, a quickly typed string matches by prefix, and the string resets after 500 ms or when the list closes, however it closes. The string keeps its first 64 characters. With nothing highlighted, SingleSelect and GroupSelect search from the chosen option, as a native `<select>` does; MultiSelect searches from the top. On a closed control a match opens the list on that option; nothing commits until Enter. The comboboxes are unchanged: their typed characters are the query.

### Changed

- **Closing `SingleSelect` or `MultiSelect` with a click on the trigger now clears the highlight (WR-1991).** Before, the highlighted option survived a trigger close and reappeared, with its `aria-activedescendant`, when the list reopened. Every other way of closing already cleared it, and `GroupSelect` cleared it on a trigger close too.
- **`TextInput` and `Textarea` no longer emit while an IME is composing (WR-1990).** Like Vue's own `v-model` on a text field, the candidate `input` events of a Japanese/Chinese/Korean input method emit nothing and the composed value is emitted once on `compositionend`. Plain typing still emits on every keystroke. A consumer that reacted to each candidate (lokalekeuze: a request per candidate) now sees one value.
- **`alphabeticalSort` now defaults to `false` (WR-1991, Commander ruling 2026-10-03).** `SingleSelect`, `MultiSelect`, `Combobox` and `MultiCombobox` render options in the order you pass them unless you set `alphabeticalSort`. Uses that relied on the old default, found on 2026-10-03 at each repo's checked-out HEAD (direct uses with no `alphabeticalSort` binding; every other fleet use already passes `:alphabetical-sort="false"`): entreezuil `frontend/src/shared/ui/BaseSelect.vue` (reached by `apps/admin/domains/users/components/UserForm.vue`); brick-inventory-orchestrator `frontend/src/apps/families/domains/sets/pages/AddSetPage.vue`, `…/sets/pages/EditSetPage.vue`, `frontend/src/apps/families/modals/PlacePartModal.vue`, `frontend/src/apps/showcase/components/ComponentGallery.vue`, `frontend/src/apps/showcase/components/FormValidationWorkbench.vue`. Add `alphabetical-sort` to keep the sorted order.
- **The select family's attrs now reach the combobox element (WR-1991).** On `SingleSelect`, `MultiSelect`, `GroupSelect`, `Combobox`, `MultiCombobox` and `GroupCombobox`, every attr except `class` and `style` now lands on the element carrying `role="combobox"` (the trigger button or the text input) instead of the root `<div>`, so `aria-label`/`aria-labelledby` finally name the control. `class` and `style` stay on the root. A `data-*` selector or a listener you bound on one of these components now finds the control rather than the wrapper: `@focus`/`@blur` start firing (they never bubbled to the wrapper), and an `@keydown` runs on the control before the component's own handler. Fleet census on 2026-10-03: of 33 direct uses in 8 repos, 4 pass a fall-through attr, all of them `class` (ublgenie `editorial/Select.vue` ×2, `editorial/Multiselect.vue` ×2), which stays put.

## 0.16.0 — 2026-10-03

### Minor Changes

- **Behaviour change: a disabled `Checkbox`, `Switch`, `CheckboxGroup` or `RadioGroup` now runs none of the `click`, `input` or `change` listeners you bind on it, in either phase (WR-0918).** Before, a dispatched event on a disabled control still ran a fall-through handler, and a dispatched click also flipped the native input while the model stayed put. A real pointer on an option's label text in a disabled group still reached a `@click` bound on the group. If your code relied on hearing those events from a disabled control, it no longer will. Enabled controls are unchanged, including the order in which your listeners and `update:modelValue` run. Props and emits are unchanged.

### Patch Changes

- **A declined or deferred change no longer leaves the native control flipped (WR-1922).** `Checkbox`, `Switch`, `CheckboxGroup` and `RadioGroup` now set the input back to the bound value once the host has rendered, so a host that asks first or awaits a save shows the model, not the browser's click. A change taken at once is unchanged. Wrappers that re-assert `checked` themselves (lokalekeuze's `Switch`) can drop that code on this version.

## 0.15.0 — 2026-09-29

### Patch Changes

- **Published object-shape type aliases are now declared as `interface` (WR-1633).** Runtime is unchanged. An `interface` has no implicit index signature, so a converted type is no longer assignable to `Record<string, unknown>` without one (0 consumers measured across 64,338 fleet files). Declaration merging becomes possible, which is additive.
