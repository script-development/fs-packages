// @vitest-environment happy-dom
// WR-1922: the browser flips the native input before the host decides. A host that declines (asks
// first) or decides later (awaits a save) leaves the bound value unchanged, Vue sees no prop change
// and never re-patches `checked`, so the control shows the browser's state instead of the model's.
// happy-dom is faithful here: the defect is a DOM property Vue does not re-patch, not a platform
// event rule.
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {nextTick} from 'vue';

import Checkbox from '../src/components/Checkbox.vue';
import Switch from '../src/components/Switch.vue';

// A bound listener is what makes the model controlled: with no `onUpdate:modelValue` at all,
// `defineModel` keeps the value locally and the host never gets to decline.
const decline = (): void => {};

const checkedOf = (wrapper: ReturnType<typeof mount>): boolean[] =>
    wrapper.findAll('input').map((input) => (input.element as HTMLInputElement).checked);

describe.each([
    ['Checkbox', Checkbox],
    ['Switch', Switch],
])('%s — a change the host does not take', (_name, component) => {
    const mountBoolean = (onUpdate: (value: boolean) => void = decline) =>
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- two SFCs through one mount
        mount(component as any, {
            props: {id: 'c', label: 'Accept', modelValue: false, 'onUpdate:modelValue': onUpdate},
        });

    it('host declines — the control goes back to unchecked', async () => {
        const wrapper = mountBoolean();

        await wrapper.find('input').setValue(true);
        await nextTick();

        expect(wrapper.emitted('update:modelValue')).toEqual([[true]]);
        expect(checkedOf(wrapper)).toEqual([false]);
    });

    it('host takes it later — the control shows the model meanwhile, then follows it', async () => {
        const wrapper = mountBoolean();

        await wrapper.find('input').setValue(true);
        await nextTick();
        expect(checkedOf(wrapper)).toEqual([false]);

        await wrapper.setProps({modelValue: true});
        expect(checkedOf(wrapper)).toEqual([true]);
    });

    it('REGRESSION PIN — host takes it at once — the control stays checked', async () => {
        const wrapper = mountBoolean((value) => void wrapper.setProps({modelValue: value}));

        await wrapper.find('input').setValue(true);
        await nextTick();

        expect(checkedOf(wrapper)).toEqual([true]);
    });
});

// CheckboxGroup's and RadioGroup's cases return with them.
