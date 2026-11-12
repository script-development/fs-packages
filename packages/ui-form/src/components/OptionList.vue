<template>
    <ul :id="listboxId" class="ui-select__menu" role="listbox" :aria-label="optionsLabel">
        <!-- The committing clear entry (a select's `clearLabel`) renders OUTSIDE the index
             space — its own <li> above the options, its own id (`${id}-clear`), its own highlight
             flag — so every option index below keeps mapping 1:1 onto the parent's list. It is an
             option to assistive tech (role="option" inside the listbox); aria-selected marks the
             committed-null state. -->
        <li
            v-if="clearLabel !== undefined"
            :id="clearId"
            class="ui-select__clear"
            :class="{'is-active': clearActive}"
            role="option"
            :aria-selected="clearSelected"
            @mouseover="emit('clearHover')"
            @click="emit('clearCommit')"
        >
            {{ clearLabel }}
        </li>
        <!-- The empty-state row renders as the SOLE navigable child of the listbox (it only
             shows when there are zero options). A bare <li> here is doubly invalid: role="listbox"
             requires an owned role="option" (axe aria-required-children), and a <li> whose parent
             is a listbox (not a list) trips axe listitem. A presentational role clears the second
             but leaves the listbox with no required child. Rendering the message as a DISABLED
             option (the APG no-results pattern) satisfies both — it is a valid listbox child and
             gives the listbox its required option, while aria-disabled marks it non-selectable
             (the pointer never lands on it — useListbox has no navigable index when empty). -->
        <li v-if="keys.length === 0" class="ui-select__empty" role="option" aria-disabled="true">
            {{ emptyText }}
        </li>
        <!-- The option row itself is the shared `ListboxOption`; the index-scoped `option` slot
             forwards through so `T` never crosses this boundary — the parent re-scopes the index
             into its typed payload and owns the slotless fallback (the labelOf text).
             Highlight/selection chrome stays on the <li> inside ListboxOption, outside the slot, so
             custom content never re-creates it. -->
        <ListboxOption
            v-for="(key, index) in keys"
            :key="key"
            :index="index"
            :option-id="optionId"
            :active="pointer === index"
            :muted="isMuted(index)"
            :selected="isSelected(index)"
            @hover="emit('hover', $event)"
            @commit="emit('commit', $event)"
        >
            <slot name="option" :index="index" />
        </ListboxOption>
    </ul>
</template>

<script setup lang="ts">
import ListboxOption from './ListboxOption.vue';

/**
 * The listbox popup of the ui-form select — INTERNAL, deliberately not exported from the barrel
 * (like `useListbox`, its behavioural twin). Where the composable owns behaviour, this component
 * owns markup: the `<ul>/<li>` body carrying the `role="listbox"` / `role="option"` /
 * position-keyed `optionId` / committed-value `aria-selected` semantics.
 *
 * Entirely index-based, mirroring `useListbox`: the option type `T` never crosses this
 * boundary. The parent hands down `keys` derived from ITS list (SingleSelect's `sorted`) plus
 * index-keyed lookups, and receives `hover`/`commit` back by index — the parent stays the sole
 * owner of `pointer` and of the commit disposition. Per-option content flows through the
 * index-scoped `option` slot; the clear entry (`clear*` props) sits above the list, outside the
 * index space.
 *
 * The single `<ul>` root is LOAD-BEARING: the floating element is the parent's
 * `.ui-menu-anchor` wrapper, promoted to the top layer in place (KD-1136) — floating-ui positions
 * the ANCHOR and sizes it to the trigger, and this `<ul>` is a static box inside it. That is what
 * keeps `--ui-menu-min-width: 100%` resolving against the trigger rather than against the menu's
 * own width. This component renders no positioning of its own and takes no floating-ui styles.
 */
const {
    keys,
    pointer,
    listboxId,
    optionId,
    isSelected,
    isMuted,
    optionsLabel,
    emptyText,
    clearLabel,
    clearId,
    clearActive = false,
    clearSelected = false,
} = defineProps<{
    /** stable `v-for` keys (stringified option ids), indexed by option index — one per option, in
     *  the parent's list order. */
    keys: string[];
    /** the highlighted index (`-1` for none) — owned by the parent, moved via `hover`. */
    pointer: number;
    /** the listbox `id` the trigger's `aria-controls` points at. */
    listboxId: string;
    /** position-keyed option-id scheme from `useListbox` (`${id}-opt-${index}`). */
    optionId: (index: number) => string;
    /** whether the option at an index is the COMMITTED value (`aria-selected`), never the pointer. */
    isSelected: (index: number) => boolean;
    /** whether the option at an index is visually MUTED (`.is-muted`) — still committable. */
    isMuted: (index: number) => boolean;
    /** accessible name for the listbox popup (`aria-label`). */
    optionsLabel: string;
    /** shown when there are no navigable options. */
    emptyText: string;
    /** display string of the committing clear entry — absent means no entry renders. */
    clearLabel?: string;
    /** the clear entry's activedescendant id (`${id}-clear`, from `useListbox`). */
    clearId?: string;
    /** whether the clear entry holds the highlight (`useListbox.clearHighlighted`). */
    clearActive?: boolean;
    /** whether the clear entry is the COMMITTED state (`aria-selected` — model is null). */
    clearSelected?: boolean;
}>();

const emit = defineEmits<{hover: [index: number]; commit: [index: number]; clearHover: []; clearCommit: []}>();
</script>
