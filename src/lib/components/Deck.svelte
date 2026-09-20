<script lang="ts">
	import FighterCard from './FighterCard.svelte';
	import type { FighterCardData } from '../types/card';

	let { cards }: { cards: FighterCardData[] } = $props();

	let track: HTMLDivElement | undefined = $state();
	let current = $state(0);

	/**
	 * Zwei Scroll-Achsen: horizontal wechselt den Kämpfer, vertikal scrollt in
	 * einem Kämpfer. Getrennt werden sie über `scroll-snap` auf der Spur und
	 * `overscroll-behavior: contain` in der einzelnen Karte.
	 */
	function onScroll() {
		if (!track) return;
		const index = Math.round(track.scrollLeft / track.clientWidth);
		current = Math.max(0, Math.min(cards.length - 1, index));
	}

	function goto(index: number) {
		if (!track) return;
		track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
	}
</script>

<div class="deck">
	<div class="track" bind:this={track} onscroll={onScroll}>
		{#each cards as card (card.instanceId)}
			<div class="pane">
				<FighterCard {card} />
			</div>
		{/each}
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

	.track {
		flex: 1;
		display: flex;
		min-height: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		scrollbar-width: none;
		/* Nicht in die Seite darunter durchziehen. */
		overscroll-behavior-x: contain;
	}

	.track::-webkit-scrollbar {
		display: none;
	}

	.pane {
		flex: 0 0 100%;
		scroll-snap-align: center;
		scroll-snap-stop: always;
		min-width: 0;
		padding: 0 10px;
		overflow-y: auto;
		/* Vertikales Scrollen bleibt in der Karte und löst keinen Seitenwechsel aus. */
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
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
