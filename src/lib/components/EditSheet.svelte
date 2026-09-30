<script lang="ts">
	import { untrack } from 'svelte';

	export interface EditField {
		key: string;
		label: string;
		value: string;
		placeholder?: string;
	}

	let {
		title,
		fields,
		onsave,
		oncancel
	}: {
		title: string;
		fields: EditField[];
		onsave: (values: Record<string, string>) => void;
		oncancel: () => void;
	} = $props();

	/* Read once, like AftermathSheet's candidates: this sheet is mounted fresh
	   each time it opens, never kept across a change underneath it. */
	const values = $state(untrack(() => Object.fromEntries(fields.map((field) => [field.key, field.value]))));
</script>

<div class="backdrop">
	<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="edit-title">
		<h2 id="edit-title">{title}</h2>

		<div class="fields">
			{#each fields as field (field.key)}
				<label class="field">
					<span class="label">{field.label}</span>
					<textarea
						rows="4"
						placeholder={field.placeholder}
						bind:value={values[field.key]}
					></textarea>
				</label>
			{/each}
		</div>

		<div class="actions">
			<button class="ghost" onclick={oncancel}>Cancel</button>
			<button onclick={() => onsave(values)}>Save</button>
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
		max-height: 80vh;
		overflow-y: auto;
		background: var(--ui-surface);
		border: 1px solid var(--ui-border);
		border-radius: 14px;
		padding: 16px;
	}

	h2 {
		margin: 0 0 12px;
		font-size: var(--ui-t-xl);
		overflow-wrap: anywhere;
	}

	.fields {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: var(--ui-t-sm);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ui-text-subtle);
	}

	textarea {
		width: 100%;
		padding: 10px 12px;
		font: inherit;
		font-size: var(--ui-t-base);
		color: var(--ui-text);
		background: var(--ui-surface-2);
		border: 1px solid var(--ui-border);
		border-radius: 10px;
		resize: vertical;
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
</style>
