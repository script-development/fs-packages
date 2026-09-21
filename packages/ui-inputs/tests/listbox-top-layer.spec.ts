// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';

import Combobox from '../src/components/Combobox.vue';
import MultiCombobox from '../src/components/MultiCombobox.vue';
import MultiSelect from '../src/components/MultiSelect.vue';
import SingleSelect from '../src/components/SingleSelect.vue';

interface Fruit {
    id: number;
    name: string;
}

const FRUITS: Fruit[] = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

const FAMILY = [
    {name: 'SingleSelect', component: SingleSelect, menuClass: '.ui-select__menu', modelValue: null},
    {name: 'Combobox', component: Combobox, menuClass: '.ui-combobox__menu', modelValue: null},
    {name: 'MultiSelect', component: MultiSelect, menuClass: '.ui-multiselect__menu', modelValue: []},
    {name: 'MultiCombobox', component: MultiCombobox, menuClass: '.ui-multicombobox__menu', modelValue: []},
] as const;

const mountOpen = (
    component: (typeof FAMILY)[number]['component'],
    modelValue: number | null | number[],
    attachTo: Element = document.body,
) => mount(component as never, {props: {options: FRUITS, label: 'name', id: 'fruit', modelValue}, attachTo});

afterEach(() => {
    document.body.innerHTML = '';
});

// KD-1136 is fixed by TOP-LAYER PROMOTION, not by moving the popup. The earlier teleport
// escaped the clip but broke everything that depends on DOM position: scoped `--ui-*` maps,
// shadow-encapsulated styles, `root.contains()` for click-outside, and it needed a landing
// site (dialog lookup, shadow-boundary walk) that was itself clippable. Staying in place is
// the property these specs pin.
describe('select-family listbox top-layer promotion (KD-1136)', () => {
    it.each(FAMILY)('$name promotes the open menu without moving it', async ({component, menuClass, modelValue}) => {
        const wrapper = mountOpen(component, modelValue);
        await wrapper.find('#fruit').trigger('click');

        const menu = document.querySelector(menuClass);
        expect(menu).not.toBeNull();

        const anchor = menu?.parentElement;
        expect(anchor?.className).toBe('ui-menu-anchor');
        // `popover` is what asks the browser for the top layer.
        expect(anchor?.getAttribute('popover')).toBe('manual');
        // The shim records that showPopover() actually ran (happy-dom has no Popover API).
        expect(anchor?.hasAttribute('data-shim-popover-open')).toBe(true);

        // The load-bearing inverse of the old teleport assertion: the menu is STILL inside the
        // control. That is what keeps inherited theming and click-outside honest.
        expect(wrapper.element.contains(menu)).toBe(true);
    });

    it('keeps the menu inside a control nested in a dialog — no dialog lookup needed', async () => {
        const dialog = document.createElement('dialog');
        dialog.setAttribute('open', '');
        document.body.append(dialog);
        const wrapper = mountOpen(SingleSelect, null, dialog);
        await wrapper.find('#fruit').trigger('click');

        const menu = document.querySelector('.ui-select__menu');
        expect(menu).not.toBeNull();
        expect(wrapper.element.contains(menu)).toBe(true);
        expect(menu?.parentElement?.getAttribute('popover')).toBe('manual');
    });

    it('removes the menu from the DOM on close, which drops it from the top layer', async () => {
        const wrapper = mountOpen(SingleSelect, null);
        await wrapper.find('#fruit').trigger('click');
        expect(document.querySelector('.ui-menu-anchor')).not.toBeNull();

        await wrapper.find('#fruit').trigger('keydown', {key: 'Escape'});
        expect(document.querySelector('.ui-menu-anchor')).toBeNull();
    });
});
