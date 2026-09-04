# YouTube Zen Theater Product Document

## Purpose

YouTube Zen Theater is a Chrome Manifest V3 extension that turns YouTube watch and live pages into a focused theater-viewing experience. The product removes the usual surrounding YouTube chrome from the first viewport, makes the video feel like the primary surface, and keeps useful YouTube controls available through intentional reveal interactions.

The extension is not a separate video player. It works by steering YouTube's native page into theater mode, then applying a Zen layout on top of YouTube's existing DOM. It keeps YouTube-native controls, metadata, comments, playlist, and live-chat behavior whenever possible.

## Product One-Liner

A YouTube extension that automatically opens videos in a distraction-free viewport-filling theater layout, hides chat/navigation/recommendations, and reveals title, channel, comments, playlist, and navigation only when the user asks for them.

## Target User

- Users who watch YouTube on desktop and want the video to dominate the page.
- Users who want fewer recommendations, less navigation chrome, and less live-chat noise.
- Users who still need occasional access to title, channel actions, comments, playlist queue, search, account controls, and YouTube's native action buttons.
- Users who prefer reversible controls over permanent DOM removal.

## Core Product Principles

- Keep the video primary.
- Hide distractions by default.
- Reveal secondary surfaces only on edge hover or drawer button.
- Use YouTube's native controls instead of replacing core playback behavior.
- Preserve a fast, compact extension popup.
- Make every setting understandable without onboarding text.

## Browser Extension Shape

- Extension name: `YouTube Zen Theater`
- Manifest version: Chrome MV3
- Main content script: `src/content.js`
- Main content stylesheet: `src/zen.css`
- Popup UI: `popup/popup.html`, `popup/popup.css`, `popup/popup.js`
- Storage: `chrome.storage.sync`
- Host scope: `https://www.youtube.com/*` and `https://youtube.com/*`
- Permissions: `storage`

## Main Surfaces

### 1. YouTube Watch Page Zen Surface

This is the primary product surface. It runs on YouTube watch pages and live pages:

- `/watch...`
- `/live/...`

When Zen mode is active, the extension adds state classes to the document root and uses CSS to reshape the YouTube page.

Expected active state:

- Page background becomes black.
- Browser scrollbars are visually hidden.
- YouTube is forced into native theater mode.
- The YouTube player fills the viewport width and height.
- Title, channel row, actions, description, comments, and other below-player content move into a revealable side panel.
- Recommendations are hidden by default when the setting is enabled.
- Masthead, search, guide, profile controls, and navigation are hidden by default when the setting is enabled.
- Cinematic backdrop elements are suppressed.
- Live chat is closed through YouTube's native close/hide control when possible.

### 2. Extension Popup / Popover

The browser-action popup is the settings control surface. It is a compact dark panel, 372px wide, organized into grouped controls.

The popup is not a marketing page and should not contain onboarding copy. It should feel like a quiet utility control panel.

### 3. Reveal Drawers / Hover Panels

On the YouTube page, hidden surfaces can reappear in two modes:

- Drawer mode: small edge buttons open or close panels.
- Hover mode: invisible edge zones reveal panels when the pointer rests near the edge.

The reveal system supports:

- Top hover reveal for YouTube masthead.
- Details reveal for title, channel, actions, description, comments, and below-player content.
- Playlist reveal for playlist queue/panel when the current video has playlist context.

## Feature Inventory

### Auto Zen

Default: on.

When enabled, videos automatically enter Zen mode on YouTube watch/live pages. On navigation within YouTube's single-page app, Zen is reapplied after YouTube finishes loading the new page.

When disabled, Zen mode does not auto-activate. If disabled while active, the content script turns Zen off unless the user later toggles it manually.

### T Shortcut

Default: on.

Pressing `t` toggles Zen mode on or off, similar in spirit to YouTube's theater shortcut. The extension captures `keydown`, `keypress`, and `keyup` to keep the toggle reliable.

Shortcut safety:

- Ignored inside inputs, textareas, selects, and contenteditable fields.
- Ignored when meta, ctrl, or alt are pressed.
- Debounced to avoid repeated toggles.

### Live Chat

Default: on.

When enabled, the extension closes or hides live chat using YouTube's own close/hide controls. It does not just cover chat with CSS.

Behavior:

