// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {h, nextTick} from 'vue';

import RadioGroup from '../src/components/RadioGroup.vue';

interface Fruit {
    id: number;
    name: string;
}

const FRUITS: Fruit[] = [
    {id: 1, name: 'Watermelon'},
    {id: 2, name: 'Apricot'},
    {id: 3, name: 'Mango'},
];

const mountGroup = (props: Record<string, unknown>) =>
    mount(RadioGroup as any, {
        props: {options: FRUITS, optionLabel: 'name', label: 'Fruit', id: 'fruit', modelValue: null, ...props},
    });

describe('RadioGroup', () => {
    it('cancels a click while disabled and holds it back from a capture listener too, and only then', async () => {
        let heard = 0;
        const wrapper = mountGroup({disabled: true, onClickCapture: () => (heard += 1)});
        const click = () => {
            const event = new MouseEvent('click', {bubbles: true, cancelable: true});
            wrapper.find('.ui-check__label').element.dispatchEvent(event);
            return event.defaultPrevented;
        };

        expect(click()).toBe(true);
        expect(heard).toBe(0);
        await wrapper.setProps({disabled: false});
        expect(click()).toBe(false);
        // the label's click and the activation click it sends to its input
        expect(heard).toBe(2);
    });

    it('takes its legend from the default slot over label, so the legend can carry more than text', () => {
        const wrapper = mount(RadioGroup as any, {
            props: {options: FRUITS, optionLabel: 'name', id: 'fruit', modelValue: null, required: true},
            slots: {default: () => [h('span', 'Fruit'), h('button', {type: 'button'}, 'Info')]},
        });
        const legend = wrapper.get('legend');

        expect(legend.find('span').text()).toBe('Fruit');
        expect(legend.find('button').text()).toBe('Info');
        expect(legend.find('.ui-label__req').exists()).toBe(true);
    });

    it('renders a radiogroup fieldset with legend and native radios sharing one name, none checked for a null model', () => {
        const wrapper = mountGroup({});

        const fieldset = wrapper.find('fieldset');
        expect(fieldset.classes()).toContain('ui-radio-group');
        expect(fieldset.attributes('role')).toBe('radiogroup');
        expect(fieldset.attributes('id')).toBe('fruit');
        expect(wrapper.find('legend').text()).toBe('Fruit');

        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios).toHaveLength(3);
        // One shared generated name (the group id) — this is what buys the NATIVE roving
        // focus and arrow-key selection; the component hand-rolls neither.
        expect(new Set(radios.map((radio) => radio.attributes('name')))).toEqual(new Set(['fruit']));
        expect(radios.map((radio) => radio.attributes('id'))).toEqual(['fruit-opt-0', 'fruit-opt-1', 'fruit-opt-2']);
        expect(radios.map((radio) => radio.attributes('value'))).toEqual(['1', '2', '3']);
        expect(radios.every((radio) => !(radio.element as HTMLInputElement).checked)).toBe(true);
        expect(wrapper.findAll('.ui-check__label').map((label) => label.text())).toEqual([
            'Watermelon',
            'Apricot',
            'Mango',
        ]);
    });

    it('follows the native change event: selecting emits the option id, prop drives checked', async () => {
        const wrapper = mountGroup({});
        const radios = wrapper.findAll('input[type="radio"]');

        // The model follows `change` — exactly what native arrow-key selection fires. The arrow-key
        // walk itself is the browser's (shared `name`, nothing hand-rolled) and is not tested here:
        // happy-dom implements no radio roving.
        await radios[1].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([2]);

        await wrapper.setProps({modelValue: 2});
        expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true, false]);

        await radios[2].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual([3]);
    });

    it('conveys required via aria-required on the radiogroup plus the legend marker', () => {
        const wrapper = mountGroup({required: true});

        // Unlike role=group, radiogroup legitimately carries aria-required — so here the
        // attribute IS the group-level conveyance (no sr-only text needed).
        expect(wrapper.find('fieldset').attributes('aria-required')).toBe('true');
        expect(wrapper.find('.ui-label__req').text()).toBe('*');

        const bare = mountGroup({});
        expect(bare.find('fieldset').attributes('aria-required')).toBeUndefined();
        expect(bare.find('.ui-label__req').exists()).toBe(false);
    });

    it('wires invalid and describedby with ONE described-by story: the IDREF on the fieldset only', () => {
        const wrapper = mountGroup({invalid: true, describedby: 'fruit-error'});

        const fieldset = wrapper.find('fieldset');
        expect(fieldset.attributes('aria-invalid')).toBe('true');
        expect(fieldset.attributes('aria-describedby')).toBe('fruit-error');

        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios.every((radio) => radio.classes().includes('is-invalid'))).toBe(true);
        expect(radios.every((radio) => radio.attributes('aria-describedby') === undefined)).toBe(true);
    });

    it.each(['input', 'change'])(
        'disables every radio and withholds a dispatched %s from the handlers, and only while disabled',
        async (type) => {
            let heard = 0;
            const wrapper = mountGroup({[`on${type[0].toUpperCase()}${type.slice(1)}`]: () => (heard += 1)});
            const first = wrapper.find('input[type="radio"]').element as HTMLInputElement;
            // Native dispatch — VTU setValue() skips disabled elements (vacuous-assertion trap).
            const dispatch = () => first.dispatchEvent(new Event(type, {bubbles: true}));

            dispatch();
            expect(heard).toBe(1);

            await wrapper.setProps({disabled: true});
            const emitted = wrapper.emitted('update:modelValue')?.length ?? 0;
            const radios = wrapper.findAll('input[type="radio"]');
            expect(radios.every((radio) => radio.attributes('disabled') !== undefined)).toBe(true);
            expect(wrapper.findAll('.ui-radio').every((row) => row.classes().includes('is-disabled'))).toBe(true);
            first.checked = true;
            dispatch();
            await wrapper.vm.$nextTick();
            expect(heard).toBe(1);
            expect(wrapper.emitted('update:modelValue')?.length ?? 0).toBe(emitted);

            await wrapper.setProps({disabled: false});
            dispatch();
            expect(heard).toBe(2);
        },
    );

    const STOCK = [
        {id: 1, name: 'Apple', disabled: false},
        {id: 2, name: 'Apricot', disabled: true},
        {id: 3, name: 'Mango', disabled: false},
    ];

    it('disables an option on its own by its `disabled`, leaving the others', () => {
        const wrapper = mountGroup({options: STOCK});

        expect(
            wrapper.findAll('input[type="radio"]').map((radio) => radio.attributes('disabled') !== undefined),
        ).toEqual([false, true, false]);
        expect(wrapper.findAll('.ui-radio').map((row) => row.classes().includes('is-disabled'))).toEqual([
            false,
            true,
            false,
        ]);
    });

    it('takes no change on a disabled option, a dispatched one included, and sets its radio back', async () => {
        const wrapper = mountGroup({options: STOCK, modelValue: 1});
        const radios = wrapper.findAll<HTMLInputElement>('input[type="radio"]');

        // A dispatched change runs on a disabled radio; a user's never fires.
        radios[1].element.checked = true;
        radios[1].element.dispatchEvent(new Event('change', {bubbles: true}));
        await wrapper.vm.$nextTick();

        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
        expect(radios.map((radio) => radio.element.checked)).toEqual([true, false, false]);
    });

    it('keeps a click on an option label from the consumer while disabled', () => {
        let heard = 0;
        const wrapper = mountGroup({disabled: true, onClick: () => (heard += 1)});

        // The label text is not the disabled radio, so the browser withholds nothing here: the
        // click bubbles to the fieldset, where the consumer's attrs land.
        wrapper.find('.ui-check__label').element.dispatchEvent(new MouseEvent('click', {bubbles: true}));

        expect(heard).toBe(0);
    });

    it('follows `disabled` as it changes after mount — the guard reads the current value', async () => {
        let heard = 0;
        const wrapper = mountGroup({onChange: () => (heard += 1)});
        const radio = wrapper.find('input[type="radio"]').element;

        await wrapper.setProps({disabled: true});
        radio.dispatchEvent(new Event('change', {bubbles: true}));
        await wrapper.setProps({disabled: false});
        radio.dispatchEvent(new Event('change', {bubbles: true}));

        expect(heard).toBe(1);
    });

    it('round-trips string ids and resolves member labels via a getter', async () => {
        interface Tag {
            id: string;
            title: string;
        }
        const tags: Tag[] = [
            {id: 'b', title: 'beta'},
            {id: 'a', title: 'alpha'},
        ];
        const wrapper = mountGroup({
            options: tags,
            optionLabel: (tag: Tag) => tag.title.toUpperCase(),
            modelValue: 'a',
        });

        expect(wrapper.findAll('.ui-check__label').map((label) => label.text())).toEqual(['BETA', 'ALPHA']);
        const radios = wrapper.findAll('input[type="radio"]');
        expect(radios.map((radio) => (radio.element as HTMLInputElement).checked)).toEqual([false, true]);

        await radios[0].setValue(true);
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['b']);
    });
});

