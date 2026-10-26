// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import NumberInput from '../src/components/NumberInput.vue';

describe('NumberInput', () => {
    it('renders a number input reflecting the model and valid state', () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', placeholder: 'How many', modelValue: 5}});
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('number');
        expect((input.element as HTMLInputElement).value).toBe('5');
        expect(input.classes()).toContain('ui-control');
        expect(input.classes()).not.toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBeUndefined();
        expect(input.attributes('aria-required')).toBeUndefined();
    });

    it('renders empty for a null model', () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', placeholder: 'How many', modelValue: null}});
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });

    it("follows the parent's model: a new number shows, and null shows an empty field", async () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', placeholder: 'How many', modelValue: 3}});
        const input = wrapper.find('input').element as HTMLInputElement;

        await wrapper.setProps({modelValue: 7});
        expect(input.value).toBe('7');

        await wrapper.setProps({modelValue: null});
        expect(input.value).toBe('');
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
        const wrapper = mount(NumberInput, {props: {id: 'qty', placeholder: 'How many', modelValue: null}});
        await wrapper.find('input').setValue('42');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([42]);
    });

    it('emits null when the input is cleared (NaN guard, owned once)', async () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', placeholder: 'How many', modelValue: 7}});
        await wrapper.find('input').setValue('');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(NumberInput, {
            props: {id: 'qty', placeholder: 'How many', disabled: true, modelValue: null},
        });
        expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });
});

describe('NumberInput autofocus and class', () => {
    it('focuses the input when it mounts with autofocus, and only then', () => {
        const focused = mount(NumberInput, {
            props: {id: 'qty', placeholder: 'How many', modelValue: null, autofocus: true},
            attachTo: document.body,
        });
        expect(document.activeElement).toBe(focused.find('input').element);
        focused.unmount();

        const plain = mount(NumberInput, {
            props: {id: 'qty', placeholder: 'How many', modelValue: null},
            attachTo: document.body,
        });
        expect(document.activeElement).not.toBe(plain.find('input').element);
        expect(plain.find('input').attributes()).not.toHaveProperty('autofocus');
        plain.unmount();
    });
});

describe('NumberInput error icon and attributes', () => {
    it('shows the in-input error icon only while marked, hidden from assistive tech', async () => {
        const wrapper = mount(NumberInput, {props: {id: 'qty', placeholder: 'How many', modelValue: null}});
        expect(wrapper.find('.ui-input__icon').exists()).toBe(false);

        await wrapper.setProps({invalid: true});
        expect(wrapper.find('.ui-input__icon').attributes('aria-hidden')).toBe('true');

        await wrapper.setProps({invalid: false});
        expect(wrapper.find('.ui-input__icon').exists()).toBe(false);
    });

    it('puts class and style on the wrapper and every other attribute on the input', () => {
        const wrapper = mount(NumberInput, {
            props: {id: 'qty', placeholder: 'How many', modelValue: null},
            attrs: {class: 'w-40', style: 'margin: 1px', 'data-test': 'amount', inputmode: 'decimal'},
        });
        const input = wrapper.find('input');

        expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-input-wrap', 'w-40']));
        expect(wrapper.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('amount');
        expect(input.attributes('inputmode')).toBe('decimal');
        expect(input.classes()).not.toContain('w-40');
    });
});
