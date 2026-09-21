// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';
import {h} from 'vue';

import SingleSelect from '../src/components/SingleSelect.vue';
import {menu} from './find-menu';

interface Fruit {
    id: number;
    name: string;
}

const FRUITS: Fruit[] = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic SFC + VTU mount inference
const mountSelect = (props: Record<string, unknown>, slots?: Record<string, unknown>) =>
    mount(SingleSelect as any, {
        props: {options: FRUITS, label: 'name', id: 'fruit', modelValue: null, ...props},
        slots,
        attachTo: document.body,
    });

afterEach(() => {
    document.body.innerHTML = '';
});

describe('SingleSelect', () => {
    it('jumps to the first/last option on Home/End while open (WR-0521)', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');
        const trigger = wrapper.find('button');

        await root.trigger('keydown', {key: 'Enter'}); // open, pointer -1
        await root.trigger('keydown', {key: 'End'});
        expect(trigger.attributes('aria-activedescendant')).toBe('fruit-opt-2');
        await root.trigger('keydown', {key: 'Home'});
        expect(trigger.attributes('aria-activedescendant')).toBe('fruit-opt-0');
    });

    it('announces the empty state through the polite live region while open (WR-0521)', async () => {
        const wrapper = mountSelect({emptyText: 'No match'});
        const region = wrapper.find('[aria-live="polite"]');

        expect(region.attributes('role')).toBe('status');
        expect(region.text()).toBe(''); // closed → silent, options or not

        await wrapper.find('button').trigger('click');
        expect(region.text()).toBe(''); // open with options → silent

        await wrapper.setProps({options: []}); // drained while open → announced
        expect(region.text()).toBe('No match');
    });

    it('shows the placeholder and no menu until opened, then renders sorted options', async () => {
        const wrapper = mountSelect({placeholder: 'Pick one'});

        expect(wrapper.find('.ui-select__placeholder').text()).toBe('Pick one');
        expect(wrapper.find('.ui-select__trigger').classes()).not.toContain('has-value');
        expect(menu(wrapper).exists()).toBe(false);

        expect(wrapper.find('.ui-select__trigger').attributes('aria-required')).toBeUndefined();

        await wrapper.find('.ui-select__trigger').trigger('click');

        const options = menu(wrapper).findAll('.ui-select__option');
        expect(options.map((o) => o.text())).toEqual(['Apricot', 'Mango', 'Watermelon']);
        expect(wrapper.find('.ui-select__trigger').classes()).toContain('is-open');
        expect(menu(wrapper).attributes('aria-label')).toBe('Options');
    });

    it('renders the selected value, has-value, required and invalid state', () => {
        const wrapper = mountSelect({modelValue: 3, required: true, invalid: true, describedby: 'fruit-error'});
        const trigger = wrapper.find('.ui-select__trigger');

        expect(wrapper.find('.ui-select__value').text()).toBe('Mango');
        expect(trigger.classes()).toContain('has-value');
        expect(trigger.classes()).toContain('is-invalid');
        expect(trigger.attributes('aria-required')).toBe('true');
        expect(trigger.attributes('aria-invalid')).toBe('true');
        expect(trigger.attributes('aria-describedby')).toBe('fruit-error');
    });

    it('uses a custom optionsLabel as the listbox accessible name', async () => {
        const wrapper = mountSelect({optionsLabel: 'Fruits'});
        await wrapper.find('.ui-select__trigger').trigger('click');
        expect(menu(wrapper).attributes('aria-label')).toBe('Fruits');
    });

    it('resolves the display value via a getter label', () => {
        const wrapper = mountSelect({label: (o: Fruit) => `${o.name}!`, modelValue: 2});
        expect(wrapper.find('.ui-select__value').text()).toBe('Apricot!');
    });

    it('preserves given order when alphabeticalSort is false and shows empty text with no options', async () => {
        const unsorted = mountSelect({alphabeticalSort: false});
        await unsorted.find('.ui-select__trigger').trigger('click');
        expect(
            menu(unsorted)
                .findAll('.ui-select__option')
                .map((o) => o.text()),
        ).toEqual(['Watermelon', 'Apricot', 'Mango']);

        const empty = mountSelect({options: [], emptyText: 'Nothing here'});
        await empty.find('.ui-select__trigger').trigger('click');
        expect(menu(empty).find('.ui-select__empty').text()).toBe('Nothing here');
        expect(menu(empty).findAll('.ui-select__option')).toHaveLength(0);
    });

    it('navigates with the keyboard (down/up), highlights the pointer, and commits on Enter', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');

        await root.trigger('keydown', {key: 'ArrowDown'}); // opens (pointer stays -1)
        await root.trigger('keydown', {key: 'ArrowDown'}); // pointer → 0 (Apricot)
        expect(menu(wrapper).findAll('.ui-select__option')[0].classes()).toContain('is-active');
        // Keyboard focus is visual + activedescendant only — it must NOT claim selection,
        // because nothing is committed until Enter.
        expect(menu(wrapper).findAll('.ui-select__option')[0].attributes('aria-selected')).toBe('false');

        await root.trigger('keydown', {key: 'ArrowDown'}); // pointer → 1
        await root.trigger('keydown', {key: 'ArrowUp'}); // pointer → 0
        await root.trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2]); // Apricot
        expect(menu(wrapper).exists()).toBe(false); // closed
    });

    it('exposes keyboard focus to assistive tech via aria-activedescendant', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');
        const trigger = () => wrapper.find('.ui-select__trigger');

        // Closed: nothing owned, nothing focused.
        expect(trigger().attributes('aria-controls')).toBeUndefined();
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();

        await root.trigger('keydown', {key: 'ArrowDown'}); // opens, pointer stays -1
        expect(trigger().attributes('aria-controls')).toBe('fruit-listbox');
        expect(menu(wrapper).attributes('id')).toBe('fruit-listbox');
        // Open but nothing highlighted yet — the IDREF must be absent, not empty.
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();

        // Sorted order is Apricot, Mango, Watermelon; ids are keyed by POSITION, not by
        // option.id — an unconstrained option.id could contain whitespace and yield an
        // invalid IDREF.
        await root.trigger('keydown', {key: 'ArrowDown'}); // → Apricot
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        await root.trigger('keydown', {key: 'ArrowDown'}); // → Mango
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-1');

        await root.trigger('keydown', {key: 'ArrowUp'}); // back to Apricot
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        // Every referenced id must actually exist in the listbox, and be unique.
        const ids = menu(wrapper)
            .findAll('.ui-select__option')
            .map((o) => o.attributes('id'));
        expect(ids).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(new Set(ids).size).toBe(ids.length);

        await root.trigger('keydown', {key: 'Escape'});
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();
        expect(trigger().attributes('aria-controls')).toBeUndefined();
    });

    it('survives options shrinking under the pointer while the listbox is open', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');
        const trigger = () => wrapper.find('.ui-select__trigger');

        await root.trigger('keydown', {key: 'ArrowDown'}); // open
        await root.trigger('keydown', {key: 'ArrowDown'}); // → index 0

        // A shrink that stays clear of the pointer must leave the highlight alone.
        await wrapper.setProps({options: FRUITS.slice(0, 2)});
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        await wrapper.setProps({options: FRUITS});
        await root.trigger('keydown', {key: 'ArrowDown'}); // → index 1
        await root.trigger('keydown', {key: 'ArrowDown'}); // → index 2 (last)
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-2');

        // A dependent list narrowing (e.g. City reloading on a Country change) must not
        // leave the pointer past the end — the computed re-evaluates on render, so an
        // unguarded index would throw here with no user input at all.
        await wrapper.setProps({options: FRUITS.slice(0, 1)});

        expect(menu(wrapper).findAll('.ui-select__option')).toHaveLength(1);
        const active = trigger().attributes('aria-activedescendant');
        // Whatever it points at must actually exist in the listbox.
        if (active !== undefined) expect(menu(wrapper).find(`#${active}`).exists()).toBe(true);

        // Enter must commit the surviving option rather than index off the end.
        await root.trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([FRUITS[0].id]);
    });

    it('empties the highlight when options drain to nothing while open', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');

        await root.trigger('keydown', {key: 'ArrowDown'}); // open
        await root.trigger('keydown', {key: 'ArrowDown'}); // → index 0

        await wrapper.setProps({options: []});

        expect(wrapper.find('.ui-select__trigger').attributes('aria-activedescendant')).toBeUndefined();
        // Enter on an empty list is a no-op, not a crash.
        await root.trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('marks the committed value as aria-selected, not the hovered option', async () => {
        const wrapper = mountSelect({modelValue: 3}); // Mango
        await wrapper.find('.ui-select__trigger').trigger('click');

        const options = menu(wrapper).findAll('.ui-select__option'); // Apricot, Mango, Watermelon
        expect(options.map((o) => o.attributes('aria-selected'))).toEqual(['false', 'true', 'false']);

        // Hovering a different option moves the visual pointer but must not move selection.
        await options[2].trigger('mouseover');
        expect(options[2].classes()).toContain('is-active');
        expect(
            menu(wrapper)
                .findAll('.ui-select__option')
                .map((o) => o.attributes('aria-selected')),
        ).toEqual(['false', 'true', 'false']);
    });

    it('does nothing on Enter with no highlight, and ignores unhandled keys while open', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');

        await root.trigger('keydown', {key: 'ArrowDown'}); // opens, pointer -1
        await root.trigger('keydown', {key: 'Enter'}); // pointer < 0 → no commit
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        expect(menu(wrapper).exists()).toBe(true);

        await root.trigger('keydown', {key: 'x'}); // unhandled → no state change
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('ignores a non-opening key while closed', async () => {
        const wrapper = mountSelect({});
        await wrapper.find('.ui-select').trigger('keydown', {key: 'x'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('closes on Escape', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');
        await root.trigger('keydown', {key: 'ArrowDown'});
        expect(menu(wrapper).exists()).toBe(true);
        await root.trigger('keydown', {key: 'Escape'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('selects an option on click and sets the pointer on mouseover', async () => {
        const wrapper = mountSelect({});
        await wrapper.find('.ui-select__trigger').trigger('click');

        const mango = menu(wrapper).findAll('.ui-select__option')[1];
        await mango.trigger('mouseover');
        expect(mango.classes()).toContain('is-active');

        await mango.trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]); // Mango
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('does not open when disabled, by click or by keyboard', async () => {
        const wrapper = mountSelect({disabled: true});
        await wrapper.find('.ui-select__trigger').trigger('click');
        expect(menu(wrapper).exists()).toBe(false);

        await wrapper.find('.ui-select').trigger('keydown', {key: 'ArrowDown'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('closes on Tab', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');
        await root.trigger('keydown', {key: 'ArrowDown'}); // open
        expect(menu(wrapper).exists()).toBe(true);
        await root.trigger('keydown', {key: 'Tab'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('closes when a click lands outside the component', async () => {
        const wrapper = mountSelect({});
        await wrapper.find('.ui-select__trigger').trigger('click');
        expect(menu(wrapper).exists()).toBe(true);

        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('removes its document listener on unmount', async () => {
        const wrapper = mountSelect({});
        await wrapper.find('.ui-select__trigger').trigger('click');
        wrapper.unmount();
        // Exercises onBeforeUnmount cleanup — a stray document click must not throw.
        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    it('leaves the highlight on nothing when ArrowUp is pressed on the first option (no clear entry)', async () => {
        const wrapper = mountSelect({});
        const root = wrapper.find('.ui-select');
        const trigger = () => wrapper.find('.ui-select__trigger');

        await root.trigger('keydown', {key: 'ArrowDown'}); // open
        await root.trigger('keydown', {key: 'ArrowDown'}); // → index 0
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        await root.trigger('keydown', {key: 'ArrowUp'}); // no entry above → nothing
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();
        expect(menu(wrapper).exists()).toBe(true); // still open
    });

    it('renders per-option custom content through the #option scoped slot, chrome outside the slot', async () => {
        const wrapper = mountSelect(
            {modelValue: 3},
            {
                option: (props: {option: Fruit; index: number; selected: boolean; active: boolean}) =>
                    h(
                        'b',
                        {class: 'swatch'},
                        `${props.option.name}#${props.index}${props.selected ? '*' : ''}${props.active ? '!' : ''}`,
                    ),
            },
        );
        const root = wrapper.find('.ui-select');

        await wrapper.find('.ui-select__trigger').trigger('click');
        // Sorted order: Apricot(2), Mango(3, committed), Watermelon(1) — slot payload carries
        // the option, its rendered index, and the selected flag.
        expect(
            menu(wrapper)
                .findAll('.swatch')
                .map((el) => el.text()),
        ).toEqual(['Apricot#0', 'Mango#1*', 'Watermelon#2']);

        // `active` tracks the keyboard pointer, and the .is-active chrome stays on the <li>.
        await root.trigger('keydown', {key: 'ArrowDown'});
        expect(
            menu(wrapper)
                .findAll('.swatch')
                .map((el) => el.text()),
        ).toEqual(['Apricot#0!', 'Mango#1*', 'Watermelon#2']);
        expect(menu(wrapper).findAll('.ui-select__option')[0].classes()).toContain('is-active');

        // Slotted content commits exactly like the plain text (the <li> owns the click).
        await menu(wrapper).findAll('.ui-select__option')[0].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2]); // Apricot
    });

    it('marks mutedOptions with .is-muted while keeping them committable', async () => {
        const wrapper = mountSelect({mutedOptions: [1, 3]}); // Watermelon + Mango
        await wrapper.find('.ui-select__trigger').trigger('click');

        const options = menu(wrapper).findAll('.ui-select__option'); // Apricot, Mango, Watermelon
        expect(options.map((o) => o.classes().includes('is-muted'))).toEqual([false, true, true]);

        // Muted ≠ disabled: a muted option still commits.
        await options[1].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]); // Mango
    });

    describe('clear entry (clearLabel)', () => {
        it('renders the entry above the options, outside the index space', async () => {
            const wrapper = mountSelect({clearLabel: 'No fruit'});
            await wrapper.find('.ui-select__trigger').trigger('click');

            const entries = menu(wrapper).findAll('[role="option"]');
            expect(entries[0].classes()).toContain('ui-select__clear');
            expect(entries[0].text()).toBe('No fruit');
            expect(entries[0].attributes('id')).toBe('fruit-clear');
            // The option ids are untouched — the entry does not shift the index space.
            expect(
                menu(wrapper)
                    .findAll('.ui-select__option')
                    .map((o) => o.attributes('id')),
            ).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
            // Committed-null state: the entry IS the committed value.
            expect(entries[0].attributes('aria-selected')).toBe('true');
        });

        it('is not aria-selected once a value is committed', async () => {
            const wrapper = mountSelect({clearLabel: 'No fruit', modelValue: 3});
            await wrapper.find('.ui-select__trigger').trigger('click');
            expect(menu(wrapper).find('.ui-select__clear').attributes('aria-selected')).toBe('false');
        });

        it('owns the keyboard slot between "nothing" and index 0', async () => {
            const wrapper = mountSelect({clearLabel: 'No fruit'});
            const root = wrapper.find('.ui-select');
            const trigger = () => wrapper.find('.ui-select__trigger');

            await root.trigger('keydown', {key: 'ArrowDown'}); // open, nothing highlighted
            expect(trigger().attributes('aria-activedescendant')).toBeUndefined();

            await root.trigger('keydown', {key: 'ArrowDown'}); // → the clear entry
            expect(trigger().attributes('aria-activedescendant')).toBe('fruit-clear');
            expect(menu(wrapper).find('.ui-select__clear').classes()).toContain('is-active');

            await root.trigger('keydown', {key: 'ArrowDown'}); // → index 0
            expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');
            expect(menu(wrapper).find('.ui-select__clear').classes()).not.toContain('is-active');

            await root.trigger('keydown', {key: 'ArrowUp'}); // back up → the clear entry
            expect(trigger().attributes('aria-activedescendant')).toBe('fruit-clear');

            await root.trigger('keydown', {key: 'ArrowUp'}); // above the entry → nothing
            expect(trigger().attributes('aria-activedescendant')).toBeUndefined();
            expect(menu(wrapper).exists()).toBe(true); // still open
        });

        it('commits null and closes on Enter', async () => {
            const wrapper = mountSelect({clearLabel: 'No fruit', modelValue: 3});
            const root = wrapper.find('.ui-select');

            await root.trigger('keydown', {key: 'ArrowDown'}); // open
            await root.trigger('keydown', {key: 'ArrowDown'}); // → the clear entry
            await root.trigger('keydown', {key: 'Enter'});

            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
            expect(menu(wrapper).exists()).toBe(false);
        });

        it('commits null and closes on click, and highlights on hover', async () => {
            const wrapper = mountSelect({clearLabel: 'No fruit', modelValue: 3});
            await wrapper.find('.ui-select__trigger').trigger('click');

            const clear = menu(wrapper).find('.ui-select__clear');
            await clear.trigger('mouseover');
            expect(clear.classes()).toContain('is-active');

            // Hovering an option hands the highlight over instantly (pointer moves off -1).
            await menu(wrapper).findAll('.ui-select__option')[1].trigger('mouseover');
            expect(menu(wrapper).find('.ui-select__clear').classes()).not.toContain('is-active');
            expect(menu(wrapper).findAll('.ui-select__option')[1].classes()).toContain('is-active');

            await menu(wrapper).find('.ui-select__clear').trigger('click');
            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
            expect(menu(wrapper).exists()).toBe(false);
        });

        it('drops the highlight when clearLabel is withdrawn while the entry holds it', async () => {
            const wrapper = mountSelect({clearLabel: 'No fruit'});
            const root = wrapper.find('.ui-select');
            const trigger = () => wrapper.find('.ui-select__trigger');

            await root.trigger('keydown', {key: 'ArrowDown'}); // open
            await root.trigger('keydown', {key: 'ArrowDown'}); // → the clear entry
            expect(trigger().attributes('aria-activedescendant')).toBe('fruit-clear');

            await wrapper.setProps({clearLabel: undefined});
            expect(menu(wrapper).find('.ui-select__clear').exists()).toBe(false);
            expect(trigger().attributes('aria-activedescendant')).toBeUndefined();
        });

        it('renders emptyDisplayValue as the trigger VALUE when the model is null', () => {
            const wrapper = mountSelect({clearLabel: 'No fruit', emptyDisplayValue: 'No fruit (any)'});

            expect(wrapper.find('.ui-select__placeholder').exists()).toBe(false);
            expect(wrapper.find('.ui-select__value').text()).toBe('No fruit (any)');
            // `has-value` stays keyed on an actual selection — the model IS null.
            expect(wrapper.find('.ui-select__trigger').classes()).not.toContain('has-value');
        });
    });
});
