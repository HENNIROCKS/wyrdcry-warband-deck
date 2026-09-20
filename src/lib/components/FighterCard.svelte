<script lang="ts">
	import runemarkShape from '../runemark-shape.svg?raw';
	import StatsBox from './StatsBox.svelte';
	import WeaponTable from './WeaponTable.svelte';
	import { tokenize } from '../markup';
	import type { CardEntry, CardSection, FighterCardData } from '../types/card';

	let { card }: { card: FighterCardData } = $props();

	/* General reference rather than this fighter's own rules: worth having on the
	   card, not worth the room when it is in play. Folded away, with the title in
	   the rule that separates the sections. */
	const COLLAPSIBLE: Partial<Record<CardSection['kind'], string>> = {
		faction: 'Faction Rules',
		universal: 'Universal Abilities'
	};

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

		{#each card.sections as section, i (section.kind)}
			{#if COLLAPSIBLE[section.kind]}
				<details>
					<summary>
						<span class="rule"></span>
						<span class="legend">{COLLAPSIBLE[section.kind]} ({section.entries.length})</span>
						<span class="rule"></span>
						<span class="arrow" aria-hidden="true">&#9656;</span>
					</summary>
					<div class="folded">{@render paragraphs(section.entries)}</div>
				</details>
			{:else}
				{#if i > 0}<hr />{/if}
				<section>
					{#if section.preamble}<p class="entry preamble">{section.preamble}</p>{/if}
					{@render paragraphs(section.entries)}
				</section>
			{/if}
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

<!-- Written on one line: the paragraphs are pre-wrap, so a line break in the
     template would end up on the card. -->
{#snippet paragraphs(entries: CardEntry[])}
	{#each entries as entry, i (entry.label + i)}
		<p class="entry"><strong>{entry.label}</strong>: {#each tokenize(entry.text) as token, j (j)}{#if token.kind === 'bold'}<strong>{token.value}</strong>{:else if token.kind === 'keyword'}<span class="keyword">{token.value}</span>{:else}{token.value}{/if}{/each}</p>
	{/each}
{/snippet}

<style>
	/*
	 * Sizes are written as multiples of --u, one pixel of the printed card, so the
	 * whole thing keeps the Card Creator's proportions at any width.
	 *
	 * Type runs on --t instead, which carries a higher floor. Held at the printed
	 * card's physical width, a phone shows the body copy at an x-height of 8px,
	 * where the reading size of the system is 10px – paper gets away with 5pt,
	 * a display does not. --t buys those two pixels back below 529px card width;
	 * above it both units are the same and the card reads exactly as it prints.
	 *
	 * The one exception is the characteristics labels: six of them share the card
	 * width, and "Bravery" fills 50 of the 50.3px a column has to give. They stay
	 * on --u, smaller than their own values – a column head is read once, its
	 * value constantly.
	 */
	.card {
		container-type: inline-size;
		--u: max(0.72px, calc(100cqw / var(--card-design-width)));
		--t: max(0.9px, calc(100cqw / var(--card-design-width)));
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
		font-size: calc(38 * var(--t));
		line-height: 1.1;
		overflow-wrap: anywhere;
	}

	.subtitle {
		margin: calc(4 * var(--u)) 0 0;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
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
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		white-space: pre-wrap;
	}

	/* A blank line, as on the printed card. */
	.entry + .entry {
		margin-top: 1em;
	}

	/* On the rules pages these sit in backticks, on the site they are chips. */
	.keyword {
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	/* Says the entries below are options, not abilities the fighter all has. */
	.preamble {
		color: var(--card-ink-muted);
	}

	/* Parts the sections, at roughly twice the distance two paragraphs of one
	   section keep – the parchment's own gap comes on top of this margin. */
	hr {
		width: 33%;
		height: 1px;
		margin: calc(10 * var(--t)) auto;
		border: 0;
		background: var(--card-green);
	}

	/* ── Folded sections ───────────────────────── */

	details {
		margin: calc(10 * var(--t)) 0;
	}

	summary {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--t));
		padding: calc(4 * var(--t)) 0;
		cursor: pointer;
		list-style: none;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(18 * var(--t));
		line-height: 1;
		letter-spacing: 0.04em;
		color: var(--card-green);
	}

	summary::-webkit-details-marker {
		display: none;
	}

	.rule {
		flex: 1;
		height: 1px;
		background: var(--card-green);
	}

	.legend {
		flex: 0 1 auto;
	}

	.arrow {
		flex: none;
		font-size: 0.9em;
		transition: transform 120ms ease;
	}

	details[open] .arrow {
		transform: rotate(90deg);
	}

	.folded {
		padding-top: 1em;
	}

	.warn {
		margin: 0;
		padding: calc(10 * var(--u)) calc(12 * var(--u));
		border: 1px solid var(--ui-warn);
		border-radius: calc(7.5 * var(--u));
		background: rgba(180, 83, 9, 0.18);
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
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
		font-size: calc(14 * var(--t));
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
		font-size: calc(14 * var(--t));
		color: var(--card-ink-muted);
	}
</style>
