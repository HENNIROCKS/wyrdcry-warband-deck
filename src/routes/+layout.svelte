<script lang="ts">
	import { onMount } from 'svelte';

	import '../app.css';
	import { theme } from '$lib/theme.svelte';

	let { children } = $props();

	onMount(() => theme.init());
</script>

<div class="app">
	{@render children()}
</div>

<style>
	.app {
		display: flex;
		flex-direction: column;
		/* The status bar's inset counts into the viewport height rather than on
		   top of it, so the page itself never scrolls. */
		box-sizing: border-box;
		height: 100dvh;
		padding-top: env(safe-area-inset-top);
	}
</style>
