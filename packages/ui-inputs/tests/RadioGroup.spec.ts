// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import RadioGroup from '../src/components/RadioGroup.vue';

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
    mount(RadioGroup as any, {
        props: {options: FRUITS, optionLabel: 'name', label: 'Fruit', id: 'fruit', modelValue: null, ...props},
    });

describe('RadioGroup', () => {
    it('renders a radiogroup fieldset with legend and native radios sharing one name, none checked for a null model', () => {
        const wrapper = mountGroup({});

        const fieldset = wrapper.find('fieldset');
        expect(fieldset.classes()).toContain('ui-radio-group');
        expect(fieldset.attributes('role')).toBe('radiogroup');
        expect(fieldset.attributes('id')).toBe('fruit');
        expect(wrapper.find('legend').text()).toBe('Fruit');

        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios).toHaveLength(3);
        // One shared generated name (the group id) — this is what buys the NATIVE roving
        // focus and arrow-key selection; the component hand-rolls neither.
        expect(new Set(radios.map((radio) => radio.attributes('name')))).toEqual(new Set(['fruit']));
        expect(radios.map((radio) => radio.attributes('id'))).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(radios.map((radio) => radio.attributes('value'))).toEqual(['1', '2', '3']);
        expect(radios.every((radio) => !(radio.element as HTMLInputElement).checked)).toBe(true);
        expect(wrapper.findAll('.ui-check__label').map((label) => label.text())).toEqual([
            'Watermelon',
            'Apricot',
            'Mango',
        ]);
    });

    it('follows the native change event: selecting emits the option id, prop drives checked', async () => {
        const wrapper = mountGroup({});
        const radios = wrapper.findAll('input[type="radio"]');

        // The model follows `change` — exactly what native arrow-key selection fires (the
        // real arrow-key walk is pinned in the browser-mode interaction suite; happy-dom
        // implements no radio roving).
        await radios[1].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2]);

        await wrapper.setProps({modelValue: 2});
        expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true, false]);

        await radios[2].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]);
    });

    it('conveys required via aria-required on the radiogroup plus the legend marker', () => {
        const wrapper = mountGroup({required: true});

        // Unlike role=group, radiogroup legitimately carries aria-required — so here the
        // attribute IS the group-level conveyance (no sr-only text needed).
        expect(wrapper.find('fieldset').attributes('aria-required')).toBe('true');
        expect(wrapper.find('.ui-label__req').text()).toBe('*');

        const bare = mountGroup({});
        expect(bare.find('fieldset').attributes('aria-required')).toBeUndefined();
        expect(bare.find('.ui-label__req').exists()).toBe(false);
    });

    it('wires invalid and describedby with ONE described-by story: the IDREF on the fieldset only', () => {
        const wrapper = mountGroup({invalid: true, describedby: 'fruit-error'});

        const fieldset = wrapper.find('fieldset');
        expect(fieldset.attributes('aria-invalid')).toBe('true');
        expect(fieldset.attributes('aria-describedby')).toBe('fruit-error');

        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios.every((radio) => radio.classes().includes('is-invalid'))).toBe(true);
        expect(radios.every((radio) => radio.attributes('aria-describedby') === undefined)).toBe(true);
    });

    it('disables every radio and ignores a change reaching the handler anyway', async () => {
        const wrapper = mountGroup({disabled: true});
        const radios = wrapper.findAll('input[type="radio"]');

        expect(radios.every((radio) => radio.attributes('disabled') !== undefined)).toBe(true);
        expect(wrapper.findAll('.ui-radio').every((row) => row.classes().includes('is-disabled'))).toBe(true);

        // Native dispatch — VTU setValue() skips disabled elements (vacuous-assertion trap).
        const first = radios[0].element as HTMLInputElement;
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
            modelValue: 'a',
        });

        expect(wrapper.findAll('.ui-check__label').map((label) => label.text())).toEqual(['BETA', 'ALPHA']);
        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true]);

        await radios[0].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b']);
    });
});
