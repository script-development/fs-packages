import type {Placement} from '@floating-ui/vue';
import type {CSSProperties, Ref} from 'vue';

import {autoUpdate, flip, hide, offset, shift, size, useFloating} from '@floating-ui/vue';
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue';

import {ensureRefValueExists} from '../internal/reactivity';

/**
 * A readonly ref to the element or null — a `useTemplateRef` result, or a computed deriving
 * the element from a child component's exposed handle (the `OptionList` case).
 */
type ElementRef = Readonly<Ref<HTMLElement | null>>;

/**
 * Overrides for the floating-ui layout policy. Every value defaults to the family standard,
 * so the knob is a no-op until a consumer opts in.
 */
export interface ListboxFloatingOptions {
    /** floating-ui placement of the popup (default `'bottom-start'`). */
    placement?: Placement;
    /** `offset()` main-axis distance between reference and popup, in px (default `4`). */
    offset?: number;
    /** `flip()` fallback placements tried when the primary placement overflows (default `['top-start']`). */
    fallbackPlacements?: Placement[];
    /** `shift()` viewport padding, in px (default `8`). */
    shiftPadding?: number;
}

export interface UseListboxOptions {
    /** the component root — click-outside is measured against it (the popup stays inside it). */
    root: ElementRef;
    /** the floating-ui reference element (the trigger button / the combobox input). */
    reference: ElementRef;
    /** the floating-ui floating element (the listbox popup). */
    floating: ElementRef;
    /** the stable `id` prop, as a getter so the derived IDREFs track it reactively. */
    id: () => string;
    /** whether the control is disabled — the keyboard path guards on it, as a getter so it stays live. */
    disabled: () => boolean;
    /** length of the currently-rendered option list (SingleSelect `sorted`, Combobox/MultiSelect `filtered`). */
    listLength: () => number;
    /** whether a key pressed while CLOSED should open the list (SingleSelect Enter/ArrowDown/Space; Combobox ArrowDown only). */
    openKeys: (key: string) => boolean;
    /**
     * Commit the option at `index`; returns whether a commit actually happened, which is what
     * decides whether Enter is `preventDefault`-ed. The callback owns the read-through-a-local
     * race guard (the array read) AND the close decision — the composable NEVER closes on commit,
     * so a MultiSelect callback can toggle membership and stay open while a SingleSelect one closes.
     */
    onCommit: (index: number) => boolean;
    /** dismiss the list (Escape / Tab). SingleSelect closes; Combobox reverts-then-closes. */
    onDismiss: () => void;
    /** click-outside disposition. SingleSelect closes; Combobox reverts-then-closes. */
    onOutside: () => void;
    /** floating-ui layout-policy overrides — layout is the caller's business, not the core's. */
    floatingOptions?: ListboxFloatingOptions;
    /**
     * Whether a committing CLEAR ENTRY currently renders above the option list (the
     * `clearLabel` feature on SingleSelect/Combobox). The entry lives OUTSIDE the index
     * space — indexes keep mapping to the caller's option list — and gets its own keyboard
     * slot between "nothing highlighted" and index 0, plus its own activedescendant id
     * (`${id}-clear`). A getter so it tracks the prop reactively.
     */
    clearEntry?: () => boolean;
    /** Commit the clear entry; returns whether a commit happened (decides preventDefault). */
    onClearCommit?: () => boolean;
}

/**
 * The behavioural core shared by every ui-inputs listbox control (SingleSelect, Combobox, and —
 * forthcoming — MultiSelect). Entirely position/index-based, so the option type `T` never crosses
 * this boundary: the caller owns the derived list and hands back only its length and index-keyed
 * callbacks. Owns `open`/`pointer`, the position-keyed IDREFs, `aria-activedescendant`, the
 * clamp watcher, click-outside, floating-ui, and the keyboard-nav skeleton.
 */
