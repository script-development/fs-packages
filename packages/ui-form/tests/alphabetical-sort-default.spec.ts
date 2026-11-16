// @vitest-environment happy-dom
// WR-1991 (Commander ruling 2026-10-03): `alphabeticalSort` defaults to false — the caller's order
// is the order, and sorting is the opt-in.
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';

import SingleSelect from '../src/components/SingleSelect.vue';

const CALLER_ORDER = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

const SORTABLE = [{name: 'SingleSelect', component: SingleSelect, modelValue: null, opener: 'button'}] as const;

afterEach(() => {
    document.body.innerHTML = '';
});

describe.each(SORTABLE)('$name — option order', ({component, modelValue, opener}) => {
    const renderedOrder = async (extra: Record<string, unknown>) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic SFCs through one mount
        const wrapper = mount(component as any, {
            props: {options: CALLER_ORDER, optionLabel: 'name', id: 'f', modelValue, ...extra},
            attachTo: document.body,
        });
        await wrapper.find(opener).trigger('click');
        return wrapper.findAll('[role="option"]').map((option) => option.text());
    };

    it("keeps the caller's order by default", async () => {
        expect(await renderedOrder({})).toEqual(['Watermelon', 'Apricot', 'Mango']);
    });

    it('sorts by display string when `alphabeticalSort` is set', async () => {
        expect(await renderedOrder({alphabeticalSort: true})).toEqual(['Apricot', 'Mango', 'Watermelon']);
    });
});
