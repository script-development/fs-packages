// @vitest-environment happy-dom
// WR-1991: typeahead on the select-only listboxes. Key handling is the component's own logic over
// the keydown it receives — no platform default is involved — so happy-dom runs the real path.
import {mount} from '@vue/test-utils';
import {afterEach, beforeEach, describe, expect, it, onTestFinished, vi} from 'vitest';

import SingleSelect from '../src/components/SingleSelect.vue';

interface Fruit {
    id: number;
    name: string;
}

// Caller order: Apricot(0), Avocado(1), Banana(2), Blue moon(3), Blueberry(4), cherry(5).
const FRUITS: Fruit[] = [
    {id: 1, name: 'Apricot'},
    {id: 2, name: 'Avocado'},
    {id: 3, name: 'Banana'},
    {id: 4, name: 'Blue moon'},
    {id: 5, name: 'Blueberry'},
    {id: 6, name: 'cherry'},
];

const SELECT_ONLY = [
    {
        name: 'SingleSelect',
        mountIt: () =>
            mount(SingleSelect, {
                props: {options: FRUITS, optionLabel: 'name', id: 'f', modelValue: null, alphabeticalSort: false},
                attachTo: document.body,
            }),
        keyTarget: '.ui-select__trigger',
    },
] as const;

beforeEach(() => {
    vi.useFakeTimers();
});

afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
});

describe.each(SELECT_ONLY)('$name — typeahead', ({mountIt, keyTarget}) => {
    const setup = async (open = true) => {
        const wrapper = mountIt();
        const target = wrapper.find(keyTarget);
        const press = async (key: string, init: Record<string, unknown> = {}) => {
            await target.trigger('keydown', {key, ...init});
        };
        const active = () => wrapper.find('[role="combobox"]').attributes('aria-activedescendant');
        if (open) await press('ArrowDown');
        return {wrapper, press, active};
    };

    it('a printable character moves the active option to the first match, case-insensitively', async () => {
        const {press, active} = await setup();

        await press('C');

        expect(active()).toBe('f-opt-5');
    });

    it('the same character again cycles through the options that start with it', async () => {
        const {press, active} = await setup();

        await press('b');
        expect(active()).toBe('f-opt-2');
        await press('b');
        expect(active()).toBe('f-opt-3');
        await press('b');
        expect(active()).toBe('f-opt-4');
    });

    it('a quickly typed string matches by prefix, a space inside it included', async () => {
        const {press, active} = await setup();

        for (const key of 'blueb') await press(key);
        expect(active()).toBe('f-opt-4');
    });

    it('a highlight that still matches the growing string stays put', async () => {
        const {press, active} = await setup();

        for (const key of 'blu') await press(key);

        // "blu" matches Blue moon and Blueberry; a search from the NEXT option would skip ahead.
        expect(active()).toBe('f-opt-3');
    });

    it('a space typed mid-string is part of the string and is prevented from clicking the trigger', async () => {
        const {wrapper, press, active} = await setup();

        for (const key of 'blue') await press(key);
        const space = new KeyboardEvent('keydown', {key: ' ', bubbles: true, cancelable: true});
        wrapper.find(keyTarget).element.dispatchEvent(space);
        await press('m');

        expect(space.defaultPrevented).toBe(true);
        expect(active()).toBe('f-opt-3');
    });

    it('the string resets after a short idle, so the next key starts a new search', async () => {
        const {press, active} = await setup();

        await press('a');
        expect(active()).toBe('f-opt-0');
        vi.advanceTimersByTime(600);
        await press('v');

        // Without the reset this reads "av" and lands on Avocado.
        expect(active()).toBe('f-opt-0');
    });

    it('each key restarts the idle window, so a string typed at a steady pace keeps growing', async () => {
        const {press, active} = await setup();

        await press('b');
        vi.advanceTimersByTime(400);
        await press('l');
        vi.advanceTimersByTime(400);
        await press('b');

        // "blb" matches nothing, so Blue moon stays. Had the first key's window run on, the string
        // would have reset before the last b, which would then cycle on to Blueberry.
        expect(active()).toBe('f-opt-3');
    });

    it('after a typed string resets, a repeated character cycles again', async () => {
        const {press, active} = await setup();

        for (const key of 'ap') await press(key);
        vi.advanceTimersByTime(600);
        await press('b');
        await press('b');

        expect(active()).toBe('f-opt-3');
    });

    it('wraps around past the last option', async () => {
        const {press, active} = await setup();

        await press('End');
        await press('a');

        expect(active()).toBe('f-opt-0');
    });

    it('a character no option starts with moves nothing', async () => {
        const {press, active} = await setup();

        await press('b');
        await press('z');

        expect(active()).toBe('f-opt-2');
    });

    it('a modified key is not typeahead', async () => {
        const {press, active} = await setup();

        await press('a', {ctrlKey: true});
        await press('b', {metaKey: true});
        await press('c', {altKey: true});

        expect(active()).toBeUndefined();
    });

    it('closed, a character opens the list on the first match and commits nothing', async () => {
        const {wrapper, press, active} = await setup(false);

        await press('c');

        expect(wrapper.find('[role="combobox"]').attributes('aria-expanded')).toBe('true');
        expect(active()).toBe('f-opt-5');
        expect(wrapper.emitted('update:modelValue')).toBeUndefined();
    });

    it('closed, a character no option starts with opens nothing', async () => {
        const {wrapper, press} = await setup(false);

        await press('z');

        expect(wrapper.find('[role="combobox"]').attributes('aria-expanded')).toBe('false');
    });

    it('closing drops a half-typed string', async () => {
        const {press, active} = await setup();

        await press('b');
        await press('Escape');
        await press('ArrowDown');
        await press('l');

        // Without the drop this reads "bl" and lands on Blue moon.
        expect(active()).toBeUndefined();
    });
});

