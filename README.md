# Wyrdcry Warband Deck

Your own [Wyrdcry](https://wyrdcry.net) warband as a deck of cards on your phone.
Build the warband here, or import one from the Warband Builder, then swipe
through the fighters.

Unofficial fan project. No connection to Games Workshop.

**Status: early.** The app builds a warband of any of the eight factions, tracks
a battle and edits a fighter afterwards – name, experience, renown, equipment,
buying, dismissal; it does not yet roll injuries or sell to the trading post,
and the way back to the Warband Builder is not currently assured – see
[Warband Builder compatibility](#warband-builder-compatibility).

## What it does

- Build a warband step by step: faction, its rules, then one fighter at a time,
  with the budget, the roster limits and the equipment restrictions checked as
  you go. Six factions out of the rulebook: Mercenaries, Clan Eshin, Sisters of
  Sigmar, Undead, Witch Hunters and the Possessed. Two homebrew factions
  beside them, under a heading of their own: Clan Pestilens and the Greenskin
  Marauders
- Import warband JSON from the builder
- Show the warband itself as the first card: faction, standing, favour,
  reputation, gold, value, stash, its heroes and henchmen at a glance, the
  warband notes and a battle history counted into won, drawn and lost
- Show fighters as cards and swipe through them
- Tap a fighter on the warband card to jump straight to its card
- Turn a card over to edit it: a fighter's name, experience, renown, notes and
  fluff, or the warband's notes and battle history. A renown level is spent on
  a characteristic right there. Equipment moves between a fighter and the
  stash there as well, checked against what the fighter may carry, and is
  bought there from the faction's list and the Trading Post, a rare piece once
  its Rarity roll is made. Gold is added to the stash on the warband's back. A
  fighter is dismissed there too, its equipment sent to the stash if you like
- Put a photo of the painted model in a fighter's image field, moved and zoomed
  on the back of the card; it stays on the device
- Tap a worked-out value or a weapon to see where it comes from: which
  modifiers went into it, and which rules apply only in the right situation
- Track a battle: mark fighters as activated or waiting, count the damage each
  one holds, see who is out of action and when the warband starts wavering,
  get reminded of each fighter's Bravery test while it does, mark who is
  panicked, count the rounds and clear the round's states for the next one – one step of
  that is undoable, and a battle started by mistake can be cancelled
- After a battle, award experience and spend the renown it brings
- Export through the system share sheet, either as the current state or as a
  dated snapshot
- Export the warband as a roster PDF on A4 landscape, through the same share
  sheet: every fighter with characteristics, weapons and talents, then each
  rule once with the fighters that carry it
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
rather than as a round trip. Restoring it is the last item on the roadmap,
because everything before it changes the file that would be checked.

## Roadmap

What is built and what comes next is a checklist in [`ROADMAP.md`](ROADMAP.md).

## Data

Everything lives in IndexedDB, on this one device. No account, no server, no
sync. Whatever has not been exported is gone after an uninstall.

Photos of the painted models are kept in the same database, reduced to a copy of
their own, and never go into an export: whatever removes the warband removes
them too, and importing the file elsewhere brings no photos along. The photo you
picked stays where it was – unless it was taken with the camera from inside the
app.

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
npm run sync:data -- --site /path/to/wyrdcry
```

The app follows 0.9, the current rules. The site repo still keeps them apart
from the deprecated 0.5. It reads two things from there. The JSON files under
`src/data-versions/0.9/` it copies, writing a fighter's `armour` into the
`defense` the app reads. The universal abilities it extracts from
`docs/rules/the-combat-phase/abilities.md`, because they exist nowhere else —
the result becomes `universal-abilities.json`. Either can be pointed at on its
own:

```sh
npm run sync:data -- --from /path/to/data --docs /path/to/docs
```

Nothing is written before all of it has been read and checked, and a source that
changed shape upstream stops the run instead of quietly yielding less: a table
row the extraction cannot read, or a rule hanging on a keyword no fighter
carries, both end it with a message.

Where the deck deliberately differs from what it syncs – a correction to the
rules, or a reading of them the rules leave open – is listed in
[`DEVIATIONS.md`](DEVIATIONS.md).

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
