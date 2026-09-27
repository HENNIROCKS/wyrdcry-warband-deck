/**
 * A faction rule's display text, its table folded in.
 *
 * A rule that carries a `table` – the Possessed's Mutation Table – holds its
 * eleven rows there and nowhere else. `text` keeps only the sentence above the
 * table, and this builds the sentence a player reads back to the same bullet
 * form the rule used to spell out by hand, so the wizard's roll picker and the
 * card's Faction Rules section read one set of rows, not two.
 */

import type { FactionRule } from './types';

export function ruleText(rule: Pick<FactionRule, 'text' | 'table'>): string {
	if (!rule.table?.length) return rule.text;

	const rows = rule.table.map((row) => `- **${row.roll} ${row.name}:** ${row.text}`).join('\n');
	return `${rule.text}\n\n${rows}`;
}
