import type {Ref} from 'vue';

import {isAxiosError} from '@script-development/fs-http';
import {computed, readonly, ref} from 'vue';

import type {
    CreateSessionStoreConfig,
    LoginOutcome,
    LogoutOutcome,
    SessionEndListenerErrorHandler,
    RequestOptions,
    SessionEndEvent,
    SessionRead,
    SessionState,
    SessionStore,
} from './types';

import {createCsrfPrimer} from './csrf';
import {isSignedOutStatus} from './endpoints';

/** The one status that earns a second attempt, and only from `login()` (ADR-0050 § 3). */
const STALE_TOKEN_STATUS = 419;

/**
 * What a `me` attempt reported AND what it wrote, whatever the caller does with
 * it. Read-only so the shared `SUPERSEDED` value below needs no `Object.freeze`
 * — a top-level call would evaluate at module load and break this package's
 * `sideEffects: false`.
 *
 * Split in two so `state` narrows: an overtaken read carries no state because it
 * wrote none, and `state === undefined` is the discriminator the public boundary
 * reads (DECISIONS D23).
 */
interface MeAnswer {
    readonly status: number | undefined;
    readonly body: unknown;
    /** The state this read wrote, read in the same synchronous block as the write. */
    readonly state: SessionState;
}

interface SupersededOutcome {
    readonly status: undefined;
    readonly body: undefined;
    readonly state: undefined;
}

type MeOutcome = MeAnswer | SupersededOutcome;

/**
 * Default sink for a failing session-end listener: loud, and it does not
 * propagate. Modelled on fs-http's `guarded()` default — the Armory already
 * holds that a swallowed callback failure is reported by default (D8).
 */
const defaultOnListenerError: SessionEndListenerErrorHandler = (error, event) => {
    console.error('[fs-auth] onSessionEnd listener failed and was swallowed:', error, event);
};

/** A read a newer one overtook. It reports nothing, because nothing of it was used. */
const SUPERSEDED: SupersededOutcome = {status: undefined, body: undefined, state: undefined};

/**
 * An axios rejection once `isAxiosError` has narrowed it: an answer, or the
 * recorded absence of one. Written structurally so no axios type is named here.
 */
type TransportFailure = {response?: {status: number; data: unknown}};

