// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {defineComponent, h, ref} from 'vue';

import TextInput from '../src/components/TextInput.vue';

describe('TextInput', () => {
    it('renders a text input by default, reflecting the model and valid state', () => {
        const wrapper = mount(TextInput, {props: {id: 'name', modelValue: 'hi'}});
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
                id: 'pw',
                type: 'password',
                placeholder: 'Password',
                required: true,
                invalid: true,
                describedby: 'pw-error',
                modelValue: '',
            },
        });
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('password');
        expect(input.attributes('placeholder')).toBe('Password');
        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('pw-error');

        await input.setValue('secret');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['secret']);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(TextInput, {props: {id: 'd', disabled: true, modelValue: ''}});
        expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });

    it('renders empty for a null model (binds a nullable backend field directly)', () => {
        const wrapper = mount(TextInput, {props: {id: 'name', modelValue: null}});
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });

    it.each(['text', 'email', 'password', 'search', 'tel', 'url'] as const)(
        'never writes the value to the attribute (type %s)',
        async (type) => {
            const model = ref<string | null>('from-parent');
            const wrapper = mount(
                defineComponent(
                    () => () =>
                        h(TextInput, {
                            id: 'f',
                            type,
                            modelValue: model.value,
                            'onUpdate:modelValue': (value: string) => {
                                model.value = value;
                            },
                        }),
                ),
            );
            const input = wrapper.find('input');
            expect((input.element as HTMLInputElement).value).toBe('from-parent');
            expect(input.attributes('value')).toBeUndefined();

            await input.setValue('typed');
            expect(model.value).toBe('typed');
            expect(input.attributes('value')).toBeUndefined();

            model.value = 'set-later';
            await wrapper.vm.$nextTick();
            expect((input.element as HTMLInputElement).value).toBe('set-later');
            expect(wrapper.html()).not.toMatch(/from-parent|typed|set-later/);
        },
    );
});
