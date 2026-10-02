<script lang="ts">
	import { RESULT_LABELS, newestFirst, opponent, shortDate } from '../history';
	import { newId } from '../id';
	import type { BattleRecord } from '../types/warband';

	let {
		history,
		onadd,
		onremove,
		onclose
	}: {
		history: BattleRecord[];
		onadd: (record: BattleRecord) => void;
		onremove: (id: string) => void;
		onclose: () => void;
	} = $props();

	/* Today as the phone's own calendar has it – `toISOString` is UTC and would
	   date a late game to the next morning. */
	function today(): string {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
	}

	let date = $state(today());
	let result = $state<BattleRecord['result'] | null>(null);
	let opponentWarband = $state('');
	let opponentPlayer = $state('');

	const sorted = $derived(newestFirst(history));
	/* Remove asks once more: it sits right under "Add battle", and a mis-tap at
	   the table would take a written entry with it. */
	let confirming = $state<string | null>(null);

	function add() {
		if (!result || !date) return;
		onadd({ id: newId(), date, result, opponentWarband: opponentWarband.trim(), opponentPlayer: opponentPlayer.trim() });
	}
</script>

<div class="backdrop">
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="history-title">
		<h2 id="history-title">Battle history</h2>

		<div class="fields">
			<label class="field">
				<span class="label">Date</span>
				<input type="date" bind:value={date} />
			</label>

			<div class="field" role="group" aria-labelledby="result-label">
				<span class="label" id="result-label">Result</span>
				<div class="results">
					{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
						<button
							class="choice"
							aria-pressed={result === key}
							onclick={() => (result = key as BattleRecord['result'])}
						>
							{label}
						</button>
					{/each}
				</div>
			</div>

			<label class="field">
				<span class="label">Opponent's warband</span>
				<input type="text" bind:value={opponentWarband} autocomplete="off" />
			</label>

			<label class="field">
				<span class="label">Opponent's name</span>
				<input type="text" bind:value={opponentPlayer} autocomplete="off" />
			</label>
		</div>

		<div class="actions">
			<button class="ghost" onclick={onclose}>Cancel</button>
			<button disabled={!result || !date} onclick={add}>Add battle</button>
		</div>

		{#if sorted.length}
			<ul class="list">
				{#each sorted as record (record.id)}
					<li>
						<span class="line">
							{shortDate(record.date)}
							{opponent(record)} – {RESULT_LABELS[record.result]}
						</span>
						{#if confirming === record.id}
							<button class="remove" onclick={() => (confirming = null)}>Keep</button>
							<button class="remove danger" onclick={() => onremove(record.id)}>Remove it</button>
						{:else}
							<button class="remove" onclick={() => (confirming = record.id)}>Remove</button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		padding: 12px;
		padding-bottom: calc(12px + env(safe-area-inset-bottom));
	}

	.sheet {
		width: 100%;
		max-width: 420px;
		max-height: 85vh;
		overflow-y: auto;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 14px;
		padding: 16px;
	}

	h2 {
		margin: 0 0 12px;
		font-size: var(--ui-t-xl);
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: var(--ui-t-sm);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ui-text-subtle);
	}

	input {
		width: 100%;
		min-height: 44px;
		padding: 10px 12px;
		font: inherit;
		font-size: var(--ui-t-base);
		color: var(--ui-text);
		background: var(--ui-surface-2);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
	}

	.results {
		display: flex;
		gap: 8px;
	}

	.choice {
		flex: 1;
		padding: 10px;
		font-size: var(--ui-t-base);
		font-weight: 600;
		color: var(--ui-text);
		background: var(--ui-surface-2);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
	}

	.choice[aria-pressed='true'] {
		color: #fff;
		background: var(--ui-accent);
		border-color: var(--ui-accent);
	}

	.actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}

	.actions button {
		flex: 1;
		padding: 12px;
		border: 0;
		border-radius: 10px;
		font-size: var(--ui-t-lg);
		font-weight: 600;
		background: var(--ui-accent);
		color: #fff;
	}

	.actions button:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.actions .ghost {
		background: var(--ui-surface-2);
		color: var(--ui-text);
	}

	.list {
		margin: 16px 0 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--ui-border);
	}

	.list li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 0 4px 2px;
		border-bottom: 1px solid var(--ui-border);
		font-size: var(--ui-t-base);
	}

	.line {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
		font-variant-numeric: tabular-nums;
	}

	.remove {
		flex: none;
		padding: 8px;
		color: var(--ui-text);
		background: none;
		border: 0;
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* Filled, as Delete is in the warband's own delete sheet: red type on this
	   surface stands at 2.3:1, white on the red at 6.5:1. */
	.remove.danger {
		color: #fff;
		background: var(--ui-danger);
		border-radius: 8px;
		text-decoration: none;
	}
</style>
