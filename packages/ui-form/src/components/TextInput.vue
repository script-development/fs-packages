<template>
    <span v-bind="rootAttrs($attrs)" class="ui-input-wrap">
        <!-- class/style style the whole control (this root); everything else, `data-*` and listeners
             included, lands on the <input>, as on the select family. -->
        <input
            v-model="model"
            v-bind="controlAttrs($attrs)"
            ref="input"
            :id="id"
            :type="type"
            class="ui-control ui-input"
            :class="{'is-invalid': invalid}"
            :placeholder="placeholder"
            :disabled="disabled"
            :aria-required="required || undefined"
            :aria-invalid="invalid || undefined"
            :aria-describedby="describedby"
        />
        <ErrorIcon v-if="invalid" />
    </span>
</template>

<script setup lang="ts">
import {computed, onMounted, useTemplateRef} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';
import ErrorIcon from './ErrorIcon.vue';

const {
    modelValue,
    type = 'text',
    id,
    invalid = false,
    autofocus = false,
} = defineProps<{
    /** the value; `null` shows an empty control. */
    modelValue: string | null;
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    /** a password field is PasswordInput, a search field SearchInput. */
    type?: 'text' | 'email' | 'tel' | 'url';
    /** required, so no input goes without one. */
    placeholder: string;
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the input invalid, with the error icon; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /**
     * focus the input when it mounts. Done in script, not with the native attribute: the browser only
     * honours `autofocus` on page load, so an input in a dialog that opens later would stay unfocused.
     */
    autofocus?: boolean;
}>();

defineOptions({inheritAttrs: false});

const input = useTemplateRef<HTMLInputElement>('input');
onMounted(() => {
    if (autofocus) input.value?.focus();
});

// Accepts null so it binds a nullable backend field directly (Vue renders null as
// an empty control); a cleared input emits '', which the fleet's
// ConvertEmptyStringsToNull middleware converts back to null on submit.
const emit = defineEmits<{'update:modelValue': [value: string]}>();
// v-model stays on the native element (so Vue's IME handling applies), over a computed: the event is
// declared as what it writes, a string, so a draft path typed plain `string` binds. defineModel cannot
// type its event apart from its prop.
const model = computed({
    get: () => modelValue,
    // the native element writes its text, never null
    set: (value: string | null) => emit('update:modelValue', value!),
});
</script>
