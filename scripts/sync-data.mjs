/**
 * Kopiert die Spieldaten aus dem Site-Repo nach src/lib/data/.
 *
 * Das Ziel ist gitignored: die Daten gehören dem Wyrdcry-Projekt, ihre
 * Lizenz ist ungeklärt (dort fehlt ein LICENSE). Dieses Repo verteilt sie
 * deshalb nicht mit, sondern holt sie lokal.
 *
 * Aufruf:  npm run sync:data [-- --from <pfad>]
 */
import { mkdir, copyFile, writeFile, access } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const TARGET = resolve(HERE, '../src/lib/data');

const DEFAULT_SOURCE = resolve(HERE, '../../wyrdcry/src/data');

/** Ohne diese Dateien startet die App nicht. */
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

/** Liegt derzeit nur auf dem Branch feat/game-reference-print (PR #9). */
const OPTIONAL = ['ruleset.json'];

/** Steht in jedem Export und wird beim Import verglichen. */
const UNKNOWN_RULESET = {
	version: 'unbekannt',
	label: 'Regelstand unbekannt',
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
	console.error(`Quelle nicht gefunden: ${source}`);
	console.error('Site-Repo woanders? npm run sync:data -- --from <pfad zu src/data>');
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
	console.error(`\nFehlende Pflichtdateien in ${source}:`);
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
		console.log(`  ${file} (Platzhalter – im Site-Repo nicht vorhanden)`);
	}
}

console.log(`\nStammdaten aus ${source}`);
