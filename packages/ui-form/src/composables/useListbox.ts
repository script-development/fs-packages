import type {Placement} from '@floating-ui/vue';
import type {CSSProperties, Ref} from 'vue';

import {autoUpdate, flip, hide, offset, shift, size, useFloating} from '@floating-ui/vue';
import {computed, onBeforeUnmount, onMounted, readonly, ref, watch} from 'vue';

import {ensureRefValueExists} from '../internal/reactivity';

/**
 * A readonly ref to the element or null — a `useTemplateRef` result, or a computed deriving
 * the element from a child component's exposed handle (the `OptionList` case).
 */
type ElementRef = Readonly<Ref<HTMLElement | null>>;

export interface UseListboxOptions {
    /** the component root — click-outside is measured against it (the popup stays inside it). */
    root: ElementRef;
    /** the floating-ui reference element (the trigger button). */
    reference: ElementRef;
    /** the floating-ui floating element (the listbox popup). */
    floating: ElementRef;
    /** the stable `id` prop, as a getter so the derived IDREFs track it reactively. */
    id: () => string;
    /** whether the control is disabled — the keyboard path guards on it, as a getter so it stays live. */
    disabled: () => boolean;
    /** length of the currently-rendered option list (SingleSelect's `sorted`). */
    listLength: () => number;
    /** whether a key pressed while CLOSED should open the list (SingleSelect: Enter/ArrowDown/Space). */
    openKeys: (key: string) => boolean;
    /**
     * Commit the option at `index`; returns whether a commit actually happened, which is what
     * decides whether Enter is `preventDefault`-ed. The callback owns the read-through-a-local
     * race guard (the array read) AND the close decision: the composable NEVER closes on commit,
     * so the caller decides (SingleSelect's closes).
     */
    onCommit: (index: number) => boolean;
    /** dismiss the list (Escape, Tab, or a click outside the root). SingleSelect closes. */
    onDismiss: () => void;
    /**
     * floating-ui placement of the popup (default `'bottom-start'`). With no room it flips to the
     * opposite side at the same alignment (`bottom-start` → `top-start`), never to the other
     * alignment.
     */
    placement?: Placement;
    /**
     * Whether a committing CLEAR ENTRY currently renders above the option list (the
     * `clearLabel` feature on SingleSelect). The entry lives OUTSIDE the index
     * space — indexes keep mapping to the caller's option list — and gets its own keyboard
     * slot between "nothing highlighted" and index 0, plus its own activedescendant id
     * (`${id}-clear`). A getter so it tracks the prop reactively.
     */
    clearEntry: () => boolean;
    /** Commit the clear entry. Null is always committable, so Enter on the entry is always swallowed. */
    onClearCommit: () => void;
    /** The rendered options' display strings, index-aligned with the list — the typeahead's haystack. */
    typeaheadLabels: () => string[];
    /**
     * Index of the single committed option in the rendered list, or -1. A typeahead search with
     * nothing highlighted starts from it, as a native <select> searches from its value.
     */
    committedIndex: () => number;
}

/** How long the typed string survives without a keystroke (the APG listbox examples' 500 ms). */
const TYPEAHEAD_RESET_MS = 500;
/**
 * Key repeat never lets the idle reset fire, so the typed string is capped. It keeps its FIRST
 * keys: the prefix is what matches, and a sliding tail would match from the middle of a word. Keys,
 * not UTF-16 units: an emoji key is two units and one key.
 */
const TYPEAHEAD_MAX_LENGTH = 64;

/**
 * Lowercases one code point at a time, so a character folds the same wherever it stands. A whole-string
 * lowercase is contextual (Σ ending a word becomes ς, elsewhere σ), and the keys are folded one by one,
 * so a label folded as a whole could disagree with the same text typed (crit b8d6a958f182).
 */
const fold = (text: string): string => Array.from(text, (character) => character.toLocaleLowerCase()).join('');

