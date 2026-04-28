import {describe, expect, it} from 'vitest';

import {deepCopy} from '../src';

describe('deepCopy', () => {
    it('should return primitives as-is', () => {
        expect(deepCopy(42)).toBe(42);
        expect(deepCopy('hello')).toBe('hello');
        expect(deepCopy(true)).toBe(true);
        expect(deepCopy(null)).toBeNull();
        expect(deepCopy(undefined)).toBeUndefined();
    });

    it('should deep copy plain objects', () => {
        const original = {a: 1, b: {c: 2}};

        const copy = deepCopy(original);

        expect(copy).toEqual(original);
        expect(copy).not.toBe(original);
        expect(copy.b).not.toBe(original.b);
    });

    it('should deep copy arrays', () => {
        const original = [1, [2, 3], {a: 4}];

        const copy = deepCopy(original);

        expect(copy).toEqual(original);
        expect(copy).not.toBe(original);
        expect(copy[1]).not.toBe(original[1]);
        expect(copy[2]).not.toBe(original[2]);
    });

    it('should deep copy Date instances', () => {
        const original = new Date('2026-01-01');

        const copy = deepCopy(original);

        expect(copy).toEqual(original);
        expect(copy).not.toBe(original);
        expect(copy.getTime()).toBe(original.getTime());
    });

    it('should deep copy nested objects with arrays', () => {
        const original = {items: [{id: 1, name: 'test'}], count: 1};

        const copy = deepCopy(original);

        expect(copy).toEqual(original);
        expect(copy.items).not.toBe(original.items);
        expect(copy.items[0]).not.toBe(original.items[0]);
    });

    it('should handle empty objects', () => {
        expect(deepCopy({})).toEqual({});
    });

    it('should handle empty arrays', () => {
        expect(deepCopy([])).toEqual([]);
    });

    it('should produce a mutable copy from readonly input', () => {
        const original = {a: 1, b: {c: 2}} as const;

        const copy = deepCopy(original);
        copy.a = 99;
        copy.b.c = 99;

        expect(copy.a).toBe(99);
        expect(copy.b.c).toBe(99);
        expect(original.a).toBe(1);
    });

    describe('prototype pollution resistance', () => {
        it('should not set the prototype from a JSON-parsed __proto__ key', () => {
            // JSON.parse treats __proto__ as a literal own property, unlike object literals.
            const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}}') as Record<string, unknown>;

            const copy = deepCopy(malicious) as Record<string, unknown>;

            expect(Object.getPrototypeOf(copy)).toBe(Object.prototype);
            expect(copy.polluted).toBeUndefined();
        });

        it('should not copy a literal constructor key from external data', () => {
            const malicious = JSON.parse('{"constructor": {"prototype": {"polluted": "yes"}}}') as Record<
                string,
                unknown
            >;

            const copy = deepCopy(malicious);

            expect(Object.hasOwn(copy, 'constructor')).toBe(false);
            // Sanity: ensure Object.prototype was not polluted by the copy operation.
            expect(({} as Record<string, unknown>).polluted).toBeUndefined();
        });

        it('should preserve safe keys when dangerous keys are present', () => {
            const malicious = JSON.parse('{"__proto__": {"polluted": "yes"}, "safe": 1, "other": "keep"}') as Record<
                string,
                unknown
            >;

            const copy = deepCopy(malicious) as Record<string, unknown>;

            expect(copy.safe).toBe(1);
            expect(copy.other).toBe('keep');
            expect(copy.polluted).toBeUndefined();
        });
    });
});
