<script lang="ts">
	/**
	 * One fighter, from the roster step: its name, the choice it brings along and
	 * what it carries. A full screen rather than a row, because equipment is three
	 * lists and a phone has no room beside them.
	 */
	import RuleText from '$lib/components/RuleText.svelte';
	import { ITEMS, WEAPONS, type Ability, type Faction, type Fighter } from '$lib/rules';
	import { equipmentCost, gearOf, isAscended, isBeast, isThrall, offers, type Offer } from '$lib/build/equipment';
	import { profileOf } from '$lib/build/profile';
	import { recruitmentFee } from '$lib/build/roster';
	import type { Draft, DraftFighter } from '$lib/build/types';
	import { STAT_KEYS } from '$lib/types/warband';

	interface Props {
		faction: Faction;
		draft: Draft;
		entry: DraftFighter;
		fighter: Fighter;
		onclose: () => void;
		onremove: () => void;
	}

	/* `entry` is written here – the name, the choice, the gear – so it is bound
	   rather than passed: a prop mutated in place leaves the parent's copy and
	   this one to drift apart. */
	let { faction, draft, entry = $bindable(), fighter, onclose, onremove }: Props = $props();

	const groups = $derived(offers(faction, fighter, entry.equipment));
	const profile = $derived(profileOf(faction, draft, entry, fighter));
	const fee = $derived(recruitmentFee(faction, draft, entry.fighterId));
	const spent = $derived(equipmentCost(entry.equipment));
	const choice = $derived(fighter.choose);
	const ability = $derived(faction.abilities.find((a) => a.id === choice?.source));
	const brought = $derived(gearOf(fighter));
	const beast = $derived(isBeast(fighter));
	const thrall = $derived(isThrall(fighter));
	const ascended = $derived(isAscended(fighter));
	const offered = $derived(
		choice?.kind === 'stat' ? (choice.characteristics ?? []) : (choice?.abilities ?? [])
	);
	const missing = $derived(choice ? entry.choice.length !== choice.pick : false);
	/* What the fighter brings by its profile, as against what the choice adds.
	   Some of it is an instruction carried out while recruiting – "it must make
	   a roll on the mutation table" – so it belongs on this screen, not only on
	   the card the fighter ends up on. */
	const carries = $derived(
		fighter.abilities
			.map((id) => faction.abilities.find((entry) => entry.id === id))
			.filter((entry): entry is Ability => Boolean(entry))
	);

	/* The container of the options, whichever shape they took. */
	let chips: HTMLElement | undefined = $state();
	let focused = false;

	/* A fighter that brings a choice opens on it. Recruiting was the tap; the
	   choice is what the sheet is open for, and it sits below the fold. */
	$effect(() => {
		if (focused || !missing || !chips) return;
		const first = chips.querySelector('button');
		if (!first) return;
		focused = true;
		first.focus();
		first.scrollIntoView({ block: 'center' });
	});

	function take(offer: Offer) {
		if (offer.refused) return;
		entry.equipment = [...entry.equipment, offer.id];
	}

	/** Drops one copy, so a dual wielded pair loses one club rather than both. */
	function drop(index: number) {
		entry.equipment = entry.equipment.filter((_, at) => at !== index);
	}

	/* The offers first, then the two tables: fixed gear is never on offer, so a
	   Giant Rat's teeth would otherwise read as "vicious-teeth". */
	function label(id: string): string {
		return (
			groups.melee.find((o) => o.id === id)?.name ??
			groups.ranged.find((o) => o.id === id)?.name ??
			groups.armour.find((o) => o.id === id)?.name ??
			WEAPONS.get(id)?.name ??
			ITEMS.get(id)?.name ??
			id
		);
	}

	/** What a chip says: a characteristic with its bonus. */
	function optionLabel(option: string): string {
		return `${option} +${choice?.bonus}`;
	}

	/** The ability behind one option of a choice, for its name and its sentence. */
	function optionAbility(option: string): Ability | undefined {
		return faction.abilities.find((entry) => entry.id === option);
	}

	function pick(value: string) {
		const held = entry.choice.includes(value);
		if (held) entry.choice = entry.choice.filter((picked) => picked !== value);
		else if (entry.choice.length < (choice?.pick ?? 0)) entry.choice = [...entry.choice, value];
		/* At the limit a tap replaces the oldest pick, so the only way forward is
		   not to first work out what to untick. */
		else entry.choice = [...entry.choice.slice(1), value];
	}
</script>

