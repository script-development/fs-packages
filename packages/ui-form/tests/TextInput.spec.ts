// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import TextInput from '../src/components/TextInput.vue';

describe('TextInput', () => {
    it('renders a text input by default, reflecting the model and valid state', () => {
        const wrapper = mount(TextInput, {props: {id: 'name', placeholder: 'Name', modelValue: 'hi'}});
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('text');
        expect((input.element as HTMLInputElement).value).toBe('hi');
        expect(input.classes()).toContain('ui-control');
        expect(input.classes()).not.toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBeUndefined();
        expect(input.attributes('aria-required')).toBeUndefined();
    });

    it('honours type/placeholder/required/invalid/describedby and emits on input', async () => {
        const wrapper = mount(TextInput, {
            props: {
                id: 'email',
                type: 'email',
                placeholder: 'Email',
                required: true,
                invalid: true,
                describedby: 'email-error',
                modelValue: '',
            },
        });
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('email');
        expect(input.attributes('placeholder')).toBe('Email');
        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('email-error');

        await input.setValue('a@b.nl');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['a@b.nl']);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(TextInput, {props: {id: 'd', placeholder: 'Name', disabled: true, modelValue: ''}});
        expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });

    it("follows the parent's model: a new value shows, and null shows an empty field", async () => {
        const wrapper = mount(TextInput, {props: {id: 'name', placeholder: 'Name', modelValue: 'hi'}});
        const input = wrapper.find('input').element as HTMLInputElement;

        await wrapper.setProps({modelValue: 'there'});
        expect(input.value).toBe('there');

        await wrapper.setProps({modelValue: null});
        expect(input.value).toBe('');
    });

    it('renders empty for a null model (binds a nullable backend field directly)', () => {
        const wrapper = mount(TextInput, {props: {id: 'name', placeholder: 'Name', modelValue: null}});
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });
});

describe('TextInput error icon and attributes', () => {
    it('shows the in-input error icon only while marked, hidden from assistive tech', async () => {
        const wrapper = mount(TextInput, {props: {id: 'name', placeholder: 'Name', modelValue: ''}});
        expect(wrapper.find('.ui-input__icon').exists()).toBe(false);

        await wrapper.setProps({invalid: true});
        expect(wrapper.find('.ui-input__icon').attributes('aria-hidden')).toBe('true');

        await wrapper.setProps({invalid: false});
        expect(wrapper.find('.ui-input__icon').exists()).toBe(false);
    });

    it('puts class and style on the wrapper and every other attribute on the input', () => {
        const wrapper = mount(TextInput, {
            props: {id: 'name', placeholder: 'Name', modelValue: ''},
            attrs: {class: 'w-40', style: 'margin: 1px', 'data-test': 'name', autocomplete: 'off'},
        });
        const input = wrapper.find('input');

        expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-input-wrap', 'w-40']));
        expect(wrapper.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('name');
        expect(input.attributes('autocomplete')).toBe('off');
        expect(input.classes()).not.toContain('w-40');
    });
});

describe('TextInput autofocus', () => {
    it('focuses the input when it mounts, also when that happens after page load (a dialog)', () => {
        const wrapper = mount(TextInput, {
            props: {id: 'name', placeholder: 'Name', modelValue: '', autofocus: true},
            attachTo: document.body,
        });

        expect(document.activeElement).toBe(wrapper.find('input').element);
        wrapper.unmount();
    });

    it('leaves focus alone without it, and never renders the native attribute', () => {
        const wrapper = mount(TextInput, {
            props: {id: 'name', placeholder: 'Name', modelValue: ''},
            attachTo: document.body,
        });

        expect(document.activeElement).not.toBe(wrapper.find('input').element);
        expect(wrapper.find('input').attributes()).not.toHaveProperty('autofocus');
        wrapper.unmount();
    });
});
