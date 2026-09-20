<script lang="ts">
	import type { CardWeapon } from '../types/card';

	let { weapons }: { weapons: CardWeapon[] } = $props();
</script>

<div class="box">
	<div class="row head">
		<div class="col name"><span>{weapons.length > 1 ? 'Weapons' : 'Weapon'}</span></div>
		<div class="col"><span>Range</span></div>
		<div class="col"><span>Attacks</span></div>
		<div class="col"><span>Damage</span></div>
	</div>
	{#each weapons as weapon, i (weapon.name + i)}
		<div class="row">
			<div class="col name">{weapon.name}</div>
			<div class="col">{weapon.range}</div>
			<div class="col">{weapon.attacks}</div>
			<div class="col">{weapon.damage}</div>
		</div>
	{/each}
</div>

<style>
	.box {
		border: 1px solid var(--card-green);
		border-radius: calc(7.5 * var(--u));
		overflow: hidden;
	}

	.row {
		display: flex;
		min-height: calc(46 * var(--u));
		background: var(--card-wash);
	}

	/* Zebra striping skips the header – class plus pseudo-class would otherwise
	   outweigh .head and wash its green out. */
	.row:not(.head):nth-child(odd) {
		background: var(--card-wash-2);
	}

	.head {
		background: var(--card-green);
	}

	.col {
		flex: 1 1 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: 'Grenze Gotisch', serif;
		font-size: calc(20 * var(--t));
		line-height: 1.15;
		text-align: center;
		color: var(--card-ink);
		/* Grenze Gotisch's old-style figures sit slightly below the optical centre
		   of their line box; the padding splits the difference. */
		padding: calc(3 * var(--u)) calc(4 * var(--u)) calc(6 * var(--u));
	}

	.head .col {
		color: var(--card-paper);
		padding-bottom: calc(3 * var(--u));
	}

	/* Letters carry full ascenders and descenders and already centre. */
	.col.name {
		flex: 2 2 0;
		justify-content: flex-start;
		text-align: left;
		padding-left: calc(12 * var(--u));
		padding-bottom: calc(3 * var(--u));
	}
</style>
