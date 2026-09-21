/**
 * Copies the game data from the site repo into src/lib/data/.
 *
 * The target is gitignored: the data belongs to the Wyrdcry project and its
 * licence is unresolved (there is no LICENSE over there). This repo therefore
 * does not ship it, it fetches it locally.
 *
 * Nothing is written before every source has been read and checked. A run that
 * fails halfway would leave a mixture behind that was never shipped together.
 *
 * Usage:  npm run sync:data [-- --from <path to src/data>] [--docs <path to docs>]
 */
import { mkdir, copyFile, readFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '../src/lib/data');

const DEFAULT_SOURCE = resolve(HERE, '../../wyrdcry/src/data');

/** Without these files the app does not start. */
const REQUIRED = [
	'fighters.json',
	'weapons.json',
	'items.json',
	'abilities.json',
	'factions.json',
	'keywords.json',
	'weapon-rules.json'
];

/** Goes into every export and is compared on import. */
const UNKNOWN_RULESET = {
	version: 'unknown',
	label: 'Ruleset unknown',
	slug: 'unknown'
};

/** The campaign level of the warband card. Without it the card drops its tier. */
const NO_CAMPAIGN_RULES = {
	default_favour: 0,
	warband_budget: 0,
	standing_thresholds: [],
	favour_tiers: []
};

/**
 * Copied when present, and what to fall back to when not.
 *
 * `ruleset.json` is currently only on the branch feat/game-reference-print
 * (PR #9), and every export carries its version, so it gets a placeholder.
 * Both files are imported by the app, so neither may be missing from the
 * target – an empty stand-in costs a label on one card, an absent file the
 * whole build.
 */
const OPTIONAL = {
	'ruleset.json': UNKNOWN_RULESET,
	'campaign-rules.json': NO_CAMPAIGN_RULES
};

/**
 * The universal abilities live in the rules pages, not in the JSON data, so they
 * are read out of the Markdown. The table gives the keyword a fighter needs in
 * the first column and the rule in the second:
 *
 *   |`Hero`|**[Triple] Inspiring Presence:** Select a visible friendly fighter…|
 */
const UNIVERSAL_DOC = 'rules/the-combat-phase/abilities.md';
const UNIVERSAL_HEADING = /^##\s+Universal Abilities\s*$/im;
const UNIVERSAL_ROW = /^\|\s*`([^`]+)`\s*\|\s*\*\*\[([^\]]+)\]\s*([^:*]+):\*\*\s*(.+?)\s*\|\s*$/;
/** The `|---|:--:|` line below a Markdown table's header row. */
const TABLE_SEPARATOR = /^\|[\s:|-]+\|\s*$/;

/** Everyone carries this one, so it is no keyword any fighter has to hold. */
const KEYWORD_ANY = 'any';

const slug = (name) =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');

/**
 * Reads the table below the heading, stopping at the next one. Rows it cannot
 * read are handed back rather than skipped: a table whose shape changed halfway
 * would otherwise come through as a shorter list and look like a successful run.
 */
function universalAbilities(markdown) {
	const heading = markdown.match(UNIVERSAL_HEADING);
	if (!heading) return null;

	const rules = [];
	const unreadable = [];
	let inTable = false;

	for (const line of markdown.slice(heading.index + heading[0].length).split('\n')) {
		if (/^##\s/.test(line)) break;
		if (TABLE_SEPARATOR.test(line)) {
			inTable = true;
			continue;
		}
		if (!inTable || !line.startsWith('|')) continue;

		const match = line.match(UNIVERSAL_ROW);
		if (!match) {
			unreadable.push(line.trim());
			continue;
		}

		const [, keyword, type, name, description] = match;
		rules.push({
			id: slug(name),
			name: name.trim(),
			ability_type: type.trim().toLowerCase(),
			keyword: keyword.trim(),
			description: description.trim()
		});
	}

	return { rules, unreadable };
}

function argument(flag) {
	const i = process.argv.indexOf(flag);
	return i !== -1 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : null;
}

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

function fail(...lines) {
	console.error('');
	for (const line of lines) console.error(line);
	process.exit(1);
}

const source = argument('--from') ?? DEFAULT_SOURCE;
/* The rules pages sit in the site repo's docs/, a sibling of its src/. */
const docs = argument('--docs') ?? resolve(source, '../../docs');

if (!(await exists(source))) {
	fail(
		`Source not found: ${source}`,
		'Site repo elsewhere? npm run sync:data -- --from <path to src/data>'
	);
}

/* ── Read and check everything, then write ──────────────────────────────── */

const missing = [];
for (const file of REQUIRED) {
	if (!(await exists(join(source, file)))) missing.push(file);
}

if (missing.length) {
	fail(`Missing required files in ${source}:`, ...missing.map((file) => `  ${file}`));
}

const universalPath = join(docs, UNIVERSAL_DOC);

if (!(await exists(universalPath))) {
	fail(
		`Rules page not found: ${universalPath}`,
		'The universal abilities are read from there, they are in no JSON file.',
		'Docs elsewhere? npm run sync:data -- --docs <path to docs>'
	);
}

const universal = universalAbilities(await readFile(universalPath, 'utf8'));

if (!universal) {
	fail(
		`No "Universal Abilities" heading in ${UNIVERSAL_DOC}.`,
		'Renamed or moved upstream – the extraction needs adjusting.'
	);
}

if (universal.unreadable.length) {
	fail(
		`Table rows in ${UNIVERSAL_DOC} that the extraction cannot read:`,
		...universal.unreadable.map((line) => `  ${line}`),
		'Row shape changed upstream. Taking the rest would drop these rules silently.'
	);
}

if (!universal.rules.length) {
	fail(
		`No universal abilities below the heading in ${UNIVERSAL_DOC}.`,
		'Table shape changed upstream – the extraction needs adjusting.'
	);
}

/* A rule hangs on a keyword no fighter carries: it would never reach a card. */
const keywords = JSON.parse(await readFile(join(source, 'keywords.json'), 'utf8'));
const known = new Set(Object.values(keywords).flat().map((k) => k.toLowerCase()));
const unknown = universal.rules
	.map((rule) => rule.keyword)
	.filter((keyword) => keyword.toLowerCase() !== KEYWORD_ANY && !known.has(keyword.toLowerCase()));

if (unknown.length) {
	fail(
		`Universal abilities in ${UNIVERSAL_DOC} name keywords no fighter carries:`,
		...unknown.map((keyword) => `  ${keyword}`),
		`Known from keywords.json: ${[...known].join(', ')}`
	);
}

await mkdir(TARGET, { recursive: true });

for (const file of REQUIRED) {
	await copyFile(join(source, file), join(TARGET, file));
	console.log(`  ${file}`);
}

for (const [file, placeholder] of Object.entries(OPTIONAL)) {
	const from = join(source, file);
	if (await exists(from)) {
		await copyFile(from, join(TARGET, file));
		console.log(`  ${file}`);
	} else if (placeholder) {
		await writeFile(join(TARGET, file), JSON.stringify(placeholder, null, 2) + '\n');
		console.log(`  ${file} (placeholder – not present in the site repo)`);
	} else {
		console.log(`  ${file} skipped – not present in the site repo`);
	}
}

await writeFile(
	join(TARGET, 'universal-abilities.json'),
	JSON.stringify(universal.rules, null, 2) + '\n'
);
console.log(`  universal-abilities.json (${universal.rules.length} from ${UNIVERSAL_DOC})`);

console.log(`\nGame data from ${source}`);
console.log(`Rules pages from ${docs}`);
