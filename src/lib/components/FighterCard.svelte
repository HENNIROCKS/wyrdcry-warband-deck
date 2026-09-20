<script lang="ts">
	import runemarkShape from '../runemark-shape.svg?raw';
	import StatsBox from './StatsBox.svelte';
	import WeaponTable from './WeaponTable.svelte';
	import type { FighterCardData } from '../types/card';

	let { card }: { card: FighterCardData } = $props();

	/* The runemark cuts both the image field and, in the Card Creator, the badge.
	   Inlined as a data URL because a mask cannot point at a Svelte import. */
	const runemark = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(runemarkShape)}")`;
</script>

<article class="card">
	<div class="image-section">
		<div class="image-box">
			<div class="image-inner" style="mask-image: {runemark}; -webkit-mask-image: {runemark};"></div>
		</div>
		<div class="image-header">
			<h2 class="name">{card.name}</h2>
			{#if card.subtitle}<p class="subtitle">{card.subtitle}</p>{/if}
		</div>
	</div>

	<div class="parchment">
		{#if card.unresolved}
			<p class="warn">
				This profile is not in the game data. The warband references
				<code>{card.name}</code> – most likely a newer ruleset.
			</p>
		{/if}

		{#if card.stats.length}
			<StatsBox stats={card.stats} />
		{/if}

		{#if card.weapons.length}
			<WeaponTable weapons={card.weapons} />
		{/if}

		{#each card.entries as entry, i (entry.label + i)}
			<p class="entry"><strong>{entry.label}</strong>: {entry.text}</p>
		{/each}

		{#if card.keywords.length}
			<ul class="keywords">
				{#each card.keywords as keyword (keyword)}
					<li>{keyword}</li>
				{/each}
			</ul>
		{/if}

		<p class="progress">{card.cost} gc · XP {card.xp} · Renown {card.renown}</p>
	</div>
</article>

<style>
	/*
	 * Sizes are written as multiples of --u, one pixel of the printed card, so the
	 * whole thing keeps the Card Creator's proportions at any width. Below roughly
	 * 420px the floor takes over and the type stops shrinking, which costs the
	 * proportions a little and keeps the body copy readable.
	 */
	.card {
		container-type: inline-size;
		--u: max(0.72px, calc(100cqw / var(--card-design-width)));
		display: flex;
		flex-direction: column;
		min-height: 100%;
		background: url('/background.jpg') center center / cover no-repeat;
		color: var(--card-ink);
		border-radius: calc(14 * var(--u));
		overflow: hidden;
	}

	/* ── Image section ─────────────────────────── */

	.image-section {
		display: flex;
		gap: calc(12 * var(--u));
		margin: calc(16 * var(--u)) calc(38 * var(--u)) 0;
	}

	.image-box {
		flex: 0 0 calc(175 * var(--u));
		height: calc(175 * var(--u));
		position: relative;
		top: calc(10 * var(--u));
	}

	/* Same shape as the gold coins badge, cut from the runemark SVG. */
	.image-inner {
		position: absolute;
		inset: 0;
		background: var(--card-green);
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
	}

	.image-header {
		flex: 1 1 auto;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 0 calc(8 * var(--u));
		text-align: center;
	}

	.name {
		margin: 0;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 600;
		font-size: calc(38 * var(--u));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.subtitle {
		margin: calc(4 * var(--u)) 0 0;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--u));
		line-height: 1.3;
		overflow-wrap: anywhere;
	}

	/* ── Parchment section ─────────────────────── */

	.parchment {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		padding: calc(24 * var(--u)) calc(38 * var(--u)) calc(26 * var(--u));
	}

	/* Some descriptions carry their own line breaks and dashed lists. */
	.entry {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--u));
		line-height: 1.3;
		white-space: pre-wrap;
	}

	/* On the printed card a blank line separates the paragraphs, which is wider
	   than the gap between the boxes above them. */
	.entry + .entry {
		margin-top: calc(6 * var(--u));
	}

	.warn {
		margin: 0;
		padding: calc(10 * var(--u)) calc(12 * var(--u));
		border: 1px solid var(--ui-warn);
		border-radius: calc(7.5 * var(--u));
		background: rgba(180, 83, 9, 0.18);
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--u));
		line-height: 1.3;
	}

	/* ── Keywords and footer ───────────────────── */

	.keywords {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: calc(8 * var(--u));
		/* Sits on the card's bottom edge, above the footer line. */
		margin: auto 0 0;
		padding: 0;
		list-style: none;
	}

	.keywords li {
		font-family: 'Alegreya', serif;
		font-size: calc(14 * var(--u));
		line-height: 1;
		text-transform: uppercase;
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-wash);
		padding: calc(7 * var(--u)) calc(14 * var(--u));
	}

	.progress {
		margin: 0;
		text-align: center;
		font-family: 'Alegreya', serif;
		font-size: calc(14 * var(--u));
		color: var(--card-ink-muted);
	}
</style>
