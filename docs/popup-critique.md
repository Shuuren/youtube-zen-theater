# Popup critique

Reviewed 2026-10-31 with Interface Craft’s design-critique method. The subject is the production browser-action popup after the local working tree was synced: `popup/popup.html`, `popup/popup.css`, `popup/preview.css`, and the rendered panel at 372×600. Storage was stubbed so the default settings could paint. Screenshots: `docs/popup-screenshots/before-general.png`, `before-distractions.png`, `before-appearance.png`, `before-cards.png`, `before-expanded.png`. After the Unhook filters landed, the same rows were one “Across YouTube” list inside a nested scroller (`before-unhook-distractions.png`); the first Distractions view did not show them. The redesigned panel is `after-default.png`, `after-watch.png`, `after-browse.png`, `after-playback.png`, `after-cards.png`, `after-expanded.png`, and `after-header.png`.

## Context

This is the settings popover for a YouTube theater extension. Someone opens it from the toolbar, usually with a video already playing, changes one behavior, and goes back to the page. The task is casual and short. The emotional context is “get this out of my way,” not “configure a system.”

The popup also has to absorb a second job that is about to arrive: grouped hide switches in the Unhook sense (home feed, recommendations, comments, shorts, end screens, mixes, merch, header, search, autoplay). That list is long. The person opening the popup still has a video waiting.

## First Impressions

The panel is a dark settings form wearing a video costume. A boxed icon, a preview card, three tabs, and a stack of identical bordered rows all compete at the same size. The first screen answers neither “what is hidden?” nor “where does the video’s furniture sit?” It shows two location menus and then runs out of room. The rest of General is a 618px list inside a 202px scroller. Appearance is the same chrome with a void underneath. Distractions cuts a switch in half.

## Visual Design

**Four surfaces before a decision** — The page is `#0a0a0a`. The preview is a `#111` card with a 19px radius. Inside it, the scene is another inset rectangle. Each setting is a third card, `#111` with a `#252525` border and an 8px radius, and the select sits in a fourth fill, `#1c1c1c`, with its own border. The eye reads chrome, then chrome, then chrome, then a value. One sheet per decision, with rows separated by a hairline, would make the choice the content.

**Accent used as decoration** — `#ff304f` fills the header play triangle, the sample progress bar, the selected tab underline, every on-switch, and the range. On the Distractions screen that is four red objects, and only the switches mean “on.” The tab underline and the icon do not. Red should be the on-state. The sample progress can keep it, because that rectangle is a picture of YouTube, not a control.

**Five type sizes in five pixels** — The title is 15px, row labels 13px, the subtitle and tab labels 12px, legends and help 11px, the status line 10px. Weight jumps between 650 and 750, which both render as bold. Nothing is clearly the title, the section, or the aside. Three roles are enough: a 15px title, 13px controls, 12px secondary text.

**Every row has the same weight** — “Location” and “Reveal on top hover” are the same bordered card, the same bold label, the same height. Dependent choices (side, trigger, hover reveal) do not look dependent. They look like more peers. Indent the follower and drop the extra box.

**Uppercase legends as a second title** — `VIDEO DETAILS`, `PLAYLIST`, `NAVIGATION`, `OTHER CONTENT`, and `CARD STYLING` are 11px, tracked, uppercase, and bold. They shout at the same volume as the product name. Sentence-case sheet titles, with a quieter section label above the group, would restore a scale.

**Locked frame, empty floor** — `body` and `.panel` are hard-coded to 600px. Appearance’s content ends after two controls and a two-line note. “Settings loaded.” is pinned to the bottom of the flex column, so the lower half of that tab is blank black. The popup should be as tall as its content, and stop at 600px only when there is more to scroll.

**Clipped control** — Distractions’ settings scroller is 202px tall and holds 295px of rows. The recommendations switch is cut by the mask. Live chat, the fourth distraction, is not in the first view at all. A hidden setting that the mask eats is a visual bug, not a scroll affordance. There is no fade, no “more” cue, and the status line sits on the cut.

**Preview radius versus control radius** — The preview shell is 19px, its scene is 8px, the rows are 8px, the header mark is 8px. The concentric 19px was a local fix for the preview’s padding. Next to the 8px rows it reads as a different component from a different pass.

