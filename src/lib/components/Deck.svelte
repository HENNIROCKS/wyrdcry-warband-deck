<script lang="ts">
	import { onMount, tick, untrack, type Snippet } from 'svelte';

	import BattleBar from './BattleBar.svelte';
	import Explanation from './Explanation.svelte';
	import { explanation } from '../explanation';
	import FighterCard from './FighterCard.svelte';
	import WarbandCard from './WarbandCard.svelte';
	import { hasKeyword, healthOf } from '../adapter';
	import { stateOf, type Counted } from '../battle';
	import type { DeckCard } from '../types/card';
	import type { BattleState } from '../types/warband';

	let {
		cards,
		counted,
		battle = null,
		wavering = false,
		ontoggle,
		onwait,
		onwound,
		onheroic,
		oncover,
		onpanicked,
		editing = false,
		back,
		onedit,
		ondone,
		oncancel
	}: {
		cards: DeckCard[];
		/** What each fighter counts for in the morale. Every fighter counts as one where it is left out. */
		counted?: Counted[];
		battle?: BattleState | null;
		/** Whether the warband's morale is wavering, for the fighters' Bravery tests. */
		wavering?: boolean;
		ontoggle?: (instanceId: string) => void;
		onwait?: (instanceId: string) => void;
		onwound?: (instanceId: string, delta: number, health: number) => void;
		onheroic?: (instanceId: string) => void;
		oncover?: (instanceId: string) => void;
		onpanicked?: (instanceId: string) => void;
		/** Whether the card on top is turned over to its back, to be edited. */
		editing?: boolean;
		/** The back of the card on top, shown while `editing`. */
		back?: Snippet<[DeckCard]>;
		/** Asks for the card on top to be turned over. */
		onedit?: (instanceId: string) => void;
		ondone?: () => void;
		oncancel?: () => void;
	} = $props();

	/** Duration of the fly-out; the same number drives transition and switch point. */
	const FLY = 260;
	/** Duration of each half of turning a card over. */
	const TURN = 220;
	/** Fraction of the width past which a released card flies out instead of springing back. */
	const DISTANCE = 0.25;
	/** Flick: from this speed in px/ms a short distance counts too. */
	const VELOCITY = 0.5;

	let stack: HTMLDivElement | undefined = $state();
	/** What the fixed battle bar takes at the foot, so the stack can leave it free. */
	let barHeight = $state(0);
	let current = $state(0);
	let topPane: HTMLDivElement | undefined = $state();
	let face: HTMLDivElement | undefined = $state();
	/** The side of the card on top that is in view – it trails `editing` by half a turn. */
	let shown = $state(false);
	/** Horizontal offset of the top card under the finger. */
	let dx = $state(0);
	let dragging = $state(false);
	/** Direction the card is flying out in: -1 left, 1 right, 0 = it rests. */
	let leaving = $state(0);
	let reduced = $state(false);

	let pointer: number | null = null;
	let startX = 0;
	let startTime = 0;
	let captured = false;

	const wrap = (index: number) => ((index % cards.length) + cards.length) % cards.length;

	/* The bar below the stack belongs to the card on top of it. It is the warband
	   card that has no fighter state, and the bar carries the battle itself there. */
	const top = $derived(cards[current]);
	const topFighter = $derived(top.kind === 'fighter' ? top : null);
	const fighters = $derived(
		counted ??
			cards
				.filter((card) => card.kind === 'fighter')
				.map((card) => ({ instanceId: card.instanceId, weight: 1 }))
	);

	/**
	 * Beneath the top card lies the one the current direction points at: to the
	 * left the next fighter, to the right the previous one. The stack is closed –
	 * behind the last one comes the first again.
	 */
	const beneath = $derived(cards.length > 1 ? wrap(current + (dx > 0 ? -1 : 1)) : -1);

	const duration = $derived(reduced ? 0 : FLY);

	const transform = $derived(
		leaving
			? `translateX(${leaving * 125}%) rotate(${leaving * 18}deg)`
			: `translateX(${dx}px) rotate(${dx * 0.04}deg)`
	);

	/** The card underneath grows to full size while the one above is dragged. */
	const progress = $derived(
		leaving ? 1 : Math.min(1, Math.abs(dx) / ((stack?.clientWidth ?? 320) * DISTANCE))
	);

	onMount(() => {
		const query = matchMedia('(prefers-reduced-motion: reduce)');
		const sync = () => (reduced = query.matches);
		sync();
		query.addEventListener('change', sync);
		return () => query.removeEventListener('change', sync);
	});

	/*
	 * Turned in two halves: the front edge-on, then the back swapped in and
	 * turned up from the other edge. Only one side is ever in the pane, so two
	 * sides of different heights never have to share its scroll.
	 */
	$effect(() => {
		void editing;
		untrack(turn);
	});

	/** Set while the first half runs, which a second call waits out rather than overlapping. */
	let turning = false;

	/*
	 * Each half reads `editing` as it is then, not as it was when the turn began:
	 * Cancel tapped before the card is edge-on brings the front back up, rather
	 * than leaving the back in view with nothing to finish it.
	 */
	async function turn() {
		if (turning || editing === shown) return;
		if (reduced || !face) {
			shown = editing;
			if (topPane) topPane.scrollTop = 0;
			return;
		}
		turning = true;
		/* Held edge-on once there: without the fill the front would spring back
		   flat for a frame before the back is swapped in. */
		const away = face.animate(
			[{ transform: 'perspective(1200px) rotateY(0)' }, { transform: 'perspective(1200px) rotateY(90deg)' }],
			{ duration: TURN, easing: 'ease-in', fill: 'forwards' }
		);
		await away.finished;
		shown = editing;
		if (topPane) topPane.scrollTop = 0;
		await tick();
		/* The curve a swiped card flies out on, so the back settles rather than lands. */
		face?.animate(
			[{ transform: 'perspective(1200px) rotateY(-90deg)' }, { transform: 'perspective(1200px) rotateY(0)' }],
			{ duration: TURN, easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' }
		);
		away.cancel();
		turning = false;
		/* Changed again while the side was being swapped. */
		if (editing !== shown) turn();
	}

	function onPointerDown(event: PointerEvent) {
		/* A turned card stays put: a finger scrolling through its fields is not a swipe. */
		if (cards.length < 2 || leaving || editing) return;
		pointer = event.pointerId;
		startX = event.clientX;
		startTime = event.timeStamp;
		captured = false;
		dragging = true;
		dx = 0;
	}

	function onPointerMove(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer) return;
		dx = event.clientX - startX;
		/* Only once it is clear this is a drag – a tap must not grab the card. */
		if (!captured && Math.abs(dx) > 6) {
			(event.currentTarget as Element).setPointerCapture(event.pointerId);
			captured = true;
		}
	}

	function onPointerUp(event: PointerEvent) {
		if (!dragging || event.pointerId !== pointer) return;
		dragging = false;
		pointer = null;

		const width = stack?.clientWidth ?? 320;
		const velocity = dx / Math.max(1, event.timeStamp - startTime);
		const far = Math.abs(dx) > width * DISTANCE;
		const fast = Math.abs(velocity) > VELOCITY;

		if (far || fast) fly(dx < 0 ? -1 : 1);
		else dx = 0;
	}

	/**
	 * The browser takes over vertical scrolling itself (touch-action: pan-y) and
	 * then cancels the gesture – the half-dragged card belongs back in place.
	 */
	function onPointerCancel() {
		dragging = false;
		pointer = null;
		dx = 0;
	}

	/**
	 * A drag that springs back still ends in a click on whatever lies under the
	 * finger. On a card of six value cells that would open an explanation nobody
	 * asked for, so a gesture that got as far as a drag swallows its click.
	 */
	function onClickCapture(event: MouseEvent) {
		if (!captured) return;
		event.stopPropagation();
		event.preventDefault();
		captured = false;
	}

	function fly(direction: -1 | 1) {
		if (leaving) return;
		/* Without a drag (keyboard) the sign `beneath` reads the direction from is missing. */
		if (dx === 0) dx = direction;
		leaving = direction;
		setTimeout(() => {
			current = wrap(current + (direction < 0 ? 1 : -1));
			leaving = 0;
			dx = 0;
		}, duration);
	}

	/** Straight to a fighter's card, from its name on the warband card: no flight across the stack. */
	function jumpTo(instanceId: string) {
		if (leaving || editing) return;
		const index = cards.findIndex((c) => c.instanceId === instanceId);
		if (index >= 0) current = index;
	}

	function onKeyDown(event: KeyboardEvent) {
		/* The arrows move the caret in a field on the back, not the deck. */
		if (cards.length < 2 || editing) return;
		if (event.key === 'ArrowRight') fly(-1);
		else if (event.key === 'ArrowLeft') fly(1);
		else return;
		event.preventDefault();
	}
