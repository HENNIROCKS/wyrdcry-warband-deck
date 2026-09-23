<script lang="ts">
	import { explain } from '../explanation';
	import { fitText } from '../fit-text';
	import type { CardValue } from '../types/card';

	let { rows }: { rows: CardValue[] } = $props();
</script>

<!-- Each row fits on its own: a long value would otherwise pull the labels down
     with it, and those have room left. -->
<div class="box">
	<div class="row head" use:fitText>
		{#each rows as row (row.key)}
			<div class="col label"><span data-fit>{row.label}</span></div>
		{/each}
	</div>
	<div class="row values" use:fitText>
		{#each rows as row (row.key)}
			{#if row.explanation}
				<button
					class="col value explained"
					onclick={() => row.explanation && explain(row.explanation)}
					aria-label="{row.label} {row.value}, how it adds up"
				>
					<span data-fit>{row.value}</span>
				</button>
			{:else}
				<div class="col value" class:modified={row.modified}><span data-fit>{row.value}</span></div>
			{/if}
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

	/* Standing carries a word where the other columns carry figures; past the
	   floor the fit action stops at, it is cut rather than run into the next. */
	.value {
		color: var(--card-ink);
		font-size: calc(20 * var(--t) * var(--fit, 1));
		white-space: nowrap;
		overflow: hidden;
		padding: 0 calc(4 * var(--u));
	}

	/* Differs from the profile value: override or armour. */
	.modified {
		color: var(--card-green);
		box-shadow: inset 0 calc(-3 * var(--u)) 0 calc(-1 * var(--u)) var(--card-green);
	}

	/* The cell stays the target a thumb aims at; the mark sits on the figure.
	   Type, size and alignment come from `.col` and `.value`, which a button
	   obeys like any other element. */
	.explained {
		appearance: none;
		border: 0;
		background: none;
		cursor: pointer;
	}

	/*
	 * A value that does not stand in the profile the way it reads here, tagged
	 * the way the keywords above are tagged. The tag belongs to the figure – a
	 * filled cell would read as a state of the table instead.
	 */
	/* A link, not a surface: six marked cells side by side read as a state of the
	   table, while an underlined figure stays a figure that offers something. */
	.explained span {
		color: var(--card-link);
		text-decoration: underline;
		text-decoration-thickness: 1px;
		text-underline-offset: 0.14em;
	}
</style>
