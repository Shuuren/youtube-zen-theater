# Native YouTube audit, 2026-10-29

Scope: native-first theater/fullscreen investigation. No production changes.

## Evidence boundaries

Helium computer use inspected Raycast video https://www.youtube.com/watch?v=2j1x68LOic4 with installed extensions. Native fullscreen exposed title, like/dislike, Comments, Share, Ask, More actions, seek/chapters, captions, settings and exit fullscreen. Opening Comments changed its toggle to active and moved accessibility focus to Comments 15, with Sort comments and Close controls. The drawer did not appear in the captured image. This is an observed failure in the installed environment, not proof of a YouTube bug or a conclusively isolated CSS cause. Other installed extensions include SocialFocus and StopTheMadness.

User's three screenshots independently show native fullscreen comments, queue and live chat. Queue/chat/playlist interaction parity has not yet been exercised in a clean native session. Screenshot dimensions are examples, not responsive layout constants.

## Native behavior visible in supplied screenshots

- Title occupies upper left of the remaining player region. Queue/playlist entry is at its upper right when available.
- Right drawer reserves width. Video remains contained and centered in the remaining region, with letterboxing. It is not covered by a floating extension card.
- Player timeline and playback controls use the remaining player width. Like/dislike, comments, share and contextual actions sit above the timeline toward the right.
- Comments has its own count, sorting and close header; comment body scrolls; composer remains at the bottom. Native replies, menus and reactions remain native.
- Queue has position/total, Save, Clear, active-item highlighting, thumbnails, durations and channel names. Closing its presentation must not be confused with clearing its contents.
- Live chat is a distinct panel, with Top chat selector, menu, close, messages, pinned content and composer/actions. It is not the video's ordinary comments.
- Comments screenshot uses an inset rounded panel. Queue/chat screenshots use an edge-aligned panel. Do not assume every panel shares identical spacing.

## Current extension gaps

Source audit references refer to current working tree.

- src/zen.css:81 forces all player wrappers to 100vw; height rules force 100dvh. Native drawer-aware sizing must take priority.
- src/content.js:507 and :558 force theater. This does not enable native fullscreen engagement UI.
- src/zen.css:126 presents native #below as a fixed 460px details overlay, combining metadata/comments. Comment overrides continue through :665.
- src/content.js:731 creates custom playlist entry; :797 controls extension panel classes. src/zen.css:798 imposes playlist overlay presentation and :907 hides native close/collapse controls.
- src/content.js:1275 finds playlist only under theater #secondary; no separate native fullscreen queue integration exists.
- src/content.js:1292 expands collapsed playlists automatically, potentially fighting native close/collapse state.
- src/content.js:1352 and :1751 observe and close live chat when hideLiveChat is enabled. Chat is native, not recreated.
- src/content.js:764–1249 owns hover, pin, wheel, Escape, focus and mutual exclusion. Those handlers must yield when native panels own interaction.
- No native fullscreen title/action-row integration exists. Raising popup z-index at src/zen.css:959 is insufficient for layout/state integration.

## Recommended direction

1. Make actual fullscreen fully native first. Yield layout, panel state, close controls, focus and keyboard handling to YouTube. Suppress extension cards/triggers while actual fullscreen is active.
2. Prove whether YouTube can render its real fullscreen title/actions/engagement panels in windowed theater. Do not fake fullscreen with CSS classes: player state, browser fullscreen state and engagement-panel state can diverge.
3. If native windowed activation is unavailable, reuse actual native title/action/content elements with minimal reversible layout adaptation. Keep YouTube handlers and state; avoid cloned buttons, copied counts or custom queue/chat data.
4. Preserve stored settings during migration. Custom left/right positioning and hover/pinning are optional deviations from YouTube's native right-drawer model, not native parity.

## Additional nativeness opportunities and validation backlog

- Title click behavior: native description/details opening, channel/subscription links and metadata.
- Chapters and transcript engagement panels, timestamp seeking, current chapter selection and panel replacement.
- Share dialog including timestamp option, Save menus, overflow actions and account-dependent Ask. Retain contextual availability rather than hardcoding a button list.
- Queue versus saved playlist versus Mix/Watch later; active-item autoscroll, next/previous, shuffle/repeat, reorder/remove, save/clear and route transitions.
- Chat replay versus live chat; Top/Live chat, popout, hidden/disabled chat and stream-ended transitions. Preserve iframe identity to avoid reconnecting/resetting chat.
- Native controls auto-hide, pointer/focus behavior, paused playback, menus, subtitles, seek previews and end screens.
- Escape ordering, focus return, tab order and typing in composers without triggering player/Zen shortcuts. Current T shortcut conflicts with native theater shortcut.
- Preserve native aspect ratio and ambient appearance across wide, portrait and narrow windows; panel width and responsive behavior need live measurement.
- Navigation/back/forward, autoplay and queue advancement must preserve the appropriate native panel without stale extension state.
- Isolate CSS failure against Zen disabled and other extensions before claiming its cause. Installed source version has not been established against this dirty working tree.

No claim of exhaustive native parity or completed clean-browser testing. No runtime changes, tests, commits or releases.

## Implementation and live follow-up

- Native fullscreen ownership implemented in src/content.js. fullscreenchange immediately reapplies layout; Zen is suspended while a fullscreen element exists, preserving its enabled preference for exit. Theater forcing, hover/navigation helpers, chat observers/retries and T/Escape interception yield in fullscreen.
- Added fake-DOM fullscreen enter/exit regression covering layout class removal/restoration and native shortcut ownership. bun run check passes. Existing nonfatal vendored-plugin module-type warning remains.
- Helium extension details verified source is ~/Projects/youtube-zen-mode-extension. Reloaded extension and navigated back to Raycast. With updated extension active, native fullscreen Comments opened visibly, video used remaining width, and native composer stayed at bottom. This supersedes the earlier visually absent drawer finding for this scenario.
- Overall 1:1 has NOT been achieved. Windowed theater still uses existing custom presentation. Queue/playlist/live-chat and chapter/transcript transitions have not received a complete live parity pass. No native windowed fullscreen-UI activation mechanism has been established. These remain open work, not unsupported-platform conclusions.
