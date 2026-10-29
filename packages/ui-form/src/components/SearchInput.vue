<template>
    <span v-bind="rootAttrs($attrs)" class="ui-input-wrap">
        <!-- class/style style the whole control (this root); everything else lands on the <input>. -->
        <!-- the magnifier; decorative, the input's searchbox role already says it is a search -->
        <svg class="ui-input__lead" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
            <path
                fill="currentColor"
                fill-rule="evenodd"
                d="M6.75 1a5.75 5.75 0 0 1 4.6 9.2l3.45 3.45-1.06 1.06-3.45-3.45A5.75 5.75 0 1 1 6.75 1zm0 1.5a4.25 4.25 0 1 0 0 8.5 4.25 4.25 0 0 0 0-8.5z"
            />
        </svg>
        <input
            v-model="model"
            v-bind="controlAttrs($attrs)"
            ref="input"
            :id="id"
            type="search"
            class="ui-control ui-input ui-search has-lead"
            :class="{'is-invalid': invalid, 'has-button': showClear}"
            :placeholder="placeholder"
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
import {computed, onMounted, useTemplateRef} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';
import ErrorIcon from './ErrorIcon.vue';

const {
    disabled = false,
    invalid = false,
    clearLabel,
    autofocus = false,
} = defineProps<{
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    /** required, so no input goes without one. */
    placeholder: string;
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the input invalid, with the error icon; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /** the clear button's accessible name: given, a clear button shows while there is text. */
    clearLabel?: string;
    /** focus the input when it mounts; in script, since the native attribute only acts on page load. */
    autofocus?: boolean;
}>();

defineOptions({inheritAttrs: false});

// As TextInput: binds null as empty, emits '' when cleared.
const model = defineModel<string | null>({required: true});

const showClear = computed(() => clearLabel !== undefined && !disabled && Boolean(model.value));

const input = useTemplateRef<HTMLInputElement>('input');

const clear = (): void => {
    model.value = '';
    input.value?.focus();
};

onMounted(() => {
    if (autofocus) input.value?.focus();
});
</script>
