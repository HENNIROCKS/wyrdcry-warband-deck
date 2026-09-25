<script lang="ts">
	import { version as build } from '$app/environment';
	import { base } from '$app/paths';

	import { RULESET_VERSION } from '$lib/gamedata';

	const REPO = 'https://github.com/HENNIROCKS/wyrdcry-warband-deck';

	/*
	 * `version` from SvelteKit is the timestamp of the build. On an installed app
	 * that is the more useful of the two numbers: it answers whether the phone is
	 * running today's state, which a version that stands still for months cannot.
	 */
	const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

	/* Spelled out rather than left to toLocaleDateString: its month abbreviations
	   differ between engines, and the rest of the page is written English anyway. */
	const built = Number(build);
	const buildDate = Number.isNaN(built)
		? null
		: (() => {
				const date = new Date(built);
				return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
			})();

	/* The placeholder the sync writes when the site repo carries no ruleset file.
	   A line saying the ruleset is unknown unsettles more than it explains. */
	const ruleset = RULESET_VERSION === 'unknown' ? null : RULESET_VERSION;

	/* Answered here rather than in the README: whoever has the app open on a phone
	   at the table is not the one browsing the repository. */
	const faq = [
		{
			question: 'Where is my warband stored?',
			answer:
				'In this browser, on this device. There is no account and no server, so nothing is uploaded and nothing syncs to another phone. Export the warband to carry it anywhere else.'
		},
		{
			question: 'Why do I have to add the app to the home screen?',
			answer:
				'Safari clears the data of sites that are not installed after seven days without use. Installed, the warband stays. This is the one step the app cannot take for you.'
		},
		{
			question: 'Can I keep working in the Warband Builder?',
			answer:
				'Yes. The export writes the same JSON the builder reads, with everything the builder stores left untouched. Import it there, change the warband, export it again and bring it back.'
		}
	];
</script>

<main>
	<h1>About</h1>

	<section>
		<p>
			Your own Wyrdcry warband as a deck of cards: import the warband from the
			Warband Builder, swipe through the fighters, track a battle.
		</p>
		<p class="muted">
			An independent fan project. No connection to Games Workshop.
		</p>
		<p class="version">
			Version {__APP_VERSION__} · Early{#if buildDate}{' '}· Build {buildDate}{/if}{#if ruleset}{' '}· Ruleset {ruleset}{/if}
		</p>
	</section>

	<section>
		<h2>Add it to the home screen</h2>
		<p>
			Not a convenience: Safari clears the data of sites that are not installed
			after seven days without use. Installed, the app also runs without a
			network and keeps the browser bars out of the way.
		</p>
		<ul>
			<li><strong>iPhone, iPad:</strong> Share, then “Add to Home Screen”.</li>
			<li><strong>Android:</strong> browser menu, then “Install app”.</li>
		</ul>
	</section>

	<section>
		<h2>Your data</h2>
		<p>
			The warband lives in this browser's database, on this device alone. No
			account, no server, no sync.
		</p>
		<p>
			<strong>Export</strong> writes the current state back as JSON, ready to
			import into the Warband Builder again. <strong>Snapshot</strong> writes a
			dated copy that nothing overwrites later. Whatever has not been exported is
			gone once the app is uninstalled.
		</p>
	</section>

	<section>
		<h2>Questions</h2>
		<div class="faq">
			{#each faq as entry (entry.question)}
				<details>
					<summary>{entry.question}</summary>
					<p class="answer">{entry.answer}</p>
				</details>
			{/each}
		</div>
	</section>

	<section>
		<h2>Links</h2>
		<ul class="links">
			<li><a href="https://wyrdcry.net">Wyrdcry – rules and Warband Builder</a></li>
			<li><a href="{REPO}/issues">Feedback and bug reports</a></li>
			<li><a href={REPO}>Source code</a></li>
			<li><a href="{REPO}#roadmap">What is planned</a></li>
		</ul>
	</section>

	<footer>
		<p class="back"><a href="{base}/">Back to the deck</a></p>
	</footer>
</main>

<style>
	main {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 22px;
		width: 100%;
		max-width: 38rem;
		margin: 0 auto;
		padding: 40px 20px;
	}

	h1 {
		margin: 0;
		font-size: var(--ui-t-3xl);
		font-weight: 600;
	}

	h2 {
		margin: 0 0 8px;
		font-size: var(--ui-t-lg);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ui-text-subtle);
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	/* The heading belongs to the section, not to the gap above the text. */
	section h2 {
		margin-bottom: -2px;
	}

	p {
		margin: 0;
		font-size: var(--ui-t-md);
		line-height: 1.55;
	}

	.muted {
		color: var(--ui-text-muted);
	}

	ul {
		margin: 0;
		padding-left: 18px;
		/* Tailwind's preflight strips list markers. */
		list-style: disc;
		font-size: var(--ui-t-md);
		line-height: 1.55;
	}

	li + li {
		margin-top: 6px;
	}

	.links {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding-left: 0;
		list-style: none;
	}

	/* The buttons keep their distance through the gap. */
	.links li + li {
		margin-top: 0;
	}

	/* The surface and border of the header's icon buttons, so a link that acts
	   like a button looks like the ones already on screen. */
	.links a,
	.back a {
		display: block;
		padding: 11px 13px;
		border: 1px solid var(--ui-border);
		border-radius: 9px;
		background: var(--ui-surface);
		text-decoration: none;
	}

	.links a {
		color: var(--ui-accent-text);
		text-align: center;
	}

	.links a:hover,
	.back a:hover,
	.links a:focus-visible,
	.back a:focus-visible {
		background: var(--ui-surface-2);
	}

	/* Rules, not boxes: the links below are the buttons on this page, and two
	   stacks of the same shape read as one list of the same kind of thing. */
	.faq {
		display: flex;
		flex-direction: column;
		border-top: 1px solid var(--ui-border);
	}

	details {
		border-bottom: 1px solid var(--ui-border);
	}

	summary {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 11px 1px;
		font-size: var(--ui-t-md);
		font-weight: 600;
		cursor: pointer;
		/* The chevron below stands in for the marker. */
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	/* Closed points down, open points up. Nothing animates, so there is nothing
	   a reduced-motion setting would have to switch off. */
	summary::after {
		content: '';
		flex: none;
		width: 7px;
		height: 7px;
		margin-bottom: 3px;
		border-right: 1.5px solid var(--ui-text-subtle);
		border-bottom: 1.5px solid var(--ui-text-subtle);
		transform: rotate(45deg);
	}

	details[open] summary::after {
		margin: 3px 0 0;
		transform: rotate(-135deg);
	}

	summary:focus-visible {
		outline: 2px solid var(--ui-accent-text);
		outline-offset: 1px;
	}

	.answer {
		padding: 0 1px 12px;
		color: var(--ui-text-muted);
	}

	/* Smaller than the notice above it, not fainter: at this size the subtle
	   grey falls to 3.5:1 on the page, where the muted one holds 6.6:1. */
	.version {
		font-size: var(--ui-t-sm);
		color: var(--ui-text-muted);
	}

	/* Set apart from the links above, which it would otherwise read as the last
	   of – the way back is not a fifth destination. */
	footer {
		margin-top: 14px;
	}

	.back {
		font-size: var(--ui-t-base);
	}

	/* The way back, not a destination of its own – same shape as the links
	   above, without their colour. */
	.back a {
		color: var(--ui-text-muted);
		text-align: center;
	}
</style>
