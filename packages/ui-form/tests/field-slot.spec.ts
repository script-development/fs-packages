// @vitest-environment happy-dom
import {mount, shallowMount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {defineComponent, h} from 'vue';

import {FormField, TextInput} from '../src';

interface FieldScope {
    field: {id: string; invalid: boolean; describedby: string | undefined};
}

// A control from OUTSIDE the package (a consumer's own control): plain props, no composable.
const OutsideControl = defineComponent({
    props: {
        id: {type: String, default: undefined},
        invalid: {type: Boolean, default: false},
        describedby: {type: String, default: undefined},
    },
    setup: (props) => () =>
        h('input', {id: props.id, 'aria-invalid': props.invalid || undefined, 'aria-describedby': props.describedby}),
});

// The documented shape: one v-bind of the slot's `field` on the control.
const spread =
    (control: unknown = OutsideControl, extra: Record<string, unknown> = {}) =>
    ({field}: FieldScope) =>
        h(control as never, {...field, ...extra});

const inField = (props: Record<string, unknown>, slot: (scope: FieldScope) => unknown) =>
    mount(FormField, {props, slots: {default: slot as never}});

describe('FormField hands its control one object to bind', () => {
    it('wires the control with one v-bind: id, mark and describedby, matching the label and the message', () => {
        const wrapper = inField({id: 'caseload', label: 'Caseload', error: 'Required'}, spread());
        const input = wrapper.find('input');

        expect(input.attributes('id')).toBe('caseload');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('caseload-error');
        expect(wrapper.find('label').attributes('for')).toBe('caseload');
        expect(wrapper.find('#caseload-error').text()).toBe('Required');
    });

    it('hands over exactly id, invalid and describedby: required stays on the label, the message on the field', () => {
        let received: FieldScope['field'] | undefined;
        const wrapper = inField({id: 'name', label: 'Name', required: true, error: 'Required'}, ({field}) => {
            received = field;
            return h('span');
        });

        expect(received).toStrictEqual({id: 'name', invalid: true, describedby: 'name-error'});
        expect(wrapper.find('.ui-label__req').exists()).toBe(true);
    });

    it('wires a control wrapped in an element the same way', () => {
        const wrapper = inField({id: 'wrapped', error: 'Required'}, ({field}) =>
            h('div', {class: 'relative'}, [h(OutsideControl, field)]),
        );

        expect(wrapper.find('input').attributes('aria-describedby')).toBe('wrapped-error');
    });

    it('follows the field when its error changes', async () => {
        const wrapper = inField({id: 'email'}, spread());

        await wrapper.setProps({error: 'Bad email'});
        expect(wrapper.find('input').attributes('aria-describedby')).toBe('email-error');

        await wrapper.setProps({error: undefined});
        expect(wrapper.find('input').attributes('aria-invalid')).toBeUndefined();
    });

    it('treats an empty error as no error, so describedby never points at a missing element', () => {
        const wrapper = inField({id: 'email', error: ''}, spread());

        expect(wrapper.find('.ui-error').exists()).toBe(false);
        expect(wrapper.find('input').attributes('aria-describedby')).toBeUndefined();
    });

    it('wires a package control: TextInput marks itself and names the message', () => {
        const input = inField(
            {id: 'email', label: 'Email', error: 'Bad email'},
            spread(TextInput, {placeholder: 'you@example.com', modelValue: ''}),
        ).find('input');

        expect(input.attributes('id')).toBe('email');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('email-error');
    });

    it('wires a shallow-mounted consumer: the stubbed control receives the bound props', () => {
        const Host = defineComponent({
            setup: () => () =>
                h(
                    FormField,
                    {id: 'shallow', error: 'Required'},
                    {default: spread(TextInput, {placeholder: 'Name', modelValue: ''})},
                ),
        });
        const control = shallowMount(Host, {global: {stubs: {FormField: false}}}).findComponent(TextInput);

        expect(control.props('id')).toBe('shallow');
        expect(control.props('invalid')).toBe(true);
        expect(control.props('describedby')).toBe('shallow-error');
    });

    it('renders a field with no slot content', () => {
        expect(
            mount(FormField, {props: {id: 'empty'}})
                .find('.ui-field__control')
                .exists(),
        ).toBe(true);
    });
});
