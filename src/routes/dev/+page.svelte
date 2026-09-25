<script lang="ts">
	import { dev } from '$app/environment';
	import { base } from '$app/paths';
	import { qr, url } from 'virtual:dev-network';

	/* This route only exists in the dev server. In a build it is empty. */
	const insecure = $derived(url !== null && !url.startsWith('https://'));
</script>

<main>
	<h1>Open on your phone</h1>

	{#if !dev}
		<p class="hint">This page only exists in development mode.</p>
	{:else if !url}
		<p class="hint">
			No network address found. Is this machine on Wi-Fi? Is the server running with
			<code>npm run dev:lan</code>?
		</p>
	{:else}
		<div class="qr">
			<!-- The SVG comes from the Vite config, not from user input. -->
			{@html qr}
		</div>

		<p class="url"><a href={url}>{url}</a></p>

		<p class="hint">
			Point the camera at the code. Phone and machine have to be on the same network.
		</p>

		{#if insecure}
			<div class="warn">
				<p>
					<strong>Over <code>http://</code> this is not a PWA.</strong>
					Layout, swiping and tap targets can be checked this way. What cannot:
				</p>
				<ul>
					<li>installing to the home screen</li>
					<li>persistent storage via <code>navigator.storage.persist()</code></li>
					<li>export through the share sheet – it falls back to a download</li>
				</ul>
				<p>All three require a secure context, which only HTTPS and localhost provide.</p>
			</div>
		{/if}
	{/if}

	<p class="back"><a href="{base}/">Back to the deck</a></p>
</main>

<style>
	main {
		flex: 1;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 28px 20px 32px;
		text-align: center;
	}

	h1 {
		margin: 0;
		font-size: var(--ui-t-2xl);
		font-weight: 600;
	}

	.qr {
		width: 240px;
		max-width: 100%;
		padding: 12px;
		border-radius: 12px;
		background: #fff;
		line-height: 0;
	}

	.qr :global(svg) {
		width: 100%;
		height: auto;
	}

	.url a {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: var(--ui-t-md);
		color: var(--ui-accent-text);
	}

	.url {
		margin: 0;
	}

	.hint {
		margin: 0;
		max-width: 40ch;
		font-size: var(--ui-t-base);
		line-height: 1.5;
		color: var(--ui-text-muted);
	}

	.warn {
		max-width: 44ch;
		margin-top: 4px;
		padding: 12px 14px;
		border-radius: 10px;
		text-align: left;
		background: var(--ui-warn-bg);
		border: 1px solid rgba(180, 83, 9, 0.4);
		font-size: var(--ui-t-base);
		line-height: 1.5;
	}

	.warn p {
		margin: 0 0 8px;
	}

	.warn p:last-child {
		margin-bottom: 0;
	}

	.warn ul {
		margin: 0 0 8px;
		padding-left: 18px;
		/* Tailwind's preflight strips list markers. */
		list-style: disc;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.92em;
	}

	.back {
		margin: 4px 0 0;
		font-size: var(--ui-t-base);
	}

	.back a {
		color: var(--ui-text-muted);
	}
</style>
