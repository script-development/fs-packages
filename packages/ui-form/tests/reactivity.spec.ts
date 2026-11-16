// @vitest-environment happy-dom

import {describe, expect, it} from 'vitest';
import {ref} from 'vue';

import {ensureRefValueExists, MissingRefValue} from '../src/internal/reactivity';

describe('ensureRefValueExists', () => {
    it('returns the value when the ref is set', () => {
        const source = ref<number | undefined>(10);
        expect(ensureRefValueExists(source)).toBe(10);
    });

    it('throws a named MissingRefValue on undefined — not an anonymous TypeError', () => {
        const source = ref<number | undefined>(undefined);
        expect(() => ensureRefValueExists(source)).toThrow(MissingRefValue);
        expect(() => ensureRefValueExists(source)).toThrow(/isn't mounted yet/);
    });

    it('throws MissingRefValue on null (the unmounted-template-ref shape)', () => {
        const source = ref<HTMLElement | null>(null);
        expect(() => ensureRefValueExists(source)).toThrow(MissingRefValue);
    });

    it('names the error class for instanceof discrimination in consumer handlers', () => {
        const error = new MissingRefValue();
        expect(error.name).toBe('MissingRefValue');
        expect(error).toBeInstanceOf(Error);
    });
});
