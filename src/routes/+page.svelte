<script lang="ts">
	import { onMount, untrack } from 'svelte';

	import { dev } from '$app/environment';
	import { base } from '$app/paths';

	import AftermathBack from '$lib/components/AftermathBack.svelte';
	import CardBack, {
		type BackDismissal,
		type BackEquipment,
		type BackPurchase,
		type BackRenown,
		type BackStash
	} from '$lib/components/CardBack.svelte';
	import Deck from '$lib/components/Deck.svelte';
	import ImportPrompt from '$lib/components/ImportPrompt.svelte';
	import MenuButton from '$lib/components/MenuButton.svelte';
	import RenownSheet, { offersTalent, type TalentOffer } from '$lib/components/RenownSheet.svelte';
	import { hasKeyword, itemCost, toCards } from '$lib/adapter';
	import {
		applyAftermath,
		battleRecord,
		income,
		startAftermath,
		type AftermathAnswer,
		type AftermathDraft,
		type IncomeDraft
	} from '$lib/aftermath';
	import { countedFighters } from '$lib/morale';
	import { reached, zealStages } from '$lib/zeal';
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
		waveringThreshold,
		adjustZeal,
		zealOf
	} from '$lib/battle';
	import {
		applyDraft,
		dismiss,
		dismissCost,
		emptyPending,
		fromTradingPost,
		nameProblem,
		purchase,
		salePrice,
		tradingPost,
		type EditDraft
	} from '$lib/edit';
	import { explain } from '$lib/explanation';
	import {
		abilitiesFor,
		earnedLevels,
		heldTalents,
		limitFor,
		optionsFor,
		promoted,
		spend,
		talentsFor,
		weaponsOffered,
		type RenownPick
	} from '$lib/renown';
	import { allows, gearOf, offers, refuse, takesNothing } from '$lib/build/equipment';
	import { fighterOf } from '$lib/build/roster';
	import { ABILITIES, FIGHTERS, ITEMS, WEAPONS } from '$lib/gamedata';
	import {
		FACTIONS as RULESETS,
		HEROIC_TALENTS,
		ITEMS as RULE_ITEMS,
		RACIAL_LIMITS,
		WEAPONS as RULE_WEAPONS
	} from '$lib/rules';
	import {
		allWarbands,
		chooseWarband,
		chosenWarband,
		deletePhoto,
		deleteWarband,
		photosOf,
		prunePhotos,
		putBattle,
		putPhoto,
		putWarband,
		requestPersistence
	} from '$lib/storage';
	import { photoLayout, type PhotoView } from '$lib/photo';
	import { rosterPdf } from '$lib/roster-pdf';
	import { RELEASE_STAGE } from '$lib/release';
	import { ImportError, exportWarband, readFile, shareFile, toStored, type ExportResult, type ImportCandidate } from '$lib/transfer';
	import type { DeckCard } from '$lib/types/card';
	import type { BattleState, FighterInstance, PendingRenown, StatKey, StoredPhoto, StoredWarband } from '$lib/types/warband';

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
	/* The photo of the fighter being edited, apart from the draft: the draft is
	   written as a whole and has to stay free of the blob. */
	let photoDraft = $state<{ photo: StoredPhoto | null; changed: boolean } | null>(null);
	/* The active warband's photos, and what they are shown from. The object URLs
	   are handed back whenever the set is replaced. */
	let photos = $state<Map<string, PhotoView>>(new Map());
	let stored = new Map<string, StoredPhoto>();
	let photoUrls: string[] = [];
	let aftermath = $state<AftermathDraft | null>(null);
	/* A draft belongs to the warband it was started on: another one coming up
	   ends the edit rather than writing the draft into it. */
	$effect(() => {
		void activeId;
		untrack(() => (editingId = null));
	});
	/* The warband a delete has been asked for, held until it is confirmed. */
	let condemned = $state<StoredWarband | null>(null);
	/* Set while cancelling the running battle waits to be confirmed. */
	let abandoning = $state(false);
	/* The fighter a dismissal has been asked for, and what goes to the stash, held until it is confirmed. */
	let discharged = $state<{ instanceId: string; name: string; toStash: number[] } | null>(null);
	/* Set while the renown sheet is up, asking what the next open level is spent on. */
	let renownOpen = $state(false);
	let message = $state<string | null>(null);
	let messageTimer: ReturnType<typeof setTimeout> | undefined;
	let fileInput: HTMLInputElement | undefined = $state();

	const active = $derived(warbands.find((w) => w.warband.id === activeId) ?? null);

	/* The deck's own colour stands in for the card green on the root, where the
	   explanation overlay and the backs read it too. While the warband card is
	   turned, the colour picked there already shows. Left again, the green. */
	const colour = $derived(editingId === 'warband' && draft ? draft.colour : (active?.colour ?? null));
	$effect(() => {
		const root = document.documentElement.style;
		if (colour) root.setProperty('--card-green', colour);
		else root.removeProperty('--card-green');
		return () => root.removeProperty('--card-green');
	});
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
		return { name: card.name, options, talents: talentOffer(stored, deck, instance, card.name, pending) };
	}

	/**
	 * The names the faction and the other fighters answer to besides their own: the
	 * profile names, which `adapter.ts` matches a card by when it has none, and the
	 * builder's default name.
	 */
	function reservedFor(stored: StoredWarband, instanceId: string): string[] {
		const faction = stored.warband.factionId ? RULESETS.get(stored.warband.factionId) : undefined;
		return [
			faction?.name ?? '',
			/* What the builder calls every fighter it adds until it is renamed. */
			'New Fighter',
			...stored.warband.fighters
				.filter((f) => f.instanceId !== instanceId)
				.map((f) => FIGHTERS.get(f.fighterId)?.name ?? '')
		].filter(Boolean);
	}

	/**
	 * What a hero's level can take instead: the talents with the reason each is out
	 * of reach, and whether the fighter needs a name of its own first. A talent is
	 * written against the fighter's name, so a name shared with another fighter
	 * would give it the talent too.
	 */
	function talentOffer(
		stored: StoredWarband,
		deck: DeckCard[],
		instance: FighterInstance,
		shown: string,
		pending: PendingRenown
	): TalentOffer | null {
		if (!offersTalent(pending.branch)) return null;
		const faction = stored.warband.factionId ? RULESETS.get(stored.warband.factionId) : undefined;
		const profile = faction && fighterOf(faction, instance.fighterId);
		const profileName = FIGHTERS.get(instance.fighterId)?.name ?? '';
		const held = heldTalents(HEROIC_TALENTS, instance.instanceId, [shown, profileName], stored.renownHistory ?? [], stored.warband.customAbilities);
		const carried = [...(profile ? gearOf(profile) : []), ...instance.equipment];
		const sold = faction && profile ? faction.equipment.filter((e) => e.id.startsWith('weapon:')).map((e) => e.id.slice(7)).filter((id) => allows(faction, profile, id)) : [];
		const names = new Set(
			[
				...stored.warband.fighters.filter((f) => f.instanceId !== instance.instanceId).map((f) => f.customName),
				...reservedFor(stored, instance.instanceId)
			]
				.map((n) => n.trim().toLowerCase())
				.filter(Boolean)
		);
		const own = instance.customName.trim().toLowerCase();
		const mustName = own === '' || names.has(own);
		/* Learned in place of a talent: only for a fighter whose recruitment pick is on
		   file, since the card cannot tell a further ability from the list otherwise. */
		const choice = profile?.choose;
		const picked = stored.selections?.fighters[instance.instanceId] ?? [];
		const learned = (stored.renownHistory ?? [])
			.filter((c) => c.instanceId === instance.instanceId && c.kind === 'ability' && c.talent)
			.map((c) => c.talent as string);
		const abilities =
			choice?.kind === 'ability' && choice.instead_of_talent && picked.length
				? abilitiesFor(choice.abilities ?? [], picked, learned, choice.instead_of_talent, (id) => {
						const ability = ABILITIES.get(id);
						return ability && { name: ability.name, text: ability.description };
					})
				: [];
		return {
			abilities,
			options: talentsFor(HEROIC_TALENTS, held, (kind) => weaponsOffered(kind, carried, sold, RULE_WEAPONS)),
			namePrompt: mustName ? 'The talent is saved under the fighter’s name, so no other fighter may share it' : null,
			name: instance.customName,
			taken: (name) => names.has(name.trim().toLowerCase())
		};
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
			next: next && (() => {
				const view = renownChoice(provisional, deck, next);
				return { level: next.level, branch: next.branch, options: view?.options ?? [], talents: view?.talents ?? null };
			})(),
			waiting: queue.length
		};
	});
	const battle = $derived(active?.battle ?? null);

	const IN_BATTLE = 'Not during a battle – end or cancel it first.';

	const nameOf = (id: string) => WEAPONS.get(id)?.name ?? ITEMS.get(id)?.name ?? RULE_ITEMS.get(id)?.name ?? id;

	/*
	 * What the fighter on the back carries and could take from the stash, read off
	 * the draft so a piece moved there is checked against what is left. Its
	 * renown counts as the draft has it: a henchman raised to HERO there may
	 * already take what only a HERO may.
	 */
	const backEquipment = $derived.by((): BackEquipment | null => {
		if (!active || !editingId || turned !== 'edit' || !draft?.fighter) return null;
		const fighter = draft.fighter;
		const instance = active.warband.fighters.find((f) => f.instanceId === editingId);
		if (!instance) return null;
		const faction = active.warband.factionId ? RULESETS.get(active.warband.factionId) : undefined;
		const profile = faction && fighterOf(faction, instance.fighterId);
		const blocked = battle
			? IN_BATTLE
			: instance.isPending
				? 'Not bought yet, so its equipment cannot change hands here.'
				: !faction || !profile
					? "This fighter is not in the app's own rules, so what it may carry cannot be checked."
					: null;
		if (blocked || !faction || !profile) {
			return { blocked, takesNothing: null, carried: [], stash: [], bought: [], shop: [], left: 0 };
		}
		const rules = { ...profile, keywords: promoted(profile.keywords, fighter.renown).map((k) => k.toLowerCase()) };
		/* What is bought here fills hands as well, and so does what a warband
		   from the builder still has waiting to be confirmed – that just cannot
		   be moved until it is bought. */
		const held = [...fighter.equipment, ...fighter.bought, ...instance.pendingEquipment];
		const costOf = (ids: string[]) => ids.reduce((sum, id) => sum + itemCost(id), 0);
		const gold = cards[0]?.kind === 'warband' ? cards[0].gold : { remaining: 0, pending: 0 };
		const left = gold.remaining - gold.pending - costOf(fighter.bought);
		/* Priced the way the warband's value prices them, off the game data, and
		   refused where the gold left does not reach. */
		const priced = <T extends { id: string; refused: string | null }>(rows: T[]) =>
			rows.map((row) => {
				const cost = itemCost(row.id);
				return { ...row, cost, refused: row.refused ?? (cost > left ? `Short by ${cost - left} gc` : null) };
			});
		const sold = offers(faction, rules, held);
		const post = tradingPost(rules, held);
		return {
			blocked: null,
			takesNothing: takesNothing(rules),
			carried: fighter.equipment.map(nameOf),
			/* A Trading Post piece is no faction's to sell, so `refuse()` would turn
			   it away from every fighter; the Trading Post answers for it. */
			stash: fighter.stash.map((id) => ({
				name: nameOf(id),
				refused: fromTradingPost(id)
					? ([...post.miscellaneous, ...post.singleUse].find((o) => o.id === id)?.refused ?? null)
					: refuse(faction, rules, held, id)
			})),
			bought: fighter.bought.map((id) => ({ name: nameOf(id), cost: itemCost(id) })),
			shop: [
				{ heading: 'Melee weapons', rows: priced(sold.melee) },
				{ heading: 'Ranged weapons', rows: priced(sold.ranged) },
				{ heading: 'Armour', rows: priced(sold.armour) },
				{ heading: 'Trading Post', rows: priced(post.miscellaneous) },
				{ heading: 'Trading Post – single use', rows: priced(post.singleUse) }
			],
			left
		};
	});

	/* The gold and the stash on the back of the warband card. */
	const backStash = $derived.by((): BackStash | null => {
		if (!active || editingId !== 'warband' || turned !== 'edit') return null;
		const warbandCard = cards[0];
		if (warbandCard?.kind !== 'warband') return null;
		return {
			left: warbandCard.gold.remaining,
			ids: [...active.warband.stash],
			items: active.warband.stash.map((id) => ({ name: nameOf(id), price: salePrice(itemCost(id)) })),
			blocked: battle ? IN_BATTLE : null
		};
	});

	/* Whether and how the fighter on the back can be dismissed. The leader stays:
	   the rules then elect another, which the app does not do. */
	const backDismissal = $derived.by((): BackDismissal | null => {
		if (!active || !editingId || turned !== 'edit') return null;
		const instance = active.warband.fighters.find((f) => f.instanceId === editingId);
		const card = cards.find((c) => c.instanceId === editingId);
		if (!instance || card?.kind !== 'fighter') return null;
		const moved =
			draft?.fighter &&
			(draft.fighter.bought.length > 0 ||
				draft.fighter.equipment.join() !== instance.equipment.join() ||
				draft.fighter.stash.join() !== active.warband.stash.join());
		const blocked = battle
			? IN_BATTLE
			: hasKeyword(card, 'LEADER')
				? 'The leader stays: dismissing one means electing another, which this app does not do.'
				: moved
					? 'Equipment has been moved or bought on this back – keep it with Done first.'
					: null;
		const ruleset = active.warband.factionId ? RULESETS.get(active.warband.factionId) : undefined;
		const after = active.warband.fighters.length - 1;
		const min = ruleset?.warband_size.min ?? 0;
		return {
			equipment: instance.equipment.map((id) => ({
				name: nameOf(id),
				cost: itemCost(id)
			})),
			blocked,
			belowMinimum: after < min ? `That leaves ${after} fighters, and ${ruleset?.name} field at least ${min}.` : null
		};
	});

	/* What Purchase on the back of the warband card would pay for. */
	const backPurchase = $derived.by((): BackPurchase | null => {
		if (!active || editingId !== 'warband' || turned !== 'edit') return null;
		const warbandCard = cards[0];
		if (warbandCard?.kind !== 'warband') return null;
		/* Only a warband from the builder has anything waiting: the app pays with Done. */
		const lines = active.warband.fighters.flatMap((f) => {
			const card = cards.find((c) => c.instanceId === f.instanceId);
			const name = card?.name ?? f.customName;
			if (f.isPending) return [{ name, items: ['recruited, with all they carry'] }];
			return f.pendingEquipment.length ? [{ name, items: f.pendingEquipment.map(nameOf) }] : [];
		});
		if (!lines.length) return null;
		const { remaining, pending } = warbandCard.gold;
		const left = remaining - pending;
		return {
			lines,
			cost: pending,
			left,
			blocked: battle ? IN_BATTLE : left < 0 ? `Short by ${-left} gc.` : null
		};
	});

	/* Written at once rather than with Done, like a dismissal: the back stays
	   open, and what Done writes there does not touch what was bought. */
	async function confirmPurchase() {
		if (!active || !backPurchase || backPurchase.blocked) return;
		const cost = backPurchase.cost;
		try {
			await putWarband(purchase($state.snapshot(active)));
		} catch {
			notify('The purchase could not be saved.', 'error');
			return;
		}
		await refresh();
		notify(`Bought for ${cost} gc.`);
	}

	/* What the dismissal sheet says the gold does. */
	const dischargeCost = $derived.by(() => {
		if (!active || !discharged) return null;
		const id = discharged.instanceId;
		const instance = active.warband.fighters.find((f) => f.instanceId === id);
		const card = cards.find((c) => c.instanceId === id);
		const warbandCard = cards[0];
		if (!instance || card?.kind !== 'fighter' || warbandCard?.kind !== 'warband') return null;
		return {
			pending: instance.isPending,
			value: dismissCost(instance, card.cost, discharged.toStash),
			stash: discharged.toStash.map((i) => backDismissal?.equipment[i]?.name ?? instance.equipment[i]),
			remaining: warbandCard.gold.remaining
		};
	});
	const counted = $derived(active ? countedFighters(active.warband) : []);
	const left = $derived(
		remaining(
			battle,
			counted.map((f) => f.instanceId)
		)
	);
	const stages = $derived(active ? zealStages(active.warband) : []);
	const zeal = $derived(zealOf(battle));
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
		bonusInstanceId: string | null,
		incomeDraft: IncomeDraft
	) {
		if (!active) return;
		const snapshot = $state.snapshot(active);
		const warband = applyAftermath(
			snapshot.warband,
			answers,
			bonusInstanceId,
			income(snapshot.warband.favour, incomeDraft)
		);
		const record = battleRecord(incomeDraft);
		const levels = earnedLevels(snapshot.warband, warband, keywordsOf);
		const pending = [...(snapshot.pendingRenown ?? []), ...levels];
		const entry: StoredWarband = {
			...snapshot,
			warband,
			battle: null,
			history: record ? [...(snapshot.history ?? []), record] : snapshot.history,
			pendingRenown: pending.length ? pending : null,
			revision: snapshot.revision + 1,
			updatedAt: new Date().toISOString()
		};
		await putWarband(entry);
		renownOpen = levels.length > 0;
		await refresh();
	}

	/** Spends the open level in one write, then goes on to the next one or closes. */
	async function spendRenown(pick: RenownPick | null) {
		if (!active || !nextRenown) return;
		const snapshot = $state.snapshot(active);
		try {
			const reserved = reservedFor(snapshot, nextRenown.instanceId);
			await putWarband(spend(snapshot, { ...nextRenown }, pick && $state.snapshot(pick), reserved));
		} catch {
			notify('The choice could not be saved.', 'error');
			return;
		}
		await refresh();
		if (!nextRenown) renownOpen = false;
	}

	/** Turns the warband card over to ask what the battle was worth: experience, then favour and income. */
	function endBattle() {
		if (!active) return;
		const fighters = cards.filter((c) => c.kind === 'fighter');
		aftermath = startAftermath(active.warband, fighters, battle, active.history ?? []);
		turned = 'aftermath';
		editingId = 'warband';
	}

	/**
	 * Drops the battle as if it had never started: no experience, no line in the
	 * history, no new revision – the warband itself was never touched by it.
	 */
	async function cancelBattle() {
		abandoning = false;
		if (turned === 'aftermath') editingId = null;
		await setBattle(null);
		notify('Battle cancelled.');
	}

	/* Written at once rather than with Done: the back closes and the card is gone. */
	async function confirmDismiss() {
		if (!active || !discharged) return;
		const { instanceId, name, toStash } = discharged;
		const card = cards.find((c) => c.instanceId === instanceId);
		const snapshot = $state.snapshot(active);
		discharged = null;
		editingId = null;
		try {
			await putWarband(
				dismiss(snapshot, instanceId, card?.kind === 'fighter' ? card.cost : 0, toStash, reservedFor(snapshot, instanceId))
			);
		} catch {
			notify('The fighter could not be dismissed.', 'error');
			return;
		}
		await deletePhoto(snapshot.warband.id, instanceId).catch(() => {});
		await refresh();
		await reloadPhotos();
		notify(`${name} dismissed.`);
	}

	/* Ended before the write, like `saveEdit`, so a second tap finds nothing to apply. */
	async function finishAftermath() {
		if (!aftermath?.income.result || !editingId) return;
		const values = $state.snapshot(aftermath);
		editingId = null;
		await applyAftermathAndEnd(new Map(Object.entries(values.answers)), values.bonus, values.income);
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
						spent: [],
						equipment: [...instance.equipment],
						bought: [],
						stash: [...active.warband.stash],
						/* Their own names too: `nameProblem` refuses a talent's name another
						   fighter already has, and reads nothing else. */
						reserved: [
							...reservedFor(active, id),
							...active.warband.fighters.filter((f) => f.instanceId !== id).map((f) => f.customName.trim())
						].filter(Boolean)
					}
				: null,
			notes: isWarband ? active.warband.factionNotes : (instance?.notes ?? ''),
			fluff: isWarband ? (active.fluff?.warband ?? '') : (active.fluff?.fighters[id] ?? ''),
			history: isWarband ? $state.snapshot(active.history ?? []) : null,
			colour: isWarband ? (active.colour ?? null) : null,
			removed: [],
			pending: emptyPending(),
			goldAdded: [],
			stashOut: []
		};
		photoDraft = instance ? { photo: stored.get(id) ?? null, changed: false } : null;
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
		const problem = values.fighter && nameProblem(values.fighter);
		if (problem) {
			notify(problem, 'error');
			return;
		}
		const targetId = editingId;
		/* IndexedDB trips over the reactivity proxy, so the photo is rebuilt as a plain object. */
		const photoValues = photoDraft?.changed
			? {
					photo: photoDraft.photo
						? { ...photoDraft.photo, bytes: photoDraft.photo.bytes.slice(0), crop: { ...photoDraft.photo.crop } }
						: null
				}
			: null;
		/* Ended before the write rather than after it, so a second tap on Done
		   finds nothing to save instead of adding a pending battle twice. */
		editingId = null;
		await putWarband(applyDraft(snapshot, targetId, values, keywordsOf));
		if (photoValues) {
			try {
				if (photoValues.photo) await putPhoto(snapshot.warband.id, targetId, photoValues.photo);
				else await deletePhoto(snapshot.warband.id, targetId);
			} catch (error) {
				console.error(error);
				notify('The photo could not be saved.', 'error');
			}
			await reloadPhotos();
		}
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

	/* Reads the active warband's photos again, after a write or a change of warband. */
	async function reloadPhotos() {
		const id = activeId;
		const found = id ? await photosOf(id).catch(() => new Map<string, StoredPhoto>()) : new Map<string, StoredPhoto>();
		if (id !== activeId) return;
		photoUrls.forEach((url) => URL.revokeObjectURL(url));
		photoUrls = [];
		const views = new Map<string, PhotoView>();
		for (const [instanceId, photo] of found) {
			const url = URL.createObjectURL(new Blob([photo.bytes], { type: photo.type }));
			photoUrls.push(url);
			views.set(instanceId, { url, ...photoLayout(photo.width, photo.height, photo.crop) });
		}
		stored = found;
		photos = views;
	}

	$effect(() => {
		void activeId;
		untrack(reloadPhotos);
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
		await prunePhotos(
			entry.warband.id,
			entry.warband.fighters.map((f) => f.instanceId)
		).catch(() => {});
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
			<select class="field-input" bind:value={activeId} aria-label="Choose warband">
				{#each warbands as entry (entry.warband.id)}
					<option value={entry.warband.id}>{entry.warband.name}</option>
				{/each}
			</select>
		{:else if active}
			<h1>{active.warband.name}</h1>
		{:else}
			<h1 class="app-title">Wyrdcry Warband Deck <span class="badge">{RELEASE_STAGE}</span></h1>
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
						<p>
							Round {battle.round} · {left} to act{#if stages.length}{' '}· Zeal {zeal}{/if}
						</p>
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
						<p class="hint">
							Asks for the result and the shards, for favour and income, then who earned
							experience, and drops the wounds and who is out of action.
						</p>
						<button onclick={() => (abandoning = true)}>Cancel battle</button>
						<p class="hint">Drops the battle without experience, as if it never started.</p>
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
		{stages}
		{zeal}
		onzeal={(delta) => setBattle(adjustZeal(battle, delta))}
		{photos}
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
		doneDisabled={turned === 'aftermath' && !aftermath?.income.result}
		oncancel={() => (editingId = null)}
	>
		{#snippet back(card)}
			{#if turned === 'aftermath' && aftermath}
				<AftermathBack name={card.name} favour={active?.warband.favour ?? 0} bind:draft={aftermath} />
			{:else if turned === 'edit' && draft}
				<CardBack
					name={card.name}
					bind:draft
					bind:photo={photoDraft}
					renown={backRenown}
					equipment={backEquipment}
					dismissal={backDismissal}
					ondismiss={(toStash) => (discharged = { instanceId: card.instanceId, name: card.name, toStash })}
					purchase={backPurchase}
					stash={backStash}
					onpurchase={confirmPurchase}
				/>
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
		<div class="btn-stack">
			<a class="btn primary" href="{base}/build">Build a warband</a>
			<button class="btn" onclick={() => fileInput?.click()}>Import a file</button>
		</div>
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
		talents={renownView.talents}
		waiting={pendingRenown.length - 1}
		onspend={spendRenown}
		onclose={() => (renownOpen = false)}
	/>
{/if}

{#if condemned}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="delete-title">
			<h2 id="delete-title">Delete {condemned.warband.name}?</h2>
			<p class="count">
				{condemned.warband.fighters.length} fighters · Revision {condemned.revision}
			</p>
			<p class="notice danger">
				<strong>This cannot be undone.</strong> The warband and the battle it is in the
				middle of are on this device only. Export it first if the campaign is to be kept –
				the photos of its fighters are not part of the export.
			</p>
			<div class="sheet-actions">
				<button class="btn" onclick={() => (condemned = null)}>Cancel</button>
				<button class="btn" onclick={exportCondemned}>Export</button>
				<button class="btn danger" onclick={confirmDelete}>Delete</button>
			</div>
		</div>
	</div>
{/if}

{#if discharged && dischargeCost}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="dismiss-title">
			<h2 id="dismiss-title">Dismiss {discharged.name}?</h2>
			<p class="count">
				{#if dischargeCost.stash.length}{dischargeCost.stash.join(', ')} to the stash ·{' '}{/if}
				{#if dischargeCost.pending}
					Not bought yet, so nothing comes off the gold
				{:else}
					{dischargeCost.value} gc leave the warband's value · Gold left stays {dischargeCost.remaining}
				{/if}
			</p>
			<p class="notice danger">
				<strong>This cannot be undone.</strong> The fighter leaves the warband with
				everything not sent to the stash, its experience, renown, notes and fluff.
			</p>
			<div class="sheet-actions">
				<button class="btn" onclick={() => (discharged = null)}>Keep</button>
				<button class="btn danger" onclick={confirmDismiss}>Dismiss</button>
			</div>
		</div>
	</div>
{/if}

{#if abandoning && battle}
	<div class="sheet-backdrop">
		<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="abandon-title">
			<h2 id="abandon-title">Cancel the battle?</h2>
			<p class="count">Round {battle.round}{#if out > 0}{' '}· {fighterCount(out)} out of action{/if}</p>
			<p class="notice danger">
				<strong>This cannot be undone.</strong> Wounds, activations and who is out of
				action are dropped, and nobody earns experience.
			</p>
			<div class="sheet-actions">
				<button class="btn" onclick={() => (abandoning = false)}>Keep playing</button>
				<button class="btn danger" onclick={cancelBattle}>Cancel battle</button>
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
		container: identity / inline-size;
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

	/* The app's own name with its badge takes 273px at the title size. Where the
	   buttons leave less, it steps down rather than cut the badge off. */
	@container identity (max-width: 272px) {
		.app-title {
			font-size: var(--ui-t-lg);
		}
	}

	select {
		max-width: 100%;
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

	.empty .btn-stack {
		margin-top: 6px;
	}
</style>
