<script lang="ts">
	import { onMount } from 'svelte';

	import FighterCard from './FighterCard.svelte';
	import WarbandCard from './WarbandCard.svelte';
	import type { DeckCard } from '../types/card';

	let { cards }: { cards: DeckCard[] } = $props();

	/** Duration of the fly-out; the same number drives transition and switch point. */
	const FLY = 260;
	/** Fraction of the width past which a released card flies out instead of springing back. */
	const DISTANCE = 0.25;
	/** Flick: from this speed in px/ms a short distance counts too. */
	const VELOCITY = 0.5;

	let stack: HTMLDivElement | undefined = $state();
	let current = $state(0);
	/** Horizontal offset of the top card under the finger. */
	let dx = $state(0);
	let dragging = $state(false);
	/** Direction the card is flying out in: -1 left, 1 right, 0 = it rests. */
	let leaving = $state(0);
	let reduced = $state(false);

	let pointer: number | null = null;
	let startX = 0;
	let startTime = 0;
	let captured = false;

	const wrap = (index: number) => ((index % cards.length) + cards.length) % cards.length;

	/**
	 * Beneath the top card lies the one the current direction points at: to the
	 * left the next fighter, to the right the previous one. The stack is closed –
	 * behind the last one comes the first again.
	 */
	const beneath = $derived(cards.length > 1 ? wrap(current + (dx > 0 ? -1 : 1)) : -1);

	const duration = $derived(reduced ? 0 : FLY);

	const transform = $derived(
		leaving
			? `translateX(${leaving * 125}%) rotate(${leaving * 18}deg)`
			: `translateX(${dx}px) rotate(${dx * 0.04}deg)`
	);

	/** The card underneath grows to full size while the one above is dragged. */
	const progress = $derived(
		leaving ? 1 : Math.min(1, Math.abs(dx) / ((stack?.clientWidth ?? 320) * DISTANCE))
	);

	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reduced = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	function onPointerDown(event: PointerEvent) {
		if (cards.length < 2 || leaving) return;
		pointer = event.pointerId;
		startX = event.clientX;
		startTime = event.timeStamp;
		captured = false;
		dragging = true;
		dx = 0;
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer) return;
		dx = event.clientX - startX;
		/* Only once it is clear this is a drag – a tap must not grab the card. */
		if (!captured && Math.abs(dx) > 6) {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
			captured = true;
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer) return;
		dragging = false;
		pointer = null;

		const width = stack?.clientWidth ?? 320;
		const velocity = dx / Math.max(1, event.timeStamp - startTime);
		const far = Math.abs(dx) > width * DISTANCE;
		const fast = Math.abs(velocity) > VELOCITY;

		if (far || fast) fly(dx < 0 ? -1 : 1);
		else dx = 0;
	}

	/**
	 * The browser takes over vertical scrolling itself (touch-action: pan-y) and
	 * then cancels the gesture – the half-dragged card belongs back in place.
	 */
	function onPointerCancel() {
		dragging = false;
		pointer = null;
		dx = 0;
	}

	function fly(direction: -1 | 1) {
		if (leaving) return;
		/* Without a drag (keyboard) the sign `beneath` reads the direction from is missing. */
		if (dx === 0) dx = direction;
		leaving = direction;
		setTimeout(() => {
			current = wrap(current + (direction < 0 ? 1 : -1));
			leaving = 0;
			dx = 0;
		}, duration);
	}

	function goto(index: number) {
		if (leaving || index === current) return;
		current = index;
		dx = 0;
	}

	function onKeyDown(event: KeyboardEvent) {
		if (cards.length < 2) return;
		if (event.key === 'ArrowRight') fly(-1);
		else if (event.key === 'ArrowLeft') fly(1);
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="deck">
	<div class="stack" class:dragging bind:this={stack}>
		{#if beneath >= 0}
			{#key cards[beneath].instanceId}
				<div
					class="pane under"
					style:transform="scale({0.94 + 0.06 * progress})"
					style:opacity={0.55 + 0.45 * progress}
					aria-hidden="true"
				>
					{@render card(cards[beneath])}
				</div>
			{/key}
		{/if}

		{#key cards[current].instanceId}
			<div
				class="pane top"
				role="group"
				aria-roledescription="Card, swipe horizontally"
				style:transform
				style:opacity={leaving ? 0 : 1}
				style:transition={dragging
					? 'none'
					: `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${duration}ms ease-out`}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerCancel}
			>
				{@render card(cards[current])}
			</div>
		{/key}
	</div>

	<nav class="dots" aria-label="Choose fighter">
		{#each cards as card, i (card.instanceId)}
			<button
				class="dot"
				class:active={i === current}
				aria-label={card.name}
				aria-current={i === current}
				onclick={() => goto(i)}
			></button>
		{/each}
	</nav>

	<p class="position">{current + 1} / {cards.length}</p>
</div>

{#snippet card(data: DeckCard)}
	{#if data.kind === 'warband'}
		<WarbandCard card={data} />
	{:else}
		<FighterCard card={data} />
	{/if}
{/snippet}

<style>
	.deck {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}

	.stack {
		position: relative;
		flex: 1;
		min-height: 0;
	}

	/* A drag with the mouse moves the card without selecting any text. */
	.stack.dragging {
		user-select: none;
		-webkit-user-select: none;
	}

	.pane {
		position: absolute;
		inset: 0;
		padding: 0 10px;
		overflow-y: auto;
		/* Vertical scrolling stays inside the card and does not drag the page along. */
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	.top {
		/* The browser scrolls vertically, horizontal is left for the swipe gesture. */
		touch-action: pan-y;
		will-change: transform;
		z-index: 1;
	}

	.under {
		overflow: hidden;
		pointer-events: none;
	}

	.dots {
		display: flex;
		justify-content: center;
		flex-wrap: wrap;
		gap: 6px;
		padding: 10px 12px 2px;
	}

	.dot {
		width: 8px;
		height: 8px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: var(--ui-surface-2);
		transition: background 120ms ease, transform 120ms ease;
	}

	.dot.active {
		background: var(--ui-accent-text);
		transform: scale(1.35);
	}

	.position {
		margin: 0;
		padding-bottom: 8px;
		text-align: center;
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		color: var(--ui-text-subtle);
	}
</style>
