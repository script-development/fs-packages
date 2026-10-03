import {computed, ref} from 'vue';

type TextField = HTMLInputElement | HTMLTextAreaElement;

/**
 * Vue's `vModelText` composition rule for a text field the component binds by hand: an IME composes
 * one character through several `input` events, none of which is the user's value, so nothing is
 * committed while composing and the field's value is committed once on `compositionend`.
 *
 * Bind the field's `:value` to `shown`, never to the model: Vue re-patches `value` on every render,
 * and the model is stale mid-composition, so any re-render then would wipe the candidate text.
 * `shown` holds the field's own text while composing — the job `vModelText`'s
 * `if (el.composing) return` does on update.
 */
export const commitOutsideComposition = (model: () => string | null, commit: (value: string) => void) => {
    const draft = ref<string | null>(null);

    return {
        shown: computed(() => draft.value ?? model()),
        onCompositionstart: (event: Event): void => {
            draft.value = (event.target as TextField).value;
        },
        onCompositionend: (event: Event): void => {
            draft.value = null;
            commit((event.target as TextField).value);
        },
        onInput: (event: Event): void => {
            const {value} = event.target as TextField;
            if (draft.value === null) commit(value);
            else draft.value = value;
        },
    };
};
