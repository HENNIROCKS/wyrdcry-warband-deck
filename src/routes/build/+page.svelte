<script lang="ts">
	/**
	 * Builds a warband step by step: the faction, its rules, then one fighter
	 * after another. Ends by writing the warband into the same store an import
	 * writes to, so from there on it is a warband like any other.
	 *
	 * The roster is the hub rather than a step in a line. Recruiting is not a
	 * sequence a player walks once – a Warrior is added, the gold runs short, one
	 * goes again – and a wizard that only moves forward would fight that.
	 */
	import { goto, pushState } from '$app/navigation';
	import { base } from '$app/paths';
	import { page } from '$app/state';

	import FighterSheet from '$lib/components/build/FighterSheet.svelte';
	import { toWarband, selectionsOf } from '$lib/build/export';
	import { rulesInPlay } from '$lib/build/effects';
	import { equipmentCost } from '$lib/build/equipment';
	import { budget, goldLeft, problems, recruitable, value } from '$lib/build/roster';
	import type { Draft, DraftFighter } from '$lib/build/types';
	import { RULESET_VERSION } from '$lib/gamedata';
	import { newId } from '$lib/id';
	import { CAMPAIGN, FACTIONS } from '$lib/rules';
	import { putWarband, requestPersistence } from '$lib/storage';
	import type { StoredWarband } from '$lib/types/warband';

	type Step = 'warband' | 'rules' | 'roster' | 'finish';

	const STEPS: { id: Step; title: string }[] = [
		{ id: 'warband', title: 'Warband' },
		{ id: 'rules', title: 'Faction rules' },
		{ id: 'roster', title: 'Fighters' },
		{ id: 'finish', title: 'Finish' }
	];

	const factions = [...FACTIONS.values()];

	let saving = $state(false);
	let failed = $state<string | null>(null);

	/**
	 * Both the step and the open fighter sheet are page state rather than
	 * variables of their own, the same way the deck holds its explanation
	 * overlay. Otherwise the phone's back gesture leaves the builder altogether
	 * and takes the whole draft with it; now it walks back through the steps and
	 * only leaves from the first one.
	 */
	const step = $derived<Step>(page.state.builderStep ?? 'warband');
	const openFighter = $derived(page.state.builder ?? null);

	function goStep(next: Step) {
		pushState('', { builderStep: next });
	}

	function openSheet(key: string) {
		/* The step travels along, or backing out of the sheet would land on a
		   history entry that does not know which step was open. */
		pushState('', { builderStep: step, builder: key });
	}

	function back() {
		/* The same move as the phone's gesture, so the two cannot disagree. */
		history.back();
	}

	function closeSheet() {
		if (page.state.builder) history.back();
	}

	let draft = $state<Draft>({
		name: '',
		factionId: factions[0]?.id ?? '',
		ruleChoices: {},
		favour: 0,
		fighters: []
	});

	const faction = $derived(FACTIONS.get(draft.factionId) ?? null);
	const spent = $derived(faction ? value(faction, draft) : 0);
	const left = $derived(faction ? goldLeft(faction, draft) : budget());
	const roster = $derived(faction ? recruitable(faction, draft) : []);
	const found = $derived(faction ? problems(faction, draft) : []);
	const inPlay = $derived(faction ? rulesInPlay(faction, draft) : []);
	const index = $derived(STEPS.findIndex((entry) => entry.id === step));

	/* Only the problems of the step being shown: the roster is incomplete while
	   the rules are being picked, and saying so then is noise. */
	const here = $derived(
		found.filter((problem) =>
			step === 'warband'
				? problem.step === 'faction'
				: step === 'rules'
					? problem.step === 'rules'
					: step === 'roster'
						? problem.step === 'roster' || problem.step === 'budget' || problem.step === 'fighter'
						: true
		)
	);

	/* Each problem is shown where it came about – beside the name that is
	   missing, under the rule that is short a pick – so these are lookups by
	   origin rather than one list at the foot of the screen. */
	const rosterProblems = $derived(
		found.filter((problem) => problem.step === 'roster' || problem.step === 'budget')
	);

	function problemFor(key: string): string | null {
		return found.find((problem) => problem.key === key)?.text ?? null;
	}

	/* The index, not the entry: the sheet writes into it, so it has to be bound. */
	const sheetAt = $derived(draft.fighters.findIndex((entry) => entry.key === openFighter));
	const sheet = $derived(sheetAt < 0 ? null : draft.fighters[sheetAt]);
	const sheetFighter = $derived(
		sheet && faction ? faction.fighters.find((entry) => entry.id === sheet.fighterId) : null
	);

	function recruit(fighterId: string) {
		const entry: DraftFighter = {
			key: newId(),
			fighterId,
			name: '',
			equipment: [],
			choice: []
		};
		draft.fighters = [...draft.fighters, entry];
		/* Straight into the sheet: a fighter without gear is not a decision anyone
		   meant to stop at. */
		openSheet(entry.key);
	}

	function dismiss(key: string) {
		draft.fighters = draft.fighters.filter((entry) => entry.key !== key);
		closeSheet();
	}

	function toggleRule(ruleId: string, optionId: string, pick: number) {
		const picked = draft.ruleChoices[ruleId] ?? [];
		if (picked.includes(optionId)) {
			draft.ruleChoices = { ...draft.ruleChoices, [ruleId]: picked.filter((id) => id !== optionId) };
			return;
		}
		/* At the limit the oldest pick gives way, so a player can keep tapping
		   instead of first working out what to untick. */
		const next = picked.length < pick ? [...picked, optionId] : [...picked.slice(1), optionId];
		draft.ruleChoices = { ...draft.ruleChoices, [ruleId]: next };
	}

	/** The tier the builder's info row prints as Standing, from the same table. */
	const favourTier = $derived(
		CAMPAIGN.favour_tiers.find((tier) => draft.favour >= tier.min && draft.favour <= tier.max)
	);

	function nameOf(entry: DraftFighter): string {
		const fighter = faction?.fighters.find((row) => row.id === entry.fighterId);
		return entry.name.trim() || fighter?.name || entry.fighterId;
	}

	function costOf(entry: DraftFighter): number {
		const row = roster.find((candidate) => candidate.fighter.id === entry.fighterId);
		return (row?.fee ?? 0) + equipmentCost(entry.equipment);
	}

	async function finish() {
		if (!faction || saving) return;
		saving = true;
		const warband = toWarband(faction, $state.snapshot(draft) as Draft);
		const now = new Date().toISOString();
		const entry: StoredWarband = {
			warband,
			revision: 1,
			ruleset: RULESET_VERSION,
			importedAt: now,
			updatedAt: now,
			/* Built here, so it came from no other device. */
			origin: null,
			battle: null,
			selections: selectionsOf(faction, $state.snapshot(draft) as Draft, warband)
		};
		try {
			await putWarband(entry);
			await requestPersistence();
			await goto(`${base}/`);
		} catch (error) {
			/* Storage full, or a browser that refuses IndexedDB in a private
			   window. Without this the button stays on "Saving…" and the warband
			   is gone with nothing said. */
			failed = error instanceof Error ? error.message : 'The warband could not be saved.';
			saving = false;
		}
	}
