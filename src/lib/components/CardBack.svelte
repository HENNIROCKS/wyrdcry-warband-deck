<script lang="ts" module>
	import type { RenownOption } from '../renown';
	import type { BattleRecord, RenownBranch } from '../types/warband';

	/** The levels the fighter on this back can spend, on the warband as Done would store it. */
	export interface BackRenown {
		/** The first level still open, and what it can be spent on. */
		next: { level: number; branch: RenownBranch; options: RenownOption[] } | null;
		/** Every level still open, `next` included. */
		waiting: number;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import { MAX_XP, emptyPending, renownFloor, toRecord, type EditDraft, type FighterDraft } from '../edit';
	import { RESULT_LABELS, displayDate, newestFirst, opponent } from '../history';
	import { BLOCKED, LABELS, NOTES, change, offersTalent } from './RenownSheet.svelte';

	let {
		name,
		draft = $bindable(),
		renown = null
	}: { name: string; draft: EditDraft; renown?: BackRenown | null } = $props();

	/* The back has a second page for spending a level: it takes the card's place
	   rather than opening a sheet over it, so the choice is part of the draft and
	   Cancel drops it like everything else. */
	let spending = $state(false);
	let article: HTMLElement | undefined = $state();
	let campaign: HTMLElement | undefined = $state();

	const next = $derived(spending ? (renown?.next ?? null) : null);
	const open = $derived(next?.options.some((o) => o.blocked === null) ?? false);

	async function showSpending(on: boolean) {
		spending = on;
		await tick();
		/* The page swapped under a finger that was halfway down the card. */
		(on ? article : campaign)?.scrollIntoView({ block: 'start' });
	}

	function choose(option: RenownOption | null) {
		if (!draft.fighter || !next) return;
		draft.fighter.spent = [...draft.fighter.spent, { level: next.level, option }];
		showSpending(false);
	}

	/** Only the last: the choices after a level were offered on the figures it left. */
	function undoLast() {
		if (!draft.fighter) return;
		draft.fighter.spent = draft.fighter.spent.slice(0, -1);
	}

	const sorted = $derived(draft.history ? newestFirst(draft.history) : []);

	function add() {
		const record = toRecord(draft.pending);
		if (!record || !draft.history) return;
		draft.history = [...draft.history, record];
		draft.pending = emptyPending();
	}

	/** The point that would make a fourth is a level of renown instead, as in `applyXp`. */
	function moreXp(fighter: FighterDraft) {
		if (fighter.xp < MAX_XP) {
			fighter.xp += 1;
		} else {
			fighter.xp = 0;
			fighter.renown += 1;
		}
	}

	function toggleRemoved(id: string) {
		draft.removed = draft.removed.includes(id)
			? draft.removed.filter((r) => r !== id)
			: [...draft.removed, id];
	}

	/** A text field as tall as what it holds, so the card scrolls and the field never does. */
	function grow(node: HTMLTextAreaElement) {
		const fit = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		fit();
		node.addEventListener('input', fit);
		return { destroy: () => node.removeEventListener('input', fit) };
	}
</script>

<article class="card back" bind:this={article}>
	<h2 class="name">{name}</h2>

	{#if next}
		<div class="parchment">
			<section>
				<button class="back-link" onclick={() => showSpending(false)}>‹ Back</button>
				<h3 class="heading"><span>Renown {next.level}</span><span class="rule"></span></h3>
				<p class="note">
					{NOTES[next.branch]}{#if offersTalent(next.branch)}{' '}Talents are not offered here yet – go back to keep the level for later.{/if}
				</p>

				<div class="options">
					{#each next.options as option (option.characteristic)}
						<button class="option" disabled={option.blocked !== null} onclick={() => choose(option)}>
							<span class="line">
								{LABELS[option.characteristic]}
								{#if option.blocked}<span class="why">{BLOCKED[option.blocked]}</span>{/if}
							</span>
							<span class="change">
								{change(option)}
							</span>
						</button>
					{/each}
				</div>
				{#if !open && (next.branch === 'henchman' || next.branch === 'none')}
					<button class="add" onclick={() => choose(null)}>Use up this level</button>
				{/if}
			</section>
		</div>
	{:else}
		<div class="parchment">
			{#if draft.fighter}
				<section>
					<label class="heading" for="back-name"><span>Name</span><span class="rule"></span></label>
					<input
						id="back-name"
						type="text"
						autocomplete="off"
						placeholder={draft.fighter.placeholder}
						bind:value={draft.fighter.name}
					/>
				</section>
			{/if}

			<section>
				<label class="heading" for="back-fluff"><span>Fluff</span><span class="rule"></span></label>
				<textarea
					id="back-fluff"
					class="fluff"
					rows="2"
					placeholder="A line or two of story"
					bind:value={draft.fluff}
					use:grow
				></textarea>
			</section>

			{#if draft.fighter}
				{@const fighter = draft.fighter}
				{@const floor = renownFloor(fighter)}
				<section bind:this={campaign}>
					<h3 class="heading"><span>Campaign</span><span class="rule"></span></h3>

					<div class="counter">
						<span class="label" id="back-xp">XP</span>
						<div class="stepper" role="group" aria-labelledby="back-xp">
							<button class="choice" aria-label="Less XP" disabled={fighter.xp <= 0} onclick={() => (fighter.xp -= 1)}>−</button>
							<output class="figure">{fighter.xp}</output>
							<button class="choice" aria-label="More XP" onclick={() => moreXp(fighter)}>+</button>
						</div>
					</div>

					<div class="counter">
						<span class="label" id="back-renown">Renown</span>
						<div class="stepper" role="group" aria-labelledby="back-renown">
							<button
								class="choice"
								aria-label="Less renown"
								disabled={fighter.renown <= floor}
								onclick={() => (fighter.renown -= 1)}>−</button
							>
							<output class="figure">{fighter.renown}</output>
							<button class="choice" aria-label="More renown" onclick={() => (fighter.renown += 1)}>+</button>
						</div>
					</div>
					{#if floor > 0 && fighter.renown <= floor}
						<p class="hint">Not below a level already spent or waiting to be.</p>
					{/if}

					{#if fighter.spent.length}
						<ul class="list">
							{#each fighter.spent as spent, i (spent.level)}
								<li>
									<span class="line">
										<span class="when">Renown {spent.level}</span>
										{#if spent.option}
											{LABELS[spent.option.characteristic]}
											{change(spent.option)}
										{:else}
											used up
										{/if}
									</span>
									{#if i === fighter.spent.length - 1}
										<button class="remove" onclick={undoLast}>Undo</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
					{#if renown?.next}
						<button class="add" onclick={() => showSpending(true)}>Spend renown ({renown.waiting})</button>
					{/if}
				</section>
			{/if}

			<section>
				<label class="heading" for="back-notes"><span>Notes</span><span class="rule"></span></label>
				<textarea
					id="back-notes"
					rows="2"
					placeholder="Anything to remember at the table"
					bind:value={draft.notes}
					use:grow
				></textarea>
			</section>

			{#if draft.history}
				<section>
					<h3 class="heading"><span>Battles</span><span class="rule"></span></h3>

					<div class="entry-row">
						<input class="date" type="date" aria-label="Date" bind:value={draft.pending.date} />
						<div class="results" role="group" aria-label="Result">
							{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
								<button
									class="choice"
									aria-pressed={draft.pending.result === key}
									onclick={() => (draft.pending.result = key as BattleRecord['result'])}
								>
									{label}
								</button>
							{/each}
						</div>
					</div>
					<input
						type="text"
						placeholder="Opponent's warband"
						aria-label="Opponent's warband"
						autocomplete="off"
						bind:value={draft.pending.opponentWarband}
					/>
					<input
						type="text"
						placeholder="Opponent's name"
						aria-label="Opponent's name"
						autocomplete="off"
						bind:value={draft.pending.opponentPlayer}
					/>
					<button class="add" disabled={!draft.pending.result || !draft.pending.date} onclick={add}>
						Add battle
					</button>

					{#if sorted.length}
						<ul class="list">
							{#each sorted as record (record.id)}
								{@const removed = draft.removed.includes(record.id)}
								<li class:removed>
									<span class="line">
										<span class="when">{displayDate(record.date)}</span>
										{opponent(record)} – {RESULT_LABELS[record.result]}
									</span>
									<button class="remove" onclick={() => toggleRemoved(record.id)}>
										{removed ? 'Keep' : 'Remove'}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</article>

<style>
	/* A lighter patch of the paper rather than a box: no frame and no line,
	   brighter and edged in green while the field is being written in. */
	textarea,
	input {
		width: 100%;
		margin: 0;
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
		background: rgb(255 255 255 / 0.45);
		border: 0;
		border-radius: calc(6 * var(--u));
		outline: none;
		appearance: none;
	}

	textarea {
		resize: none;
		overflow: hidden;
	}

	textarea:focus,
	input:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	.fluff {
		font-style: italic;
	}

	.entry-row {
		display: flex;
		align-items: flex-end;
		gap: calc(12 * var(--u));
	}

	.date {
		flex: 1;
		min-width: 0;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.results {
		display: flex;
	}

	/* Three words to tap, joined into one pill; the one picked is set in the
	   banderole's green. */
	.choice {
		min-height: 40px;
		padding: 0 calc(10 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		color: var(--card-green);
	}

	.choice:first-child {
		border-radius: 999px 0 0 999px;
	}

	.choice:last-child {
		border-radius: 0 999px 999px 0;
	}

	/* Two neighbouring frames share one line instead of doubling it. */
	.choice + .choice {
		margin-left: -1px;
	}

	.choice[aria-pressed='true'] {
		background: var(--card-green);
		color: var(--card-paper);
	}

	/* A figure and its name on one line, the steppers lined up at the right edge. */
	.counter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(12 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-ink);
	}

	.stepper {
		display: flex;
	}

	.stepper .choice {
		min-width: 44px;
		font-size: calc(20 * var(--t));
	}

	/* The figure sits inside the pill, framed above and below by the same green. */
	.figure {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		border-top: 1px solid var(--card-green);
		border-bottom: 1px solid var(--card-green);
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		font-variant-numeric: lining-nums tabular-nums;
		color: var(--card-ink);
	}

	/* Only the sign fades: the frame is also the figure's edge, and the pill
	   keeps its outline whichever end is out of reach. */
	.stepper .choice:disabled {
		color: color-mix(in srgb, var(--card-green) 35%, transparent);
	}

	.add {
		align-self: flex-end;
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-green);
		color: var(--card-paper);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
	}

	/* Until a result is picked, an unpicked choice, set back. */
	.add:disabled {
		background: transparent;
		color: var(--card-green);
		opacity: 0.5;
	}

	/* As on the front: a solid rule above the log, a dashed one under each row. */
	.list {
		margin: calc(6 * var(--u)) 0 0;
		padding: 0;
		list-style: none;
		border-top: 1.5px solid #000;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.3;
	}

	.list li {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--u));
		padding: calc(4 * var(--u)) 0;
		border-bottom: 1px dashed #000;
	}

	.line {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.when {
		margin-right: 0.3em;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.removed .line {
		text-decoration: line-through;
		color: var(--card-ink-muted);
	}

	.back-link {
		align-self: flex-start;
		min-height: 40px;
		padding: 0;
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		color: var(--card-link);
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: calc(10 * var(--u));
		margin-top: calc(6 * var(--u));
	}

	/* A characteristic to raise is a pill like every other button on the back,
	   the whole width of the card and set as large as its fields. */
	.option {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--u));
		min-height: 48px;
		padding: calc(6 * var(--u)) calc(18 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.25;
		color: var(--card-ink);
		text-align: left;
	}

	.option:active:not(:disabled) {
		background: var(--card-green);
		color: var(--card-paper);
	}

	.option:active:not(:disabled) .change {
		color: inherit;
	}

	.option:disabled {
		border-color: color-mix(in srgb, var(--card-green) 35%, transparent);
		color: var(--card-ink-muted);
	}

	.option .line {
		flex: 1;
		min-width: 0;
	}

	.change {
		flex: none;
		color: var(--card-green);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.option:disabled .change {
		color: inherit;
	}

	.why {
		display: block;
		font-size: calc(18 * var(--t));
		font-style: italic;
	}

	.remove {
		flex: none;
		min-height: 40px;
		padding: 0 calc(6 * var(--u));
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-link);
	}
</style>
