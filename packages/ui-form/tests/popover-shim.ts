/**
 * happy-dom 21 ships no Popover API, and `useListbox` calls `showPopover()` unconditionally —
 * the API is Baseline (Chrome 114 / Safari 17 / Firefox 125) and a capability branch in source
 * would be permanently unreachable under the coverage gate, which runs happy-dom only.
 *
 * These stand-ins keep the unit suite on the real code path. They deliberately do NOT emulate
 * top-layer painting or `:popover-open` — that is layout, which happy-dom cannot do and which
 * the real-Chromium browser suite asserts instead.
 */
const proto = globalThis.HTMLElement?.prototype as (HTMLElement & {showPopover?: () => void}) | undefined;

if (proto && !proto.showPopover) {
    proto.showPopover = function showPopover(this: HTMLElement) {
        this.setAttribute('data-shim-popover-open', '');
    };
    (proto as HTMLElement & {hidePopover?: () => void}).hidePopover = function hidePopover(this: HTMLElement) {
        this.removeAttribute('data-shim-popover-open');
    };
}
