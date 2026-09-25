# Herd's nvm puts Node 16 first in PATH, and SvelteKit, Vite and svelte-check
# need 20+ – without this every target fails with a message that reads like a
# problem with the project. Where there is no Homebrew the directory does not
# exist and prepending it does nothing, so this carries no local detail.
export PATH := /opt/homebrew/bin:$(PATH)

# None of these are files. `build` in particular would otherwise be considered
# up to date, because the build writes a directory of that name.
.PHONY: dev build check check-rules sync

# Serves on the network and opens the QR page, so the phone is one scan away.
dev:
	npm run dev:lan -- --open /dev

build:
	npm run build

# Two gates: the types, and every id the hand-kept ruleset points across a file
# boundary with.
check:
	npm run check
	npm run check:rules

check-rules:
	npm run check:rules

# Copies the game data out of the site repo; they are not in this one.
sync:
	npm run sync:data
