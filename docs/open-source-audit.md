# Open source audit

Ranked for impact against effort. The product lens is the twenty product-thinking principles: what already exists as a workaround, the one idea worth reaching in a few steps, and which work is a platform crutch rather than the product. This pass does not rewrite the player page or the popup. The ranked items below are the reason to leave those files for a focused change once the public tree and the store package are honest.

## The one idea

A YouTube watch page where the video fills the viewport, and title, chat, recommendations, and navigation wait until the viewer asks for them.

That idea is already real: auto-Zen, native theater, native chat close, and a compact popup. Open-sourcing it is a distribution choice (principle 17). Enhancer-style suites are crowded; a small extension that only does this, with source you can read, is the unclaimed ground. The chain that has to stay true:

1. A stranger can clone the repo and trust what is in it. **This is the link under test.**
2. A store reviewer can see one purpose, a short permission list, and no remote code.
3. The first watch page still reaches the full-viewport video without a settings tour.
4. The same runtime package can ship on Chrome and Firefox, because the user and the buyer are the same person.

Everything else is half-built on purpose until (1) and (2) hold.

## What this tree is

GitHub `main` was five commits behind the local working tree. The first commit on this branch is that tree, excluding `.git`.

| | |
| --- | --- |
| Runtime | MV3. `src/content.js` (2,284 lines), `src/zen.css` (1,074 lines, 504 `!important`), `src/native-panels.js` (MAIN world), `popup/` |
| Permissions | `storage`. Host access declared for `https://www.youtube.com/*` and `https://youtube.com/*` |
| Data | `chrome.storage.sync` for settings only. No analytics, no extension `fetch`, no remote script |
| Checks | `bun run check` = oxlint + `tsc --noEmit` (`checkJs`) + four fake-DOM regressions. CI workflow already existed |
| Secrets | None found. Words like "secret" in `scripts/diagnostic-regression.js` are fixtures for URL redaction |
| Weight | About 2.9 MB. `icons/icon-source.png` is 1.9 MB of that |

No license conflict in original source. The project license is MIT. The ESLint Stylistic adaptation under `tools/oxlint/anti-slop/vendor/eslint-stylistic/` is already MIT and keeps its own `LICENSE`. The rest of that plugin was copied from a local installer with no recorded upstream license; the project license does not claim it. See [LICENSE](../LICENSE).

## Ranked list

Impact is what changes for a new user, a store reviewer, or a contributor who is not the author. Effort is how much of the runtime has to move. Scores are high / medium / low.

| Rank | Improvement | Impact | Effort | Principle |
| --- | --- | --- | --- | --- |
| 1 | Runtime-only store zip and a one-page privacy note | High | Low | 17, 6 |
| 2 | Remove agent notes, home-directory paths, and bytecode from the public tree | High | Low | 5 |
| 3 | Do no Zen work on pages that are not a watch page | High | Medium | 6, 9 |
| 4 | One bounded DOM search instead of repeated shadow-tree walks | High | Medium | 18 |
| 5 | Justify or drop the MAIN-world script and unused host permissions | High | Medium | 19 |
| 6 | Cut the settings matrix until the default is the product | High | High | 7, 9 |
| 7 | Firefox listing from the same zip, plus a short smoke | Medium | Low | 17 |
| 8 | Make the `wide=1` cookie impossible to leave behind | Medium | Low | 11 |
| 9 | One settings schema; stop growing `content.js` as a single file | Medium | Medium | 8 |
| 10 | A browser smoke that can fail in CI, not only a Helium script | Medium | Medium | 14 |

### 1. Runtime-only store zip and a one-page privacy note

Chrome Web Store and Firefox add-ons review the zip, not the git history. Loading this folder unpacked also loads prototypes, plans, diagnostics, and the lint plugin into the package the reviewer sees. Ship only:

- `manifest.json`
- `src/content.js`, `src/native-panels.js`, `src/zen.css`
- `popup/popup.html`, `popup/popup.css`, `popup/popup.js`, `popup/navigation.js`, `popup/preview.js`, `popup/preview-render.js`, `popup/preview.css`
- `icons/icon-16.png`, `icon-32.png`, `icon-48.png`, `icon-128.png`

Leave out `*.prototype.html`, `icons/icon-source.png`, `plans/`, `scripts/`, `tools/`, `LAG_*.md`, and `docs/`.

