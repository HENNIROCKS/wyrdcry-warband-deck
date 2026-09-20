import { networkInterfaces } from 'node:os';

import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import QRCode from 'qrcode';
import { defineConfig, type Plugin } from 'vite';

/** Erste IPv4-Adresse, unter der dieser Rechner im lokalen Netz erreichbar ist. */
function lanAddress(): string | null {
	for (const entries of Object.values(networkInterfaces())) {
		for (const entry of entries ?? []) {
			if (entry.family === 'IPv4' && !entry.internal) return entry.address;
		}
	}
	return null;
}

/**
 * Stellt der Dev-Seite die Netzwerkadresse und einen QR-Code dazu bereit.
 *
 * Der Browser kennt nur `localhost`, und das Handy kommt darüber nicht an den
 * Server. Die Adresse muss also von außen hereingereicht werden. Der QR-Code
 * wird hier in Node erzeugt, damit der Client keine Bibliothek braucht.
 */
function devNetworkInfo(): Plugin {
	const VIRTUAL = 'virtual:dev-network';
	const RESOLVED = '\0' + VIRTUAL;

	let serving = false;

	return {
		name: 'wyrdcry-dev-network',
		/* Läuft auch im Build: die /dev-Route wird mitgebaut und muss das Modul
		   auflösen können. Dort gibt es dann nichts zu melden. */
		configResolved: (config) => void (serving = config.command === 'serve'),
		resolveId: (id) => (id === VIRTUAL ? RESOLVED : null),
		async load(id) {
			if (id !== RESOLVED) return null;
			if (!serving) return 'export const url = null;\nexport const qr = null;\n';

			const host = lanAddress();
			const port = this.environment?.config?.server?.port ?? 5173;
			const url = host ? `http://${host}:${port}/` : null;
			const qr = url
				? await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' })
				: null;

			return `export const url = ${JSON.stringify(url)};\nexport const qr = ${JSON.stringify(qr)};\n`;
		}
	};
}

export default defineConfig({
	plugins: [devNetworkInfo(), tailwindcss(), sveltekit()]
});
