export {default as FormLabel} from './components/FormLabel.vue';
export {default as TextInput} from './components/TextInput.vue';

// Form state (ported from @script-development/fs-form): the validation bag and the submit it binds.
export {useFormSubmit} from './form/form-submit';
export {useValidationErrors} from './form/validation-errors';
export type {
    SubmitOutcome,
    UseFormSubmit,
    UseValidationErrors,
    UseValidationErrorsOptions,
    ValidationErrors,
} from './form/types';
