// @vitest-environment happy-dom
import {mount} from '@vue/test-utils';
import {describe, expect, it} from 'vitest';
import {h} from 'vue';

import type {GroupRow} from '../src/internal/group-rows';

import OptionList from '../src/components/OptionList.vue';

const LABELS = ['Apricot', 'Banana', 'Cherry', 'Damson'];

const optionRows = (...indices: number[]): GroupRow[] => indices.map((index) => ({type: 'option', index}));

const mountList = (props: Record<string, unknown> = {}) =>
    mount(OptionList, {
        props: {
            rows: optionRows(0, 1, 2, 3),
            keys: LABELS,
            pointer: -1,
            listboxId: 'fruit-listbox',
            optionId: (index: number) => `fruit-opt-${index}`,
            isSelected: () => false,
            isMuted: () => false,
            variant: 'ui-select',
            optionsLabel: 'Fruits',
            emptyText: 'No fruit',
            ...props,
        },
        slots: {option: ({index}: {index: number}) => h('span', LABELS[index])},
    });

const texts = (elements: {text: () => string}[]) => elements.map((element) => element.text());

describe('OptionList', () => {
    it('renders an all-option run flat in the listbox, with no group', () => {
        const wrapper = mountList();
        const listbox = wrapper.find('[role="listbox"]');

        expect(listbox.attributes('id')).toBe('fruit-listbox');
        expect(listbox.attributes('aria-label')).toBe('Fruits');
        expect(listbox.classes()).toContain('ui-select__menu');
        expect(wrapper.find('[role="group"]').exists()).toBe(false);
        expect(texts(wrapper.findAll('[role="listbox"] > [role="option"]'))).toEqual(LABELS);
        expect(wrapper.findAll('[role="option"]').map((option) => option.attributes('id'))).toEqual([
            'fruit-opt-0',
            'fruit-opt-1',
            'fruit-opt-2',
            'fruit-opt-3',
        ]);
    });

    it('puts the options after a header in a group named by it, the visible header hidden from assistive tech', () => {
        const wrapper = mountList({
            rows: [
                {type: 'header', text: 'Stone fruit'},
                ...optionRows(0, 2),
                {type: 'header', text: 'Other'},
                ...optionRows(1),
            ],
        });
        const groups = wrapper.findAll('[role="group"]');

        expect(groups.map((group) => group.attributes('aria-label'))).toEqual(['Stone fruit', 'Other']);
        expect(texts(groups[0].findAll('[role="option"]'))).toEqual(['Apricot', 'Cherry']);
        expect(texts(groups[1].findAll('[role="option"]'))).toEqual(['Banana']);
        const wrapperItem = wrapper.find('.ui-select__group');
        expect(wrapperItem.attributes('role')).toBe('presentation');
        expect(wrapperItem.find('.ui-select__group-header').attributes('aria-hidden')).toBe('true');
        expect(wrapperItem.find('.ui-select__group-header').text()).toBe('Stone fruit');
    });

    it('starts a flat run after a boundary, so its options stay out of the group before it', () => {
        const wrapper = mountList({
            rows: [{type: 'header', text: 'Stone fruit'}, ...optionRows(0), {type: 'boundary'}, ...optionRows(1, 2)],
        });

        expect(texts(wrapper.find('[role="group"]').findAll('[role="option"]'))).toEqual(['Apricot']);
        expect(texts(wrapper.findAll('[role="listbox"] > [role="option"]'))).toEqual(['Banana', 'Cherry']);
    });

    it('emits hover and commit with the index of an option inside a group', async () => {
        const wrapper = mountList({rows: [{type: 'header', text: 'Other'}, ...optionRows(3)]});
        const option = wrapper.find('#fruit-opt-3');

        await option.trigger('mouseover');
        await option.trigger('click');

        expect(wrapper.emitted('hover')).toEqual([[3]]);
        expect(wrapper.emitted('commit')).toEqual([[3]]);
    });

    it('emits hover and commit with the index of a flat option', async () => {
        const wrapper = mountList();
        const option = wrapper.find('#fruit-opt-1');

        await option.trigger('mouseover');
        await option.trigger('click');

        expect(wrapper.emitted('hover')).toEqual([[1]]);
        expect(wrapper.emitted('commit')).toEqual([[1]]);
    });

    it('marks the pointer active, the muted options muted and the committed option selected', () => {
        const wrapper = mountList({
            pointer: 1,
            isMuted: (index: number) => index === 2,
            isSelected: (index: number) => index === 0,
        });
        const options = wrapper.findAll('[role="option"]');

        expect(options.map((option) => option.classes('is-active'))).toEqual([false, true, false, false]);
        expect(options.map((option) => option.classes('is-muted'))).toEqual([false, false, true, false]);
        expect(options.map((option) => option.attributes('aria-selected'))).toEqual([
            'true',
            'false',
            'false',
            'false',
        ]);
    });

    it.each([
        ['no rows', []],
        ['only a header', [{type: 'header', text: 'Stone fruit'}]],
    ])('shows the empty text as a disabled option with %s', (_, rows) => {
        const wrapper = mountList({rows});
        const empty = wrapper.find('.ui-select__empty');

        expect(empty.text()).toBe('No fruit');
        expect(empty.attributes('role')).toBe('option');
        expect(empty.attributes('aria-disabled')).toBe('true');
    });

    it('shows no empty text while an option renders', () => {
        expect(mountList().find('.ui-select__empty').exists()).toBe(false);
    });

    it.each([
        [true, 'true'],
        [false, undefined],
    ])('with multiselectable %s, aria-multiselectable is %s', (multiselectable, expected) => {
        const wrapper = mountList({multiselectable});

        expect(wrapper.find('[role="listbox"]').attributes('aria-multiselectable')).toBe(expected);
    });

    describe('clear entry', () => {
        it('renders no entry without a clearLabel', () => {
            expect(mountList().find('.ui-select__clear').exists()).toBe(false);
        });

        it('renders the entry first, outside the index space, with its own id', () => {
            const wrapper = mountList({clearLabel: 'No fruit', clearId: 'fruit-clear'});
            const options = wrapper.findAll('[role="option"]');

            expect(options[0].attributes('id')).toBe('fruit-clear');
            expect(options[0].text()).toBe('No fruit');
            expect(options[0].attributes('aria-selected')).toBe('false');
            expect(options[0].classes('is-active')).toBe(false);
            expect(options[1].attributes('id')).toBe('fruit-opt-0');
        });

        it('marks the entry active and selected when told', () => {
            const wrapper = mountList({
                clearLabel: 'No fruit',
                clearId: 'fruit-clear',
                clearActive: true,
                clearSelected: true,
            });
            const entry = wrapper.find('#fruit-clear');

            expect(entry.classes('is-active')).toBe(true);
            expect(entry.attributes('aria-selected')).toBe('true');
        });

        it('emits clearHover and clearCommit, not hover and commit', async () => {
            const wrapper = mountList({clearLabel: 'No fruit', clearId: 'fruit-clear'});
            const entry = wrapper.find('#fruit-clear');

            await entry.trigger('mouseover');
            await entry.trigger('click');

            expect(wrapper.emitted('clearHover')).toHaveLength(1);
            expect(wrapper.emitted('clearCommit')).toHaveLength(1);
            expect(wrapper.emitted('hover')).toBeUndefined();
            expect(wrapper.emitted('commit')).toBeUndefined();
        });
    });
});
