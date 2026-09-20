<script lang="ts">
	import { onMount } from 'svelte';

	import FighterCard from './FighterCard.svelte';
	import type { FighterCardData } from '../types/card';

	let { cards }: { cards: FighterCardData[] } = $props();

	/** Dauer des Wegfliegens; dieselbe Zahl steuert Übergang und Umschaltpunkt. */
	const FLY = 260;
	/** Anteil der Breite, ab dem die Karte losgelassen wegfliegt statt zurückzufedern. */
	const DISTANCE = 0.25;
	/** Flicken: ab dieser Geschwindigkeit in px/ms zählt auch ein kurzer Weg. */
	const VELOCITY = 0.5;

	let stack: HTMLDivElement | undefined = $state();
	let current = $state(0);
	/** Waagerechter Versatz der obersten Karte am Finger. */
	let dx = $state(0);
	let dragging = $state(false);
	/** Richtung, in die die Karte gerade wegfliegt: -1 links, 1 rechts, 0 = sie liegt. */
	let leaving = $state(0);
	let reduced = $state(false);

	let pointer: number | null = null;
	let startX = 0;
	let startTime = 0;
	let captured = false;

	const wrap = (index: number) => ((index % cards.length) + cards.length) % cards.length;

	/**
	 * Unter der obersten Karte liegt die, auf die die aktuelle Richtung zeigt:
	 * nach links der nächste Kämpfer, nach rechts der vorige. Der Stapel ist
	 * geschlossen – hinter dem letzten kommt wieder der erste.
	 */
	const beneath = $derived(cards.length > 1 ? wrap(current + (dx > 0 ? -1 : 1)) : -1);

	const duration = $derived(reduced ? 0 : FLY);

	const transform = $derived(
		leaving
			? `translateX(${leaving * 125}%) rotate(${leaving * 18}deg)`
			: `translateX(${dx}px) rotate(${dx * 0.04}deg)`
	);

	/** Die darunter liegende Karte wächst auf volle Größe, während die obere zieht. */
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
		/* Erst wenn klar ist, dass gezogen wird – ein Tippen soll die Karte nicht greifen. */
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
	 * Der Browser übernimmt das senkrechte Scrollen selbst (touch-action: pan-y)
	 * und bricht die Geste dann ab – die halb gezogene Karte gehört zurückgelegt.
	 */
	function onPointerCancel() {
		dragging = false;
		pointer = null;
		dx = 0;
	}

	function fly(direction: -1 | 1) {
		if (leaving) return;
		/* Ohne Zug (Tastatur) fehlt das Vorzeichen, an dem `beneath` die Richtung abliest. */
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
					<FighterCard card={cards[beneath]} />
				</div>
			{/key}
		{/if}

		{#key cards[current].instanceId}
			<div
				class="pane top"
				role="group"
				aria-roledescription="Karte, waagerecht wischen"
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
				<FighterCard card={cards[current]} />
			</div>
		{/key}
	</div>

	<nav class="dots" aria-label="Kämpfer wählen">
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

	/* Ein Zug mit der Maus verschiebt die Karte und markiert dabei keinen Text. */
	.stack.dragging {
		user-select: none;
		-webkit-user-select: none;
	}

	.pane {
		position: absolute;
		inset: 0;
		padding: 0 10px;
		overflow-y: auto;
		/* Senkrechtes Scrollen bleibt in der Karte und zieht die Seite nicht mit. */
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	.top {
		/* Senkrecht scrollt der Browser, waagerecht bleibt für die Wischgeste. */
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
