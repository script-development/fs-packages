<template>
    <input
        :id="id"
        type="date"
        class="ui-control ui-input"
        :class="{'is-invalid': invalid}"
        v-value-property="model"
        :disabled="disabled"
        :min="min"
        :max="max"
        :aria-required="required || undefined"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
        @input="model = ($event.target as HTMLInputElement).value"
    />
</template>

<script setup lang="ts">
import {vValueProperty} from '../internal/value-property';

defineProps<{
    id: string;
    disabled?: boolean;
    /** ISO date bound (`YYYY-MM-DD`) for the native picker. */
    min?: string;
    max?: string;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** invalid styling + aria; drive it from the field's error. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
}>();

// Accepts null so it binds a nullable date column directly (Vue renders null as an
// empty control); a cleared date emits '', which the fleet's
// ConvertEmptyStringsToNull middleware converts back to null on submit.
const model = defineModel<string | null>({required: true});
</script>
