/**
 * The warband as a printed roster: one row per fighter, then every rule the
 * warband carries once, with the fighters that carry it.
 *
 * It reads the cards rather than the warband. Every figure on the roster is one
 * a card already shows, so the two cannot come apart – the characteristics
 * included, which belong to the deck and not to the builder.
 */

import { toCards } from './adapter';
import type { CardEntry, CardWeapon, FighterCardData, WarbandCardData } from './types/card';
import type { StoredWarband } from './types/warband';

export interface RosterFighter {
	instanceId: string;
	name: string;
	type: string;
	/** Move, Fight, Shoot, Defense, Health, Bravery – spelled as the card spells them. */
	stats: string[];
	xp: number;
	renown: number;
	cost: number;
	keywords: string;
	/** The fighter's own abilities, labelled as on the card: "[Triple] Murder-Stab". */
	talents: string[];
	weapons: CardWeapon[];
	/** Armour, shields and the like – no profile, so they share one line. */
	items: string;
	notes: string[];
}

export interface RosterRule {
	name: string;
	type: string;
	/** "Everyone" where every fighter carries it. */
	fighters: string;
	text: string;
	/** The deck's own word, such as "Already included." */
	note?: string;
}

export interface Roster {
	name: string;
	faction: string;
	fighterCount: string;
	value: string;
	favour: string;
	standing: string;
	reputation: string;
	/** Won, drawn and lost. */
	results: [number, number, number];
	stash: string;
	fighters: RosterFighter[];
	rules: RosterRule[];
}

const STAT_ORDER = ['move', 'fight', 'shoot', 'defense', 'health', 'bravery'] as const;

/*
 * The cards' order: whatever has no type of its own first, then trait, double,
 * triple and quad, then what the gear brings. Each group by name.
 */
const RULE_ORDER = ['Faction rule', 'Ability', 'Trait', 'Double', 'Triple', 'Quad', 'Weapon rule', 'Item'];

function entries(card: FighterCardData, ...kinds: string[]): CardEntry[] {
	return card.sections.filter((s) => kinds.includes(s.kind)).flatMap((s) => s.entries);
}

function statText(card: FighterCardData, key: (typeof STAT_ORDER)[number]): string {
	const value = card.stats.find((s) => s.key === key)?.value;
	if (value === undefined) return '–';
	if (key === 'move') return `${value}"`;
	if (key === 'bravery') return `${value}+`;
	return String(value);
}

function cardValue(card: WarbandCardData, key: string): string {
	return card.tables.flat().find((v) => v.key === key)?.value ?? '';
}

/*
 * The card writes the gold as `pending/remaining` while purchases wait for
 * confirmation, and as the bare figure otherwise.
 */
function goldText(card: WarbandCardData): string {
	const [first, second] = cardValue(card, 'gold').split('/');
	if (second === undefined) return `${first} gold coins`;
	return `${second} gold coins (${first} of them pending)`;
}

function toFighter(card: FighterCardData): RosterFighter {
	return {
		instanceId: card.instanceId,
		name: card.name,
		type: card.subtitle,
		stats: STAT_ORDER.map((key) => statText(card, key)),
		xp: card.xp,
		renown: card.renown,
		cost: card.cost,
		keywords: card.keywords.join(', '),
		talents: entries(card, 'fighter', 'other').map((e) => e.label),
		weapons: card.weapons,
		items: entries(card, 'equipment')
			.map((e) => e.label)
			.join(', '),
		notes: entries(card, 'notes').map((e) => e.text)
	};
}

/**
 * Every rule once. A label in brackets names its type; one without takes the
 * type of the place it comes from.
 */
function collectRules(cards: FighterCardData[]): RosterRule[] {
	const rules = new Map<string, Omit<RosterRule, 'fighters'> & { carriers: string[] }>();

	const add = (entry: CardEntry, fallback: string, carrier: string) => {
		const match = entry.label.match(/^\[(\w+)\]\s*(.*)$/);
		const type = match ? match[1][0].toUpperCase() + match[1].slice(1).toLowerCase() : fallback;
		const name = match ? match[2] : entry.label;
		const key = `${type}|${name}`;
		const rule = rules.get(key) ?? { name, type, text: entry.text, note: entry.note, carriers: [] };
		if (!rule.carriers.includes(carrier)) rule.carriers.push(carrier);
		rules.set(key, rule);
	};

	for (const card of cards) {
		for (const e of entries(card, 'faction')) add(e, 'Faction rule', card.instanceId);
		for (const e of entries(card, 'fighter', 'other')) add(e, 'Ability', card.instanceId);
		for (const weapon of card.weapons) for (const e of weapon.explanation?.rules ?? []) add(e, 'Weapon rule', card.instanceId);
		for (const e of entries(card, 'equipment')) add(e, 'Item', card.instanceId);
	}

	const names = new Map(cards.map((c) => [c.instanceId, c.name]));

	return [...rules.values()]
		.sort((a, b) => RULE_ORDER.indexOf(a.type) - RULE_ORDER.indexOf(b.type) || a.name.localeCompare(b.name))
		.map(({ carriers, ...rule }) => ({
			...rule,
			fighters: carriers.length === cards.length ? 'Everyone' : carriers.map((id) => names.get(id)).join(', ')
		}));
}

export function toRoster(entry: StoredWarband): Roster {
	const [warband, ...rest] = toCards(entry.warband, entry.selections, entry.fluff, entry.history, entry.renownHistory);
	const card = warband as WarbandCardData;
	const fighters = rest as FighterCardData[];
	const history = entry.history ?? [];
	const count = (result: string) => history.filter((r) => r.result === result).length;

	return {
		name: card.name,
		faction: card.faction,
		fighterCount: cardValue(card, 'fighters'),
		value: cardValue(card, 'value'),
		favour: cardValue(card, 'favour'),
		standing: cardValue(card, 'standing'),
		reputation: cardValue(card, 'reputation'),
		results: [count('win'), count('draw'), count('loss')],
		stash: [goldText(card), card.stash].filter(Boolean).join(', '),
		fighters: fighters.map(toFighter),
		rules: collectRules(fighters)
	};
}
