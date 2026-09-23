<script lang="ts">
	import { dismiss, explanation } from '../explanation';
	import type { StatLayer } from '../types/card';

	const open = $derived(explanation());

	/* The base layer carries the profile value, every other one what it adds. */
	function amount(layer: StatLayer): string {
		if (layer.kind === 'base') return String(layer.amount);
		return layer.amount >= 0 ? `+${layer.amount}` : String(layer.amount);
	}

	/* Focus belongs in the dialog while it is open, and back where it came from
	   afterwards – with aria-modal set, the keyboard would otherwise carry on
	   through the card behind it. */
	let sheet: HTMLDivElement | undefined = $state();

	$effect(() => {
		if (!open) return;
		const before = document.activeElement;
		sheet?.focus();
		return () => {
			if (before instanceof HTMLElement) before.focus();
		};
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (open && event.key === 'Escape') dismiss();
	}}
/>

{#if open}
	<!-- Clicking the backdrop closes; the sheet itself swallows the click. The
	     keyboard reaches the same thing through Escape above. -->
	<div
		class="backdrop"
		role="presentation"
		onclick={(event) => {
			if (event.target === event.currentTarget) dismiss();
		}}
	>
		<div
			class="sheet"
			role="dialog"
			aria-modal="true"
			aria-labelledby="explanation-title"
			tabindex="-1"
			bind:this={sheet}
		>
			<div class="top">
				<h2 id="explanation-title">{open.title}</h2>
				{#if open.result}<p class="result">{open.result}</p>{/if}
			</div>

			<ul class="layers">
				{#each open.facts ?? [] as fact (fact.label)}
					<li>
						<span>{fact.label}</span>
						<span class="amount">{fact.value}</span>
					</li>
				{/each}
				{#each open.layers ?? [] as layer, i (layer.source + i)}
					<li>
						<span>{layer.source}</span>
						<span class="amount">{amount(layer)}</span>
					</li>
				{/each}
			</ul>

			{#each open.rules ?? [] as rule, i (rule.label + i)}
				<div class="condition">
					<p class="name">{rule.label}</p>
					<p class="text">{rule.text}</p>
				</div>
			{/each}

			{#if open.conditions?.length}
				<p class="legend">Only in the right situation</p>
				{#each open.conditions ?? [] as condition, i (condition.name + i)}
					<div class="condition">
						<p class="name">
							{condition.name}
							<span class="from">{condition.source}</span>
							{#if condition.amount !== undefined}
								<span class="amount">+{condition.amount}</span>
							{/if}
						</p>
						<p class="text">{condition.text}</p>
					</div>
				{/each}
			{/if}

			<button class="close" onclick={dismiss}>Close</button>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(0, 0, 0, 0.72);
		padding: 16px;
		padding-bottom: calc(16px + env(safe-area-inset-bottom));
	}

	/*
	 * The card's own colours, because this explains what is on the card – but
	 * flat paper rather than the texture: it lies over a parchment that already
	 * carries one, and two of them lose the edge between the two surfaces.
	 *
	 * Sizes are in pixels, not in card units. Those scale with the card's
	 * container, and this sheet stands outside it.
	 */
	.sheet:focus {
		outline: none;
	}

	.sheet {
		width: 100%;
		max-width: 420px;
		max-height: 100%;
		overflow-y: auto;
		background: var(--card-paper);
		color: var(--card-ink);
		border: 1px solid var(--card-green);
		border-radius: 14px;
		padding: 16px;
	}

	.top {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 12px;
	}

	h2 {
		margin: 0;
		font-family: 'Grenze Gotisch', serif;
		font-size: 22px;
		font-weight: 400;
	}

	.result {
		margin: 0;
		font-family: 'Grenze Gotisch', serif;
		font-size: 28px;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.layers {
		margin: 12px 0 0;
		padding: 0;
		list-style: none;
		border-top: 1px solid var(--card-green);
	}

	/* The list ends on a rule; the first block below it needs to stand clear of
	   that line rather than hang off it. */
	.layers + .condition {
		margin-top: 14px;
	}

	.layers li {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		padding: 7px 0;
		border-bottom: 1px solid rgba(22, 117, 74, 0.3);
		font-family: 'Alegreya', serif;
		font-size: 15px;
	}

	.amount {
		font-family: 'Grenze Gotisch', serif;
		font-variant-numeric: lining-nums tabular-nums;
	}

	/* Alegreya carries the small capitals here; Grenze Gotisch never does. */
	.legend {
		margin: 14px 0 8px;
		font-family: 'Alegreya', serif;
		font-size: 12px;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--card-ink-muted);
	}

	/*
	 * On the card a wash alone sets a box off, because it lightens the texture
	 * underneath. This sheet is flat paper, where the same wash stands at
	 * 1.2:1 and all but disappears – so the edge does the work here.
	 */
	.condition {
		margin-bottom: 8px;
		margin-top: 8px;
		padding: 10px 12px;
		border: 1px solid rgba(22, 117, 74, 0.35);
		border-radius: 10px;
		background: var(--card-wash-2);
	}

	.name {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin: 0 0 3px;
		font-family: 'Alegreya', serif;
		font-size: 15px;
		font-weight: 700;
	}

	/* What it is worth where it applies – the card knows the number, only not
	   the moment. */
	.name .amount {
		margin-left: auto;
	}

	.from {
		font-weight: 400;
		color: var(--card-ink-muted);
	}

	.text {
		margin: 0;
		font-family: 'Alegreya', serif;
		font-size: 15px;
		line-height: 1.45;
	}

	/*
	 * The button on the card, in the unit this sheet is built in: it rounds at
	 * calc(7.5 * var(--u)) and sets at calc(26 * var(--t)), and on a phone both
	 * units sit on their floor – 0.72px and 0.9px. Only the size is held back to
	 * the scale of the sheet, whose own heading runs at 22px.
	 */
	.close {
		width: 100%;
		margin-top: 14px;
		padding: 10px;
		font-family: 'Grenze Gotisch', serif;
		font-size: 20px;
		line-height: 1;
		letter-spacing: 0.06em;
		color: var(--card-paper);
		background: var(--card-green);
		border: 0;
		border-radius: 5px;
		cursor: pointer;
	}
</style>
