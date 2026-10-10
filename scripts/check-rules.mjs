/**
 * Resolves every id in src/lib/rules/ and reports the ones that point nowhere.
 *
 * The ruleset is cut into small files – one per question asked while
 * maintaining it – so its ids cross file boundaries: a fighter names abilities,
 * an allowance names a weapon, a faction rule names fighters. Nothing at run
 * time notices a typo there; the wizard would just offer one option less.
 *
 * Reads the files from disk rather than importing the loader, so every message
 * can name the file and the id, and so the run needs nothing but node.
 *
 * Usage:  npm run check:rules
 */
import { access, readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const RULES = resolve(ROOT, 'src/lib/rules');

/** The 36 results of a D66, tens die then units die: 11 to 16, 21 to 26 … 66. */
const D66 = [1, 2, 3, 4, 5, 6].flatMap((tens) => [1, 2, 3, 4, 5, 6].map((units) => tens * 10 + units));
/** "11-13", or a single result such as "25". */
const D66_BAND = /^([1-6][1-6])(?:-([1-6][1-6]))?$/;

const problems = [];
/* Folders that are waiting for their faction. Kept apart from the problems: a
   gate that is red for six sessions in a row stops being read. */
const waiting = [];

/** Every message carries the file, so a run points straight at the line to fix. */
function problem(file, message) {
	problems.push(`${relative(ROOT, file)}: ${message}`);
}

/**
 * Reports a file that cannot be read rather than throwing: a placeholder for a
 * faction still to be written would otherwise end the run before the factions
 * that are finished are looked at.
 */
async function read(file) {
	const text = await readFile(file, 'utf8');
	if (!text.trim()) {
		problem(file, 'is empty');
		return null;
	}
	try {
		return JSON.parse(text);
	} catch (error) {
		problem(file, `is not JSON – ${error.message}`);
		return null;
	}
}

async function exists(file) {
	try {
		await access(file);
		return true;
	} catch {
		return false;
	}
}

const STATS = ['move', 'fight', 'shoot', 'defense', 'health', 'bravery'];
const PHASES = ['recruitment', 'battle', 'aftermath'];

const shared = {
	campaign: join(RULES, 'campaign.json'),
	keywords: join(RULES, 'keywords.json'),
	racialLimits: join(RULES, 'racial-limits.json'),
	weapons: join(RULES, 'weapons.json'),
	items: join(RULES, 'items.json'),
	weaponRules: join(RULES, 'weapon-rules.json'),
	universal: join(RULES, 'universal-abilities.json'),
	talents: join(RULES, 'heroic-talents.json')
};

const campaign = (await read(shared.campaign)) ?? {};
const keywords = (await read(shared.keywords)) ?? [];
const racialLimits = (await read(shared.racialLimits)) ?? [];
const weapons = (await read(shared.weapons)) ?? [];
const items = (await read(shared.items)) ?? [];
const weaponRules = (await read(shared.weaponRules)) ?? [];
const universal = (await read(shared.universal)) ?? [];
const talents = (await read(shared.talents)) ?? [];

const ids = (list) => new Set(list.map((entry) => entry.id));
const keywordIds = ids(keywords);
const racialLimitIds = ids(racialLimits);
const weaponIds = ids(weapons);
const itemIds = ids(items);
const weaponRuleIds = ids(weaponRules);

/* --- What the homebrew factions add to the shared lists ------------------- */

const factionsDir = join(RULES, 'factions');
const folders = (await readdir(factionsDir, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

/** The folders that brought a homebrew.json, checked against `origin` below. */
const brought = new Set();

/**
 * Which file a merged weapon, item or keyword was written in. The shape checks
 * below run over the merged lists, and without this they would name the shared
 * list for a weapon that sits in a faction's folder or a hired sword's file.
 */
const cameFrom = new Map();

/*
 * Merged into the shared lists rather than held beside them, the way the app
 * loads them: everything downstream resolves an id against one list. They are
 * merged before the shape is checked, so a homebrew weapon is held to the same
 * rules as a printed one.
 *
 * An id that already exists is refused instead of merged. Two factions each
 * with their own `sword` would leave the map with whichever came last, and the
 * other faction would quietly sell the wrong weapon.
 */
for (const folder of folders) {
	const file = join(factionsDir, folder, 'homebrew.json');
	const added = (await readdir(join(factionsDir, folder))).includes('homebrew.json')
		? await read(file)
		: null;
	if (!added) continue;
	brought.add(folder);

	for (const [key, list, taken] of [
		['keywords', keywords, keywordIds],
		['racial-limits', racialLimits, racialLimitIds],
		['weapons', weapons, weaponIds],
		['items', items, itemIds],
		['weapon-rules', weaponRules, weaponRuleIds]
	]) {
		for (const entry of added[key] ?? []) {
			if (taken.has(entry.id)) {
				problem(file, `"${entry.id}" is already in ${key}.json – a homebrew id has to be its own`);
				continue;
			}
			list.push(entry);
			taken.add(entry.id);
			cameFrom.set(entry.id, file);
		}
	}
}

/* --- What the hired swords add to them ----------------------------------- */

/*
 * One file per hired sword, and the file is the whole entry: its talents and
 * the weapons only it carries are written into it, because nothing else can
 * reach them. Those weapons go into the shared lists all the same – everything
 * downstream resolves an id against one map – so what two hired swords share
 * has to move to `weapons.json`, and the collision below is what says so.
 */
const hiredDir = join(RULES, 'hired-swords');
const hiredFiles = (await readdir(hiredDir).catch(() => []))
	.filter((name) => name.endsWith('.json'))
	.sort();

/** The ones with something in them, as `{ file, name, entry }`. */
const hiredSwords = [];
/** Files that are still an empty object, kept out of the problems like a folder. */
const waitingHired = [];

for (const name of hiredFiles) {
	const file = join(hiredDir, name);
	const entry = await read(file);
	if (!entry) continue;
	if (!Object.keys(entry).length) {
		waitingHired.push(`hired-swords/${name}`);
		continue;
	}
	hiredSwords.push({ file, name, entry });

	for (const [key, list, taken] of [
		['weapons', weapons, weaponIds],
		['items', items, itemIds]
	]) {
		for (const own of entry[key] ?? []) {
			if (taken.has(own.id)) {
				problem(file, `"${own.id}" is taken already – what two of them carry belongs in ${key}.json`);
				continue;
			}
			list.push(own);
			taken.add(own.id);
			cameFrom.set(own.id, file);
		}
	}
}

/** Ids have to be unique per file, or the loader's map silently keeps one. */
function duplicates(file, list) {
	const seen = new Set();
	for (const entry of list) {
		if (seen.has(entry.id)) problem(file, `id "${entry.id}" appears more than once`);
		seen.add(entry.id);
	}
}

duplicates(shared.keywords, keywords);
duplicates(shared.racialLimits, racialLimits);
duplicates(shared.weapons, weapons);
duplicates(shared.items, items);
duplicates(shared.weaponRules, weaponRules);
duplicates(shared.universal, universal);
duplicates(shared.talents, talents);

/* Every race needs an entry, so a missing one cannot pass for "no limit": that
   is a `profile` of null. The races come from the race keywords and from the
   synced fighters, whose race list also carries BEAST and THRALL; without a
   sync only the keywords are known. */
const raceIds = new Set(keywords.filter((keyword) => keyword.type === 'race').map((keyword) => keyword.id));
const syncedFighters = join(ROOT, 'src/lib/data/fighters.json');
for (const fighter of (await exists(syncedFighters)) ? ((await read(syncedFighters)) ?? []) : []) {
	for (const race of fighter.race ?? []) raceIds.add(race.toLowerCase().replace(/ /g, '-'));
}
for (const race of raceIds) {
	if (!racialLimitIds.has(race)) problem(shared.racialLimits, `"${race}" is a race without an entry – null if it has no limit`);
}
for (const limit of racialLimits) {
	const where = cameFrom.get(limit.id) ?? shared.racialLimits;
	if (!raceIds.has(limit.id)) {
		problem(where, `"${limit.id}" is a racial limit, but no race goes by that id`);
	}
	if (limit.profile === null) continue;
	for (const key of STATS) {
		/* Renown never raises Armour, so a limit on it would bind nothing. */
		if (key === 'defense') {
			if (key in (limit.profile ?? {})) problem(where, `"${limit.id}" limits defense, which renown cannot raise`);
		} else if (typeof limit.profile?.[key] !== 'number') {
			problem(where, `"${limit.id}" has no ${key} in its profile`);
		}
	}
}

for (const weapon of weapons) {
	const where = cameFrom.get(weapon.id) ?? shared.weapons;
	for (const rule of weapon.rules ?? []) {
		if (!weaponRuleIds.has(rule)) {
			problem(where, `"${weapon.id}" names the special rule "${rule}", weapon-rules.json has none`);
		}
	}
	if (weapon.range.min > weapon.range.max) {
		problem(where, `"${weapon.id}" has a range from ${weapon.range.min} to ${weapon.range.max}`);
	}
}

for (const item of items) {
	const where = cameFrom.get(item.id) ?? shared.items;
	for (const effect of item.effects ?? []) {
		if (!STATS.includes(effect.characteristic)) {
			problem(where, `"${item.id}" changes "${effect.characteristic}", which is not a characteristic`);
		}
	}
	/* Armour without a slot would take no place at all: the wizard would let a
	   fighter wear a shield in a full hand, or two suits of armour at once. */
	if (item.type === 'armour' && !['hand', 'body'].includes(item.slot)) {
		problem(where, `"${item.id}" is armour but takes the slot "${item.slot}"`);
	}
}

for (const rule of weaponRules) {
	const effect = rule.effect;
	if (!effect) continue;
	if (effect.characteristic !== 'attack' && !STATS.includes(effect.characteristic)) {
		problem(shared.weaponRules, `"${rule.id}" changes "${effect.characteristic}", which is neither a characteristic nor "attack"`);
	}
	if (!['always', 'when-attacking', 'when-targeted'].includes(effect.applies)) {
		problem(shared.weaponRules, `"${rule.id}" applies "${effect.applies}", which is not one of the three cases`);
	}
}

for (const ability of universal) {
	if (ability.keyword !== 'any' && !keywordIds.has(ability.keyword)) {
		problem(shared.universal, `"${ability.id}" hangs on the keyword "${ability.keyword}", keywords.json has none`);
	}
}

/* --- One faction per directory ------------------------------------------- */

if (!folders.length) problem(factionsDir, 'no faction directory at all');

for (const folder of folders) {
	const dir = join(factionsDir, folder);
	const file = (name) => join(dir, `${name}.json`);

	const present = new Set((await readdir(dir)).filter((name) => name.endsWith('.json')));
	for (const required of ['faction.json', 'fighters.json', 'equipment.json', 'rules.json', 'abilities.json']) {
		if (!present.has(required)) problem(dir, `${required} is missing`);
	}
	if (!present.has('faction.json') || !present.has('fighters.json')) continue;

	const faction = await read(file('faction'));
	const fighters = await read(file('fighters'));
	/* Without these two there is nothing to resolve against; `read` has already
	   said why, so the folder is left at that. */
	if (!faction || !fighters) continue;
	/* A folder waiting for its faction to be transcribed: an empty object where
	   the faction goes. Named at the end rather than complained about per
	   missing field. */
	if (!Object.keys(faction).length) {
		waiting.push(folder);
		continue;
	}
	const equipment = (present.has('equipment.json') ? await read(file('equipment')) : []) ?? [];
	const rules = (present.has('rules.json') ? await read(file('rules')) : []) ?? [];
	const abilities = (present.has('abilities.json') ? await read(file('abilities')) : []) ?? [];

	duplicates(file('fighters'), fighters);
	duplicates(file('abilities'), abilities);
	duplicates(file('rules'), rules);

	if (faction.id !== folder) {
		problem(file('faction'), `id is "${faction.id}" but the directory is "${folder}"`);
	}
	if (!keywordIds.has(faction.id)) {
		problem(file('faction'), `no keyword "${faction.id}" – a fighter of this faction carries it`);
	}

	/* What an official faction needs belongs in the shared lists, where every
	   faction can reach it; a homebrew.json beside one would hide it in a folder
	   that has no reason to own it. */
	if (!['official', 'homebrew'].includes(faction.origin)) {
		problem(file('faction'), `origin is "${faction.origin}" – write "official" or "homebrew"`);
	} else if (brought.has(folder) && faction.origin !== 'homebrew') {
		problem(file('homebrew'), `this faction is "${faction.origin}" – only a homebrew faction brings one`);
	}

	/* Only a homebrew faction versions a transcription; an official one has
	   nothing of its own to version against. The shape is all a check can judge
	   – what the number should be is a judgement about how much moved. */
	if (faction.origin === 'homebrew' && !/^\d+\.\d+$/.test(faction.version ?? '')) {
		problem(file('faction'), `version is "${faction.version}" – write it as major.minor`);
	} else if (faction.origin === 'official' && faction.version !== undefined) {
		problem(file('faction'), `version is "${faction.version}" – an official faction carries no version`);
	}

	const abilityIds = ids(abilities);
	const fighterIds = ids(fighters);

	/* --- Fighters --- */

	let required = 0;
	for (const fighter of fighters) {
		for (const key of STATS) {
			if (typeof fighter.profile?.[key] !== 'number') {
				problem(file('fighters'), `"${fighter.id}" has no ${key} in its profile`);
			}
		}
		for (const keyword of fighter.keywords) {
			if (!keywordIds.has(keyword)) {
				problem(file('fighters'), `"${fighter.id}" carries the keyword "${keyword}", keywords.json has none`);
			}
		}
		for (const ability of fighter.abilities) {
			if (!abilityIds.has(ability)) {
				problem(file('fighters'), `"${fighter.id}" names the ability "${ability}", abilities.json has none`);
			}
		}
		/* Fixed gear is never sold, so it is not in equipment.json and only this
		   resolves it. A typo there leaves a beast unarmed. An empty list is the
		   answer for most fighters, and it is written out: a missing field reads
		   as a question nobody asked. */
		if (!Array.isArray(fighter.gear)) {
			problem(file('fighters'), `"${fighter.id}" has no gear list – write [] where the fighter brings nothing`);
		}
		for (const prefixed of fighter.gear ?? []) {
			const [kind, id] = prefixed.split(':');
			if (kind === 'weapon') {
				if (!weaponIds.has(id)) problem(file('fighters'), `"${fighter.id}" is born with "${prefixed}" – weapons.json has no "${id}"`);
			} else if (kind === 'item') {
				if (!itemIds.has(id)) problem(file('fighters'), `"${fighter.id}" is born with "${prefixed}" – items.json has no "${id}"`);
			} else {
				problem(file('fighters'), `"${fighter.id}" is born with "${prefixed}", which needs a "weapon:" or "item:" prefix`);
			}
		}

		const { min, max } = fighter.limit ?? {};
		if (typeof min !== 'number' || (max !== null && typeof max !== 'number')) {
			problem(file('fighters'), `"${fighter.id}" has no usable limit`);
		} else if (max !== null && min > max) {
			problem(file('fighters'), `"${fighter.id}" may appear at least ${min} and at most ${max} times`);
		}
		required += min ?? 0;

		const choice = fighter.choose;
		if (!choice) continue;
		if (choice.instead_of_talent !== undefined && choice.kind !== 'ability') {
			problem(file('fighters'), `"${fighter.id}" may learn more later, but its choice is of kind "${choice.kind}", not "ability"`);
		}
		/* Null where the profile asks for the choice itself; the sentence then comes
		   from `prompt`, and there is no ability to resolve. */
		if (choice.source !== null && !abilityIds.has(choice.source)) {
			problem(file('fighters'), `the choice of "${fighter.id}" comes from "${choice.source}", abilities.json has none`);
		}
		if (choice.source === null && !choice.prompt) {
			problem(file('fighters'), `the choice of "${fighter.id}" comes from no ability and carries no prompt, so it shows without a sentence`);
		}
		if (choice.kind === 'stat') {
			const offered = choice.characteristics ?? [];
			for (const key of offered) {
				if (!STATS.includes(key)) {
					problem(file('fighters'), `the choice of "${fighter.id}" offers "${key}", which is not a characteristic`);
				}
			}
			if (choice.pick > offered.length) {
				problem(file('fighters'), `the choice of "${fighter.id}" picks ${choice.pick} of ${offered.length}`);
			}
			if (typeof choice.bonus !== 'number') {
				problem(file('fighters'), `the choice of "${fighter.id}" raises a characteristic by nothing`);
			}
		} else if (choice.kind === 'ability') {
			const offered = choice.abilities ?? [];
			for (const id of offered) {
				if (!abilityIds.has(id)) {
					problem(file('fighters'), `the choice of "${fighter.id}" offers "${id}", abilities.json has none`);
				}
			}
			if (choice.pick > offered.length) {
				problem(file('fighters'), `the choice of "${fighter.id}" picks ${choice.pick} of ${offered.length}`);
			}
			if (choice.instead_of_talent !== undefined && choice.pick + choice.instead_of_talent > offered.length) {
				problem(file('fighters'), `"${fighter.id}" picks ${choice.pick} and may learn ${choice.instead_of_talent} more, of ${offered.length} offered`);
			}
		} else if (choice.kind === 'roll') {
			const table = rules.find((entry) => entry.id === choice.table);
			if (!table) {
				problem(file('fighters'), `the choice of "${fighter.id}" rolls on "${choice.table}", rules.json has none`);
			} else if (!Array.isArray(table.table) || !table.table.length) {
				problem(file('fighters'), `the choice of "${fighter.id}" rolls on "${choice.table}", which carries no table`);
			}
			if (choice.pick !== 1) {
				problem(file('fighters'), `the choice of "${fighter.id}" rolls but picks ${choice.pick} – a roll gives exactly one result`);
			}
		} else {
			problem(file('fighters'), `the choice of "${fighter.id}" is of kind "${choice.kind}"`);
		}
	}

	/* A warband that must field more fighters than it may hold cannot be built. */
	const { min: sizeMin, max: sizeMax } = faction.warband_size ?? {};
	if (typeof sizeMin !== 'number' || typeof sizeMax !== 'number') {
		problem(file('faction'), 'warband_size needs a min and a max');
	} else {
		if (sizeMin > sizeMax) problem(file('faction'), `warband_size runs from ${sizeMin} to ${sizeMax}`);
		if (required > sizeMax) {
			problem(file('fighters'), `the mandatory fighters add up to ${required}, the warband holds ${sizeMax}`);
		}
	}

	/* --- Equipment --- */

	for (const allowance of equipment) {
		const [kind, id] = allowance.id.split(':');
		if (kind === 'weapon') {
			if (!weaponIds.has(id)) problem(file('equipment'), `"${allowance.id}" – weapons.json has no "${id}"`);
		} else if (kind === 'item') {
			if (!itemIds.has(id)) problem(file('equipment'), `"${allowance.id}" – items.json has no "${id}"`);
		} else {
			problem(file('equipment'), `"${allowance.id}" needs a "weapon:" or "item:" prefix`);
		}
		if (!['all', 'hero'].includes(allowance.allow)) {
			problem(file('equipment'), `"${allowance.id}" is allowed for "${allowance.allow}"`);
		}
		if (allowance.restrict !== undefined && !keywordIds.has(allowance.restrict)) {
			problem(file('equipment'), `"${allowance.id}" is restricted to "${allowance.restrict}", which is not a keyword`);
		}
	}

	/* --- Faction rules --- */

	function checkEffect(where, effect) {
		if (!effect) return;
		if (effect.kind === 'stat') {
			if (!STATS.includes(effect.characteristic)) {
				problem(file('rules'), `${where} changes "${effect.characteristic}", which is not a characteristic`);
			}
			if (effect.fighters !== 'all') {
				for (const id of effect.fighters ?? []) {
					if (!fighterIds.has(id)) {
						problem(file('rules'), `${where} applies to "${id}", fighters.json has none`);
					}
				}
			}
		} else if (effect.kind === 'recruit') {
			for (const id of effect.forbid ?? []) {
				if (!fighterIds.has(id)) problem(file('rules'), `${where} forbids "${id}", fighters.json has none`);
			}
			for (const entry of effect.discount ?? []) {
				if (!fighterIds.has(entry.fighter)) {
					problem(file('rules'), `${where} discounts "${entry.fighter}", fighters.json has none`);
				}
			}
		} else if (effect.kind === 'morale') {
			if (typeof effect.weight !== 'number' || !(effect.weight > 0)) {
				problem(file('rules'), `${where} weighs fighters at "${effect.weight}", which is not a positive number`);
			}
			if (effect.fighters !== 'all') {
				for (const id of effect.fighters ?? []) {
					if (!fighterIds.has(id)) {
						problem(file('rules'), `${where} applies to "${id}", fighters.json has none`);
					}
				}
			}
		} else if (effect.kind === 'zeal') {
			if (!Number.isInteger(effect.at) || effect.at < 0) {
				problem(file('rules'), `${where} holds from Zeal "${effect.at}", which is not a whole number from 0`);
			}
			if (typeof effect.label !== 'string' || !effect.label) {
				problem(file('rules'), `${where} has a Zeal stage without a label`);
			}
			if (effect.conditions) {
				for (const key of effect.conditions.stats ?? []) {
					if (!STATS.includes(key)) {
						problem(file('rules'), `${where} is conditional on "${key}", which is not a characteristic`);
					}
				}
				if (effect.conditions.amount !== undefined && typeof effect.conditions.amount !== 'number') {
					problem(file('rules'), `${where} has a condition worth "${effect.conditions.amount}", which is not a number`);
				}
				if (typeof effect.conditions.text !== 'string' || !effect.conditions.text) {
					problem(file('rules'), `${where} has a condition without a text`);
				}
			}
			if (effect.except !== undefined && !keywordIds.has(effect.except)) {
				problem(file('rules'), `${where} leaves out "${effect.except}", which is not a keyword`);
			}
			for (const [key, amount] of Object.entries(effect.amounts ?? {})) {
				if (!STATS.includes(key)) {
					problem(file('rules'), `${where} changes "${key}", which is not a characteristic`);
				}
				if (typeof amount !== 'number') {
					problem(file('rules'), `${where} changes "${key}" by "${amount}", which is not a number`);
				}
			}
		} else {
			problem(file('rules'), `${where} has an effect of kind "${effect.kind}"`);
		}
	}

	for (const rule of rules) {
		if (!PHASES.includes(rule.phase)) {
			problem(file('rules'), `"${rule.id}" takes hold in "${rule.phase}", which is not a phase`);
		}
		checkEffect(`"${rule.id}"`, rule.effect);
		if (rule.except !== undefined && !keywordIds.has(rule.except)) {
			problem(file('rules'), `"${rule.id}" leaves out "${rule.except}", which is not a keyword`);
		}
		if (rule.only !== undefined && !keywordIds.has(rule.only)) {
			problem(file('rules'), `"${rule.id}" applies only to "${rule.only}", which is not a keyword`);
		}
		if (rule.except !== undefined && rule.only !== undefined) {
			problem(file('rules'), `"${rule.id}" has both except and only – one of them says it all`);
		}

		if (rule.table) {
			/* Every D66 result lands in exactly one row: the wizard's Roll button
			   picks the row whose band holds the result, and a gap would leave it
			   with nothing to pick. */
			const covered = new Map();
			for (const row of rule.table) {
				const band = typeof row.roll === 'string' ? row.roll.match(D66_BAND) : null;
				if (!band) {
					problem(file('rules'), `"${rule.id}" has a table row whose roll is no D66 band like "11-13"`);
				} else {
					const low = Number(band[1]);
					const high = Number(band[2] ?? band[1]);
					for (const result of D66.filter((r) => r >= low && r <= high)) {
						if (covered.has(result)) {
							problem(file('rules'), `"${rule.id}": ${result} falls in both "${covered.get(result)}" and "${row.roll}"`);
						} else {
							covered.set(result, row.roll);
						}
					}
				}
				if (!row.name || !row.text) {
					problem(file('rules'), `"${rule.id}" has a table row (roll ${row.roll}) with no name or text`);
				}
				for (const keyword of row.keywords ?? []) {
					if (!keywordIds.has(keyword)) {
						problem(file('rules'), `"${rule.id}" (roll ${row.roll}) hands out the keyword "${keyword}", keywords.json has none`);
					}
				}
				if (row.weapon !== undefined && !weaponIds.has(row.weapon)) {
					problem(file('rules'), `"${rule.id}" (roll ${row.roll}) is the weapon "${row.weapon}", weapons.json has none`);
				}
			}
			const missing = D66.filter((result) => !covered.has(result));
			if (missing.length) {
				problem(file('rules'), `"${rule.id}" has no row for ${missing.join(', ')}`);
			}
		}

		const options = rule.options ?? [];
		if (rule.pick === null) {
			if (options.length) problem(file('rules'), `"${rule.id}" offers ${options.length} options but picks none`);
		} else if (typeof rule.pick !== 'number' || rule.pick < 1) {
			problem(file('rules'), `"${rule.id}" picks "${rule.pick}"`);
		} else if (rule.pick > options.length) {
			problem(file('rules'), `"${rule.id}" picks ${rule.pick} of ${options.length} options`);
		}

		duplicates(file('rules'), options);
		for (const option of options) {
			if (!PHASES.includes(option.phase)) {
				problem(file('rules'), `"${rule.id}" → "${option.id}" takes hold in "${option.phase}"`);
			}
			/* A rule that changes a number outside recruitment would be applied by
			   nobody: the wizard only builds the warband. */
			if (option.effect && option.phase !== 'recruitment') {
				problem(file('rules'), `"${rule.id}" → "${option.id}" carries an effect but takes hold in "${option.phase}"`);
			}
			checkEffect(`"${rule.id}" → "${option.id}"`, option.effect);
		}
	}
}

/* --- One hired sword per file --------------------------------------------- */

/*
 * A hired sword belongs to no faction: it is hired when a battle is set up, for
 * that battle, and `may_hire` says who may hire it. So its file is checked here
 * rather than in the loop above, and against the same shared lists.
 */

const hiredIds = new Set();

for (const { file, name, entry } of hiredSwords) {
	if (`${entry.id}.json` !== name) {
		problem(file, `id is "${entry.id}" but the file is "${name}"`);
	}
	if (hiredIds.has(entry.id)) problem(file, `a second hired sword is called "${entry.id}"`);
	hiredIds.add(entry.id);

	if (!['official', 'homebrew'].includes(entry.origin)) {
		problem(file, `origin is "${entry.origin}" – write "official" or "homebrew"`);
	}
	/* The shape only, as on a faction: what the number should be is a judgement
	   about how much of the entry moved. */
	if (!/^\d+\.\d+$/.test(entry.version ?? '')) {
		problem(file, `version is "${entry.version}" – write it as major.minor`);
	}
	/* The fee, paid per battle. Zero would be a free hire, which no entry means. */
	if (typeof entry.cost !== 'number' || entry.cost <= 0) {
		problem(file, `cost is "${entry.cost}" – the hiring fee is a number of gold crowns`);
	}

	const { min, max } = entry.limit ?? {};
	if (typeof min !== 'number' || (max !== null && typeof max !== 'number')) {
		problem(file, 'has no usable limit');
	} else if (max !== null && min > max) {
		problem(file, `may be hired at least ${min} and at most ${max} times`);
	}

	/* The list is the whole restriction: an empty one would be a hired sword
	   nobody can take, and the entry would never show up anywhere. */
	if (!Array.isArray(entry.may_hire) || !entry.may_hire.length) {
		problem(file, 'may_hire names no faction, so nobody could ever hire it');
	}
	for (const id of entry.may_hire ?? []) {
		/* Checked against the directory rather than against faction.json: the loop
		   above already holds every folder's id to its own name. */
		if (!folders.includes(id)) {
			problem(file, `may be hired by "${id}", and there is no such faction`);
		}
	}

	for (const key of STATS) {
		if (typeof entry.profile?.[key] !== 'number') problem(file, `has no ${key} in its profile`);
	}
	for (const keyword of entry.keywords ?? []) {
		if (!keywordIds.has(keyword)) {
			problem(file, `carries the keyword "${keyword}", keywords.json has none`);
		}
	}
	/* Every one of them is hired for a battle and none of them is ever on the
	   roster, so the keyword that carries those rules is not optional. */
	if (!(entry.keywords ?? []).includes('hired-sword')) {
		problem(file, 'does not carry the keyword "hired-sword"');
	}

	const abilities = entry.abilities ?? [];
	duplicates(file, abilities);
	const abilityIds = ids(abilities);

	/**
	 * Gear resolves against the shared lists, which by now hold what this file
	 * brought itself. `used` collects what the file reaches for, so an entry it
	 * carries and never arms anybody with can be named at the end.
	 */
	const used = new Set();
	function checkGear(where, gear) {
		if (!Array.isArray(gear)) {
			problem(file, `${where} has no gear list – write [] where it brings nothing`);
			return;
		}
		for (const prefixed of gear) {
			const [kind, id] = prefixed.split(':');
			used.add(prefixed);
			if (kind === 'weapon') {
				if (!weaponIds.has(id)) problem(file, `${where} carries "${prefixed}", and no weapon is called "${id}"`);
			} else if (kind === 'item') {
				if (!itemIds.has(id)) problem(file, `${where} carries "${prefixed}", and no item is called "${id}"`);
			} else {
				problem(file, `${where} carries "${prefixed}", which needs a "weapon:" or "item:" prefix`);
			}
		}
	}

	checkGear('it', entry.gear);

	const choice = entry.choose;
	if (choice) {
		/* Null where the entry asks for the choice itself; the sentence then comes
		   from `prompt`, and there is no ability to resolve. */
		if (choice.source !== null && !abilityIds.has(choice.source)) {
			problem(file, `its choice comes from "${choice.source}", and it has no such ability`);
		}
		if (choice.source === null && !choice.prompt) {
			problem(file, 'its choice comes from no ability and carries no prompt, so it shows without a sentence');
		}

		if (choice.kind === 'role') {
			const roles = choice.roles ?? [];
			if (!roles.length) problem(file, 'its choice offers no roles');
			duplicates(file, roles);
			for (const role of roles) {
				if (!role.name) problem(file, `the role "${role.id}" has no name`);
				if (!abilityIds.has(role.ability)) {
					problem(file, `the role "${role.id}" grants "${role.ability}", and it has no such ability`);
				}
				checkGear(`the role "${role.id}"`, role.gear);
			}
			/* A role is the fighter's whole face: two of them at once would arm it
			   twice and leave the card with two talents it did not choose. */
			if (choice.pick !== 1) {
				problem(file, `its choice picks ${choice.pick} roles – a fighter is hired as one of them`);
			}
		} else if (choice.kind === 'ability') {
			const offered = choice.abilities ?? [];
			for (const id of offered) {
				if (!abilityIds.has(id)) problem(file, `its choice offers "${id}", and it has no such ability`);
			}
			if (choice.pick > offered.length) {
				problem(file, `its choice picks ${choice.pick} of ${offered.length}`);
			}
		} else if (choice.kind === 'stat') {
			const offered = choice.characteristics ?? [];
			for (const key of offered) {
				if (!STATS.includes(key)) {
					problem(file, `its choice offers "${key}", which is not a characteristic`);
				}
			}
			if (choice.pick > offered.length) problem(file, `its choice picks ${choice.pick} of ${offered.length}`);
			if (typeof choice.bonus !== 'number') problem(file, 'its choice raises a characteristic by nothing');
		} else if (choice.kind === 'roll') {
			/* A roll needs the table a faction rule carries, and a hired sword has
			   no rules of its own to carry one. */
			problem(file, 'its choice rolls on a table, and a hired sword has no rules to hold one');
		} else {
			problem(file, `its choice is of kind "${choice.kind}"`);
		}
	}

	/* An ability nothing grants would never reach a card: the talents a hired
	   sword always has are the ones outside the roles. */
	const granted = new Set((entry.choose?.roles ?? []).map((role) => role.ability));
	for (const ability of abilities) {
		if (!['trait', 'double', 'triple', 'quad', 'reaction'].includes(ability.type)) {
			problem(file, `"${ability.id}" is of type "${ability.type}"`);
		}
		if (!ability.name || !ability.text) problem(file, `"${ability.id}" has no name or no text`);
	}
	if (granted.size && granted.size === abilities.length) {
		problem(file, 'every one of its abilities hangs on a role, so it has no talent of its own');
	}

	/* A weapon written into the file and armed with nowhere is a transcription
	   that stopped halfway – and it would still take its id from the shared list. */
	for (const [key, kind] of [
		['weapons', 'weapon'],
		['items', 'item']
	]) {
		duplicates(file, entry[key] ?? []);
		for (const own of entry[key] ?? []) {
			if (!used.has(`${kind}:${own.id}`)) {
				problem(file, `carries the ${kind} "${own.id}" and arms nobody with it`);
			}
		}
	}
}

/* --- Campaign ------------------------------------------------------------ */

if (typeof campaign.warband_budget !== 'number' || campaign.warband_budget <= 0) {
	problem(shared.campaign, `warband_budget is ${campaign.warband_budget}`);
}
for (const [name, tiers] of Object.entries({
	standing_thresholds: campaign.standing_thresholds,
	favour_tiers: campaign.favour_tiers
})) {
	let previous = null;
	for (const tier of tiers ?? []) {
		if (tier.min > tier.max) problem(shared.campaign, `${name}: "${tier.label}" runs from ${tier.min} to ${tier.max}`);
		/* A gap or an overlap would leave a value with no tier, or two. */
		if (previous !== null && tier.min !== previous + 1) {
			problem(shared.campaign, `${name}: "${tier.label}" starts at ${tier.min}, the tier before ends at ${previous}`);
		}
		previous = tier.max;
		/* What a favour tier pays; a missing figure would put NaN on the aftermath's back. */
		if (name === 'favour_tiers') {
			for (const key of ['income', 'per_shard']) {
				if (typeof tier[key] !== 'number' || tier[key] < 0) {
					problem(shared.campaign, `favour_tiers: "${tier.label}" has ${key} ${tier[key]}`);
				}
			}
		}
	}
}

/* --- Heroic talents -------------------------------------------------------- */

const SPECIALIZATIONS = ['strength', 'toughness', 'agility', 'perception', 'wits'];
const TALENT_TYPES = ['trait', 'reaction', 'double', 'triple'];
for (const talent of talents) {
	if (!SPECIALIZATIONS.includes(talent.specialization)) {
		problem(shared.talents, `"${talent.id}" has the specialization "${talent.specialization}", which is none of ${SPECIALIZATIONS.join(', ')}`);
	}
	if (!TALENT_TYPES.includes(talent.type)) {
		problem(shared.talents, `"${talent.id}" has the type "${talent.type}", which is none of ${TALENT_TYPES.join(', ')}`);
	}
	if (!talent.name?.trim() || !talent.text?.trim()) problem(shared.talents, `"${talent.id}" has no name or no text`);
	for (const effect of talent.effects ?? []) {
		if (effect.kind === 'keyword') {
			if (!keywordIds.has(effect.keyword)) {
				problem(shared.talents, `"${talent.id}" gives the keyword "${effect.keyword}", keywords.json has none`);
			}
		} else if (effect.kind === 'crit') {
			if (!Number.isInteger(effect.bonus)) problem(shared.talents, `"${talent.id}" adds ${effect.bonus} to critical damage`);
			if (!talent.weapon) problem(shared.talents, `"${talent.id}" adds critical damage but selects no weapon`);
		} else {
			problem(shared.talents, `"${talent.id}" has an effect of kind "${effect.kind}"`);
		}
	}
	if (talent.weapon !== undefined && !['melee', 'ranged'].includes(talent.weapon)) {
		problem(shared.talents, `"${talent.id}" selects a "${talent.weapon}" weapon, which is neither melee nor ranged`);
	}
}

/* --- Report -------------------------------------------------------------- */

const written = folders.length - waiting.length;
const counted = `${written} faction(s), ${hiredSwords.length} hired sword(s), ${weapons.length} weapons, ${items.length} items, ${keywords.length} keywords`;
const stubs = [...waiting, ...waitingHired];
const pending = stubs.length ? `\n${stubs.length} still to transcribe: ${stubs.join(', ')}` : '';

if (problems.length) {
	console.error(`${problems.length} problem(s) in src/lib/rules/ – ${counted}\n`);
	for (const line of problems) console.error(`  ${line}`);
	console.error(pending.trimStart());
	process.exit(1);
}

console.log(`src/lib/rules/ resolves – ${counted}${pending}`);
