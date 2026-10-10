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

<div class="sheet-backdrop">
	<div class="bottom-sheet" role="dialog" aria-modal="true" aria-labelledby="import-title">
		<h2 id="import-title">{candidate.warband.name}</h2>
		<p class="count">
			{candidate.warband.fighters.length} fighters
			{#if candidate.meta}· Revision {candidate.meta.revision}{/if}
		</p>

		{#if candidate.verdict.kind === 'new'}
			<p class="notice ok">New warband. Will be added.</p>
		{:else if candidate.verdict.kind === 'newer'}
			<p class="notice ok">
				Newer than the stored state (revision {candidate.verdict.storedRevision} →
				{candidate.verdict.incomingRevision}).
			</p>
		{:else if candidate.verdict.kind === 'same'}
			<p class="notice">Same state as stored here. Importing changes nothing.</p>
		{:else if candidate.verdict.kind === 'older'}
			<p class="notice danger">
				<strong>This file is older.</strong> Stored here is revision {candidate.verdict.storedRevision},
				the file has {candidate.verdict.incomingRevision}. Importing overwrites the newer state.
				Photos of fighters the file does not have are removed.
			</p>
		{:else if candidate.verdict.kind === 'diverged'}
			<p class="notice danger">
				<strong>These states have diverged.</strong> Both carry revision
				{candidate.verdict.incomingRevision} but come from different devices
				(this one and {candidate.verdict.otherDevice}). What is stored here is lost on import,
				and with it the photos of fighters the file does not have.
			</p>
		{/if}

		{#if candidate.rulesetMismatch}
			<p class="notice warn">
				This file comes from ruleset {candidate.rulesetMismatch}, the app knows a different one.
				Individual values may differ.
			</p>
		{/if}

		<div class="sheet-actions">
			<button class="btn" onclick={oncancel}>Cancel</button>
			<button class={harmless ? 'btn primary' : 'btn danger'} onclick={onconfirm}>
				{harmless ? 'Import' : 'Overwrite anyway'}
			</button>
		</div>
	</div>
</div>
