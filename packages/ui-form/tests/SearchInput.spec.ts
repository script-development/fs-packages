// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import SearchInput from '../src/components/SearchInput.vue';

const mountSearch = (props: Record<string, unknown> = {}) =>
    mount(SearchInput, {
        props: {id: 'search', placeholder: 'Zoek een cliënt', modelValue: 'Jan', ...props},
        attachTo: document.body,
    });

describe('SearchInput', () => {
    it('renders a search input with its placeholder, and emits what is typed', async () => {
        const wrapper = mountSearch();
        const input = wrapper.find('input');

        expect(input.attributes('type')).toBe('search');
        expect(input.attributes('id')).toBe('search');
        expect(input.attributes('placeholder')).toBe('Zoek een cliënt');
        expect(input.element.value).toBe('Jan');
        await input.setValue('Jans');

        expect(wrapper.emitted('update:modelValue')).toEqual([['Jans']]);
        wrapper.unmount();
    });

    it('renders null as an empty field', () => {
        const wrapper = mountSearch({modelValue: null});

        expect(wrapper.find('input').element.value).toBe('');
        wrapper.unmount();
    });

    it("follows the parent's model", async () => {
        const wrapper = mountSearch();
        const input = wrapper.find('input');

        await wrapper.setProps({modelValue: 'Piet'});
        expect(input.element.value).toBe('Piet');
        await wrapper.setProps({modelValue: null});
        expect(input.element.value).toBe('');
        wrapper.unmount();
    });

    it('shows its own magnifier, hidden from assistive tech, with room in the text for it', () => {
        const wrapper = mountSearch();

        expect(wrapper.find('.ui-input__lead').attributes('aria-hidden')).toBe('true');
        expect(wrapper.find('input').classes()).toEqual(expect.arrayContaining(['ui-search', 'has-lead']));
        wrapper.unmount();
    });

    it('offers a clear button named by clearLabel while there is text, which clears it and keeps focus on the input', async () => {
        const wrapper = mountSearch({
            clearLabel: 'Wis zoekterm',
            'onUpdate:modelValue': (value: string) => wrapper.setProps({modelValue: value}),
        });
        const input = wrapper.find('input');
        const clear = wrapper.find('.ui-input__button');

        expect(input.classes()).toContain('has-button');
        expect(clear.attributes('type')).toBe('button');
        expect(clear.attributes('aria-label')).toBe('Wis zoekterm');
        expect(clear.attributes()).not.toHaveProperty('tabindex');
        const down = new MouseEvent('mousedown', {cancelable: true});
        clear.element.dispatchEvent(down);
        expect(down.defaultPrevented).toBe(true);

        await clear.trigger('click');
        expect(wrapper.emitted('update:modelValue')).toEqual([['']]);
        expect(input.element.value).toBe('');
        expect(wrapper.find('.ui-input__button').exists()).toBe(false);
        expect(document.activeElement).toBe(input.element);
        wrapper.unmount();
    });

    it.each([
        ['no clear label', {clearLabel: undefined}],
        ['no text', {modelValue: null}],
        ['an empty text', {modelValue: ''}],
        ['disabled', {disabled: true}],
    ])('has no clear button with %s', (_, props) => {
        const wrapper = mountSearch({clearLabel: 'Wis zoekterm', ...props});

        expect(wrapper.find('.ui-input__button').exists()).toBe(false);
        expect(wrapper.find('input').classes()).not.toContain('has-button');
        wrapper.unmount();
    });

    it('marks itself invalid with the error icon, wired to the message, and conveys required', () => {
        const marked = mountSearch({invalid: true, describedby: 'search-error', required: true});
        const plain = mountSearch({id: 'other-search'});
        const input = marked.find('input');

        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('search-error');
        expect(input.attributes('aria-required')).toBe('true');
        expect(marked.find('.ui-input__icon').exists()).toBe(true);
        expect(plain.find('input').attributes()).not.toHaveProperty('aria-invalid');
        expect(plain.find('input').attributes()).not.toHaveProperty('aria-required');
        expect(plain.find('.ui-input__icon').exists()).toBe(false);
        marked.unmount();
        plain.unmount();
    });

    it('disables the input', () => {
        const wrapper = mountSearch({disabled: true});

        expect(wrapper.find('input').attributes()).toHaveProperty('disabled');
        wrapper.unmount();
    });

    it('focuses the input when it mounts with autofocus, and only then', () => {
        const focused = mountSearch({autofocus: true});
        expect(document.activeElement).toBe(focused.find('input').element);
        focused.unmount();

        const plain = mountSearch();
        expect(document.activeElement).not.toBe(plain.find('input').element);
        expect(plain.find('input').attributes()).not.toHaveProperty('autofocus');
        plain.unmount();
    });

    it('puts class and style on the wrapper and every other attribute on the input', () => {
        const wrapper = mount(SearchInput, {
            props: {id: 'search', placeholder: 'Zoek', modelValue: null},
            attrs: {class: 'w-60', style: 'margin: 1px', 'data-test': 'client-search'},
        });
        const input = wrapper.find('input');

        expect(wrapper.classes()).toEqual(expect.arrayContaining(['ui-input-wrap', 'w-60']));
        expect(wrapper.attributes('style')).toBe('margin: 1px;');
        expect(input.attributes('data-test')).toBe('client-search');
        expect(input.classes()).not.toContain('w-60');
        expect(input.attributes()).not.toHaveProperty('style');
    });
});
