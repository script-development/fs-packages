import type {Ref} from 'vue';

import {readonly, ref} from 'vue';

import type {UseValidationErrors, UseValidationErrorsOptions, ValidationErrors} from './types';

import {isValidationRefusal} from './http-contract';

const toFieldErrorMap = (data: unknown): Record<string, unknown> => {
    const errors = (data as {errors?: unknown} | null | undefined)?.errors;
    if (typeof errors !== 'object' || errors === null) return {};

    const prototype: unknown = Object.getPrototypeOf(errors);
    if (prototype !== Object.prototype && prototype !== null) return {};

    return errors as Record<string, unknown>;
};

const firstMessage = (messages: unknown): string | undefined =>
    Array.isArray(messages) && typeof messages[0] === 'string' ? messages[0] : undefined;

const identity = (key: string): string => key;

/**
 * A reactive field-error bag that takes a 422 from the error the caller caught: `take(error)` binds the
 * backend's validation errors, keyed to the first message per field, and returns whether it was one.
 * Nothing is registered on a service, so a form holds exactly the refusals of the requests it handed
 * to `take` — `useFormSubmit` hands it its own submit's error.
 *
 * Every taken 422 raises `refused`, before the body is parsed, so a refusal the bag cannot hold still
 * reads as one (`refusedUnnamed`). A key is left out of `errors` and listed in `unmapped` when `fields`
 * does not name it or when its value is not a list whose first entry is a string.
 *
 * @param options `keyMapper` remaps raw backend field keys (default identity);
 *                `fields` allow-lists the bag by mapped name (default every key).
 */
export const useValidationErrors = <T extends string = string>(
    options: UseValidationErrorsOptions<T> = {},
): UseValidationErrors<T> => {
    const {keyMapper = identity, fields} = options;
    const allowed = fields === undefined ? undefined : new Set<string>(fields);
    const errors = ref<ValidationErrors<T>>({}) as Ref<ValidationErrors<T>>;
    const refused = ref(false);
    const unmapped = ref<readonly string[]>([]);
    // Decided when the 422 is taken, not read off the bag: a message the form later drops (the user
    // fixing that field) must not turn a refusal that named fields into one that named none.
    const unnamed = ref(false);

    const clearErrors = (): void => {
        errors.value = {};
        refused.value = false;
        unmapped.value = [];
        unnamed.value = false;
    };

    const take = (error: unknown): boolean => {
        if (!isValidationRefusal(error)) return false;

        refused.value = true;
        // Until the parse finishes, the bag still holds the previous refusal's fields: a parse that
        // throws leaves it there, so it names a field exactly when it holds one.
        unnamed.value = Object.keys(errors.value).length === 0;

        const kept: [string, string][] = [];
        const dropped: string[] = [];

        for (const [key, messages] of Object.entries(toFieldErrorMap(error.response.data))) {
            const field = keyMapper(key);
            const message = firstMessage(messages);

            if (message === undefined || (allowed && !allowed.has(field))) dropped.push(field);
            else kept.push([field, message]);
        }

        // fromEntries defines own properties; an assignment would hit the `__proto__` setter.
        const bag = Object.fromEntries(kept);

        errors.value = bag as ValidationErrors<T>;
        unmapped.value = [...new Set(dropped)].filter((field) => !Object.hasOwn(bag, field));
        unnamed.value = kept.length === 0;

        return true;
    };

    return {
        errors,
        clearErrors,
        take,
        refused: readonly(refused),
        unmapped: readonly(unmapped),
        refusedUnnamed: readonly(unnamed),
    };
};
