import {describe, expect, it} from 'vitest';

import {vValueProperty} from '../src/internal/value-property';

// A field whose value setter counts its writes, so a skipped write is visible.
const field = (value: string) => {
    let current = value;
    const writes: string[] = [];
    const element = {
        get value() {
            return current;
        },
        set value(next: string) {
            writes.push(next);
            current = next;
        },
    } as unknown as HTMLInputElement;
    return {element, writes};
};

type Hook = (element: HTMLInputElement, binding: {value: string | number | null}) => void;
const {beforeMount, updated} = vValueProperty as {beforeMount: Hook; updated: Hook};

describe('vValueProperty', () => {
    it('sets the property on mount and on every update, a number as its text and null as empty', () => {
        const {element, writes} = field('');

        beforeMount(element, {value: 41});
        expect(element.value).toBe('41');

        updated(element, {value: '09:30'});
        expect(element.value).toBe('09:30');

        updated(element, {value: null});
        expect(element.value).toBe('');
        expect(writes).toEqual(['41', '09:30', '']);
    });

    it('skips a write that changes nothing, so text the field holds but cannot parse survives', () => {
        // a number field holding a lone `-` reads `''`; writing `''` over it would erase the minus
        const {element, writes} = field('');

        updated(element, {value: null});
        updated(element, {value: ''});
        expect(writes).toEqual([]);
    });
});
