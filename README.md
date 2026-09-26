# Wyrdcry Warband Deck

Your own [Wyrdcry](https://wyrdcry.net) warband as a deck of cards on your phone.
Build the warband here, or import one from the Warband Builder, then swipe
through the fighters.

Unofficial fan project. No connection to Games Workshop.

**Status: early.** The app builds a warband of any of the eight factions and
tracks a battle; it does not yet edit a warband once it exists, and the way back
to the Warband Builder is not currently assured – see
[Warband Builder compatibility](#warband-builder-compatibility).

## What it does

- Build a warband step by step: faction, its rules, then one fighter at a time,
  with the budget, the roster limits and the equipment restrictions checked as
  you go. Eight factions: Mercenaries, Clan Eshin, Sisters of Sigmar, Undead,
  Witch Hunters and the Possessed out of the rulebook, plus Clan Pestilens and
  the Greenskin Marauders as homebrew
- Import warband JSON from the builder
- Show the warband itself as the first card: faction, standing, favour,
  reputation, gold, value, stash and the warband notes
- Show fighters as cards and swipe through them
- Tap a worked-out value or a weapon to see where it comes from: which
  modifiers went into it, and which rules apply only in the right situation
- Track a battle: mark fighters as activated or waiting, count the damage each
  one holds, see who is out of action and when the warband starts wavering,
  count the rounds and clear the round's states for the next one – one step of
  that is undoable
- Export through the system share sheet, either as the current state or as a
  dated snapshot
- Warn on import when the file is older than the stored state

## Warband Builder compatibility

The export is still written in the shape the Warband Builder reads, and for the
six factions out of the rulebook the way back is built to hold: `statOverrides`
carries absolute values, and everything the builder's model has no field for
rides along under a key its import leaves alone.

**It has not been measured since this app grew a builder of its own.** And for
the two homebrew factions it cannot hold: `clan-pestilens` and
`greenskin-marauders`, and the eleven fighter profiles under them, exist only
here. The builder accepts such a file and then resolves neither the faction nor
any of its fighters.

Until that is settled, treat Export and Snapshot as the way to keep a copy
rather than as a round trip. Restoring it is the last item on the roadmap below,
because everything above it changes the file that would be checked.

## Roadmap

Done:

- [x] Import warband JSON, swipe through the deck, export it again
- [x] Build a warband in the app, for all eight factions
- [x] The warband itself as the first card
- [x] Mark fighters as activated, count the rounds, undo one step
- [x] In-game states: wounds, out of action, waiting

**Confirm what is there.** Eight factions are transcribed and none has been
played; whatever turns up here changes the shape of everything below.

- [ ] Play a Possessed warband end to end – the faction that tests the rest

**After the battle.** The aftermath sequence has six steps, and it is the first
thing that writes to the campaign rather than to a battle.

- [ ] Experience and renown
- [ ] Heroic traits
- [ ] Injuries
- [ ] The rest of the sequence: favour, income, the trading post, recalculated
      reputation

**The warband between evenings.** Touching a warband that already exists – so
far it is built once and read-only after that.

- [ ] Hired Swords
- [ ] The warband stash and its notes, and changing a fighter afterwards: their
      equipment, their name, dismissing them

**What all of it depends on.** Neither can be pulled forward: their subject is
the result of everything above.

- [ ] A pass over the design and the interface outside the cards
- [ ] Warband Builder compatibility, measured rather than assumed

Not sorted into that order and not dropped: working offline at the table –
cached game data, screen kept awake.

Further out and nothing promised: NFC tags under the model bases, a photo of the
painted model as the card image, showing an opponent the warband over a
read-only link.

## Data

Everything lives in IndexedDB, on this one device. No account, no server, no
sync. Whatever has not been exported is gone after an uninstall.

Adding the app to the home screen is not a convenience but a requirement: Safari
clears the data of sites that are not installed after seven days without use.

## Development

Node 20 or newer. Go through the `Makefile` rather than calling npm directly –
it carries the environment the toolchain needs, and `make dev` in particular is
not `npm run dev`: it serves on the local network and opens the QR page, because
the phone is where a card height and a swipe are actually confirmed.

```sh
npm install
make sync     # copy the game data from the site repo
make dev
```

`make sync` expects the repo [`jomblr/wyrdcry`](https://github.com/jomblr/wyrdcry)
as a sibling directory. If it lives elsewhere, call the script directly – the
make target passes no arguments through:

```sh
npm run sync:data -- --from /path/to/wyrdcry/src/data
```

It reads two things from there. The JSON files it copies. The universal
abilities it extracts from `docs/rules/the-combat-phase/abilities.md`, because
they exist nowhere else — the result becomes `universal-abilities.json`. The
docs are looked for beside the data's repo; for a data directory on its own,
point at them:

```sh
npm run sync:data -- --from /path/to/data --docs /path/to/wyrdcry/docs
```

Nothing is written before all of it has been read and checked, and a source that
changed shape upstream stops the run instead of quietly yielding less: a table
row the extraction cannot read, or a rule hanging on a keyword no fighter
carries, both end it with a message.

The game data is **not** part of this repo. It belongs to the Wyrdcry project,
whose licence is currently unresolved, which is why `src/lib/data/*.json` is
gitignored.

| Command | Purpose |
| --- | --- |
| `make dev` | development server on the local network, opening the QR page |
| `make build` | static site into `build/` |
| `make check` | type check **and** the ids in the hand-kept ruleset |
| `make check-rules` | the ruleset alone, without the type check |
| `make sync` | fetch the game data |

## Deployment

<https://hennirocks.github.io/wyrdcry-warband-deck/>

GitHub Actions builds it on every push to `main`. Because the game data is not
in this repo, the workflow checks out the site repo alongside and runs
`sync:data` before the build – the deployed version therefore follows the data
upstream, and a source that changed shape there stops the deploy.

A service worker makes the app installable. That needs HTTPS, which is why it
has to be a real host and not a file on the phone.

## Related projects

- [`jomblr/wyrdcry`](https://github.com/jomblr/wyrdcry) – rules site and Warband Builder, source of the data
- `wyrdcry-card-creator` – cards for printing; the design comes from there

## Licence

The code is MIT, see [LICENSE](LICENSE). The fonts Grenze Gotisch and Alegreya
are under the SIL Open Font License 1.1; their licence texts sit beside the
files in `static/fonts/`. Card texture and card design come from
`wyrdcry-card-creator`, which is MIT as well.