describe('typeahead — a search starts after the committed value (native <select> parity)', () => {
    const banana = 3;

    it('SingleSelect with Banana chosen: closed, b moves to Blue moon, not Banana again', async () => {
        const wrapper = mount(SingleSelect, {
            props: {options: FRUITS, optionLabel: 'name', id: 'f', modelValue: banana, alphabeticalSort: false},
            attachTo: document.body,
        });

        await wrapper.find('.ui-select__trigger').trigger('keydown', {key: 'b'});

        expect(wrapper.find('[role="combobox"]').attributes('aria-activedescendant')).toBe('f-opt-3');
    });

    it('REGRESSION PIN — SingleSelect with Banana chosen: a string still matching it stays on it', async () => {
        const wrapper = mount(SingleSelect, {
            props: {options: FRUITS, optionLabel: 'name', id: 'f', modelValue: banana, alphabeticalSort: false},
            attachTo: document.body,
        });
        const control = wrapper.find('.ui-select__trigger');

        await control.trigger('keydown', {key: 'b'});
        await control.trigger('keydown', {key: 'a'});

        expect(wrapper.find('[role="combobox"]').attributes('aria-activedescendant')).toBe('f-opt-2');
    });
});

describe('typeahead — a held key costs the same on its thousandth repeat as on its first', () => {
    // Key repeat (~30 Hz) never lets the idle reset fire, so a held key grows the typed string without
    // limit; per-key work must not grow with it. Timed, not counted: the string lives inside the
    // composable. Both blocks are timed in one run, so station load mostly cancels out of the ratio.
    // The assertion is a within-run ratio (last block vs first) at 4x, between the fix's ~1x and the
    // defect's measured 9-14x. If it flakes in CI, the fix is a deterministic work counter, never a
    // looser threshold.
    const holdAfter = (prefix: string): {first: number; last: number} => {
        // Real clock: the suite's fake timers freeze performance.now(). The loop is synchronous, so
        // the 500 ms idle reset cannot fire inside it either way.
        vi.useRealTimers();
        const wrapper = mount(SingleSelect, {
            props: {options: FRUITS, optionLabel: 'name', id: 'f', modelValue: null, alphabeticalSort: false},
            attachTo: document.body,
        });
        const control = wrapper.find('.ui-select__trigger').element;
        const press = (key: string): void => {
            control.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true, cancelable: true}));
        };
        const hold = (repeats: number): number => {
            const started = performance.now();
            for (let repeat = 0; repeat < repeats; repeat++) press('a');
            return performance.now() - started;
        };

        for (const key of prefix) press(key);
        const first = hold(1000);
        hold(15_000);
        return {first, last: hold(1000)};
    };

    it('a held key on its own (the repeated-character run)', () => {
        const {first, last} = holdAfter('');

        expect(last).toBeLessThan(first * 4);
    });

    it('a held key after another character (a string no option can match any more)', () => {
        const {first, last} = holdAfter('b');

        expect(last).toBeLessThan(first * 4);
    });
});