## Interface Design

**No place to start** — Header, preview toolbar (“Try your layout”), scene, two-line summary, tabs, and the first fieldset are all above the fold and all fully saturated. The summary repeats the menus that sit under it: “Details · below video” over a menu that already says “Below video.” The preview’s own heading repeats the popup’s job. We’re missing an opportunity to give the frame one job — show the result — and let the first sheets be the editing.

**The frame does not show the default** — Default details live below the video. The compact scene is 120px and the sample video is also 120px, so the frame is only the player, plus a “Playlist” chip on the left edge. The thing the form claims is below the video is not visible until Scroll or Expand. Expand then steals the settings: the settings viewport drops from 202px to 82px, which is one row and a clipped border. Trying the layout hides the layout controls.

**Tabs split one watching task** — General, Distractions, and Appearance are equal destinations. Placement of the playlist is on General. Hiding recommendations is on Distractions. How the card is drawn is on Appearance. Card side and trigger only appear after a location change, and on the card screenshot they push playlist, hover, and playback out of a 918px list. The person who came to “put the playlist on the right and hide the end screen” has to change tabs and then scroll. We’re missing an opportunity to keep the spatial decision on screen and treat hiding as a grouped index, not a second app.

**Progressive disclosure runs backwards** — The rare control (accented shadow) gets a full tab. The common controls (where details are, what is hidden, whether Zen starts on its own) share a tab that cannot show them. Playback — start automatically, startup mode, shortcut — is below the fold on General. A first-time opener never sees that the extension starts by itself.

**“Other content” is a junk drawer** — Recommendations and live chat are not a category. They are two different places on the watch page. Unhook’s popup already shows the shape of what is coming: home feed, sidebar (recommended, chat, playlist, fundraiser), end screens, shorts, comments, mixes, merch, video info, header, search, subscriptions, autoplay. Dropped into “Other content” as more identical rows, that is a wall. Dropped in as another tab, the person still cannot see the group until they guess the tab name. We’re missing an opportunity to group hides by the surface they affect, collapse each group to a count, and let a new hide be another row inside an existing group.

**System chatter** — “Settings loaded.” sits under every tab. It reports that the popup finished opening. The failure string “Could not save settings.” does not name the setting. The success path can stay quiet; the failure path is the one that needs a sentence.

**Repeated instructions** — Card mode adds “The drawer button is always available.” under both Video details and Playlist. One line under the trigger that is actually a card is enough, and only then.

## Consistency & Conventions

**Same control, three costumes** — A choice is sometimes a bordered select at the right of a card, sometimes a red switch, sometimes a tab. Tabs use a red underline; nothing else in the popup uses an underline. The select is a native control styled to look like a button inside a button. Borderless value text, with the label on the left, matches the way a settings list is read and still uses the native menu.

**Dependent rows are not dependent in the layout** — “Reveal on top hover” is a full card under “Hide top bar,” with helper text admitting it only applies while the bar is hidden. When the bar is shown, the row is still there. Side, trigger, hover delay, and the shared-edge split do hide when they do not apply. The header pair should follow that same rule. The follower should sit in the same sheet, indented, not as a sibling card.

**Keyboard tabs are real; the information architecture they move through is not** — Arrow keys, Home, and End move among General, Distractions, and Appearance, and inactive panels are `hidden`. That is the right implementation of a tablist. The tablist is the wrong object. These are not three modes. They are one page with a few sections. Sections as disclosures match the platform convention for “more in this group” and still take arrow keys between their summaries.

**The preview is a second product** — Scroll and Expand are buttons with their own borders, separate from the setting rows. Edge chips inside the scene (“Playlist ›”) are another button style, 10px type on a translucent gray. Three button shapes in one column. The scene’s edge controls can stay, because they depict the player. Scroll and Expand should look like utilities of that scene, not a toolbar heading.

## User Context

The person is mid-video. They feel interrupted already, which is why they installed something that hides YouTube’s chrome. This popup adds a second chrome: a fake app icon, a toy player, a tab bar, and a footer that says the settings loaded. The 600px frame is the height of a phone screen for a decision that should be a few rows.

