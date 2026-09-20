<script lang="ts">
	import StatBar from './StatBar.svelte';
	import type { FighterCardData } from '../types/card';

	let { card }: { card: FighterCardData } = $props();
</script>

<article class="card" class:unresolved={card.unresolved}>
	<!-- Kopfzone bleibt beim Scrollen stehen: auf die Werteleiste schaut man ständig. -->
	<header class="head">
		<div class="titles">
			<h2>{card.name}</h2>
			{#if card.subtitle}<p class="subtitle">{card.subtitle}</p>{/if}
		</div>
		<div class="meta">
			<span class="cost">{card.cost}<span class="gc">gc</span></span>
			{#if card.isHero}<span class="tag">Hero</span>{/if}
		</div>
		{#if card.stats.length}
			<StatBar stats={card.stats} />
		{/if}
	</header>

	<div class="body">
		{#if card.unresolved}
			<p class="warn">
				Dieses Profil steht nicht in den Stammdaten. Die Bande verweist auf
				<code>{card.name}</code> – vermutlich ein neuerer Regelstand.
			</p>
		{/if}

		{#if card.weapons.length}
			<section>
				<h3>Waffen</h3>
				<table>
					<thead>
						<tr><th>Name</th><th>Rw</th><th>A</th><th>T/K</th></tr>
					</thead>
					<tbody>
						{#each card.weapons as weapon, i (weapon.name + i)}
							<tr>
								<td>
									{weapon.name}
									{#if weapon.rules.length}<span class="rules">{weapon.rules.join(', ')}</span>{/if}
								</td>
								<td class="num">{weapon.range}</td>
								<td class="num">{weapon.attacks}</td>
								<td class="num">{weapon.damage}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/if}

		{#if card.items.length}
			<section>
				<h3>Ausrüstung</h3>
				{#each card.items as item, i (item.name + i)}
					<p class="entry"><strong>{item.name}</strong> {item.description}</p>
				{/each}
			</section>
		{/if}

		{#if card.abilities.length}
			<section>
				<h3>Talente</h3>
				{#each card.abilities as ability, i (ability.name + i)}
					<p class="entry">
						<strong>{ability.name}</strong>
						{#if ability.type}<span class="kind">{ability.type}</span>{/if}
						{ability.description}
					</p>
				{/each}
			</section>
		{/if}

		{#if card.notes}
			<section>
				<h3>Notizen</h3>
				<p class="entry">{card.notes}</p>
			</section>
		{/if}

		<footer>
			{#if card.keywords.length}
				<ul class="keywords">
					{#each card.keywords as keyword (keyword)}
						<li>{keyword}</li>
					{/each}
				</ul>
			{/if}
			<p class="progress">XP {card.xp} · Ruhm {card.renown}</p>
		</footer>
	</div>
</article>

<style>
	.card {
		display: flex;
		flex-direction: column;
		min-height: 100%;
		background: linear-gradient(180deg, var(--parchment) 0%, var(--parchment-2) 100%);
		color: var(--parchment-ink);
		border-radius: 14px;
		/* Kein overflow: hidden – es würde einen eigenen Clip-Kontext aufmachen
		   und die klebende Kopfzone mitscrollen lassen. */
	}

	.head {
		position: sticky;
		top: 0;
		z-index: 1;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 8px 12px;
		padding: 12px 14px 12px;
		/* Deckend, sonst scheint der Text darunter durch die klebende Kopfzone. */
		background: var(--parchment);
		border-bottom: 1px solid rgba(28, 24, 16, 0.18);
		box-shadow: 0 6px 10px -8px rgba(28, 24, 16, 0.55);
		border-radius: 14px 14px 0 0;
	}

	.head :global(.bar) {
		grid-column: 1 / -1;
	}

	.titles {
		min-width: 0;
	}

	h2 {
		margin: 0;
		font-size: 21px;
		line-height: 1.15;
		font-weight: 700;
		overflow-wrap: anywhere;
	}

	.subtitle {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--parchment-ink-muted);
	}

	.meta {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 4px;
	}

	.cost {
		font-size: 17px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}

	.gc {
		font-size: 11px;
		font-weight: 600;
		margin-left: 2px;
		color: var(--parchment-ink-muted);
	}

	.tag {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.07em;
		text-transform: uppercase;
		padding: 2px 7px;
		border-radius: 999px;
		border: 1px solid rgba(22, 117, 74, 0.5);
		color: #0f5537;
	}

	.body {
		flex: 1;
		padding: 12px 14px 16px;
		display: flex;
		flex-direction: column;
		gap: 14px;
	}

	h3 {
		margin: 0 0 5px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--parchment-ink-muted);
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 14px;
	}

	th {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--parchment-ink-muted);
		text-align: left;
		padding-bottom: 3px;
	}

	th:not(:first-child),
	.num {
		text-align: center;
		font-variant-numeric: tabular-nums;
	}

	td {
		padding: 5px 4px;
		border-top: 1px solid rgba(28, 24, 16, 0.12);
		vertical-align: top;
	}

	td:first-child {
		padding-left: 0;
	}

	.rules {
		display: block;
		font-size: 11px;
		color: var(--parchment-ink-muted);
	}

	.entry {
		margin: 0 0 7px;
		font-size: 14px;
		line-height: 1.4;
	}

	.entry:last-child {
		margin-bottom: 0;
	}

	.kind {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--parchment-ink-muted);
		margin-right: 4px;
	}

	.warn {
		margin: 0;
		padding: 9px 11px;
		border-radius: 9px;
		font-size: 13px;
		line-height: 1.4;
		background: var(--ui-warn-bg);
		border: 1px solid rgba(180, 83, 9, 0.4);
	}

	footer {
		margin-top: auto;
		border-bottom-left-radius: 14px;
		border-bottom-right-radius: 14px;
		padding-top: 10px;
		border-top: 1px solid rgba(28, 24, 16, 0.12);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.keywords {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.keywords li {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.07em;
		padding: 3px 8px;
		border-radius: 999px;
		border: 1px solid rgba(22, 117, 74, 0.45);
		background: rgba(255, 255, 255, 0.25);
		color: #0f5537;
	}

	.progress {
		margin: 0;
		font-size: 12px;
		color: var(--parchment-ink-muted);
		font-variant-numeric: tabular-nums;
	}
</style>
