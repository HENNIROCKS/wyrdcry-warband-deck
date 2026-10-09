<script lang="ts" module>
	import type { TalentOption } from '../renown';

	export const TALENT_BLOCKED: Record<NonNullable<TalentOption['blocked']>, string> = {
		specialization: 'A third specialization',
		limit: 'Already has five talents',
		repeat: 'Already taken'
	};
</script>

<script lang="ts">
	import { MAX_SPECIALIZATIONS, MAX_TALENTS, type AbilityOption, type RenownPick } from '../renown';
	import { SPECIALIZATIONS } from '../rules/types';
	import RuleText from './RuleText.svelte';

	let {
		options,
		abilities,
		variant,
		name,
		namePrompt,
		taken,
		onpick
	}: {
		options: TalentOption[];
		/** Magical abilities to learn instead of a talent; the group is left out where there are none. */
		abilities: AbilityOption[];
		/** Where it sits: a sheet over the deck, or the back of a card. */
		variant: 'sheet' | 'card';
		/** The name the fighter carries now; empty while it only has its profile's. */
		name: string;
		/** Why the talent needs a name of its own, or null where the current one will do. */
		namePrompt: string | null;
		/** Whether another fighter answers to a name typed in. */
		taken: (name: string) => boolean;
		onpick: (pick: RenownPick) => void | Promise<void>;
	} = $props();

	let chosen = $state<string | null>(null);
	let chosenAbility = $state<string | null>(null);
	let weaponId = $state<string | null>(null);
	let typed = $state('');
	let busy = $state(false);

	const learning = $derived(abilities.find((a) => a.id === chosenAbility && a.blocked === null) ?? null);
	const selected = $derived(options.find((o) => o.talent.id === chosen && o.blocked === null) ?? null);
	const weapon = $derived(selected?.weapons?.find((w) => w.id === weaponId) ?? null);
	const needsWeapon = $derived(selected?.talent.weapon !== undefined);
	const wanted = $derived(namePrompt !== null);
	const given = $derived(wanted ? typed.trim() : name.trim());
	const nameProblem = $derived(
		!wanted ? null : given === '' ? 'Give the fighter a name.' : taken(given) ? 'Another fighter has this name.' : null
	);
	const ready = $derived(selected !== null && (!needsWeapon || weapon !== null) && nameProblem === null && !busy);

	function select(id: string) {
		chosen = chosen === id ? null : id;
		chosenAbility = null;
		weaponId = null;
	}

	function learn(id: string) {
		chosenAbility = chosenAbility === id ? null : id;
		chosen = null;
	}

	async function pickAbility() {
		if (!learning || busy) return;
		busy = true;
		try {
			await onpick({ kind: 'ability', ability: { id: learning.id, name: learning.name } });
		} finally {
			busy = false;
		}
	}

	async function confirm() {
		if (!selected || !ready) return;
		busy = true;
		try {
			await onpick({ kind: 'talent', talent: selected.talent, weapon, name: wanted ? given : null });
		} finally {
			busy = false;
		}
	}
</script>