What would feel like care here is a popover that opens on the layout, tells them in one line what is currently hidden, and keeps the next fifteen hide switches one group-open away instead of one more tab and one more scroll. The sample frame should peek at the page under the video, so “below the video” is visible without expanding. Expanding should lengthen the popover, not erase the settings.

## Top Opportunities

1. Make layout the first and always-visible task, and turn distractions into named groups that collapse to a count, so the Unhook-sized list adds rows inside a group instead of another tab or a wall.
2. Let the popover be as short as its content and scroll only past 600px, so Appearance is not a void and Distractions does not cut a switch in half.
3. Replace the card-per-row stack with one sheet per decision, and show side, trigger, hover, and “reveal on hover” only when they do something.
4. Spend red on the on-state alone, and make the sample a captioned frame rather than a second header plus a summary that repeats the menus.
5. Drop “Settings loaded.” The idle popover does not need a status line.

---

## Information architecture

The critique stops above. This section is the product decision that follows it, using the product-thinking principles on a popup that already exists. It is not a new product bet. The evidence is the current Zen popup and Unhook 1.6.9’s hide list.

**The one good idea.** The video is the room. Details and the playlist are furniture you place; everything else can stay outside.

**Why this shape, not a better checklist.** Unhook is the workaround people already use: one long list of hide switches, some nested under a disclosure triangle (principle 1). Zen’s reason to exist beside that list is spatial — where the details and the playlist sit — not another coat of paint on the same toggles (principle 2). The popup’s job is to reach that spatial idea immediately (principle 6) and to absorb the hide list as one mechanism, groups by surface, rather than one row per competitor feature (principle 7).

**What the novice sees, and what stays out of the way (principle 9).** Layout is open: two sheets, Video details and Playlist. Quiet, Playback, and Look are an index. Each Quiet group collapses to a name and a count. Playback and Look collapse to the current choice (“Starts in Zen · T”, “Zen surface · Accented shadow”). No new mode and no master switch. Defaults stay the quiet theater. Power is one disclosure down, which is also where hover delay, shared-edge split, shortcut key, and card styling live.

**The extremes (principle 10).** One end is a single “Zen” switch and no explanation. The other end is Unhook’s wall, every hide visible at once. The promise is “the video stays the room,” so the spatial choice stays on screen and the wall is replaced by an index of groups. The right amount of hiding is the group, not the individual switch and not the whole product.

**Real content, not the tidy comp (principle 12).** Rows have to hold “Hide Merch, Tickets, Offers” and “Redirect to Subscriptions.” Followers (redirect only matters if the feed is hidden; reveal-on-hover only matters if the bar is hidden; edge and trigger only matter for a side card) sit in the same sheet and disappear when they do not apply. A full Unhook-sized index is six summary rows with one group open, not twenty switches.

**What this change builds, and what it deliberately does not.** Existing stored keys and control ids stay. The hide list that landed on `cursor/fold-unhook-features-8671` is `distractionFilters` in `src/settings.js`. Each filter carries a `group`, and the popup renders one row per filter into that group. On that branch the same rows sat in one “Across YouTube” list inside a nested scroller, so the first Distractions view did not show them. They are rows in the groups below now. A hide checkbox carries `data-quiet` and `data-quiet-label` unless it lives in Playback. The count and the Quiet sentence are derived from those, so another filter does not need a new tab.

| Group | `group` | What it holds |
| --- | --- | --- |
| Layout | — | Video details and playlist, each with where / edge / opens with |
| Around the video | `watch` | Recommendations, live chat, end screen, info cards, mixes, offers |
| Home and search | `browse` | Home feed, Shorts, search shelves, Trending and Explore, More from YouTube |
| Comments | `comments` | Comments |
| Page chrome | `chrome` | Top bar, reveal on hover, notifications |
| Playback | `playback` | Automatic start, startup mode, shortcut, disable autoplay |
| Look | — | Card surface, accented shadow |

**Chain this is willing to stand on.**

1. People open this popup to place the video’s furniture or to undo one hide, then leave.
2. They can see that placement without changing tabs, and they can see which hides are on without reading every switch.
3. Adding a filter is another row in an existing group, so the list stays an index.
4. The stored keys on the page today still persist, including keys that are only derived from older settings.

This change executes 1–4 for the settings that exist, including the twelve distraction filters. A new filter needs a `group` on that schema object. It does not need a new tab.
