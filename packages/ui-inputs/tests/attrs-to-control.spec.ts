// @vitest-environment happy-dom
// WR-1991: a consumer's attrs reach the element that carries role="combobox" — the only place an
// `aria-label` or `aria-labelledby` can name the control — while `class` and `style` stay on the
// root, where the fleet's consumers already style the whole control.
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';

import Combobox from '../src/components/Combobox.vue';
import GroupCombobox from '../src/components/GroupCombobox.vue';
import GroupSelect from '../src/components/GroupSelect.vue';
import MultiCombobox from '../src/components/MultiCombobox.vue';
import MultiSelect from '../src/components/MultiSelect.vue';
import SingleSelect from '../src/components/SingleSelect.vue';

const OPTIONS = [{id: 1, name: 'Apricot'}];
const GROUPS = [{text: 'Fruit', options: OPTIONS}];

const FAMILY = [
    {name: 'SingleSelect', component: SingleSelect, props: {options: OPTIONS, modelValue: null}},
    {name: 'MultiSelect', component: MultiSelect, props: {options: OPTIONS, modelValue: []}},
    {name: 'GroupSelect', component: GroupSelect, props: {groups: GROUPS, modelValue: null}},
    {name: 'Combobox', component: Combobox, props: {options: OPTIONS, modelValue: null}},
    {name: 'MultiCombobox', component: MultiCombobox, props: {options: OPTIONS, modelValue: []}},
    {name: 'GroupCombobox', component: GroupCombobox, props: {groups: GROUPS, modelValue: null}},
] as const;

afterEach(() => {
    document.body.innerHTML = '';
});

describe.each(FAMILY)('$name — attribute fall-through', ({component, props}) => {
    const mountWithAttrs = () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- six generic SFCs through one mount
        mount(component as any, {
            props: {label: 'name', id: 'f', ...props},
            attrs: {
                'aria-label': 'Fruit',
                'data-qa': 'fruit-picker',
                class: 'consumer-class',
                style: 'margin-top: 3px;',
            },
            attachTo: document.body,
        });

    it('aria-label and data-* land on the combobox element, not the root', () => {
        const wrapper = mountWithAttrs();
        const control = wrapper.find('[role="combobox"]');

        expect(control.attributes('aria-label')).toBe('Fruit');
        expect(control.attributes('data-qa')).toBe('fruit-picker');
        expect(wrapper.attributes('aria-label')).toBeUndefined();
        expect(wrapper.attributes('data-qa')).toBeUndefined();
    });

    it('REGRESSION PIN — class and style stay on the root, beside its own class', () => {
        const wrapper = mountWithAttrs();
        const control = wrapper.find('[role="combobox"]');

        expect(wrapper.classes()).toContain('consumer-class');
        expect(wrapper.attributes('style')).toContain('margin-top: 3px');
        expect(control.classes()).not.toContain('consumer-class');
        expect(control.attributes('style')).toBeUndefined();
    });

    it("a consumer attr never overrides the component's own wiring on the control", () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- six generic SFCs through one mount
        const wrapper = mount(component as any, {
            props: {label: 'name', id: 'f', ...props},
            attrs: {id: 'hijack', role: 'button'},
            attachTo: document.body,
        });
        const control = wrapper.find('#f');

        expect(control.attributes('role')).toBe('combobox');
    });
});
