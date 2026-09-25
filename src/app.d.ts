/** Version aus package.json, zur Bauzeit eingesetzt (siehe vite.config.ts). */
declare const __APP_VERSION__: string;

declare namespace App {
	interface PageState {
		/** The open explanation overlay, see src/lib/explanation.ts. */
		explanation?: import('$lib/types/card').CardExplanation;
		/** The step the builder is on, so the back gesture walks the steps. */
		builderStep?: 'warband' | 'rules' | 'roster' | 'finish';
		/** The draft fighter whose sheet the builder has open, by its key. */
		builder?: string;
	}
}
