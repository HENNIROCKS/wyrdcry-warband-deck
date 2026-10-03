<script lang="ts">
	import { onMount } from 'svelte';

	import { base } from '$app/paths';
	import { page } from '$app/state';

	import RuleText from '$lib/components/RuleText.svelte';
	import { toRoster, type Roster } from '$lib/roster';
	import { getWarband } from '$lib/storage';

	let roster = $state<Roster | null>(null);
	let missing = $state(false);

	onMount(async () => {
		const id = page.url.searchParams.get('id');
		const entry = id ? await getWarband(id) : undefined;
		if (entry) roster = toRoster(entry);
		else missing = true;
	});
</script>

<svelte:head>
	<!-- Safari names the saved PDF after the title. -->
	<title>{roster ? `${roster.name} – Wyrdcry Warband Roster` : 'Wyrdcry Warband Roster'}</title>
</svelte:head>

<div class="roster">
	<header class="bar">
		<a href="{base}/">Back</a>
		<button onclick={() => window.print()} disabled={!roster}>Print / Save as PDF</button>
	</header>

	<main>
		{#if roster}
			<div class="sheet">
				<table>
					<thead>
						<tr>
							<th>Warband / Faction</th>
							<th class="num">Fighters</th>
							<th class="num">Value</th>
							<th class="num">Favour</th>
							<th class="num">Standing</th>
							<th class="num">Reputation</th>
							<th class="num">Won / Drawn / Lost</th>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td><span class="name">{roster.name}</span><span class="type">{roster.faction}</span></td>
							<td class="num">{roster.fighterCount}</td>
							<td class="num">{roster.value}</td>
							<td class="num">{roster.favour}</td>
							<td class="num">{roster.standing}</td>
							<td class="num">{roster.reputation}</td>
							<td class="num">{roster.results.join(' / ')}</td>
						</tr>
						<tr>
							<td colspan="7"><b>Stash:</b> {roster.stash}</td>
						</tr>
					</tbody>
				</table>

				<table>
					<thead>
						<tr>
							<th class="nowrap">Name / Type</th>
							<th class="num" title="Move">M</th>
							<th class="num" title="Fight">F</th>
							<th class="num" title="Shoot">S</th>
							<th class="num" title="Defense">D</th>
							<th class="num" title="Health">H</th>
							<th class="num" title="Bravery">B</th>
							<th class="num" title="Experience">XP</th>
							<th class="num" title="Renown">Ren</th>
							<th class="num" title="Gold coins">gc</th>
							<th class="col-keywords">Keywords</th>
							<th class="col-talents">Talents</th>
							<th class="weapons">
								<table>
									<tbody>
										<tr>
											<th>Weapons &amp; Equipment</th>
											<th class="num">Rng</th>
											<th class="num">Att</th>
											<th class="num">Dmg</th>
										</tr>
									</tbody>
								</table>
							</th>
							<th class="col-notes">Notes</th>
						</tr>
					</thead>
					<tbody>
						{#each roster.fighters as fighter (fighter.instanceId)}
							<tr>
								<td><span class="name">{fighter.name}</span><span class="type">{fighter.type}</span></td>
								{#each fighter.stats as stat, i (i)}
									<td class="num">{stat}</td>
								{/each}
								<td class="num">{fighter.xp}</td>
								<td class="num">{fighter.renown}</td>
								<td class="num">{fighter.cost}</td>
								<td class="keywords">{fighter.keywords}</td>
								<td>
									{#each fighter.talents as talent, i (i)}
										<span class="line">{talent}</span>
									{:else}
										–
									{/each}
								</td>
								<td class="weapons">
									<table>
										<tbody>
											{#each fighter.weapons as weapon, i (i)}
												<tr>
													<td>{weapon.name}</td>
													<td class="num">{weapon.range}</td>
													<td class="num">{weapon.attacks}</td>
													<td class="num">{weapon.damage}</td>
												</tr>
											{/each}
											{#if fighter.items}
												<tr><td colspan="4">{fighter.items}</td></tr>
											{/if}
										</tbody>
									</table>
								</td>
								<td>
									{#each fighter.notes as note, i (i)}
										<span class="line"><RuleText text={note} /></span>
									{:else}
										–
									{/each}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>

				<!-- In the order the cards list them: faction rules first, then the
				     talents by type, then weapon rules, then items – each group by name. -->
				<table class="rules">
					<thead>
						<tr>
							<th>Special Rule</th>
							<th>Type</th>
							<th>Fighter</th>
							<th>Description</th>
						</tr>
					</thead>
					<tbody>
						{#each roster.rules as rule (rule.type + rule.name)}
							<tr>
								<td>{rule.name}</td>
								<td>{rule.type}</td>
								<td>{rule.fighters}</td>
								<!-- One line: the cell keeps line breaks, the markup's included. -->
								<td class="text"><RuleText text={rule.text.trim()} />{#if rule.note}{' '}<i>{rule.note}</i>{/if}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else if missing}
			<p class="missing">This warband is not on this device.</p>
		{/if}
	</main>
</div>

<style>
	@page {
		size: A4 landscape;
		margin: 10mm 10mm 14mm;

		/* Repeats on every printed page, in the bottom margin. */
		@bottom-right {
			content: 'Wyrdcry Warband Roster';
			font-family: 'Alegreya', serif;
			font-size: 8pt;
			vertical-align: middle;
			/* Otherwise it inherits the app's light text colour. */
			color: black;
		}
	}

	.roster {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.bar {
		display: flex;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 12px;
	}

	/* The surface and border of the header's icon buttons, as on the about page. */
	.bar a,
	.bar button {
		padding: 9px 13px;
		border: 1px solid var(--ui-border);
		border-radius: 9px;
		background: var(--ui-surface);
		font-size: var(--ui-t-md);
		font-weight: 600;
		text-decoration: none;
		color: var(--ui-text);
	}

	.bar button {
		color: var(--ui-accent-text);
	}

	.bar button:disabled {
		color: var(--ui-text-subtle);
	}

	/* The sheet keeps its printed width; on a phone it scrolls sideways. */
	main {
		flex: 1;
		overflow: auto;
		padding: 0 12px calc(12px + env(safe-area-inset-bottom));
	}

	.missing {
		padding: 20px 0;
		font-size: var(--ui-t-md);
		color: var(--ui-text-muted);
	}

	.sheet {
		/* A4 landscape less the page margins. */
		width: 277mm;
		padding: 10mm;
		box-sizing: content-box;
		background: white;
		color: black;
		font-family: 'Alegreya', serif;
		font-size: 9.5pt;
		line-height: 1.3;
	}

	table {
		border-collapse: collapse;
		border: 1px solid black;
		width: 100%;
	}

	table + table {
		margin-top: 20px;
	}

	thead {
		display: table-header-group;
	}

	tr {
		break-inside: avoid;
	}

	th {
		border-bottom: 2px solid black;
		padding: 6px 8px;
		text-align: left;
		vertical-align: bottom;
		font-size: 10pt;
		font-weight: 700;
		line-height: 1.15;
	}

	td {
		border-bottom: 1px solid black;
		padding: 6px 8px;
		vertical-align: top;
	}

	tbody > tr:last-child > td,
	.weapons td {
		border-bottom: 0;
	}

	/* Characteristics, campaign values and weapon profiles: lining figures,
	   one column of digits over the other. */
	.num {
		text-align: center;
		white-space: nowrap;
		font-variant-numeric: lining-nums tabular-nums;
	}

	.nowrap {
		white-space: nowrap;
	}

	.name {
		font-weight: 700;
	}

	.type {
		display: block;
		white-space: nowrap;
		font-size: 8.5pt;
	}

	.line {
		display: block;
	}

	.keywords {
		font-size: 8pt;
		text-transform: uppercase;
	}

	.col-keywords {
		width: 13%;
	}

	.col-talents {
		width: 15%;
	}

	.col-notes {
		width: 11%;
	}

	/* The weapon profiles inside a fighter's row. Header and rows are separate
	   tables, so the profile columns are fixed to line up. */
	th.weapons,
	td.weapons {
		width: 30%;
		padding: 0;
	}

	.weapons table {
		border: 0;
		table-layout: fixed;
	}

	.weapons th {
		border-bottom: 0;
	}

	.weapons td {
		padding: 3px 8px;
	}

	.weapons tr:first-child td {
		padding-top: 6px;
	}

	.weapons .num {
		width: 40px;
		padding-inline: 4px;
	}

	th.weapons th {
		padding: 6px 8px;
	}

	th.weapons th.num {
		padding-inline: 4px;
	}

	.rules {
		break-before: page;
	}

	.rules th:nth-child(1) {
		width: 16%;
	}

	.rules th:nth-child(2) {
		width: 9%;
	}

	.rules th:nth-child(3) {
		width: 20%;
	}

	/* The rules text keeps the line breaks of its lists. */
	.text {
		white-space: pre-line;
	}

	/* On paper a keyword is set in capitals, not drawn as the card's chip. */
	.sheet :global(.keyword) {
		display: inline;
		padding: 0;
		border: 0;
		background: none;
		font-size: inherit;
		letter-spacing: 0;
	}

	@media print {
		:global(html:has(.roster)),
		:global(body:has(.roster)) {
			height: auto;
			background: white;
		}

		/* The layout holds the app to the viewport's height; on paper it runs on. */
		:global(.app:has(.roster)) {
			display: block;
			height: auto;
			padding: 0;
		}

		.roster,
		main {
			display: block;
			overflow: visible;
			padding: 0;
		}

		.bar {
			display: none;
		}

		.sheet {
			width: auto;
			padding: 0;
		}
	}
</style>
