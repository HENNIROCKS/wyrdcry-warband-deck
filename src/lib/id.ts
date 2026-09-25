/**
 * A local identifier.
 *
 * `crypto.randomUUID` exists only in a secure context. The phone reaches the dev
 * server over its network address, which is plain HTTP, and there the function
 * is not defined at all – recruiting a fighter threw before it could be added.
 * `crypto.getRandomValues` is there either way.
 *
 * These ids name a fighter within one warband on one device. They have to be
 * unique, not unguessable.
 */
export function newId(): string {
	if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

	const bytes = crypto.getRandomValues(new Uint8Array(16));
	/* Version and variant bits, so what comes out is a v4 UUID either way and
	   nothing downstream can tell which branch made it. */
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;

	const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
