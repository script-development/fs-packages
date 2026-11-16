<template>
    <input
        v-model="date"
        :id="id"
        type="date"
        class="ui-control ui-input"
        :class="{'is-invalid': invalid}"
        :disabled="disabled"
        :min="min"
        :max="max"
        :aria-required="required || undefined"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
    />
</template>

<script setup lang="ts">
import {computed} from 'vue';

// The native date input keeps the browser's own picker, so it has no wrapper and no in-input error
// icon, and no placeholder: a native date input shows none.
defineProps<{
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    disabled?: boolean;
    /** ISO date bound (`YYYY-MM-DD`) for the native picker. */
    min?: string;
    max?: string;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the input invalid; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
}>();

// Accepts null so it binds a nullable date column directly (Vue renders null as an
// empty control); a cleared date emits '', which the fleet's
// ConvertEmptyStringsToNull middleware converts back to null on submit.
const model = defineModel<string | null>({required: true});

// A Laravel date cast arrives as an ISO datetime (`2026-09-05T00:00:00.000000Z`), which a native date input
// shows as empty. The field shows its calendar date, as sent: no conversion to the browser's time zone, which
// would move a midnight-UTC date a day back west of Greenwich. The model keeps what it holds until the user
// picks a date, which then arrives as `YYYY-MM-DD`.
const date = computed({get: () => model.value?.slice(0, 10) ?? null, set: (value) => (model.value = value)});
</script>
