<template>
    <span v-bind="rootAttrs($attrs)" class="ui-password">
        <!-- class/style style the whole control (this root); everything else lands on the <input>. -->
        <span class="ui-input-wrap">
            <input
                v-model="model"
                @keydown="checkCapsLock"
                @keyup="checkCapsLock"
                v-bind="controlAttrs($attrs)"
                ref="input"
                :id="id"
                :type="shown ? 'text' : 'password'"
                class="ui-control ui-input has-button"
                :class="{'is-invalid': invalid}"
                :placeholder="placeholder"
                :autocomplete="autocomplete"
                :disabled="disabled"
                :aria-required="required || undefined"
                :aria-invalid="invalid || undefined"
                :aria-describedby="describedbyWithCaps"
            />
            <!-- a toggle: one name, its state in aria-pressed. A pointer press focuses the input, not the toggle,
                 so typing goes on in the field; the keyboard reaches the toggle by Tab -->
            <button
                type="button"
                class="ui-input__button"
                :aria-label="showPasswordLabel"
                :aria-pressed="shown"
                :aria-controls="id"
                :disabled="disabled"
                @mousedown.prevent="input?.focus()"
                @click="shown = !shown"
            >
                <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false">
                    <path
                        fill="currentColor"
                        fill-rule="evenodd"
                        d="M8 3c3.3 0 5.9 2.3 7 5-1.1 2.7-3.7 5-7 5S2.1 10.7 1 8c1.1-2.7 3.7-5 7-5zm0 1.5A3.5 3.5 0 1 0 8 11.5 3.5 3.5 0 0 0 8 4.5zM8 6.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"
                    />
                    <path
                        v-if="shown"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        d="M2.5 2.5l11 11"
                    />
                </svg>
            </button>
            <ErrorIcon v-if="invalid" />
        </span>
        <!-- always there, so a screen reader announces the notice when its text arrives -->
        <span :id="capsId" class="ui-password__caps" role="status">{{ capsLock ? capsLockText : '' }}</span>
    </span>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, useTemplateRef} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';
import ErrorIcon from './ErrorIcon.vue';

const {
    id,
    disabled = false,
    invalid = false,
    describedby,
    showPasswordLabel = 'Show password',
    capsLockText = 'Caps Lock is on',
    autofocus = false,
} = defineProps<{
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    /** required, so no input goes without one. */
    placeholder: string;
    /** required: whether the browser offers the saved password or a new one to save is the form's call. */
    autocomplete: 'current-password' | 'new-password';
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the input invalid, with the error icon; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /** the show/hide toggle's accessible name; whether it is on is its pressed state. */
    showPasswordLabel?: string;
    /** the notice shown once a key in the field says Caps Lock is on. */
    capsLockText?: string;
    /** focus the input when it mounts; in script, since the native attribute only acts on page load. */
    autofocus?: boolean;
}>();

defineOptions({inheritAttrs: false});

// As TextInput: binds null as empty, emits '' when cleared.
const model = defineModel<string | null>({required: true});

const shown = ref(false);
const capsLock = ref(false);
const capsId = computed(() => `${id}-caps`);

// A key says whether Caps Lock is on. A browser's autofill fires keydown and keyup as plain events, which
// cannot say, so they leave the notice as it is.
const checkCapsLock = (event: Event): void => {
    if (event instanceof KeyboardEvent) capsLock.value = event.getModifierState('CapsLock');
};

// The notice is read with the field while it shows.
const describedbyWithCaps = computed(
    () => [describedby, capsLock.value && capsId.value].filter(Boolean).join(' ') || undefined,
);

const input = useTemplateRef<HTMLInputElement>('input');
onMounted(() => {
    if (autofocus) input.value?.focus();
});
</script>
