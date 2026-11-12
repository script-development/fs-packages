import {vi} from 'vitest';

/**
 * Every spec runs with `Date` fixed; timers stay real. Vue drops a DOM event stamped before its listener was
 * attached (`@vue/test-utils`' `trigger()` stamps `Date.now() + 1`, the invoker compares it with the attach
 * time), so a wall clock stepped backwards between a mount and a trigger silently loses the event. A machine
 * whose time sync steps the clock back does exactly that. Nothing here reads the date; a spec that needs time
 * to pass fakes all timers itself (`typeahead.spec`).
 */
vi.useFakeTimers({toFake: ['Date']});