export const useListbox = (options: UseListboxOptions) => {
    const {
        root,
        reference,
        floating,
        id,
        disabled,
        listLength,
        openKeys,
        onCommit,
        onDismiss,
        onOutside,
        floatingOptions = {},
        clearEntry,
        onClearCommit,
    } = options;

    const open = ref(false);
    const pointer = ref(-1);

    // Whether the CLEAR ENTRY holds the highlight. Guarded on all three legs by
    // `clearHighlighted`: the flag itself, the pointer parked at -1 (an option hover moves
    // the pointer without touching this flag, which must instantly un-highlight the entry),
    // and the entry still rendering (`clearLabel` can be withdrawn reactively while
    // highlighted). The entry check runs FIRST so the no-entry family (MultiSelect) settles
    // the computed on its own leg.
    const clearActive = ref(false);
    const clearHighlighted = computed(() => (clearEntry?.() ?? false) && clearActive.value && pointer.value === -1);
    const clearId = computed(() => `${id()}-clear`);
    /** Move the highlight onto the clear entry (keyboard slot above index 0, or hover). */
    const highlightClear = () => {
        clearActive.value = true;
        pointer.value = -1;
    };

    // Reset the highlight to "nothing" — shared by close() and the Combobox keystroke reset
    // (typing must drop a hovered clear entry exactly as it drops an option highlight).
    const resetHighlight = () => {
        clearActive.value = false;
        pointer.value = -1;
    };

    // The one dismissal step every consumer needs: close the list AND reset the highlight.
    // Owned here so a future consumer cannot forget the `-1` — a stale pointer would resurface
    // as a phantom highlight (and a phantom aria-activedescendant) on the next open. The
    // composable still never calls this on commit: closing after a commit stays the caller's
    // decision (`onCommit` — the MultiSelect toggle-and-stay-open contract).
    const close = () => {
        open.value = false;
        resetHighlight();
    };

    // Keyboard focus lives on the trigger, so the focused option is conveyed to assistive
    // tech via aria-activedescendant rather than real DOM focus. That IDREF only resolves
    // if the referenced element sits inside the listbox the trigger owns, which is why the
    // trigger also carries aria-controls while open.
    const listboxId = computed(() => `${id()}-listbox`);
    // Keyed by POSITION, not by option.id: `SelectItem['id']` is an unconstrained
    // `string | number`, and an id containing ASCII whitespace is not a valid IDREF —
    // aria-activedescendant would silently resolve to nothing. Slugifying would trade that
    // for a worse bug (`red apple` and `red-apple` would collide onto one id, making the
    // IDREF ambiguous rather than absent). The position is consistent within a render, which
    // is the only window in which the trigger's IDREF and the option's id are read together.
    const optionId = (index: number): string => `${id()}-opt-${index}`;
    // Absent (not empty) when there is nothing focused — a dangling IDREF is worse than none.
    // The upper bound is load-bearing: the rendered list can shrink while the listbox is open
    // (a reactive `options` prop reloading, or a combobox filter narrowing), leaving `pointer`
    // past the end.
    const activeDescendant = computed(() => {
        if (!open.value) return undefined;
        if (clearHighlighted.value) return clearId.value;
        return pointer.value >= 0 && pointer.value < listLength() ? optionId(pointer.value) : undefined;
    });

    // The list shrinking while open leaves `pointer` dangling. Clamping on `flush: 'pre'` (so it
    // lands before the re-render that would read a stale index) keeps the highlight honest AND
    // keeps Enter safe — the commit callback indexes the same array. (The SFCs long carried a
    // `flush: 'pre'` comment but never passed the option; it is set here for real, in one place.)
    watch(
        listLength,
        (length) => {
            if (pointer.value >= length) {
                pointer.value = length - 1;
                // A clamp lands the pointer honestly on "the new last option" — or on -1
                // when the list drained. Either way the clear flag is stale hygiene here
                // (the pointer was ≥ 0, so the entry was not highlighted): without this
                // reset, a drain-to-empty would resurrect a previously-hovered clear entry.
                clearActive.value = false;
            }
        },
        {flush: 'pre'},
    );

    // Listbox keyboard navigation. The trigger's native :disabled blocks pointer input; this
    // guards the keyboard path too.
    const onKey = (event: KeyboardEvent) => {
        if (disabled()) return;
        if (event.key === 'Tab') {
            onDismiss();
            return;
        }
        if (!open.value) {
            if (openKeys(event.key)) {
                event.preventDefault();
                open.value = true;
            }
            return;
        }
        switch (event.key) {
            case 'ArrowDown':
                if (clearHighlighted.value) {
                    // Leaving the clear entry downward: first option — or stay when the
                    // list is empty (the entry is then the only thing to highlight).
                    if (listLength() > 0) {
                        clearActive.value = false;
                        pointer.value = 0;
                    }
                } else if (pointer.value === -1 && (clearEntry?.() ?? false)) {
                    // The clear entry owns the keyboard slot between "nothing" and index 0.
                    highlightClear();
                } else {
                    clearActive.value = false;
                    pointer.value = Math.min(pointer.value + 1, listLength() - 1);
                }
                event.preventDefault();
                break;
            case 'ArrowUp':
                if (clearHighlighted.value) {
                    // Leaving the clear entry upward lands on "nothing highlighted".
                    clearActive.value = false;
                } else if (pointer.value === 0 && (clearEntry?.() ?? false)) {
                    highlightClear();
                } else {
                    clearActive.value = false;
                    pointer.value = Math.max(pointer.value - 1, -1);
                }
                event.preventDefault();
                break;
            case 'Home':
            case 'End':
                // WR-0521: jump to the first/last option. APG marks Home/End optional on
                // editable comboboxes (they trade away caret jumps while the popup is open);
                // the family takes the option-jump reading uniformly — one skeleton, four
                // controls. The option-jump reading belongs to UNMODIFIED keys only:
                // Shift/Ctrl/Meta variants are text-SELECTION shortcuts on the input-triggered
                // controls' query field and must fall through to native editing (#185 review).
                if (event.shiftKey || event.ctrlKey || event.metaKey) return;
                // A clear-entry highlight drops (the jump lands on an OPTION); an empty list
                // leaves the highlight untouched, but the unmodified key is still swallowed
                // while open (consistent modality with the arrow keys).
                if (listLength() > 0) {
                    clearActive.value = false;
                    pointer.value = event.key === 'Home' ? 0 : listLength() - 1;
                }
                event.preventDefault();
                break;
            case 'Enter':
                // The commit callbacks own the read-through-a-local race guard and the close
                // decision; they report whether they committed, and only a real commit
                // swallows Enter.
                if (clearHighlighted.value) {
                    if (onClearCommit?.() ?? false) event.preventDefault();
                } else if (onCommit(pointer.value)) {
                    event.preventDefault();
                }
                break;
            case 'Escape':
                onDismiss();
                event.preventDefault();
                break;
        }
    };

    // click-outside — closes/reverts without a shared directive dependency.
    //
    // `composedPath()`, never `event.target`: at a DOCUMENT listener a click inside a shadow
    // root is retargeted to the shadow HOST, which is an ancestor of `root` rather than a
    // descendant, so `root.contains(target)` rejects it and every option click would read as
    // outside — MultiSelect and MultiCombobox would close instead of toggling. The composed
    // path carries the true chain across shadow boundaries. The popup needs no separate check:
    // it is promoted to the top layer IN PLACE, so it never leaves `root`.
    const onDocumentPointer = (event: MouseEvent) => {
        if (!open.value) return;
        // The listener is attached only between mount and unmount, so the ref is non-null here.
        // Non-null by lifetime (the listener only exists while mounted) — loud, named accessor
        // over a bare `!`: the same impossible state throws, but names the broken assumption.
        if (event.composedPath().includes(ensureRefValueExists(root))) return;
        onOutside();
    };
    onMounted(() => document.addEventListener('click', onDocumentPointer));
    onBeforeUnmount(() => document.removeEventListener('click', onDocumentPointer));

    // KD-1136. The popup is promoted to the TOP LAYER in place, via the Popover API — it is
    // never moved in the DOM. A top-layer box paints outside the normal flow, so no ancestor's
    // `overflow` can clip it and no ancestor's stacking context can bury it, which is the whole
    // defect. Staying put is what the earlier teleport gave away: CSS inheritance follows the
    // DOM tree, so a consumer's scoped `--ui-*` map and shadow-encapsulated styles keep
    // applying, `root.contains()` keeps answering truthfully, and there is no landing site to
    // choose (no dialog lookup, no shadow-boundary walk, no second clipping ancestor).
    //
    // `v-if` builds a fresh element per open, so this can never re-show an already-open popup.
    // Removal from the DOM drops it from the top layer, which is the close path.
    watch(
        floating,
        (element) => {
            if (element) element.showPopover();
        },
        {flush: 'post'},
    );

    const {floatingStyles, middlewareData} = useFloating(reference, floating, {
        // `fixed`, not the default `absolute`: a top-layer box is positioned against the
        // viewport, and the popup no longer has a positioned ancestor to measure from.
        // autoUpdate already recomputes on ancestor scroll, which is what a fixed popup
        // needs to stay glued to its trigger.
        strategy: 'fixed',
        placement: floatingOptions.placement ?? 'bottom-start',
        middleware: [
            offset(floatingOptions.offset ?? 4),
            flip({fallbackPlacements: floatingOptions.fallbackPlacements ?? ['top-start']}),
            shift({padding: floatingOptions.shiftPadding ?? 8}),
            // `elements.floating` is the `.ui-menu-anchor` box, not the <ul>. Sizing it to the
            // trigger is what keeps `--ui-menu-min-width: 100%` meaning "as wide as the
            // trigger" after the teleport — the menu's percentage resolves against this box.
            // Without it the percentage would measure body (or the dialog), and every menu
            // would paint viewport-wide. `min-width`, not `width`: styles.css gives the anchor
            // `width: max-content` so it still grows when the menu outgrows the trigger.
            size({
                apply({rects, elements}) {
                    elements.floating.style.minWidth = `${rects.reference.width}px`;
                },
            }),
            hide(),
        ],
        whileElementsMounted: autoUpdate,
    });

    // hide() only COMPUTES `middlewareData.hide.referenceHidden` — consuming it is the
    // caller's job, and for a long stretch nobody did (the middleware sat dead and an open
    // menu stayed painted, floating detached, while its trigger scrolled out of a clipping
    // ancestor — under a sticky header, say). The gate lives here so every consumer gets it:
    // when the reference is fully clipped away, the popup hides with it.
    const gatedFloatingStyles = computed<CSSProperties>(() =>
        middlewareData.value.hide?.referenceHidden
            ? {...floatingStyles.value, visibility: 'hidden'}
            : floatingStyles.value,
    );

    return {
        open,
        pointer,
        listboxId,
        optionId,
        activeDescendant,
        floatingStyles: gatedFloatingStyles,
        onKey,
        close,
        clearHighlighted,
        clearId,
        highlightClear,
        resetHighlight,
    };
};
