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
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const RULES = resolve(ROOT, 'src/lib/rules');

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

const STATS = ['move', 'fight', 'shoot', 'defense', 'health', 'bravery'];
const PHASES = ['recruitment', 'battle', 'aftermath'];

const shared = {
	campaign: join(RULES, 'campaign.json'),
	keywords: join(RULES, 'keywords.json'),
	weapons: join(RULES, 'weapons.json'),
	items: join(RULES, 'items.json'),
	weaponRules: join(RULES, 'weapon-rules.json'),
	universal: join(RULES, 'universal-abilities.json')
};

const campaign = (await read(shared.campaign)) ?? {};
const keywords = (await read(shared.keywords)) ?? [];
const weapons = (await read(shared.weapons)) ?? [];
const items = (await read(shared.items)) ?? [];
const weaponRules = (await read(shared.weaponRules)) ?? [];
const universal = (await read(shared.universal)) ?? [];

const ids = (list) => new Set(list.map((entry) => entry.id));
const keywordIds = ids(keywords);
const weaponIds = ids(weapons);
const itemIds = ids(items);
const weaponRuleIds = ids(weaponRules);

/** Ids have to be unique per file, or the loader's map silently keeps one. */
function duplicates(file, list) {
	const seen = new Set();
	for (const entry of list) {
		if (seen.has(entry.id)) problem(file, `id "${entry.id}" appears more than once`);
		seen.add(entry.id);
	}
}

duplicates(shared.keywords, keywords);
duplicates(shared.weapons, weapons);
duplicates(shared.items, items);
duplicates(shared.weaponRules, weaponRules);
duplicates(shared.universal, universal);

for (const weapon of weapons) {
	for (const rule of weapon.rules) {
		if (!weaponRuleIds.has(rule)) {
			problem(shared.weapons, `"${weapon.id}" names the special rule "${rule}", weapon-rules.json has none`);
		}
	}
	if (weapon.range.min > weapon.range.max) {
		problem(shared.weapons, `"${weapon.id}" has a range from ${weapon.range.min} to ${weapon.range.max}`);
	}
}

for (const item of items) {
	for (const effect of item.effects) {
		if (!STATS.includes(effect.characteristic)) {
			problem(shared.items, `"${item.id}" changes "${effect.characteristic}", which is not a characteristic`);
		}
	}
	/* Armour without a slot would take no place at all: the wizard would let a
	   fighter wear a shield in a full hand, or two suits of armour at once. */
	if (item.type === 'armour' && !['hand', 'body'].includes(item.slot)) {
		problem(shared.items, `"${item.id}" is armour but takes the slot "${item.slot}"`);
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

const factionsDir = join(RULES, 'factions');
const folders = (await readdir(factionsDir, { withFileTypes: true }))
	.filter((entry) => entry.isDirectory())
	.map((entry) => entry.name);

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
		problem(file('faction'), `no keyword "${faction.id}" in keywords.json – a fighter of this faction carries it`);
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
		} else {
			problem(file('rules'), `${where} has an effect of kind "${effect.kind}"`);
		}
	}

	for (const rule of rules) {
		if (!PHASES.includes(rule.phase)) {
			problem(file('rules'), `"${rule.id}" takes hold in "${rule.phase}", which is not a phase`);
		}
		checkEffect(`"${rule.id}"`, rule.effect);

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
	}
}

/* --- Report -------------------------------------------------------------- */

const written = folders.length - waiting.length;
const counted = `${written} faction(s), ${weapons.length} weapons, ${items.length} items, ${keywords.length} keywords`;
const pending = waiting.length ? `\n${waiting.length} folder(s) still to transcribe: ${waiting.join(', ')}` : '';

if (problems.length) {
	console.error(`${problems.length} problem(s) in src/lib/rules/ – ${counted}\n`);
	for (const line of problems) console.error(`  ${line}`);
	console.error(pending.trimStart());
	process.exit(1);
}

console.log(`src/lib/rules/ resolves – ${counted}${pending}`);