- Searches multiple YouTube chat button selectors.
- Falls back to button text such as "hide chat" or "close chat".
- Also runs inside YouTube live-chat frame pages.
- Retries a limited number of times because YouTube loads chat asynchronously.

### Top Bar

Default: on.

Hides the YouTube masthead and navigation surfaces:

- Masthead/search/profile area.
- App drawer/guide.
- Related navigation containers associated with the top bar.

When paired with Top Hover, the top bar can temporarily reappear by moving the pointer to the top edge.

### Recommendations

Default: on.

Hides YouTube's recommendation and secondary results surfaces so the watch page keeps focus on the video and below-video content.

Important nuance:

- If a playlist panel exists and playlist reveal is enabled, the secondary column can still be used as the playlist reveal panel.
- The intent is to hide recommendations, not to destroy playlist functionality.

### Top Hover

Default: on.

When Top Bar is hidden, moving the cursor to the top edge reveals YouTube's masthead. Moving away hides it again.

Visual intent:

- The top bar should feel temporarily summoned.
- It should not permanently push down or resize the main video experience.

### Side Details

Default: on.

Controls whether title, channel, actions, description, and comments can be revealed from a side panel.

The panel content comes from YouTube's native below-player region (`#below`) rather than a custom rebuilt details view.

Expected contents:

- Video title.
- Channel/owner row.
- Subscribe button.
- Like/share/action buttons.
- Description.
- Comments and related below-video content.

### Playlist

Default: on.

Controls whether playlist queue/panel can be revealed when the current page has playlist context.

Playlist context is detected by:

- A `list` URL parameter.
- An existing YouTube playlist panel in the secondary column.

When needed, the extension attempts to open YouTube's playlist panel by clicking the native panel toggle.

### Open Style

Default: `Drawer`.

Options:

- `Drawer`: show explicit edge drawer buttons for details and playlist panels.
- `Hover`: reveal details and playlist panels from hover zones at the screen edges.

Drawer mode is more deliberate and easier to discover. Hover mode is more minimal and keeps controls visually hidden.

### Drawer Build

Default: `Zen`.

Options:

- `Zen`: custom Zen-styled drawer treatment, including custom positioning, blur/solid appearance, rounded corners, dark panel styling, and styled native YouTube controls.
- `Native`: uses a more native YouTube surface for the drawer behavior.

The product should prioritize the Zen custom style for the intended redesigned experience.

### Liquid Glass

Default: on.

Controls the drawer visual treatment in custom Zen mode.

When enabled:

- Drawers use a transparent, blurred, glass-like dark surface.
- The panel should feel layered over the video rather than like a separate page column.

When disabled:

- Custom drawer surfaces use a more solid dark treatment.

### Advanced Reveal Tuning

Advanced controls live inside a collapsed `<details>` section called "Advanced reveal tuning".

These controls exist for precise layout behavior, not for first-time setup.

#### Panel Sides

Default: `Separate`.

Options:

- `Separate`: details panel appears on one side; playlist appears on the opposite side.
- `Same side`: both panels use the same side and divide the hover area vertically.

#### Details Side / Shared Side

Default: `Right`.

Options:

- `Right`
- `Left`

Label changes based on Panel Sides:

- In `Separate` mode: label is "Details side"; help text says playlist uses the opposite side.
- In `Same side` mode: label is "Shared side"; help text says both panels use this side.

#### Same-Side Split

Default: `Playlist top`.

Only visible when Panel Sides is `Same side`.

Options:

- `Playlist top`: top half of the side hover region opens playlist; bottom half opens details.
- `Details top`: top half opens details; bottom half opens playlist.

#### Hover Delay

Default: `140ms`.

Range:

- Minimum: `0ms`
- Maximum: `1000ms`
- Step: `20ms`

Controls how long the pointer must rest in a side hover zone before the panel opens. The popup displays the current value as an inline `ms` output.

## Popup Design Specification

### Overall Layout

- Popup width: 372px.
- Background: near-black `#0a0a0a`.
- Text: off-white `#f7f7f7`.
- Font: Inter first, then system sans-serif stack.
- Body has no margin.
- Main panel padding: 14px.
- All corners are restrained, usually 8px.
- Visual style: compact, dark, utilitarian, and YouTube-adjacent without copying YouTube exactly.

### Header

The top header contains:

- A 42px square icon mark.
- Product name: `YouTube Zen`.
- Subtitle: `Fullscreen theater controls`.

Icon mark:

- 42px by 42px.
- 8px radius.
- Border `#2d2d2d`.
- Dark diagonal gradient from `#181818` to `#080808`.
- Inline SVG resembling a YouTube/video screen.
- Main stroke is off-white.
- Play triangle uses accent red `#ff304f`.

Header spacing:

- Flex row.
- 12px gap.
- Padding: `4px 2px 14px`.

### Section Grouping

Settings are grouped into fieldsets:

- Playback
- Content
- Reveal
- Appearance

Each group has:

- Uppercase legend.
- 11px font size.
- Bold weight around 750.
- Slight positive letter spacing.
- Muted text color `#d6d6d6`.
- 7px row gap inside groups.
- 14px gap between groups.

### Setting Rows

Each setting row is a horizontal control row:

- Left side: label and helper text.
- Right side: checkbox, select, or range input.
- Minimum height: 50px.
- Padding: `9px 11px`.
- Border: `1px solid #252525`.
- Radius: 8px.
- Background: `#111`.
- Gap between text and control: 14px.

Compact advanced rows:

- Minimum height: 44px.
- Padding: `8px 10px`.
- Background: `#151515`.

Label typography:

- Main label: 13px, weight 650, off-white.
- Helper text: 11px, muted gray `#9ca3af`, 2px top margin.

### Checkboxes

Checkboxes are styled as toggles:

- Size: 38px by 22px.
- Rounded pill.
- Off background: `#1c1c1c`.
- Off border: `#343434`.
- On background: accent red `#ff304f`.
- On border: accent red `#ff304f`.
- Knob: 16px white circle.
- Knob offset: 2px.
- Checked knob translates 16px.
- Transition: 140ms ease for background, border, and knob transform.

### Select Controls

Selects:

- Minimum width: 88px.
- Height: 32px.
- Padding: `0 28px 0 10px`.
- Border: `1px solid #343434`.
- Radius: 8px.
- Background: `#1c1c1c`.
- Text: `#f7f7f7`.
- Font inherits popup font.

### Range Control

Hover delay range:

- Width: 132px.
- Accent color: `#ff304f`.
- Displays current value in helper text as `${value}ms`.

### Advanced Section

Advanced reveal tuning is a native details/summary block:

- Border: `1px solid #252525`.
- Radius: 8px.
- Background: `#101010`.
- Summary min-height: 42px.
- Summary padding: 11px.
- Summary text color: `#e8e8e8`.
- Summary weight: 650.
- Advanced grid padding: `0 7px 7px`.
- Advanced grid gap: 7px.

## Popup Information Architecture

Recommended order must stay:

1. Header
2. Playback
3. Content
4. Reveal
5. Appearance

Detailed control order:

Playback:

1. Auto Zen
2. T shortcut

Content:

1. Live chat
2. Top bar
3. Recommendations

Reveal:

1. Top hover
2. Side details
3. Playlist
4. Open style
5. Advanced reveal tuning

Appearance:

1. Drawer build
2. Liquid glass

## Settings Data Model

All settings are stored in `chrome.storage.sync`.

Current defaults:

```json
{
  "autoZen": true,
  "hideLiveChat": true,
  "hideHeader": true,
  "hideRecommendations": true,
  "revealHeaderOnHover": true,
  "revealMetaOnHover": true,
  "revealPlaylistOnHover": true,
  "sideRevealMode": "drawer",
  "drawerImplementation": "custom",
  "revealSideLayout": "separate",
  "sideHoverPosition": "right",
  "sameSideSplit": "playlist-top",
  "hoverRevealDelay": 140,
  "drawerGlassEffect": true,
  "shortcutEnabled": true
}
```

The content script also has legacy/internal defaults for:

```json
{
  "playlistHoverPosition": "left",
  "metaHoverZone": "bottom",
  "playlistHoverZone": "top"
}
```

These are not exposed in the current popup UI and should not be treated as first-class recreated controls unless the product is intentionally expanded.

## Setting-To-Behavior Mapping