<div class="picker in-{variant}">
	<p class="hint">
		Up to {MAX_TALENTS} talents, from at most {MAX_SPECIALIZATIONS} specializations.
	</p>
	{#if abilities.length}
		<h4 class="group">Magical ability</h4>
		{#each abilities as ability (ability.id)}
			{@const open = learning?.id === ability.id}
			<div class="item" class:open>
				<button class="head" aria-expanded={open} disabled={ability.blocked !== null} onclick={() => learn(ability.id)}>
					<span class="line">
						{ability.name}
						{#if ability.blocked}<span class="why">Already learned another</span>{/if}
					</span>
					<span class="kind">Instead of a talent</span>
				</button>
				{#if open}
					<div class="detail">
						<p class="text"><RuleText text={ability.text} /></p>
						<button class="confirm" disabled={busy} onclick={pickAbility}>Pick {ability.name}</button>
					</div>
				{/if}
			</div>
		{/each}
	{/if}
	{#each SPECIALIZATIONS as specialization (specialization)}
		<h4 class="group">{specialization}</h4>
		{#each options.filter((o) => o.talent.specialization === specialization) as option (option.talent.id)}
			{@const open = selected?.talent.id === option.talent.id}
			<div class="item" class:open>
				<button class="head" aria-expanded={open} disabled={option.blocked !== null} onclick={() => select(option.talent.id)}>
					<span class="line">
						{option.talent.name}
						{#if option.blocked}<span class="why">{TALENT_BLOCKED[option.blocked]}</span>{/if}
					</span>
					<span class="kind">{option.talent.type}</span>
				</button>
				{#if open}
					<div class="detail">
						<p class="text"><RuleText text={option.talent.text} /></p>
						{#if option.weapons}
							<div class="weapons" role="group" aria-label="Weapon type">
								{#each option.weapons as w (w.id)}
									<button class="weapon" class:on={weaponId === w.id} aria-pressed={weaponId === w.id} onclick={() => (weaponId = w.id)}>
										{w.name}
									</button>
								{:else}
									<p class="why">No {option.talent.weapon} weapon to select.</p>
								{/each}
							</div>
						{/if}
						{#if namePrompt}
							<label class="field">
								<span>{namePrompt}</span>
								<input type="text" autocomplete="off" placeholder="Name this fighter" bind:value={typed} />
							</label>
							{#if typed.trim() !== '' && nameProblem}<p class="why">{nameProblem}</p>{/if}
						{/if}
						<button class="confirm" disabled={!ready} onclick={confirm}>Pick {option.talent.name}</button>
					</div>
				{/if}
			</div>
		{/each}
	{/each}
</div>

<style>
	.picker {
		--p-gap: 8px;
		display: flex;
		flex-direction: column;
		gap: var(--p-gap);
	}

	.picker.in-sheet {
		--p-bg: var(--ui-surface-2);
		--p-border: var(--ui-border);
		--p-accent: var(--ui-accent-text, var(--ui-accent));
		--p-action: var(--ui-accent);
		--p-on-action: #fff;
		--p-ink: var(--ui-text);
		--p-muted: var(--ui-text-muted);
		--p-radius: 10px;
		--p-box: 10px;
		--p-size: var(--ui-t-md);
		--p-small: var(--ui-t-sm);
	}

	.picker.in-card {
		--p-bg: var(--card-field);
		--p-box: calc(24 * var(--u));
		--p-border: var(--card-green);
		--p-accent: var(--card-green);
		--p-action: var(--card-green);
		--p-on-action: var(--card-paper);
		--p-ink: var(--card-ink);
		--p-muted: var(--card-ink-muted);
		--p-radius: 999px;
		--p-size: calc(18 * var(--t));
		--p-small: calc(18 * var(--t));
		font-family: 'Alegreya', serif;
	}

	.hint,
	.group {
		margin: 0;
		font-size: var(--p-small);
		color: var(--p-muted);
	}

	.group {
		margin-top: 6px;
		font-weight: 600;
		text-transform: capitalize;
	}

	.weapon,
	.confirm {
		min-height: 44px;
		padding: 8px 14px;
		border: 1px solid var(--p-border);
		border-radius: var(--p-radius);
		background: var(--p-bg);
		color: var(--p-ink);
		font: inherit;
		font-size: var(--p-size);
		text-align: left;
	}

	/* A talent is a pill until it is opened; opened, the same outline holds its
	   text and the choices and becomes a box. */
	.item {
		border: 1px solid var(--p-border);
		border-radius: var(--p-radius);
		background: var(--p-bg);
		overflow: hidden;
	}

	.item.open {
		border-radius: var(--p-box);
		border-color: var(--p-accent);
	}

	.head {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		min-height: 44px;
		padding: 8px 14px;
		border: 0;
		background: transparent;
		color: var(--p-ink);
		font: inherit;
		font-size: var(--p-size);
		text-align: left;
	}

	.item:has(.head:disabled) {
		border-color: color-mix(in srgb, var(--p-border) 35%, transparent);
	}

	.head:disabled {
		color: var(--p-muted);
	}

	.weapon.on {
		border-color: var(--p-accent);
		box-shadow: inset 0 0 0 1px var(--p-accent);
	}

	.line {
		flex: 1;
		min-width: 0;
	}

	.kind {
		flex: none;
		font-size: var(--p-small);
		color: var(--p-accent);
		text-transform: capitalize;
	}

	.head:disabled .kind {
		color: inherit;
	}

	.why {
		display: block;
		margin: 0;
		font-size: var(--p-small);
		color: var(--p-ink);
	}

	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--p-gap);
		padding: 0 14px 14px;
	}

	.text {
		margin: 0;
		font-size: var(--p-size);
		color: var(--p-ink);
	}

	.weapons {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: var(--p-small);
		color: var(--p-ink);
	}

	.field input {
		min-height: 44px;
		padding: 6px 14px;
		border: 1px solid var(--p-border);
		border-radius: var(--p-radius);
		background: var(--p-bg);
		color: var(--p-ink);
		font: inherit;
		font-size: max(16px, var(--p-size));
	}

	.confirm {
		text-align: center;
		font-weight: 600;
		background: var(--p-action);
		color: var(--p-on-action);
	}

	.confirm:disabled {
		background: var(--p-bg);
		color: var(--p-muted);
	}

	/* On the card the name field is the back's own text field: a lighter patch of
	   the paper, edged in green while it is written in. */
	.in-card .field input {
		min-height: 0;
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		border: 0;
		border-radius: calc(6 * var(--u));
		background: var(--card-field);
		line-height: 1.4;
		font-size: calc(18 * var(--t));
		outline: none;
		appearance: none;
	}

	.in-card .field input::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	.in-card .field input:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}
</style>
