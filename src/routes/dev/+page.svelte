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
			<div class="notice warn">
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

	<div class="btn-stack">
		<a class="btn primary" href="{base}/"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6" /></svg>Back to the deck</a>
	</div>
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

	.notice {
		max-width: 44ch;
		margin-top: 4px;
		text-align: left;
	}

	.notice p {
		margin: 0 0 8px;
	}

	.notice p:last-child {
		margin-bottom: 0;
	}

	.notice ul {
		margin: 0 0 8px;
		padding-left: 18px;
		/* Tailwind's preflight strips list markers. */
		list-style: disc;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.92em;
	}

	.btn-stack {
		margin-top: 4px;
	}
</style>
