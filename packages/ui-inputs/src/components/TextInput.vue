<template>
    <input
        :id="id"
        :type="type"
        class="ui-control ui-input"
        :class="{'is-invalid': invalid}"
        :value="shown"
        :placeholder="placeholder"
        :disabled="disabled"
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

const {type = 'text'} = defineProps<{
    id: string;
    type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url';
    placeholder?: string;
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** invalid styling + aria; drive it from the field's error. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
}>();

// Accepts null so it binds a nullable backend field directly (Vue renders null as
// an empty control); a cleared input emits '', which the fleet's
// ConvertEmptyStringsToNull middleware converts back to null on submit.
const model = defineModel<string | null>({required: true});

const {shown, onInput, onCompositionstart, onCompositionend} = commitOutsideComposition(
    () => model.value,
    (value) => {
        model.value = value;
    },
);
</script>
