<script lang="ts">
	import { imageFieldMask } from '../image-field-mask';
	import ValueTable from './ValueTable.svelte';
	import WeaponTable from './WeaponTable.svelte';
	import RuleText from './RuleText.svelte';
	import { healthOf } from '../adapter';
	import { FRESH } from '../battle';
	import type { PhotoView } from '../photo';
	import type { CardEntry, CardSection, CardStat, FighterCardData, StatCondition } from '../types/card';
	import type { ZealRuleEffect } from '../rules';
	import type { FighterBattleState, StatKey } from '../types/warband';

	let {
		card,
		state = FRESH,
		wavering = false,
		zeal = [],
		photo = null
	}: {
		card: FighterCardData;
		/** What the fighter carries in the battle. The bar below the deck sets it. */
		state?: FighterBattleState;
		/** Whether the warband's morale is wavering, which asks for a Bravery test. */
		wavering?: boolean;
		/** The Zeal stages the warband has reached, which change every fighter's figures. */
		zeal?: ZealRuleEffect[];
		/** The photo of the painted model, shown in the image field where there is one. */
		photo?: PhotoView | null;
	} = $props();

	/* The card names the state, the bar changes it – one band, the worst of the
	   three, because a fighter out of action is neither waiting nor to be read as
	   having merely acted. */
	const band = $derived(
		state.out ? 'Out of Action' : state.waiting ? 'Waiting' : state.activated ? 'Activated' : ''
	);

	/* While the warband wavers, a fighter must pass a Bravery test when it is first
	   activated. Due until it is marked activated or waiting – it has acted, so it
	   rolled – or panicked, which is what failing it means. A waiting fighter's
	   second activation is not its first, so it asks for no second test. */
	const test = $derived(wavering && !band && !state.panicked);

	/* The quieter bands under the first, top to bottom. Panicked leads because,
	   like the first band, it belongs to the round; heroic and cover hold for the
	   battle. Each takes the next free place, so none leaves a gap. */
	const quiet = $derived(
		[
			state.panicked ? 'Panicked' : '',
			state.heroic ? 'Heroic reaction used' : '',
			state.cover ? 'In cover' : ''
		].filter(Boolean)
	);

	/* What a state of the battle does to the characteristics while it stands.
	   Cover is not among them: it raises the difficulty rating of a ranged
	   attack against the fighter, a number on the attacker's side, and stands
	   under Armour as a situation without a figure – `COVER`. */
	const BATTLE_EFFECTS: {
		state: 'panicked';
		source: string;
		amounts: Partial<Record<StatKey, number>>;
	}[] = [{ state: 'panicked', source: 'Panicked', amounts: { fight: -1, shoot: -1 } }];

	const COVER: StatCondition = {
		source: 'In Cover',
		name: 'In Cover',
		text: 'A ranged attack action against this fighter has its difficulty rating (DR) increased by 1.'
	};

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
			const effects = [
				...BATTLE_EFFECTS.flatMap((effect) => {
					const amount = effect.amounts[stat.key];
					return state[effect.state] && amount
						? [{ kind: 'battle' as const, source: effect.source, amount }]
						: [];
				}),
				...zeal.flatMap((stage) => {
					const amount = stage.amounts[stat.key];
					return amount
						? [{ kind: 'battle' as const, source: `Zeal ${stage.at}: ${stage.label}`, amount }]
						: [];
				})
			];
			const bonus = effects.reduce((sum, layer) => sum + layer.amount, 0);
			const shown = format({ ...stat, value: stat.value - damage + bonus });
			const layers = [
				...stat.layers,
				...(damage ? [{ kind: 'damage' as const, source: 'Damage', amount: -damage }] : []),
				...effects
			];
			const staged = zeal.flatMap((stage) =>
				stage.conditions?.stats.includes(stat.key)
					? [
							{
								source: `Zeal ${stage.at}: ${stage.label}`,
								name: stage.label,
								text: stage.conditions.text,
								amount: stage.conditions.amount
							}
						]
					: []
			);
			const conditions = [
				...(state.cover && stat.key === 'defense' ? [COVER] : []),
				...staged,
				...stat.conditions
			];
			return {
				key: stat.key,
				label: stat.label,
				/* The star says the situation can still change what this figure is worth
				   at the table – a bonus to it, or a cost to whoever attacks the fighter.
				   The tag alone would say only that it was worked out, and those are two
				   different promises. */
				value: shown + (conditions.length ? '*' : ''),
				explanation:
					layers.length > 1 || conditions.length
						? {
								title: stat.label,
								result: shown,
								layers,
								conditions
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
</script>

<article class="card" class:dulled={band !== ''} class:out={state.out} style:--wound={wound}>
	<!-- The test takes the first band's place, which is free by definition while
	     it is due. Something to do this round, like the states that band names,
	     but the card stays undulled: the fighter has not acted yet. -->
	{#if band}
		<p class="band" aria-hidden="true">{band}</p>
	{:else if test}
		<p class="band" aria-hidden="true">Bravery test</p>
	{/if}

	<!-- Bands of their own under the first, because they say different things:
	     the first names what a fighter is doing this round, these what else
	     stands on it. Quieter than the first, which is the state the table reads
	     first. -->
	{#each quiet as label, slot (label)}
		<p class="band quiet" style:--slot={slot} aria-hidden="true">{label}</p>
	{/each}

	<div class="image-section">
		<div class="image-box">
			<div
				class="image-inner"
				class:photo={photo !== null}
				style="mask-image: {imageFieldMask}; -webkit-mask-image: {imageFieldMask};{photo
					? ` --photo: url(${photo.url}); --photo-size: ${photo.size}; --photo-pos: ${photo.position};`
					: ''}"
			></div>
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

		{#if card.fluff}
			<p class="fluff">{card.fluff}</p>
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
			{:else if section.kind === 'equipment'}
				<!-- Titled like the folded sections, but open for good: what the
				     fighter carries is in play. -->
				<p class="divider">
					<span class="rule"></span>
					<span class="legend">Items</span>
					<span class="rule"></span>
				</p>
				<section>{@render paragraphs(section.entries)}</section>
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
		<p class="entry"><strong>{entry.label}</strong>: <RuleText text={entry.text} />{#if entry.note}{' '}<span class="note"><span class="lead"><svg class="check" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 6.5 5 9.5 10 2.5" /></svg>{entry.note.split(' ')[0]}</span><RuleText text={entry.note.slice(entry.note.split(' ')[0].length)} /></span>{/if}</p>
	{/each}
{/snippet}

<style>
	/* ── Image section ─────────────────────────── */

	.image-section {
		display: flex;
		gap: calc(12 * var(--u));
		margin: calc(16 * var(--u)) calc(38 * var(--u)) 0 calc(30 * var(--u));
	}

	.image-box {
		flex: 0 0 calc(175 * var(--u));
		height: calc(175 * var(--u));
		position: relative;
		top: calc(10 * var(--u));
	}

	/* Same shape as the gold coins badge, cut from the image field mask. The blood
	   stands in it as high as the damage the fighter holds, with a hard edge: a
	   level is read off at a glance, a blend has to be compared to something.
	   Over a photo the blood is translucent, denser the more Health is lost. */
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

	.image-inner.photo {
		background:
			linear-gradient(
				to top,
				color-mix(in srgb, var(--card-blood) calc(30% + var(--wound, 0) * 70%), transparent) 0 calc(var(--wound, 0) * 100%),
				transparent calc(var(--wound, 0) * 100%) 100%
			),
			var(--photo) var(--photo-pos) / var(--photo-size) no-repeat,
			var(--card-green);
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
		/* Deep at the foot: the last thing on a card is a fold, and a fold that
		   ends flush with the card ends flush with the battle bar under it. The
		   room is what a thumb needs to hit it without the bar catching the tap. */
		padding: calc(24 * var(--u)) calc(30 * var(--u)) calc(72 * var(--u));
	}

	/* The app speaking, not the rulebook – set apart so it is not read as part of
	   the rule above it. */
	.note {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	/* The tick and the first word wrap as one, so the tick never ends a line
	   on its own. */
	.lead {
		white-space: nowrap;
	}

	/* Drawn rather than typed, so it does not depend on the card's fonts
	   carrying a tick. */
	.check {
		/* Tailwind's preflight sets every svg to block. */
		display: inline;
		width: 0.8em;
		height: 0.8em;
		margin-right: 0.25em;
		vertical-align: -0.05em;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.8;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.keywords {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: calc(8 * var(--u));
		/* Parts the fighter's name from the profile more than the parchment's own
		   gap does, so the chips read with the heading above rather than the
		   characteristics below. */
		margin: calc(16 * var(--u)) 0;
		padding: 0;
		list-style: none;
	}

	/* Prose, not a rule: no wash, no border, set apart only by the italic. Extra
	   room above it, on top of the parchment's own padding, so it reads as its
	   own beat rather than sitting flush under the image section. Below it the
	   parchment's own gap is enough – the keywords follow close. */
	.fluff {
		margin: calc(14 * var(--u)) 0 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		font-style: italic;
		white-space: pre-wrap;
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

	summary,
	.divider {
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

	.divider {
		margin: calc(10 * var(--t)) 0;
		cursor: auto;
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

	/* The bands measure from the card, and the card clips them. Without this they
	   would hang off `.pane` instead, which scrolls rather than clips – a band is
	   wider than the card it lies across, so the deck would scroll sideways. */
	.card {
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

	/* The same ribbon, held back: half the type size, a thinner ink and no second
	   pair of rules, so the state of the round keeps the eye and this one is read
	   after it rather than with it.

	   `top` adds the first band's own box – its padding, line height and border –
	   plus a fixed clearance, rather than naming a unit offset of its own: below
	   529px card width `--t` floors while `--u` keeps shrinking, so a flat number
	   that clears the box at one width closes the gap at another. Each further
	   `--slot` carries the sum on by one quiet band's box – 8u padding, 21t type,
	   2px border – and the same 8u clearance. */
	.band.quiet {
		top: calc(
			(94 + 16 * var(--slot)) * var(--u) + (40 + 21 * var(--slot)) * var(--t) +
				(2 + 2 * var(--slot)) * 1px
		);
		padding: calc(4 * var(--u)) 0;
		background: rgba(18, 18, 22, 0.58);
		border-top-color: transparent;
		border-bottom-color: transparent;
		font-size: calc(21 * var(--t));
		letter-spacing: 0.05em;
	}

	.card.out .band.quiet {
		background: rgba(18, 18, 22, 0.58);
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