describe.each(SELECT_ONLY)('$name — closing through the trigger drops a half-typed string', ({mountIt}) => {
    it('a reopen within the idle window starts a new search', async () => {
        const wrapper = mountIt();
        const trigger = wrapper.find('[role="combobox"]');

        await trigger.trigger('click');
        await trigger.trigger('keydown', {key: 'b'});
        expect(trigger.attributes('aria-activedescendant')).toBe('f-opt-2');
        await trigger.trigger('click');
        await trigger.trigger('click');
        await trigger.trigger('keydown', {key: 'a'});

        // Extending the old prefix reads "ba" and stays on Banana.
        expect(trigger.attributes('aria-expanded')).toBe('true');
        expect(trigger.attributes('aria-activedescendant')).toBe('f-opt-0');
    });
});

describe('typeahead — the typed string stops growing at 64 characters', () => {
    // Two labels identical for their first 64 characters: past the cap, a 65th key cannot tell them
    // apart, so the highlight stays on the first. An uncapped string reads the 65th key and moves.
    const shared = 'xy'.repeat(32);
    const LONG = [
        {id: 1, name: `${shared}a`},
        {id: 2, name: `${shared}b`},
    ];

    it('a 65th key leaves the 64-character match in place', async () => {
        const wrapper = mount(SingleSelect, {
            props: {options: LONG, optionLabel: 'name', id: 'f', modelValue: null, alphabeticalSort: false},
            attachTo: document.body,
        });
        const control = wrapper.find('.ui-select__trigger');

        for (const key of `${shared}b`) await control.trigger('keydown', {key});

        expect(wrapper.find('[role="combobox"]').attributes('aria-activedescendant')).toBe('f-opt-0');
    });

    // The cap counts keys, not UTF-16 units: an emoji key is two units and still one of the 64.
    const typeEmoji = async (shared: string): Promise<string | undefined> => {
        const wrapper = mount(SingleSelect, {
            props: {
                options: [
                    {id: 1, name: `${shared}🍌`},
                    {id: 2, name: `${shared}🍒`},
                ],
                optionLabel: 'name',
                id: 'f',
                modelValue: null,
                alphabeticalSort: false,
            },
            attachTo: document.body,
        });
        const control = wrapper.find('.ui-select__trigger');
        for (const key of `${shared}🍒`) await control.trigger('keydown', {key});
        return wrapper.find('[role="combobox"]').attributes('aria-activedescendant');
    };

    it('a 64th emoji key is read', async () => {
        expect(await typeEmoji(`${'🍎🍌'.repeat(31)}🍎`)).toBe('f-opt-1');
    });

    it('a 65th emoji key leaves the 64-key match in place', async () => {
        expect(await typeEmoji('🍎🍌'.repeat(32))).toBe('f-opt-0');
    });
});

