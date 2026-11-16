// @vitest-environment happy-dom

import {describe, expect, it, vi} from 'vitest';

import {useFormSubmit, useValidationErrors} from '../../src';

// The real taker: a 422 it takes, anything else it hands back.
const {take} = useValidationErrors();

// The shape of an axios error that the form reads (see src/form/http-contract.ts); no axios import needed.
interface RequestError {
    isAxiosError: true;
    response?: {status: number};
}

const makeAxiosError = (status: number): RequestError => ({isAxiosError: true, response: {status}});

const deferred = () => {
    let resolve!: () => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<void>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return {promise, resolve, reject};
};

describe('useFormSubmit', () => {
    it('keeps prior errors while the action runs and clears them when it resolves', async () => {
        const clearErrors = vi.fn();
        const {handleSubmit} = useFormSubmit({clearErrors, take});
        const gate = deferred();

        const inFlight = handleSubmit(() => gate.promise);
        expect(clearErrors).not.toHaveBeenCalled();

        gate.resolve();
        await expect(inFlight).resolves.toBe('sent');
        expect(clearErrors).toHaveBeenCalledOnce();
    });

    it("reads an action that resolves false as 'cancelled': it sent nothing, so the errors stay", async () => {
        const clearErrors = vi.fn();
        const {handleSubmit, submitting} = useFormSubmit({clearErrors, take});

        await expect(handleSubmit(async () => false)).resolves.toBe('cancelled');
        expect(clearErrors).not.toHaveBeenCalled();
        expect(submitting.value).toBe(false);
    });

    it('sends on any other resolved value, a saved id included', async () => {
        const clearErrors = vi.fn();
        const {handleSubmit} = useFormSubmit({clearErrors, take});

        await expect(handleSubmit(async () => 0)).resolves.toBe('sent');
        expect(clearErrors).toHaveBeenCalledOnce();
    });

    it('leaves the errors as they were when the action fails with anything but a 422', async () => {
        const clearErrors = vi.fn();
        const {handleSubmit} = useFormSubmit({clearErrors, take});

        await expect(handleSubmit(() => Promise.reject(makeAxiosError(500)))).rejects.toBeTruthy();
        expect(clearErrors).not.toHaveBeenCalled();
    });

    it('toggles submitting true during the action and false after', async () => {
        const {handleSubmit, submitting} = useFormSubmit({clearErrors: vi.fn(), take});
        const gate = deferred();

        expect(submitting.value).toBe(false);

        const inFlight = handleSubmit(() => gate.promise);
        expect(submitting.value).toBe(true);

        gate.resolve();
        await inFlight;
        expect(submitting.value).toBe(false);
    });

    it('ignores a re-entrant submit while one is already in flight', async () => {
        const {handleSubmit, submitting} = useFormSubmit({clearErrors: vi.fn(), take});
        const gate = deferred();
        const action = vi.fn(() => gate.promise);

        const first = handleSubmit(action);
        expect(submitting.value).toBe(true);

        // second call must early-return without invoking the action again
        await expect(handleSubmit(action)).resolves.toBe('ignored');
        expect(action).toHaveBeenCalledOnce();

        gate.resolve();
        await expect(first).resolves.toBe('sent');
    });

    it('swallows a 422 rejection so the form is preserved', async () => {
        const {handleSubmit, submitting} = useFormSubmit({clearErrors: vi.fn(), take});

        await expect(
            handleSubmit(async () => {
                throw makeAxiosError(422);
            }),
        ).resolves.toBe('refused');
        expect(submitting.value).toBe(false);
    });

    it('re-throws a non-422 axios rejection', async () => {
        const {handleSubmit, submitting} = useFormSubmit({clearErrors: vi.fn(), take});
        const error = makeAxiosError(500);

        await expect(
            handleSubmit(async () => {
                throw error;
            }),
        ).rejects.toBe(error);
        expect(submitting.value).toBe(false);
    });

    it('re-throws an axios error that carries no response object', async () => {
        const {handleSubmit} = useFormSubmit({clearErrors: vi.fn(), take});
        const error: RequestError = {isAxiosError: true};

        await expect(
            handleSubmit(async () => {
                throw error;
            }),
        ).rejects.toBe(error);
    });

    it('re-throws a non-axios rejection', async () => {
        const {handleSubmit} = useFormSubmit({clearErrors: vi.fn(), take});
        const error = new Error('network down');

        await expect(
            handleSubmit(async () => {
                throw error;
            }),
        ).rejects.toBe(error);
    });

    it('resets submitting to false even when the action re-throws', async () => {
        const {handleSubmit, submitting} = useFormSubmit({clearErrors: vi.fn(), take});

        await handleSubmit(async () => {
            throw makeAxiosError(500);
        }).catch(() => null);

        expect(submitting.value).toBe(false);
    });

    it("hands its own rejection to take, so the form holds exactly its own request's 422", async () => {
        const take = vi.fn(() => true);
        const {handleSubmit} = useFormSubmit({clearErrors: vi.fn(), take});
        const error = makeAxiosError(422);

        await expect(
            handleSubmit(async () => {
                throw error;
            }),
        ).resolves.toBe('refused');
        expect(take).toHaveBeenCalledWith(error);
    });
});
