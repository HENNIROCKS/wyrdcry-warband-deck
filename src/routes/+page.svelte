<script lang="ts">
	import { onMount } from 'svelte';

	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	import Deck from '$lib/components/Deck.svelte';
	import ImportPrompt from '$lib/components/ImportPrompt.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import { toCards } from '$lib/adapter';
	import {
		allocate,
		isWavering,
		nextRound,
		outOfAction,
		remaining,
		start,
		toggle,
		toggleWaiting,
		undoRound
	} from '$lib/battle';
	import { allWarbands, deleteWarband, putBattle, putWarband, requestPersistence } from '$lib/storage';
	import { ImportError, exportWarband, readFile, toStored, type ImportCandidate } from '$lib/transfer';
	import type { BattleState, StoredWarband } from '$lib/types/warband';

	let warbands = $state<StoredWarband[]>([]);
	let activeId = $state<string | null>(null);
	let candidate = $state<ImportCandidate | null>(null);
	/* The warband a delete has been asked for, held until it is confirmed. */
	let condemned = $state<StoredWarband | null>(null);
	let message = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	const active = $derived(warbands.find((w) => w.warband.id === activeId) ?? null);
	const cards = $derived(active ? toCards(active.warband, active.selections) : []);
	const battle = $derived(active?.battle ?? null);
	const fighterIds = $derived(active?.warband.fighters.map((f) => f.instanceId) ?? []);
	const left = $derived(remaining(battle, fighterIds));
	const out = $derived(outOfAction(battle, fighterIds));
	const wavering = $derived(isWavering(battle, fighterIds));

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

	/**
	 * The campaign lives here and in whatever was exported, so this is the one
	 * action in the app that loses data for good. Hence the name in the question
	 * and the export within reach of it.
	 */
	async function confirmDelete() {
		if (!condemned) return;
		const gone = condemned.warband.name;
		await deleteWarband(condemned.warband.id);
		condemned = null;
		await refresh();
		message = `${gone} deleted.`;
	}

	async function exportCondemned() {
		if (!condemned) return;
		const result = await exportWarband(condemned, false);
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
				<a href="{base}/build">Build a warband…</a>
				<button onclick={() => fileInput?.click()}>Import…</button>
				{#if active}
					<hr />
					<button onclick={() => doExport(false)}>Export</button>
					<button onclick={() => doExport(true)} title="Dated copy, never overwritten">
						Snapshot
					</button>
					<hr />
					<button class="danger" onclick={() => (condemned = active)}>Delete…</button>
				{/if}
				{#if dev}
					<hr />
					<a href="{base}/dev">Open on your phone</a>
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
						{#if out > 0}
							<p class:wavering>
								{out} out of action{#if wavering}{' '}· Wavering{/if}
							</p>
						{/if}
						<button onclick={() => setBattle(nextRound(battle))}>Next round</button>
						{#if battle.undo}
							<button onclick={() => setBattle(undoRound(battle))}>
								Back to round {battle.undo.round}
							</button>
						{/if}
						<hr />
						<button onclick={() => setBattle(null)}>End battle</button>
						{#if out > 0}
							<!-- What the aftermath sequence will ask for is exactly this count,
							     and ending the battle is where it goes. -->
							<p class="hint">Ending it drops the wounds and who is out of action.</p>
						{/if}
					{:else}
						<p>No battle</p>
						<button onclick={() => setBattle(start())}>Start battle</button>
					{/if}
				{/snippet}
			</MenuButton>
		{/if}

		<a class="icon-button" href="{base}/info" aria-label="About" title="About">
			<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
				<circle cx="12" cy="12" r="9" />
				<path d="M12 11v5" />
				<path d="M12 7.6v.5" />
			</svg>
		</a>
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
	<Deck
		{cards}
		{battle}
		ontoggle={(id) => setBattle(toggle(battle, id))}
		onwait={(id) => setBattle(toggleWaiting(battle, id))}
		onwound={(id, delta, health) => setBattle(allocate(battle, id, delta, health))}
	/>
{:else}
	<div class="empty">
		<h2>No warband yet</h2>
		<p>
			Build one here step by step, or export it from the Warband Builder as JSON
			and import that. Either way the data stays on this device.
		</p>
		<a class="go" href="{base}/build">Build a warband</a>
		<button onclick={() => fileInput?.click()}>Import a file</button>
	</div>
{/if}

{#if candidate}
	<ImportPrompt
		{candidate}
		onconfirm={confirmImport}
		oncancel={() => (candidate = null)}
	/>
{/if}

{#if condemned}
	<div class="backdrop">
		<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title">
			<h2 id="delete-title">Delete {condemned.warband.name}?</h2>
			<p class="count">
				{condemned.warband.fighters.length} fighters · Revision {condemned.revision}
			</p>
			<p class="note danger">
				<strong>This cannot be undone.</strong> The warband and the battle it is in the
				middle of are on this device only. Export it first if the campaign is to be kept.
			</p>
			<div class="actions">
				<button class="ghost" onclick={() => (condemned = null)}>Cancel</button>
				<button class="ghost" onclick={exportCondemned}>Export</button>
				<button class="danger" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px;
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
		font-size: var(--ui-t-xl);
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
		font-size: var(--ui-t-lg);
		font-weight: 600;
	}

	.tools {
		display: flex;
		flex: none;
		gap: 6px;
	}

	/* Inside the battle menu, under the round line. */
	.wavering {
		color: var(--ui-warn-text);
	}

	.hint {
		color: var(--ui-text-subtle);
	}

	.message {
		margin: 0;
		padding: 9px 12px;
		font-size: var(--ui-t-base);
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
		font-size: var(--ui-t-2xl);
	}

	.empty p {
		margin: 0;
		max-width: 34ch;
		font-size: var(--ui-t-md);
		line-height: 1.5;
		color: var(--ui-text-muted);
	}

	.empty .go {
		margin-top: 6px;
		padding: 12px 20px;
		border-radius: 10px;
		background: var(--ui-accent);
		color: #fff;
		font-size: var(--ui-t-lg);
		font-weight: 600;
	}

	.empty button {
		padding: 10px 18px;
		font-size: var(--ui-t-md);
		color: var(--ui-text);
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
	}

	/* The same sheet the import asks from, because both are a question about a
	   warband that is about to be overwritten or lost. */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		padding: 12px;
		padding-bottom: calc(12px + env(safe-area-inset-bottom));
	}

	.sheet {
		width: 100%;
		max-width: 420px;
		padding: 16px;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 14px;
	}

	.sheet h2 {
		margin: 0;
		font-size: var(--ui-t-xl);
		overflow-wrap: anywhere;
	}

	.count {
		margin: 3px 0 12px;
		font-size: var(--ui-t-base);
		color: var(--ui-text-muted);
	}

	.note {
		margin: 0;
		padding: 10px 12px;
		font-size: var(--ui-t-md);
		line-height: 1.45;
		border-radius: 10px;
		background: var(--ui-surface-2);
	}

	.note.danger {
		background: rgba(185, 28, 28, 0.18);
		color: #fca5a5;
	}

	.actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}

	.actions button {
		flex: 1;
		padding: 12px;
		font-size: var(--ui-t-lg);
		font-weight: 600;
		color: #fff;
		background: var(--ui-accent);
		border: 0;
		border-radius: 10px;
	}

	.actions .ghost {
		color: var(--ui-text);
		background: var(--ui-surface-2);
	}

	.actions .danger {
		background: var(--ui-danger);
	}
</style>
