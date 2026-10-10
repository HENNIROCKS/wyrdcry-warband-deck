<!-- Switches the interface to the other mode and keeps the choice. Like the Card
     Creator's, it names the mode it switches to, with that mode's sign. -->
<script lang="ts">
	import { theme } from '$lib/theme.svelte';
</script>

<button class="pill" onclick={() => theme.toggle()}>
	{#if theme.current === 'dark'}
		<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true">
			<circle cx="8" cy="8" r="2.8" />
			<path d="M8 1v1.8M8 13.2V15M1 8h1.8M13.2 8H15M3.1 3.1l1.3 1.3M11.6 11.6l1.3 1.3M3.1 12.9l1.3-1.3M11.6 4.4l1.3-1.3" />
		</svg>
		Light mode
	{:else}
		<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
			<path d="M13.5 10.5A6 6 0 0 1 5.5 2.5a.5.5 0 0 0-.6-.6A6.5 6.5 0 1 0 14.1 11.1a.5.5 0 0 0-.6-.6z" />
		</svg>
		Dark mode
	{/if}
</button>
