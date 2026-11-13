import type {Directive} from 'vue';

const assign = (element: HTMLInputElement, {value}: {value: string | null}): void => {
    element.value = value ?? '';
};

/**
 * `v-value-property="value"`: sets the field's `value` property and nothing else. A bound `:value`
 * (or `:value.prop`) on a native input also writes the `value` attribute, so the text, a typed
 * password included, shows in the page source. `v-model` doesn't, but it brings its own listeners.
 */
export const vValueProperty: Directive<HTMLInputElement, string | null> = {beforeMount: assign, updated: assign};
