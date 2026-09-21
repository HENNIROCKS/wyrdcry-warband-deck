# Wyrdcry Warband Deck

Your own [Wyrdcry](https://wyrdcry.net) warband as a deck of cards on your phone.
Export the warband from the Warband Builder, import it here, swipe through the
fighters.

Unofficial fan project. No connection to the authors of Wyrdcry or to Games
Workshop.

**Status: early.** The app tracks a battle; it does not edit the warband.

## What it does

- Import warband JSON from the builder
- Show the warband itself as the first card: faction, standing, favour,
  reputation, gold, value, stash and the warband notes
- Show fighters as cards and swipe through them
- Mark fighters as activated during a battle, count the rounds and clear the
  activations for the next one – one step of that is undoable
- Export through the system share sheet, either as the current state or as a
  dated snapshot
- Warn on import when the file is older than the stored state

## Data

Everything lives in IndexedDB, on this one device. No account, no server, no
sync. Whatever has not been exported is gone after an uninstall.

Adding the app to the home screen is not a convenience but a requirement: Safari
clears the data of sites that are not installed after seven days without use.

## Development

Node 20 or newer.

```sh
npm install
npm run sync:data     # copy the game data from the site repo
npm run dev
```

`npm run sync:data` expects the repo [`jomblr/wyrdcry`](https://github.com/jomblr/wyrdcry)
as a sibling directory. If it lives elsewhere:

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
| `npm run dev` | development server |
| `npm run build` | static site into `build/` |
| `npm run check` | type check |
| `npm run sync:data` | fetch the game data |

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
