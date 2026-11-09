<template>
    <div class="ui-field" :class="{'is-horizontal': orientation === 'horizontal' && Boolean(label)}">
        <FormLabel v-if="label" :id="labelId(id)" :html-for="id" :required="required">{{ label }}</FormLabel>
        <!-- the slot receives `field`, whose keys are the control's own prop names, so one
             `v-bind="field"` wires the control, and `aria`, the same wiring as attributes for a native
             element; the wrapper keeps multi-node slot content in one grid cell when horizontal
             (display: contents otherwise) -->
        <div class="ui-field__control">
            <slot :field="field" :aria="aria" />
        </div>
        <FormError :error="error" :id="errorId" />
    </div>
</template>

<script setup lang="ts">
import {computed} from 'vue';

import type {FieldAria, FieldBinding} from '../types';

import {labelId, messageId} from '../form/field';
import FormError from './FormError.vue';
import FormLabel from './FormLabel.vue';

const {
    label,
    required = false,
    error,
    id,
    orientation = 'vertical',
} = defineProps<{
    /** label text; omit for an unlabelled field. */
    label?: string;
    required?: boolean;
    /** resolved error string, supplied by the consumer (error-as-prop); empty means no error. */
    error?: string;
    /** the control's id; the label's `for` and the message's id follow from it. */
    id: string;
    /**
     * field layout. `'vertical'` (default) stacks the label above the control; `'horizontal'`
     * places the label in a fixed left column (width `--ui-field-label-width`) with the control
     * to its right and the error beneath the control. An unlabelled field ignores it — there is
     * no label to give a column to, so the control keeps the full width.
     */
    orientation?: 'vertical' | 'horizontal';
}>();

defineSlots<{
    /** `field` for a control of this package, `aria` for a native element (a `role="group"` div). */
    default?: (scope: {field: FieldBinding; aria: FieldAria}) => unknown;
}>();

const errorId = computed(() => messageId(id));

// The field decides the message; the control only learns whether it is invalid and where its message is.
const field = computed<FieldBinding>(() => ({
    id,
    invalid: Boolean(error),
    describedby: error ? errorId.value : undefined,
}));

// A <label for> names only a form control; a native element is named by aria-labelledby instead. An attribute
// that does not apply is left out, not set undefined, so one the consumer adds holds in any binding order.
const aria = computed<FieldAria>(() => {
    const {invalid, describedby} = field.value;
    const attributes: FieldAria = {id};
    if (label) attributes['aria-labelledby'] = labelId(id);
    if (invalid) attributes['aria-invalid'] = 'true';
    if (describedby) attributes['aria-describedby'] = describedby;

    return attributes;
});
</script>
