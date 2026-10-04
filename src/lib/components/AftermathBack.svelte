<script lang="ts">
	import { xpEarned, type AftermathAnswer, type AftermathDraft } from '../aftermath';

	let { name, draft = $bindable() }: { name: string; draft: AftermathDraft } = $props();

	const QUESTIONS: { key: keyof AftermathAnswer; label: string }[] = [
		{ key: 'participated', label: 'Participated' },
		{ key: 'survived', label: 'Not taken out of action' },
		{ key: 'enemyOut', label: 'Took an enemy out of action' }
	];

	function toggle(instanceId: string, key: keyof AftermathAnswer) {
		const answer = draft.answers[instanceId];
		if (answer) answer[key] = !answer[key];
	}

	/* One fighter at most: a tap moves the point, a second tap takes it back. */
	function toggleBonus(instanceId: string) {
		draft.bonus = draft.bonus === instanceId ? null : instanceId;
	}

	function pointsFor(instanceId: string): number {
		const answer = draft.answers[instanceId];
		return answer ? xpEarned(answer, instanceId === draft.bonus) : 0;
	}
</script>

<article class="card back">
	<h2 class="name">{name}</h2>

	<div class="parchment">
		<section>
			<h3 class="heading"><span>Experience</span><span class="rule"></span></h3>
			<p class="hint">Step 2 of the aftermath sequence, for {draft.rows.length} fighters.</p>
		</section>

		{#each draft.rows as row (row.instanceId)}
			{@const answer = draft.answers[row.instanceId]}
			{@const points = pointsFor(row.instanceId)}
			<section>
				<h3 class="heading">
					<span>{row.name}</span><span class="rule"></span>
					<span class="gain" class:none={points === 0}>+{points} XP</span>
				</h3>
				<div class="toggles" role="group" aria-label="Experience for {row.name}">
					{#each QUESTIONS as question (question.key)}
						<button
							class="toggle"
							aria-pressed={answer?.[question.key] ?? false}
							onclick={() => toggle(row.instanceId, question.key)}
						>
							{question.label}
						</button>
					{/each}
					<button
						class="toggle"
						aria-pressed={draft.bonus === row.instanceId}
						onclick={() => toggleBonus(row.instanceId)}
					>
						Bonus
					</button>
				</div>
			</section>
		{/each}

		{#if draft.excluded.length}
			<p class="note">Never earn experience: {draft.excluded.join(', ')}</p>
		{/if}
	</div>
</article>

<style>
	/* One section per fighter: closer together than the back's own sections,
	   or a full roster runs to several screens. */
	.card.back .parchment {
		gap: calc(36 * var(--u));
	}

	/* What the row earns, in the green the card marks a gain with; a row that
	   earns nothing keeps the place, so the rule does not jump as it is answered. */
	.gain {
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		letter-spacing: 0;
		color: var(--card-green);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.gain.none {
		color: var(--card-ink-muted);
	}

	.toggles {
		display: flex;
		flex-wrap: wrap;
		gap: calc(8 * var(--u));
	}

	/* Each answer a pill of its own, set in green once it holds. */
	.toggle {
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-field);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		color: var(--card-green);
	}

	.toggle[aria-pressed='true'] {
		background: var(--card-green);
		color: var(--card-paper);
	}
</style>
