// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import CheckboxGroup from '../src/components/CheckboxGroup.vue';

interface Fruit {
    id: number;
    name: string;
}

const FRUITS: Fruit[] = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic SFC + VTU mount inference
const mountGroup = (props: Record<string, unknown>) =>
    mount(CheckboxGroup as any, {
        props: {options: FRUITS, optionLabel: 'name', label: 'Fruits', id: 'fruit', modelValue: [], ...props},
    });

describe('CheckboxGroup', () => {
    it('renders a fieldset with legend and one native checkbox per option, in options order', () => {
        const wrapper = mountGroup({});

        const fieldset = wrapper.find('fieldset');
        expect(fieldset.classes()).toContain('ui-check-group');
        expect(fieldset.attributes('id')).toBe('fruit');
        expect(wrapper.find('legend').text()).toBe('Fruits');

        const inputs = wrapper.findAll('input[type="checkbox"]');
        expect(inputs).toHaveLength(3);
        // No sorting on groups — the rendered order IS the options order.
        expect(wrapper.findAll('.ui-check__label').map((label) => label.text())).toEqual([
            'Watermelon',
            'Apricot',
            'Mango',
        ]);
        // Position-keyed member ids off the group id (the family's `${id}-opt-${index}` scheme).
        expect(inputs.map((input) => input.attributes('id'))).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(inputs.every((input) => !(input.element as HTMLInputElement).checked)).toBe(true);
    });

    it('checks the members named by the model and emits an options-ordered array on toggle-on', async () => {
        const wrapper = mountGroup({modelValue: [3]});
        const inputs = wrapper.findAll('input[type="checkbox"]');
        expect(inputs.map((input) => (input.element as HTMLInputElement).checked)).toEqual([false, false, true]);

        // Checking Watermelon (options index 0) inserts at its OPTIONS position, not at the
        // click-order tail — [1, 3], never [3, 1].
        await inputs[0].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[1, 3]]);
    });

    it('removes membership on toggle-off', async () => {
        const wrapper = mountGroup({modelValue: [1, 2]});

        await wrapper.findAll('input[type="checkbox"]')[0].setValue(false);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
    });

    it('preserves an id whose option has not arrived yet at the tail across toggles', async () => {
        const wrapper = mountGroup({modelValue: [99, 3]});

        // id 99 has no option — nothing renders for it, but toggling another member keeps it.
        await wrapper.findAll('input[type="checkbox"]')[0].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[1, 3, 99]]);
    });

    it('conveys required at group level via the legend (visual marker + sr-only text), never aria-required on the fieldset', () => {
        const wrapper = mountGroup({required: true});

        expect(wrapper.find('.ui-label__req').text()).toBe('*');
        expect(wrapper.find('.ui-check-group__sr').text()).toBe('(required)');
        // aria-required is not a valid attribute on role=group (axe aria-allowed-attr) —
        // the legend text IS the group-level conveyance.
        expect(wrapper.find('fieldset').attributes('aria-required')).toBeUndefined();

        const bare = mountGroup({});
        expect(bare.find('.ui-label__req').exists()).toBe(false);
        expect(bare.find('.ui-check-group__sr').exists()).toBe(false);
    });

    it('localises the sr-only required text via the requiredLabel prop', () => {
        const wrapper = mountGroup({required: true, requiredLabel: '(verplicht)'});
        expect(wrapper.find('.ui-check-group__sr').text()).toBe('(verplicht)');
    });

    it('wires invalid and describedby with ONE described-by story: the IDREF on the fieldset only', () => {
        const wrapper = mountGroup({invalid: true, describedby: 'fruit-error'});

        const fieldset = wrapper.find('fieldset');
        expect(fieldset.attributes('aria-invalid')).toBe('true');
        expect(fieldset.attributes('aria-describedby')).toBe('fruit-error');

        const inputs = wrapper.findAll('input[type="checkbox"]');
        // Members mirror the invalid state (visible box treatment) but never repeat the IDREF.
        expect(inputs.every((input) => input.classes().includes('is-invalid'))).toBe(true);
        expect(inputs.every((input) => input.attributes('aria-describedby') === undefined)).toBe(true);
    });

    it('threads disabled to every member and ignores a change reaching a handler anyway', async () => {
        const wrapper = mountGroup({disabled: true});
        const inputs = wrapper.findAll('input[type="checkbox"]');

        expect(inputs.every((input) => input.attributes('disabled') !== undefined)).toBe(true);

        // Native dispatch — VTU setValue() skips disabled elements (vacuous-assertion trap).
        const first = inputs[0].element as HTMLInputElement;
        first.checked = true;
        first.dispatchEvent(new Event('change', {bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('round-trips string ids and resolves member labels via a getter', async () => {
        interface Tag {
            id: string;
            title: string;
        }
        const tags: Tag[] = [
            {id: 'b', title: 'beta'},
            {id: 'a', title: 'alpha'},
        ];
        const wrapper = mountGroup({
            options: tags,
            optionLabel: (tag: Tag) => tag.title.toUpperCase(),
            modelValue: ['a'],
        });

        expect(wrapper.findAll('.ui-check__label').map((label) => label.text())).toEqual(['BETA', 'ALPHA']);

        await wrapper.findAll('input[type="checkbox"]')[0].setValue(true); // add 'b'
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['b', 'a']]); // options order
    });
});
