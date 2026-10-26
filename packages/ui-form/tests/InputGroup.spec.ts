// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {h} from 'vue';

import InputGroup from '../src/components/InputGroup.vue';
import TextInput from '../src/components/TextInput.vue';

const control = () => h(TextInput, {id: 'rate', placeholder: 'Rate', modelValue: null});

describe('InputGroup', () => {
    it('joins the addon texts around its control, each with an id the control can name', () => {
        const wrapper = mount(InputGroup, {
            props: {id: 'rate', prepend: '€', append: 'per month'},
            slots: {default: control},
        });
        const [start, end] = wrapper.findAll('.ui-input-group__addon');

        expect(start!.text()).toBe('€');
        expect(start!.attributes('id')).toBe('rate-prepend');
        expect(end!.text()).toBe('per month');
        expect(end!.attributes('id')).toBe('rate-append');
        expect(wrapper.find('.is-start + .ui-input-wrap + .is-end').exists()).toBe(true);
    });

    it('renders only the addons it is given', () => {
        const end = mount(InputGroup, {props: {id: 'rate', append: 'days'}, slots: {default: control}});
        expect(end.findAll('.ui-input-group__addon')).toHaveLength(1);
        expect(end.find('.is-end').attributes('id')).toBe('rate-append');

        const start = mount(InputGroup, {props: {id: 'rate', prepend: '€'}, slots: {default: control}});
        expect(start.findAll('.ui-input-group__addon')).toHaveLength(1);
        expect(start.find('.is-start').attributes('id')).toBe('rate-prepend');
    });

    it('lets the control name its addons in aria-describedby, after the field message', () => {
        const wrapper = mount(InputGroup, {
            props: {id: 'rate', prepend: '€', append: 'per month'},
            slots: {
                default: () =>
                    h(TextInput, {
                        id: 'rate',
                        placeholder: 'Rate',
                        modelValue: null,
                        describedby: 'rate-error rate-prepend rate-append',
                    }),
            },
        });
        const described = wrapper.find('input').attributes('aria-describedby')!.split(' ');

        expect(described.slice(1).map((id) => wrapper.find(`#${id}`).text())).toEqual(['€', 'per month']);
    });
});
