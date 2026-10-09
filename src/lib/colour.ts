/**
 * A warband's own colour, standing in for the card green on every card of its
 * deck. Null means the green.
 *
 * The palette holds colours at least as readable as the green: white type on
 * them clears its 5.7:1, and against the card texture they clear its 4.5:1.
 * None is red – `--card-link` is the one red on the card and says "tap me",
 * and a red deck would blur that. A colour picked freely is taken as it is;
 * `readable` says when white type on it falls below 4.5:1, so the back can warn.
 */

export const DEFAULT_COLOUR = '#16754a';

export const PALETTE: { name: string; value: string }[] = [
	{ name: 'Green', value: DEFAULT_COLOUR },
	{ name: 'Teal', value: '#11666b' },
	{ name: 'Blue', value: '#1f4e8c' },
	{ name: 'Violet', value: '#5b2a86' },
	{ name: 'Ochre', value: '#8a5a12' },
	{ name: 'Slate', value: '#3f4a55' },
	{ name: 'Black', value: '#1f1f1f' }
];

/** A colour as the picker writes it, `#rrggbb`; anything else reads as none. */
export function readColour(value: unknown): string | null {
	return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : null;
}

function luminance(hex: string): number {
	const [r, g, b] = [1, 3, 5].map((at) => {
		const c = parseInt(hex.slice(at, at + 2), 16) / 255;
		return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
	});
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Whether white type on this colour holds 4.5:1, as the headings and table heads need. */
export function readable(hex: string): boolean {
	return 1.05 / (luminance(hex) + 0.05) >= 4.5;
}
