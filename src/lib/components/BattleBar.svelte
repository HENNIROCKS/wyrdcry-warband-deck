<script lang="ts">
	import { isWavering, remaining } from '../battle';
	import type { BattleState, FighterBattleState } from '../types/warband';

	let {
		battle = null,
		state = null,
		health = 0,
		fighters = [],
		ontoggle,
		onwait,
		onwound
	}: {
		battle?: BattleState | null;
		/** The fighter on top of the stack. Null while the warband card is up. */
		state?: FighterBattleState | null;
		/** Health as that fighter's card works it out. */
		health?: number;
		/** Every fighter of the warband, for the count and the morale. */
		fighters?: string[];
		ontoggle?: () => void;
		onwait?: () => void;
		onwound?: (delta: number) => void;
	} = $props();

	/* What is left of Health, which is what the stepper counts – the card writes
	   damage over critical damage with a slash, and that pairing is the weapon's. */
	const left = $derived(state ? Math.max(0, health - state.damage) : 0);
	const unknown = $derived(health <= 0);

	const left_to_act = $derived(remaining(battle, fighters));
	const wavering = $derived(isWavering(battle, fighters));
</script>

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

		<div class="states">
			<button
				class="icon-button"
				aria-pressed={state.waiting}
				aria-label="Waiting"
				title="Waiting"
				onclick={() => onwait?.()}
			>
				<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M7 3h10" />
					<path d="M7 21h10" />
					<path d="M7 3v3.5l5 5 5-5V3" />
					<path d="M7 21v-3.5l5-5 5 5V21" />
				</svg>
			</button>
			<button
				class="icon-button"
				aria-pressed={state.activated}
				aria-label="Activated"
				title="Activated"
				onclick={() => ontoggle?.()}
			>
				<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M6 6l12 12" />
					<path d="M18 6 6 18" />
				</svg>
			</button>
		</div>
	{:else if battle}
		<!-- The warband card carries the battle instead of a fighter's state: the
		     morale belongs to the warband, and the bar keeps its height either way. -->
		<p class="summary">
			Round {battle.round} · {left_to_act} to act{#if wavering}{' '}<span class="wavering">Wavering</span>{/if}
		</p>
	{:else}
		<p class="summary quiet">No battle</p>
	{/if}
</div>

<style>
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

	.icon-button {
		width: 48px;
		height: 44px;
	}

	.icon-button[aria-pressed='true'] {
		background: var(--ui-accent);
		border-color: var(--ui-accent);
		color: #fff;
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
