import {describe, expect, it} from 'vitest';

import {isValidationRefusal} from '../../src/form/http-contract';

// Mirrors fs-http's `isAxiosError` check, inlined so the package needs no fs-http at build or CJS load.

describe('isValidationRefusal', () => {
    it('is true only for an axios error whose response is a 422', () => {
        expect(isValidationRefusal({isAxiosError: true, response: {status: 422, data: {}}})).toBe(true);
    });

    it.each([
        ['an axios error with another status', {isAxiosError: true, response: {status: 500, data: {}}}],
        ['an axios error without a response (network failure)', {isAxiosError: true}],
        ['a 422-shaped object that is not an axios error', {response: {status: 422, data: {}}}],
        ['an isAxiosError flag that is truthy but not true', {isAxiosError: 'yes', response: {status: 422}}],
        ['null', null],
        ['undefined', undefined],
        ['a string', '422'],
        ['a plain Error', new Error('boom')],
    ])('is false for %s', (_, error) => {
        expect(isValidationRefusal(error)).toBe(false);
    });
});
