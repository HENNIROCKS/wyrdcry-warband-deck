<script lang="ts">
	import { untrack } from 'svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { candidates, xpEarned, type AftermathAnswer } from '../aftermath';
	import type { BattleState } from '../types/warband';
	import type { FighterCardData } from '../types/card';
	import type { Warband } from '../types/warband';

	let {
		warband,
		cards,
		battle,
		onconfirm,
		oncancel
	}: {
		warband: Warband;
		cards: FighterCardData[];
		battle: BattleState | null;
		onconfirm: (answers: Map<string, AftermathAnswer>, bonusInstanceId: string | null) => void;
		oncancel: () => void;
	} = $props();

	/* Read once, like the props themselves: the sheet is mounted fresh each
	   time a battle ends, never kept open across a change underneath it. */
	const all = untrack(() => candidates(warband, cards, battle));
	const rows = all.filter((c) => c.eligible);
	const excluded = all.filter((c) => !c.eligible);

	const answers = new SvelteMap(
		rows.map((r) => [r.instanceId, { participated: r.participated, survived: r.survived, enemyOut: false }])
	);
	let bonusInstanceId = $state<string | null>(null);

	function toggle(instanceId: string, key: keyof AftermathAnswer) {
		const current = answers.get(instanceId);
		if (!current) return;
		answers.set(instanceId, { ...current, [key]: !current[key] });
	}

	function pointsFor(instanceId: string): number {
		const answer = answers.get(instanceId);
		if (!answer) return 0;
		return xpEarned(answer, instanceId === bonusInstanceId);
	}
</script>

<div class="backdrop">
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="aftermath-title">
		<h2 id="aftermath-title">Experience</h2>
		<p class="count">Step 2 of the aftermath sequence, for {rows.length} fighters</p>

		<fieldset class="rows">
			<legend class="visually-hidden">Experience earned per fighter, and who gets the bonus point</legend>
			{#each rows as row (row.instanceId)}
				{@const answer = answers.get(row.instanceId)}
				<div class="row">
					<p class="name">
						{row.name}
						{#if pointsFor(row.instanceId) > 0}
							<span class="gain">+{pointsFor(row.instanceId)} XP</span>
						{/if}
					</p>
					<div class="checks">
						<label>
							<input
								type="checkbox"
								checked={answer?.participated}
								onchange={() => toggle(row.instanceId, 'participated')}
							/>
							Participated
						</label>
						<label>
							<input
								type="checkbox"
								checked={answer?.survived}
								onchange={() => toggle(row.instanceId, 'survived')}
							/>
							Not taken out of action
						</label>
						<label>
							<input
								type="checkbox"
								checked={answer?.enemyOut}
								onchange={() => toggle(row.instanceId, 'enemyOut')}
							/>
							Took an enemy out of action
						</label>
						<label>
							<input
								type="radio"
								name="bonus"
								aria-label={`Bonus experience for ${row.name}`}
								checked={bonusInstanceId === row.instanceId}
								onchange={() => (bonusInstanceId = row.instanceId)}
							/>
							Bonus experience
						</label>
					</div>
				</div>
			{/each}
		</fieldset>

		{#if excluded.length}
			<p class="note">
				Never earn experience: {excluded.map((c) => c.name).join(', ')}
			</p>
		{/if}

		<div class="actions">
			<button class="ghost" onclick={oncancel}>Cancel</button>
			<button onclick={() => onconfirm(answers, bonusInstanceId)}>Apply and end battle</button>
		</div>
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
		max-height: 80vh;
		overflow-y: auto;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 14px;
		padding: 16px;
	}

	h2 {
		margin: 0;
		font-size: var(--ui-t-xl);
	}

	.count {
		margin: 3px 0 12px;
		font-size: var(--ui-t-base);
		color: var(--ui-text-muted);
	}

	.rows {
		display: flex;
		flex-direction: column;
		gap: 14px;
		margin: 0;
		padding: 0;
		border: 0;
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

	.row {
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--ui-surface-2);
	}

	.name {
		margin: 0 0 6px;
		font-weight: 600;
		font-size: var(--ui-t-md);
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.gain {
		font-size: var(--ui-t-sm);
		font-weight: 600;
		color: var(--ui-accent-text, var(--ui-accent));
	}

	.checks {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.checks label {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: var(--ui-t-base);
	}

	.note {
		margin: 14px 0 0;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: var(--ui-t-sm);
		color: var(--ui-text-muted);
		background: var(--ui-surface-2);
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

	.actions .ghost {
		background: var(--ui-surface-2);
		color: var(--ui-text);
	}
</style>
