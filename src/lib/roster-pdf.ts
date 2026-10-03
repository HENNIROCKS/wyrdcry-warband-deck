/**
 * The roster as a PDF file. Built here rather than printed from a page: the app
 * installed on an iPhone has no print dialog, and Safari neither repeats a
 * table's header on the next page nor prints a footer of the page's own.
 *
 * pdfmake is loaded on the first export, not with the app. Sizes are in points.
 */

import { asset } from '$app/paths';
import type { Content, ContentText, CustomTableLayout, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

import { tokenize } from './markup';
import { toRoster, type Roster, type RosterFighter } from './roster-sheet';
import { safeName } from './transfer';
import type { StoredWarband } from './types/warband';

const TITLE = 'Wyrdcry Warband Roster';

/* A4 landscape, 10 mm margins, 14 mm at the foot for the footer. */
const MARGIN = 28.35;
const MARGIN_FOOT = 39.7;

const THIN = 0.75;
const THICK = 1.5;

/* Lining figures of one width, so a column of digits stands straight.
   Alegreya sets old-style figures otherwise. */
function figure(text: string): ContentText {
	return { text, alignment: 'center', fontFeatures: ['lnum', 'tnum'] };
}

/** A header cell. */
function th(cell: string | ContentText): ContentText {
	return { ...(typeof cell === 'string' ? { text: cell } : cell), style: 'th' };
}

/**
 * The ruled tables: a frame, a heavier rule under the header, a rule between
 * the rows and none between the columns. `tight` names columns that get by on
 * less padding, the figures; `bare` one that holds a table of its own.
 */
function ruled(tight: number[] = [], bare: number[] = []): CustomTableLayout {
	const side = (i: number) => (bare.includes(i) ? 0 : tight.includes(i) ? 3.5 : 6);
	return {
		hLineWidth: (i, node) => (i !== 0 && i === node.table.headerRows ? THICK : THIN),
		vLineWidth: (i, node) => (i === 0 || i === node.table.body[0].length ? THIN : 0),
		paddingLeft: side,
		paddingRight: side,
		paddingTop: () => 4.5,
		paddingBottom: () => 4.5
	};
}

/* The weapon profiles inside a fighter's row, and their header above. */
const WEAPON_WIDTHS = ['*', 28, 20, 26];

const profileLayout: CustomTableLayout = {
	hLineWidth: () => 0,
	vLineWidth: () => 0,
	paddingLeft: (i) => (i === 0 ? 6 : 2),
	paddingRight: (i) => (i === 0 ? 6 : 2),
	paddingTop: (i) => (i === 0 ? 0 : 2.5),
	paddingBottom: () => 0
};

/** Rules text: bold and italic as marked, keywords in capitals, line breaks kept. */
function rich(text: string): Content[] {
	return tokenize(text.trim()).map((token) => {
		if (token.kind === 'bold') return { text: token.value, bold: true };
		if (token.kind === 'italic') return { text: token.value, italics: true };
		if (token.kind === 'keyword') return { text: token.value.toUpperCase() };
		return { text: token.value };
	});
}

function nameCell(name: string, type: string): TableCell {
	return {
		stack: [
			{ text: name, bold: true },
			{ text: type, fontSize: 8.5 }
		]
	};
}

function warbandTable(roster: Roster): Content {
	return {
		table: {
			headerRows: 1,
			widths: ['*', 'auto', 'auto', 'auto', 'auto', 'auto', 'auto'],
			body: [
				[
					th('Warband / Faction'),
					...['Fighters', 'Value', 'Favour', 'Standing', 'Reputation', 'Won / Drawn / Lost'].map((text) => th(figure(text)))
				],
				[
					nameCell(roster.name, roster.faction),
					...[roster.fighterCount, roster.value, roster.favour, roster.standing, roster.reputation, roster.results.join(' / ')].map(
						figure
					)
				],
				[{ text: [{ text: 'Stash: ', bold: true }, roster.stash], colSpan: 7 }, '', '', '', '', '', '']
			]
		},
		layout: ruled(),
		margin: [0, 0, 0, 15]
	};
}

function profiles(fighter: RosterFighter): TableCell {
	const rows: TableCell[][] = fighter.weapons.map((weapon) => [
		weapon.name,
		figure(weapon.range),
		figure(weapon.attacks),
		figure(weapon.damage)
	]);
	if (fighter.items) rows.push([{ text: fighter.items, colSpan: 4 }, '', '', '']);
	if (!rows.length) return '–';
	return { table: { widths: WEAPON_WIDTHS, body: rows }, layout: profileLayout };
}

/* The figure columns, counted from 0: M F S D H B, XP, Ren, gc. */
const FIGURE_COLUMNS = [1, 2, 3, 4, 5, 6, 7, 8, 9];
const WEAPON_COLUMN = 12;

function fighterTable(roster: Roster): Content {
	const head: TableCell[] = [
		th({ text: 'Name / Type', noWrap: true }),
		...['M', 'F', 'S', 'D', 'H', 'B', 'XP', 'Ren', 'gc'].map((text) => th(figure(text))),
		th('Keywords'),
		th('Talents'),
		{
			table: {
				widths: WEAPON_WIDTHS,
				body: [[th('Weapons & Equipment'), ...['Rng', 'Att', 'Dmg'].map((text) => th(figure(text)))]]
			},
			layout: profileLayout
		},
		th('Notes')
	];

	const rows = roster.fighters.map((fighter): TableCell[] => [
		nameCell(fighter.name, fighter.type),
		...[...fighter.stats, String(fighter.xp), String(fighter.renown), String(fighter.cost)].map(figure),
		{ text: fighter.keywords.toUpperCase(), fontSize: 8 },
		fighter.talents.length ? { stack: fighter.talents } : '–',
		profiles(fighter),
		fighter.notes.length ? { stack: fighter.notes.map((note) => ({ text: rich(note) })) } : '–'
	]);

	return {
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: ['*', ...FIGURE_COLUMNS.map(() => 'auto'), 85, 100, 200, 70],
			body: [head, ...rows]
		},
		layout: ruled(FIGURE_COLUMNS, [WEAPON_COLUMN])
	};
}

