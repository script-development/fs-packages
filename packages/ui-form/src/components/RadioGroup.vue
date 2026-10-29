<template>
    <!-- role="radiogroup" (overriding fieldset's implicit `group`) because radiogroup — unlike
         group — legitimately carries aria-required, giving the group-level required conveyance
         as a real attribute; the legend still names the fieldset. ONE described-by story: the
         error IDREF lives on the fieldset only. The disabled guard sits on the fieldset, not only
         on the radios: consumer attrs land here, and a pointer on an option's label text reaches
         them without touching a disabled radio. -->
    <fieldset
        :id="id"
        v-guard-while-disabled="disabled"
        class="ui-radio-group"
        role="radiogroup"
        :aria-required="required || undefined"
        :aria-invalid="invalid || undefined"
        :aria-describedby="describedby"
    >
        <legend class="ui-label ui-radio-group__legend">
            <slot>{{ label }}</slot
            ><span v-if="required" class="ui-label__req" aria-hidden="true">*</span>
        </legend>
        <!-- Native radios sharing one name: the browser provides the roving tabindex and the
             arrow-key selection (never hand-rolled here) — the component only mirrors the
             model from the native change event. -->
        <label
            v-for="(option, index) in options"
            :key="String(option.id)"
            class="ui-check ui-radio"
            :class="{'is-disabled': disabled || disabledOf(option)}"
        >
            <span class="ui-check__control">
                <input
                    :id="`${id}-opt-${index}`"
                    type="radio"
                    class="ui-check__input ui-radio__input"
                    :class="{'is-invalid': invalid}"
                    :name="id"
                    :value="String(option.id)"
                    :checked="model === option.id"
                    :disabled="disabled || disabledOf(option)"
                    @change="onChange($event, option)"
                />
                <svg class="ui-check__icon" viewBox="0 0 20 20" aria-hidden="true">
                    <circle class="ui-radio__dot" cx="10" cy="10" r="4.5" fill="currentColor" />
                </svg>
            </span>
            <span class="ui-check__label">{{ labelOf(option) }}</span>
        </label>
    </fieldset>
</template>

<script setup lang="ts" generic="T extends SelectItem">
import {nextTick} from 'vue';

import type {LabelKey, SelectItem} from '../types';

import {vGuardWhileDisabled} from '../internal/disabled-guard';

const {
    options,
    optionLabel,
    label,
    id,
    disabled = false,
    required = false,
    invalid = false,
    describedby,
} = defineProps<{
    options: T[];
    /**
     * property name or getter for an option's display string (the family's labelOf
     * convention — named optionLabel here because `label` is the group legend).
     */
    optionLabel: LabelKey<T>;
    /** the group legend's text; the default slot overrides it, for a legend that carries more than text. */
    label?: string;
    /** stable id — on the fieldset, the shared radio `name`, and the member-id base. */
    id: string;
    disabled?: boolean;
    /** conveys the required state to assistive tech via `aria-required` (radiogroup). */
    required?: boolean;
    /** invalid styling + aria; drive it from the field's error. */
    invalid?: boolean;
    /** id of the paired error element for `aria-describedby` (fieldset only). */
    describedby?: string;
}>();

/** The committed choice — `null` while nothing is selected. */
const model = defineModel<T['id'] | null>({required: true});

/** Resolve an option's display string from the `optionLabel` prop (property name or getter). */
const labelOf = (option: T): string =>
    typeof optionLabel === 'function'
        ? optionLabel(option)
        : String((option as Record<PropertyKey, unknown>)[optionLabel as PropertyKey]);

/** Whether an option is disabled on its own (`disabled` on the option); `disabled` disables the whole group. */
const disabledOf = (option: T): boolean => option.disabled === true;

// The model follows the native change event (keyboard arrows and clicks both land here). The browser
// has already moved the checked radio, so once the host has rendered every radio is set back to the
// model — a declined or deferred change otherwise leaves the clicked one showing (WR-1922). The
// radios are found from the one that changed: every radio sits inside this component's fieldset. A
// disabled option takes no change, also not a dispatched one, which a browser runs on a disabled radio.
const onChange = (event: Event, option: T): void => {
    const fieldset = (event.currentTarget as HTMLElement).closest('fieldset') as HTMLFieldSetElement;
    if (!disabledOf(option)) model.value = option.id;
    void nextTick(() => {
        const radios = fieldset.querySelectorAll<HTMLInputElement>('.ui-radio__input');
        for (const [index, radio] of radios.entries()) radio.checked = model.value === options[index].id;
    });
};
</script>
