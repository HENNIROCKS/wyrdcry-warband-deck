<script lang="ts" module>
	import { newId } from '../id';
	import { today } from '../history';
	import type { BattleRecord } from '../types/warband';

	export interface PendingBattle {
		date: string;
		result: BattleRecord['result'] | null;
		opponentWarband: string;
		opponentPlayer: string;
	}

	/**
	 * Everything the back of a card edits, held apart from the warband until
	 * Done writes it in one go – Cancel simply lets it fall.
	 */
	export interface EditDraft {
		notes: string;
		fluff: string;
		/** The battles, on the warband card only. */
		history: BattleRecord[] | null;
		/** Battles struck out, dropped on Done and brought back until then. */
		removed: string[];
		/** The battle being entered and not yet added. */
		pending: PendingBattle;
	}

	export function emptyPending(): PendingBattle {
		return { date: today(), result: null, opponentWarband: '', opponentPlayer: '' };
	}

	export function toRecord(pending: PendingBattle): BattleRecord | null {
		if (!pending.result || !pending.date) return null;
		return {
			id: newId(),
			date: pending.date,
			result: pending.result,
			opponentWarband: pending.opponentWarband.trim(),
			opponentPlayer: pending.opponentPlayer.trim()
		};
	}

	/**
	 * The history Done writes: the struck-out battles gone, and a battle left
	 * filled in but not added taken in as well – its result is picked, so it was
	 * meant, and Done is not the place to lose it.
	 */
	export function finalHistory(draft: EditDraft): BattleRecord[] {
		const kept = (draft.history ?? []).filter((r) => !draft.removed.includes(r.id));
		const pending = toRecord(draft.pending);
		return pending ? [...kept, pending] : kept;
	}
</script>

<script lang="ts">
	import { RESULT_LABELS, displayDate, newestFirst, opponent } from '../history';

	let { name, draft = $bindable() }: { name: string; draft: EditDraft } = $props();

	const sorted = $derived(draft.history ? newestFirst(draft.history) : []);

	function add() {
		const record = toRecord(draft.pending);
		if (!record || !draft.history) return;
		draft.history = [...draft.history, record];
		draft.pending = emptyPending();
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

<article class="card back">
	<h2 class="name">{name}</h2>

	<div class="parchment">
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
</article>

<style>
	/* Clear of the strokes that mark the place in the stack across the top. */
	.name {
		margin: 0;
		padding: calc(44 * var(--u)) calc(30 * var(--u)) 0;
		text-align: center;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 600;
		font-size: calc(34 * var(--t));
		line-height: 1.1;
		color: #000;
		overflow-wrap: anywhere;
	}

	.parchment {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: calc(66 * var(--u));
		padding: calc(18 * var(--u)) calc(30 * var(--u)) calc(38 * var(--u));
	}

	section {
		display: flex;
		flex-direction: column;
		gap: calc(10 * var(--u));
	}

	/* A word in the card's script and a rule in the same black out to the edge. */
	.heading {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--t));
		margin: 0;
		padding: calc(4 * var(--t)) 0;
		font-family: 'Grenze Gotisch', serif;
		font-weight: 400;
		font-size: calc(18 * var(--t));
		line-height: 1;
		letter-spacing: 0.04em;
		color: #000;
	}

	.rule {
		flex: 1;
		height: 2px;
		background: #000;
	}

	/* Written on the paper rather than into a box: no fill, no frame, one line
	   of ink underneath that turns green while the field is being written in. */
	textarea,
	input {
		width: 100%;
		margin: 0;
		padding: calc(4 * var(--u)) 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
		background: transparent;
		border: 0;
		border-bottom: 1px solid #000;
		border-radius: 0;
		outline: none;
		appearance: none;
	}

	textarea {
		resize: none;
		overflow: hidden;
	}

	textarea:focus,
	input:focus {
		border-bottom-color: var(--card-green);
		box-shadow: 0 1px 0 var(--card-green);
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
		font-size: calc(16 * var(--t));
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

	.remove {
		flex: none;
		min-height: 40px;
		padding: 0 calc(6 * var(--u));
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(16 * var(--t));
		color: var(--card-link);
	}
</style>