/**
 * The behavioural core of the ui-form listbox control (SingleSelect). Entirely position/index-based, so the
 * option type `T` never crosses this boundary: the caller owns the derived list and hands back
 * only its length and index-keyed callbacks. Owns `open`/`pointer`, the position-keyed IDREFs,
 * `aria-activedescendant`, the clamp watcher, click-outside, floating-ui, and the keyboard-nav
 * skeleton.
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
        placement = 'bottom-start',
        clearEntry,
        onClearCommit,
        typeaheadLabels,
        committedIndex,
    } = options;

    const open = ref(false);
    const pointer = ref(-1);

    // Whether the CLEAR ENTRY holds the highlight. Guarded on all three legs by
    // `clearHighlighted`: the flag itself, the pointer parked at -1 (an option hover moves
    // the pointer without touching this flag, which must instantly un-highlight the entry),
    // and the entry still rendering (`clearLabel` can be withdrawn reactively while
    // highlighted). The entry check runs FIRST so a select without a clear entry settles
    // the computed on its own leg.
    const clearActive = ref(false);
    const clearHighlighted = computed(() => clearEntry() && clearActive.value && pointer.value === -1);
    const clearId = computed(() => `${id()}-clear`);
    /** Move the highlight onto the clear entry (keyboard slot above index 0, or hover). */
    const highlightClear = () => {
        clearActive.value = true;
        pointer.value = -1;
    };

    // The one dismissal step every consumer needs: close the list AND reset the highlight.
    // Owned here so a future consumer cannot forget the `-1` — a stale pointer would resurface
    // as a phantom highlight (and a phantom aria-activedescendant) on the next open. The
    // composable still never calls this on commit: closing after a commit stays the caller's
    // decision (`onCommit`).
    let typed = '';
    // The first key, folded. Not `typed[0]`: a fold can be two code units (İ → i̇).
    let first = '';
    let keys = 0;
    // Whether every key in `typed` is its first character — kept as a flag, so a held key costs the
    // same on every repeat instead of re-scanning a run that key repeat grows without limit. True
    // whenever `typed` is empty: it starts so, and `dropTyped` empties both together.
    let repeated = true;
    let typedTimer: ReturnType<typeof setTimeout> | undefined;
    const dropTyped = () => {
        clearTimeout(typedTimer);
        typed = '';
        keys = 0;
        repeated = true;
    };

    // `open` is written here and nowhere else: it leaves the composable read-only, so every close
    // passes through the one place that drops the highlight and the typed string (WR-1991).
    const openList = () => {
        open.value = true;
    };
    const close = () => {
        open.value = false;
        clearActive.value = false;
        pointer.value = -1;
        dropTyped();
    };
    const toggle = () => {
        if (open.value) close();
        else openList();
    };

    // A key is typeahead when it prints one character with no command modifier. Characters are
    // counted as `fold` counts them, by code point, so 🍎 is one and a named key such as Enter is not.
    // Space counts only inside a string already being typed — on its own it keeps its open/toggle meaning.
    const isTypeahead = (event: KeyboardEvent): boolean =>
        Array.from(event.key).length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        (event.key !== ' ' || typed !== '');

    // Folded once per change of the labels, not on every key a held, matching-nothing key repeats.
    const foldedLabels = computed(() => typeaheadLabels().map(fold));

    /**
     * The WAI-ARIA listbox typeahead, with native <select> parity: the typed string grows while keys
     * arrive within TYPEAHEAD_RESET_MS; a single character (or the same character repeated) moves
     * to the NEXT option starting with it, so repeating it cycles; a longer string matches by
     * prefix from the current option, so a highlight that still matches stays put. With nothing
     * highlighted, "current" is the committed option (`committedIndex`). The search
     * wraps, compares case-insensitively, and moves nothing when no option matches. Returns
     * whether it found one.
     */
    const typeahead = (key: string, labels: string[]): boolean => {
        clearTimeout(typedTimer);
        typedTimer = setTimeout(dropTyped, TYPEAHEAD_RESET_MS);

        const character = fold(key);
        if (typed === '') first = character;
        repeated = repeated && character === first;
        if (keys < TYPEAHEAD_MAX_LENGTH) {
            typed += character;
            keys++;
        }

        const needle = repeated ? first : typed;
        const from = pointer.value >= 0 ? pointer.value : committedIndex();
        const start = repeated ? from + 1 : Math.max(from, 0);
        for (let step = 0; step < labels.length; step++) {
            const index = (start + step) % labels.length;
            if (labels[index].startsWith(needle)) {
                clearActive.value = false;
                pointer.value = index;
                return true;
            }
        }
        return false;
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
    // (a reactive `options` prop reloading), leaving `pointer`
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
        if (isTypeahead(event)) {
            event.preventDefault();
            // Closed, a match OPENS the list on it (the APG select-only combobox), never commits.
            if (typeahead(event.key, foldedLabels.value) && !open.value) openList();
            return;
        }
        if (!open.value) {
            if (openKeys(event.key)) {
                event.preventDefault();
                openList();
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
                } else if (pointer.value === -1 && clearEntry()) {
                    // The clear entry owns the keyboard slot between "nothing" and index 0.
                    highlightClear();
                } else {
                    clearActive.value = false;
                    pointer.value = Math.min(pointer.value + 1, listLength() - 1);
                }
                event.preventDefault();
                break;
            case 'ArrowUp':
                if (pointer.value === 0 && clearEntry()) {
                    highlightClear();
                } else {
                    // From the clear entry (pointer -1) this lands on "nothing highlighted".
                    clearActive.value = false;
                    pointer.value = Math.max(pointer.value - 1, -1);
                }
                event.preventDefault();
                break;
            case 'Home':
            case 'End':
                // WR-0521: jump to the first/last option. The trigger is a button, so no modified
                // Home/End has a text meaning to keep (a control with a query input brings that back).
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
                // The commit callbacks own the close decision. The clear entry always commits
                // (null is always legal); an option commit reports whether it happened — its
                // callback owns the read-through-a-local race guard — and only a real commit
                // swallows Enter.
                if (clearHighlighted.value) {
                    onClearCommit();
                    event.preventDefault();
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

    // click-outside — dismisses without a shared directive dependency.
    //
    // `composedPath()`, never `event.target`: at a DOCUMENT listener a click inside a shadow
    // root is retargeted to the shadow HOST, which is an ancestor of `root` rather than a
    // descendant, so `root.contains(target)` rejects it and every click inside would read as
    // outside — the trigger's own click would close the list it just opened. The composed
    // path carries the true chain across shadow boundaries. The popup needs no separate check:
    // it is promoted to the top layer IN PLACE, so it never leaves `root`.
    const onDocumentPointer = (event: MouseEvent) => {
        if (!open.value) return;
        // The listener is attached only between mount and unmount, so the ref is non-null here.
        // Non-null by lifetime (the listener only exists while mounted) — loud, named accessor
        // over a bare `!`: the same impossible state throws, but names the broken assumption.
        if (event.composedPath().includes(ensureRefValueExists(root))) return;
        onDismiss();
    };
    onMounted(() => document.addEventListener('click', onDocumentPointer));
    onBeforeUnmount(() => {
        document.removeEventListener('click', onDocumentPointer);
        dropTyped();
    });

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
        placement,
        middleware: [
            offset(4),
            // flip() falls back to the opposite side; `flipAlignment: false` keeps it from trying
            // the other alignment first (top-end before bottom-start for `top-start`), so the
            // default `bottom-start` falls back to `top-start` exactly as a given one does.
            flip({flipAlignment: false}),
            shift({padding: 8}),
            // `elements.floating` is the `.ui-menu-anchor` box, not the <ul>. Sizing it to the
            // trigger is what keeps `--ui-menu-min-width: 100%` meaning "as wide as the
            // trigger" — the menu's percentage resolves against this box. Without it the
            // anchor is sized by its content (`width: max-content`), so the percentage resolves
            // to the menu's own width and a list of short options paints narrower than its
            // trigger. `min-width`, not `width`, so the anchor still grows when the menu
            // outgrows the trigger.
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
        open: readonly(open),
        pointer,
        listboxId,
        optionId,
        activeDescendant,
        floatingStyles: gatedFloatingStyles,
        onKey,
        close,
        toggle,
        clearHighlighted,
        clearId,
        highlightClear,
    };
};
