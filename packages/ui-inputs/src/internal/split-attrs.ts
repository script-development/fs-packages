import type {StyleValue} from 'vue';

/**
 * The select family's attribute split. `class` and `style` stay on the root, where consumers style
 * the whole control (ublgenie passes `class` on four of them); everything else — `aria-label`,
 * `aria-labelledby`, `data-*`, listeners — goes to the element carrying role="combobox", the only
 * place an accessible name can land.
 */
export const rootAttrs = (attrs: Record<string, unknown>): {class?: unknown; style?: StyleValue} => ({
    class: attrs.class,
    style: attrs.style as StyleValue | undefined,
});

export const controlAttrs = (attrs: Record<string, unknown>): Record<string, unknown> => {
    const {class: _class, style: _style, ...rest} = attrs;

    return rest;
};
