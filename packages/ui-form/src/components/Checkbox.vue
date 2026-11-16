<template>
    <label v-bind="rootAttrs($attrs)" class="ui-check" :class="{'is-disabled': disabled}">
        <span class="ui-check__control">
            <input
                :id="id"
                @change="onChange"
                v-bind="controlAttrs($attrs)"
                type="checkbox"
                class="ui-check__input"
                :class="{'is-invalid': invalid}"
                :checked="model"
                :indeterminate="indeterminate"
                :disabled="disabled"
                :aria-required="required || undefined"
                :aria-invalid="invalid || undefined"
                :aria-describedby="describedby"
            />
            <svg class="ui-check__icon" viewBox="0 0 20 20" aria-hidden="true">
                <path
                    class="ui-check__mark"
                    d="M5 10.5l3.5 3.5L15 6.5"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                />
                <path class="ui-check__dash" d="M5.5 10h9" fill="none" stroke="currentColor" stroke-width="2.5" />
            </svg>
        </span>
        <span v-if="label !== undefined || $slots.default" class="ui-check__label"
            ><slot>{{ label }}</slot></span
        >
    </label>
</template>

<script setup lang="ts">
import {nextTick} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';

// The root is the <label> (implicit labelling — the whole row is the hit target), so attrs
// must be re-aimed at the native input: `name`, `autocomplete`, `data-*`, … fall through to
// the control a form actually posts, per the family's attribute fall-through contract.
defineOptions({inheritAttrs: false});

const {
    label,
    disabled = false,
    required = false,
    invalid = false,
    indeterminate = false,
    describedby,
} = defineProps<{
    /** stable id — required so the control can pair with an external label/error. */
    id: string;
    /** label text rendered beside the box; the default slot overrides it. */
    label?: string;
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** invalid styling + aria; drive it from the field's error. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /**
     * visual "mixed" state (the element's `indeterminate` DOM property, drawn as a dash).
     * Purely presentational — it never reads from or writes to the boolean model.
     */
    indeterminate?: boolean;
}>();

// A checkbox is never "empty" — unchecked IS false, so the boolean model is non-nullable
// (unlike the family's string/number inputs, which model a nullable backend column).
const model = defineModel<boolean>({required: true});

// change (not input) is the native checkbox commit event. The browser has already flipped the input,
// and a host that declines or decides later leaves the model where it was, so Vue never re-patches
// `checked` (WR-1922): once the host has rendered, the input is set back to the model. That is why
// this control binds `checked` and `change` by hand instead of `v-model`: Vue's checkbox v-model
// re-syncs `checked` only when the component re-renders, which a declined change never causes.
const onChange = (event: Event): void => {
    const control = event.target as HTMLInputElement;
    model.value = control.checked;
    void nextTick(() => {
        control.checked = model.value;
    });
};
</script>
