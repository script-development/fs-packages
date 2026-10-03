// @vitest-environment happy-dom
// WR-1990: an IME composes a character through several `input` events. Vue's own `v-model` on a text
// field ignores them until `compositionend`; these controls must do the same, or a consumer gets
// every candidate (lokalekeuze measured a GET per candidate). Neither happy-dom nor Chromium can be
// driven by a real IME from a test, so both would run these same dispatched events; the composition
// handling is the component's own logic, which happy-dom runs faithfully.
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';

import Textarea from '../src/components/Textarea.vue';
import TextInput from '../src/components/TextInput.vue';

describe.each([
    ['TextInput', TextInput, 'input'],
    ['Textarea', Textarea, 'textarea'],
] as const)('%s — IME composition', (_name, component, selector) => {
    const mountField = () =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- two SFCs through one mount
        mount(component as any, {props: {id: 't', modelValue: ''}});

    const type = (field: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
        field.value = value;
        field.dispatchEvent(new Event('input', {bubbles: true}));
    };

    it('emits nothing while composing, then the committed value once on compositionend', () => {
        const wrapper = mountField();
        const field = wrapper.find(selector).element as HTMLInputElement;

        field.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
        type(field, 'k');
        type(field, 'か');
        type(field, 'かn');
        type(field, 'かな');
        field.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true, data: 'かな'}));

        expect(wrapper.emitted('update:modelValue')).toEqual([['かな']]);
    });

    it('REGRESSION PIN — plain typing still emits on every input', () => {
        const wrapper = mountField();
        const field = wrapper.find(selector).element as HTMLInputElement;

        type(field, 'a');
        type(field, 'ab');

        expect(wrapper.emitted('update:modelValue')).toEqual([['a'], ['ab']]);
    });

    it('REGRESSION PIN — typing after a composition emits per input again', () => {
        const wrapper = mountField();
        const field = wrapper.find(selector).element as HTMLInputElement;

        field.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
        type(field, 'か');
        field.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true}));
        type(field, 'か!');

        expect(wrapper.emitted('update:modelValue')).toEqual([['か'], ['か!']]);
    });
});

describe.each([
    ['TextInput', TextInput, 'input'],
    ['Textarea', Textarea, 'textarea'],
] as const)('%s — a re-render during composition', (_name, component, selector) => {
    it('keeps the candidate text in the field, then commits it on compositionend', async () => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- two SFCs through one mount
        const wrapper = mount(component as any, {props: {id: 't', modelValue: 'a', placeholder: 'one'}});
        const field = wrapper.find(selector).element as HTMLInputElement;

        field.dispatchEvent(new CompositionEvent('compositionstart', {bubbles: true}));
        field.value = 'aか';
        field.dispatchEvent(new Event('input', {bubbles: true}));
        await wrapper.setProps({placeholder: 'two'});

        expect(field.value).toBe('aか');

        field.dispatchEvent(new CompositionEvent('compositionend', {bubbles: true}));
        expect(wrapper.emitted('update:modelValue')).toEqual([['aか']]);
    });
});
