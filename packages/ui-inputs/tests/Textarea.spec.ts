// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {defineComponent, h, ref} from 'vue';

import Textarea from '../src/components/Textarea.vue';

describe('Textarea', () => {
    it('renders a textarea reflecting the model and valid state', () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', modelValue: 'hello'}});
        const textarea = wrapper.find('textarea');

        expect((textarea.element as HTMLTextAreaElement).value).toBe('hello');
        expect(textarea.classes()).toContain('ui-control');
        expect(textarea.classes()).toContain('ui-textarea');
        expect(textarea.classes()).not.toContain('is-invalid');
        expect(textarea.attributes('aria-invalid')).toBeUndefined();
        expect(textarea.attributes('aria-required')).toBeUndefined();
    });

    it('renders empty for a null model', () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', modelValue: null}});
        expect((wrapper.find('textarea').element as HTMLTextAreaElement).value).toBe('');
    });

    it('honours placeholder/rows/required/invalid/describedby', () => {
        const wrapper = mount(Textarea, {
            props: {
                id: 'notes',
                modelValue: 'hi',
                placeholder: 'Notes',
                rows: 4,
                required: true,
                invalid: true,
                describedby: 'notes-error',
            },
        });
        const textarea = wrapper.find('textarea');

        expect(textarea.attributes('placeholder')).toBe('Notes');
        expect(textarea.attributes('rows')).toBe('4');
        expect(textarea.classes()).toContain('is-invalid');
        expect(textarea.attributes('aria-invalid')).toBe('true');
        expect(textarea.attributes('aria-required')).toBe('true');
        expect(textarea.attributes('aria-describedby')).toBe('notes-error');
    });

    it('emits the text on input', async () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', modelValue: null}});
        await wrapper.find('textarea').setValue('a note');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['a note']);
    });

    it("emits '' when the textarea is cleared (raw native value; middleware maps to null)", async () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', modelValue: 'hi'}});
        await wrapper.find('textarea').setValue('');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['']);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(Textarea, {props: {id: 'notes', disabled: true, modelValue: null}});
        expect(wrapper.find('textarea').attributes('disabled')).toBeDefined();
    });

    it('never writes the value to the attribute', async () => {
        const model = ref<string | null>('from-parent');
        const wrapper = mount(
            defineComponent(
                () => () =>
                    h(Textarea, {
                        id: 'f',
                        modelValue: model.value,
                        'onUpdate:modelValue': (value: string | null) => {
                            model.value = value;
                        },
                    }),
            ),
        );
        const field = wrapper.find('textarea');
        expect((field.element as HTMLTextAreaElement).value).toBe('from-parent');
        expect(field.attributes('value')).toBeUndefined();

        await field.setValue('typed');
        expect(model.value).toBe('typed');
        expect(field.attributes('value')).toBeUndefined();

        model.value = 'set-later';
        await wrapper.vm.$nextTick();
        expect((field.element as HTMLTextAreaElement).value).toBe('set-later');
        expect(wrapper.html()).not.toMatch(/from-parent|typed|set-later/);

        model.value = null;
        await wrapper.vm.$nextTick();
        expect((field.element as HTMLTextAreaElement).value).toBe('');
    });
});
