<script lang="ts" module>
	import type { RenownOption, RenownPick } from '../renown';
	import type { BattleRecord, PhotoCrop, RenownBranch, StoredPhoto } from '../types/warband';

	/** The levels the fighter on this back can spend, on the warband as Done would store it. */
	export interface BackRenown {
		/** The first level still open, and what it can be spent on. */
		next: { level: number; branch: RenownBranch; options: RenownOption[]; talents: TalentOffer | null } | null;
		/** Every level still open, `next` included. */
		waiting: number;
	}

	/** What the fighter on this back carries and could take from the stash, worked out by the page. */
	export interface BackEquipment {
		/** Why nothing can be moved now, or null when it can. */
		blocked: string | null;
		/** Said once for a fighter that takes nothing at all, instead of on every row. */
		takesNothing: string | null;
		/** Names of what the fighter has bought, in the draft's order. */
		carried: string[];
		/** The stash in the draft's order, each with why the fighter cannot take it. */
		stash: { name: string; refused: string | null }[];
		/** What is bought on this back and paid for with Done, in the draft's order. */
		bought: { name: string; cost: number }[];
		/** What can be bought, a group per heading, each row with why it cannot be. */
		shop: { heading: string; rows: BackOffer[] }[];
		/** The gold left once what is bought here is paid for. */
		left: number;
	}

	export interface BackOffer {
		id: string;
		name: string;
		cost: number;
		/** Null where it can be bought; otherwise why not. */
		refused: string | null;
		rare?: boolean;
	}

	/** The warband's stash as its back shows it, worked out by the page. */
	export interface BackStash {
		/** The gold left in the treasury, before what the back adds. */
		left: number;
		items: string[];
	}

	/** What the warband's Purchase pays for, worked out by the page. */
	export interface BackPurchase {
		/** A line per fighter with something to pay for. */
		lines: { name: string; items: string[] }[];
		cost: number;
		/** The gold left once it is paid. */
		left: number;
		/** Why it cannot be paid now, or null when it can. */
		blocked: string | null;
	}

	/** What dismissing the fighter on this back would mean, worked out by the page. */
	export interface BackDismissal {
		/** What the fighter carries, in the order it is stored – the places `toStash` names. */
		equipment: { name: string; cost: number }[];
		/** Why the fighter cannot be dismissed now, or null when it can. */
		blocked: string | null;
		/** Said when dismissing leaves fewer fighters than the faction fields. */
		belowMinimum: string | null;
	}
</script>

