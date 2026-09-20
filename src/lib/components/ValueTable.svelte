<script lang="ts">
	import { fitText } from '../fit-text';
	import type { CardValue } from '../types/card';

	let { rows }: { rows: CardValue[] } = $props();
</script>

<div class="box" use:fitText>
	<div class="row head">
		{#each rows as row (row.key)}
			<div class="col label"><span data-fit>{row.label}</span></div>
		{/each}
	</div>
	<div class="row values">
		{#each rows as row (row.key)}
			<div class="col value" class:modified={row.modified}>{row.value}</div>
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
		/* Equal columns: without this a label that does not wrap widens its own
		   column at the cost of the others. */
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.15;
		text-align: center;
		/* Grenze Gotisch defaults to old-style figures, which reach 77% of the cap
		   height the column labels are set in and hang below the baseline. The
		   lining set matches the labels; the tabular one keeps the digits of a
		   column over each other. */
		font-variant-numeric: lining-nums tabular-nums;
	}

	/*
	 * Two layers of the same word, as on the printed card: the cell cuts it out of
	 * the texture, the span paints it again in solid paper. What shows is the
	 * paper, a touch heavier for the textured edge underneath it.
	 */
	/* Past the floor the fit action stops at, a label would run into the next
	   column – it is cut there instead. */
	.label {
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
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
		padding: 0 calc(4 * var(--u));
	}

	/* Differs from the profile value: override or armour. */
	.modified {
		color: var(--card-green);
		box-shadow: inset 0 calc(-3 * var(--u)) 0 calc(-1 * var(--u)) var(--card-green);
	}
</style>
