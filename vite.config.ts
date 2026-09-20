import { networkInterfaces } from 'node:os';

import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import QRCode from 'qrcode';
import { defineConfig, type Plugin } from 'vite';

/** First IPv4 address this machine can be reached at on the local network. */
function lanAddress(): string | null {
	for (const entries of Object.values(networkInterfaces())) {
		for (const entry of entries ?? []) {
			if (entry.family === 'IPv4' && !entry.internal) return entry.address;
		}
	}
	return null;
}

/**
 * Supplies the dev page with the network address and a QR code for it.
 *
 * The browser only knows `localhost`, and a phone cannot reach the server that
 * way. So the address has to be handed in from outside. The QR code is generated
 * here in Node so the client needs no library.
 */
function devNetworkInfo(): Plugin {
	const VIRTUAL = 'virtual:dev-network';
	const RESOLVED = '\0' + VIRTUAL;

	let serving = false;

	return {
		name: 'wyrdcry-dev-network',
		/* Runs during the build too: the /dev route is built along and has to be able
		   to resolve the module. There is nothing to report then. */
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
