<template>
    <textarea
        v-model="model"
        ref="textarea"
        :id="id"
        class="ui-control ui-textarea"
        :class="{'is-invalid': invalid, 'is-autogrow': autogrow}"
        :placeholder="placeholder"
        :disabled="disabled"
        :rows="rows"
        :aria-required="required || undefined"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
        @input="fit"
    />
</template>

<script setup lang="ts">
import {onBeforeUnmount, onMounted, useTemplateRef, watch} from 'vue';

const {autogrow = false, maxRows} = defineProps<{
    /** control id, pairing the textarea with its label and error; inside a `FormField` the field passes its own. */
    id: string;
    /** required, so no textarea goes without one. */
    placeholder: string;
    disabled?: boolean;
    rows?: number;
    /** conveys the required state to assistive tech via `aria-required`. */
    required?: boolean;
    /** marks the textarea invalid; the field around it decides the message. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby`. */
    describedby?: string;
    /** grow with the text instead of scrolling: from `rows` upward, on mount and on every change. */
    autogrow?: boolean;
    /** with `autogrow`, stop growing at this many lines and scroll from there. */
    maxRows?: number;
}>();

// Accepts null so it binds a nullable text column directly (Vue renders null as an
// empty control); a cleared textarea emits '', which the fleet's
// ConvertEmptyStringsToNull middleware converts back to null on submit. Bound with
// v-model, so Vue's own IME handling applies: nothing is emitted while an input
// method composes.
const model = defineModel<string | null>({required: true});

// The textarea is its own (single) root, so every attribute, class and style included, lands on it.
const textarea = useTemplateRef<HTMLTextAreaElement>('textarea');

const px = (value: string): number => Number.parseFloat(value) || 0;

// Fit the height to the content: measure from `auto` (so deleted lines shrink it), add the borders
// (the control is border-box, scrollHeight is not), and cap it at maxRows lines, scrolling past that.
// It runs on every input event, so the textarea also grows while an input method composes (when the
// model does not change yet), and after a model change from the parent.
const fit = (): void => {
    const element = textarea.value;
    if (!autogrow || !element) return;

    const style = getComputedStyle(element);
    const frame = px(style.borderTopWidth) + px(style.borderBottomWidth);
    element.style.height = 'auto';
    const content = element.scrollHeight + frame;

    const lineHeight = px(style.lineHeight) || px(style.fontSize) * 1.2;
    const cap = maxRows ? lineHeight * maxRows + px(style.paddingTop) + px(style.paddingBottom) + frame : Infinity;

    element.style.height = `${Math.min(content, cap)}px`;
    element.style.overflowY = content > cap ? 'auto' : 'hidden';
};

// A narrower box wraps the same text onto more lines, so a width change refits too (a responsive
// layout, a sidebar or dialog resizing). Only the width: the height fit() sets must not refit again.
let width: number | undefined;
const observer = new ResizeObserver(([entry]) => {
    const next = entry!.contentRect.width;
    if (next === width) return;
    width = next;
    fit();
});

onMounted(() => {
    fit();
    if (autogrow) observer.observe(textarea.value!);
});
onBeforeUnmount(() => observer.disconnect());
watch(model, fit, {flush: 'post'});
</script>
