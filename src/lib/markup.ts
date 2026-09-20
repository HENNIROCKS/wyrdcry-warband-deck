/**
 * The rules text carries Markdown: `**bold**` for emphasis, backticks around
 * keywords. It is split into tokens instead of turned into HTML – part of the
 * text comes from the warband file and therefore from the user, which rules out
 * `{@html}`.
 */

export interface MarkupToken {
	kind: 'text' | 'bold' | 'keyword';
	value: string;
}

/* Bold stops at the line end: a stray ** would otherwise run to the next one
   and set everything between the two in bold. */
const PATTERN = /\*\*([^\n]+?)\*\*|`([^`]+)`/g;

export function tokenize(text: string): MarkupToken[] {
	const tokens: MarkupToken[] = [];
	let last = 0;

	for (const match of text.matchAll(PATTERN)) {
		if (match.index > last) tokens.push({ kind: 'text', value: text.slice(last, match.index) });
		tokens.push(
			match[1] !== undefined
				? { kind: 'bold', value: match[1] }
				: { kind: 'keyword', value: match[2] }
		);
		last = match.index + match[0].length;
	}

	if (last < text.length) tokens.push({ kind: 'text', value: text.slice(last) });
	return tokens;
}