// WR-1922: the browser moves the checked radio before the host decides. A host that declines (never
// applies the update) or decides later leaves the bound value unchanged, so Vue never re-patches
// `checked` and the clicked radio keeps showing unless the component sets every radio back.
describe('RadioGroup — a change the host does not take', () => {
    // A bound listener is what makes the model controlled: with no `onUpdate:modelValue`,
    // `defineModel` keeps the value locally and the host never gets to decline.
    const mountControlled = (onUpdate: (value: number) => void = () => undefined) =>
        mountGroup({modelValue: 1, 'onUpdate:modelValue': onUpdate});

    const checkedOf = (wrapper: ReturnType<typeof mount>): boolean[] =>
        wrapper.findAll('input[type="radio"]').map((radio) => (radio.element as HTMLInputElement).checked);

    it('puts the committed radio back when the host declines', async () => {
        const wrapper = mountControlled();

        await wrapper.findAll('input[type="radio"]')[1].setValue(true);
        await nextTick();

        expect(wrapper.emitted('update:modelValue')).toEqual([[2]]);
        expect(checkedOf(wrapper)).toEqual([true, false, false]);
    });

    it('shows the model while the host decides later, then follows it', async () => {
        const wrapper = mountControlled();

        await wrapper.findAll('input[type="radio"]')[1].setValue(true);
        await nextTick();
        expect(checkedOf(wrapper)).toEqual([true, false, false]);

        await wrapper.setProps({modelValue: 2});
        expect(checkedOf(wrapper)).toEqual([false, true, false]);
    });

    it('keeps the clicked radio checked when the host takes the change at once', async () => {
        const wrapper = mountControlled((value) => void wrapper.setProps({modelValue: value}));

        await wrapper.findAll('input[type="radio"]')[1].setValue(true);
        await nextTick();

        expect(checkedOf(wrapper)).toEqual([false, true, false]);
    });
});
