<script lang="ts">
	import runemarkShape from '../runemark-shape.svg?raw';
	import ValueTable from './ValueTable.svelte';
	import WeaponTable from './WeaponTable.svelte';
	import RuleText from './RuleText.svelte';
	import { healthOf } from '../adapter';
	import { FRESH } from '../battle';
	import type { CardEntry, CardSection, CardStat, FighterCardData } from '../types/card';
	import type { FighterBattleState } from '../types/warband';

	let {
		card,
		state = FRESH
	}: {
		card: FighterCardData;
		/** What the fighter carries in the battle. The bar below the deck sets it. */
		state?: FighterBattleState;
	} = $props();

	/* The card names the state, the bar changes it – one band, the worst of the
	   three, because a fighter out of action is neither waiting nor to be read as
	   having merely acted. */
	const band = $derived(
		state.out ? 'Out of Action' : state.waiting ? 'Waiting' : state.activated ? 'Activated' : ''
	);

	/* How high the blood stands in the image field: a fighter at half its Health is
	   red to half its height. */
	const wound = $derived.by(() => {
		const health = healthOf(card);
		return health > 0 ? Math.min(1, state.damage / health) : 0;
	});

	/** Move carries inches, Bravery a target number – as the printed card writes them. */
	function format(stat: CardStat): string {
		if (stat.key === 'move') return stat.value === 0 ? '0' : `${stat.value}"`;
		if (stat.key === 'bravery') return `${stat.value}+`;
		return String(stat.value);
	}

	/* A value carries an explanation once it is more than the profile value, or
	   once a rule hangs on it that only applies in the right situation.

	   Health counts down with the damage the fighter holds, so the table reads the
	   same figure as the bar below the deck. The damage stands in its layers, and
	   that is what makes the cell offer its explanation while a fighter is
	   wounded. */
	const characteristics = $derived(
		card.stats.map((stat) => {
			const damage = stat.key === 'health' ? Math.min(state.damage, stat.value) : 0;
			const shown = format({ ...stat, value: stat.value - damage });
			const layers = damage
				? [...stat.layers, { kind: 'damage' as const, source: 'Damage', amount: -damage }]
				: stat.layers;
			return {
				key: stat.key,
				label: stat.label,
				/* The star says the figure can still rise – the tag alone would say only
				   that it was worked out, and those are two different promises. */
				value: shown + (stat.conditions.length ? '*' : ''),
				explanation:
					layers.length > 1 || stat.conditions.length
						? {
								title: stat.label,
								result: shown,
								layers,
								conditions: stat.conditions
							}
						: undefined
			};
		})
	);

	/* What the fighter carries out of a game rather than into one. */
	const campaign = $derived([
		{ key: 'cost', label: 'Gold Crowns', value: String(card.cost) },
		{ key: 'xp', label: 'Experience Points', value: String(card.xp) },
		{ key: 'renown', label: 'Renown', value: String(card.renown) }
	]);

	/* General reference rather than this fighter's own rules: worth having on the
	   card, not worth the room when it is in play. Folded away, with the title in
	   the rule that separates the sections. */
	const COLLAPSIBLE: Partial<Record<CardSection['kind'], string>> = {
		faction: 'Faction Rules',
		universal: 'Universal Abilities',
		'universal-reaction': 'Universal Reactions'
	};

	/* The runemark cuts both the image field and, in the Card Creator, the badge.
	   Inlined as a data URL because a mask cannot point at a Svelte import. */
	const runemark = `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(runemarkShape)}")`;
</script>

