/**
 * Copies the game data from the site repo into src/lib/data/.
 *
 * The target is gitignored: the data belongs to the Wyrdcry project and its
 * licence is unresolved (there is no LICENSE over there). This repo therefore
 * does not ship it, it fetches it locally.
 *
 * Usage:  npm run sync:data [-- --from <path>]
 */
import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
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
	'weapon-rules.json',
	'campaign-rules.json'
];

/** Currently only on the branch feat/game-reference-print (PR #9). */
const OPTIONAL = ['ruleset.json'];

/** Goes into every export and is compared on import. */
const UNKNOWN_RULESET = {
	version: 'unknown',
	label: 'Ruleset unknown',
	slug: 'unknown'
};

function sourceDir() {
	const i = process.argv.indexOf('--from');
	return i !== -1 && process.argv[i + 1] ? resolve(process.argv[i + 1]) : DEFAULT_SOURCE;
}

async function exists(path) {
	try {
		await access(path);
		return true;
	} catch {
		return false;
	}
}

const source = sourceDir();

if (!(await exists(source))) {
	console.error(`Source not found: ${source}`);
	console.error('Site repo elsewhere? npm run sync:data -- --from <path to src/data>');
	process.exit(1);
}

await mkdir(TARGET, { recursive: true });

const missing = [];
for (const file of REQUIRED) {
	const from = join(source, file);
	if (!(await exists(from))) {
		missing.push(file);
		continue;
	}
	await copyFile(from, join(TARGET, file));
	console.log(`  ${file}`);
}

if (missing.length) {
	console.error(`\nMissing required files in ${source}:`);
	for (const file of missing) console.error(`  ${file}`);
	process.exit(1);
}

for (const file of OPTIONAL) {
	const from = join(source, file);
	if (await exists(from)) {
		await copyFile(from, join(TARGET, file));
		console.log(`  ${file}`);
	} else {
		await writeFile(join(TARGET, file), JSON.stringify(UNKNOWN_RULESET, null, 2) + '\n');
		console.log(`  ${file} (placeholder – not present in the site repo)`);
	}
}

console.log(`\nGame data from ${source}`);
