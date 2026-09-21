<script lang="ts">
	import imageMask from '../image-mask.svg?raw';
	import ValueTable from './ValueTable.svelte';
	import { tokenize } from '../markup';
	import type { WarbandCardData } from '../types/card';

	let { card }: { card: WarbandCardData } = $props();

	/* The torn banner shape of the Card Creator's text card. Inlined as a data URL
	   because a mask cannot point at a Svelte import. */
	const mask = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(imageMask)}")`;
</script>

<article class="card">
	<div class="image-section">
		<div class="banderole">
			<div
				class="banderole-bg"
				style="mask-image: {mask}; -webkit-mask-image: {mask};"
			></div>
			<div class="banderole-text">
				<h2 class="name">{card.name}</h2>
				<p class="faction">{card.faction}</p>
			</div>
		</div>
	</div>

	<div class="parchment">
		<div class="profile">
			{#each card.tables as rows, i (i)}
				<ValueTable {rows} />
			{/each}
		</div>

		{#if card.stash}
			<section class="notes"><p class="entry"><strong>Stash</strong>: {card.stash}</p></section>
		{/if}

		{#if card.notes}
			<section class="notes">{@render note(card.notes)}</section>
		{/if}
	</div>
</article>

<!-- Written on one line: the paragraphs are pre-wrap, so a line break in the
     template would end up on the card. -->
{#snippet note(text: string)}
	<p class="entry">{#each tokenize(text) as token, i (i)}{#if token.kind === 'bold'}<strong>{token.value}</strong>{:else if token.kind === 'keyword'}<span class="keyword">{token.value}</span>{:else}{token.value}{/if}{/each}</p>
{/snippet}

<style>
	/* ── Image section ─────────────────────────── */

	/*
	 * The empty field the banderole hangs in, as on the Card Creator's text card,
	 * the banderole 76u down from its top. It stays in the flow, so a name over
	 * more than one line grows the field instead of reaching into the parchment.
	 *
	 * Below it the mask matters: it paints the whole of the background box, which
	 * overhangs the banderole by 50u. Those 50u plus the 30u the tables keep clear
	 * – as much as they keep to the boxes below them – less the 29u the parchment
	 * pads with, make the 51u here.
	 */
	.image-section {
		margin: calc(5 * var(--u)) calc(5 * var(--u)) 0;
		padding: calc(76 * var(--u)) 0 calc(51 * var(--u));
	}

	/* Wider than the card on both sides; the card's overflow cuts the ends off. */
	.banderole {
		position: relative;
		margin: 0 calc(-15 * var(--u));
		padding: calc(4 * var(--u)) calc(50 * var(--u));
	}

	/* Reaches well past the label so the torn edges of the mask land outside it. */
	.banderole-bg {
		position: absolute;
		inset: calc(-50 * var(--u)) 0;
		background: var(--card-green);
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
	}

	.banderole-text {
		position: relative;
		text-align: center;
		font-family: 'Grenze Gotisch', serif;
		color: var(--card-paper);
	}

	/* Free text from the builder: it wraps rather than being cut, and the
	   banderole grows with it. */
	.name {
		margin: 0;
		font-weight: 600;
		font-size: calc(34 * var(--t));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.faction {
		margin: calc(2 * var(--u)) 0 0;
		font-size: calc(20 * var(--t));
		line-height: 1.2;
	}

	/* ── Parchment section ─────────────────────── */

	.parchment {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		padding: calc(29 * var(--u)) calc(38 * var(--u)) calc(38 * var(--u));
	}

	/* The tables read as one block: the parchment's gap between them, roughly
	   twice that to the boxes below. */
	.profile {
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		margin-bottom: calc(16 * var(--u));
	}

	/* The warband notes carry their own line breaks and dashed lists. */
	.entry {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		white-space: pre-wrap;
	}

	/* On the rules pages these sit in backticks, on the site they are chips. */
	.keyword {
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* The surface sets stash and notes off from the numbers above them, so neither
	   needs a rule of its own. */
	.notes {
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border-radius: calc(7.5 * var(--u));
		background: var(--card-wash-strong);
	}
</style>
