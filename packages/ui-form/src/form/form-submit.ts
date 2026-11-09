import {ref} from 'vue';

import type {SubmitOutcome, UseFormSubmit} from './types';

/**
 * Wrap a form-submit action with double-submit prevention and validation-aware
 * error handling. While an action is in flight `submitting` is `true` and
 * re-entrant calls are ignored.
 *
 * The previous messages stand until the action settles: an action that resolves
 * clears them (`'sent'`), one that resolves `false` sent nothing and leaves them
 * (`'cancelled'`, for a save the user declined), and a 422 it rejects with replaces
 * them (`take`, `'refused'`). Every other rejection is re-thrown to the caller /
 * async error boundary, the messages left as they were.
 *
 * @param validationErrors `clearErrors` and `take` — typically the object returned by `useValidationErrors`.
 */
export const useFormSubmit = (validationErrors: {
    clearErrors: () => void;
    take: (error: unknown) => boolean;
}): UseFormSubmit => {
    const submitting = ref(false);

    const handleSubmit = async (action: () => Promise<unknown>): Promise<SubmitOutcome> => {
        if (submitting.value) return 'ignored';

        submitting.value = true;

        try {
            if ((await action()) === false) return 'cancelled';

            validationErrors.clearErrors();
            return 'sent';
        } catch (error) {
            if (validationErrors.take(error)) return 'refused';

            throw error;
        } finally {
            submitting.value = false;
        }
    };

    return {handleSubmit, submitting};
};
