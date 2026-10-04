<script lang="ts">
	import imageMask from '../image-mask.svg?raw';
	import RuleText from './RuleText.svelte';
	import type { RosterEntry, WarbandCardData } from '../types/card';

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
		{#if card.fluff}
			<p class="fluff">{card.fluff}</p>
		{/if}

		<div class="profile">
			{#each card.tables as rows, i (i)}
				<dl class="stats">
					{#each rows as row (row.key)}
						<dt>{row.label}</dt>
						<dd class:modified={row.modified}>{row.value}</dd>
					{/each}
				</dl>
			{/each}

			<div class="roster">
				{@render group('Heroes', card.roster.heroes)}
				{@render group('Henchmen', card.roster.henchmen)}
			</div>
		</div>

		{#if card.stash}
			<section class="notes"><p class="entry"><strong>Stash</strong>: {card.stash}</p></section>
		{/if}

		{#if card.notes}
			<section class="notes">{@render note(card.notes)}</section>
		{/if}

		{#if card.battles.length}
			<section class="battles">
				<p class="entry"><strong>Battles</strong>: {card.tally}</p>
				<table>
					<!-- The columns speak for themselves on the card; a screen reader
					     needs them named. -->
					<thead class="visually-hidden">
						<tr>
							<th scope="col">Date</th>
							<th scope="col">Opponent</th>
							<th scope="col">Result</th>
						</tr>
					</thead>
					<tbody>
						{#each card.battles as battle (battle.id)}
							<tr>
								<td class="date">{battle.date}</td>
								<td>{battle.opponent}</td>
								<td class="result">{battle.result}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}
	</div>
</article>

<!-- Written on one line: the paragraphs are pre-wrap, so a line break in the
     template would end up on the card. -->
{#snippet note(text: string)}
	<p class="entry"><RuleText text={text} /></p>
{/snippet}

<!-- A group without fighters keeps its heading, so the box always names both ranks. -->
{#snippet group(title: string, entries: RosterEntry[])}
	<section class="group">
		<h3>{title}</h3>
		{#if entries.length}
			<ul>
				{#each entries as entry (entry.instanceId)}
					<li>
						<span class="fighter">{entry.name}</span>
						{#if entry.leader || entry.type}<span class="type">{[entry.leader && 'Leader', entry.type].filter(Boolean).join(' · ')}</span>{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="none">–</p>
		{/if}
	</section>
{/snippet}

<style>
	/* ── Image section ─────────────────────────── */

	/*
	 * The empty field the banderole hangs in, as on the Card Creator's text card,
	 * the banderole 76u down from its top. It stays in the flow, so a name over
	 * more than one line grows the field instead of reaching into the parchment.
	 *
	 * Below it the mask matters: it paints the whole of the background box, which
	 * overhangs the banderole by 50u. Those 50u plus the 30u the stats keep clear
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
		padding: calc(29 * var(--u)) calc(30 * var(--u)) calc(38 * var(--u));
	}

	/* Two boxes side by side and the roster across both below them, the
	   parchment's gap between them and roughly twice that to the boxes further
	   down. The two are stretched to the taller one, so a box with a row less
	   keeps it empty at its foot. */
	.profile {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: calc(14 * var(--u));
		margin-bottom: calc(16 * var(--u));
	}

	.stats,
	.roster {
		margin: 0;
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: calc(7.5 * var(--u));
		/* The fighter tables' values row: it lifts the green labels to 4.8:1
		   over the texture's mean. */
		background: var(--card-wash);
	}

	/* Labels in a column as wide as the longest, so every value of a box starts
	   on the same edge. Left-aligned, since Standing carries a word. */
	.stats {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-content: start;
		column-gap: calc(12 * var(--u));
		row-gap: calc(4 * var(--u));
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.3;
		/* Grenze Gotisch defaults to old-style figures, which hang below the
		   baseline; the lining set sits on it like the labels, the tabular one
		   keeps the digits of the column over each other. */
		font-variant-numeric: lining-nums tabular-nums;
	}

	.stats dt {
		color: var(--card-green);
	}

	.stats dd {
		margin: 0;
		color: var(--card-ink);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* Gold with unconfirmed purchases, marked the way a changed characteristic
	   is on a fighter's card. */
	.stats .modified {
		color: var(--card-green);
		text-decoration: underline;
		text-decoration-thickness: calc(2 * var(--u));
		text-underline-offset: 0.15em;
	}

	/* Heroes above henchmen, each across the full width in three columns, as far
	   apart as the box is padded. */
	.roster {
		grid-column: 1 / -1;
		display: grid;
		row-gap: calc(14 * var(--u));
	}

	.group h3 {
		margin: 0 0 calc(4 * var(--u));
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		font-weight: inherit;
		line-height: 1.3;
		color: var(--card-green);
	}

	.group ul {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		column-gap: calc(16 * var(--u));
		row-gap: calc(6 * var(--u));
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.group li,
	.none {
		min-width: 0;
		margin: 0;
		font-family: 'Alegreya', serif;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}

	.fighter {
		display: block;
		font-size: calc(18 * var(--t));
	}

	.type,
	.none {
		display: block;
		font-size: calc(15 * var(--t));
		color: var(--card-ink-muted);
	}

	/* Prose, not a rule: no wash, no border, set apart only by the italic. Twice
	   the parchment's own gap below it, so it reads as its own beat rather than
	   running into what follows. */
	.fluff {
		margin: 0 0 calc(14 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		font-style: italic;
		white-space: pre-wrap;
	}

	/* The warband notes carry their own line breaks and dashed lists. */
	.entry {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		white-space: pre-wrap;
	}

	/* The surface sets stash and notes off from the numbers above them, so neither
	   needs a rule of its own. */
	.notes {
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border-radius: calc(7.5 * var(--u));
		background: var(--card-wash-strong);
	}

	/* A log rather than a figure of the warband: no box and no green, a solid
	   rule under the heading and a dashed one under each row, set a step below
	   the notes, and twice the parchment's gap away from them. */
	.battles {
		margin-top: calc(14 * var(--u));
	}

	.battles table {
		width: 100%;
		margin-top: calc(6 * var(--u));
		/* Separate rather than collapsed, so each line belongs to exactly one cell
		   and two of them never meet in the same place. */
		border-collapse: separate;
		border-spacing: 0;
		border-top: 1.5px solid #000;
		font-family: 'Alegreya', serif;
		font-size: calc(16 * var(--t));
		line-height: 1.3;
	}

	.battles td {
		padding: calc(6 * var(--u)) calc(8 * var(--u)) calc(6 * var(--u)) 0;
		border-bottom: 1px dashed #000;
		vertical-align: baseline;
		overflow-wrap: anywhere;
	}

	.battles .date,
	.battles .result {
		width: 1%;
		white-space: nowrap;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.battles .date {
		padding-right: calc(16 * var(--u));
	}

	.battles .result {
		padding-right: 0;
		text-align: right;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: -1px;
		padding: 0;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
</style>