</script>

<header class="bar">
	<a class="icon-button" href="{base}/" aria-label="Leave the builder">
		<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<path d="M6 6l12 12M18 6L6 18" />
		</svg>
	</a>
	<h1>{STEPS[index]?.title}</h1>
	<span class="gold" class:over={left < 0}>{left} gc</span>
</header>

<ol class="progress">
	{#each STEPS as entry, at (entry.id)}
		<li class:done={at < index} class:now={at === index}></li>
	{/each}
</ol>

<div class="body">
	{#if step === 'warband'}
		<label class="named">
			<span>Name</span>
			<input bind:value={draft.name} placeholder="The Ostermark Free Company" maxlength="40" />
		</label>

		<section>
			<h2>Faction</h2>
			<ul class="cards">
				{#each factions as entry (entry.id)}
					<li>
						<button
							class:on={entry.id === draft.factionId}
							onclick={() => {
								draft.factionId = entry.id;
								draft.ruleChoices = {};
								draft.fighters = [];
							}}
						>
							<span class="name">{entry.name}</span>
							<span class="meta">
								{entry.warband_size.min}–{entry.warband_size.max} fighters ·
								{entry.fighters.length} profiles
							</span>
						</button>
					</li>
				{/each}
			</ul>
			<p class="hint">
				One faction so far. The other six are transcribed one at a time, and each
				brings rules of its own shape.
			</p>
		</section>
	{:else if step === 'rules' && faction}
		{#each faction.rules as rule (rule.id)}
			<section>
				<h2>{rule.name}</h2>
				<p class="hint">{rule.text}</p>
				{#if rule.pick !== null}
					{@const picked = (draft.ruleChoices[rule.id] ?? []).length}
					<p class="count" class:open={picked !== rule.pick}>
						{picked} of {rule.pick} chosen
					</p>
					<ul class="options">
						{#each rule.options as option (option.id)}
							{@const on = (draft.ruleChoices[rule.id] ?? []).includes(option.id)}
							<li>
								<button
									class:on
									aria-pressed={on}
									onclick={() => toggleRule(rule.id, option.id, rule.pick ?? 1)}
								>
									<span class="name">{option.name}</span>
									<span class="text">{option.text}</span>
									{#if option.phase !== 'recruitment'}
										<span class="phase">{option.phase}</span>
									{/if}
								</button>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		{/each}
	{:else if step === 'roster' && faction}
		<section>
			<h2>Recruited · {draft.fighters.length} of {faction.warband_size.max}</h2>
			{#each rosterProblems as problem, at (`${problem.step}-${at}`)}
				<p class="open">{problem.text}</p>
			{/each}
			{#if draft.fighters.length}
				<ul class="recruited">
					{#each draft.fighters as entry (entry.key)}
						{@const open = problemFor(entry.key)}
						<li>
							<button class:flagged={open} onclick={() => openSheet(entry.key)}>
								<span class="name">{nameOf(entry)}</span>
								<span class="meta">
									{entry.equipment.length} carried
								</span>
								<span class="cost">{costOf(entry)} gc</span>
								{#if open}<span class="open">{open}</span>{/if}
							</button>
						</li>
					{/each}
				</ul>
			{:else}
				<p class="hint">Nobody yet. A warband needs a leader first.</p>
			{/if}
		</section>

		<section>
			<h2>Recruit</h2>
			<ul class="options">
				{#each roster as row (row.fighter.id)}
					<li>
						<button disabled={Boolean(row.refused)} onclick={() => recruit(row.fighter.id)}>
							<span class="name">
								{row.fighter.name}
								{#if row.fighter.limit.max !== null}
									<span class="held">{row.held}/{row.fighter.limit.max}</span>
								{/if}
							</span>
							<span class="text">{row.fighter.description}</span>
							<span class="cost">{row.fee} gc</span>
							{#if row.refused}<span class="phase">{row.refused}</span>{/if}
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{:else if step === 'finish' && faction}
		<section>
			<h2>{draft.name || 'Unnamed'}</h2>
			<p class="hint">
				{faction.name} · {draft.fighters.length} fighters · {spent} gc of {budget()} spent,
				{left} gc left over as the warband's treasury.
			</p>
		</section>

		<section>
			<label class="named">
				<span>Favour</span>
				<input type="number" min="0" max="999" bind:value={draft.favour} />
			</label>
			<p class="hint">
				Standing {favourTier?.label ?? '—'}, worth {favourTier?.income ?? 0} gc of income in
				the aftermath. A warband that has not fought yet carries none, so 0 is the usual
				answer.
			</p>
		</section>

		<section>
			<h2>Rules in play</h2>
			<ul class="plain">
				{#each inPlay as { rule, option } (option ?? rule.id)}
					<li>
						{rule.name}{#if option}
							&nbsp;– {rule.options.find((entry) => entry.id === option)?.name}
						{/if}
					</li>
				{/each}
			</ul>
		</section>

		<section>
			<h2>The warband</h2>
			<ul class="plain">
				{#each draft.fighters as entry (entry.key)}
					<li>{nameOf(entry)} · {costOf(entry)} gc</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if failed}
		<p class="open">{failed}</p>
	{/if}

	{#if step === 'finish' && found.length}
		<section>
			<h2>Still open</h2>
			{#each found as problem, at (`${problem.step}-${problem.key ?? at}`)}
				<p class="open">{problem.text}</p>
			{/each}
		</section>
	{/if}
</div>

<nav class="foot">
	<button class="ghost" disabled={index === 0} onclick={back}>Back</button>
	{#if step === 'finish'}
		<button class="go" disabled={found.length > 0 || saving} onclick={finish}>
			{saving ? 'Saving…' : 'Create the deck'}
		</button>
	{:else}
		<button
			class="go"
			disabled={here.length > 0}
			onclick={() => goStep(STEPS[Math.min(index + 1, STEPS.length - 1)].id)}
		>
			Next
		</button>
	{/if}
</nav>

{#if sheet && sheetFighter && faction}
	<FighterSheet
		{faction}
		{draft}
		bind:entry={draft.fighters[sheetAt]}
		fighter={sheetFighter}
		onclose={closeSheet}
		onremove={() => dismiss(sheet.key)}
	/>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: none;
		padding: 10px 12px;
		background: var(--ui-header-bg);
	}

	h1 {
		flex: 1;
		margin: 0;
		font-size: 17px;
		font-weight: 600;
	}

	.icon-button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		margin: -10px 0 -10px -10px;
		color: var(--ui-text);
	}

	.gold {
		flex: none;
		font-size: 14px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		color: var(--ui-accent-text);
	}

	.gold.over {
		color: var(--ui-warn);
	}

	/* Also the rule under the header: the body scrolls right up against it, and a
	   hairline above a clipped line of text reads as a slice rather than an edge. */
	.progress {
		display: flex;
		gap: 3px;
		flex: none;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.progress li {
		height: 3px;
		flex: 1;
		background: var(--ui-surface-2);
	}

	.progress .done,
	.progress .now {
		background: var(--ui-accent);
	}

	.body {
		flex: 1;
		overflow-y: auto;
		padding: 16px 12px 24px;
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	h2 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ui-text-subtle);
	}

	.named {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--ui-text-subtle);
	}

	input {
		padding: 11px 12px;
		font-size: 16px;
		letter-spacing: normal;
		text-transform: none;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 9px;
	}

	.hint,
	.count {
		margin: 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--ui-text-muted);
	}

	.count {
		font-variant-numeric: tabular-nums;
		color: var(--ui-accent-text);
	}

	/* What is still open, wherever it is open. The warn colour carries the
	   meaning; the text stays at full strength because it is a sentence to read,
	   not a label. */
	.open {
		margin: 0;
		padding: 7px 10px;
		font-size: 13px;
		line-height: 1.45;
		color: var(--ui-text);
		background: var(--ui-warn-bg);
		border: 1px solid var(--ui-warn);
		border-radius: 8px;
	}

	.count.open {
		display: inline-block;
		align-self: flex-start;
		color: var(--ui-text);
	}

	.recruited .open {
		grid-column: 1 / -1;
		margin-top: 4px;
	}

	.recruited button.flagged {
		border-color: var(--ui-warn);
	}

	ul {
		margin: 0;
		padding: 0;
		list-style: none;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.cards button,
	.options button,
	.recruited button {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 2px 10px;
		width: 100%;
		padding: 11px 12px;
		text-align: left;
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
	}

	button.on {
		background: var(--ui-accent-bg);
		border-color: var(--ui-accent);
	}

	.options button:disabled {
		/* 6.6:1 on this background, where the subtle grey reaches 3.5:1. */
		color: var(--ui-text-muted);
		background: none;
	}

	.name {
		font-size: 15px;
		font-weight: 600;
	}

	.held {
		margin-left: 5px;
		font-size: 12px;
		font-weight: 400;
		font-variant-numeric: tabular-nums;
		/* 5.8:1 on the row's surface; the subtle grey reaches 3.1:1 and misses AA
		   at this size. */
		color: var(--ui-text-muted);
	}

	.text,
	.meta {
		grid-column: 1 / -1;
		font-size: 13px;
		line-height: 1.45;
		color: var(--ui-text-muted);
	}

	.cost {
		grid-row: 1;
		grid-column: 2;
		font-size: 13px;
		font-variant-numeric: tabular-nums;
		color: var(--ui-text-muted);
	}

	.phase {
		grid-column: 1 / -1;
		font-size: 11px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		/* Says where a rule takes hold, or why a row cannot be picked – an aside
		   on most rows at once, and the signal colour falls below AA at this size. */
		color: var(--ui-text-muted);
	}

	.plain li {
		padding: 3px 0;
		font-size: 14px;
		color: var(--ui-text-muted);
	}

	.foot {
		display: flex;
		gap: 8px;
		flex: none;
		padding: 10px 12px;
		padding-bottom: max(10px, env(safe-area-inset-bottom));
		background: var(--ui-header-bg);
		border-top: 1px solid var(--ui-border);
	}

	.foot button {
		flex: 1;
		padding: 13px;
		font-size: 15px;
		font-weight: 600;
		border: 0;
		border-radius: 10px;
	}

	.ghost {
		flex: none;
		padding-inline: 20px;
		color: var(--ui-text);
		background: var(--ui-surface);
	}

	.go {
		color: #fff;
		background: var(--ui-accent);
	}

	.foot button:disabled {
		/* A disabled control is outside 1.4.3, but this one is the whole signal of
		   a step: 5.8:1 rather than the subtle grey's 3.1:1. */
		color: var(--ui-text-muted);
		background: var(--ui-surface);
	}
</style>