function rulesTable(roster: Roster): Content {
	return {
		pageBreak: 'before',
		table: {
			headerRows: 1,
			dontBreakRows: true,
			widths: [120, 62, 150, '*'],
			body: [
				['Special Rule', 'Type', 'Fighter', 'Description'].map((text) => th(text)),
				...roster.rules.map((rule): TableCell[] => [
					rule.name,
					rule.type,
					rule.fighters,
					{ text: [...rich(rule.text), ...(rule.note ? [{ text: ` ${rule.note}`, italics: true }] : [])] }
				])
			]
		},
		layout: ruled()
	};
}

function fontUrl(file: string): string {
	return new URL(asset(`/fonts/${file}`), location.href).href;
}

export async function rosterPdf(entry: StoredWarband): Promise<File> {
	const { default: pdfMake } = await import('pdfmake/build/pdfmake');

	pdfMake.addFonts({
		Alegreya: {
			normal: fontUrl('Alegreya-Regular.ttf'),
			bold: fontUrl('Alegreya-Bold.ttf'),
			italics: fontUrl('Alegreya-Italic.ttf'),
			bolditalics: fontUrl('Alegreya-Bold.ttf')
		}
	});

	const roster = toRoster(entry);
	const title = `${roster.name} – ${TITLE}`;

	const doc: TDocumentDefinitions = {
		info: { title },
		pageSize: 'A4',
		pageOrientation: 'landscape',
		pageMargins: [MARGIN, MARGIN, MARGIN, MARGIN_FOOT],
		defaultStyle: { font: 'Alegreya', fontSize: 9.5 },
		styles: { th: { bold: true, fontSize: 10 } },
		footer: { text: TITLE, alignment: 'right', fontSize: 8, margin: [MARGIN, 14, MARGIN, 0] },
		content: [warbandTable(roster), fighterTable(roster), rulesTable(roster)]
	};

	const blob = await pdfMake.createPdf(doc).getBlob();
	return new File([blob], `${safeName(roster.name)} – ${TITLE}.pdf`, { type: 'application/pdf' });
}