<article class="card" class:dulled={band !== ''} class:out={state.out} style:--wound={wound}>
	{#if band}
		<p class="band" aria-hidden="true">{band}</p>
	{/if}

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

		{#if card.keywords.length}
			<ul class="keywords">
				{#each card.keywords as keyword (keyword)}
					<li>{keyword}</li>
				{/each}
			</ul>
		{/if}

		<div class="profile">
			{#if characteristics.length}
				<ValueTable rows={characteristics} />
			{/if}

			<ValueTable rows={campaign} />

			{#if card.weapons.length}
				<WeaponTable weapons={card.weapons} />
			{/if}
		</div>

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
			{:else if section.kind === 'notes'}
				<section class="notes">{@render paragraphs(section.entries)}</section>
			{:else}
				{#if i > 0}<hr />{/if}
				<section>
					{#if section.preamble}<p class="entry preamble"><RuleText text={section.preamble} /></p>{/if}
					{@render paragraphs(section.entries)}
				</section>
			{/if}
		{/each}
	</div>
</article>

<!-- Written on one line: the paragraphs are pre-wrap, so a line break in the
     template would end up on the card. -->
{#snippet paragraphs(entries: CardEntry[])}
	{#each entries as entry, i (entry.label + i)}
		<p class="entry"><strong>{entry.label}</strong>: <RuleText text={entry.text} />{#if entry.note}{' '}<span class="note">{entry.note}</span>{/if}</p>
	{/each}
{/snippet}

<style>
	/* ── Image section ─────────────────────────── */

	.image-section {
		display: flex;
		gap: calc(12 * var(--u));
		margin: calc(16 * var(--u)) calc(38 * var(--u)) 0 calc(var(--deck-inset) * var(--u));
	}

	.image-box {
		flex: 0 0 calc(175 * var(--u));
		height: calc(175 * var(--u));
		position: relative;
		top: calc(10 * var(--u));
	}

	/* Same shape as the gold coins badge, cut from the runemark SVG. The blood
	   stands in it as high as the damage the fighter holds, with a hard edge: a
	   level is read off at a glance, a blend has to be compared to something. */
	.image-inner {
		position: absolute;
		inset: 0;
		background: linear-gradient(
			to top,
			var(--card-blood) 0 calc(var(--wound, 0) * 100%),
			var(--card-green) calc(var(--wound, 0) * 100%) 100%
		);
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
		padding: calc(24 * var(--u)) calc(30 * var(--u)) calc(26 * var(--u));
	}

	/* The app speaking, not the rulebook – set apart so it is not read as part of
	   the rule above it. */
	.note {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	.keywords {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: calc(8 * var(--u));
		/* Parts the fighter's name from the profile more than the parchment's own
		   gap does, so the chips read with the heading above rather than the
		   characteristics below. */
		margin: 0 0 calc(16 * var(--u));
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

	/* The three tables read as one block: the parchment's gap between them, roughly
	   twice that to the keywords above and the rules below. */
	.profile {
		display: flex;
		flex-direction: column;
		gap: calc(14 * var(--u));
		margin-bottom: calc(16 * var(--u));
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

	/* The surface sets the player's own text off from the rules above it, so it
	   needs no rule of its own. Denser than the tables' rows: those carry a line of
	   figures, this one carries prose. */
	.notes {
		padding: calc(14 * var(--u)) calc(16 * var(--u));
		border-radius: calc(7.5 * var(--u));
		background: var(--card-wash-strong);
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

	/* ── In-game states ────────────────────────── */

	.card.dulled {
		position: relative;
	}

	/* The whole card dulls, so a fighter who has acted is recognisable while
	   flicking through the stack rather than only when read. */
	.card.dulled::after {
		content: '';
		position: absolute;
		inset: 0;
		background: rgba(18, 18, 22, 0.44);
		pointer-events: none;
		z-index: 1;
	}

	/* Out of action is the same veil in blood rather than ink: at the table the
	   difference between a fighter who has acted and one who is gone has to read
	   from across the board.

	   Deeper than the blood the band is laid in, and darker than the ink veil
	   above: it composites to L 0.15 over the card texture where the ink veil
	   lands at 0.27, and the card's body copy keeps 3.5:1 under it. A red held at
	   the ink veil's own darkness turns the paper pink, which reads as a card
	   picked out rather than one that is done. */
	.card.out::after {
		background: var(--card-blood-veil);
	}

	/*
	 * Across the head of the card rather than its middle: the card scrolls and
	 * grows with its rules, so the middle is off screen on a long one. The image
	 * section is what a swipe brings up first.
	 */
	.band {
		position: absolute;
		top: calc(74 * var(--u));
		left: calc(-10 * var(--u));
		right: calc(-10 * var(--u));
		margin: 0;
		z-index: 2;
		transform: rotate(-8deg);
		padding: calc(6 * var(--u)) 0;
		background: rgba(18, 18, 22, 0.72);
		transition: background 160ms ease;
		border-top: 1px solid var(--card-wash);
		border-bottom: 1px solid var(--card-wash);
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(40 * var(--t));
		line-height: 1;
		letter-spacing: 0.08em;
		text-align: center;
		color: var(--card-paper);
		pointer-events: none;
	}

	.card.out .band {
		background: color-mix(in srgb, var(--card-blood) 82%, transparent);
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
</style>
