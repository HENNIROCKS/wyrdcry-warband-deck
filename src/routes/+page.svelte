<script lang="ts">
	import { onMount } from 'svelte';

	import { dev } from '$app/environment';

	import Deck from '$lib/components/Deck.svelte';
	import ImportPrompt from '$lib/components/ImportPrompt.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import { toCards } from '$lib/adapter';
	import { nextRound, remaining, start, toggle, undoRound } from '$lib/battle';
	import { allWarbands, putBattle, putWarband, requestPersistence } from '$lib/storage';
	import { ImportError, exportWarband, readFile, toStored, type ImportCandidate } from '$lib/transfer';
	import type { BattleState, StoredWarband } from '$lib/types/warband';

	let warbands = $state<StoredWarband[]>([]);
	let activeId = $state<string | null>(null);
	let candidate = $state<ImportCandidate | null>(null);
	let message = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	const active = $derived(warbands.find((w) => w.warband.id === activeId) ?? null);
	const cards = $derived(active ? toCards(active.warband) : []);
	const battle = $derived(active?.battle ?? null);
	const left = $derived(
		remaining(battle, active?.warband.fighters.map((f) => f.instanceId) ?? [])
	);

	/**
	 * Writes the battle state through and keeps the copy in memory in step. It
	 * goes to the database on every tap: at the table the screen goes dark long
	 * before anyone thinks about saving.
	 */
	async function setBattle(next: BattleState | null) {
		if (!active) return;
		active.battle = next;
		await putBattle(active.warband.id, next ? ($state.snapshot(next) as BattleState) : null);
	}

	onMount(refresh);

	async function refresh() {
		warbands = await allWarbands();
		if (!warbands.some((w) => w.warband.id === activeId)) {
			activeId = warbands[0]?.warband.id ?? null;
		}
	}

	async function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		/* Reset, otherwise the same file does not fire a change event twice. */
		input.value = '';
		if (!file) return;

		try {
			candidate = await readFile(file);
			message = null;
		} catch (error) {
			message = error instanceof ImportError ? error.message : 'That file could not be read.';
		}
	}

	async function confirmImport() {
		if (!candidate) return;
		/* IndexedDB clones structurally and trips over the reactivity proxy, so take
		   a plain object out of it first. */
		const entry = toStored($state.snapshot(candidate) as ImportCandidate);
		await putWarband(entry);
		await requestPersistence();
		activeId = entry.warband.id;
		candidate = null;
		await refresh();
		message = null;
	}

	async function doExport(snapshot: boolean) {
		if (!active) return;
		const result = await exportWarband(active, snapshot);
		if (result === 'downloaded') message = 'Downloaded as a file.';
		else if (result === 'shared') message = 'Shared.';
	}
</script>

<header class="bar">
	<div class="identity">
		{#if warbands.length > 1}
			<select bind:value={activeId} aria-label="Choose warband">
				{#each warbands as entry (entry.warband.id)}
					<option value={entry.warband.id}>{entry.warband.name}</option>
				{/each}
			</select>
		{:else if active}
			<h1>{active.warband.name}</h1>
		{:else}
			<h1>Warband Deck</h1>
		{/if}
	</div>

	<div class="tools">
		<MenuButton label="Warband file">
			{#snippet icon()}
				<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
					<path d="M8 8l4-5 4 5" />
					<path d="M12 3v13" />
				</svg>
			{/snippet}
			{#snippet children()}
				<button onclick={() => fileInput?.click()}>Import…</button>
				{#if active}
					<hr />
					<button onclick={() => doExport(false)}>Export</button>
					<button onclick={() => doExport(true)} title="Dated copy, never overwritten">
						Snapshot
					</button>
				{/if}
				{#if dev}
					<hr />
					<a href="/dev">Open on your phone</a>
				{/if}
			{/snippet}
		</MenuButton>

		{#if active}
			<MenuButton label="Battle">
				{#snippet icon()}
					<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M4 3h3l11 11" />
						<path d="M20 3h-3L6 14" />
						<path d="M14.5 16.5 18 20l2-2-3.5-3.5" />
						<path d="M9.5 16.5 6 20l-2-2 3.5-3.5" />
					</svg>
				{/snippet}
				{#snippet children()}
					{#if battle}
						<p>Round {battle.round} · {left} to act</p>
						<button onclick={() => setBattle(nextRound(battle))}>Next round</button>
						{#if battle.undo}
							<button onclick={() => setBattle(undoRound(battle))}>
								Back to round {battle.undo.round}
							</button>
						{/if}
						<hr />
						<button onclick={() => setBattle(null)}>End battle</button>
					{:else}
						<p>No battle</p>
						<button onclick={() => setBattle(start())}>Start battle</button>
					{/if}
				{/snippet}
			</MenuButton>
		{/if}
	</div>
</header>

<input
	bind:this={fileInput}
	type="file"
	accept="application/json,.json"
	onchange={onPick}
	hidden
/>

{#if message}
	<p class="message">{message}</p>
{/if}

{#if cards.length}
	<Deck {cards} {battle} ontoggle={(id) => setBattle(toggle(battle, id))} />
{:else}
	<div class="empty">
		<h2>No warband yet</h2>
		<p>
			Export your warband from the Warband Builder as JSON and import it here.
			The data stays on this device.
		</p>
		<button onclick={() => fileInput?.click()}>Choose file</button>
	</div>
{/if}

{#if candidate}
	<ImportPrompt
		{candidate}
		onconfirm={confirmImport}
		oncancel={() => (candidate = null)}
	/>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 9px 12px 10px;
		background: var(--ui-header-bg);
		border-bottom: 1px solid var(--ui-border);
	}

	.identity {
		display: flex;
		flex: 1;
		min-width: 0;
	}

	h1 {
		margin: 0;
		font-size: 17px;
		font-weight: 600;
		/* Single line: the name must not eat into the card area. */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	select {
		max-width: 100%;
		background: var(--ui-surface);
		color: var(--ui-text);
		border: 1px solid var(--ui-border);
		border-radius: 8px;
		padding: 5px 8px;
		font-size: 15px;
		font-weight: 600;
	}

	.tools {
		display: flex;
		flex: none;
		gap: 6px;
	}

	.message {
		margin: 0;
		padding: 9px 12px;
		font-size: 13px;
		background: var(--ui-surface);
		border-bottom: 1px solid var(--ui-border);
	}

	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		padding: 24px 28px;
		text-align: center;
	}

	.empty h2 {
		margin: 0;
		font-size: 19px;
	}

	.empty p {
		margin: 0;
		max-width: 34ch;
		font-size: 14px;
		line-height: 1.5;
		color: var(--ui-text-muted);
	}

	.empty button {
		margin-top: 6px;
		padding: 12px 20px;
		border: 0;
		border-radius: 10px;
		background: var(--ui-accent);
		color: #fff;
		font-size: 15px;
		font-weight: 600;
	}
</style>
