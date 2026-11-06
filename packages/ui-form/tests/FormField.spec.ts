// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {h} from 'vue';

import type {FieldBinding} from '../src';

import FormField from '../src/components/FormField.vue';

// A slot stub that renders the `field` object the slot hands the control, so we can assert it.
const wiringSlot = ({field}: {field: FieldBinding}) => `id:${field.id}|inv:${field.invalid}|db:${field.describedby}`;

describe('FormField', () => {
    it('renders a label, generates matching control/error ids, and reports valid state', () => {
        const wrapper = mount(FormField, {
            props: {label: 'Email', required: true, id: 'email'},
            slots: {default: wiringSlot},
        });

        expect(wrapper.find('label.ui-label').text()).toContain('Email');
        expect(wrapper.find('.ui-label__req').exists()).toBe(true);
        expect(wrapper.text()).toContain('id:email|inv:false|db:undefined');
        expect(wrapper.find('.ui-error').exists()).toBe(false);
    });

    it('renders the error and threads describedby to the slot when invalid', () => {
        const wrapper = mount(FormField, {
            props: {label: 'Email', id: 'email', error: 'Bad email'},
            slots: {default: wiringSlot},
        });

        expect(wrapper.find('.ui-error').text()).toBe('Bad email');
        expect(wrapper.find('.ui-error').attributes('id')).toBe('email-error');
        expect(wrapper.text()).toContain('inv:true|db:email-error');
    });

    it('hands a native element the same wiring as aria attributes, named by the label', () => {
        let aria!: Record<string, unknown>;
        const wrapper = mount(FormField, {
            props: {label: 'Laws', id: 'laws', error: 'Pick one'},
            slots: {
                default: (scope: {aria: Record<string, unknown>}) => {
                    aria = scope.aria;
                    return h('div', {role: 'group', ...scope.aria});
                },
            },
        });

        expect(wrapper.find('label').attributes('id')).toBe('laws-label');
        expect(aria).toEqual({
            id: 'laws',
            'aria-labelledby': 'laws-label',
            'aria-invalid': 'true',
            'aria-describedby': 'laws-error',
        });
        expect(wrapper.find('[role="group"]').attributes()).not.toHaveProperty('invalid');
    });

    it('leaves aria-invalid and aria-labelledby off while there is no message and no label', () => {
        let aria!: Record<string, unknown>;
        mount(FormField, {
            props: {id: 'laws'},
            slots: {
                default: (scope: {aria: Record<string, unknown>}) => {
                    aria = scope.aria;
                    return h('div');
                },
            },
        });

        // absent, not undefined: an aria-labelledby of your own then holds wherever it sits next to v-bind="aria"
        expect(Object.keys(aria)).toEqual(['id']);
    });

    it("keeps an aria attribute of the consumer's own that the field leaves out, in any binding order", () => {
        const wrapper = mount(FormField, {
            props: {id: 'laws'},
            slots: {
                default: (scope: {aria: Record<string, unknown>}) =>
                    h('div', {'aria-labelledby': 'mine', ...scope.aria}),
            },
        });

        expect(wrapper.find('div[id="laws"]').attributes('aria-labelledby')).toBe('mine');
    });

    it('omits the label when none is given, keeping the wiring on the provided id', () => {
        const wrapper = mount(FormField, {props: {id: 'search'}, slots: {default: wiringSlot}});

        expect(wrapper.find('label').exists()).toBe(false);
        expect(wrapper.text()).toContain('id:search|');
    });

    it('renders the vertical default with the control wrapped and no horizontal class', () => {
        const wrapper = mount(FormField, {props: {id: 'email'}, slots: {default: wiringSlot}});

        expect(wrapper.find('.ui-field').classes()).not.toContain('is-horizontal');
        expect(wrapper.find('.ui-field__control').exists()).toBe(true);
        expect(wrapper.find('.ui-field__control').text()).toContain('id:email');
    });

    it('marks the field horizontal when orientation is set on a labelled field', () => {
        const wrapper = mount(FormField, {
            props: {id: 'email', label: 'Email', orientation: 'horizontal'},
            slots: {default: wiringSlot},
        });

        expect(wrapper.find('.ui-field').classes()).toContain('is-horizontal');
    });

    it('ignores orientation without a label, so no empty label column is reserved', () => {
        const wrapper = mount(FormField, {
            props: {id: 'accept', orientation: 'horizontal'},
            slots: {default: wiringSlot},
        });

        expect(wrapper.find('.ui-field').classes()).not.toContain('is-horizontal');
    });

    it('keeps multi-node slot content together inside the control wrapper', () => {
        const wrapper = mount(FormField, {
            props: {id: 'email', orientation: 'horizontal'},
            slots: {default: '<input class="ui-control" /><small class="hint">Work address</small>'},
        });

        const control = wrapper.find('.ui-field__control');
        expect(control.find('input.ui-control').exists()).toBe(true);
        expect(control.find('small.hint').exists()).toBe(true);
        expect(wrapper.findAll('.ui-field > *')).toHaveLength(1);
    });
});
