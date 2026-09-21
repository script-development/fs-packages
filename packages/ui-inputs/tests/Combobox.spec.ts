// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {h} from 'vue';

import Combobox from '../src/components/Combobox.vue';
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
const mountCombobox = (props: Record<string, unknown>, slots?: Record<string, unknown>) =>
    mount(Combobox as any, {
        props: {options: FRUITS, label: 'name', id: 'fruit', modelValue: null, ...props},
        slots,
        attachTo: document.body,
    });

afterEach(() => {
    document.body.innerHTML = '';
});

describe('Combobox', () => {
    it('jumps to the first/last FILTERED option on Home/End while open (WR-0521)', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');
        const input = wrapper.find('input');

        await input.setValue('m'); // filtered: Mango, Watermelon
        await root.trigger('keydown', {key: 'End'});
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-1');
        await root.trigger('keydown', {key: 'Home'});
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-0');
    });

    it('announces drain-to-empty through the polite live region (WR-0521)', async () => {
        const wrapper = mountCombobox({emptyText: 'No match'});
        const region = wrapper.find('[aria-live="polite"]');
        const input = wrapper.find('input');

        expect(region.attributes('role')).toBe('status');
        expect(region.text()).toBe(''); // closed → silent

        await input.trigger('click');
        expect(region.text()).toBe(''); // open with options → silent

        await input.setValue('zzz'); // typing drains the filtered list
        expect(region.text()).toBe('No match');

        await input.setValue('m'); // matches return → the region empties again
        expect(region.text()).toBe('');
    });

    it('renders a combobox input with no menu until opened, then the sorted options', async () => {
        const wrapper = mountCombobox({placeholder: 'Pick one'});
        const input = wrapper.find('input');

        expect(input.attributes('role')).toBe('combobox');
        expect(input.attributes('aria-autocomplete')).toBe('list');
        expect(input.attributes('aria-expanded')).toBe('false');
        expect(input.attributes('placeholder')).toBe('Pick one');
        expect(input.attributes('aria-required')).toBeUndefined();
        expect(menu(wrapper).exists()).toBe(false);

        await input.trigger('click');

        expect(input.attributes('aria-expanded')).toBe('true');
        expect(input.classes()).toContain('is-open');
        const options = menu(wrapper).findAll('.ui-combobox__option');
        expect(options.map((o) => o.text())).toEqual(['Apricot', 'Mango', 'Watermelon']);
        expect(menu(wrapper).attributes('aria-label')).toBe('Options');
    });

    it('shows the committed value in the input and reflects required/invalid state', () => {
        const wrapper = mountCombobox({modelValue: 3, required: true, invalid: true, describedby: 'fruit-error'});
        const input = wrapper.find('input');

        expect(input.element.value).toBe('Mango');
        expect(input.classes()).toContain('is-invalid');
        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-invalid')).toBe('true');
        expect(input.attributes('aria-describedby')).toBe('fruit-error');
    });

    it('uses a custom optionsLabel as the listbox accessible name', async () => {
        const wrapper = mountCombobox({optionsLabel: 'Fruits'});
        await wrapper.find('input').trigger('click');
        expect(menu(wrapper).attributes('aria-label')).toBe('Fruits');
    });

    it('resolves the display value via a getter label', () => {
        const wrapper = mountCombobox({label: (o: Fruit) => `${o.name}!`, modelValue: 2});
        expect(wrapper.find('input').element.value).toBe('Apricot!');
    });

    it('preserves given order when alphabeticalSort is false and shows empty text with no options', async () => {
        const unsorted = mountCombobox({alphabeticalSort: false});
        await unsorted.find('input').trigger('click');
        expect(
            menu(unsorted)
                .findAll('.ui-combobox__option')
                .map((o) => o.text()),
        ).toEqual(['Watermelon', 'Apricot', 'Mango']);

        const empty = mountCombobox({options: [], emptyText: 'Nothing here'});
        await empty.find('input').trigger('click');
        expect(menu(empty).find('.ui-combobox__empty').text()).toBe('Nothing here');
        expect(menu(empty).findAll('.ui-combobox__option')).toHaveLength(0);
    });

    it('filters the list as the user types, and an empty query shows all options', async () => {
        const wrapper = mountCombobox({});
        const input = wrapper.find('input');

        await input.setValue('ap');
        expect(input.attributes('aria-expanded')).toBe('true'); // typing opens
        expect(
            menu(wrapper)
                .findAll('.ui-combobox__option')
                .map((o) => o.text()),
        ).toEqual(['Apricot']);

        await input.setValue('m');
        expect(
            menu(wrapper)
                .findAll('.ui-combobox__option')
                .map((o) => o.text()),
        ).toEqual(['Mango', 'Watermelon']);

        await input.setValue('');
        expect(
            menu(wrapper)
                .findAll('.ui-combobox__option')
                .map((o) => o.text()),
        ).toEqual(['Apricot', 'Mango', 'Watermelon']);

        await input.setValue('zzz');
        expect(menu(wrapper).findAll('.ui-combobox__option')).toHaveLength(0);
        expect(menu(wrapper).find('.ui-combobox__empty').exists()).toBe(true);
    });

    it('navigates the filtered list with the keyboard and commits the highlighted option on Enter', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');
        const input = wrapper.find('input');

        await input.setValue('m'); // filtered: Mango, Watermelon
        await root.trigger('keydown', {key: 'ArrowDown'}); // pointer → 0 (Mango)
        expect(menu(wrapper).findAll('.ui-combobox__option')[0].classes()).toContain('is-active');
        expect(menu(wrapper).findAll('.ui-combobox__option')[0].attributes('aria-selected')).toBe('false');

        await root.trigger('keydown', {key: 'ArrowDown'}); // pointer → 1 (Watermelon)
        await root.trigger('keydown', {key: 'ArrowUp'}); // pointer → 0 (Mango)
        await root.trigger('keydown', {key: 'Enter'});

        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]); // Mango
        expect(menu(wrapper).exists()).toBe(false); // closed
        expect(input.element.value).toBe('Mango'); // commit shows the chosen label
    });

    it('exposes the keyboard-focused filtered option via aria-activedescendant', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');
        const input = () => wrapper.find('input');

        // Closed: nothing owned, nothing focused.
        expect(input().attributes('aria-controls')).toBeUndefined();
        expect(input().attributes('aria-activedescendant')).toBeUndefined();

        await root.trigger('keydown', {key: 'ArrowDown'}); // opens, pointer stays -1
        expect(input().attributes('aria-controls')).toBe('fruit-listbox');
        expect(menu(wrapper).attributes('id')).toBe('fruit-listbox');
        expect(input().attributes('aria-activedescendant')).toBeUndefined(); // open, nothing highlighted

        await root.trigger('keydown', {key: 'ArrowDown'}); // → Apricot (position 0)
        expect(input().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        await root.trigger('keydown', {key: 'ArrowDown'}); // → Mango (position 1)
        expect(input().attributes('aria-activedescendant')).toBe('fruit-opt-1');

        await root.trigger('keydown', {key: 'ArrowUp'}); // back to Apricot
        expect(input().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        const ids = menu(wrapper)
            .findAll('.ui-combobox__option')
            .map((o) => o.attributes('id'));
        expect(ids).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(new Set(ids).size).toBe(ids.length);

        await root.trigger('keydown', {key: 'Escape'});
        expect(input().attributes('aria-activedescendant')).toBeUndefined();
        expect(input().attributes('aria-controls')).toBeUndefined();
    });

    it('clamps the pointer when the option list shrinks under it while open', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');
        const input = wrapper.find('input');

        await root.trigger('keydown', {key: 'ArrowDown'}); // open, pointer -1
        await root.trigger('keydown', {key: 'ArrowDown'}); // → 0
        await root.trigger('keydown', {key: 'ArrowDown'}); // → 1

        // A shrink that stays clear of the pointer must leave the highlight alone.
        await wrapper.setProps({options: FRUITS.slice(0, 2)}); // Watermelon, Apricot → sorted Apricot, Watermelon
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-1');

        await wrapper.setProps({options: FRUITS});
        await root.trigger('keydown', {key: 'ArrowDown'}); // → 2 (last)
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-2');

        // A narrowing that lands under the pointer must clamp, not dangle.
        await wrapper.setProps({options: FRUITS.slice(0, 1)}); // one option
        expect(menu(wrapper).findAll('.ui-combobox__option')).toHaveLength(1);
        const active = input.attributes('aria-activedescendant');
        if (active !== undefined) expect(menu(wrapper).find(`#${active}`).exists()).toBe(true);

        // Enter must commit the surviving option rather than index off the end.
        await root.trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([FRUITS[0].id]);
    });

    it('empties the highlight when options drain to nothing while open', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');

        await root.trigger('keydown', {key: 'ArrowDown'}); // open
        await root.trigger('keydown', {key: 'ArrowDown'}); // → 0

        await wrapper.setProps({options: []});

        expect(wrapper.find('input').attributes('aria-activedescendant')).toBeUndefined();
        await root.trigger('keydown', {key: 'Enter'}); // no-op, not a crash
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('marks the committed value as aria-selected, not the hovered option', async () => {
        const wrapper = mountCombobox({modelValue: 3}); // Mango — query starts as 'Mango'
        const input = wrapper.find('input');

        // Opening shows the FULL list (the committed-label query does not filter, WR-0576).
        await input.trigger('click');
        const options = menu(wrapper).findAll('.ui-combobox__option'); // Apricot, Mango, Watermelon
        expect(options.map((o) => o.attributes('aria-selected'))).toEqual(['false', 'true', 'false']);

        await options[2].trigger('mouseover'); // hover Watermelon
        expect(options[2].classes()).toContain('is-active');
        expect(
            menu(wrapper)
                .findAll('.ui-combobox__option')
                .map((o) => o.attributes('aria-selected')),
        ).toEqual(['false', 'true', 'false']);
    });

    it('reverts a half-typed non-match to the committed label on Escape and shows empty text meanwhile', async () => {
        const wrapper = mountCombobox({modelValue: 3}); // Mango
        const input = wrapper.find('input');
        const root = wrapper.find('.ui-combobox');

        await input.trigger('click');
        await input.setValue('zzz'); // no match
        expect(menu(wrapper).find('.ui-combobox__empty').exists()).toBe(true);
        expect(input.element.value).toBe('zzz');

        await root.trigger('keydown', {key: 'Escape'});
        expect(menu(wrapper).exists()).toBe(false);
        expect(input.element.value).toBe('Mango'); // reverted to the committed label
    });

    it('reverts a half-typed query to the empty committed state on click-outside', async () => {
        const wrapper = mountCombobox({}); // no selection
        const input = wrapper.find('input');

        await input.setValue('ap');
        expect(input.element.value).toBe('ap');
        expect(menu(wrapper).exists()).toBe(true);

        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);
        expect(input.element.value).toBe(''); // nothing committed → reverts to empty
    });

    it('re-syncs the input to the committed label when the model changes from outside while idle', async () => {
        const wrapper = mountCombobox({});
        const input = wrapper.find('input');
        expect(input.element.value).toBe('');

        await wrapper.setProps({modelValue: 1}); // external change while closed → Watermelon
        expect(input.element.value).toBe('Watermelon');
    });

    it('shows the committed label once a pre-set model’s option arrives asynchronously (edit-form pattern)', async () => {
        // Model committed before the options load: `selected` is undefined at mount, so the
        // input starts blank — but the moment the matching option arrives the input must show
        // its label, even though `model` never changed.
        const wrapper = mountCombobox({modelValue: 3, options: []});
        const input = wrapper.find('input');
        expect(input.element.value).toBe(''); // options empty → nothing to render yet

        await wrapper.setProps({options: FRUITS}); // async options arrive, model unchanged
        expect(input.element.value).toBe('Mango'); // committed label now resolves
    });

    it('does not disrupt the typed query when the model changes from outside while the menu is open', async () => {
        const wrapper = mountCombobox({});
        const input = wrapper.find('input');

        await input.trigger('click'); // open, query ''
        await wrapper.setProps({modelValue: 1}); // external change while OPEN must not yank the text
        expect(input.element.value).toBe('');
    });

    it('does nothing on Enter with no highlight, and ignores unhandled keys while open', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');

        await root.trigger('keydown', {key: 'ArrowDown'}); // opens, pointer -1
        await root.trigger('keydown', {key: 'Enter'}); // pointer < 0 → no commit
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        expect(menu(wrapper).exists()).toBe(true);

        await root.trigger('keydown', {key: 'ArrowRight'}); // unhandled → no state change
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('ignores a non-opening key while closed', async () => {
        const wrapper = mountCombobox({});
        await wrapper.find('.ui-combobox').trigger('keydown', {key: 'ArrowRight'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('closes and reverts on Escape', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');
        await root.trigger('keydown', {key: 'ArrowDown'});
        expect(menu(wrapper).exists()).toBe(true);
        await root.trigger('keydown', {key: 'Escape'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('commits an option on click and sets the pointer on mouseover', async () => {
        const wrapper = mountCombobox({});
        await wrapper.find('input').trigger('click');

        const mango = menu(wrapper).findAll('.ui-combobox__option')[1]; // sorted: Apricot, Mango, Watermelon
        await mango.trigger('mouseover');
        expect(mango.classes()).toContain('is-active');

        await mango.trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]); // Mango
        expect(menu(wrapper).exists()).toBe(false);
        expect(wrapper.find('input').element.value).toBe('Mango');
    });

    it('does not open when disabled, by click or by keyboard', async () => {
        const wrapper = mountCombobox({disabled: true});
        await wrapper.find('input').trigger('click');
        expect(menu(wrapper).exists()).toBe(false);

        await wrapper.find('.ui-combobox').trigger('keydown', {key: 'ArrowDown'});
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('closes and reverts on Tab', async () => {
        const wrapper = mountCombobox({});
        const root = wrapper.find('.ui-combobox');
        const input = wrapper.find('input');
        await input.setValue('zzz'); // open + half-typed non-match
        expect(menu(wrapper).exists()).toBe(true);
        await root.trigger('keydown', {key: 'Tab'});
        expect(menu(wrapper).exists()).toBe(false);
        expect(input.element.value).toBe(''); // reverted
    });

    it('exposes an imperative focus() handle that moves DOM focus to the input', () => {
        const wrapper = mountCombobox({});
        const inputEl = wrapper.find('input').element;
        expect(document.activeElement).not.toBe(inputEl);

        (wrapper.vm as unknown as {focus: () => void}).focus();
        expect(document.activeElement).toBe(inputEl);
    });

    it('closes when a click lands outside the component', async () => {
        const wrapper = mountCombobox({});
        await wrapper.find('input').trigger('click');
        expect(menu(wrapper).exists()).toBe(true);

        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);
    });

    it('removes its document listener on unmount', async () => {
        const wrapper = mountCombobox({});
        await wrapper.find('input').trigger('click');
        wrapper.unmount();
        // Exercises onBeforeUnmount cleanup — a stray document click must not throw.
        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    it('renders per-option custom content through the #option scoped slot over the FILTERED list', async () => {
        const wrapper = mountCombobox(
            {modelValue: 3}, // Mango committed
            {
                option: (props: {option: Fruit; index: number; selected: boolean}) =>
                    h('b', {class: 'swatch'}, `${props.option.name}#${props.index}${props.selected ? '*' : ''}`),
            },
        );
        const input = wrapper.find('input');

        await input.trigger('click');
        await input.setValue('m'); // filtered + sorted: Mango, Watermelon
        expect(
            menu(wrapper)
                .findAll('.swatch')
                .map((el) => el.text()),
        ).toEqual(['Mango#0*', 'Watermelon#1']);
    });

    it('marks mutedOptions with .is-muted while keeping them committable', async () => {
        const wrapper = mountCombobox({mutedOptions: [2]}); // Apricot
        await wrapper.find('input').trigger('click');

        const options = menu(wrapper).findAll('.ui-combobox__option'); // Apricot, Mango, Watermelon
        expect(options.map((o) => o.classes().includes('is-muted'))).toEqual([true, false, false]);

        await options[0].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2]); // Apricot commits
    });

    describe('browse-to-change (WR-0576)', () => {
        it('opens with the FULL option list when the input holds the committed label', async () => {
            const wrapper = mountCombobox({modelValue: 3}); // Mango committed → query rests on 'Mango'
            const input = wrapper.find('input');
            expect(input.element.value).toBe('Mango');

            await input.trigger('click');
            // The query EQUALS the committed label, so the filter must NOT engage — the
            // user opened to BROWSE, and a list narrowed to the already-chosen option
            // would force a manual clear before any other option is even visible.
            expect(
                menu(wrapper)
                    .findAll('.ui-combobox__option')
                    .map((o) => o.text()),
            ).toEqual(['Apricot', 'Mango', 'Watermelon']);
        });

        it('engages the filter on divergence and disengages again on convergence', async () => {
            const wrapper = mountCombobox({modelValue: 3}); // Mango
            const input = wrapper.find('input');

            await input.trigger('click');
            await input.setValue('Man'); // diverged from the committed label → filter engages
            expect(
                menu(wrapper)
                    .findAll('.ui-combobox__option')
                    .map((o) => o.text()),
            ).toEqual(['Mango']);

            // Retyping the EXACT committed label converges back to the full list — the
            // convention is equality, not a typed-once latch (MUI Autocomplete parity):
            // the committed label as a query carries no intent to narrow.
            await input.setValue('Mango');
            expect(
                menu(wrapper)
                    .findAll('.ui-combobox__option')
                    .map((o) => o.text()),
            ).toEqual(['Apricot', 'Mango', 'Watermelon']);
        });

        it('does not filter by emptyDisplayValue when the committed-null rendering fills the input', async () => {
            const wrapper = mountCombobox({emptyDisplayValue: 'Any fruit'}); // model null → input 'Any fruit'
            const input = wrapper.find('input');
            expect(input.element.value).toBe('Any fruit');

            await input.trigger('click');
            // Same defect shape as the committed label: 'Any fruit' matches no option
            // label, so the un-fixed filter would show an EMPTY list on open.
            expect(menu(wrapper).findAll('.ui-combobox__option')).toHaveLength(3);
            expect(menu(wrapper).find('.ui-combobox__empty').exists()).toBe(false);
        });

        it('selects the input text when the popup opens holding the committed label', async () => {
            const wrapper = mountCombobox({modelValue: 3}); // Mango
            const input = wrapper.find('input');

            await input.trigger('click');
            // Select-all-on-open: the first keystroke REPLACES the committed label and
            // starts a fresh filter (composes with the equality convention above).
            expect(input.element.selectionStart).toBe(0);
            expect(input.element.selectionEnd).toBe('Mango'.length);
        });

        it('does not select on open when the input is empty, and re-selects on a later reopen', async () => {
            const wrapper = mountCombobox({});
            const input = wrapper.find('input');
            const select = vi.spyOn(input.element, 'select');

            await input.trigger('click'); // nothing committed → nothing to select
            expect(select).not.toHaveBeenCalled();

            // Commit Mango, then REOPEN — the committed label is back in the input and
            // must be selected again on this open (a live watcher, not a one-shot).
            await menu(wrapper).findAll('.ui-combobox__option')[1].trigger('click'); // Mango
            await input.trigger('click');
            expect(select).toHaveBeenCalledTimes(1);
        });

        it('does not select the freshly-typed query when typing is what opens the popup', async () => {
            const wrapper = mountCombobox({modelValue: 3}); // Mango, closed
            const input = wrapper.find('input');
            const select = vi.spyOn(input.element, 'select');

            await input.setValue('Man'); // typing opens; the query has already diverged
            expect(select).not.toHaveBeenCalled(); // selecting now would eat the user's edit
        });
    });

    describe('clear entry (clearLabel) + emptyDisplayValue', () => {
        it('renders the entry above the filtered options, outside the index space and the filter', async () => {
            const wrapper = mountCombobox({clearLabel: 'No fruit'});
            const input = wrapper.find('input');

            await input.setValue('zzz'); // no option matches — the entry still renders
            const clear = menu(wrapper).find('.ui-combobox__clear');
            expect(clear.text()).toBe('No fruit');
            expect(clear.attributes('id')).toBe('fruit-clear');
            expect(clear.attributes('aria-selected')).toBe('true'); // model is null

            await input.setValue('m'); // option ids keep mapping to the FILTERED list only
            expect(
                menu(wrapper)
                    .findAll('.ui-combobox__option')
                    .map((o) => o.attributes('id')),
            ).toEqual(['fruit-opt-0', 'fruit-opt-1']);
        });

        it('commits null on Enter, closes, and snaps the input to emptyDisplayValue', async () => {
            const wrapper = mountCombobox({clearLabel: 'No fruit', emptyDisplayValue: 'Any fruit', modelValue: 3});
            const root = wrapper.find('.ui-combobox');
            const input = wrapper.find('input');
            expect(input.element.value).toBe('Mango');

            await root.trigger('keydown', {key: 'ArrowDown'}); // open
            await root.trigger('keydown', {key: 'ArrowDown'}); // → the clear entry
            expect(input.attributes('aria-activedescendant')).toBe('fruit-clear');
            await root.trigger('keydown', {key: 'Enter'});

            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
            expect(menu(wrapper).exists()).toBe(false);
            expect(input.element.value).toBe('Any fruit'); // the named empty state, not ''
        });

        it('starts on emptyDisplayValue when mounted with a null model, and reverts to it on dismiss', async () => {
            const wrapper = mountCombobox({clearLabel: 'No fruit', emptyDisplayValue: 'Any fruit'});
            const root = wrapper.find('.ui-combobox');
            const input = wrapper.find('input');
            expect(input.element.value).toBe('Any fruit');

            await input.setValue('zzz'); // half-typed non-match…
            await root.trigger('keydown', {key: 'Escape'});
            expect(input.element.value).toBe('Any fruit'); // …reverts to the named empty state
        });

        it('commits null on click', async () => {
            const wrapper = mountCombobox({clearLabel: 'No fruit', modelValue: 3});
            await wrapper.find('input').trigger('click');

            await menu(wrapper).find('.ui-combobox__clear').trigger('click');
            expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([null]);
            expect(menu(wrapper).exists()).toBe(false);
            // No emptyDisplayValue → the committed-null rendering is blank, as before.
            expect(wrapper.find('input').element.value).toBe('');
        });

        it('drops a hovered clear entry when the user types (keystrokes reset the whole highlight)', async () => {
            const wrapper = mountCombobox({clearLabel: 'No fruit'});
            const input = wrapper.find('input');

            await input.trigger('click');
            await menu(wrapper).find('.ui-combobox__clear').trigger('mouseover');
            expect(menu(wrapper).find('.ui-combobox__clear').classes()).toContain('is-active');
            expect(input.attributes('aria-activedescendant')).toBe('fruit-clear');

            await input.setValue('m'); // typing must reset the highlight to "nothing"
            expect(menu(wrapper).find('.ui-combobox__clear').classes()).not.toContain('is-active');
            expect(input.attributes('aria-activedescendant')).toBeUndefined();
        });
    });
});
