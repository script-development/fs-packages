// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

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

    it('shows the calendar date of an ISO datetime, as a Laravel date cast sends it, and leaves the model as is', () => {
        const wrapper = mount(DateInput, {props: {id: 'start', modelValue: '2026-09-05T00:00:00.000000Z'}});

        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('2026-09-05');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('emits the picked date as YYYY-MM-DD when the model held a datetime', async () => {
        const wrapper = mount(DateInput, {props: {id: 'start', modelValue: '2026-09-05T00:00:00.000000Z'}});
        await wrapper.find('input').setValue('2026-09-06');

        expect(wrapper.emitted('update:modelValue')?.[0]).toEqual(['2026-09-06']);
    });

    it('renders empty for a null model', () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', modelValue: null}});
        expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    });

    it("follows the parent's model: a new date shows, and null shows an empty field", async () => {
        const wrapper = mount(DateInput, {props: {id: 'dob', modelValue: '2026-07-17'}});
        const input = wrapper.find('input').element as HTMLInputElement;

        await wrapper.setProps({modelValue: '2026-08-01'});
        expect(input.value).toBe('2026-08-01');

        await wrapper.setProps({modelValue: null});
        expect(input.value).toBe('');
    });

    it('puts every attribute, class and style included, on the input: it is its own root', () => {
        const wrapper = mount(DateInput, {
            props: {id: 'dob', modelValue: null},
            attrs: {class: 'w-40', style: 'margin: 1px', 'data-test': 'dob', autocomplete: 'bday'},
        });
        const input = wrapper.find('input');

        expect(wrapper.element).toBe(input.element);
        expect(input.classes()).toEqual(expect.arrayContaining(['ui-control', 'w-40']));
        expect(input.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('dob');
        expect(input.attributes('autocomplete')).toBe('bday');
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
});
