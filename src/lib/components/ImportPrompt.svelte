<script lang="ts">
	import type { ImportCandidate } from '../transfer';

	let {
		candidate,
		onconfirm,
		oncancel
	}: { candidate: ImportCandidate; onconfirm: () => void; oncancel: () => void } = $props();

	/* Only the ordinary case may feel like an ordinary case. Everything else
	   needs a decision instead of a silent overwrite. */
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
			{candidate.warband.fighters.length} fighters
			{#if candidate.meta}· Revision {candidate.meta.revision}{/if}
		</p>

		{#if candidate.verdict.kind === 'new'}
			<p class="note ok">New warband. Will be added.</p>
		{:else if candidate.verdict.kind === 'newer'}
			<p class="note ok">
				Newer than the stored state (revision {candidate.verdict.storedRevision} →
				{candidate.verdict.incomingRevision}).
			</p>
		{:else if candidate.verdict.kind === 'same'}
			<p class="note">Same state as stored here. Importing changes nothing.</p>
		{:else if candidate.verdict.kind === 'older'}
			<p class="note danger">
				<strong>This file is older.</strong> Stored here is revision {candidate.verdict.storedRevision},
				the file has {candidate.verdict.incomingRevision}. Importing overwrites the newer state.
			</p>
		{:else if candidate.verdict.kind === 'diverged'}
			<p class="note danger">
				<strong>These states have diverged.</strong> Both carry revision
				{candidate.verdict.incomingRevision} but come from different devices
				(this one and {candidate.verdict.otherDevice}). What is stored here is lost on import.
			</p>
		{/if}

		{#if candidate.rulesetMismatch}
			<p class="note warn">
				This file comes from ruleset {candidate.rulesetMismatch}, the app knows a different one.
				Individual values may differ.
			</p>
		{/if}

		<div class="actions">
			<button class="ghost" onclick={oncancel}>Cancel</button>
			<button class:danger={!harmless} onclick={onconfirm}>
				{harmless ? 'Import' : 'Overwrite anyway'}
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
		font-size: var(--ui-t-xl);
		overflow-wrap: anywhere;
	}

	.count {
		margin: 3px 0 12px;
		font-size: var(--ui-t-base);
		color: var(--ui-text-muted);
	}

	.note {
		margin: 0 0 10px;
		padding: 10px 12px;
		border-radius: 10px;
		font-size: var(--ui-t-md);
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
		font-size: var(--ui-t-lg);
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
