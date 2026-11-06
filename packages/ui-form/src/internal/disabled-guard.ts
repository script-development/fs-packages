import type {Directive} from 'vue';

/** The events that commit or activate a checkbox-family control. */
const GUARDED_EVENTS = ['click', 'input', 'change'] as const;

const disabledOf = new WeakMap<HTMLElement, boolean>();

const guard = (event: Event): void => {
    if (!disabledOf.get(event.currentTarget as HTMLElement)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
};

/**
 * `v-guard-while-disabled="disabled"`: while the value is true, no `click`/`input`/`change` listener
 * the consumer bound on the component runs.
 *
 * The browser is no help: Chromium withholds these only for USER interaction. A dispatched `change`
 * or `input` runs every listener on a disabled input, and a dispatched `click` on a disabled checkbox
 * or radio runs every listener AND flips the native `checked` (measured). `preventDefault()` on the
 * click undoes the flip; `stopImmediatePropagation()` withholds every later listener.
 *
 * A directive, because only its `created` hook runs before Vue attaches the element's listeners
 * (fall-through `@click.capture` included). Listeners on one element run in registration order
 * within a phase and capture before bubble, so a capture listener registered first runs ahead of
 * everything the consumer bound on this element, in either phase, without reordering Vue's merged
 * handlers — an enabled control keeps the order its consumers already see. An ancestor's capture
 * listener runs before any listener on the element and stays out of reach. The same order is why a
 * guard on a group's fieldset withholds its members' own listeners too: the groups guard only there.
 */
export const vGuardWhileDisabled: Directive<HTMLElement, boolean> = {
    created: (element, {value}) => {
        disabledOf.set(element, value);
        for (const type of GUARDED_EVENTS) element.addEventListener(type, guard, true);
    },
    beforeUpdate: (element, {value}) => {
        disabledOf.set(element, value);
    },
};
