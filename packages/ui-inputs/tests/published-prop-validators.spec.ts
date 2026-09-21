// @vitest-environment happy-dom
import {
    CheckboxGroup,
    Combobox,
    MultiCombobox,
    MultiSelect,
    RadioGroup,
    SingleSelect,
} from '@script-development/ui-inputs';
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';

/**
 * `LabelKey<T>` documents two arms — a property name or a getter — and every component here
 * resolves both. But an arm is only *honoured* if the SFC compiler emits it into the prop's
 * runtime validator, and `keyof T` on an unresolved generic is not statically expandable.
 * The compiler dropped that arm and emitted `{type: Function}`, so the property-name form
 * warned on every mount in every consumer (found in kendo#1823 Phase A adoption).
 *
 * **This suite imports the package by name — i.e. the built `dist` — deliberately, and it is
 * the only place in the repo that can witness the defect.** `@vitejs/plugin-vue` emits
 * `skipCheck: true` alongside the type when it can't fully resolve a union, which disables
 * validation outright; every src-importing spec therefore passes the string arm
 * (`label: 'name'`) and stays green while the published artifact warns. tsdown's build emits
 * no `skipCheck`, so only the artifact validates — and only the artifact regresses.
 *
 * Requires a prior `npm run build` (CI orders build before coverage, as it already must for
 * typecheck). Red-proven both ways: reverting `LabelKey` to a bare `keyof T` fails every
 * property-name case below with the exact `Invalid prop` warning.
 */

interface Fruit {
    id: number;
    name: string;
}

const FRUITS: Fruit[] = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
];

// The six components whose display-string prop is typed LabelKey<T>. The select family names
// it `label`; the group family names it `optionLabel` (there, `label` is the legend).
const CASES = [
    {name: 'SingleSelect', component: SingleSelect, prop: 'label', base: {modelValue: null}},
    {name: 'Combobox', component: Combobox, prop: 'label', base: {modelValue: null}},
    {name: 'MultiSelect', component: MultiSelect, prop: 'label', base: {modelValue: []}},
    {name: 'MultiCombobox', component: MultiCombobox, prop: 'label', base: {modelValue: []}},
    {name: 'CheckboxGroup', component: CheckboxGroup, prop: 'optionLabel', base: {label: 'Fruits', modelValue: []}},
    {name: 'RadioGroup', component: RadioGroup, prop: 'optionLabel', base: {label: 'Fruits', modelValue: null}},
];

const propWarnings = (warn: {mock: {calls: unknown[][]}}) =>
    warn.mock.calls
        .flat()
        .map(String)
        .filter((line) => line.includes('Invalid prop'));

afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
});

describe.each(CASES)('$name — published LabelKey validator', ({component, prop, base}) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic SFC + VTU mount inference
    const mountWith = (label: unknown) =>
        mount(component as any, {props: {options: FRUITS, id: 'fruit', ...base, [prop]: label}});

    it(`accepts a property name on \`${prop}\``, () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mountWith('name');

        expect(propWarnings(warn)).toEqual([]);
    });

    it(`accepts a getter on \`${prop}\``, () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        mountWith((fruit: Fruit) => fruit.name.toUpperCase());

        expect(propWarnings(warn)).toEqual([]);
    });
});
