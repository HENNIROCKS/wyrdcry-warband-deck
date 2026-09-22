<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		label,
		icon,
		children
	}: { label: string; icon: Snippet; children: Snippet } = $props();

	const id = $props.id();

	let trigger: HTMLButtonElement | undefined = $state();
	let menu: HTMLDivElement | undefined = $state();

	/**
	 * A popover lives in the top layer, where the trigger's position is no longer
	 * known to it – the browser centres it instead. So the panel is placed by hand
	 * below the trigger and flush with its right edge, right before it opens.
	 */
	function onBeforeToggle(event: ToggleEvent) {
		if (event.newState !== 'open' || !trigger || !menu) return;
		const rect = trigger.getBoundingClientRect();
		menu.style.top = `${rect.bottom + 6}px`;
		menu.style.right = `${window.innerWidth - rect.right}px`;
	}

	/*
	 * Every entry does something and then the menu is done, so it closes on the
	 * way up from whichever one was pressed. The listener is bound here rather
	 * than in the markup: the panel is a container, not something one clicks, and
	 * an `onclick` on it would claim otherwise.
	 */
	$effect(() => {
		const panel = menu;
		if (!panel) return;
		const close = (event: Event) => {
			if ((event.target as HTMLElement).closest('button, a')) panel.hidePopover();
		};
		panel.addEventListener('click', close);
		return () => panel.removeEventListener('click', close);
	});
</script>

<button
	class="icon-button"
	bind:this={trigger}
	popovertarget={id}
	aria-label={label}
	title={label}
>
	{@render icon()}
</button>

<div
	class="menu"
	bind:this={menu}
	{id}
	popover
	onbeforetoggle={onBeforeToggle}
>
	{@render children()}
</div>

<style>
	.menu {
		/* The UA centres a popover with `inset: 0` and auto margins. */
		position: fixed;
		inset: auto;
		margin: 0;
		min-width: 180px;
		padding: 5px;
		border: 1px solid var(--ui-border);
		border-radius: 11px;
		background: var(--ui-surface);
		color: var(--ui-text);
		box-shadow: 0 12px 28px rgba(0, 0, 0, 0.45);
	}

	.menu:not(:popover-open) {
		display: none;
	}

	/* Entries come from the caller, so they are styled from here. */
	.menu :global(button),
	.menu :global(a) {
		display: block;
		width: 100%;
		padding: 10px 11px;
		border: 0;
		border-radius: 7px;
		background: none;
		font-size: 14px;
		font-weight: 600;
		text-align: left;
		text-decoration: none;
		color: inherit;
	}

	.menu :global(button:hover),
	.menu :global(a:hover) {
		background: var(--ui-surface-2);
	}

	.menu :global(hr) {
		margin: 5px 7px;
		border: 0;
		border-top: 1px solid var(--ui-border);
	}

	/* Round and similar: says what the menu acts on, is not itself an entry. */
	.menu :global(p) {
		margin: 0;
		padding: 8px 11px 6px;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ui-text-subtle);
	}
</style>
