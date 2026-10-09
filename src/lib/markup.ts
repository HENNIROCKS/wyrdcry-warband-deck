/**
 * The rules text carries Markdown: `**bold**` and `*italic*` for emphasis,
 * backticks around keywords. The Card Creator reads the same three on a card
 * (`src/lib/types.ts`, `FighterCard.svelte`), and the site puts the ability
 * descriptions through Markdown as well, so the marks are meant to be read.
 *
 * It is split into tokens instead of turned into HTML – part of the text comes
 * from the warband file and therefore from the user, which rules out `{@html}`.
 *
 * A keyword left unmarked is recognised all the same, because a warband
 * exported from the Warband Builder carries its faction rules as free text and
 * nobody typed backticks into them. Measured over the game data, where every
 * keyword is marked already, that recogniser changes nothing – it only reaches
 * text somebody typed.
 */

import { KEYWORDS } from './rules';

export interface MarkupToken {
	kind: 'text' | 'bold' | 'italic' | 'keyword';
	value: string;
}

/*
 * Bold before italic, or `**bold**` would be read as an empty emphasis and the
 * word behind it. The single star refuses a second one beside it for the same
 * reason.
 *
 * Italic also refuses a space behind the opening star or before the closing
 * one, as Markdown does. Without it "2 * 3 * 4" is a run of emphasis.
 *
 * Both stop at the line end: a stray star would otherwise run to the next one
 * and set everything between the two in emphasis.
 */
const PATTERN = /\*\*([^\n]+?)\*\*|\*(?!\*)(?!\s)([^*\n]*[^*\s\n])\*|`([^`]+)`/g;

/*
 * The deck's own glossary is the vocabulary, homebrew included – it is kept by
 * hand, spelled in capitals, and already holds the faction names as keywords
 * (`CLAN ESHIN`). Longest first, or `HERO` would take the front of a longer
 * entry before the alternation reaches it.
 *
 * Capitals are the whole test. Four faction names are ordinary English words –
 * Possessed, Undead, Mercenaries, Hired Sword – as are Human, Beast, Leader and
 * Hero, and a sentence that happens to use one of them means the word, not the
 * keyword. `\b` keeps `HERO` out of `HEROIC`, in both directions.
 */
const VOCABULARY = [...KEYWORDS.values()]
	.map((keyword) => keyword.name.trim())
	.filter((name) => /^[A-Z][A-Z' ]*$/.test(name))
	.sort((a, b) => b.length - a.length);

const SPOKEN = VOCABULARY.length
	? new RegExp(`\\b(${VOCABULARY.map((name) => name.replace(/'/g, "\\'")).join('|')})\\b`, 'g')
	: null;

/** Text between the marks, with the keywords nobody marked picked out of it. */
function pushText(tokens: MarkupToken[], value: string): void {
	if (!SPOKEN) {
		tokens.push({ kind: 'text', value });
		return;
	}

	let last = 0;
	for (const match of value.matchAll(SPOKEN)) {
		if (match.index > last) tokens.push({ kind: 'text', value: value.slice(last, match.index) });
		tokens.push({ kind: 'keyword', value: match[1] });
		last = match.index + match[0].length;
	}
	if (last < value.length) tokens.push({ kind: 'text', value: value.slice(last) });
}

export function tokenize(text: string): MarkupToken[] {
	const tokens: MarkupToken[] = [];
	let last = 0;

	for (const match of text.matchAll(PATTERN)) {
		if (match.index > last) pushText(tokens, text.slice(last, match.index));
		tokens.push(
			match[1] !== undefined
				? { kind: 'bold', value: match[1] }
				: match[2] !== undefined
					? { kind: 'italic', value: match[2] }
					: { kind: 'keyword', value: match[3] }
		);
		last = match.index + match[0].length;
	}

	if (last < text.length) pushText(tokens, text.slice(last));
	return tokens;
}

export type MarkupBlock = { kind: 'text'; value: string } | { kind: 'list'; items: string[] };

/**
 * Splits a rules text into running text and lists. Consecutive lines that open
 * with "- " are one list, as Markdown reads them; the blank lines around it are
 * dropped, because the list brings its own spacing.
 */
export function blocks(text: string): MarkupBlock[] {
	const result: MarkupBlock[] = [];
	let run: string[] = [];

	const flush = () => {
		const value = run.join('\n').replace(/^\s*\n|\n\s*$/g, '').trimEnd();
		if (value.trim()) result.push({ kind: 'text', value });
		run = [];
	};

	for (const line of text.split('\n')) {
		const item = line.match(/^\s*-\s+(.*)$/);
		if (!item) {
			run.push(line);
			continue;
		}
		flush();
		const last = result.at(-1);
		if (last?.kind === 'list') last.items.push(item[1]);
		else result.push({ kind: 'list', items: [item[1]] });
	}
	flush();
	return result;
}
