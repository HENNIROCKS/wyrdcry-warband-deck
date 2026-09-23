/** Version aus package.json, zur Bauzeit eingesetzt (siehe vite.config.ts). */
declare const __APP_VERSION__: string;

declare namespace App {
	interface PageState {
		/** The open explanation overlay, see src/lib/explanation.ts. */
		explanation?: import('$lib/types/card').CardExplanation;
	}
}
