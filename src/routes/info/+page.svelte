<script lang="ts">
	import { version as build } from '$app/environment';
	import { base } from '$app/paths';

	import BackArrow from '$lib/components/BackArrow.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import { RULESET_VERSION } from '$lib/gamedata';
	import { RELEASE_STAGE } from '$lib/release';

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
				'Not reliably, not yet. The export is still written in the shape the builder reads, and for the six official factions the way back is built to hold – but it has not been checked since this app grew a builder of its own. The builder now opens on 0.9, the rules a warband from here is built for. A warband of a homebrew faction cannot go back at all: Clan Pestilens and the Greenskin Marauders exist only here, so the builder accepts the file and then finds neither the faction nor any of its fighters. Export and snapshot are the way to keep a copy meanwhile.'
		},
		{
			question: 'Which rules does the app follow?',
			answer:
				'0.9, the current ruleset on wyrdcry.net; the deprecated 0.5 stays archived under /docs/0.5. Where the two differ, the cards here follow 0.9 – Armour, for one, is now taken off the damage of each attack rather than rolled against.'
		},
		{
			question: 'Which factions can I build?',
			answer:
				'The six out of the rulebook: Mercenaries, Clan Eshin, Sisters of Sigmar, Undead, Witch Hunters and the Possessed. Beside them, under a heading of their own, the homebrew Clan Pestilens and Greenskin Marauders, written for 0.9 as well. Each one is transcribed by hand against the game data, so a value here can differ from the builder – the characteristics deliberately do, because this app works modifiers into them that the builder leaves in the item text, and so does the standing, which follows the four tiers of the income page where the builder reads five.'
		}
	];
</script>

{#snippet github()}
	<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
		<path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12" />
	</svg>
{/snippet}

<main>
	<header>
		<h1>About</h1>
		<p class="version">
			Version {__APP_VERSION__} <span class="badge">{RELEASE_STAGE}</span>{#if buildDate}{' '}<span class="part">· Build {buildDate}</span>{/if}{#if ruleset}{' '}<span class="part">· Ruleset {ruleset}</span>{/if}
		</p>
		<div class="mode"><ThemeToggle /></div>
	</header>

	<section>
		<p>
			Your own Wyrdcry warband as a deck of cards: build it here or import it
			from the Warband Builder, swipe through the fighters, track a battle.
			Wyrdcry is an "unofficial fan-made hack of Warcry, dragged through the dirt
			and madness of Mordheim."
		</p>
		<p class="muted">
			This is a fan project made for the community; it is not commercial and has no
			affiliation with or endorsement from Games Workshop.
		</p>
		<p class="muted">
			You like this? Check out the
			<a href="https://hennirocks.github.io/warcry-card-creator-2026/">Warcry Card Creator 2026</a>
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
		<!-- Said on the page rather than only in the README: whoever builds a
		     warband here is about to rely on it, and the way back is the thing they
		     cannot find out by trying it once. Marked as a warning rather than left
		     to read as one more paragraph about the data. -->
		<p class="notice warn">
			<strong>The way back to the Warband Builder is not currently assured.</strong>
			Warbands built here carry factions and corrections the builder's own data
			does not have. Keep a copy through Export or Snapshot.
		</p>
		<p>
			<strong>Export</strong> writes the current state as JSON, in the shape the
			Warband Builder reads. <strong>Snapshot</strong> writes a dated copy that
			nothing overwrites later. Whatever has not been exported is gone once the
			app is uninstalled — so export even while the way back is unassured: the
			file this app wrote, this app reads.
		</p>
		<p>
			<strong>Photos</strong> of your models stay on this device as well and are
			not part of an Export. Whatever removes the warband removes them too. The
			photo you picked stays in your library; only one taken from inside the app
			exists nowhere else.
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
			<li><a class="btn" href="https://wyrdcry.net/docs/rules/introduction/">Wyrdcry Rules</a></li>
			<li><a class="btn primary" href="{REPO}/issues">{@render github()}Feedback and bug reports</a></li>
			<li><a class="btn primary" href={REPO}>{@render github()}Source code</a></li>
			<li><a class="btn primary" href="{REPO}/blob/main/ROADMAP.md">{@render github()}What is planned</a></li>
		</ul>
	</section>

	<footer>
		<a class="btn primary" href="{base}/"><BackArrow />Back to the deck</a>
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
		padding-bottom: calc(40px + env(safe-area-inset-bottom));
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

	/* Tailwind's preflight takes the underline off; a link in running text needs it. */
	.muted a {
		text-decoration: underline;
		text-underline-offset: 2px;
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

	/* One width for every way off the page, the way back included. */
	.links .btn,
	footer .btn {
		width: 100%;
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

	header {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	/* Which build is open is the first thing a bug report needs. */
	.version {
		margin: 0;
		font-size: var(--ui-t-md);
	}

	/* Set a little further off the version line than that is off the title. */
	.mode {
		margin-top: 8px;
	}

	/* A line too long for the phone breaks before a dot, never after it. */
	.version .part {
		white-space: nowrap;
	}

	/* Set apart from the links above, which it would otherwise read as the last
	   of – the way back is not a fifth destination. */
	footer {
		margin-top: 14px;
	}
</style>
