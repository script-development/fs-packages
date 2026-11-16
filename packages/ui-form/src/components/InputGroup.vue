<template>
    <span class="ui-input-group">
        <span v-if="prepend" :id="`${id}-prepend`" class="ui-input-group__addon is-start">{{ prepend }}</span>
        <slot />
        <span v-if="append" :id="`${id}-append`" class="ui-input-group__addon is-end">{{ append }}</span>
    </span>
</template>

<script setup lang="ts">
defineProps<{
    /**
     * the control's id. The addons take `${id}-prepend` / `${id}-append`; the control is read with them
     * once its `describedby` names them, after the field's own message.
     */
    id: string;
    /** text joined to the start of the control (`€`). */
    prepend?: string;
    /** text joined to the end of the control (`days`). */
    append?: string;
}>();
</script>
