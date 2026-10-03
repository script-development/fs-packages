<template>
    <textarea
        :id="id"
        class="ui-control ui-textarea"
        :class="{'is-invalid': invalid}"
        :value="shown"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows"
        :aria-required="required || undefined"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
        @input="onInput"
        @compositionstart="onCompositionstart"
        @compositionend="onCompositionend"
    />
</template>

<script setup lang="ts">
import {commitOutsideComposition} from '../internal/composition';

defineProps<{
    id: string;
    placeholder?: string;
    disabled?: boolean;
    rows?: number;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** invalid styling + aria; drive it from the field's error. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
}>();

// Accepts null so it binds a nullable text column directly (Vue renders null as an
// empty control); a cleared textarea emits '', which the fleet's
// ConvertEmptyStringsToNull middleware converts back to null on submit.
const model = defineModel<string | null>({required: true});

const {shown, onInput, onCompositionstart, onCompositionend} = commitOutsideComposition(
    () => model.value,
    (value) => {
        model.value = value;
    },
);
</script>
