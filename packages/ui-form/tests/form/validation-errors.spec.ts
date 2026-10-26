// @vitest-environment happy-dom
import {describe, expect, it} from 'vitest';

import type {UseValidationErrorsOptions} from '../../src';

import {useValidationErrors} from '../../src';

// A caught request error the way axios (fs-http's transport) shapes it.
const refusal = (status: number, data: unknown) => ({isAxiosError: true, response: {status, data}});

const mountComposable = <T extends string = string>(options?: UseValidationErrorsOptions) => {
    const result = useValidationErrors<T>(options);
    return {result: () => result};
};

const VALIDATION_BODY = {message: 'The given data was invalid.', errors: {first_name: ['Required', 'Too short']}};

describe('useValidationErrors', () => {
    it('takes a 422 and reports it; returns false for anything else and leaves the bag alone', () => {
        const {result} = mountComposable();

        expect(result().take(refusal(500, VALIDATION_BODY))).toBe(false);
        expect(result().take(new Error('network'))).toBe(false);
        expect(result().take(null)).toBe(false);
        expect(result().refused.value).toBe(false);
        expect(result().take(refusal(422, VALIDATION_BODY))).toBe(true);
    });

    it('binds the first message per field on a 422', () => {
        const {result} = mountComposable();

        result().take(refusal(422, VALIDATION_BODY));

        expect(result().errors.value).toEqual({first_name: 'Required'});
    });

    it('ignores non-422 responses', () => {
        const {result} = mountComposable();

        result().take(refusal(500, VALIDATION_BODY));

        expect(result().errors.value).toEqual({});
    });

    it('yields an empty bag when the 422 body has no errors object', () => {
        const {result} = mountComposable();

        result().take(refusal(422, {message: 'nope'}));

        expect(result().errors.value).toEqual({});
    });

    it('yields an empty bag when errors is null', () => {
        const {result} = mountComposable();

        result().take(refusal(422, {errors: null}));

        expect(result().errors.value).toEqual({});
    });

    it('yields an empty bag when errors is not an object', () => {
        const {result} = mountComposable();

        result().take(refusal(422, {errors: 'not-an-object'}));

        expect(result().errors.value).toEqual({});
        expect(result().unmapped.value).toEqual([]);
    });

    it('treats an array errors container as no field map', () => {
        const {result} = mountComposable();

        result().take(refusal(422, {errors: [['Required'], ['Taken']]}));

        expect(result().errors.value).toEqual({});
        expect(result().unmapped.value).toEqual([]);
        expect(result().refusedUnnamed.value).toBe(true);
    });

    it('binds from a null-prototype errors container', () => {
        const {result} = mountComposable();
        const errors = Object.assign(Object.create(null) as object, {email: ['Taken']});

        result().take(refusal(422, {errors}));

        expect(result().errors.value).toEqual({email: 'Taken'});
    });

    it('yields an empty bag when the 422 body is a non-object', () => {
        const {result} = mountComposable();

        result().take(refusal(422, 'plain string body'));

        expect(result().errors.value).toEqual({});
    });

    it('yields an empty bag when the 422 body is null', () => {
        const {result} = mountComposable();

        result().take(refusal(422, null));

        expect(result().errors.value).toEqual({});
    });

    it('handles an error with no response at all', () => {
        const {result} = mountComposable();

        result().take({isAxiosError: true, message: 'boom'});

        expect(result().errors.value).toEqual({});
    });

    it('applies a custom keyMapper to field keys', () => {
        const keyMapper = (key: string) => key.replace(/_(\w)/g, (_, c: string) => c.toUpperCase());
        const {result} = mountComposable({keyMapper});

        result().take(refusal(422, VALIDATION_BODY));

        expect(result().errors.value).toEqual({firstName: 'Required'});
    });

    it('uses raw keys by default (identity keyMapper)', () => {
        const {result} = mountComposable();

        result().take(refusal(422, {errors: {street_name: ['Required']}}));

        expect(result().errors.value).toEqual({street_name: 'Required'});
    });

    it('clearErrors empties a populated bag', () => {
        const {result} = mountComposable();

        result().take(refusal(422, VALIDATION_BODY));
        expect(result().errors.value).toEqual({first_name: 'Required'});

        result().clearErrors();
        expect(result().errors.value).toEqual({});
    });

    it('lets a throwing keyMapper propagate from take: a bug in the mapper is loud, never swallowed', () => {
        const keyMapper = () => {
            throw new Error('mapper blew up');
        };
        const {result} = mountComposable({keyMapper});

        expect(() => result().take(refusal(422, VALIDATION_BODY))).toThrow('mapper blew up');
        expect(result().errors.value).toEqual({});
    });

    // The refusal is raised before the parse, so a 422 the bag cannot hold still reads as one.
    it('leaves a throwing keyMapper refused with an empty bag and nothing unmapped', () => {
        const keyMapper = () => {
            throw new Error('mapper blew up');
        };
        const {result} = mountComposable({keyMapper});

        expect(() => result().take(refusal(422, VALIDATION_BODY))).toThrow();

        expect(result().refused.value).toBe(true);
        expect(result().errors.value).toEqual({});
        expect(result().unmapped.value).toEqual([]);
        expect(result().refusedUnnamed.value).toBe(true);
    });

    it('clears refusedUnnamed with the rest', () => {
        const {result} = mountComposable({fields: ['name']});
        result().take(refusal(422, {message: 'Nope', errors: {other: ['Taken']}}));
        expect(result().refusedUnnamed.value).toBe(true);

        result().clearErrors();

        expect(result().refusedUnnamed.value).toBe(false);
    });

    it('keeps the previous bag and unmapped keys when the keyMapper throws on a later 422', () => {
        const keyMapper = (key: string) => {
            if (key === 'boom') throw new Error('mapper blew up');
            return key;
        };
        const {result} = mountComposable({keyMapper, fields: ['name']});

        result().take(refusal(422, {errors: {name: ['Required'], token: ['Expired']}}));
        expect(() => result().take(refusal(422, {errors: {boom: ['x']}}))).toThrow();

        expect(result().refused.value).toBe(true);
        expect(result().errors.value).toEqual({name: 'Required'});
        expect(result().unmapped.value).toEqual(['token']);
        expect(result().refusedUnnamed.value).toBe(false);
    });

    describe('fields allow-list', () => {
        it('keeps every key when no allow-list is given', () => {
            const {result} = mountComposable();

            result().take(refusal(422, {errors: {email: ['Taken'], token: ['Expired']}}));

            expect(result().errors.value).toEqual({email: 'Taken', token: 'Expired'});
            expect(result().unmapped.value).toEqual([]);
        });

        it('drops a key the allow-list does not name and keeps the ones it does', () => {
            const {result} = mountComposable({fields: ['email', 'name']});

            result().take(refusal(422, {errors: {email: ['Taken'], name: ['Required'], token: ['Expired']}}));

            expect(result().errors.value).toEqual({email: 'Taken', name: 'Required'});
            expect(result().unmapped.value).toEqual(['token']);
        });

        it('matches the allow-list against keyMapper output, not the raw key', () => {
            const keyMapper = (key: string) => (key === 'email_address' ? 'email' : key);
            const {result} = mountComposable({keyMapper, fields: ['email']});

            result().take(refusal(422, {errors: {email_address: ['Taken']}}));

            expect(result().errors.value).toEqual({email: 'Taken'});
            expect(result().unmapped.value).toEqual([]);
        });

        it('reports a refusal that names no allowed field as refused with an empty bag', () => {
            const {result} = mountComposable({fields: ['password']});

            result().take(refusal(422, {errors: {token: ['Expired']}}));

            expect(result().refused.value).toBe(true);
            expect(result().errors.value).toEqual({});
            expect(result().unmapped.value).toEqual(['token']);
            expect(result().refusedUnnamed.value).toBe(true);
        });

        it('keeps the allowed fields of a mixed bag and lists the one it dropped', () => {
            const {result} = mountComposable({fields: ['email']});

            result().take(refusal(422, {errors: {email: ['Taken'], token: ['Expired']}}));

            expect(result().errors.value).toEqual({email: 'Taken'});
            expect(result().unmapped.value).toEqual(['token']);
            expect(result().refusedUnnamed.value).toBe(false);
        });
    });

    describe('refusal signal', () => {
        it('starts neither refused nor unmapped', () => {
            const {result} = mountComposable();

            expect(result().refused.value).toBe(false);
            expect(result().unmapped.value).toEqual([]);
            expect(result().refusedUnnamed.value).toBe(false);
        });

        it('is raised by a 422 whose body carries no errors object at all', () => {
            const {result} = mountComposable();

            result().take(refusal(422, {message: 'nope'}));

            expect(result().refused.value).toBe(true);
            expect(result().refusedUnnamed.value).toBe(true);
        });

        it('is not raised by a non-422 response', () => {
            const {result} = mountComposable();

            result().take(refusal(500, VALIDATION_BODY));

            expect(result().refused.value).toBe(false);
        });

        it('is not raised by an error with no response', () => {
            const {result} = mountComposable();

            result().take({isAxiosError: true, message: 'boom'});

            expect(result().refused.value).toBe(false);
        });

        it('is not unnamed when the bag holds a field', () => {
            const {result} = mountComposable();

            result().take(refusal(422, VALIDATION_BODY));

            expect(result().refused.value).toBe(true);
            expect(result().refusedUnnamed.value).toBe(false);
        });

        it('clearErrors drops the bag, the refusal and the unmapped keys together', () => {
            const {result} = mountComposable({fields: ['email']});

            result().take(refusal(422, {errors: {email: ['Taken'], token: ['Expired']}}));
            result().clearErrors();

            expect(result().errors.value).toEqual({});
            expect(result().refused.value).toBe(false);
            expect(result().unmapped.value).toEqual([]);
        });

        it('replaces the unmapped keys of the previous refusal instead of appending', () => {
            const {result} = mountComposable({fields: ['email']});

            result().take(refusal(422, {errors: {token: ['Expired']}}));
            result().take(refusal(422, {errors: {code: ['Wrong']}}));

            expect(result().unmapped.value).toEqual(['code']);
        });
    });

    describe('message list guard', () => {
        it('skips a bare-string message instead of binding its first character', () => {
            const {result} = mountComposable();

            result().take(refusal(422, {errors: {email: 'fout', name: ['Required']}}));

            expect(result().errors.value).toEqual({name: 'Required'});
            expect(result().unmapped.value).toEqual(['email']);
        });

        it('skips an empty message list', () => {
            const {result} = mountComposable();

            result().take(refusal(422, {errors: {email: []}}));

            expect(result().errors.value).toEqual({});
            expect(result().unmapped.value).toEqual(['email']);
        });

        it('skips a list whose first entry is not a string', () => {
            const {result} = mountComposable();

            result().take(refusal(422, {errors: {email: [{text: 'Taken'}]}}));

            expect(result().errors.value).toEqual({});
            expect(result().unmapped.value).toEqual(['email']);
        });

        // Parsed from text: an object literal's `__proto__` sets the prototype instead of creating the key.
        it('binds a field named __proto__ as an own key', () => {
            const {result} = mountComposable();

            result().take(refusal(422, JSON.parse('{"errors":{"__proto__":["x"]}}')));

            expect(Object.hasOwn(result().errors.value, '__proto__')).toBe(true);
            expect(Object.getOwnPropertyDescriptor(result().errors.value, '__proto__')?.value).toBe('x');
            expect(Object.getPrototypeOf(result().errors.value)).toBe(Object.prototype);
            expect(result().unmapped.value).toEqual([]);
        });

        it('reports a skipped key under its keyMapper name', () => {
            const keyMapper = (key: string) => key.toUpperCase();
            const {result} = mountComposable({keyMapper});

            result().take(refusal(422, {errors: {email: 'fout'}}));

            expect(result().unmapped.value).toEqual(['EMAIL']);
        });

        it('does not report a name as unmapped when another key bound it', () => {
            const keyMapper = (key: string) => (key === 'email_address' ? 'email' : key);
            const {result} = mountComposable({keyMapper});

            result().take(refusal(422, JSON.parse('{"errors":{"email":["Taken"],"email_address":"bad"}}')));
            expect(result().errors.value).toEqual({email: 'Taken'});
            expect(result().unmapped.value).toEqual([]);

            result().take(refusal(422, JSON.parse('{"errors":{"email_address":"bad","email":["Taken"]}}')));
            expect(result().errors.value).toEqual({email: 'Taken'});
            expect(result().unmapped.value).toEqual([]);
        });

        it('lists a name once when several dropped keys map to it', () => {
            const keyMapper = (key: string) => (key.endsWith('_token') ? 'token' : key);
            const {result} = mountComposable({keyMapper, fields: ['name']});

            result().take(
                refusal(422, {errors: {reset_token: ['Expired'], invite_token: ['Expired'], code: ['Wrong']}}),
            );

            expect(result().unmapped.value).toEqual(['token', 'code']);
        });
    });
});
