// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {defineComponent, h, ref} from 'vue';

import {PasswordInput, TextInput} from '../src';

// Every value control, the props it needs, the value it starts from, the event its value arrives on, and what the user enters.
// A consumer's listener on that event runs after the control's own, so it reads the new value, as with
// native v-model: Vue attaches a v-model listener before the element's props, and a control's own listener
// sits before the consumer's attributes (merged listeners run in order). The reverse order lost the first
// keystroke of a row whose @input added the next row.
const CONTROLS: [
    string,
    unknown,
    Record<string, unknown>,
    unknown,
    'input' | 'change',
    (element: HTMLInputElement) => unknown,
][] = [
    ['TextInput', TextInput, {placeholder: 'Name'}, '', 'input', (element) => (element.value = 'A')],
    [
        'PasswordInput',
        PasswordInput,
        {placeholder: 'Password', autocomplete: 'current-password'},
        '',
        'input',
        (element) => (element.value = 'A'),
    ],
];

describe("a consumer's listener on a control", () => {
    it.each(CONTROLS)('%s: reads the new value, not the old one', async (_, control, props, initial, event, enter) => {
        const model = ref(initial);
        const seen: unknown[] = [];
        const wrapper = mount(
            defineComponent(
                () => () =>
                    h(control as never, {
                        id: 'control',
                        ...props,
                        modelValue: model.value,
                        'onUpdate:modelValue': (value: unknown) => (model.value = value),
                        [`on${event[0].toUpperCase()}${event.slice(1)}`]: () => seen.push(model.value),
                    }),
            ),
        );
        const element = wrapper.find<HTMLInputElement>('input, textarea');

        enter(element.element);
        await element.trigger(event);

        expect(seen).toEqual([model.value]);
        expect(model.value).not.toEqual(initial);
    });
});
