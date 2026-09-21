<template>
    <input
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
        @input="onInput"
    />
</template>

<script setup lang="ts">
defineProps<{
    id: string;
    placeholder?: string;
    disabled?: boolean;
    min?: number;
    max?: number;
    step?: number;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** invalid styling + aria; drive it from the field's error. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
}>();

const model = defineModel<number | null>({required: true});

// Own the empty-input coercion ONCE, so no consumer reinvents it: a native number
// input yields NaN for an empty or unparseable value — map that to null so the
// model is always a real number or an explicit "no value", never NaN.
const onInput = (event: Event) => {
    const {valueAsNumber} = event.target as HTMLInputElement;
    model.value = Number.isNaN(valueAsNumber) ? null : valueAsNumber;
};
</script>
