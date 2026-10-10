<script lang="ts">
	import { income, xpEarned, type AftermathAnswer, type AftermathDraft } from '../aftermath';
	import { RESULT_LABELS, displayDate, opponent } from '../history';
	import type { BattleRecord } from '../types/warband';

	let {
		name,
		favour,
		draft = $bindable()
	}: {
		name: string;
		/** The warband's favour before this battle's is earned. */
		favour: number;
		draft: AftermathDraft;
	} = $props();

	const earned = $derived(income(favour, draft.income));
	const rises = $derived(earned.tier.label !== income(favour, { ...draft.income, shards: 0, result: null }).tier.label);

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
			<h3 class="heading"><span id="aftermath-result">Result</span><span class="rule"></span></h3>
			<div class="toggles" role="group" aria-labelledby="aftermath-result">
				{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
					<button
						class="toggle"
						aria-pressed={draft.income.result === key}
						onclick={() =>
							(draft.income.result = draft.income.result === key ? null : (key as BattleRecord['result']))}
					>
						{label}
					</button>
				{/each}
			</div>
			{#if !draft.income.result}<p class="hint">Pick the result to end the battle.</p>{/if}
		</section>

		<section>
			<h3 class="heading">
				<span id="aftermath-shards">Shards delivered</span><span class="rule"></span>
			</h3>
			<div class="toggles" role="group" aria-labelledby="aftermath-shards">
				<button
					class="toggle"
					aria-label="One shard less"
					disabled={draft.income.shards <= 0}
					onclick={() => (draft.income.shards -= 1)}>−</button
				>
				<output class="count">{draft.income.shards}</output>
				<button class="toggle" aria-label="One shard more" onclick={() => (draft.income.shards += 1)}>+</button>
			</div>
		</section>

		<section>
			<p class="sum">
				<span class="gain" class:none={earned.favour === 0}>+{earned.favour} favour</span>
				→ {earned.total}, {earned.tier.label}{#if rises}{' '}<span class="why">(a rise in standing)</span>{/if}
			</p>
			<p class="sum">
				<span class="gain">+{earned.gold} gc</span>
				– {earned.tier.income} gc{#if draft.income.shards}{' '}and {draft.income.shards} × {earned.tier.per_shard} gc{/if}, into the stash
			</p>
		</section>

		<section>
			<h3 class="heading"><span>Experience</span><span class="rule"></span></h3>
			<p class="hint">For {draft.rows.length} fighters.</p>
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

		<section>
			<h3 class="heading"><span>Battle history</span><span class="rule"></span></h3>
			<div class="toggles">
				<button
					class="toggle"
					aria-pressed={draft.income.record}
					disabled={!draft.income.result}
					onclick={() => (draft.income.record = !draft.income.record)}
				>
					Add to the battle history
				</button>
			</div>
			{#if draft.income.recorded}
				{@const r = draft.income.recorded}
				<p class="note">Already in the history: {displayDate(r.date)} {opponent(r)} – {RESULT_LABELS[r.result]}</p>
			{/if}
			{#if draft.income.result && draft.income.record}
				<input
					type="text"
					placeholder="Opponent's warband"
					aria-label="Opponent's warband"
					autocomplete="off"
					bind:value={draft.income.opponentWarband}
				/>
				<input
					type="text"
					placeholder="Opponent's name"
					aria-label="Opponent's name"
					autocomplete="off"
					bind:value={draft.income.opponentPlayer}
				/>
			{/if}
		</section>
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

	.toggle:disabled {
		opacity: 0.5;
	}

	/* The shards between their two buttons, as wide as one of them. */
	.count {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		font-family: 'Alegreya', serif;
		font-size: calc(20 * var(--t));
		font-variant-numeric: lining-nums tabular-nums;
		color: var(--card-ink);
	}

	/* What step 4 comes to, a line for the favour and one for the gold. */
	.sum {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
	}

	.why {
		font-style: italic;
	}

	/* The fields as on the card's own back: a lighter patch of the paper. */
	input {
		width: 100%;
		margin: 0;
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
		background: var(--card-field);
		border: 0;
		border-radius: calc(6 * var(--u));
		outline: none;
		appearance: none;
	}

	input:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}
</style>