export const createSessionStore = <TUser, TCredentials = Record<string, unknown>>(
    config: CreateSessionStoreConfig<TUser>,
): SessionStore<TUser, TCredentials> => {
    const {endpoints, guard, http, parseUser, timeoutMs} = config;
    const isChallenge = config.isChallenge ?? (() => false);
    const onListenerError = config.onListenerError ?? defaultOnListenerError;

    /*
     * A store that primes a CSRF cookie must forward what it primed, whatever the
     * injected service was configured with: `createHttpService` defaults
     * `withXSRFToken` to FALSE, so a primed store on a default service sends the
     * cookie nowhere and every login draws the 419 the prime existed to avoid. The
     * credentials flag rides along because the prime itself has to be allowed to
     * STORE the cookie cross-origin. A store with no `csrf` block leaves the
     * service's own configuration alone — it has claimed nothing about the origin
     * boundary, so it overrides nothing (DECISIONS D12).
     */
    const requestOptions: RequestOptions =
        config.csrf === undefined
            ? {timeout: timeoutMs}
            : {timeout: timeoutMs, withCredentials: true, withXSRFToken: true};

    const primer = config.csrf === undefined ? undefined : createCsrfPrimer(http, config.csrf.primeUrl, requestOptions);

    /*
     * Every request this store issues. The 401/419 hook asks for this set by URL
     * and leaves all of them alone, because each is already judged by the path
     * that issued it: login and logout return an outcome to a caller, and `me`
     * is judged by the read epoch — which the hook runs too early to consult, so
     * a stale refusal reaching it would clear a session a newer read had just
     * established (DECISIONS D19).
     */
    const ownEndpoints: ReadonlySet<string> = new Set(
        config.csrf === undefined
            ? [endpoints.me, endpoints.login, endpoints.logout]
            : [endpoints.me, endpoints.login, endpoints.logout, config.csrf.primeUrl],
    );

    const state = ref<SessionState>('loading');
    const user = ref<TUser | undefined>() as Ref<TUser | undefined>;
    /*
     * One entry per REGISTRATION, not per function. Keyed on the function itself,
     * two components sharing one module-level handler collapsed into a single
     * entry and the first unregister silenced the other — a still-mounted
     * consumer that simply stops hearing session ends (DECISIONS D20).
     */
    const listeners = new Set<{listener: (event: SessionEndEvent) => void | Promise<void>}>();

    /*
     * The read epoch. A `me` answer writes the machine only if no later read was
     * issued while it was in flight — otherwise two navigations in a row leave
     * the OLDER answer last, and the store states a previous request's facts with
     * nothing anywhere in an error state (ADR-0048's failure mode, arriving as a
     * confident wrong answer rather than as silence).
     */
    let issued = 0;

    /** Take the next ticket, making every read issued before this one stale. */
    const nextEpoch = (): number => {
        issued += 1;

        return issued;
    };

    /*
     * `state` and `user` are written together, always. Writing one without the
     * other leaves the previous identity readable behind a signed-out machine —
     * the shell keeps rendering a name for a session that is gone.
     *
     * And the epoch advances BEFORE either write. A `me` already in flight when
     * the session ended would otherwise still hold a live ticket, land afterwards
     * and commit `authenticated` over a session the server has closed — handing
     * back guarded access on the strength of an answer that predates the sign-out
     * (DECISIONS D15; lokalekeuze ruled the same shape as LK-0291 rule 2).
     */
    const clearSession = (): void => {
        nextEpoch();

        state.value = 'signed_out';
        user.value = undefined;
    };

    /*
     * The states that still hold a session to end. `outage` is one of them: it
     * retains the user (D14), so a shell is still naming somebody, and the thing
     * that ends it is a transition a consumer has to hear about. `loading` and
     * `signed_out` hold nothing.
     */
    const holdsSession = (): boolean => state.value === 'authenticated' || state.value === 'outage';

    /*
     * The transition out of a live session: clears it, then tells the consumer
     * ONCE. The guard on the notification lives here and nowhere else, because
     * here is the only place a listener is ever called — a logout landing behind
     * an expiry, a second logout, a 401 arriving at a login screen all reach this
     * function, and all of them are the same question: was there a session to end?
     * The machine is read BEFORE the clear, which is what makes it single-flight:
     * the first caller through writes `signed_out` with no await in between
     * (ADR-0050 § 2).
     *
     * The clear itself is unconditional. A successful logout moves the machine
     * whatever it was doing — the server has spoken, and leaving it `loading`
     * would state a session nobody has.
     */
    const endSession = (event: SessionEndEvent): void => {
        const ending = holdsSession();

        clearSession();

        if (!ending) return;

        for (const {listener} of listeners) {
            /*
             * Swallowed so one failing listener cannot cost the others their
             * notice, and REPORTED so it is not lost — a silent swallow is
             * ADR-0048's failure mode wearing a `catch` (DECISIONS D8, reversed).
             * `Promise.resolve` covers the async listener the `void` return type
             * admits: its rejection never reaches this `catch`, and routing it
             * here costs nothing synchronous, so `endSession` still returns
             * before any listener's promise settles.
             */
            try {
                void Promise.resolve(listener(event)).catch((error: unknown) => onListenerError(error, event));
            } catch (error) {
                onListenerError(error, event);
            }
        }
    };

    /*
     * The newest read, as the promise that settles it. A confirming `me` that
     * comes back SUPERSEDED reported nothing, so `login()` cannot answer from the
     * machine yet — `state` is whatever the read that overtook it has not written.
     * It waits for this one instead.
     *
     * Promise identity, not a second epoch: `issued` stays the only ordering
     * authority. The question this answers is different — is there a newer READ
     * still to settle — and it has to be, because `clearSession` also takes a
     * ticket and issues no read. A confirm superseded by a sign-out has nothing
     * left to wait for, and a chain keyed on the epoch alone would wait forever.
     */
    let latestRead: Promise<MeOutcome> = Promise.resolve(SUPERSEDED);

    const runLoadSession = async (): Promise<MeOutcome> => {
        const ticket = nextEpoch();

        let response: {data: unknown; status: number};

        try {
            response = await http.getRequest(endpoints.me, requestOptions);
        } catch (error) {
            /*
             * Only an HTTP answer, or an axios rejection reporting the ABSENCE of
             * one, becomes a session state. Anything else reaching here is a defect
             * — fs-http rejects a non-axios error untouched — and a defect that
             * classified itself as `outage` would be indistinguishable from a real
             * one forever (ADR-0048). It propagates instead (DECISIONS D13).
             */
            if (!isAxiosError(error)) throw error;

            if (issued !== ticket) return SUPERSEDED;

            const status = error.response?.status;
            /*
             * Hoisted so the optional chain has ONE site. Duplicated across the
             * two returns below, the signed-out copy is an equivalent mutant no
             * spec can kill — that branch is only reached for a 401/419, which
             * implies a response — while this single site is killed by the
             * transport-failure spec, where there is none.
             */
            const body: unknown = error.response?.data;

            if (isSignedOutStatus(status)) {
                /*
                 * A revalidating `me` that answers 401 or 419 is an expiry, and the
                 * two statuses are one class with one action (ADR-0050 § 3). It goes
                 * through `endSession` from every state: that function decides whether
                 * there was a session to end, so the consumer hears about this one
                 * exactly as it hears about a refusal caught mid-request, and hears
                 * nothing when a login screen's own `me` answers 401.
                 */
                endSession({reason: 'expired'});

                /*
                 * The branch decided `signed_out` and `endSession` wrote it through
                 * `clearSession`, unconditionally. Reading `state.value` back here
                 * instead would report whatever a SYNCHRONOUS consumer effect left —
                 * a `watch(…, {flush: 'sync'})` fires inside the assignment — which
                 * is the machine's later news and not this read's answer (D23).
                 */
                return {status, body, state: 'signed_out'};
            }

            /*
             * `user` is deliberately RETAINED on an outage. The ADR is explicit that
             * an outage is never a sign-out, so the identity is still presumed
             * good and a shell can keep naming it behind a notice; clearing it
             * would render a broken API as a sign-out by another route.
             */
            state.value = 'outage';

            return {status, body, state: 'outage'};
        }

        if (issued !== ticket) return SUPERSEDED;

        // Outside the transport `try` on purpose: a throwing `parseUser` is the
        // consumer's defect and must reach the consumer, not become an `outage`.
        const parsed = parseUser(response.data);

        /*
         * Re-checked AFTER the guard ran. `parseUser` is package-called and
         * consumer-written, and nothing in its type forbids a side effect: one
         * that starts another read takes a ticket synchronously, in the gap
         * between the check above and the writes below. Without this, an
         * overtaken read commits anyway and reports a state it had no business
         * writing (D23). A THROWING guard still propagates — this is reached
         * only once it has returned (D13).
         */
        if (issued !== ticket) return SUPERSEDED;

        let wrote: SessionState;

        if (parsed === undefined) {
            wrote = 'outage';
        } else {
            // `user` before the machine, so a synchronous effect on `state` cannot
            // observe `authenticated` with the previous identity still readable.
            user.value = parsed;
            wrote = 'authenticated';
        }

        /*
         * The THIRD re-entry point, and the last one this read owns: the `user`
         * write above is itself observable, so a `watch(store.user, …,
         * {flush: 'sync'})` runs between it and the machine. An effect that ends
         * the session there took a ticket, and writing `wrote` over it would
         * report `authenticated` with no user, after the consumer was told the
         * session was over. An effect that starts a newer read took one too, and
         * this read has no answer to give (D23, crit `6ecd750b40bc` /
         * `fff70bd50c2d`).
         */
        if (issued !== ticket) return SUPERSEDED;

        state.value = wrote;

        return {status: response.status, body: response.data, state: wrote};
    };

    /** Every read this store makes goes through here, so `latestRead` is never behind one. */
    const startRead = (): Promise<MeOutcome> => {
        const read = runLoadSession();

        latestRead = read;

        return read;
    };

    /*
     * A read, and then whatever overtook it, until an answer the store actually
     * acted on comes back. `login()` needs that answer and not its own: a
     * superseded confirm leaves `state` mid-flight, and reading the machine there
     * reports a refusal for a login the server accepted.
     */
    const readUntilSettled = async (): Promise<MeOutcome> => {
        let awaited = startRead();
        let outcome = await awaited;

        while (outcome === SUPERSEDED && latestRead !== awaited) {
            awaited = latestRead;
            outcome = await awaited;
        }

        return outcome;
    };

    const attemptLogin = async (credentials: TCredentials): Promise<{data: unknown}> => {
        if (primer !== undefined) await primer.prime();

        return http.postRequest(endpoints.login, credentials, requestOptions);
    };

    const failedLogout = (error: TransportFailure): LogoutOutcome => ({
        kind: 'failed',
        status: error.response?.status,
        body: error.response?.data,
    });

    const refusalOf = (error: TransportFailure): LoginOutcome => ({
        kind: 'refused',
        status: error.response?.status,
        body: error.response?.data,
    });

    return {
        guard,
        state: readonly(state),
        /*
         * `readonly()` maps a generic through `DeepReadonly`, which does not reduce
         * for an unresolved `TUser` — so the assertion is what keeps the consumer's
         * own type readable on the way out. The RUNTIME guarantee is unaffected: the
         * value is still Vue's readonly proxy and still refuses a write, and the
         * declared `Readonly<Ref<…>>` still refuses one at compile time (D10).
         */
        user: readonly(user) as Readonly<Ref<TUser | undefined>>,
        isAuthenticated: computed(() => state.value === 'authenticated'),

        setUser(next) {
            if (state.value !== 'authenticated') {
                throw new TypeError(`fs-auth: setUser called while the session is '${state.value}', not authenticated`);
            }

            user.value = next;
        },

        async loadSession(): Promise<SessionRead | undefined> {
            const read = await startRead();

            /*
             * The sentinel stays private: a consumer gets `undefined` for a read
             * a newer one overtook, because it wrote nothing and so has nothing
             * to report (D23).
             */
            if (read.state === undefined) return undefined;

            return {state: read.state, status: read.status, body: read.body};
        },

        async login(credentials) {
            let response: {data: unknown};

            try {
                response = await attemptLogin(credentials);
            } catch (error) {
                if (!isAxiosError(error)) throw error;

                /*
                 * One retry, and only for a stale token on a primed store. A token
                 * still refused against a fresh cookie is not a stale cookie, so a
                 * third post cannot fix it; and the retry may answer something else
                 * entirely, which is an answer to read rather than one to repeat.
                 */
                if (primer === undefined || error.response?.status !== STALE_TOKEN_STATUS) return refusalOf(error);

                primer.reset();

                try {
                    response = await attemptLogin(credentials);
                } catch (retryError) {
                    if (!isAxiosError(retryError)) throw retryError;

                    return refusalOf(retryError);
                }
            }

            if (isChallenge(response.data)) return {kind: 'challenge', body: response.data};

            const me = await readUntilSettled();

            if (state.value === 'authenticated') return {kind: 'authenticated'};

            /*
             * The POST was accepted and the confirm did not establish a session.
             * That is not a refusal of the credentials, and answering `refused`
             * here sent a consumer to the wrong sentence (D22).
             */
            return {kind: 'unconfirmed', status: me.status, body: me.body};
        },

        async logout() {
            if (primer !== undefined) {
                try {
                    await primer.prime();
                } catch (error) {
                    if (!isAxiosError(error)) throw error;

                    /*
                     * The cookie route refusing says nothing about the session, and
                     * the logout endpoint was never asked — so this is ruling 1 in
                     * full force whatever status came back.
                     */
                    return failedLogout(error);
                }
            }

            try {
                await http.postRequest(endpoints.logout, {}, requestOptions);
            } catch (error) {
                /*
                 * A defect is nobody's outcome, here as everywhere else (D13). It
                 * used to become `failed` with an undefined status — indistinguishable
                 * from a transport failure, which is the one shape a consumer is most
                 * likely to shrug at (ADR-0048).
                 */
                if (!isAxiosError(error)) throw error;

                /*
                 * Ruling 1 (D1), amended 2026-09-16. Every failure still leaves the
                 * session standing and answers `failed`, and nothing probes the
                 * server afterwards — because the ruling protects a cookie the
                 * server still HONOURS. A 401 or 419 is the server saying it does
                 * not, which is not a failure to report but a sign-out to pass on:
                 * the caller is told `signed_out`, and the session ends as an
                 * EXPIRY, because the server ended it and the person only found out.
                 */
                if (!isSignedOutStatus(error.response?.status)) return failedLogout(error);

                endSession({reason: 'expired'});

                return {kind: 'signed_out'};
            }

            endSession({reason: 'logout'});

            return {kind: 'signed_out'};
        },

        ownsRefusalOf: (url) => url !== undefined && ownEndpoints.has(url),

        handleSessionExpired(returnTo) {
            /*
             * Not a second copy of `endSession`'s guard but a different question,
             * and the reason it is asked here: this is a registrar callback about
             * SOME request, so a 401 arriving while nothing is live must leave the
             * machine entirely alone. Clearing would take a read ticket and stale a
             * `loadSession()` in flight — signing somebody out of an initial load on
             * the strength of a refusal that was never about their session.
             */
            if (!holdsSession()) return;

            endSession({reason: 'expired', returnTo});
        },

        onSessionEnd(listener) {
            const subscription = {listener};

            listeners.add(subscription);

            return () => {
                listeners.delete(subscription);
            };
        },
    };
};
