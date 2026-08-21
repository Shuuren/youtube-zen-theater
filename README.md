# YouTube Zen Theater

Chrome MV3 extension for YouTube watch pages.

![YouTube Zen Theater in action](https://raw.githubusercontent.com/Shuuren/Shuuren/main/assets/youtube-zen-theater.jpg)

- Clicks YouTube's native live-chat close/hide button instead of removing chat with CSS.
- Forces YouTube's native theater mode by setting the `wide=1` cookie and clicking the theater button when needed.
- Hides YouTube's masthead/navigation on watch pages.
- Expands the theater player to fill the viewport so title, channel controls, comments, and recommendations require scrolling.
- Reveals the hidden masthead when hovering the top edge.
- Reveals title, channel, and comments in a scrollable side panel from the left or right edge.
- Press `t` to toggle Zen Theater on or off. Typing in inputs/comments is ignored.
- Popup settings control auto Zen, live chat hiding, top bar hiding, hover reveals, side panel edge, recommendations, and the `t` shortcut.

## Install

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this extension folder.

## Notes

YouTube changes DOM selectors often. If chat stops collapsing, update `CHAT_CLOSE_SELECTORS` in `src/content.js`.