<script lang="ts">
	import { tick, untrack } from 'svelte';
	import { CENTRE, MAX_ZOOM, PhotoError, panCrop, photoLayout, readPhoto, zoomCrop } from '../photo';
	import { imageFieldMask } from '../image-field-mask';
	import {
		MAX_XP,
		buy,
		emptyPending,
		goldAdded,
		nameProblem,
		renownFloor,
		sendToStash,
		takeFromStash,
		toRecord,
		unbuy,
		type EditDraft,
		type FighterDraft
	} from '../edit';
	import { DEFAULT_COLOUR, PALETTE, readColour, readable } from '../colour';
	import { RESULT_LABELS, displayDate, newestFirst, opponent } from '../history';
	import { BLOCKED, LABELS, NOTES, anythingOpen, change, type TalentOffer } from './RenownSheet.svelte';
	import TalentPicker from './TalentPicker.svelte';

	let {
		name,
		draft = $bindable(),
		renown = null,
		equipment = null,
		dismissal = null,
		ondismiss,
		purchase = null,
		onpurchase,
		stash = null,
		photo = $bindable(null)
	}: {
		name: string;
		draft: EditDraft;
		renown?: BackRenown | null;
		equipment?: BackEquipment | null;
		dismissal?: BackDismissal | null;
		/** Asks for the fighter to be dismissed, handing what goes to the stash. */
		ondismiss?: (toStash: number[]) => void;
		/** On the warband card: what Purchase would pay for. */
		purchase?: BackPurchase | null;
		/** Pays for everything ordered, written at once rather than with Done. */
		onpurchase?: () => void;
		/** On the warband card: the gold and what lies in the stash. */
		stash?: BackStash | null;
		/** The fighter's photo as it stands in the edit; `changed` says whether Done has to write it. Null on a card that takes none. */
		photo?: { photo: StoredPhoto | null; changed: boolean } | null;
	} = $props();

	let photoInput: HTMLInputElement | undefined = $state();
	let photoError = $state<string | null>(null);

	/* The preview is drawn from an object URL of the photo as it stands in the
	   edit, handed back when the photo is replaced or the back goes away. Moving
	   or zooming keeps the bytes, so it keeps the URL. */
	const stored = $derived(photo?.photo ?? null);
	const bytes = $derived(stored?.bytes ?? null);
	const layout = $derived(stored ? photoLayout(stored.width, stored.height, stored.crop) : null);
	let previewUrl = $state<string | null>(null);
	$effect(() => {
		if (!bytes) {
			previewUrl = null;
			return;
		}
		const url = URL.createObjectURL(new Blob([bytes], { type: untrack(() => stored?.type) }));
		previewUrl = url;
		return () => URL.revokeObjectURL(url);
	});

	let preview: HTMLDivElement | undefined = $state();
	/* The finger doing the dragging; a second one on the preview is left out. */
	let dragFrom: { id: number; x: number; y: number } | null = null;

	/* Every change of the crop is one the edit has to write. */
	function recrop(crop: (c: PhotoCrop) => PhotoCrop) {
		if (!photo?.photo) return;
		photo = { photo: { ...photo.photo, crop: crop(photo.photo.crop) }, changed: true };
	}

	function startDrag(event: PointerEvent) {
		if (dragFrom) return;
		preview?.setPointerCapture(event.pointerId);
		dragFrom = { id: event.pointerId, x: event.clientX, y: event.clientY };
	}

	function endDrag(event: PointerEvent) {
		if (event.pointerId === dragFrom?.id) dragFrom = null;
	}

	function drag(event: PointerEvent) {
		if (!dragFrom || event.pointerId !== dragFrom.id || !preview || !photo?.photo) return;
		const { width, height } = photo.photo;
		const dx = event.clientX - dragFrom.x;
		const dy = event.clientY - dragFrom.y;
		dragFrom = { id: event.pointerId, x: event.clientX, y: event.clientY };
		recrop((c) => panCrop(c, width, height, preview!.clientWidth, dx, dy));
	}

	async function pickPhoto(event: Event) {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		/* Reset, otherwise the same photo does not fire a change event twice. */
		input.value = '';
		if (!file || !photo) return;
		photoError = null;
		try {
			photo = { photo: await readPhoto(file), changed: true };
		} catch (error) {
			photoError = error instanceof PhotoError ? error.message : 'This photo could not be read.';
		}
	}

	/* Places in the fighter's equipment ticked to go to the stash. Off the draft:
	   dismissing is confirmed and written on its own, not by Done. */
	let toStash = $state<number[]>([]);

	function toggleStash(index: number) {
		toStash = toStash.includes(index) ? toStash.filter((i) => i !== index) : [...toStash, index].sort((a, b) => a - b);
	}

	/* The back has a second page for spending a level: it takes the card's place
	   rather than opening a sheet over it, so the choice is part of the draft and
	   Cancel drops it like everything else. */
	let spending = $state(false);
	let article: HTMLElement | undefined = $state();
	let campaign: HTMLElement | undefined = $state();

	const next = $derived(spending ? (renown?.next ?? null) : null);

	/* A second page for buying equipment, the same way: what is bought is part
	   of the draft, and the page stays open for the next piece. */
	let buying = $state(false);
	/* The rare piece asked about: it is found with a Rarity roll at the table
	   first, so a tap asks for the roll rather than buying. */
	let asking = $state<string | null>(null);
	let equipmentSection: HTMLElement | undefined = $state();

	async function showBuying(on: boolean) {
		buying = on;
		asking = null;
		await tick();
		(on ? article : equipmentSection)?.scrollIntoView({ block: 'start' });
	}

	function pick(fighter: FighterDraft, row: BackOffer) {
		if (row.rare && asking !== row.id) {
			asking = row.id;
			return;
		}
		asking = null;
		buy(fighter, row.id);
	}

	/* Gold typed in on the warband card's back, added to the draft with Add. */
	let goldInput = $state('');

	function addGold() {
		const amount = Math.floor(Number(goldInput));
		if (!(amount > 0)) return;
		draft.goldAdded = [...draft.goldAdded, amount];
		goldInput = '';
	}
	const open = $derived(next ? anythingOpen(next.options, next.talents) : false);
	let talking = $state(false);

	async function showSpending(on: boolean) {
		spending = on;
		talking = false;
		await tick();
		/* The page swapped under a finger that was halfway down the card. */
		(on ? article : campaign)?.scrollIntoView({ block: 'start' });
	}

	function choose(pick: RenownPick | null) {
		if (!draft.fighter || !next) return;
		/* The name the talent is written against is the name the field shows, and
		   the field stays the one place that holds it. */
		const nameBefore = pick?.kind === 'talent' && pick.name ? draft.fighter.name : undefined;
		if (pick?.kind === 'talent' && pick.name) draft.fighter.name = pick.name;
		const kept = pick?.kind === 'talent' ? { ...pick, name: null } : pick;
		draft.fighter.spent = [...draft.fighter.spent, { level: next.level, pick: kept, nameBefore }];
		showSpending(false);
	}

	/** Only the last: the choices after a level were offered on the figures it left. */
	function undoLast() {
		if (!draft.fighter) return;
		const last = draft.fighter.spent.at(-1);
		if (last?.nameBefore !== undefined) draft.fighter.name = last.nameBefore;
		draft.fighter.spent = draft.fighter.spent.slice(0, -1);
	}

	const sorted = $derived(draft.history ? newestFirst(draft.history) : []);
	/* A colour picked freely rather than off the palette, which the last swatch then shows. */
	const customColour = $derived(draft.colour !== null && !PALETTE.some((entry) => entry.value === draft.colour));

	function add() {
		const record = toRecord(draft.pending);
		if (!record || !draft.history) return;
		draft.history = [...draft.history, record];
		draft.pending = emptyPending();
	}

	/** The point that would make a fourth is a level of renown instead, as in `applyXp`. */
	function moreXp(fighter: FighterDraft) {
		if (fighter.xp < MAX_XP) {
			fighter.xp += 1;
		} else {
			fighter.xp = 0;
			fighter.renown += 1;
		}
	}

	function toggleRemoved(id: string) {
		draft.removed = draft.removed.includes(id)
			? draft.removed.filter((r) => r !== id)
			: [...draft.removed, id];
	}

	/** A text field as tall as what it holds, so the card scrolls and the field never does. */
	function grow(node: HTMLTextAreaElement) {
		const fit = () => {
			node.style.height = 'auto';
			node.style.height = `${node.scrollHeight}px`;
		};
		fit();
		node.addEventListener('input', fit);
		return { destroy: () => node.removeEventListener('input', fit) };
	}
