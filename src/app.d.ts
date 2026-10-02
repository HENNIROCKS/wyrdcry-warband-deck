/** Version aus package.json, zur Bauzeit eingesetzt (siehe vite.config.ts). */
declare const __APP_VERSION__: string;

declare namespace App {
	interface PageState {
		/** The open explanation overlay, see src/lib/explanation.ts. */
		explanation?: import('$lib/types/card').CardExplanation;
		/** Which opening of the overlay the entry belongs to, see src/lib/explanation.ts. */
		explanationId?: number;
		/** The step the builder is on, so the back gesture walks the steps. */
		builderStep?: 'warband' | 'name' | 'roster' | 'finish';
		/** The draft fighter whose sheet the builder has open, by its key. */
		builder?: string;
		/** How many entries deep into the builder this one is, see src/routes/build/+page.svelte. */
		builderDepth?: number;
	}
}
