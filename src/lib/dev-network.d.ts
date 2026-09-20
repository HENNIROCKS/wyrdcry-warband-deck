declare module 'virtual:dev-network' {
	/** Adresse dieses Dev-Servers im lokalen Netz, oder null ohne Netzwerkanschluss. */
	export const url: string | null;
	/** Derselbe Wert als QR-Code-SVG. */
	export const qr: string | null;
}
