// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';

import TimeInput from '../src/components/TimeInput.vue';

// happy-dom has no showPicker, as an older browser: calling it throws. A test that needs one stubs it.
const stubPicker = () => {
    const showPicker = vi.fn();
    Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {value: showPicker, configurable: true});
    return showPicker;
};

afterEach(() => {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker');
});

const mountTime = (props: Record<string, unknown> = {}) =>
    mount(TimeInput, {props: {id: 'start', modelValue: '09:30', ...props}, attachTo: document.body});

describe('TimeInput', () => {
    it('shows the time, and emits the typed one, an emptied field as null (no time)', async () => {
        const wrapper = mountTime();
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('time');
        expect(input.attributes('id')).toBe('start');
        expect(input.element.value).toBe('09:30');
        await input.setValue('14:15');
        await input.setValue('');

        expect(wrapper.emitted('update:modelValue')).toEqual([['14:15'], [null]]);
        wrapper.unmount();
    });

    it('renders null as an empty field', () => {
        const wrapper = mountTime({modelValue: null});

        expect(wrapper.find('input').element.value).toBe('');
        wrapper.unmount();
    });

    it("follows the parent's model", async () => {
        const wrapper = mountTime();
        const input = wrapper.find('input');

        await wrapper.setProps({modelValue: '17:45'});
        expect(input.element.value).toBe('17:45');
        await wrapper.setProps({modelValue: null});
        expect(input.element.value).toBe('');
        wrapper.unmount();
    });

    it('shows its own clock glyph, hidden from assistive tech, with room in the text for it', () => {
        const wrapper = mountTime();

        expect(wrapper.find('.ui-input__lead').attributes('aria-hidden')).toBe('true');
        expect(wrapper.find('input').classes()).toEqual(expect.arrayContaining(['ui-time', 'has-lead']));
        wrapper.unmount();
    });

    it('offers a clear button named by clearLabel while there is a time, which clears it and keeps focus on the input', async () => {
        const wrapper = mountTime({
            clearLabel: 'Wis tijd',
            'onUpdate:modelValue': (value: string | null) => wrapper.setProps({modelValue: value}),
        });
        const input = wrapper.find('input');
        const clear = wrapper.find('.ui-input__button');

        expect(input.classes()).toContain('has-button');
        expect(clear.attributes('type')).toBe('button');
        expect(clear.attributes('aria-label')).toBe('Wis tijd');
        expect(clear.attributes()).not.toHaveProperty('tabindex');
        const down = new MouseEvent('mousedown', {cancelable: true});
        clear.element.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);

        await clear.trigger('click');
        expect(wrapper.emitted('update:modelValue')).toEqual([[null]]);
        expect(input.element.value).toBe('');
        expect(wrapper.find('.ui-input__button').exists()).toBe(false);
        expect(document.activeElement).toBe(input.element);
        wrapper.unmount();
    });

    it.each([
        ['no clear label', {clearLabel: undefined}],
        ['no time', {modelValue: null}],
        ['an emptied time', {modelValue: ''}],
        ['disabled', {disabled: true}],
    ])('has no clear button with %s', (_, props) => {
        const wrapper = mountTime({clearLabel: 'Wis tijd', ...props});

        expect(wrapper.find('.ui-input__button').exists()).toBe(false);
        expect(wrapper.find('input').classes()).not.toContain('has-button');
        wrapper.unmount();
    });

    it('steps in minutes, and leaves the step to the browser without one', () => {
        const quarters = mountTime({step: 15});
        const plain = mountTime({id: 'end'});

        expect(quarters.find('input').attributes('step')).toBe('900');
        expect(plain.find('input').attributes()).not.toHaveProperty('step');
        quarters.unmount();
        plain.unmount();
    });

    it('opens the picker on a click and closes it on the next, or on blur', async () => {
        const showPicker = stubPicker();
        const wrapper = mountTime();
        const input = wrapper.find('input');

        await input.trigger('click');
        await input.trigger('click');
        await input.trigger('click');
        await input.trigger('blur');
        await input.trigger('click');

        expect(showPicker).toHaveBeenCalledTimes(3);
        wrapper.unmount();
    });

    it('opens the picker on the next click after a time was picked in it', async () => {
        const showPicker = stubPicker();
        const wrapper = mountTime();
        const input = wrapper.find('input');

        await input.trigger('click');
        await input.trigger('change');
        await input.trigger('click');

        expect(showPicker).toHaveBeenCalledTimes(2);
        wrapper.unmount();
    });

    it('opens the picker on the next click after a clear', async () => {
        const showPicker = stubPicker();
        const wrapper = mountTime({clearLabel: 'Wis tijd'});
        const input = wrapper.find('input');

        await input.trigger('click');
        await wrapper.find('.ui-input__button').trigger('click');
        await input.trigger('click');

        expect(showPicker).toHaveBeenCalledTimes(2);
        wrapper.unmount();
    });

    it('leaves a click to the field where the browser has no picker, and tries again on the next', async () => {
        const wrapper = mountTime();
        const input = wrapper.find('input');

        await input.trigger('click');
        const showPicker = stubPicker();
        await input.trigger('click');

        expect(showPicker).toHaveBeenCalledOnce();
        wrapper.unmount();
    });

    it('marks itself invalid with the error icon, wired to the message, and conveys required', () => {
        const marked = mountTime({invalid: true, describedby: 'start-error', required: true});
        const plain = mountTime({id: 'end'});
        const input = marked.find('input');

        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('start-error');
        expect(input.attributes('aria-required')).toBe('true');
        expect(marked.find('.ui-input__icon').exists()).toBe(true);
        expect(plain.find('input').attributes()).not.toHaveProperty('aria-invalid');
        expect(plain.find('input').attributes()).not.toHaveProperty('aria-required');
        expect(plain.find('.ui-input__icon').exists()).toBe(false);
        marked.unmount();
        plain.unmount();
    });

    it('disables the input', () => {
        const wrapper = mountTime({disabled: true});

        expect(wrapper.find('input').attributes()).toHaveProperty('disabled');
        wrapper.unmount();
    });

    it('focuses the input when it mounts with autofocus, and only then', () => {
        const focused = mountTime({autofocus: true});
        expect(document.activeElement).toBe(focused.find('input').element);
        focused.unmount();

        const plain = mountTime();
        expect(document.activeElement).not.toBe(plain.find('input').element);
        expect(plain.find('input').attributes()).not.toHaveProperty('autofocus');
        plain.unmount();
    });

    it('puts class and style on the wrapper and every other attribute on the input', () => {
        const wrapper = mount(TimeInput, {
            props: {id: 'start', modelValue: null},
            attrs: {class: 'w-37', style: 'margin: 1px', 'data-test': 'start-time'},
        });
        const input = wrapper.find('input');

        expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-input-wrap', 'w-37']));
        expect(wrapper.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('start-time');
        expect(input.classes()).not.toContain('w-37');
        expect(input.attributes()).not.toHaveProperty('style');
    });
});
