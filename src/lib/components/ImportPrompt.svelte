<script lang="ts">
	import type { ImportCandidate } from '../transfer';

	let {
		candidate,
		onconfirm,
		oncancel
	}: { candidate: ImportCandidate; onconfirm: () => void; oncancel: () => void } = $props();

	/* Nur der Normalfall darf sich wie ein Normalfall anfühlen. Alles andere
	   braucht eine Entscheidung statt eines stillen Überschreibens. */
	const harmless = $derived(
		candidate.verdict.kind === 'new' ||
			candidate.verdict.kind === 'newer' ||
			candidate.verdict.kind === 'same'
	);
</script>

<div class="backdrop">
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="import-title">
		<h2 id="import-title">{candidate.warband.name}</h2>
		<p class="count">
			{candidate.warband.fighters.length} Kämpfer
			{#if candidate.meta}· Revision {candidate.meta.revision}{/if}
		</p>

		{#if candidate.verdict.kind === 'new'}
			<p class="note ok">Neue Bande. Wird hinzugefügt.</p>
		{:else if candidate.verdict.kind === 'newer'}
			<p class="note ok">
				Neuer als der gespeicherte Stand (Revision {candidate.verdict.storedRevision} →
				{candidate.verdict.incomingRevision}).
			</p>
		{:else if candidate.verdict.kind === 'same'}
			<p class="note">Gleicher Stand wie hier gespeichert. Ein Import ändert nichts.</p>
		{:else if candidate.verdict.kind === 'older'}
			<p class="note danger">
				<strong>Diese Datei ist älter.</strong> Hier liegt Revision {candidate.verdict.storedRevision},
				die Datei hat {candidate.verdict.incomingRevision}. Importieren überschreibt den neueren Stand.
			</p>
		{:else if candidate.verdict.kind === 'diverged'}
			<p class="note danger">
				<strong>Die Stände sind auseinandergelaufen.</strong> Beide tragen Revision
				{candidate.verdict.incomingRevision}, kommen aber von verschiedenen Geräten
				(hier und {candidate.verdict.otherDevice}). Was hier liegt, geht beim Importieren verloren.
			</p>
		{/if}

		{#if candidate.rulesetMismatch}
			<p class="note warn">
				Die Datei stammt vom Regelstand {candidate.rulesetMismatch}, die App kennt einen anderen.
				Einzelne Werte können abweichen.
			</p>
		{/if}

		<div class="actions">
			<button class="ghost" onclick={oncancel}>Abbrechen</button>
			<button class:danger={!harmless} onclick={onconfirm}>
				{harmless ? 'Importieren' : 'Trotzdem überschreiben'}
			</button>
		</div>
	</div>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 20;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		background: rgba(0, 0, 0, 0.6);
		padding: 12px;
		padding-bottom: calc(12px + env(safe-area-inset-bottom));
	}

	.sheet {
		width: 100%;
		max-width: 420px;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 14px;
		padding: 16px;
	}

	h2 {
		margin: 0;
		font-size: 18px;
		overflow-wrap: anywhere;
	}

	.count {
		margin: 3px 0 12px;
		font-size: 13px;
		color: var(--ui-text-muted);
	}

	.note {
		margin: 0 0 10px;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: 14px;
		line-height: 1.45;
		background: var(--ui-surface-2);
	}

	.note.ok {
		background: var(--ui-accent-bg);
		color: var(--ui-accent-text);
	}

	.note.warn {
		background: var(--ui-warn-bg);
		color: #fbbf24;
	}

	.note.danger {
		background: rgba(185, 28, 28, 0.18);
		color: #fca5a5;
	}

	.actions {
		display: flex;
		gap: 8px;
		margin-top: 14px;
	}

	.actions button {
		flex: 1;
		padding: 12px;
		border: 0;
		border-radius: 10px;
		font-size: 15px;
		font-weight: 600;
		background: var(--ui-accent);
		color: #fff;
	}

	.actions .ghost {
		background: var(--ui-surface-2);
		color: var(--ui-text);
	}

	.actions .danger {
		background: var(--ui-danger);
	}
</style>
