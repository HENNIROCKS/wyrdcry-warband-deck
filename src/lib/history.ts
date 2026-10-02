import type { BattleRecord } from './types/warband';

export const RESULT_LABELS: Record<BattleRecord['result'], string> = {
	win: 'Win',
	draw: 'Draw',
	loss: 'Loss'
};

/**
 * Newest first. Two battles on the same day keep the order they were entered
 * in, the later one on top – the date alone cannot tell them apart.
 */
export function newestFirst(records: BattleRecord[]): BattleRecord[] {
	return records
		.map((record, index) => ({ record, index }))
		.sort((a, b) => b.record.date.localeCompare(a.record.date) || b.index - a.index)
		.map(({ record }) => record);
}

/* Today as the phone's own calendar has it – `toISOString` is UTC and would
   date a late game to the next morning. */
export function today(): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** `2026-09-19` as `260919`, the way a player writes it in the margin. */
export function shortDate(date: string): string {
	return date.slice(2).replaceAll('-', '');
}

/** The opposing warband, the player behind it in brackets – either may be missing. */
export function opponent(record: BattleRecord): string {
	const warband = record.opponentWarband.trim();
	const player = record.opponentPlayer.trim();
	if (!player) return warband;
	return warband ? `${warband} (${player})` : `(${player})`;
}

/** `2 won · 1 drawn · 0 lost`. */
export function tally(records: BattleRecord[]): string {
	const count = (result: BattleRecord['result']) => records.filter((r) => r.result === result).length;
	return `${count('win')} won · ${count('draw')} drawn · ${count('loss')} lost`;
}
