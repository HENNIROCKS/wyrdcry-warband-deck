<script lang="ts" module>
	import type { AbilityOption, RenownOption, RenownPick, TalentOption } from '../renown';
	import type { RenownBranch, StatKey } from '../types/warband';

	/** What a level can be spent on besides a characteristic, and what the fighter's name has to do with it. */
	export interface TalentOffer {
		options: TalentOption[];
		/** Magical abilities the fighter may learn instead of a talent. */
		abilities: AbilityOption[];
		/** Set where the fighter has no name of its own, or shares it: the label of the field asking for one. */
		namePrompt: string | null;
		name: string;
		taken: (name: string) => boolean;
	}

	/* Shared with the back of a fighter's card, which spends a level the same way. */
	export const LABELS: Record<StatKey, string> = {
		move: 'Move',
		fight: 'Fight',
		shoot: 'Shoot',
		defense: 'Armour',
		health: 'Health',
		bravery: 'Bravery'
	};

	/* Move is measured in inches, Bravery is a roll to beat. */
	export function figure(key: StatKey, value: number): string {
		if (key === 'move') return `${value}"`;
		if (key === 'bravery') return `${value}+`;
		return String(value);
	}

	/**
	 * What picking the option does to the figure. A blocked one shows the figure
	 * as it stands: an arrow to a value it may not reach reads as an offer.
	 */
	export function change(option: RenownOption): string {
		const from = figure(option.characteristic, option.from);
		return option.blocked ? from : `${from} → ${figure(option.characteristic, option.to)}`;
	}

	export const BLOCKED = { limit: 'At its racial limit', repeat: 'Already raised by a henchman level' } as const;

	export const NOTES: Record<RenownBranch, string> = {
		henchman: 'A henchman raises a characteristic, and never the same one twice.',
		promotion:
			'This level promotes the henchman to HERO – the card shows it already. A hero raises a characteristic or picks a Heroic Talent.',
		hero: 'A hero raises a characteristic or picks a Heroic Talent.',
		none: 'This fighter has neither the HERO nor the HENCHMAN keyword, so the rules do not say what its renown is worth. A characteristic can be raised.'
	};

	/** A level a talent could be picked for. */
	export function offersTalent(branch: RenownBranch): boolean {
		return branch === 'hero' || branch === 'promotion';
	}

	/** Whether any characteristic or talent is still free to take. */
	export function anythingOpen(options: RenownOption[], talents: TalentOffer | null): boolean {
		return (
			options.some((o) => o.blocked === null) ||
			(talents?.options.some((o) => o.blocked === null) ?? false) ||
			(talents?.abilities.some((a) => a.blocked === null) ?? false)
		);
	}
</script>

<script lang="ts">
	import TalentPicker from './TalentPicker.svelte';

	let {
		instanceId,
		name,
		level,
		branch,
		options,
		talents,
		waiting,
		onspend,
		onclose
	}: {
		instanceId: string;
		name: string;
		level: number;
		branch: RenownBranch;
		options: RenownOption[];
		talents: TalentOffer | null;
		/** Further levels still open after this one. */
		waiting: number;
		/** The pick confirmed, or null where nothing could be taken. */
		onspend: (pick: RenownPick | null) => void | Promise<void>;
		onclose: () => void;
	} = $props();

	const open = $derived(anythingOpen(options, talents));
	let showTalents = $state<string | null>(null);
	const talking = $derived(showTalents === `${instanceId}:${level}`);

	/* The sheet stays mounted while the next level comes in, so a pick is tied to
	   the level it was made for and counts only while that option is still free. */
	const at = $derived(`${instanceId}:${level}`);
	let chosen = $state<{ at: string; key: StatKey } | null>(null);
	const picked = $derived(
		chosen?.at === at ? (options.find((o) => o.characteristic === chosen?.key && o.blocked === null) ?? null) : null
	);

	/* A second tap while the write is still running would spend the same level
	   twice. Cleared once the write is over, whether it held or not. */
	let writing = $state<string | null>(null);
	const busy = $derived(writing === at);

	async function confirm(pick: RenownPick | null) {
		if (busy) return;
		writing = at;
		try {
			await onspend(pick);
		} finally {
			writing = null;
		}
	}
</script>

