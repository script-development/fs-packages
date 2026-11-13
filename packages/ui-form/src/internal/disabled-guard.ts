import type {Directive} from 'vue';

/** The events that commit or activate a radio. */
const GUARDED_EVENTS = ['click', 'input', 'change'] as const;

const disabledOf = new WeakMap<HTMLElement, boolean>();

const guard = (event: Event): void => {
    if (!disabledOf.get(event.currentTarget as HTMLElement)) return;

    event.preventDefault();
    event.stopImmediatePropagation();
};

/**
 * `v-guard-while-disabled="disabled"`: while the value is true, no `click`/`input`/`change` listener
 * bound on the element, or on an ancestor below it, runs for an event inside it. RadioGroup puts it on its
 * fieldset (the whole group, where the consumer's attrs land) and on each option's label (one disabled
 * option inside an enabled group).
 *
 * The browser is no help: Chromium withholds these only for USER interaction. A dispatched `change`
 * or `input` runs every listener on a disabled input, and a dispatched `click` on a disabled radio runs
 * every listener AND checks it (measured). A pointer on an option's label text touches no disabled
 * radio at all, so nothing native withholds that click from the consumer. `preventDefault()` on the
 * click undoes the flip; `stopImmediatePropagation()` withholds every later listener.
 *
 * A directive, because only its `created` hook runs before Vue attaches the element's listeners
 * (fall-through `@click.capture` included). Listeners on one element run in registration order
 * within a phase and capture before bubble, so a capture listener registered first runs ahead of
 * everything the consumer bound on this element, in either phase, without reordering Vue's merged
 * handlers — an enabled control keeps the order its consumers already see. An ancestor's capture
 * listener runs before any listener on the element and stays out of reach. The same order is why a
 * guard on the fieldset or a label withholds the listeners of the radios inside it too.
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
