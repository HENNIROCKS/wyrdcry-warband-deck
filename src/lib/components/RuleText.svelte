<script lang="ts">
	import { blocks, tokenize } from '../markup';

	let { text }: { text: string } = $props();
</script>

<!-- Spans rather than <ul>: the text sits inside a <p> or a <span> wherever it
     is used, and a list element there would break the page apart when parsed.
     Each line is written on one, because `.entry` on the fighter card keeps the
     text's own whitespace: a line break here would show up as one on the card. -->
{#snippet inline(value: string)}{#each tokenize(value) as token, i (i)}{#if token.kind === 'bold'}<strong>{token.value}</strong>{:else if token.kind === 'italic'}<em>{token.value}</em>{:else if token.kind === 'keyword'}<span class="keyword">{token.value}</span>{:else}{token.value}{/if}{/each}{/snippet}{#each blocks(text) as block, b (b)}{#if block.kind === 'list'}<span class="rule-list" role="list">{#each block.items as item, i (i)}<span class="rule-item" role="listitem">{@render inline(item)}</span>{/each}</span>{:else}{@render inline(block.value)}{/if}{/each}
