// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import Switch from '../src/components/Switch.vue';

describe('Switch', () => {
    it('renders a native checkbox with role="switch", a thumb, and its prop label', () => {
        const wrapper = mount(Switch, {props: {id: 'notify', label: 'Notifications', modelValue: false}});
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('checkbox');
        expect(input.attributes('role')).toBe('switch');
        expect(wrapper.find('.ui-switch__thumb').exists()).toBe(true);
        expect(wrapper.find('.ui-switch__label').text()).toBe('Notifications');
        // aria-checked is never set by hand: for role="switch" on a native checkbox the
        // checked state itself is the conveyance (HTML-AAM) — a stale hand-set attribute
        // could contradict the real state.
        expect(input.attributes('aria-checked')).toBeUndefined();
        expect(input.attributes('required')).toBeUndefined();
    });

    it('round-trips the boolean model through the native checked state', async () => {
        const wrapper = mount(Switch, {props: {id: 's', modelValue: false}});
        const input = wrapper.find('input');

        await input.setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([true]);

        await wrapper.setProps({modelValue: true});
        expect((input.element as HTMLInputElement).checked).toBe(true);

        await input.setValue(false);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([false]);
    });

    it('honours required/invalid/describedby aria wiring', () => {
        const wrapper = mount(Switch, {
            props: {id: 's', modelValue: false, required: true, invalid: true, describedby: 's-error'},
        });
        const input = wrapper.find('input');

        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('s-error');
        expect(input.classes()).toContain('is-invalid');
    });

    it('lets the default slot override the prop label, and renders no label span with neither', () => {
        const slotted = mount(Switch, {
            props: {id: 's', modelValue: false, label: 'Plain'},
            slots: {default: 'Slotted'},
        });
        expect(slotted.find('.ui-switch__label').text()).toBe('Slotted');

        const bare = mount(Switch, {props: {id: 's', modelValue: false}});
        expect(bare.find('.ui-switch__label').exists()).toBe(false);
    });

    it('renders disabled', () => {
        const wrapper = mount(Switch, {props: {id: 's', modelValue: false, disabled: true}});

        expect(wrapper.find('input').attributes('disabled')).toBeDefined();
        expect(wrapper.find('.ui-switch').classes()).toContain('is-disabled');
    });

    it('falls native attrs through to the input, not the label root', () => {
        const wrapper = mount(Switch, {props: {id: 's', modelValue: false}, attrs: {name: 'notifications'}});

        expect(wrapper.find('input').attributes('name')).toBe('notifications');
        expect(wrapper.find('label').attributes('name')).toBeUndefined();
    });
    it('puts class and style on the label root and every other attribute on the input', () => {
        const wrapper = mount(Switch, {
            props: {id: 'c', label: 'Accept', modelValue: false},
            attrs: {class: 'w-40', style: 'margin: 1px', 'data-test': 'accept'},
        });
        const input = wrapper.find('input');

        expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-switch', 'w-40']));
        expect(wrapper.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('accept');
        expect(input.classes()).not.toContain('w-40');
        expect(input.attributes('style')).toBeUndefined();
    });
});
