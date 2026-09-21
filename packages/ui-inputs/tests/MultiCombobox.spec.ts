// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';
import {h} from 'vue';

import MultiCombobox from '../src/components/MultiCombobox.vue';
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
const mountMultiCombobox = (props: Record<string, unknown>, slots?: Record<string, unknown>) =>
    mount(MultiCombobox as any, {
        props: {options: FRUITS, label: 'name', id: 'fruit', modelValue: [], ...props},
        slots,
        attachTo: document.body,
    });

afterEach(() => {
    document.body.innerHTML = '';
});

describe('MultiCombobox', () => {
    it('renders a combobox input with no menu until opened, then the sorted options in a multiselectable listbox', async () => {
        const wrapper = mountMultiCombobox({placeholder: 'Pick some'});
        const input = wrapper.find('input');

        expect(input.attributes('role')).toBe('combobox');
        expect(input.attributes('aria-autocomplete')).toBe('list');
        expect(input.attributes('aria-expanded')).toBe('false');
        expect(input.attributes('placeholder')).toBe('Pick some');
        expect(input.attributes('aria-required')).toBeUndefined();
        expect(menu(wrapper).exists()).toBe(false);

        await input.trigger('click');

        expect(input.attributes('aria-expanded')).toBe('true');
        expect(wrapper.find('.ui-multicombobox__box').classes()).toContain('is-open');
        expect(
            menu(wrapper)
                .findAll('.ui-multicombobox__option')
                .map((o) => o.text()),
        ).toEqual(['Apricot', 'Mango', 'Watermelon']);
        expect(menu(wrapper).attributes('aria-label')).toBe('Options');
        expect(menu(wrapper).attributes('aria-multiselectable')).toBe('true');
    });

    it('opens on focus — the input is the trigger, and the list is its context', async () => {
        const wrapper = mountMultiCombobox({});
        await wrapper.find('input').trigger('focus');
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('renders chips for the committed values, has-value, required and invalid state, no placeholder', () => {
        const wrapper = mountMultiCombobox({
            modelValue: [3, 1],
            required: true,
            invalid: true,
            describedby: 'fruit-error',
        });
        const input = wrapper.find('input');

        // Chips follow SELECTION order (the model array), not options order.
        expect(wrapper.findAll('.ui-multicombobox__chip').map((chip) => chip.text())).toEqual(['Mango', 'Watermelon']);
        expect(wrapper.find('.ui-multicombobox__box').classes()).toContain('has-value');
        expect(wrapper.find('.ui-multicombobox__box').classes()).toContain('is-invalid');
        expect(input.attributes('placeholder')).toBeUndefined(); // chips replace the placeholder
        expect(input.attributes('aria-required')).toBe('true');
        expect(input.attributes('aria-invalid')).toBe('true');
        // The consumer's describedby AND the selection summary — both announced.
        expect(input.attributes('aria-describedby')).toBe('fruit-error fruit-selection');
    });

    it('conveys the committed selection through an aria-describedby summary (the input-as-trigger value surface)', () => {
        const wrapper = mountMultiCombobox({modelValue: [2, 1]});

        // No consumer describedby → the summary id stands alone.
        expect(wrapper.find('input').attributes('aria-describedby')).toBe('fruit-selection');
        expect(wrapper.find('#fruit-selection').text()).toBe('Apricot, Watermelon'); // selection order
    });

    it('filters the list as the user types, and an empty query shows all options', async () => {
        const wrapper = mountMultiCombobox({});
        const input = wrapper.find('input');

        await input.setValue('ap');
        expect(input.attributes('aria-expanded')).toBe('true'); // typing opens
        expect(
            menu(wrapper)
                .findAll('.ui-multicombobox__option')
                .map((o) => o.text()),
        ).toEqual(['Apricot']);

        await input.setValue('m');
        expect(
            menu(wrapper)
                .findAll('.ui-multicombobox__option')
                .map((o) => o.text()),
        ).toEqual(['Mango', 'Watermelon']);

        await input.setValue('');
        expect(
            menu(wrapper)
                .findAll('.ui-multicombobox__option')
                .map((o) => o.text()),
        ).toEqual(['Apricot', 'Mango', 'Watermelon']);

        await input.setValue('zzz');
        expect(menu(wrapper).findAll('.ui-multicombobox__option')).toHaveLength(0);
        expect(menu(wrapper).find('.ui-multicombobox__empty').exists()).toBe(true);
    });

    it('commits a filtered option on Enter: toggles, STAYS OPEN, clears the query, and keeps focus on the input', async () => {
        const wrapper = mountMultiCombobox({});
        const input = wrapper.find('input');

        await input.setValue('m'); // filtered: Mango, Watermelon
        await input.trigger('keydown', {key: 'ArrowDown'}); // pointer → 0 (Mango)
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-0');

        await input.trigger('keydown', {key: 'Enter'});

        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3]]); // Mango toggled in
        expect(menu(wrapper).exists()).toBe(true); // stays open
        expect(input.element.value).toBe(''); // query cleared — the full list is re-offered
        expect(menu(wrapper).findAll('.ui-multicombobox__option')).toHaveLength(3);
        expect(input.attributes('aria-activedescendant')).toBeUndefined(); // highlight reset with the list change
        expect(document.activeElement).toBe(input.element); // focus stays on the input
    });

    it('keeps the pointer in place on an unfiltered keyboard toggle, so Enter can toggle in place (MultiSelect parity)', async () => {
        const wrapper = mountMultiCombobox({});
        const input = wrapper.find('input');

        await input.trigger('keydown', {key: 'ArrowDown'}); // opens (pointer stays -1)
        await input.trigger('keydown', {key: 'ArrowDown'}); // pointer → 0 (Apricot)
        await input.trigger('keydown', {key: 'Enter'}); // toggle Apricot in
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-0'); // pointer preserved

        await wrapper.setProps({modelValue: [2]});
        await input.trigger('keydown', {key: 'Enter'}); // toggle Apricot back OUT, same position
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('toggles membership on click, stays open, and returns DOM focus to the input', async () => {
        const wrapper = mountMultiCombobox({modelValue: [3]}); // Mango committed
        const input = wrapper.find('input');
        await input.trigger('click');

        const apricot = menu(wrapper).findAll('.ui-multicombobox__option')[0]; // sorted first
        await apricot.trigger('mouseover');
        expect(apricot.classes()).toContain('is-active');

        await apricot.trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3, 2]]); // appended
        expect(menu(wrapper).exists()).toBe(true); // stays open
        expect(document.activeElement).toBe(input.element); // refocused after the pointer commit
    });

    it('marks committed membership aria-selected while the pointer rides aria-activedescendant', async () => {
        const wrapper = mountMultiCombobox({modelValue: [2]}); // Apricot committed
        const input = () => wrapper.find('input');

        expect(input().attributes('aria-controls')).toBeUndefined();
        expect(input().attributes('aria-activedescendant')).toBeUndefined();

        await input().trigger('keydown', {key: 'ArrowDown'}); // opens, pointer stays -1
        expect(input().attributes('aria-controls')).toBe('fruit-listbox');
        expect(menu(wrapper).attributes('id')).toBe('fruit-listbox');

        await input().trigger('keydown', {key: 'ArrowDown'}); // → Apricot (position 0)
        await input().trigger('keydown', {key: 'ArrowDown'}); // → Mango (position 1)
        expect(input().attributes('aria-activedescendant')).toBe('fruit-opt-1');

        // The pointer moved to Mango, but aria-selected still marks the COMMITTED Apricot.
        expect(
            menu(wrapper)
                .findAll('.ui-multicombobox__option')
                .map((o) => o.attributes('aria-selected')),
        ).toEqual(['true', 'false', 'false']);

        const ids = menu(wrapper)
            .findAll('.ui-multicombobox__option')
            .map((o) => o.attributes('id'));
        expect(ids).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('removes a committed value via its chip button without opening the menu, and localises removeLabel', async () => {
        const wrapper = mountMultiCombobox({modelValue: [1, 2], removeLabel: 'Verwijder'});

        const chips = wrapper.findAll('.ui-multicombobox__chip');
        expect(chips.map((chip) => chip.text())).toEqual(['Watermelon', 'Apricot']);
        expect(chips[0].find('.ui-multicombobox__chip-remove').attributes('aria-label')).toBe('Verwijder Watermelon');

        await chips[0].find('.ui-multicombobox__chip-remove').trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        expect(menu(wrapper).exists()).toBe(false); // chip remove ≠ open
        // Removal unmounts the focused button — focus must land on the input, not the body
        // (#185 review Minor: the APG chip treatment).
        expect(document.activeElement).toBe(wrapper.find('input').element);
    });

    it('removing a chip while the list is open keeps it open — the refocus never toggles the list', async () => {
        const wrapper = mountMultiCombobox({modelValue: [1, 2]});

        await wrapper.find('input').trigger('focus');
        expect(menu(wrapper).exists()).toBe(true);

        await wrapper.find('.ui-multicombobox__chip-remove').trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        expect(menu(wrapper).exists()).toBe(true); // stays open
        expect(document.activeElement).toBe(wrapper.find('input').element);
    });

    it('pops the last committed value on Backspace ONLY while the query is empty, and no-ops on an empty model', async () => {
        const wrapper = mountMultiCombobox({modelValue: [2, 1]});
        const input = wrapper.find('input');

        await input.trigger('keydown', {key: 'Backspace'}); // empty query → pop
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        expect(menu(wrapper).exists()).toBe(false); // Backspace never opens

        await input.setValue('ap'); // now the query holds text…
        await input.trigger('keydown', {key: 'Backspace'}); // …so Backspace stays native editing
        expect(wrapper.emitted('update:modelValue')).toHaveLength(1); // no second pop

        await input.setValue('');
        await wrapper.setProps({modelValue: []});
        await input.trigger('keydown', {key: 'Backspace'});
        expect(wrapper.emitted('update:modelValue')).toHaveLength(1); // nothing to pop
    });

    it('keeps an unresolved id in the model (no chip) until its option arrives, and Backspace pops it too', async () => {
        const wrapper = mountMultiCombobox({modelValue: [3, 99]});

        // id 99 has no option yet — no chip, but the model keeps it (async-options window).
        expect(wrapper.findAll('.ui-multicombobox__chip').map((chip) => chip.text())).toEqual(['Mango']);

        await wrapper.find('input').trigger('keydown', {key: 'Backspace'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3]]);
    });

    it('closes and clears the query on Escape, Tab, and click-outside — the resting state is empty + placeholder', async () => {
        const wrapper = mountMultiCombobox({});
        const input = wrapper.find('input');

        await input.setValue('ap'); // open + half-typed filter
        await input.trigger('keydown', {key: 'Escape'});
        expect(menu(wrapper).exists()).toBe(false);
        expect(input.element.value).toBe(''); // cleared, never a committed-label snap

        await input.setValue('m');
        await input.trigger('keydown', {key: 'Tab'});
        expect(menu(wrapper).exists()).toBe(false);
        expect(input.element.value).toBe('');

        await input.setValue('zzz');
        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);
        expect(input.element.value).toBe('');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined(); // nothing committed
    });

    it('survives the filtered list shrinking under the pointer, and Enter no-ops on a drained list', async () => {
        const wrapper = mountMultiCombobox({});
        const input = () => wrapper.find('input');

        await input().trigger('keydown', {key: 'ArrowDown'}); // open
        await input().trigger('keydown', {key: 'ArrowDown'}); // → 0
        await input().trigger('keydown', {key: 'ArrowDown'}); // → 1
        await input().trigger('keydown', {key: 'ArrowDown'}); // → 2 (last)
        expect(input().attributes('aria-activedescendant')).toBe('fruit-opt-2');

        // A narrowing that lands under the pointer must clamp, not dangle.
        await wrapper.setProps({options: FRUITS.slice(0, 1)});
        expect(menu(wrapper).findAll('.ui-multicombobox__option')).toHaveLength(1);
        const active = input().attributes('aria-activedescendant');
        if (active !== undefined) expect(menu(wrapper).find(`#${active}`).exists()).toBe(true);

        // Enter must commit the surviving option rather than index off the end.
        await input().trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[FRUITS[0].id]]);

        // Draining to nothing empties the highlight and Enter becomes a no-op.
        await wrapper.setProps({options: []});
        expect(input().attributes('aria-activedescendant')).toBeUndefined();
        await input().trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
        expect(menu(wrapper).find('.ui-multicombobox__empty').text()).toBe('No options');
    });

    it('round-trips string ids, resolves labels via a getter, and preserves given order unsorted', async () => {
        interface Tag {
            id: string;
            title: string;
        }
        const tags: Tag[] = [
            {id: 'b', title: 'beta'},
            {id: 'a', title: 'alpha'},
        ];
        const wrapper = mountMultiCombobox({
            options: tags,
            label: (tag: Tag) => tag.title.toUpperCase(),
            modelValue: ['a'],
            alphabeticalSort: false,
        });

        expect(wrapper.findAll('.ui-multicombobox__chip').map((chip) => chip.text())).toEqual(['ALPHA']);

        await wrapper.find('input').trigger('click');
        const options = menu(wrapper).findAll('.ui-multicombobox__option');
        expect(options.map((option) => option.text())).toEqual(['BETA', 'ALPHA']); // given order kept
        expect(options.map((option) => option.attributes('aria-selected'))).toEqual(['false', 'true']);

        await options[0].trigger('click'); // add 'b'
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']]);
    });

    it('renders per-option custom content through the #option scoped slot over the FILTERED list', async () => {
        const wrapper = mountMultiCombobox(
            {modelValue: [3]}, // Mango committed
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

        // Slotted content toggles exactly like the plain text — and the menu stays open.
        await menu(wrapper).findAll('.ui-multicombobox__option')[1].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3, 1]]); // + Watermelon
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('marks mutedOptions with .is-muted while keeping them committable', async () => {
        const wrapper = mountMultiCombobox({mutedOptions: [2]}); // Apricot
        await wrapper.find('input').trigger('click');

        const options = menu(wrapper).findAll('.ui-multicombobox__option'); // Apricot, Mango, Watermelon
        expect(options.map((o) => o.classes().includes('is-muted'))).toEqual([true, false, false]);

        // Muted ≠ disabled: a muted option still toggles membership.
        await options[0].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
    });

    it('uses a custom optionsLabel and emptyText', async () => {
        const wrapper = mountMultiCombobox({options: [], optionsLabel: 'Fruits', emptyText: 'Nothing here'});
        await wrapper.find('input').trigger('click');
        expect(menu(wrapper).attributes('aria-label')).toBe('Fruits');
        expect(menu(wrapper).find('.ui-multicombobox__empty').text()).toBe('Nothing here');
    });

    it('stays fully inert when disabled — synthetic keyboard included', async () => {
        const wrapper = mountMultiCombobox({modelValue: [1], disabled: true});
        const input = wrapper.find('input');

        expect(wrapper.find('.ui-multicombobox__box').classes()).toContain('is-disabled');
        expect(input.attributes('disabled')).toBeDefined();
        expect(wrapper.find('.ui-multicombobox__chip-remove').attributes('disabled')).toBeDefined();

        // Dispatched natively: VTU's trigger() silently SKIPS disabled elements, which would
        // leave the handler's disabled guard unexercised and the assertions vacuous — the
        // event must actually reach the handler to prove the guard.
        input.element.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);
        input.element.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('exposes an imperative focus() handle that moves DOM focus to the input', () => {
        const wrapper = mountMultiCombobox({});
        const inputEl = wrapper.find('input').element;
        expect(document.activeElement).not.toBe(inputEl);

        (wrapper.vm as unknown as {focus: () => void}).focus();
        expect(document.activeElement).toBe(inputEl);
    });

    it('removes its document listener on unmount', async () => {
        const wrapper = mountMultiCombobox({});
        await wrapper.find('input').trigger('click');
        wrapper.unmount();
        // Exercises onBeforeUnmount cleanup — a stray document click must not throw.
        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    it('jumps to the first/last option on Home/End while open (WR-0521)', async () => {
        const wrapper = mountMultiCombobox({});
        const input = wrapper.find('input');

        await input.trigger('click'); // open, pointer -1
        await input.trigger('keydown', {key: 'End'});
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-2');
        await input.trigger('keydown', {key: 'Home'});
        expect(input.attributes('aria-activedescendant')).toBe('fruit-opt-0');
    });

    it('announces drain-to-empty through the polite live region (WR-0521)', async () => {
        const wrapper = mountMultiCombobox({emptyText: 'No match'});
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
});