<div class="sheet">
	<header>
		{#if missing}
			<!-- No way back while the choice is open: leaving would file a fighter
			     the rules do not allow, and the roster would carry the complaint
			     instead of the screen that can settle it. -->
			<span class="back" aria-hidden="true"></span>
		{:else}
			<button class="back" onclick={onclose} aria-label="Back to the roster">
				<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M15 5l-7 7 7 7" />
				</svg>
			</button>
		{/if}
		<h2>{fighter.name}</h2>
		<span class="fee">{fee + spent} gc</span>
	</header>

	<div class="body">
		<label class="named">
			<span>Name</span>
			<input bind:value={entry.name} placeholder={fighter.name} maxlength="28" />
		</label>

		<p class="profile">
			{#each STAT_KEYS as key (key)}
				<span class:raised={profile[key] !== fighter.profile[key]}>
					{key.slice(0, 2).toUpperCase()} {profile[key]}{key === 'bravery' ? '+' : ''}
				</span>
			{/each}
		</p>

		{#if carries.length}
			<section>
				<h3>Abilities</h3>
				<ul class="abilities">
					{#each carries as own (own.id)}
						<li>
							<span class="name">{own.name}</span>
							<span class="text"><RuleText text={own.text} /></span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if choice}
			<section class="choice" class:needs={missing}>
				<h3>{ability?.name ?? 'Choose'}</h3>
				<p class="hint">{ability?.text ?? choice.prompt}</p>
				{#if choice.kind === 'stat'}
					<div class="chips" bind:this={chips}>
						{#each offered as option (option)}
							{@const on = entry.choice.includes(option)}
							<button class="chip" class:on aria-pressed={on} onclick={() => pick(option)}>
								{optionLabel(option)}
							</button>
						{/each}
					</div>
				{:else}
					<!-- A stat needs no explaining – "fight +1" is the whole of it. An
					     ability is a paragraph, and picking one of three without reading
					     them is not a choice, so each option carries its own text. -->
					<ul class="options" bind:this={chips}>
						{#each offered as option (option)}
							{@const on = entry.choice.includes(option)}
							{@const offer = optionAbility(option)}
							<li>
								<button class:on aria-pressed={on} onclick={() => pick(option)}>
									<span class="name">{offer?.name ?? option}</span>
									{#if offer}<span class="text"><RuleText text={offer.text} /></span>{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
				{#if missing}
					<p class="open">Pick {choice.pick} to carry on.</p>
				{/if}
			</section>
		{/if}

		<section>
			<h3>Carried</h3>
			{#if brought.length || entry.equipment.length}
				<ul class="carried">
					<!-- What the fighter was recruited with stands first and has no way off:
					     a Giant Rat cannot put down its teeth. -->
					{#each brought as id, index (`${id}-${index}`)}
						<li class="brought">
							<span>{label(id)}</span>
						</li>
					{/each}
					{#each entry.equipment as id, index (`${id}-${index}`)}
						<li>
							<span>{label(id)}</span>
							<button class="drop" onclick={() => drop(index)} aria-label="Put down {label(id)}">
								<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
									<path d="M6 6l12 12M18 6L6 18" />
								</svg>
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">Nothing yet – unarmed.</p>
			{/if}
		</section>

		{#if beast}
			<!-- Three lists in which every row refuses for the same reason are three
			     lists nobody reads. The reason is said once, where the lists would
			     have been, so the empty section is not a puzzle. -->
			<section>
				<h3>Equipment</h3>
				<p class="hint">A BEAST fights with what is on its profile.</p>
			</section>
		{:else if thrall}
			<section>
				<h3>Equipment</h3>
				<p class="hint">A THRALL cannot be given weapons, armour or equipment.</p>
			</section>
		{:else if ascended}
			<section>
				<h3>Equipment</h3>
				<p class="hint">An Ascended fighter refuses weapons, armour and equipment.</p>
			</section>
		{:else}
			{#each [['Melee', groups.melee], ['Ranged', groups.ranged], ['Armour', groups.armour]] as const as [title, list] (title)}
				{#if list.length}
					<section>
						<h3>{title}</h3>
						<ul class="offers">
							{#each list as offer (offer.id)}
								<li>
									<button disabled={Boolean(offer.refused)} onclick={() => take(offer)}>
										<span class="name">{offer.name}</span>
										<span class="cost">{offer.cost} gc</span>
										{#if offer.refused}<span class="why">{offer.refused}</span>{/if}
									</button>
								</li>
							{/each}
						</ul>
					</section>
				{/if}
			{/each}
		{/if}

		<button class="remove" onclick={onremove}>Dismiss this fighter</button>
	</div>

	<nav class="foot">
		<button class="done" disabled={missing} onclick={onclose}>
			{missing ? 'Choose first' : 'Done'}
		</button>
	</nav>
</div>

<style>
	.sheet {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		background: var(--ui-header-bg);
	}

	header {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
		padding: 10px 12px;
		border-bottom: 1px solid var(--ui-border);
	}

	h2 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: var(--ui-t-xl);
		font-weight: 600;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.fee {
		flex: none;
		font-size: var(--ui-t-md);
		font-weight: 600;
		color: var(--ui-accent-text);
	}

	.back,
	.drop {
		display: flex;
		align-items: center;
		justify-content: center;
		/* 44px, the smallest target a thumb hits reliably. */
		width: 44px;
		height: 44px;
		margin: -10px 0 -10px -10px;
		border: 0;
		background: none;
		color: var(--ui-text);
	}

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 14px 12px 20px;
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.named {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: var(--ui-t-sm);
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ui-text-subtle);
	}

	input {
		padding: 11px 12px;
		font-size: var(--ui-t-md);
		letter-spacing: normal;
		text-transform: none;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	.profile {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin: 0;
	}

	.profile span {
		padding: 5px 9px;
		font-size: var(--ui-t-base);
		font-variant-numeric: tabular-nums;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 7px;
	}

	.profile .raised {
		color: var(--ui-accent-text);
		background: var(--ui-accent-bg);
		border-color: var(--ui-accent);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	h3 {
		margin: 0;
		font-size: var(--ui-t-sm);
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ui-text-subtle);
	}

	.hint {
		margin: 0;
		font-size: var(--ui-t-base);
		line-height: 1.5;
		color: var(--ui-text-muted);
	}

	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.chip {
		padding: 9px 13px;
		font-size: var(--ui-t-md);
		text-transform: capitalize;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	.chip.on {
		color: var(--ui-accent-text);
		background: var(--ui-accent-bg);
		border-color: var(--ui-accent);
	}

	/* An option that carries a paragraph: the name on its own line, the sentence
	   under it, the whole row the target. */
	.options button {
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
		padding: 11px 12px;
		text-align: left;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	.options button.on {
		background: var(--ui-accent-bg);
		border-color: var(--ui-accent);
	}

	.options .name,
	.abilities .name {
		font-size: var(--ui-t-lg);
	}

	.options button.on .name {
		color: var(--ui-accent-text);
	}

	.options .text,
	.abilities .text {
		font-size: var(--ui-t-base);
		line-height: 1.5;
		/* The rules write their own line breaks – a list of effects under one
		   ability – and they are what makes the paragraph readable. */
		white-space: pre-line;
		color: var(--ui-text-muted);
	}

	.abilities li {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px 12px;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.carried li {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 4px 4px 4px 12px;
		font-size: var(--ui-t-lg);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	.carried li span {
		flex: 1;
	}

	/* No button to take it off, so the row holds the height its neighbours get
	   from theirs. */
	.carried li.brought {
		min-height: 44px;
		padding-right: 12px;
		color: var(--ui-text-muted);
	}

	.drop {
		margin: 0;
		width: 40px;
		height: 36px;
		color: var(--ui-text-muted);
	}

	.offers button {
		display: flex;
		align-items: baseline;
		gap: 8px;
		width: 100%;
		padding: 11px 12px;
		font-size: var(--ui-t-lg);
		text-align: left;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	.offers button:disabled {
		/* Muted rather than subtle: at 15px on this background the subtle grey
		   stands at 3.5:1, below AA, where the muted one holds 6.6:1. */
		color: var(--ui-text-muted);
		background: none;
	}

	.offers .name {
		flex: 1;
	}

	.offers .cost {
		flex: none;
		font-size: var(--ui-t-base);
		font-variant-numeric: tabular-nums;
		color: var(--ui-text-muted);
	}

	.offers .why {
		/* Allowed to shrink and wrap. Held at its intrinsic width it pushed the
		   row past the container as soon as a refusal ran long. */
		flex: 0 1 auto;
		min-width: 0;
		text-align: right;
		font-size: var(--ui-t-xs);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		/* A full hand is a state, not a warning, and on most rows at once: the
		   signal colour turned the list into a wall of orange. It also missed
		   AA here at 3.4:1, against 6.6:1 for this one. */
		color: var(--ui-text-muted);
	}

	/* The one open decision on the screen, marked where it is rather than in a
	   list underneath: the box is what the Done button is waiting for. */
	.choice.needs {
		padding: 10px 12px;
		margin: -10px -12px;
		background: var(--ui-warn-bg);
		border: 1px solid var(--ui-warn);
		border-radius: 10px;
	}

	.open {
		margin: 0;
		font-size: var(--ui-t-base);
		color: var(--ui-text);
	}

	.foot {
		display: flex;
		flex: none;
		padding: 10px 12px;
		padding-bottom: max(10px, env(safe-area-inset-bottom));
		background: var(--ui-header-bg);
		border-top: 1px solid var(--ui-border);
	}

	.done {
		flex: 1;
		padding: 13px;
		font-size: var(--ui-t-lg);
		font-weight: 600;
		color: #fff;
		background: var(--ui-accent);
		border: 0;
		border-radius: 10px;
	}

	.done:disabled {
		color: var(--ui-text-muted);
		background: var(--ui-surface);
	}

	.remove {
		margin-top: 6px;
		padding: 12px;
		font-size: var(--ui-t-md);
		color: var(--ui-text-muted);
		background: none;
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}
</style>
