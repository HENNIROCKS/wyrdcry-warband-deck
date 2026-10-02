<script lang="ts">
	import '../app.css';

	let { children } = $props();
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
