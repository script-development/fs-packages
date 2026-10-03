// @vitest-environment happy-dom
// WR-1991 (Commander ruling 2026-10-03): `alphabeticalSort` defaults to false — the caller's order
// is the order, and sorting is the opt-in.
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';

import Combobox from '../src/components/Combobox.vue';
import MultiCombobox from '../src/components/MultiCombobox.vue';
import MultiSelect from '../src/components/MultiSelect.vue';
import SingleSelect from '../src/components/SingleSelect.vue';

const CALLER_ORDER = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

const SORTABLE = [
    {name: 'SingleSelect', component: SingleSelect, modelValue: null, opener: 'button'},
    {name: 'MultiSelect', component: MultiSelect, modelValue: [], opener: '.ui-multiselect__trigger'},
    {name: 'Combobox', component: Combobox, modelValue: null, opener: 'input'},
    {name: 'MultiCombobox', component: MultiCombobox, modelValue: [], opener: 'input'},
] as const;

afterEach(() => {
    document.body.innerHTML = '';
});

describe.each(SORTABLE)('$name — option order', ({component, modelValue, opener}) => {
    const renderedOrder = async (extra: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- four generic SFCs through one mount
        const wrapper = mount(component as any, {
            props: {options: CALLER_ORDER, label: 'name', id: 'f', modelValue, ...extra},
            attachTo: document.body,
        });
        await wrapper.find(opener).trigger(opener === 'input' ? 'focus' : 'click');
        if (opener === 'input') await wrapper.find(opener).trigger('keydown', {key: 'ArrowDown'});
        return wrapper.findAll('[role="option"]').map((option) => option.text());
    };

    it("keeps the caller's order by default", async () => {
        expect(await renderedOrder({})).toEqual(['Watermelon', 'Apricot', 'Mango']);
    });

    it('sorts by display string when `alphabeticalSort` is set', async () => {
        expect(await renderedOrder({alphabeticalSort: true})).toEqual(['Apricot', 'Mango', 'Watermelon']);
    });
});
