import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	kit: {
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: undefined,
			precompress: false,
			strict: true
		}),
		paths: {
			/* GitHub Pages serves the app from /<repo>/, so every link between routes
			   carries that prefix. The deploy workflow sets it; locally it is empty
			   and the dev server stays at the root. */
			base: process.env.BASE_PATH ?? ''
		},
		serviceWorker: {
			register: true
		}
	}
};

export default config;
