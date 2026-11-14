// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {defineComponent, h, ref} from 'vue';

import NumberInput from '../src/components/NumberInput.vue';

describe('NumberInput', () => {
    it('renders a number input reflecting the model and valid state', () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', modelValue: 5}});
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('number');
        expect((input.element as HTMLInputElement).value).toBe('5');
        expect(input.classes()).toContain('ui-control');
        expect(input.classes()).not.toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBeUndefined();
        expect(input.attributes('aria-required')).toBeUndefined();
    });

    it('renders empty for a null model', () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', modelValue: null}});
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });

    it('honours placeholder/min/max/step/required/invalid/describedby', () => {
        const wrapper = mount(NumberInput, {
            props: {
                id: 'qty',
                modelValue: 3,
                placeholder: 'How many',
                min: 0,
                max: 10,
                step: 2,
                required: true,
                invalid: true,
                describedby: 'qty-error',
            },
        });
        const input = wrapper.find('input');

        expect(input.attributes('placeholder')).toBe('How many');
        expect(input.attributes('min')).toBe('0');
        expect(input.attributes('max')).toBe('10');
        expect(input.attributes('step')).toBe('2');
        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('qty-error');
    });

    it('emits the parsed number on input', async () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', modelValue: null}});
        await wrapper.find('input').setValue('42');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([42]);
    });

    it('emits null when the input is cleared (NaN guard, owned once)', async () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', modelValue: 7}});
        await wrapper.find('input').setValue('');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', disabled: true, modelValue: null}});
        expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });

    it('never writes the value to the attribute', async () => {
        const model = ref<number | null>(41);
        const wrapper = mount(
            defineComponent(
                () => () =>
                    h(NumberInput, {
                        id: 'f',
                        modelValue: model.value,
                        'onUpdate:modelValue': (value: number | null) => {
                            model.value = value;
                        },
                    }),
            ),
        );
        const field = wrapper.find('input');
        expect((field.element as HTMLInputElement).value).toBe('41');
        expect(field.attributes('value')).toBeUndefined();

        await field.setValue('42');
        expect(model.value).toBe(42);
        expect(field.attributes('value')).toBeUndefined();

        model.value = 43;
        await wrapper.vm.$nextTick();
        expect((field.element as HTMLInputElement).value).toBe('43');
        expect(wrapper.html()).not.toMatch(/41|42|43/);

        model.value = null;
        await wrapper.vm.$nextTick();
        expect((field.element as HTMLInputElement).value).toBe('');
    });
});