The privacy note the listing needs, in one screen: settings are stored with `chrome.storage.sync` (the browser may sync them to the viewer's account); the extension writes and sometimes deletes YouTube's `wide=1` cookie (see item 8); it does not send watch history, URLs, or settings to a server; it does not load remote code. `package.json` is `"private": true`, which is correct. Do not publish this package to npm.

### 2. Remove agent notes, home-directory paths, and bytecode from the public tree

These are safe to delete once nobody is using them as a handoff. They are not the product, and a public clone currently includes them:

- `LAG_ANALYSIS.md`, `LAG_HANDOFF.md`, `LAG_IMPLEMENTATION.md` — session ids, a home-directory skill path, and `/tmp` log paths.
- `plans/WORKFLOW.md`, `plans/FINAL-HANDOFF.md`, `plans/UNSLOP-REPORT.md`, `plans/001-improve-extension.md`, `plans/parent-usage-baseline.json`, `plans/parent-usage-comparison.json` — coordinator notes and token counters.
- `plans/modern-web-accessibility.md` — a general agent style guide, not extension docs.
- `tools/oxlint/anti-slop/UPSTREAM.md` and `scripts` comments that embed absolute paths under a home directory.
- `scripts/__pycache__/` — bytecode. This PR stops tracking it and ignores `*.pyc`.

`AGENTS.md` can stay if contributors use coding agents; it should point at the repo, not at `plans/WORKFLOW.md`, once those notes are gone. Popup prototypes (`popup/*.prototype.html`) are design scraps. Move them next to the plans or drop them so a store zip of `popup/` is not a second UI.

### 3. Do no Zen work on pages that are not a watch page

Content scripts match every `youtube.com` and `www.youtube.com` URL at `document_start`. `init` then binds, on the document, for the life of the tab:

- `mousemove` in the capture phase (`handleHoverReveal`)
- `wheel` with `{ capture: true, passive: false }` (`handleDrawerWheel`)
- six shortcut listeners (`keydown` / `keypress` / `keyup` on both `window` and `document`)

`handleDrawerWheel` returns immediately off a watch page, but a non-passive wheel listener still opts the page out of compositor scrolling. Home, search, and subscriptions pay that cost so a watch page can open a side card. Match `watch` and `live` only, or attach the wheel and mousemove listeners when `isWatchPage()` becomes true and remove them on leave. The early returns in the handlers are not a substitute.

### 4. One bounded DOM search instead of repeated shadow-tree walks

`deepQuerySelector` and `deepQuerySelectorAll` in `src/content.js` list every descendant and recurse into every open shadow root, once per selector. Chat close uses that path. Caps exist now (`MAX_LIVE_CHAT_LOOKUPS` 8, `MAX_LIVE_CHAT_CLICKS` 12, `MAX_LIVE_CHAT_LOOKUP_RESTARTS` 4), and drawer button text is written only when it changes, which breaks the idle mutation loop described in `LAG_ANALYSIS.md`. A miss still walks the tree. Live chat is the page where people already reported lag, and the extension was not the only thing in that tab, so the next change should be a single traversal with a cached root, then a trace. Do not add another observer.

`src/zen.css` has 504 `!important` declarations. That is the same problem in CSS: the extension is arguing with a page it does not control (principle 12). Fix layout bugs with a narrower rule when YouTube changes, not with another blanket override. Backdrop blur on open drawers is still the first thing to toggle off if a trace shows paint time.

### 5. Justify or drop the MAIN-world script and unused host permissions

`src/native-panels.js` is injected with `"world": "MAIN"`. It listens to clicks in the page's own JavaScript realm and calls YouTube's private `resolveCommand` on `ytd-watch-flexy`, then `preventDefault` / `stopImmediatePropagation`, with a 250 ms `click()` fallback. MAIN world cannot see `chrome.*`, which is the right boundary, and the page can rewrite the function. Store review treats MAIN-world code as something to justify in a sentence: "native engagement panels do not open from the player controls while Zen has forced theater; this script sends the page's own command and otherwise lets the click through."

`host_permissions` for YouTube are unused. Injection comes from `content_scripts.matches`. Nothing calls `chrome.scripting`, `chrome.cookies`, or `fetch`. Dropping the host permission does not shrink what the content script can read on YouTube, but it shortens the permission prompt and the review questionnaire. Do that in the same change as the store zip, and re-read the manifest before submitting. Do not add `web_accessible_resources`.

### 6. Cut the settings matrix until the default is the product

`DEFAULT_SETTINGS` has 24 keys, copied in `src/content.js` and `popup/popup.js`, with a second copy of `normalizeSettings`. Nullable `details*` and `playlist*` keys overlay older booleans so old installs do not get rewritten. That migration is careful. It is also several products: page vs card, scroll vs button vs hover vs scroll-hover, custom vs native drawer, same side vs opposite side, glass vs solid, `T` vs `Shift+T`.

The promise is one sentence (principle 10). New viewers should get viewport theater, hidden chat, hidden recommendations, hidden masthead, and ordinary scrolling to the description. Side cards are the power path, not a second default. Principle 9: a mode is a temporary state. This is the highest-value product change and the wrong one to fold into a hygiene pass. Decide the default in the product doc first; delete keys only when stored values still resolve.

### 7. Firefox listing from the same zip, plus a short smoke

The manifest is already MV3: `action`, `storage`, content scripts, no background page. Current Firefox accepts that shape. `"world": "MAIN"` needs Firefox 128 or newer, so a listing needs:

```json
"browser_specific_settings": {
  "gecko": {
    "id": "youtube-zen-theater@example",
    "strict_min_version": "128.0"
  }
}
```

Use a real id the owner controls, not `example`. `chrome.storage` and `chrome` as a namespace work in Firefox MV3; a polyfill is not required. Confirm once: theater cookie, chat close, and the popup on a watch URL. Package the same file list as Chrome. Do not fork `content.js`.

### 8. Make the `wide=1` cookie impossible to leave behind

`setWideCookie` writes `wide=1; domain=.youtube.com; path=/` the first time Zen applies, and `clearWideCookie` deletes it only when this document created it and a later `applyZen` turns Zen off. The flag is in memory. Disable the extension, crash the tab, or never return to `applyZen`, and YouTube's own theater default stays on. `domain=.youtube.com` also sends that cookie to other YouTube hosts the content script does not run on, including Music and Studio, if they read `wide`.

Prefer the theater button, which `forceNativeTheater` already clicks. If the cookie stays, clear a cookie this load created on `pagehide` as well as on Zen off. Do not clear a `wide=1` the viewer already had (`wideCookiePreexisted`). This is the daily viewer's YouTube, not a private preference of the extension (principle 11).

### 9. One settings schema; stop growing `content.js` as a single file

`src/content.js` is the feature, the migration, the observers, the shortcut, and the chat state machine. A contributor cannot change a default in one place. `AGENTS.md` forbids a bundler, so the shared module has to be a classic script both the content script and the popup can load, or a single `settings.js` imported only if the manifest is updated to `type: module` (test Firefox and Chrome before that). Split by behavior only after item 6 decides which keys survive. Splitting first just moves 24 keys into more files.

### 10. A browser smoke that can fail in CI, not only a Helium script

`bun run test` is a fake DOM. It is the right guard for the observer loop, popup writes, chat retry budget, and native-panel command shape. It cannot tell you that YouTube's player is the size of the viewport. `scripts/diagnose_zen_toggle_resize.py` is the real check and it is local: Playwright, a Helium binary path, an isolated profile, redacted errors, geometry only. That privacy bar is the one to keep.

A nightly job with Playwright's Chromium, one public watch URL, and the same geometry tolerance would remove the excuse "we did not reload Helium" (principle 14). Keep it off the pull-request path so YouTube outages do not block unrelated edits. Do not upload screenshots from passing runs.

## Hygiene done in this change

Safe items only. `src/content.js` and `popup/` are untouched.

- `LICENSE` — MIT for original source, with the vendored-plugin exception written down.
- `CONTRIBUTING.md` — install, `bun run check`, unpacked load, store zip contents, what not to commit.
- `.gitignore` — Python bytecode, virtualenvs, `.env`, logs, coverage, `*.pem`, `*.crx`. `diagnostics/`, `node_modules/`, and `*.zip` were already ignored. Tracked `scripts/__pycache__/` is removed.
- `.github/workflows/check.yml` — the existing lint, typecheck, and test job now requests `contents: read`, installs with `--frozen-lockfile`, times out at 15 minutes, and cancels superseded runs. It runs on pull requests and on pushes to `main`.
- `package.json` — `"license": "MIT"`. The package stays private.
- README — links to the license and the contributor guide.

## Not done, on purpose

- No edits under `src/content.js` or `popup/`.
- `LAG_*.md` and `plans/` are still in the tree. Item 2 is that deletion, and it should be its own commit after nothing still links to those notes.
- `icons/icon-source.png` stays. It is the master artwork. It should not be in the store zip. Replacing it in git history is a rewrite, not hygiene.
- Host permissions and the MAIN-world script stay until item 5 is reviewed against a live watch page.
- The anti-slop plugin stays. Replacing it means either confirming its license or deleting the vendored copy and depending on a published package. Lint config should not change in the same breath as the license file.

## Store checklist

Use this when cutting the first public build. None of it is a reason to widen permissions.

- Single purpose in the listing: distraction-free YouTube theater. The description already matches the manifest.
- Privacy disclosure from item 1. Data-use form: preferences in browser sync storage; no remote collection; the `wide` cookie is YouTube's, written from the page.
- Permission justification: `storage` for settings. Explain `host_permissions` or remove them (item 5). Explain `world: "MAIN"` or remove that script.
- No `eval`, no remotely hosted code, no `web_accessible_resources`.
- Icons at 16, 32, 48, and 128 are present. Do not upload `icon-source.png`.
- Firefox: gecko id, `strict_min_version` 128.0, same zip, one manual pass on a watch URL (item 7).
- Source zip for review can be the git tag. The runtime zip is the smaller file from item 1.
