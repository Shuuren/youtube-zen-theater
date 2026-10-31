# YouTube Zen Theater

Chrome MV3 extension for YouTube watch pages.

![YouTube Zen Theater in action](https://raw.githubusercontent.com/Shuuren/Shuuren/main/assets/youtube-zen-theater.jpg)

- Clicks YouTube's native live-chat close/hide button instead of removing chat with CSS.
- Forces YouTube's native theater mode by setting the `wide=1` cookie and clicking the theater button when needed.
- Hides YouTube's masthead/navigation on watch pages.
- Expands the theater player to fill the viewport so title, channel controls, comments, and recommendations require scrolling.
- Keeps YouTube's native ambient-mode setting and playback-control gradients. The full video remains visible without cropping or stretching.
- Reveals the hidden masthead when hovering the top edge.
- Scrolls naturally to the channel, actions, description, and comments by default.
- Optional side card: scroll down over the video to open details on the left or right. Further scrolling over the video scrolls the card. Inside the card, native scrolling is preserved. Close with Escape or its edge button.
- Choose **General → Playback → Start in** to open videos in Zen mode or native YouTube theater automatically. **Start automatically** enables or disables this behavior.
- Choose **Shortcut key → Shift+T** to preserve YouTube's native `T`; `Shift+T` toggles Zen. Existing users keep the `T` shortcut until they change it. Typing in inputs/comments is ignored.
- Popup settings use General, Distractions, and Appearance tabs. General gives details and playlists independent locations, sides, and opening methods. A compact interactive layout preview shows the result without changing settings; expand it to try scrolling and drawer buttons. Hover delay and shared-edge regions appear when relevant. Edge buttons remain available for every card. Appearance changes styling without moving content. Existing saved settings remain compatible.

Recommendations are hidden by default. Use **Distractions → Hide recommendations** to show them again. Hiding the list preserves the sidebar space and the native details width; playlist drawers move only the native playlist panel.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this extension folder.

## Notes

YouTube changes DOM selectors often. If chat stops collapsing, update `CHAT_CLOSE_SELECTORS` in `src/content.js`. The content script observes only the live-chat host/owner and an accessible iframe document when available; it uses bounded, semantic close-control retries.

## Development checks

Use Bun for the local checks:

```sh
bun install
bun run check
node --check src/content.js
node --check popup/popup.js
node --check popup/navigation.js
git diff --check
```

The direct-loaded runtime is JavaScript checked with TypeScript `checkJs` and Chrome types. The fake-DOM regression and diagnostic scripts are syntax-checked and run by `bun run test`; they are intentionally outside runtime `checkJs` because they model browser APIs.

## Isolated geometry diagnostic

The optional Python diagnostic needs Python 3, Playwright's synchronous API, and a Helium executable. It uses a temporary isolated profile and does not reuse personal browser data. Install the Python dependency, then run:

```sh
python3 -m pip install playwright
python3 scripts/diagnose_zen_toggle_resize.py \
  --helium /Applications/Helium.app/Contents/MacOS/Helium \
  --output-dir diagnostics/zen-toggle-resize
```

The command writes `diagnostics/zen-toggle-resize/report.json` on pass, failure, or a blocked prerequisite check. Reports contain only run status, minimal viewport/player geometry, and error text; screenshots are written only for failed geometry cycles.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Original source is under the [MIT License](LICENSE). The development check above is what CI runs.
