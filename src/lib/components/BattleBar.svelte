<script lang="ts">
	import MenuButton from './MenuButton.svelte';
	import { isWavering, remaining } from '../battle';
	import type { BattleState, FighterBattleState } from '../types/warband';

	let {
		battle = null,
		state = null,
		health = 0,
		hero = false,
		fighters = [],
		height = $bindable(0),
		ontoggle,
		onwait,
		onwound,
		onheroic,
		oncover,
		onedit
	}: {
		battle?: BattleState | null;
		/** The fighter on top of the stack. Null while the warband card is up. */
		state?: FighterBattleState | null;
		/** Health as that fighter's card works it out. */
		health?: number;
		/** Whether that fighter is a `HERO`, and so has a heroic reaction to spend. */
		hero?: boolean;
		/** Every fighter of the warband, for the count and the morale. */
		fighters?: string[];
		/**
		 * What the bar occupies at the foot of the window, read back by the deck:
		 * the bar is out of the flow, so the cards have to be kept clear of it by
		 * hand.
		 */
		height?: number;
		ontoggle?: () => void;
		onwait?: () => void;
		onwound?: (delta: number) => void;
		onheroic?: () => void;
		oncover?: () => void;
		/** Opens the sheet to edit the card on top of the deck. */
		onedit?: () => void;
	} = $props();

	/* What is left of Health, which is what the stepper counts – the card writes
	   damage over critical damage with a slash, and that pairing is the weapon's. */
	const left = $derived(state ? Math.max(0, health - state.damage) : 0);
	const unknown = $derived(health <= 0);

	const left_to_act = $derived(remaining(battle, fighters));
	const wavering = $derived(isWavering(battle, fighters));
</script>

<!-- Fixed to the window rather than sitting at the end of the deck: at the
     table the thumb reaches the foot of the screen, and a bar that travels with
     the layout ends up under the browser's own furniture. -->
<div class="dock" bind:offsetHeight={height}>
	<div class="bar">
	{#if state}
		<div class="wounds">
			<button
				class="step"
				disabled={unknown || left === 0}
				aria-label="Allocate a damage point"
				onclick={() => onwound?.(1)}
			>
				&minus;
			</button>
			<span class="readout" aria-live="polite">
				{#if unknown}
					&mdash;
				{:else}
					{left} <span class="of">({health})</span>
				{/if}
			</span>
			<button
				class="step"
				disabled={unknown || state.damage === 0}
				aria-label="Take back a damage point"
				onclick={() => onwound?.(-1)}
			>
				+
			</button>
		</div>

		<!-- Every state of a fighter under one word each, rather than a row of
		     symbols that has to be learned. -->
		<div class="states">
			<!-- No mark on the trigger: every state it holds is already written across
			     the card above it, and the strokes at its head carry it through the
			     stack. -->
			<MenuButton label="Fighter state">
				{#snippet icon()}
					<!-- A word rather than three dots, for the same reason the entries
					     behind it are words. Not "Conditions": the rules spend that one
					     on a scenario's victory conditions. -->
					<span class="label">State</span>
				{/snippet}
				<button onclick={() => ontoggle?.()}>
					<span class="tick" aria-hidden="true">{state.activated ? '✓' : ''}</span>
					Activated
				</button>
				<button onclick={() => onwait?.()}>
					<span class="tick" aria-hidden="true">{state.waiting ? '✓' : ''}</span>
					Waiting
				</button>
				{#if hero}
					<button onclick={() => onheroic?.()}>
						<span class="tick" aria-hidden="true">{state.heroic ? '✓' : ''}</span>
						Heroic reaction used
					</button>
				{/if}
				<button onclick={() => oncover?.()}>
					<span class="tick" aria-hidden="true">{state.cover ? '✓' : ''}</span>
					In cover
				</button>
			</MenuButton>
			{@render editMenu()}
		</div>
	{:else if battle}
		<!-- The warband card carries the battle instead of a fighter's state: the
		     morale belongs to the warband, and the bar keeps its height either way. -->
		<p class="summary">
			Round {battle.round} · {left_to_act} to act{#if wavering}{' '}<span class="wavering">Wavering</span>{/if}
		</p>
		<div class="states">
			{@render editMenu()}
		</div>
	{:else}
		<p class="summary quiet">No battle</p>
		<div class="states">
			{@render editMenu()}
		</div>
	{/if}
	</div>
</div>

{#snippet pencil()}
	<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		<path d="M17 3a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
	</svg>
{/snippet}

{#snippet editMenu()}
	<MenuButton label="Edit">
		{#snippet icon()}{@render pencil()}{/snippet}
		<button onclick={() => onedit?.()}>Edit…</button>
	</MenuButton>
{/snippet}

<style>
	.dock {
		position: fixed;
		left: 0;
		right: 0;
		bottom: 0;
		/* Over the cards, under the explanation overlay and the import sheet. */
		z-index: 3;
		background: var(--ui-header-bg);
		border-top: 1px solid var(--ui-border);
		/* Its own, because the page no longer carries one at the foot. */
		padding-bottom: env(safe-area-inset-bottom);
	}

	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		/* Held whatever the bar carries, so the deck does not change height when a
		   swipe brings the warband card up. */
		min-height: 52px;
		width: 100%;
		max-width: calc(var(--deck-max-width) + 2 * var(--deck-gutter));
		margin-inline: auto;
		padding: 5px var(--deck-gutter) 0;
	}

	.wounds,
	.states {
		display: flex;
		align-items: center;
		gap: 6px;
	}

	/* Wider than it is tall: the two steppers sit next to each other and a thumb
	   aiming between them must not land on the other one. */
	.step {
		width: 52px;
		height: 44px;
		padding: 0;
		border: 1px solid var(--ui-border);
		border-radius: 10px;
		background: var(--ui-surface);
		color: var(--ui-text);
		font-size: var(--ui-t-2xl);
		line-height: 1;
	}

	.step:disabled {
		color: var(--ui-text-subtle);
		background: var(--ui-header-bg);
	}

	.readout {
		min-width: 5ch;
		text-align: center;
		font-size: var(--ui-t-xl);
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	/* The ceiling, not the reading: it is there to say what the figure counts down
	   from. */
	.of {
		font-weight: 400;
		font-size: var(--ui-t-base);
		color: var(--ui-text-muted);
	}

	/* The trigger belongs to `MenuButton` and carries the header's 38px from
	   `app.css`. At the table it is aimed at with a thumb over a card, so here it
	   takes the height the damage steppers next to it have, and the width its
	   word asks for. */
	.states :global(.icon-button) {
		width: auto;
		min-width: 48px;
		height: 44px;
		padding: 0 11px;
	}

	.label {
		font-size: var(--ui-t-md);
		font-weight: 600;
	}

	/* Holds the column the entries line up in, whether an entry is ticked or not. */
	.tick {
		display: inline-block;
		width: 1.2em;
		color: var(--ui-accent);
	}

	.summary {
		margin: 0;
		font-size: var(--ui-t-md);
		font-variant-numeric: tabular-nums;
		color: var(--ui-text-muted);
	}

	.summary.quiet {
		color: var(--ui-text-subtle);
	}

	.wavering {
		margin-left: 4px;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--ui-warn-bg);
		color: var(--ui-warn-text);
		font-size: var(--ui-t-sm);
		font-weight: 600;
	}
</style>