</script>

<article class="card back" bind:this={article}>
	<h2 class="name">{name}</h2>

	{#if buying && equipment && draft.fighter}
		{@const fighter = draft.fighter}
		<div class="parchment">
			<section>
				<button class="back-link" onclick={() => showBuying(false)}>‹ Back</button>
				<h3 class="heading"><span>Buy</span><span class="rule"></span></h3>
				<p class="note">Paid with Done · {equipment.left} gc left</p>
				{@render boughtList(fighter, equipment.bought, 'Bought here')}
				{#each equipment.shop as group (group.heading)}
					{#if group.rows.length}
						<p class="caption">{group.heading}</p>
						<div class="options">
							{#each group.rows as row (row.id)}
								{#if asking === row.id}
									<div class="ask">
										<p class="note">Found {row.name} with a Rarity roll of 6+?</p>
										<div class="ask-actions">
											<button class="remove" onclick={() => (asking = null)}>Not found</button>
											<button class="remove" onclick={() => pick(fighter, row)}>Found – buy for {row.cost} gc</button>
										</div>
									</div>
								{:else}
									<button class="option" disabled={row.refused !== null} onclick={() => pick(fighter, row)}>
										<span class="line">
											{row.name}
											{#if row.refused}<span class="why">{row.refused}</span>
											{:else if row.rare}<span class="why">Rare – a Rarity roll of 6+ first</span>{/if}
										</span>
										<span class="change">{row.cost} gc</span>
									</button>
								{/if}
							{/each}
						</div>
					{/if}
				{/each}
			</section>
		</div>
	{:else if next}
		<div class="parchment">
			<section>
				<button class="back-link" onclick={() => showSpending(false)}>‹ Back</button>
				<h3 class="heading"><span>Renown {next.level}</span><span class="rule"></span></h3>
				<p class="note">{NOTES[next.branch]}</p>

				{#if next.talents}
					<div class="tabs" role="group" aria-label="What to spend the level on">
						<button aria-pressed={!talking} class:on={!talking} onclick={() => (talking = false)}>
							Characteristics
						</button>
						<button aria-pressed={talking} class:on={talking} onclick={() => (talking = true)}>
							Heroic Talents
						</button>
					</div>
				{/if}

				{#if talking && next.talents}
					<TalentPicker
						variant="card"
						options={next.talents.options}
						abilities={next.talents.abilities}
						name={next.talents.name}
						namePrompt={next.talents.namePrompt}
						taken={next.talents.taken}
						onpick={choose}
					/>
				{:else}
				<div class="options">
					{#each next.options as option (option.characteristic)}
						<button class="option" disabled={option.blocked !== null} onclick={() => choose({ kind: 'stat', option })}>
							<span class="line">
								{LABELS[option.characteristic]}
								{#if option.blocked}<span class="why">{BLOCKED[option.blocked]}</span>{/if}
							</span>
							<span class="change">
								{change(option)}
							</span>
						</button>
					{/each}
				</div>
				{#if next.talents && !next.options.some((o) => o.blocked === null)}
					<p class="note">No characteristic can be raised – choose a heroic talent.</p>
				{/if}
				{#if !open}
					<button class="add" onclick={() => choose(null)}>Use up this level</button>
				{/if}
				{/if}
			</section>
		</div>
	{:else}
		<div class="parchment">
			{#if draft.fighter}
				<section>
					<label class="heading" for="back-name"><span>Name</span><span class="rule"></span></label>
					<input
						id="back-name"
						type="text"
						autocomplete="off"
						placeholder={draft.fighter.placeholder}
						bind:value={draft.fighter.name}
					/>
					{#if nameProblem(draft.fighter)}<p class="note">{nameProblem(draft.fighter)}</p>{/if}
				</section>
			{/if}

			{#if draft.fighter && photo}
				<section>
					<h3 class="heading"><span>Photo</span><span class="rule"></span></h3>
					<input bind:this={photoInput} type="file" accept="image/*" hidden onchange={pickPhoto} />
					{#if stored && layout}
						<div
							bind:this={preview}
							class="preview"
							style:background-image={previewUrl ? `url(${previewUrl})` : null}
							style:background-size={layout.size}
							style:background-position={layout.position}
							style:mask-image={imageFieldMask}
							style:-webkit-mask-image={imageFieldMask}
							role="img"
							aria-label="The photo as the card shows it. Drag to move it."
							onpointerdown={startDrag}
							onpointermove={drag}
							onpointerup={endDrag}
							onpointercancel={endDrag}
						></div>
						<div class="zoom">
							<label for="back-zoom">Zoom</label>
							<input
								id="back-zoom"
								type="range"
								min="1"
								max={MAX_ZOOM}
								step="0.05"
								value={stored.crop.zoom}
								oninput={(e) => recrop((c) => zoomCrop(c, e.currentTarget.valueAsNumber))}
							/>
							<button type="button" class="remove" onclick={() => recrop(() => ({ ...CENTRE }))}>Reset</button>
						</div>
						<div class="photo-actions">
							<button type="button" class="add" onclick={() => photoInput?.click()}>Replace photo</button>
							<button type="button" class="remove" onclick={() => (photo = { photo: null, changed: true })}>
								Remove photo
							</button>
						</div>
					{:else}
						<div class="photo-row">
							<div class="thumb" role="img" aria-label="No photo chosen"><span>No photo</span></div>
							<div class="photo-actions">
								<button type="button" class="add" onclick={() => photoInput?.click()}>Choose photo</button>
							</div>
						</div>
					{/if}
					{#if photoError}<p class="note">{photoError}</p>{/if}
					<p class="hint">Photos stay on this device and are not part of the export.</p>
				</section>
			{/if}

			<section>
				<label class="heading" for="back-fluff"><span>Fluff</span><span class="rule"></span></label>
				<textarea
					id="back-fluff"
					class="fluff"
					rows="2"
					placeholder="A line or two of story"
					bind:value={draft.fluff}
					use:grow
				></textarea>
			</section>

			{#if draft.fighter}
				{@const fighter = draft.fighter}
				{@const floor = renownFloor(fighter)}
				<section bind:this={campaign}>
					<h3 class="heading"><span>Campaign</span><span class="rule"></span></h3>

					<div class="counter">
						<span class="label" id="back-xp">XP</span>
						<div class="stepper" role="group" aria-labelledby="back-xp">
							<button class="choice" aria-label="Less XP" disabled={fighter.xp <= 0} onclick={() => (fighter.xp -= 1)}>−</button>
							<output class="figure">{fighter.xp}</output>
							<button class="choice" aria-label="More XP" onclick={() => moreXp(fighter)}>+</button>
						</div>
					</div>

					<div class="counter">
						<span class="label" id="back-renown">Renown</span>
						<div class="stepper" role="group" aria-labelledby="back-renown">
							<button
								class="choice"
								aria-label="Less renown"
								disabled={fighter.renown <= floor}
								onclick={() => (fighter.renown -= 1)}>−</button
							>
							<output class="figure">{fighter.renown}</output>
							<button class="choice" aria-label="More renown" onclick={() => (fighter.renown += 1)}>+</button>
						</div>
					</div>
					{#if floor > 0 && fighter.renown <= floor}
						<p class="hint">Not below a level already spent or waiting to be.</p>
					{/if}

					{#if fighter.spent.length}
						<ul class="list">
							{#each fighter.spent as spent, i (spent.level)}
								<li>
									<span class="line">
										<span class="when">Renown {spent.level}</span>
										{#if spent.pick?.kind === 'stat'}
											{LABELS[spent.pick.option.characteristic]}
											{change(spent.pick.option)}
										{:else if spent.pick?.kind === 'ability'}
											{spent.pick.ability.name}
										{:else if spent.pick?.kind === 'talent'}
											{spent.pick.talent.name}{#if spent.pick.weapon}{' '}({spent.pick.weapon.name}){/if}
										{:else}
											used up
										{/if}
									</span>
									{#if i === fighter.spent.length - 1}
										<button class="remove" onclick={undoLast}>Undo</button>
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
					{#if renown?.next}
						<button class="add" onclick={() => showSpending(true)}>Spend renown ({renown.waiting})</button>
					{/if}
				</section>
			{/if}

			{#if equipment && draft.fighter}
				{@const fighter = draft.fighter}
				<section bind:this={equipmentSection}>
					<h3 class="heading"><span>Equipment</span><span class="rule"></span></h3>
					{#if equipment.blocked}
						<p class="hint">{equipment.blocked}</p>
					{:else}
						<p class="caption">Carried</p>
						{#if equipment.carried.length}
							<ul class="list">
								{#each equipment.carried as item, i (i)}
									<li>
										<span class="line">{item}</span>
										<button class="remove" onclick={() => sendToStash(fighter, i)}>To stash</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="hint">Nothing bought – what the profile brings stays with the fighter.</p>
						{/if}

						<p class="caption">In the stash</p>
						{#if equipment.takesNothing}
							<p class="hint">{equipment.takesNothing}.</p>
						{:else if equipment.stash.length}
							<ul class="list">
								{#each equipment.stash as item, i (i)}
									<li>
										<span class="line">
											{item.name}
											{#if item.refused}<span class="why">{item.refused}</span>{/if}
										</span>
										<button class="remove" disabled={item.refused !== null} onclick={() => takeFromStash(fighter, i)}>
											Take
										</button>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="hint">The stash is empty.</p>
						{/if}

						{#if !equipment.takesNothing}
							{@render boughtList(fighter, equipment.bought, 'Bought, paid with Done')}
							<button class="add" onclick={() => showBuying(true)}>Buy…</button>
						{/if}
					{/if}
				</section>
			{/if}

			<section>
				<label class="heading" for="back-notes"><span>Notes</span><span class="rule"></span></label>
				<textarea
					id="back-notes"
					rows="2"
					placeholder="Anything to remember at the table"
					bind:value={draft.notes}
					use:grow
				></textarea>
			</section>

			{#if dismissal}
				<section>
					<h3 class="heading"><span>Dismiss</span><span class="rule"></span></h3>
					{#if dismissal.blocked}
						<p class="hint">{dismissal.blocked}</p>
					{:else}
						{#if dismissal.equipment.length}
							<p class="hint">Tick what goes to the stash instead of leaving with the fighter.</p>
							<ul class="list">
								{#each dismissal.equipment as item, i (i)}
									<li>
										<label class="line stash">
											<input type="checkbox" checked={toStash.includes(i)} onchange={() => toggleStash(i)} />
											{item.name}
										</label>
										<span class="when">{item.cost} gc</span>
									</li>
								{/each}
							</ul>
						{/if}
						{#if dismissal.belowMinimum}
							<p class="note">{dismissal.belowMinimum}</p>
						{/if}
						<button class="dismiss" onclick={() => ondismiss?.(toStash)}>Dismiss {name}…</button>
					{/if}
				</section>
			{/if}

			{#if stash}
				<section>
					<h3 class="heading"><span>Stash</span><span class="rule"></span></h3>
					<p class="caption">Gold</p>
					<p class="line">
						{stash.left + goldAdded(draft)} gc
						{#if draft.goldAdded.length}<span class="why">+{goldAdded(draft)} gc with Done</span>{/if}
					</p>
					<div class="entry-row">
						<input
							class="amount"
							type="number"
							inputmode="numeric"
							min="1"
							placeholder="Gold to add"
							aria-label="Gold to add"
							bind:value={goldInput}
						/>
						<button class="add" disabled={!(Number(goldInput) >= 1)} onclick={addGold}>Add</button>
					</div>
					{#if draft.goldAdded.length}
						<button class="remove" onclick={() => (draft.goldAdded = draft.goldAdded.slice(0, -1))}>
							Undo {draft.goldAdded.at(-1)} gc
						</button>
					{/if}
					<p class="caption">Equipment</p>
					{#if stash.items.length}
						<ul class="list">
							{#each stash.items as item, i (i)}
								<li><span class="line">{item}</span></li>
							{/each}
						</ul>
					{:else}
						<p class="hint">The stash is empty.</p>
					{/if}
				</section>
			{/if}

			{#if purchase}
				<section>
					<h3 class="heading"><span>Purchase</span><span class="rule"></span></h3>
					<ul class="list">
						{#each purchase.lines as line, i (i)}
							<li><span class="line"><span class="when">{line.name}</span> {line.items.join(', ')}</span></li>
						{/each}
					</ul>
					<p class="hint">{purchase.cost} gc · {purchase.left} gc left after paying</p>
					{#if purchase.blocked}<p class="note">{purchase.blocked}</p>{/if}
					<button class="add" disabled={purchase.blocked !== null} onclick={() => onpurchase?.()}>
						Purchase for {purchase.cost} gc
					</button>
				</section>
			{/if}

			{#if draft.history}
				<section>
					<h3 class="heading"><span>Battles</span><span class="rule"></span></h3>

					<div class="entry-row">
						<input class="date" type="date" aria-label="Date" bind:value={draft.pending.date} />
						<div class="results" role="group" aria-label="Result">
							{#each Object.entries(RESULT_LABELS) as [key, label] (key)}
								<button
									class="choice"
									aria-pressed={draft.pending.result === key}
									onclick={() => (draft.pending.result = key as BattleRecord['result'])}
								>
									{label}
								</button>
							{/each}
						</div>
					</div>
					<input
						type="text"
						placeholder="Opponent's warband"
						aria-label="Opponent's warband"
						autocomplete="off"
						bind:value={draft.pending.opponentWarband}
					/>
					<input
						type="text"
						placeholder="Opponent's name"
						aria-label="Opponent's name"
						autocomplete="off"
						bind:value={draft.pending.opponentPlayer}
					/>
					<button class="add" disabled={!draft.pending.result || !draft.pending.date} onclick={add}>
						Add battle
					</button>

					{#if sorted.length}
						<ul class="list">
							{#each sorted as record (record.id)}
								{@const removed = draft.removed.includes(record.id)}
								<li class:removed>
									<span class="line">
										<span class="when">{displayDate(record.date)}</span>
										{opponent(record)} – {RESULT_LABELS[record.result]}
									</span>
									<button class="remove" onclick={() => toggleRemoved(record.id)}>
										{removed ? 'Keep' : 'Remove'}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section>
					<h3 class="heading"><span>Colour</span><span class="rule"></span></h3>
					<div class="swatches" role="group" aria-label="Colour of the deck">
						{#each PALETTE as entry (entry.value)}
							<button
								class="swatch"
								style:--swatch={entry.value}
								aria-label={entry.name}
								aria-pressed={(draft.colour ?? DEFAULT_COLOUR) === entry.value}
								onclick={() => (draft.colour = entry.value === DEFAULT_COLOUR ? null : entry.value)}
							></button>
						{/each}
						<label class="swatch custom" class:on={customColour} style:--swatch={draft.colour}>
							<input
								type="color"
								aria-label="Any colour"
								value={draft.colour ?? DEFAULT_COLOUR}
								oninput={(event) => (draft.colour = readColour(event.currentTarget.value))}
							/>
						</label>
					</div>
					{#if draft.colour && !readable(draft.colour)}
						<p class="hint">White type on this colour is hard to read on the card.</p>
					{/if}
				</section>
			{/if}
		</div>
	{/if}
</article>

<!-- What is bought on this back, on the card's page and on the buying page alike. -->
{#snippet boughtList(fighter: FighterDraft, bought: BackEquipment['bought'], caption: string)}
	{#if bought.length}
		<p class="caption">{caption}</p>
		<ul class="list">
			{#each bought as item, i (i)}
				<li>
					<span class="line">{item.name}</span>
					<span class="when">{item.cost} gc</span>
					<button class="remove" onclick={() => unbuy(fighter, i)}>Undo</button>
				</li>
			{/each}
		</ul>
	{/if}
{/snippet}

<style>
	/* A lighter patch of the paper rather than a box: no frame and no line,
	   brighter and edged in green while the field is being written in. */
	textarea,
	input {
		width: 100%;
		margin: 0;
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.4;
		color: var(--card-ink);
		background: var(--card-field);
		border: 0;
		border-radius: calc(6 * var(--u));
		outline: none;
		appearance: none;
	}

	textarea {
		resize: none;
		overflow: hidden;
	}

	textarea:focus,
	input:focus {
		background: rgb(255 255 255 / 0.7);
		box-shadow: inset 0 0 0 1px var(--card-green);
	}

	::placeholder {
		color: var(--card-ink-muted);
		font-style: italic;
	}

	.fluff {
		font-style: italic;
	}

	.entry-row {
		display: flex;
		align-items: flex-end;
		gap: calc(12 * var(--u));
	}

	.date,
	.amount {
		flex: 1;
		min-width: 0;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.results {
		display: flex;
	}

	/* Three words to tap, joined into one pill; the one picked is set in the
	   banderole's green. */
	.choice {
		min-height: 40px;
		padding: 0 calc(10 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 0;
		background: var(--card-field);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		color: var(--card-green);
	}

	.choice:first-child {
		border-radius: 999px 0 0 999px;
	}

	.choice:last-child {
		border-radius: 0 999px 999px 0;
	}

	/* Two neighbouring frames share one line instead of doubling it. */
	.choice + .choice {
		margin-left: -1px;
	}

	.choice[aria-pressed='true'] {
		background: var(--card-green);
		color: var(--card-paper);
	}

	/* The deck's colour: round swatches in their own colour, the last one a
	   colour wheel that opens the system picker and then shows what was picked. */
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: calc(10 * var(--u));
	}

	.swatch {
		position: relative;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 2px solid var(--card-paper);
		border-radius: 999px;
		background: var(--swatch);
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
	}

	.swatch[aria-pressed='true'],
	.custom.on {
		box-shadow: 0 0 0 2px var(--card-ink);
	}

	.custom {
		overflow: hidden;
		background: conic-gradient(#c33, #cc3, #3c3, #3cc, #33c, #c3c, #c33);
		cursor: pointer;
	}

	.custom.on {
		background: var(--swatch);
	}

	.custom:focus-within {
		outline: 2px solid var(--card-ink);
		outline-offset: 2px;
	}

	.custom input {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		padding: 0;
		opacity: 0;
		cursor: pointer;
	}

	/* A figure and its name on one line, the steppers lined up at the right edge. */
	.counter {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(12 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-ink);
	}

	.stepper {
		display: flex;
	}

	.stepper .choice {
		min-width: 44px;
		font-size: calc(20 * var(--t));
	}

	/* The figure sits inside the pill, framed above and below by the same green. */
	.figure {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		border-top: 1px solid var(--card-green);
		border-bottom: 1px solid var(--card-green);
		background: var(--card-field);
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		font-variant-numeric: lining-nums tabular-nums;
		color: var(--card-ink);
	}

	/* Only the sign fades: the frame is also the figure's edge, and the pill
	   keeps its outline whichever end is out of reach. */
	.stepper .choice:disabled {
		color: color-mix(in srgb, var(--card-green) 35%, transparent);
	}

	.add {
		align-self: flex-end;
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-green);
		color: var(--card-paper);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
	}

	/* Until a result is picked, an unpicked choice, set back. */
	.add:disabled {
		background: var(--card-field);
		color: var(--card-green);
		opacity: 0.5;
	}

	/* As on the front: a solid rule above the log, a dashed one under each row. */
	.list {
		margin: calc(6 * var(--u)) 0 0;
		padding: 0;
		list-style: none;
		border-top: 1.5px solid #000;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.3;
	}

	.list li {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--u));
		padding: calc(4 * var(--u)) 0;
		border-bottom: 1px dashed #000;
	}

	.line {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}

	.when {
		margin-right: 0.3em;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.removed .line {
		text-decoration: line-through;
		color: var(--card-ink-muted);
	}

	.back-link {
		align-self: flex-start;
		min-height: 40px;
		padding: 0;
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
		color: var(--card-link);
	}

	.tabs {
		display: flex;
		border-bottom: 1px solid var(--card-green);
	}

	.tabs button {
		flex: 1;
		min-height: 44px;
		padding: 0 calc(8 * var(--u));
		border: 0;
		border-bottom: 3px solid transparent;
		margin-bottom: -1px;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-ink-muted);
	}

	.tabs button.on {
		border-bottom-color: var(--card-green);
		color: var(--card-ink);
		font-weight: 600;
	}

	.options {
		display: flex;
		flex-direction: column;
		gap: calc(10 * var(--u));
		margin-top: calc(6 * var(--u));
	}

	/* A characteristic to raise is a pill like every other button on the back,
	   the whole width of the card and set as large as its fields. */
	.option {
		display: flex;
		align-items: center;
		gap: calc(8 * var(--u));
		min-height: 48px;
		padding: calc(6 * var(--u)) calc(18 * var(--u));
		border: 1px solid var(--card-green);
		border-radius: 999px;
		background: var(--card-field);
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		line-height: 1.25;
		color: var(--card-ink);
		text-align: left;
	}

	.option:active:not(:disabled) {
		background: var(--card-green);
		color: var(--card-paper);
	}

	.option:active:not(:disabled) .change {
		color: inherit;
	}

	.option:disabled {
		border-color: color-mix(in srgb, var(--card-green) 35%, transparent);
		color: var(--card-ink-muted);
	}

	.option .line {
		flex: 1;
		min-width: 0;
	}

	.change {
		flex: none;
		color: var(--card-green);
		font-variant-numeric: lining-nums tabular-nums;
	}

	.option:disabled .change {
		color: inherit;
	}

	.why {
		display: block;
		font-size: calc(18 * var(--t));
		font-style: italic;
	}

	/* A box to tick, not a field to write in: none of the field's patch. */
	.stash {
		display: flex;
		align-items: center;
		gap: calc(10 * var(--u));
		min-height: 40px;
	}

	.stash input {
		flex: none;
		width: 22px;
		height: 22px;
		margin: 0;
		padding: 0;
		accent-color: var(--card-green);
		appearance: auto;
	}

	/* The one button on the back that takes something away, in the link's red. */
	.dismiss {
		align-self: flex-end;
		margin-top: calc(14 * var(--u));
		min-height: 40px;
		padding: 0 calc(14 * var(--u));
		border: 1px solid var(--card-link);
		border-radius: 999px;
		background: var(--card-field);
		color: var(--card-link);
		font-family: 'Alegreya', serif;
		font-size: calc(17 * var(--t));
	}

	.photo-row {
		display: flex;
		align-items: center;
		gap: calc(12 * var(--u));
	}

	.photo-actions {
		flex: 1;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: calc(8 * var(--u));
	}

	/* What the image field shows, cut by the same mask. Dragging must not
	   scroll the back along. */
	.preview {
		width: calc(240 * var(--u));
		max-width: 100%;
		aspect-ratio: 1;
		margin: 0 auto;
		background-color: var(--card-green);
		background-repeat: no-repeat;
		mask-size: 100% 100%;
		mask-repeat: no-repeat;
		-webkit-mask-size: 100% 100%;
		-webkit-mask-repeat: no-repeat;
		touch-action: none;
		cursor: grab;
	}

	.zoom {
		display: flex;
		align-items: center;
		gap: calc(10 * var(--u));
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
	}

	.zoom input {
		flex: 1;
		min-width: 0;
	}

	/* The empty frame while there is no photo. */
	.thumb {
		flex: none;
		display: grid;
		place-items: center;
		width: calc(96 * var(--u));
		aspect-ratio: 1;
		border: 1px solid var(--card-green);
		background-color: var(--card-field);
		font-family: 'Alegreya', serif;
		font-size: calc(16 * var(--t));
		color: var(--card-ink-muted);
	}

	.remove {
		flex: none;
		min-height: 40px;
		padding: 0 calc(6 * var(--u));
		border: 0;
		background: transparent;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		color: var(--card-link);
	}

	.remove:disabled {
		color: var(--card-ink-muted);
	}

	/* A rare piece asking for its roll in the place of its row. */
	.ask {
		padding: calc(6 * var(--u)) calc(10 * var(--u));
		background: var(--card-field);
		border-radius: calc(6 * var(--u));
	}

	.ask .note {
		margin: 0;
	}

	.ask-actions {
		display: flex;
		justify-content: space-between;
		gap: calc(12 * var(--u));
	}

	/* Names a list within a section, set like the counters' labels. */
	.caption {
		margin: calc(6 * var(--u)) 0 0;
		font-family: 'Alegreya', serif;
		font-size: calc(18 * var(--t));
		font-weight: 700;
		color: var(--card-ink);
	}
</style>