describe('typeahead — a typed key and a label fold the same, whatever follows in the label', () => {
    // A whole-string lowercase is contextual: Σ ending a word becomes ς, elsewhere σ. Typed one key
    // at a time, Σ never ends a word, so the label must not be folded with a context the keys lack.
    const typeInto = async (names: string[], keys: string): Promise<string | undefined> => {
        const wrapper = mount(SingleSelect, {
            props: {
                options: names.map((name, index) => ({id: index + 1, name})),
                optionLabel: 'name',
                id: 'f',
                modelValue: null,
                alphabeticalSort: false,
            },
            attachTo: document.body,
        });
        const control = wrapper.find('.ui-select__trigger');
        for (const key of keys) await control.trigger('keydown', {key});
        return wrapper.find('[role="combobox"]').attributes('aria-activedescendant');
    };

    it('Ο then Σ moves from ΟΧ to ΟΣ, a label whose Σ ends the word', async () => {
        expect(await typeInto(['ΟΧ', 'ΟΣ'], 'ΟΣ')).toBe('f-opt-1');
    });

    it('Ο then Σ moves from ΟΧ to ΟΣΑ, a label whose Σ does not end the word', async () => {
        expect(await typeInto(['ΟΧ', 'ΟΣΑ'], 'ΟΣ')).toBe('f-opt-1');
    });

    it('İ, whose lowercase is two code units, matches İ labels and cycles through them on repeat', async () => {
        expect(await typeInto(['Ice', 'İzmir', 'İstanbul'], 'İ')).toBe('f-opt-1');
        expect(await typeInto(['Ice', 'İzmir', 'İstanbul'], 'İİ')).toBe('f-opt-2');
    });

    it('a key outside the BMP, two code units, is one character and matches', async () => {
        expect(await typeInto(['Banana', '🍎 Apple'], '🍎')).toBe('f-opt-1');
    });
});

describe('typeahead — a named key is not a character', () => {
    // Enter and Tab are longer than one character; neither may search for a label spelling the key.
    it.each(['Enter', 'Tab'])('%s never moves the highlight to a label starting with its name', async (key) => {
        const wrapper = mount(SingleSelect, {
            props: {
                options: [
                    {id: 1, name: 'Apple'},
                    {id: 2, name: `${key} here`},
                ],
                optionLabel: 'name',
                id: 'f',
                modelValue: null,
                alphabeticalSort: false,
            },
            attachTo: document.body,
        });

        await wrapper.find('.ui-select__trigger').trigger('keydown', {key});

        expect(wrapper.find('[role="combobox"]').attributes('aria-activedescendant')).not.toBe('f-opt-1');
    });
});

describe.each(SELECT_ONLY)('$name — a held key that matches nothing folds no label again', ({mountIt, keyTarget}) => {
    // The labels change only with the options, so they are folded once; a key folds only itself.
    it('100 repeats of a key no label starts with cost one fold each', () => {
        const wrapper = mountIt();
        const target = wrapper.find(keyTarget).element;
        const press = (): void => {
            target.dispatchEvent(new KeyboardEvent('keydown', {key: 'z', bubbles: true, cancelable: true}));
        };
        press();
        const folds = vi.spyOn(String.prototype, 'toLocaleLowerCase');
        onTestFinished(() => folds.mockRestore());

        for (let repeat = 0; repeat < 100; repeat++) press();

        expect(folds).toHaveBeenCalledTimes(100);
    });
});

describe('typeahead — the labels fold again when the options change', () => {
    it('a label added after mount is found', async () => {
        const wrapper = mount(SingleSelect, {
            props: {options: FRUITS, optionLabel: 'name', id: 'f', modelValue: null, alphabeticalSort: false},
            attachTo: document.body,
        });
        await wrapper.setProps({options: [...FRUITS, {id: 7, name: 'Damson'}]});

        await wrapper.find('.ui-select__trigger').trigger('keydown', {key: 'd'});

        expect(wrapper.find('[role="combobox"]').attributes('aria-activedescendant')).toBe('f-opt-6');
    });
});

describe('typeahead — an empty list', () => {
    it('a character typed over an empty list moves nothing', async () => {
        const wrapper = mount(SingleSelect, {
            props: {options: [] as Fruit[], optionLabel: 'name', id: 'f', modelValue: null},
            attachTo: document.body,
        });
        const control = wrapper.find('.ui-select__trigger');

        await control.trigger('keydown', {key: 'ArrowDown'});
        await control.trigger('keydown', {key: 'a'});

        expect(wrapper.find('[role="combobox"]').attributes('aria-activedescendant')).toBeUndefined();
        expect(wrapper.find('[role="combobox"]').attributes('aria-expanded')).toBe('true');
    });
});
