<script lang="ts">
	import { onMount } from 'svelte';

	import { dev } from '$app/environment';

	import Deck from '$lib/components/Deck.svelte';
	import ImportPrompt from '$lib/components/ImportPrompt.svelte';
	import { toCards } from '$lib/adapter';
	import { allWarbands, putWarband, requestPersistence } from '$lib/storage';
	import { ImportError, exportWarband, readFile, toStored, type ImportCandidate } from '$lib/transfer';
	import type { StoredWarband } from '$lib/types/warband';

	let warbands = $state<StoredWarband[]>([]);
	let activeId = $state<string | null>(null);
	let candidate = $state<ImportCandidate | null>(null);
	let message = $state<string | null>(null);
	let fileInput: HTMLInputElement | undefined = $state();

	const active = $derived(warbands.find((w) => w.warband.id === activeId) ?? null);
	const cards = $derived(active ? toCards(active.warband) : []);

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
		{#if active}
			<p class="sub">{active.warband.fighters.length} fighters · Rev {active.revision}</p>
		{/if}
	</div>

	<div class="tools">
		{#if dev}
			<a class="devlink" href="/dev" title="Open on your phone">QR</a>
		{/if}
		<button onclick={() => fileInput?.click()}>Import</button>
		{#if active}
			<button onclick={() => doExport(false)}>Export</button>
			<button class="ghost" onclick={() => doExport(true)} title="Dated copy, never overwritten">
				Snapshot
			</button>
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
	<Deck {cards} />
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
		flex-direction: column;
		gap: 8px;
		padding: 9px 12px 10px;
		background: var(--ui-header-bg);
		border-bottom: 1px solid var(--ui-border);
	}

	.identity {
		display: flex;
		align-items: baseline;
		gap: 8px;
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

	.sub {
		margin: 0;
		flex: none;
		white-space: nowrap;
		font-size: 11px;
		color: var(--ui-text-subtle);
		font-variant-numeric: tabular-nums;
	}

	.tools {
		display: flex;
		gap: 6px;
	}

	.tools button {
		/* Equal width and generous – the bar is operated one-handed at the table. */
		flex: 1;
		padding: 10px 8px;
		border: 1px solid var(--ui-border);
		border-radius: 9px;
		background: var(--ui-surface);
		font-size: 13px;
		font-weight: 600;
	}

	.tools .ghost {
		color: var(--ui-text-muted);
	}

	/* Only visible in the dev server. */
	.devlink {
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		padding: 10px 12px;
		border: 1px solid var(--ui-border);
		border-radius: 9px;
		background: var(--ui-surface);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
		color: var(--ui-text-muted);
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
