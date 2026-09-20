<script lang="ts">
	import type { CardStat } from '../types/card';

	let { stats }: { stats: CardStat[] } = $props();

	/** Move carries inches, Bravery a target number – as the printed card writes them. */
	function format(stat: CardStat): string {
		if (stat.key === 'move') return stat.value === 0 ? '0' : `${stat.value}"`;
		if (stat.key === 'bravery') return `${stat.value}+`;
		return String(stat.value);
	}
</script>

<div class="box">
	<div class="row head">
		{#each stats as stat (stat.key)}
			<div class="col label"><span>{stat.label}</span></div>
		{/each}
	</div>
	<div class="row values">
		{#each stats as stat (stat.key)}
			<div class="col value" class:modified={stat.modified}>{format(stat)}</div>
		{/each}
	</div>
</div>

<style>
	.box {
		border: 1px solid var(--card-green);
		border-radius: calc(7.5 * var(--u));
		overflow: hidden;
	}

	.row {
		display: flex;
		height: calc(46 * var(--u));
	}

	.head {
		background: var(--card-green);
	}

	.values {
		background: var(--card-wash);
	}

	.col {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.15;
		text-align: center;
	}

	/*
	 * Two layers of the same word, as on the printed card: the cell cuts it out of
	 * the texture, the span paints it again in solid paper. What shows is the
	 * paper, a touch heavier for the textured edge underneath it.
	 */
	.label {
		font-size: calc(20 * var(--u));
		background: url('/background.jpg') center center / cover no-repeat;
		background-clip: text;
		-webkit-background-clip: text;
		color: transparent;
	}

	.label span {
		color: var(--card-paper);
	}

	.value {
		color: var(--card-ink);
		white-space: nowrap;
		/* Grenze Gotisch's old-style figures sit 1–2px below the optical centre of
		   their line box, while values with a descender sit slightly above it. */
		padding: 0 calc(4 * var(--u)) calc(3 * var(--u));
	}

	/* Differs from the profile value: override or armour. */
	.modified {
		color: var(--card-green);
		box-shadow: inset 0 calc(-3 * var(--u)) 0 calc(-1 * var(--u)) var(--card-green);
	}
</style>
