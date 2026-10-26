<template>
    <span v-bind="rootAttrs($attrs)" class="ui-input-wrap">
        <!-- class/style style the whole control (this root); everything else lands on the <input>, as on TextInput -->
        <input
            @input="onInput"
            v-bind="controlAttrs($attrs)"
            ref="input"
            :id="id"
            type="number"
            class="ui-control ui-input"
            :class="{'is-invalid': invalid}"
            :value="model"
            :placeholder="placeholder"
            :disabled="disabled"
            :min="min"
            :max="max"
            :step="step"
            :aria-required="required || undefined"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedby"
        />
        <ErrorIcon v-if="invalid" />
    </span>
</template>

<script setup lang="ts">
import {onMounted, useTemplateRef} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';
import ErrorIcon from './ErrorIcon.vue';

defineOptions({inheritAttrs: false});

const {invalid = false, autofocus = false} = defineProps<{
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    /** required, so no input goes without one. */
    placeholder: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the input invalid, with the error icon; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /** focus the input when it mounts; in script, since the native attribute only acts on page load. */
    autofocus?: boolean;
}>();

const input = useTemplateRef<HTMLInputElement>('input');
onMounted(() => {
    if (autofocus) input.value?.focus();
});

const model = defineModel<number | null>({required: true});

// Own the empty-input coercion ONCE, so no consumer reinvents it: a native number
// input yields NaN for an empty or unparseable value — map that to null so the
// model is always a real number or an explicit "no value", never NaN. This is why
// the input is bound by hand rather than with v-model.
const onInput = (event: Event) => {
    const {valueAsNumber} = event.target as HTMLInputElement;
    model.value = Number.isNaN(valueAsNumber) ? null : valueAsNumber;
};
</script>
