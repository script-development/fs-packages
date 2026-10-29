// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import FormError from '../src/components/FormError.vue';

describe('FormError', () => {
    it('renders the error text with its id and alert role', () => {
        const wrapper = mount(FormError, {props: {error: 'Required', id: 'email-error'}});
        const paragraph = wrapper.find('p.ui-error');
        expect(paragraph.text()).toBe('Required');
        expect(paragraph.attributes('id')).toBe('email-error');
        expect(paragraph.attributes('role')).toBe('alert');
    });

    it('renders nothing for an empty error, so no empty alert is announced', () => {
        const wrapper = mount(FormError, {props: {error: '', id: 'email-error'}});
        expect(wrapper.find('p.ui-error').exists()).toBe(false);
    });

    it("renders nothing without an error, so a bag's missing key binds as is", () => {
        const wrapper = mount(FormError, {props: {id: 'email-error'}});
        expect(wrapper.find('p.ui-error').exists()).toBe(false);
    });
});