<div class="backdrop">
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="renown-title">
		<h2 id="renown-title">{name}</h2>
		<p class="count">
			Renown {level}{#if waiting > 0}{' '}· {waiting} more waiting{/if}
		</p>
		<p class="note">
			{NOTES[branch]}
		</p>

		{#if talents}
			<div class="tabs" role="group" aria-label="What to spend the level on">
				<button aria-pressed={!talking} class:on={!talking} onclick={() => (showTalents = null)}>
					Characteristics
				</button>
				<button aria-pressed={talking} class:on={talking} onclick={() => (showTalents = at)}>
					Heroic Talents
				</button>
			</div>
		{/if}

		{#if talking && talents}
			<TalentPicker
				variant="sheet"
				options={talents.options}
				abilities={talents.abilities}
				name={talents.name}
				namePrompt={talents.namePrompt}
				taken={talents.taken}
				onpick={confirm}
			/>
		{:else}
		<div class="options">
			{#each options as option (option.characteristic)}
				<button
					class="option"
					class:on={picked?.characteristic === option.characteristic}
					aria-pressed={picked?.characteristic === option.characteristic}
					disabled={option.blocked !== null}
					onclick={() => (chosen = { at, key: option.characteristic })}
				>
					<span class="label">{LABELS[option.characteristic]}</span>
					<span class="change">
						{change(option)}
					</span>
					{#if option.blocked}
						<span class="why">{BLOCKED[option.blocked]}</span>
					{/if}
				</button>
			{/each}
		</div>
		{#if talents && !options.some((o) => o.blocked === null)}
			<p class="note out">No characteristic can be raised – choose a heroic talent.</p>
		{/if}
		{/if}

		<div class="actions">
			<button class="ghost" onclick={onclose}>Decide later</button>
			{#if talking}
				<!-- The talent picker has its own confirm button. -->
			{:else if options.some((o) => o.blocked === null)}
				<button disabled={!picked || busy} onclick={() => picked && confirm({ kind: 'stat', option: picked })}>
					{#if picked}
						Raise {LABELS[picked.characteristic]} to {figure(picked.characteristic, picked.to)}
					{:else}
						Choose a characteristic
					{/if}
				</button>
			{:else if !open}
				<button disabled={busy} onclick={() => confirm(null)}>Use up this level</button>
			{/if}
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
		background: var(--ui-backdrop);
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

	.note {
		margin: 0 0 12px;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: var(--ui-t-sm);
		color: var(--ui-text-muted);
		background: var(--ui-surface-2);
	}

	.out {
		margin: 12px 0 0;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.option {
		display: grid;
		grid-template-columns: 1fr auto;
		align-items: center;
		column-gap: 12px;
		min-height: 44px;
		padding: 10px 12px;
		border: 1px solid var(--ui-border);
		border-radius: 10px;
		font-size: var(--ui-t-md);
		text-align: left;
		background: var(--ui-surface-2);
		color: var(--ui-text);
	}

	/* The inset ring thickens the 1px border to 2px without moving the row. */
	.option.on {
		background: var(--ui-accent-bg);
		border-color: var(--ui-accent-text);
		box-shadow: inset 0 0 0 1px var(--ui-accent-text);
	}

	/* Dimmed, but the reason stays at full strength: it is the one line of a
	   blocked row that has to be read. */
	.option:disabled .label,
	.option:disabled .change {
		opacity: 0.55;
	}

	.label {
		font-weight: 600;
	}

	.change {
		font-variant-numeric: tabular-nums;
		color: var(--ui-accent-text, var(--ui-accent));
	}

	.why {
		grid-column: 1 / -1;
		font-size: var(--ui-t-sm);
		color: var(--ui-text);
	}

	.tabs {
		display: flex;
		margin-bottom: 12px;
		border-bottom: 1px solid var(--ui-border);
	}

	.tabs button {
		flex: 1;
		min-height: 44px;
		padding: 8px 12px;
		border: 0;
		border-bottom: 3px solid transparent;
		margin-bottom: -1px;
		background: transparent;
		font-size: var(--ui-t-md);
		font-weight: 600;
		color: var(--ui-text-muted);
	}

	.tabs button.on {
		border-bottom-color: var(--ui-accent-text, var(--ui-accent));
		color: var(--ui-text);
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

	.actions button:disabled {
		color: var(--ui-text-muted);
		background: var(--ui-surface);
	}

	.actions .ghost {
		background: var(--ui-surface-2);
		color: var(--ui-text);
	}
</style>
