/**
 * The rules text carries Markdown: `**bold**` and `*italic*` for emphasis,
 * backticks around keywords. The Card Creator reads the same three on a card
 * (`src/lib/types.ts`, `FighterCard.svelte`), and the site puts the ability
 * descriptions through Markdown as well, so the marks are meant to be read.
 *
 * It is split into tokens instead of turned into HTML – part of the text comes
 * from the warband file and therefore from the user, which rules out `{@html}`.
 */

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

export function tokenize(text: string): MarkupToken[] {
	const tokens: MarkupToken[] = [];
	let last = 0;

	for (const match of text.matchAll(PATTERN)) {
		if (match.index > last) tokens.push({ kind: 'text', value: text.slice(last, match.index) });
		tokens.push(
			match[1] !== undefined
				? { kind: 'bold', value: match[1] }
				: match[2] !== undefined
					? { kind: 'italic', value: match[2] }
					: { kind: 'keyword', value: match[3] }
		);
		last = match.index + match[0].length;
	}

	if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
	return tokens;
}