| Setting | UI control | Default | Behavior |
| --- | --- | --- | --- |
| `autoZen` | Checkbox | On | Automatically activates Zen on watch/live pages. |
| `shortcutEnabled` | Checkbox | On | Enables `t` keyboard toggle outside editable fields. |
| `hideLiveChat` | Checkbox | On | Clicks YouTube native chat close/hide controls. |
| `hideHeader` | Checkbox | On | Hides masthead, guide, and top navigation surfaces. |
| `hideRecommendations` | Checkbox | On | Hides recommendations/secondary results while preserving playlist reveal when needed. |
| `revealHeaderOnHover` | Checkbox | On | Allows masthead to reappear from top edge hover. |
| `revealMetaOnHover` | Checkbox | On | Allows below-video details/comments panel reveal. |
| `revealPlaylistOnHover` | Checkbox | On | Allows playlist panel reveal when playlist context exists. |
| `sideRevealMode` | Select | `drawer` | Chooses drawer buttons or hover-edge reveal. |
| `drawerImplementation` | Select | `custom` | Chooses Zen custom drawer or native YouTube surface. |
| `drawerGlassEffect` | Checkbox | On | Uses transparent blur glass for custom drawers. |
| `revealSideLayout` | Select | `separate` | Chooses opposite-side panels or shared-side panels. |
| `sideHoverPosition` | Select | `right` | Chooses details side or shared side. |
| `sameSideSplit` | Select | `playlist-top` | Chooses which panel uses the top half when both panels share a side. |
| `hoverRevealDelay` | Range | `140` | Delay in ms before side hover reveal opens. |

## YouTube Page Interaction Model

### Activation

Zen activates when:

- The page path matches watch/live patterns.
- `zenEnabled` is true.
- `autoZen` sets `zenEnabled` true on page load/navigation, or the user toggles it with `t`.

On activation, the content script:

1. Adds root classes for active watch-page state.
2. Writes YouTube `wide=1` cookie.
3. Clicks the native theater mode button if YouTube is not already in theater.
4. Removes cinematic backdrop/minimized-player state.
5. Closes live chat if enabled.
6. Creates hover zones or drawer buttons based on settings.

### Deactivation

Zen deactivates when:

- User toggles `t` while active.
- Auto Zen is disabled through storage changes.
- Page is not a watch/live page.

On deactivation:

- Reveal classes are removed.
- Hover timers are cleared.
- Side panel scroll positions are reset.
- Chat close state resets for future pages.

### Navigation Handling

YouTube is a single-page app, so the content script listens for:

- `yt-navigate-finish`
- `yt-page-data-fetched`
- `yt-page-data-updated`
- `yt-navigate-cache-restored`
- `ytd-player-updated`
- `popstate`
- `visibilitychange`
- MutationObserver changes on theater/collapsed/hidden attributes

The design implication is that the UI should tolerate delayed application and brief YouTube DOM changes.

## Reveal Behavior Details

### Top Bar Reveal

When enabled:

- A top hover zone exists.
- Moving within about the top 22px reveals the header.
- While open, the active top region extends to about 96px.

### Side Hover Reveal

When `Open style` is `Hover`:

- Invisible edge hover zones are created.
- Details and playlist panels reveal after the configured delay.
- Closed edge detection starts around 28px from the edge.
- Open panel detection extends to about 460px.
- Header reveal affects vertical safety spacing at the top.
- Bottom safety spacing is about 96px.

When one panel opens, the other panel closes to avoid overlap.

### Drawer Button Reveal

When `Open style` is `Drawer`:

- Details drawer button is created if Side details is enabled.
- Playlist drawer button is created if Playlist is enabled and playlist context exists.
- Buttons are native `<button>` elements appended to the document root.
- Details button ARIA label alternates between "Show video details" and "Hide video details".
- Playlist button ARIA label alternates between "Show playlist" and "Hide playlist".
- Button text uses chevrons:
  - `‹`
  - `›`

When one drawer opens, the other drawer closes.

## Drawer / Panel Visual Intent

### Details Drawer

The details drawer should feel like a refined side sheet over the video.

Expected custom Zen treatment:

- Fixed-position side panel.
- Dark translucent or solid background depending on Liquid Glass.
- Blur when glass is enabled.
- Rounded outer corners.
- Scrollable content.
- High contrast white text.
- YouTube-native controls restyled enough to fit a dark drawer.
- Like/share/subscribe buttons remain functional.

### Playlist Drawer

The playlist drawer should reveal YouTube's native playlist queue in a Zen-styled panel.

Expected custom Zen treatment:

- Similar side-sheet behavior to details drawer.
- Uses YouTube playlist renderer from secondary column.
- Playlist item text remains readable.
- Selected and hovered playlist items receive visible dark highlight.
- Close buttons in the native playlist header are hidden because the Zen drawer controls visibility.

