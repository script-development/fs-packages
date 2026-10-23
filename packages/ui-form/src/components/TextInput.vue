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
import {onMounted, useTemplateRef} from 'vue';

import {controlAttrs, rootAttrs} from '../internal/split-attrs';
import ErrorIcon from './ErrorIcon.vue';

const {
    type = 'text',
    id,
    invalid = false,
    autofocus = false,
} = defineProps<{
    /** control id, pairing the input with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    /** a password field is PasswordInput. */
    type?: 'text' | 'email' | 'search' | 'tel' | 'url';
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
const model = defineModel<string | null>({required: true});
</script>
