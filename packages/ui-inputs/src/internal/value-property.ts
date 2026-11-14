import type {Directive} from 'vue';

type Field = HTMLInputElement | HTMLTextAreaElement;

const assign = (element: Field, {value}: {value: string | number | null}): void => {
    const next = String(value ?? '');
    if (element.value !== next) element.value = next;
};

/**
 * `v-value-property="value"`: sets the field's `value` property and nothing else. A bound `:value`
 * (or `:value.prop`) on a native input also writes the `value` attribute, so the text, a typed
 * password included, shows in the page source. `v-model` doesn't, but it brings its own listeners.
 *
 * Like Vue's own patch, it skips a write that changes nothing: a number or date field holding text
 * it can't parse yet, such as a lone `-`, reads `''`, and writing `''` over it erases that text.
 */
export const vValueProperty: Directive<Field, string | number | null> = {beforeMount: assign, updated: assign};