</script>

<svelte:window onkeydown={onKeyDown} />

<div class="deck">
	<!-- The bar is fixed to the window, so the room it takes is reserved here –
	     the cards end above it rather than running underneath. A margin and not
	     padding: the panes inside are positioned against this box, and `inset: 0`
	     would reach straight through a padding. -->
	<div
		class="stack"
		class:dragging
		bind:this={stack}
		style:margin-bottom="{barHeight}px"
	>
		{#if beneath >= 0}
			{#key cards[beneath].instanceId}
				<div
					class="pane under"
					class:locked={explanation() !== null}
					style:transform="scale({0.94 + 0.06 * progress})"
					style:opacity={0.55 + 0.45 * progress}
					aria-hidden="true"
				>
					{@render card(cards[beneath])}
				</div>
			{/key}
		{/if}

		{#key cards[current].instanceId}
			<div
				class="pane top"
				class:locked={explanation() !== null}
				role="group"
				aria-roledescription="Card, swipe horizontally"
				aria-label="Card {current + 1} of {cards.length}"
				style:transform
				style:opacity={leaving ? 0 : 1}
				style:transition={dragging
					? 'none'
					: `transform ${duration}ms cubic-bezier(0.22, 0.61, 0.36, 1), opacity ${duration}ms ease-out`}
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerCancel}
				onclickcapture={onClickCapture}
				bind:this={topPane}
			>
				<div class="face" bind:this={face}>
					{#if shown && back}
						{@render back(cards[current])}
					{:else}
						{@render card(cards[current])}
					{/if}
				</div>
			</div>
		{/key}

		<!-- Lies on the card rather than in the bar below it: the foot of the screen
		     belongs to the thumb, and the stroke marks the place in the stack where
		     the eye already is. Outside the panes, so it neither scrolls with the
		     card nor travels with a swipe. A single card is its own whole stack, and
		     one stroke across the full width reads as an ornament, not a place. -->
		{#if cards.length > 1}
			<div class="ticks" aria-hidden="true">
				{#each cards as card, i (card.instanceId)}
					{@const state = card.kind === 'fighter' ? stateOf(battle, card.instanceId) : null}
					<span
						class="tick"
						class:active={i === current}
						class:activated={state?.activated}
						class:waiting={state?.waiting}
						class:out={state?.out}
					></span>
				{/each}
			</div>
		{/if}
	</div>

	{#if ontoggle}
		<BattleBar
			bind:height={barHeight}
			{battle}
			state={topFighter ? stateOf(battle, topFighter.instanceId) : null}
			health={topFighter ? healthOf(topFighter) : 0}
			{fighters}
			hero={topFighter ? hasKeyword(topFighter, 'hero') : false}
			ontoggle={() => topFighter && ontoggle?.(topFighter.instanceId)}
			onwait={() => topFighter && onwait?.(topFighter.instanceId)}
			onheroic={() => topFighter && onheroic?.(topFighter.instanceId)}
			oncover={() => topFighter && oncover?.(topFighter.instanceId)}
			onpanicked={() => topFighter && onpanicked?.(topFighter.instanceId)}
			onwound={(delta) =>
				topFighter && onwound?.(topFighter.instanceId, delta, healthOf(topFighter))}
			{editing}
			onedit={() => onedit?.(top.instanceId)}
			{ondone}
			{oncancel}
		/>
	{/if}
</div>

<!-- Outside the stack: inside a pane, the transform would become the frame a
     fixed overlay is placed against. -->
<Explanation />

{#snippet card(data: DeckCard)}
	{#if data.kind === 'warband'}
		<WarbandCard card={data} onpick={jumpTo} />
	{:else}
		<FighterCard card={data} state={stateOf(battle, data.instanceId)} {wavering} />
	{/if}
{/snippet}

<style>
	.deck {
		display: flex;
		flex-direction: column;
		min-height: 0;
		flex: 1;
	}

	/*
	 * The width lives here rather than on the card, because the stack is also
	 * what the swipe measures itself against: a card held narrower than its
	 * stack would ask for a drag far wider than the card itself.
	 */
	.stack {
		position: relative;
		flex: 1;
		min-height: 0;
		width: 100%;
		max-width: calc(var(--deck-max-width) + 2 * var(--deck-gutter));
		margin-inline: auto;
	}

	/* A drag with the mouse moves the card without selecting any text. */
	.stack.dragging {
		user-select: none;
		-webkit-user-select: none;
	}

	.pane {
		position: absolute;
		inset: 0;
		padding: 0 var(--deck-gutter);
		overflow-y: auto;
		/* The card is what scrolls here, not the page – so this is where an open
		   explanation has to hold it still. */
		/* Vertical scrolling stays inside the card and does not drag the page along. */
		overscroll-behavior: contain;
		-webkit-overflow-scrolling: touch;
	}

	.pane.locked {
		overflow-y: hidden;
	}

	.top {
		/* The browser scrolls vertically, horizontal is left for the swipe gesture. */
		touch-action: pan-y;
		will-change: transform;
		z-index: 1;
	}

	/* Between the pane and the card, so a turn moves the card and not the scroll
	   box. Still the card's full height: it is a column the card stretches in. */
	.face {
		display: flex;
		flex-direction: column;
		min-height: 100%;
	}

	.face > :global(.card) {
		flex: 1;
	}

	.under {
		overflow: hidden;
		pointer-events: none;
	}

	/* Inside the gutter, so the row spans exactly the card's width – which puts the
	   outermost strokes over the card's rounded corners, and `top` is the radius
	   itself to clear them at every card size. In card units and not a flat
	   number: the radius grows with the card, a number that clears it on the phone
	   cuts into it on a tablet. It marks, it does not take a tap: the swipe
	   underneath reaches through it. */
	.ticks {
		position: absolute;
		top: calc(14 * var(--deck-unit));
		left: var(--deck-gutter);
		right: var(--deck-gutter);
		display: flex;
		/* The strokes differ in height, and stretched they all would not. */
		align-items: center;
		gap: 4px;
		z-index: 2;
		pointer-events: none;
	}

	/* Ink on paper rather than one of the UI colours: the strokes lie on the
	   card, and the card is light whatever the interface around it does. */
	.tick {
		flex: 1;
		min-width: 0;
		height: 4px;
		border-radius: 999px;
		background: rgba(0, 0, 0, 0.16);
		transition: background 120ms ease, height 120ms ease;
	}

	/* Height rather than colour alone, and declared before the states so they
	   keep the colour: a fighter who has acted is still marked as such while
	   their card is the one on top. */
	.tick.active {
		height: 7px;
		background: rgba(0, 0, 0, 0.55);
	}

	/* A side effect of the card's own marking, not a control of its own: who has
	   acted is struck out, who waits is picked out because they are still to come,
	   and who is out of action is marked in the wound colour.

	   Struck out in light rather than in a paler ink: against the card's texture a
	   lighter stroke stands 2.5:1 off its neighbours where a paler one manages
	   1.1:1, and a state nobody can pick out of the row is not carried at all. */
	.tick.activated {
		background: rgba(255, 255, 255, 0.75);
	}

	.tick.waiting {
		background: var(--card-green);
	}

	.tick.out {
		background: var(--card-blood);
	}

</style>
