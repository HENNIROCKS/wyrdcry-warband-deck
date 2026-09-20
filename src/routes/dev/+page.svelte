<script lang="ts">
	import { dev } from '$app/environment';
	import { qr, url } from 'virtual:dev-network';

	/* Die Route existiert nur im Dev-Server. Im gebauten Stand ist sie leer. */
	const insecure = $derived(url !== null && !url.startsWith('https://'));
</script>

<main>
	<h1>Auf dem Handy öffnen</h1>

	{#if !dev}
		<p class="hint">Diese Seite gibt es nur im Entwicklungsmodus.</p>
	{:else if !url}
		<p class="hint">
			Keine Netzwerkadresse gefunden. Hängt der Rechner im WLAN? Läuft der Server mit
			<code>npm run dev:lan</code>?
		</p>
	{:else}
		<div class="qr">
			<!-- SVG kommt aus der Vite-Config, nicht aus Nutzereingaben. -->
			{@html qr}
		</div>

		<p class="url"><a href={url}>{url}</a></p>

		<p class="hint">
			Kamera auf den Code halten. Handy und Rechner müssen im selben Netz sein.
		</p>

		{#if insecure}
			<div class="warn">
				<p>
					<strong>Über <code>http://</code> ist das keine PWA.</strong>
					Layout, Wischen und Tippflächen kannst du so prüfen. Nicht prüfbar sind:
				</p>
				<ul>
					<li>Installation auf dem Home-Bildschirm</li>
					<li>dauerhafter Speicher über <code>navigator.storage.persist()</code></li>
					<li>Export über das Share-Sheet – er fällt auf den Download zurück</li>
				</ul>
				<p>Alle drei verlangen einen sicheren Kontext, den nur HTTPS und localhost bieten.</p>
			</div>
		{/if}
	{/if}

	<p class="back"><a href="/">Zurück zum Deck</a></p>
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
		font-size: 19px;
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
		font-size: 14px;
		color: var(--ui-accent-text);
	}

	.url {
		margin: 0;
	}

	.hint {
		margin: 0;
		max-width: 40ch;
		font-size: 13px;
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
		font-size: 13px;
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
		/* Tailwinds Preflight nimmt Listen ihre Marker. */
		list-style: disc;
	}

	code {
		font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
		font-size: 0.92em;
	}

	.back {
		margin: 4px 0 0;
		font-size: 13px;
	}

	.back a {
		color: var(--ui-text-muted);
	}
</style>
