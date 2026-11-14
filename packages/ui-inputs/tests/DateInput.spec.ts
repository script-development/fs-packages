// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {defineComponent, h, ref} from 'vue';

import DateInput from '../src/components/DateInput.vue';

describe('DateInput', () => {
    it('renders a date input reflecting the model and valid state', () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', modelValue: '2026-07-17'}});
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('date');
        expect((input.element as HTMLInputElement).value).toBe('2026-07-17');
        expect(input.classes()).toContain('ui-control');
        expect(input.classes()).not.toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBeUndefined();
        expect(input.attributes('aria-required')).toBeUndefined();
    });

    it('renders empty for a null model', () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', modelValue: null}});
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });

    it('honours min/max/required/invalid/describedby', () => {
        const wrapper = mount(DateInput, {
            props: {
                id: 'dob',
                modelValue: '2026-07-17',
                min: '2026-01-01',
                max: '2026-12-31',
                required: true,
                invalid: true,
                describedby: 'dob-error',
            },
        });
        const input = wrapper.find('input');

        expect(input.attributes('min')).toBe('2026-01-01');
        expect(input.attributes('max')).toBe('2026-12-31');
        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('dob-error');
    });

    it('emits the date string on input', async () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', modelValue: null}});
        await wrapper.find('input').setValue('2026-03-01');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-03-01']);
    });

    it("emits '' when the date is cleared (raw native value; middleware maps to null)", async () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', modelValue: '2026-07-17'}});
        await wrapper.find('input').setValue('');
        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['']);
    });

    it('renders the disabled attribute when disabled', () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', disabled: true, modelValue: null}});
        expect(wrapper.find('input').attributes('disabled')).toBeDefined();
    });

    it('never writes the value to the attribute', async () => {
        const model = ref<string | null>('2026-11-12');
        const wrapper = mount(
            defineComponent(
                () => () =>
                    h(DateInput, {
                        id: 'f',
                        modelValue: model.value,
                        'onUpdate:modelValue': (value: string | null) => {
                            model.value = value;
                        },
                    }),
            ),
        );
        const field = wrapper.find('input');
        expect((field.element as HTMLInputElement).value).toBe('2026-11-12');
        expect(field.attributes('value')).toBeUndefined();

        await field.setValue('2026-11-13');
        expect(model.value).toBe('2026-11-13');
        expect(field.attributes('value')).toBeUndefined();

        model.value = '2026-11-14';
        await wrapper.vm.$nextTick();
        expect((field.element as HTMLInputElement).value).toBe('2026-11-14');
        expect(wrapper.html()).not.toMatch(/2026-11-1[234]/);

        model.value = null;
        await wrapper.vm.$nextTick();
        expect((field.element as HTMLInputElement).value).toBe('');
    });
});
