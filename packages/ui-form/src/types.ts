/**
 * A field's wiring, what `FormField`'s slot hands the control as `field`; `v-bind="field"` puts it on the
 * control, so each key is a prop every control declares. `required` is left out on purpose: a control
 * that does not declare it would take it as a native attribute and switch on browser validation. Pass
 * `required` to a control that conveys it (`aria-required`).
 */
export interface FieldBinding {
    id: string;
    /** whether the field has a message; the control marks itself by it. */
    invalid: boolean;
    describedby: string | undefined;
}

/**
 * A field's wiring as attributes, for a native element that is not a control of this package (a
 * `role="group"` div of your own): `v-bind="aria"` from `FormField`'s slot.
 */
export interface FieldAria {
    id: string;
    'aria-labelledby'?: string;
    'aria-invalid'?: 'true';
    'aria-describedby'?: string;
}
