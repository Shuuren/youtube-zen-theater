# Contributing

YouTube Zen Theater is a Manifest V3 extension. The runtime is plain JavaScript and CSS loaded directly by the browser. There is no bundler and no framework.

## Setup

1. Install [Bun](https://bun.sh).
2. Install dependencies and run the same check CI runs:

```sh
bun install
bun run check
```

`bun run check` is lint (oxlint), typecheck (`tsc --noEmit` with `checkJs`), and the fake-DOM regression scripts.

Syntax-check a file you edited when it sits outside `checkJs`:

```sh
node --check src/content.js
node --check popup/popup.js
node --check popup/navigation.js
git diff --check
```

Load the extension from this folder at `chrome://extensions` (Developer mode → Load unpacked). Reload the extension after runtime changes, then reload the YouTube tab.

## What belongs in a change

- Keep the video primary. Hide distractions by steering YouTube's own controls, not by replacing the player.
- Do not add permissions, host access, remote code, analytics, or a build step. `manifest.json` is `storage` plus YouTube content scripts.
- Runtime files must stay directly loadable. Popup and content script each carry their own settings schema today; if you change a stored key, change both copies and the regression that covers it.
- YouTube renames DOM nodes without notice. Selector changes need a regression in `scripts/` or a note about what you could not run.
- The optional Helium diagnostic (`scripts/diagnose_zen_toggle_resize.py`) uses a temporary profile and writes under `diagnostics/`. Do not commit that output.

## What not to commit

- `node_modules/`, `diagnostics/`, Python bytecode, `.env` files, extension keys (`*.pem`, `*.crx`), or store zip files.
- Agent session logs, local absolute paths, or token telemetry. `plans/` and `LAG_*.md` are historical notes, not the contributor guide.
- Generated formatting-only diffs mixed into a behavior change. Fix lint findings your change introduced.

## Pull requests

Describe the user-visible behavior, the files you touched, and which checks you ran. A store-bound zip should contain only the runtime: `manifest.json`, `src/`, `popup/` (not the `*.prototype.html` files), and the PNG icons the manifest names. Leave `icons/icon-source.png`, `plans/`, `scripts/`, `tools/`, and `LAG_*.md` out of that zip.

## License

Original source is MIT. See [LICENSE](LICENSE), including the third-party note for the vendored oxlint plugin.
