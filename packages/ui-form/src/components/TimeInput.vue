<template>
    <span v-bind="rootAttrs($attrs)" class="ui-input-wrap">
        <!-- class/style style the whole control (this root); everything else lands on the <input>. -->
        <!-- the clock glyph; decorative, it stands in for the browser's own (hidden in the sheet) -->
        <svg class="ui-input__lead" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
                fill="currentColor"
                fill-rule="evenodd"
                d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13zM8.75 4v3.69l2.28 2.28-1.06 1.06L7.25 8.31V4z"
            />
        </svg>
        <input
            @input="onInput"
            @click="togglePicker"
            @change="pickerOpen = false"
            @blur="pickerOpen = false"
            v-bind="controlAttrs($attrs)"
            ref="input"
            :id="id"
            type="time"
            class="ui-control ui-input ui-time has-lead"
            :class="{'is-invalid': invalid, 'has-button': showClear}"
            :value="model ?? ''"
            :step="step === undefined ? undefined : step * 60"
            :disabled="disabled"
            :aria-required="required || undefined"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedby"
        />
        <!-- mousedown is prevented so a pointer click keeps focus on the input; the keyboard reaches it by Tab -->
        <button
            v-if="showClear"
            type="button"
            class="ui-input__button"
            :aria-label="clearLabel"
            @mousedown.prevent
            @click="clear"
        >
            <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                <path stroke="currentColor" stroke-width="1.75" stroke-linecap="round" d="M4.5 4.5l7 7m0-7l-7 7" />
            </svg>
        </button>
        <ErrorIcon v-if="invalid" />
    </span>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, useTemplateRef} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';
import ErrorIcon from './ErrorIcon.vue';

// No placeholder: a native time input shows none.
const {
    disabled = false,
    invalid = false,
    step,
    clearLabel,
    autofocus = false,
} = defineProps<{
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the input invalid, with the error icon; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /** the minute step of the picker and the arrow keys (`15` for quarter hours). */
    step?: number;
    /** the clear button's accessible name: given, a clear button shows while there is a time. Leave it out for a time that must always be set. */
    clearLabel?: string;
    /** focus the input when it mounts; in script, since the native attribute only acts on page load. */
    autofocus?: boolean;
}>();

defineOptions({inheritAttrs: false});

// `HH:MM`, or null for no time: the clear button and an emptied field both emit null, as an empty string is
// no time. A consumer's own logic reads the model before any backend does (`time === null`), so a time keeps
// the honest empty value, as NumberInput does. That is why the input is bound by hand, not with v-model,
// which would emit the native input's ''.
const model = defineModel<string | null>({required: true});

const onInput = (event: Event): void => {
    model.value = (event.target as HTMLInputElement).value || null;
};

const showClear = computed(() => clearLabel !== undefined && !disabled && Boolean(model.value));

const input = useTemplateRef<HTMLInputElement>('input');
const pickerOpen = ref(false);

// A click opens the browser's picker; the next click, which the browser spends closing it, only resets this
// state. Picking a time (change) and a blur reset it too. Escape does not: an open picker keeps its keys from
// the page, so after Escape one click is spent before the picker opens again. The picker is a browser
// feature: where it is missing or refused, the click just edits the field.
const togglePicker = (): void => {
    if (pickerOpen.value) {
        pickerOpen.value = false;
        return;
    }
    try {
        input.value?.showPicker();
        pickerOpen.value = true;
    } catch {
        // no picker here: the click edits the field, and the picker stays closed
    }
};

// The clear button keeps focus on the input, so no blur resets the picker state.
const clear = (): void => {
    model.value = null;
    pickerOpen.value = false;
    input.value?.focus();
};

onMounted(() => {
    if (autofocus) input.value?.focus();
});
</script>
