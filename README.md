# Wyrdcry Warband Deck

Your own [Wyrdcry](https://wyrdcry.net) warband as a deck of cards on your phone.
Export the warband from the Warband Builder, import it here, swipe through the
fighters.

Unofficial fan project. No connection to the authors of Wyrdcry or to Games
Workshop.

**Status: early.** The app displays, it does not edit.

## What it does

- Import warband JSON from the builder
- Show fighters as cards and swipe through them
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

The game data is **not** part of this repo. It belongs to the Wyrdcry project,
whose licence is currently unresolved, which is why `src/lib/data/*.json` is
gitignored.

| Command | Purpose |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` | static site into `build/` |
| `npm run check` | type check |
| `npm run sync:data` | copy the game data |

## Related projects

- [`jomblr/wyrdcry`](https://github.com/jomblr/wyrdcry) – rules site and Warband Builder, source of the data
- `wyrdcry-card-creator` – cards for printing; the design comes from there
