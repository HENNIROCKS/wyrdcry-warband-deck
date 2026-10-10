<!-- The arrow on every way back to where one came from. Decorative: the link it
     sits in carries the words or the label. -->
<script lang="ts">
	let { size = 18 }: { size?: number } = $props();
</script>

<svg
	viewBox="0 0 24 24"
	width={size}
	height={size}
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d="M19 12H5M11 18l-6-6 6-6" />
</svg>
