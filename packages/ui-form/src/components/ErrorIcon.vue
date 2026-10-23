<template>
    <!-- the in-input error icon; decorative, the message itself is read via aria-describedby -->
    <svg class="ui-input__icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path
            fill="currentColor"
            fill-rule="evenodd"
            d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0zM7.1 4.4a.9.9 0 0 1 1.8 0v4.2a.9.9 0 0 1-1.8 0zM8 10.5a1.1 1.1 0 1 1 0 2.2 1.1 1.1 0 0 1 0-2.2z"
        />
    </svg>
</template>

<script setup lang="ts">
// Shown inside a text-like control while it shows invalid (the text-like controls). Internal: not exported.
</script>
