<script lang="ts">
	import { onMount, untrack } from 'svelte';

	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	import AftermathBack from '$lib/components/AftermathBack.svelte';
	import CardBack, { type BackRenown } from '$lib/components/CardBack.svelte';
	import Deck from '$lib/components/Deck.svelte';
	import ImportPrompt from '$lib/components/ImportPrompt.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import RenownSheet from '$lib/components/RenownSheet.svelte';
	import { toCards } from '$lib/adapter';
	import { applyAftermath, startAftermath, type AftermathAnswer, type AftermathDraft } from '$lib/aftermath';
	import { countedFighters } from '$lib/morale';
	import {
		allocate,
		isWavering,
		nextRound,
		outOfAction,
		remaining,
		start,
		toggle,
		toggleCover,
		toggleHeroic,
		togglePanicked,
		toggleWaiting,
		undoRound,
		waveringThreshold
	} from '$lib/battle';
	import { applyDraft, emptyPending, type EditDraft } from '$lib/edit';
	import { explain } from '$lib/explanation';
	import { earnedLevels, limitFor, optionsFor, spend, type RenownOption } from '$lib/renown';
	import { FIGHTERS } from '$lib/gamedata';
	import { RACIAL_LIMITS } from '$lib/rules';
	import { allWarbands, chooseWarband, chosenWarband, deleteWarband, putBattle, putWarband, requestPersistence } from '$lib/storage';
	import { rosterPdf } from '$lib/roster-pdf';
	import { ImportError, exportWarband, readFile, shareFile, toStored, type ExportResult, type ImportCandidate } from '$lib/transfer';
	import type { DeckCard } from '$lib/types/card';
	import type { BattleState, PendingRenown, StatKey, StoredWarband } from '$lib/types/warband';

	let warbands = $state<StoredWarband[]>([]);
	let activeId = $state<string | null>(null);
	let candidate = $state<ImportCandidate | null>(null);
	/* The instanceId of the card turned over, 'warband' included. */
	let editingId = $state<string | null>(null);
	/* What the turned card's back is for: editing it, or the experience a battle
	   just ending is worth, asked on the warband card before the battle itself
	   is thrown away. Like the drafts below, it is left in place when the card
	   is turned again, so the back still has something to show while it turns
	   out of view. */
	let turned = $state<'edit' | 'aftermath'>('edit');
	let draft = $state<EditDraft | null>(null);
	let aftermath = $state<AftermathDraft | null>(null);
	/* A draft belongs to the warband it was started on: another one coming up
	   ends the edit rather than writing the draft into it. */
	$effect(() => {
		void activeId;
		untrack(() => (editingId = null));
	});
	/* The warband a delete has been asked for, held until it is confirmed. */
	let condemned = $state<StoredWarband | null>(null);
	/* Set while the renown sheet is up, asking what the next open level is spent on. */
	let renownOpen = $state(false);
	let message = $state<string | null>(null);
	let messageTimer: ReturnType<typeof setTimeout> | undefined;
	let fileInput: HTMLInputElement | undefined = $state();

	const active = $derived(warbands.find((w) => w.warband.id === activeId) ?? null);
	const cards = $derived(active ? toCards(active.warband, active.selections, active.fluff, active.history, active.renownHistory) : []);
	/* Levels waiting for a choice, minus those of a fighter an import has since removed. */
	const pendingRenown = $derived(
		(active?.pendingRenown ?? []).filter((e) => active?.warband.fighters.some((f) => f.instanceId === e.instanceId))
	);
	const nextRenown = $derived(pendingRenown[0] ?? null);
	const renownView = $derived(active && nextRenown ? renownChoice(active, cards, nextRenown) : null);

	/* The keywords a fighter has before an edit or an aftermath: they decide which
	   rule each new level falls under. */
	function keywordsOf(id: string): string[] {
		const card = cards.find((c) => c.instanceId === id);
		return card?.kind === 'fighter' ? card.keywords : [];
	}

	/** What a pending level can be spent on, read off the fighter's card in `stored`. */
	function renownChoice(stored: StoredWarband, deck: DeckCard[], pending: PendingRenown) {
		const instance = stored.warband.fighters.find((f) => f.instanceId === pending.instanceId);
		const card = deck.find((c) => c.instanceId === pending.instanceId);
		if (!instance || card?.kind !== 'fighter') return null;
		/* The base layer is the profile's own figure; the file's override and the gear sit above it. */
		const profile = Object.fromEntries(
			card.stats.map((stat) => [stat.key, stat.layers.find((l) => l.kind === 'base')?.amount ?? stat.value])
		) as Record<StatKey, number>;
		const options = card.stats.length
			? optionsFor(profile, instance, pending.branch, stored.renownHistory ?? [], limitFor(card.keywords, RACIAL_LIMITS))
			: [];
		return { name: card.name, options };
	}

	/*
	 * The levels the fighter on the back can spend, worked out on the warband as
	 * Done would store it – so a level raised on the back is there to spend, and
	 * one spent there moves the figures the next one starts from.
	 */
	const backRenown = $derived.by((): BackRenown | null => {
		if (!active || !editingId || !draft?.fighter) return null;
		const provisional = applyDraft(active, editingId, draft, keywordsOf);
		const queue = (provisional.pendingRenown ?? []).filter((e) => e.instanceId === editingId);
		const next = queue[0] ?? null;
		const deck = toCards(provisional.warband, provisional.selections, provisional.fluff, provisional.history, provisional.renownHistory);
		return {
			next: next && { level: next.level, branch: next.branch, options: renownChoice(provisional, deck, next)?.options ?? [] },
			waiting: queue.length
		};
	});
	const battle = $derived(active?.battle ?? null);
	const counted = $derived(active ? countedFighters(active.warband) : []);
	const left = $derived(
		remaining(
			battle,
			counted.map((f) => f.instanceId)
		)
	);
	const out = $derived(outOfAction(battle, counted));
	const wavering = $derived(isWavering(battle, counted));
	/** Where the wavering bubble hangs: the tail reaches into the header's padding, up to the select.
	    The layout's safe-area inset above the header comes on top, in the bubble's own style. */
	let headerHeight = $state(0);

	/**
	 * A count of fighters, where a faction rule can make one worth half: `2½`.
	 * Any other fraction is written as a decimal rather than rounded to a half.
	 */
	function fighterCount(count: number): string {
		const whole = Math.floor(count);
		if (count - whole !== 0.5) return String(count);
		return `${whole || ''}½`;
	}

	/* What the bubble means, and the count behind it. The rules text is not in the
	   game data, so the sheet says it in a line of its own and points to the page
	   that writes it. */
	function explainWavering() {
		explain({
			title: 'Wavering',
			summary:
				'Half the warband is out of action. Each fighter takes a Bravery test when first activated in a round – on a fail it is panicked until the round ends.',
			facts: [
				{ label: 'Fighters in the warband', value: String(counted.length) },
				{ label: 'Out of action', value: fighterCount(out) },
				{ label: 'Wavering from (half, rounding up)', value: String(waveringThreshold(counted)) }
			],
			link: {
				label: 'The End Phase on wyrdcry.net',
				href: 'https://wyrdcry.net/docs/rules/the-end-phase'
			}
		});
	}

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

	/**
	 * Applies the experience earned and ends the battle in one write, so a
	 * closed sheet never leaves xp granted but the battle still running, or the
	 * reverse. Revision rises because this is the first thing that changes a
	 * warband after it was built – unlike a battle tap, it is campaign progress.
	 */
	async function applyAftermathAndEnd(
		answers: Map<string, AftermathAnswer>,
		bonusInstanceId: string | null
	) {
		if (!active) return;
		const snapshot = $state.snapshot(active);
		const warband = applyAftermath(snapshot.warband, answers, bonusInstanceId);
		const levels = earnedLevels(snapshot.warband, warband, keywordsOf);
		const pending = [...(snapshot.pendingRenown ?? []), ...levels];
		const entry: StoredWarband = {
			...snapshot,
			warband,
			battle: null,
			pendingRenown: pending.length ? pending : null,
			revision: snapshot.revision + 1,
			updatedAt: new Date().toISOString()
		};
		await putWarband(entry);
		renownOpen = levels.length > 0;
		await refresh();
	}

	/** Spends the open level in one write, then goes on to the next one or closes. */
	async function spendRenown(option: RenownOption | null) {
		if (!active || !nextRenown) return;
		const snapshot = $state.snapshot(active);
		try {
			await putWarband(spend(snapshot, { ...nextRenown }, option ? { ...option } : null));
		} catch {
			notify('The choice could not be saved.', 'error');
			return;
		}
		await refresh();
		if (!nextRenown) renownOpen = false;
	}

	/** Turns the warband card over to ask what the battle was worth in experience. */
	function endBattle() {
		if (!active) return;
		const fighters = cards.filter((c) => c.kind === 'fighter');
		aftermath = startAftermath(active.warband, fighters, battle);
		turned = 'aftermath';
		editingId = 'warband';
	}

	/* Ended before the write, like `saveEdit`, so a second tap finds nothing to apply. */
	async function finishAftermath() {
		if (!aftermath || !editingId) return;
		const values = $state.snapshot(aftermath);
		editingId = null;
		await applyAftermathAndEnd(new Map(Object.entries(values.answers)), values.bonus);
	}

	function startEdit(id: string) {
		if (!active) return;
		const isWarband = id === 'warband';
		const instance = active.warband.fighters.find((f) => f.instanceId === id);
		const levels = [...(active.renownHistory ?? []), ...(active.pendingRenown ?? [])]
			.filter((e) => e.instanceId === id)
			.map((e) => e.level);
		draft = {
			fighter: instance
				? {
						name: instance.customName,
						placeholder: FIGHTERS.get(instance.fighterId)?.name ?? instance.fighterId,
						xp: instance.xp,
						renown: instance.renown,
						renownFloor: Math.max(0, ...levels),
						spent: []
					}
				: null,
			notes: isWarband ? active.warband.factionNotes : (instance?.notes ?? ''),
			fluff: isWarband ? (active.fluff?.warband ?? '') : (active.fluff?.fighters[id] ?? ''),
			history: isWarband ? $state.snapshot(active.history ?? []) : null,
			removed: [],
			pending: emptyPending()
		};
		turned = 'edit';
		editingId = id;
	}

	/**
	 * Writes everything the back of the card holds in one go, the same way
	 * `applyAftermathAndEnd` writes the aftermath: a snapshot first, `revision`
	 * up because this is campaign progress, then one `putWarband`.
	 */
	async function saveEdit() {
		if (!active || !editingId || !draft) return;
		const snapshot = $state.snapshot(active);
		const values = $state.snapshot(draft);
		const targetId = editingId;
		/* Ended before the write rather than after it, so a second tap on Done
		   finds nothing to save instead of adding a pending battle twice. */
		editingId = null;
		await putWarband(applyDraft(snapshot, targetId, values, keywordsOf));
		await refresh();
	}

	/* Set once the remembered warband has been read. Before that, activeId is
	   still null and writing it would forget the choice before it was restored. */
	let restored = $state(false);

	onMount(async () => {
		activeId = await chosenWarband().catch(() => null);
		await refresh();
		restored = true;
	});

	$effect(() => {
		const id = activeId;
		if (restored) chooseWarband(id).catch(() => {});
	});

	async function refresh() {
		warbands = await allWarbands();
		if (!warbands.some((w) => w.warband.id === activeId)) {
			activeId = warbands[0]?.warband.id ?? null;
		}
	}

	/**
	 * A confirmation goes away on its own; an error stays until it is closed,
	 * because it has to be read. Either replaces whatever was showing.
	 */
	function notify(text: string | null, kind: 'notice' | 'error' = 'notice') {
		clearTimeout(messageTimer);
		message = text;
		if (text && kind === 'notice') messageTimer = setTimeout(() => (message = null), 4000);
	}

	async function onPick(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		/* Reset, otherwise the same file does not fire a change event twice. */
		input.value = '';
		if (!file) return;

		try {
			candidate = await readFile(file);
			notify(null);
		} catch (error) {
			notify(error instanceof ImportError ? error.message : 'That file could not be read.', 'error');
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
		notify(null);
	}

	function reportShare(result: ExportResult) {
		if (result === 'downloaded') notify('Downloaded as a file.');
		else if (result === 'shared') notify('Shared.');
	}

	async function doExport(snapshot: boolean) {
		if (!active) return;
		reportShare(await exportWarband(active, snapshot));
	}

	/* Building takes a moment on a phone, loading pdfmake and the fonts on the
	   first run. A second tap meanwhile would build it twice. */
	let buildingRoster = false;

	async function doRoster() {
		if (!active || buildingRoster) return;
		buildingRoster = true;
		notify('Building the roster…');
		try {
			reportShare(await shareFile(await rosterPdf($state.snapshot(active) as StoredWarband)));
		} catch (error) {
			notify(`The roster could not be built: ${error instanceof Error ? error.message : error}`, 'error');
		} finally {
			buildingRoster = false;
		}
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
		notify(`${gone} deleted.`);
	}

	async function exportCondemned() {
		if (!condemned) return;
		reportShare(await exportWarband(condemned, false));
	}
</script>

<!-- Out of reach while a card is turned over: a draft is written on Done, and
     what the header does – another warband, an import, a delete, the builder –
     would leave it behind. -->
<header class="bar" class:locked={editingId !== null} inert={editingId !== null} bind:offsetHeight={headerHeight}>
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
					<button onclick={doRoster}>Roster (PDF)</button>
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
								{fighterCount(out)} out of action{#if wavering}{' '}· Wavering{/if}
							</p>
						{/if}
						<button onclick={() => setBattle(nextRound(battle))}>Next round</button>
						{#if battle.undo}
							<button onclick={() => setBattle(undoRound(battle))}>
								Back to round {battle.undo.round}
							</button>
						{/if}
						<hr />
						<button onclick={endBattle}>End battle</button>
						<p class="hint">Asks who earned experience, then drops the wounds and who is out of action.</p>
					{:else}
						<p>No battle</p>
						<button onclick={() => setBattle(start())}>Start battle</button>
					{/if}
					{#if pendingRenown.length}
						<hr />
						<button onclick={() => (renownOpen = true)}>Spend renown ({pendingRenown.length})</button>
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

<!-- The live region stands whether or not the bubble does, so a screen reader is
     told when the warband starts wavering – a region that appears together with
     its content is not announced. -->
<div role="status">
	{#if battle && wavering}
		<!-- Over the top edge of the cards on purpose: the morale is the one state
		     that has to be seen from every card, and the tail points at the
		     warband's name. Tapped, it says how the count stands. -->
		<button class="bubble" style:top="calc(env(safe-area-inset-top) + {headerHeight - 4}px)" onclick={explainWavering}>
			Wavering
		</button>
	{/if}
</div>

<input
	bind:this={fileInput}
	type="file"
	accept="application/json,.json"
	onchange={onPick}
	hidden
/>

{#if message}
	<div class="message" role="status">
		<p>{message}</p>
		<button onclick={() => notify(null)}>Close</button>
	</div>
{/if}

{#if cards.length}
	<Deck
		{cards}
		{counted}
		{battle}
		{wavering}
		ontoggle={(id) => setBattle(toggle(battle, id))}
		onwait={(id) => setBattle(toggleWaiting(battle, id))}
		onwound={(id, delta, health) => setBattle(allocate(battle, id, delta, health))}
		onheroic={(id) => setBattle(toggleHeroic(battle, id))}
		oncover={(id) => setBattle(toggleCover(battle, id))}
		onpanicked={(id) => setBattle(togglePanicked(battle, id))}
		editing={editingId !== null}
		turnTo={editingId}
		onedit={startEdit}
		ondone={turned === 'aftermath' ? finishAftermath : saveEdit}
		doneLabel={turned === 'aftermath' ? 'Apply and end battle' : 'Done'}
		oncancel={() => (editingId = null)}
	>
		{#snippet back(card)}
			{#if turned === 'aftermath' && aftermath}
				<AftermathBack name={card.name} bind:draft={aftermath} />
			{:else if turned === 'edit' && draft}
				<CardBack name={card.name} bind:draft renown={backRenown} />
			{/if}
		{/snippet}
	</Deck>
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

{#if renownOpen && renownView && nextRenown}
	<RenownSheet
		instanceId={nextRenown.instanceId}
		name={renownView.name}
		level={nextRenown.level}
		branch={nextRenown.branch}
		options={renownView.options}
		waiting={pendingRenown.length - 1}
		onspend={spendRenown}
		onclose={() => (renownOpen = false)}
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

	.bar.locked > * {
		opacity: 0.4;
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

	.bubble {
		position: fixed;
		left: 12px;
		z-index: 10;
		margin: 0;
		padding: 5px 12px;
		border: 0;
		border-radius: 10px;
		background: var(--ui-warn);
		color: #fff;
		font-size: var(--ui-t-sm);
		font-weight: 600;
		/* Says it can be tapped. */
		text-decoration: underline;
		text-underline-offset: 2px;
	}

	/* The tap reaches past the drawn bubble, which stays small so it covers as
	   little of the card as it can – sideways and down only, so it does not
	   reach up over the warband select its tail points at. */
	.bubble::after {
		content: '';
		position: absolute;
		inset: 0 -8px -14px;
	}

	/* The tail, pointing up at the name. */
	.bubble::before {
		content: '';
		position: absolute;
		left: 16px;
		bottom: 100%;
		border: 7px solid transparent;
		border-top-width: 0;
		border-bottom-color: var(--ui-warn);
	}

	.hint {
		color: var(--ui-text-subtle);
	}

	.message {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 4px 4px 4px 12px;
		font-size: var(--ui-t-base);
		background: var(--ui-surface);
		border-bottom: 1px solid var(--ui-border);
	}

	.message p {
		flex: 1;
		margin: 0;
	}

	/* The padding gives the thumb a target the height of the bar. */
	.message button {
		flex: none;
		padding: 5px 8px;
		color: var(--ui-text);
		background: none;
		border: 0;
		text-decoration: underline;
		text-underline-offset: 2px;
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
