<script lang="ts">
	import { tokenize } from '../markup';

	let { text }: { text: string } = $props();
</script>

<!-- One line, because `.entry` on the fighter card keeps the text's own
     whitespace: a line break here would show up as one on the card. -->
{#each tokenize(text) as token, i (i)}{#if token.kind === 'bold'}<strong>{token.value}</strong>{:else if token.kind === 'keyword'}<span class="keyword">{token.value}</span>{:else}{token.value}{/if}{/each}