### Native Drawer Mode

Native mode should preserve more of YouTube's built-in secondary/below layout. It is a compatibility option, not the primary design direction.

## Accessibility Expectations

- Popup controls use native inputs, selects, fieldsets, legends, labels, and details/summary.
- Drawer buttons are real buttons with `aria-label` and `aria-expanded`.
- Hidden hover zones are `aria-hidden`.
- Focus-visible outlines are high contrast.
- Keyboard shortcut avoids editable fields.
- Recreated design should keep native semantics wherever possible.

## Copy Reference

Popup header:

- Product name: `YouTube Zen`
- Subtitle: `Fullscreen theater controls`

Playback:

- `Auto Zen` - `Apply automatically on videos`
- `T shortcut` - `Toggle Zen like theater mode`

Content:

- `Live chat` - `Click YouTube's native close control`
- `Top bar` - `Remove search, profile, and nav`
- `Recommendations` - `Keep only video and below content`

Reveal:

- `Top hover` - `Show top bar at the upper edge`
- `Side details` - `Show title, channel, and comments`
- `Playlist` - `Show queue and playlist panel`
- `Open style` - `Choose hover edge or drawer button`
- `Advanced reveal tuning`
- `Panel sides` - `Use one edge or both edges`
- `Details side` - `Playlist uses the opposite side`
- `Shared side` - `Both panels use this side`
- `Same-side split` - `Choose the top hover half`
- `Hover delay` - current value as `140ms`

Appearance:

- `Drawer build` - `Use Zen drawer or YouTube surface`
- `Liquid glass` - `Transparent blur effect`

Select option labels:

- Open style: `Drawer`, `Hover`
- Drawer build: `Zen`, `Native`
- Panel sides: `Separate`, `Same side`
- Details/shared side: `Right`, `Left`
- Same-side split: `Playlist top`, `Details top`

## Non-Goals

- Do not build a new video player.
- Do not replace YouTube's playback controls.
- Do not permanently remove YouTube content from the DOM when a native hide/close interaction is available.
- Do not turn the popup into a landing page.
- Do not add onboarding, tutorials, or long explanatory text inside the popup.
- Do not expose every internal CSS/DOM implementation setting as a user-facing control.

## Recreate-The-Design Brief For Another AI

Build a compact Chrome extension popup for a product called YouTube Zen. The popup is a 372px dark utility panel for controlling a distraction-free YouTube theater mode. Use grouped native controls, not marketing sections.

The visual language is:

- Near-black background.
- Off-white labels.
- Muted gray helper text.
- YouTube-red accent `#ff304f`.
- Small 8px radii.
- Dense but readable settings rows.
- Native-feeling toggles, selects, and range controls.
- No decorative gradients except the small header icon mark.
- No large hero, no cards inside cards, no illustrations beyond the compact mark.

The popup must include:

- Header with video-screen icon, `YouTube Zen`, and `Fullscreen theater controls`.
- Playback group with Auto Zen and T shortcut toggles.
- Content group with Live chat, Top bar, and Recommendations toggles.
- Reveal group with Top hover, Side details, Playlist toggles, Open style select, and Advanced reveal tuning details panel.
- Appearance group with Drawer build select and Liquid glass toggle.

The YouTube page experience to support:

- Video fills the viewport in native YouTube theater mode.
- Top navigation is hidden but revealable from top hover.
- Details/comments are hidden in a side drawer or hover panel.
- Playlist is hidden in a side drawer or hover panel when playlist context exists.
- Recommendations are hidden.
- Live chat closes using native YouTube controls.
- `t` toggles the whole Zen mode.

## Implementation Notes For Recreation

- Persist settings in browser sync storage.
- Popup should initialize from defaults merged with stored settings.
- Every control writes only its changed key to storage.
- Content script listens to storage changes and reapplies immediately.
- Use document-root classes as the bridge between settings state and CSS.
- Prefer native controls and native YouTube surfaces over rebuilt replicas.
- Build drawer/hover controls outside YouTube's main DOM as root-level overlay elements.
- Normalize invalid setting values before applying layout.
- Reapply layout after YouTube SPA navigation events.

## Source Reference

Current implementation is defined by:

- `manifest.json`
- `README.md`
- `popup/popup.html`
- `popup/popup.css`
- `popup/popup.js`
- `src/content.js`
- `src/zen.css`
