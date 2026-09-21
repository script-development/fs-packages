// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {afterEach, describe, expect, it} from 'vitest';
import {h} from 'vue';

import MultiSelect from '../src/components/MultiSelect.vue';
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
const mountMulti = (props: Record<string, unknown>, slots?: Record<string, unknown>) =>
    mount(MultiSelect as any, {
        props: {options: FRUITS, label: 'name', id: 'fruit', modelValue: [], ...props},
        slots,
        attachTo: document.body,
    });

afterEach(() => {
    document.body.innerHTML = '';
});

describe('MultiSelect', () => {
    it('jumps to the first/last option on Home/End while open (WR-0521)', async () => {
        const wrapper = mountMulti({});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        await trigger.trigger('keydown', {key: 'ArrowDown'}); // open, pointer -1
        await trigger.trigger('keydown', {key: 'End'});
        expect(trigger.attributes('aria-activedescendant')).toBe('fruit-opt-2');
        await trigger.trigger('keydown', {key: 'Home'});
        expect(trigger.attributes('aria-activedescendant')).toBe('fruit-opt-0');
    });

    it('announces the empty state through the polite live region while open (WR-0521)', async () => {
        const wrapper = mountMulti({emptyText: 'No match'});
        const region = wrapper.find('[aria-live="polite"]');

        expect(region.attributes('role')).toBe('status');
        expect(region.text()).toBe(''); // closed → silent, options or not

        await wrapper.find('.ui-multiselect__trigger').trigger('click');
        expect(region.text()).toBe(''); // open with options → silent

        await wrapper.setProps({options: []}); // drained while open → announced
        expect(region.text()).toBe('No match');
    });

    it('shows the placeholder and no menu until opened, then renders sorted options in a multiselectable listbox', async () => {
        const wrapper = mountMulti({placeholder: 'Pick some'});

        expect(wrapper.find('.ui-multiselect__placeholder').text()).toBe('Pick some');
        expect(wrapper.find('.ui-multiselect__box').classes()).not.toContain('has-value');
        expect(menu(wrapper).exists()).toBe(false);
        expect(wrapper.find('.ui-multiselect__trigger').attributes('aria-required')).toBeUndefined();

        await wrapper.find('.ui-multiselect__trigger').trigger('click');

        const options = menu(wrapper).findAll('.ui-multiselect__option');
        expect(options.map((option) => option.text())).toEqual(['Apricot', 'Mango', 'Watermelon']);
        expect(wrapper.find('.ui-multiselect__box').classes()).toContain('is-open');
        expect(menu(wrapper).attributes('aria-label')).toBe('Options');
        expect(menu(wrapper).attributes('aria-multiselectable')).toBe('true');
    });

    it('renders chips for the committed values, has-value, required and invalid state', () => {
        const wrapper = mountMulti({modelValue: [3, 1], required: true, invalid: true, describedby: 'fruit-error'});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        // Chips follow SELECTION order (the model array), not options order.
        expect(wrapper.findAll('.ui-multiselect__chip').map((chip) => chip.text())).toEqual(['Mango', 'Watermelon']);
        expect(wrapper.find('.ui-multiselect__placeholder').exists()).toBe(false);
        expect(wrapper.find('.ui-multiselect__box').classes()).toContain('has-value');
        expect(wrapper.find('.ui-multiselect__box').classes()).toContain('is-invalid');
        expect(trigger.attributes('aria-required')).toBe('true');
        expect(trigger.attributes('aria-invalid')).toBe('true');
        expect(trigger.attributes('aria-describedby')).toBe('fruit-error');
    });

    it('commits on Enter WITHOUT closing, toggles membership in place, and marks committed options aria-selected', async () => {
        const wrapper = mountMulti({});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        await trigger.trigger('keydown', {key: 'ArrowDown'}); // opens (pointer stays -1)
        await trigger.trigger('keydown', {key: 'ArrowDown'}); // pointer → 0 (Apricot)
        await trigger.trigger('keydown', {key: 'Enter'}); // commit Apricot
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        // The menu STAYS OPEN — toggle-in-place, not choose-and-dismiss.
        expect(menu(wrapper).exists()).toBe(true);

        // The committed option remains listed, aria-selected by MEMBERSHIP (not pointer).
        await wrapper.setProps({modelValue: [2]});
        const selectedFlags = menu(wrapper)
            .findAll('.ui-multiselect__option')
            .map((o) => o.attributes('aria-selected'));
        expect(selectedFlags).toEqual(['true', 'false', 'false']); // sorted: Apricot, Mango, Watermelon

        // Committing the same option again toggles it OFF — and still stays open.
        await trigger.trigger('keydown', {key: 'Enter'}); // pointer still 0 (Apricot)
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[]]);
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('toggles membership on click and stays open, adding to the end of the selection', async () => {
        const wrapper = mountMulti({modelValue: [3]}); // Mango committed
        await wrapper.find('.ui-multiselect__trigger').trigger('click');

        const apricot = menu(wrapper).findAll('.ui-multiselect__option')[0]; // sorted first
        await apricot.trigger('mouseover');
        expect(apricot.classes()).toContain('is-active');

        await apricot.trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3, 2]]); // appended
        expect(menu(wrapper).exists()).toBe(true); // stays open
    });

    it('removes a committed value via its chip button without opening the menu', async () => {
        const wrapper = mountMulti({modelValue: [1, 2]});

        const chips = wrapper.findAll('.ui-multiselect__chip');
        expect(chips.map((chip) => chip.text())).toEqual(['Watermelon', 'Apricot']);
        expect(chips[0].find('.ui-multiselect__chip-remove').attributes('aria-label')).toBe('Remove Watermelon');

        await chips[0].find('.ui-multiselect__chip-remove').trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        expect(menu(wrapper).exists()).toBe(false); // chip remove ≠ open
    });

    it('localises the chip-remove accessible name via the removeLabel prop', () => {
        const wrapper = mountMulti({modelValue: [1], removeLabel: 'Verwijder'});
        expect(wrapper.find('.ui-multiselect__chip-remove').attributes('aria-label')).toBe('Verwijder Watermelon');
    });

    it('conveys the committed selection as trigger content while closed (WCAG 4.1.2 value)', () => {
        // The chips render OUTSIDE the button, so without this span a populated closed
        // control would announce nothing — the sr-value span is the trigger's value surface.
        const wrapper = mountMulti({modelValue: [2, 1]});
        const srValue = wrapper.find('.ui-multiselect__trigger .ui-multiselect__sr-value');
        expect(srValue.text()).toBe('Apricot, Watermelon'); // selection order, labels only
        expect(wrapper.find('.ui-multiselect__placeholder').exists()).toBe(false);
    });

    it('pops the last committed value on Backspace at the trigger, and no-ops when empty', async () => {
        const wrapper = mountMulti({modelValue: [2, 1]});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        await trigger.trigger('keydown', {key: 'Backspace'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
        expect(menu(wrapper).exists()).toBe(false); // Backspace never opens

        await wrapper.setProps({modelValue: []});
        await trigger.trigger('keydown', {key: 'Backspace'});
        // Only the first Backspace emitted — an empty model has nothing to pop.
        expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
    });

    it('exposes keyboard focus via aria-activedescendant while membership stays on aria-selected', async () => {
        const wrapper = mountMulti({modelValue: [2]}); // Apricot committed
        const trigger = () => wrapper.find('.ui-multiselect__trigger');

        expect(trigger().attributes('aria-controls')).toBeUndefined();
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();

        await trigger().trigger('keydown', {key: 'ArrowDown'}); // opens, pointer stays -1
        expect(trigger().attributes('aria-controls')).toBe('fruit-listbox');
        expect(menu(wrapper).attributes('id')).toBe('fruit-listbox');
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();

        await trigger().trigger('keydown', {key: 'ArrowDown'}); // → Apricot (position 0)
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');
        await trigger().trigger('keydown', {key: 'ArrowDown'}); // → Mango (position 1)
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-1');

        // The pointer moved to Mango, but aria-selected still marks the COMMITTED Apricot.
        expect(
            menu(wrapper)
                .findAll('.ui-multiselect__option')
                .map((o) => o.attributes('aria-selected')),
        ).toEqual(['true', 'false', 'false']);

        const ids = menu(wrapper)
            .findAll('.ui-multiselect__option')
            .map((o) => o.attributes('id'));
        expect(ids).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('does not open when disabled — click, keyboard, chip remove, and Backspace all inert', async () => {
        const wrapper = mountMulti({modelValue: [1], disabled: true});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        expect(wrapper.find('.ui-multiselect__box').classes()).toContain('is-disabled');
        expect(trigger.attributes('disabled')).toBeDefined();
        expect(wrapper.find('.ui-multiselect__chip-remove').attributes('disabled')).toBeDefined();

        await trigger.trigger('click');
        expect(menu(wrapper).exists()).toBe(false);

        // Synthetic keydown must stay inert for BOTH the listbox skeleton and the Backspace
        // pop. Dispatched natively: VTU's trigger() silently SKIPS disabled elements, which
        // would leave the handler's disabled guard unexercised and the assertions vacuous —
        // the event must actually reach the handler to prove the guard.
        trigger.element.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);
        trigger.element.dispatchEvent(new KeyboardEvent('keydown', {key: 'Backspace', bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('survives options shrinking under the pointer while the listbox is open', async () => {
        const wrapper = mountMulti({});
        const trigger = () => wrapper.find('.ui-multiselect__trigger');

        await trigger().trigger('keydown', {key: 'ArrowDown'}); // open
        await trigger().trigger('keydown', {key: 'ArrowDown'}); // → 0
        await trigger().trigger('keydown', {key: 'ArrowDown'}); // → 1
        await trigger().trigger('keydown', {key: 'ArrowDown'}); // → 2 (last)
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-2');

        // A narrowing that lands under the pointer must clamp, not dangle.
        await wrapper.setProps({options: FRUITS.slice(0, 1)}); // one option
        expect(menu(wrapper).findAll('.ui-multiselect__option')).toHaveLength(1);
        const active = trigger().attributes('aria-activedescendant');
        if (active !== undefined) expect(menu(wrapper).find(`#${active}`).exists()).toBe(true);

        // Enter must commit the surviving option rather than index off the end.
        await trigger().trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[FRUITS[0].id]]);

        // Draining to nothing empties the highlight and Enter becomes a no-op.
        await wrapper.setProps({options: []});
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();
        await trigger().trigger('keydown', {key: 'Enter'});
        expect(wrapper.emitted('update:modelValue')).toHaveLength(1);
        expect(menu(wrapper).find('.ui-multiselect__empty').text()).toBe('No options');
    });

    it('round-trips string ids and resolves labels via a getter', async () => {
        interface Tag {
            id: string;
            title: string;
        }
        const tags: Tag[] = [
            {id: 'b', title: 'beta'},
            {id: 'a', title: 'alpha'},
        ];
        const wrapper = mountMulti({options: tags, label: (tag: Tag) => tag.title.toUpperCase(), modelValue: ['a']});

        expect(wrapper.findAll('.ui-multiselect__chip').map((chip) => chip.text())).toEqual(['ALPHA']);

        await wrapper.find('.ui-multiselect__trigger').trigger('click');
        const options = menu(wrapper).findAll('.ui-multiselect__option');
        expect(options.map((option) => option.text())).toEqual(['ALPHA', 'BETA']);
        expect(options.map((option) => option.attributes('aria-selected'))).toEqual(['true', 'false']);

        await options[1].trigger('click'); // add 'b'
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([['a', 'b']]);
    });

    it('keeps an unresolved id in the model (no chip) until its option arrives, and preserves given order unsorted', async () => {
        const wrapper = mountMulti({modelValue: [99, 3], alphabeticalSort: false});

        // id 99 has no option yet — no chip, but the model keeps it (async-options window).
        expect(wrapper.findAll('.ui-multiselect__chip').map((chip) => chip.text())).toEqual(['Mango']);
        expect(wrapper.find('.ui-multiselect__placeholder').exists()).toBe(false); // model is non-empty

        await wrapper.find('.ui-multiselect__trigger').trigger('click');
        expect(
            menu(wrapper)
                .findAll('.ui-multiselect__option')
                .map((o) => o.text()),
        ).toEqual(['Watermelon', 'Apricot', 'Mango']);

        // Backspace pops the unresolved id too — it is committed state, chip or not.
        await wrapper.setProps({modelValue: [3, 99]});
        await wrapper.find('.ui-multiselect__trigger').trigger('keydown', {key: 'Backspace'});
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3]]);
    });

    it('closes on Escape, Tab, and click-outside without committing, and toggles closed via the trigger', async () => {
        const wrapper = mountMulti({});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        await trigger.trigger('keydown', {key: 'ArrowDown'}); // open
        await trigger.trigger('keydown', {key: 'Escape'});
        expect(menu(wrapper).exists()).toBe(false);

        await trigger.trigger('keydown', {key: ' '}); // Space opens
        expect(menu(wrapper).exists()).toBe(true);
        await trigger.trigger('keydown', {key: 'Tab'});
        expect(menu(wrapper).exists()).toBe(false);

        await trigger.trigger('click'); // open
        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
        await wrapper.vm.$nextTick();
        expect(menu(wrapper).exists()).toBe(false);

        await trigger.trigger('click'); // open
        await trigger.trigger('click'); // toggle closed
        expect(menu(wrapper).exists()).toBe(false);
        expect(wrapper.emitted('update:modelValue')).toBeUndefined(); // nothing committed
    });

    it('ignores a non-opening key while closed and unhandled keys while open, with a custom optionsLabel and emptyText', async () => {
        const wrapper = mountMulti({options: [], optionsLabel: 'Fruits', emptyText: 'Nothing here'});
        const trigger = wrapper.find('.ui-multiselect__trigger');

        await trigger.trigger('keydown', {key: 'x'}); // non-opening
        expect(menu(wrapper).exists()).toBe(false);

        await trigger.trigger('keydown', {key: 'Enter'}); // opens
        expect(menu(wrapper).attributes('aria-label')).toBe('Fruits');
        expect(menu(wrapper).find('.ui-multiselect__empty').text()).toBe('Nothing here');

        await trigger.trigger('keydown', {key: 'x'}); // unhandled while open
        expect(menu(wrapper).exists()).toBe(true);
        await trigger.trigger('keydown', {key: 'Enter'}); // pointer -1 → no commit, stays open
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('removes its document listener on unmount', async () => {
        const wrapper = mountMulti({});
        await wrapper.find('.ui-multiselect__trigger').trigger('click');
        wrapper.unmount();
        // Exercises onBeforeUnmount cleanup — a stray document click must not throw.
        document.body.dispatchEvent(new MouseEvent('click', {bubbles: true}));
    });

    it('leaves the highlight on nothing when ArrowUp is pressed on the first option', async () => {
        const wrapper = mountMulti({});
        const trigger = () => wrapper.find('.ui-multiselect__trigger');

        await trigger().trigger('keydown', {key: 'ArrowDown'}); // open
        await trigger().trigger('keydown', {key: 'ArrowDown'}); // → index 0
        expect(trigger().attributes('aria-activedescendant')).toBe('fruit-opt-0');

        await trigger().trigger('keydown', {key: 'ArrowUp'}); // MultiSelect has no clear entry → nothing
        expect(trigger().attributes('aria-activedescendant')).toBeUndefined();
        expect(menu(wrapper).exists()).toBe(true); // still open
    });

    it('renders per-option custom content through the #option scoped slot, chrome outside the slot', async () => {
        const wrapper = mountMulti(
            {modelValue: [3]}, // Mango committed
            {
                option: (props: {option: Fruit; index: number; selected: boolean}) =>
                    h('b', {class: 'swatch'}, `${props.option.name}#${props.index}${props.selected ? '*' : ''}`),
            },
        );

        await wrapper.find('.ui-multiselect__trigger').trigger('click');
        // Sorted order: Apricot(2), Mango(3, member), Watermelon(1) — `selected` carries
        // committed MEMBERSHIP, and the aria-selected chrome stays on the <li>.
        expect(
            menu(wrapper)
                .findAll('.swatch')
                .map((el) => el.text()),
        ).toEqual(['Apricot#0', 'Mango#1*', 'Watermelon#2']);

        // Slotted content toggles exactly like the plain text — and the menu stays open.
        await menu(wrapper).findAll('.ui-multiselect__option')[0].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[3, 2]]); // + Apricot
        expect(menu(wrapper).exists()).toBe(true);
    });

    it('marks mutedOptions with .is-muted while keeping them committable', async () => {
        const wrapper = mountMulti({mutedOptions: [2]}); // Apricot
        await wrapper.find('.ui-multiselect__trigger').trigger('click');

        const options = menu(wrapper).findAll('.ui-multiselect__option'); // Apricot, Mango, Watermelon
        expect(options.map((o) => o.classes().includes('is-muted'))).toEqual([true, false, false]);

        // Muted ≠ disabled: a muted option still toggles membership.
        await options[0].trigger('click');
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([[2]]);
    });
});
