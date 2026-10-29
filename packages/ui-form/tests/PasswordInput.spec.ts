// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import PasswordInput from '../src/components/PasswordInput.vue';

const mountPassword = (props: Record<string, unknown> = {}) =>
    mount(PasswordInput, {
        props: {
            id: 'password',
            placeholder: 'Wachtwoord',
            autocomplete: 'current-password',
            modelValue: 'geheim',
            ...props,
        },
        attachTo: document.body,
    });

const pressKey = (wrapper: ReturnType<typeof mountPassword>, type: 'keydown' | 'keyup', capsLock: boolean) => {
    const event = new KeyboardEvent(type, {key: 'a'});
    Object.defineProperty(event, 'getModifierState', {value: (key: string) => key === 'CapsLock' && capsLock});
    wrapper.find('input').element.dispatchEvent(event);
    return wrapper.vm.$nextTick();
};

describe('PasswordInput', () => {
    it('renders a password input with its placeholder and autocomplete, and emits what is typed', async () => {
        const wrapper = mountPassword({autocomplete: 'new-password'});
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('password');
        expect(input.attributes('id')).toBe('password');
        expect(input.attributes('placeholder')).toBe('Wachtwoord');
        expect(input.attributes('autocomplete')).toBe('new-password');
        expect(input.element.value).toBe('geheim');
        await input.setValue('geheimer');

        expect(wrapper.emitted('update:modelValue')).toEqual([['geheimer']]);
        wrapper.unmount();
    });

    it('renders null as an empty field', () => {
        const wrapper = mountPassword({modelValue: null});

        expect(wrapper.find('input').element.value).toBe('');
        wrapper.unmount();
    });

    it('shows and hides the password with a toggle that keeps one name and says whether it is on', async () => {
        const wrapper = mountPassword();
        const input = wrapper.find('input');
        const toggle = wrapper.find('.ui-input__button');

        expect(toggle.attributes('type')).toBe('button');
        expect(toggle.attributes('aria-label')).toBe('Show password');
        expect(toggle.attributes('aria-controls')).toBe('password');
        expect(toggle.attributes('aria-pressed')).toBe('false');
        expect(toggle.attributes()).not.toHaveProperty('tabindex');
        expect(toggle.findAll('path')).toHaveLength(1);

        await toggle.trigger('click');
        expect(input.attributes('type')).toBe('text');
        expect(toggle.attributes('aria-pressed')).toBe('true');
        expect(toggle.attributes('aria-label')).toBe('Show password');
        expect(toggle.findAll('path')).toHaveLength(2);

        await toggle.trigger('click');
        expect(input.attributes('type')).toBe('password');
        expect(toggle.attributes('aria-pressed')).toBe('false');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        wrapper.unmount();
    });

    it('focuses the input, not the toggle, when the toggle is pressed with a pointer', () => {
        const wrapper = mountPassword();
        const down = new MouseEvent('mousedown', {cancelable: true});

        wrapper.find('.ui-input__button').element.dispatchEvent(down);

        expect(down.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(wrapper.find('input').element);
        wrapper.unmount();
    });

    it('names the toggle as asked', () => {
        const wrapper = mountPassword({showPasswordLabel: 'Toon wachtwoord'});

        expect(wrapper.find('.ui-input__button').attributes('aria-label')).toBe('Toon wachtwoord');
        wrapper.unmount();
    });

    it('shows the Caps Lock notice while a key says it is on, and reads it with the field', async () => {
        const wrapper = mountPassword({describedby: 'password-error', capsLockText: 'Capslock staat aan'});
        const input = wrapper.find('input');
        const notice = wrapper.find('.ui-password__caps');

        expect(notice.attributes('id')).toBe('password-caps');
        expect(notice.attributes('role')).toBe('status');
        expect(notice.text()).toBe('');
        expect(input.attributes('aria-describedby')).toBe('password-error');

        await pressKey(wrapper, 'keydown', true);
        expect(notice.text()).toBe('Capslock staat aan');
        expect(input.attributes('aria-describedby')).toBe('password-error password-caps');

        await pressKey(wrapper, 'keyup', false);
        expect(notice.text()).toBe('');
        expect(input.attributes('aria-describedby')).toBe('password-error');
        wrapper.unmount();
    });

    it('describes the field by the notice alone without a message, and by nothing while it is off', async () => {
        const wrapper = mountPassword();
        const input = wrapper.find('input');

        expect(input.attributes()).not.toHaveProperty('aria-describedby');
        await pressKey(wrapper, 'keyup', true);

        expect(input.attributes('aria-describedby')).toBe('password-caps');
        wrapper.unmount();
    });

    it('leaves the notice as it is on an autofill key event, which cannot say', async () => {
        const wrapper = mountPassword();
        await pressKey(wrapper, 'keydown', true);

        // a plain event, as autofill's; were it read, this reading would turn the notice off
        wrapper.find('input').element.dispatchEvent(Object.assign(new Event('keyup'), {getModifierState: () => false}));
        await wrapper.vm.$nextTick();

        expect(wrapper.find('.ui-password__caps').text()).toBe('Caps Lock is on');
        wrapper.unmount();
    });

    it('marks itself invalid with the error icon, and conveys required', () => {
        const marked = mountPassword({invalid: true, required: true});
        const plain = mountPassword();
        const input = marked.find('input');

        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-required')).toBe('true');
        expect(marked.find('.ui-input__icon').exists()).toBe(true);
        expect(plain.find('input').attributes()).not.toHaveProperty('aria-invalid');
        expect(plain.find('input').attributes()).not.toHaveProperty('aria-required');
        expect(plain.find('.ui-input__icon').exists()).toBe(false);
        marked.unmount();
        plain.unmount();
    });

    it('disables the input and the toggle together', () => {
        const disabled = mountPassword({disabled: true});
        const plain = mountPassword();

        expect(disabled.find('input').attributes()).toHaveProperty('disabled');
        expect(disabled.find('.ui-input__button').attributes()).toHaveProperty('disabled');
        expect(plain.find('.ui-input__button').attributes()).not.toHaveProperty('disabled');
        disabled.unmount();
        plain.unmount();
    });

    it('focuses the input when it mounts with autofocus, and only then', () => {
        const focused = mountPassword({autofocus: true});
        expect(document.activeElement).toBe(focused.find('input').element);
        focused.unmount();

        const plain = mountPassword();
        expect(document.activeElement).not.toBe(plain.find('input').element);
        expect(plain.find('input').attributes()).not.toHaveProperty('autofocus');
        plain.unmount();
    });

    it('puts class and style on the root and every other attribute on the input', () => {
        const wrapper = mount(PasswordInput, {
            props: {id: 'password', placeholder: 'Wachtwoord', autocomplete: 'current-password', modelValue: null},
            attrs: {class: 'w-60', style: 'margin: 1px', 'data-test': 'password-input'},
        });
        const input = wrapper.find('input');

        expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-password', 'w-60']));
        expect(wrapper.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('password-input');
        expect(input.classes()).not.toContain('w-60');
        expect(input.attributes()).not.toHaveProperty('style');
    });
});
