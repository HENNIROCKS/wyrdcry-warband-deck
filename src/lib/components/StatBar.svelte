<script lang="ts">
	import type { CardStat } from '../types/card';

	let { stats }: { stats: CardStat[] } = $props();
</script>

<div class="bar">
	{#each stats as stat (stat.key)}
		<div class="stat" class:modified={stat.modified}>
			<span class="label">{stat.label}</span>
			<span class="value">{stat.value}</span>
		</div>
	{/each}
</div>

<style>
	.bar {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 4px;
	}

	.stat {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 5px 0 6px;
		border-radius: 8px;
		background: rgba(0, 0, 0, 0.22);
	}

	.label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		color: var(--parchment-ink-muted);
	}

	.value {
		font-size: 20px;
		font-weight: 700;
		line-height: 1;
		font-variant-numeric: tabular-nums;
		color: var(--parchment-ink);
	}

	/* Abweichung vom Profilwert: Override oder Rüstung. */
	.modified {
		background: var(--ui-accent-bg);
		box-shadow: inset 0 0 0 1px rgba(22, 117, 74, 0.55);
	}

	.modified .value {
		color: #0f5537;
	}
</style>
