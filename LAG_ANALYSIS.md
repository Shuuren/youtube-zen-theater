# Intermittent lag analysis and fix plan

Analysis only, 2026-09-08. No extension code changed, builds or tests run.

## What was observed

The existing Helium YouTube tab was a live stream, paused about 57 minutes into playback. Helium reported high memory usage of 3.4 GB, later 3.1 GB. YouTube Zen Theater was present, alongside other extensions with site access, including SocialFocus, StopTheMadness, uBlock Origin and Video DownloadHelper. These observations do not establish which component consumed the memory.

DevTools opened with a saved iPhone XR device toolbar active. Its JavaScript context was initially unavailable; a later console interaction timed out. No usable performance trace or mutation count was collected. The analysis below establishes code paths, not measured attribution of the reported lag. The installed extension source/version was not verified against this checkout.

## Ranked findings

### 1. Drawer updates feed the document observer

High confidence code defect. `src/content.js:488` and `:497` assign button `textContent` on every update, even when the arrow is unchanged. Replacing the text node produces a child-list mutation. `shouldApplyForMutation` at `:896` excludes player/context-menu changes but accepts extension drawer-button changes. The document-wide observer at `:933` schedules another apply after 120 ms plus 180 ms. `applyZen` calls `syncHoverZones`, updating the same buttons again.

With a drawer button mounted, this can sustain roughly one update every 300 ms even when the page is idle. Actual frequency depends on other timers and main-thread load. Repeated apply work can amplify other expensive paths below. This alone does not establish a memory leak.

### 2. Unresolved live-chat closing repeatedly scans the page

High confidence expensive path, conditional on chat state. `hideLiveChatByClick` at `src/content.js:729` searches for a close control at `:762`. Each missed selector in `findFirst` invokes `deepQuerySelector` at `:850`, enumerating all descendants and recursing into shadow roots. The 14-selector search can repeat that traversal many times per apply.

The retry guard counts clicks, not failed searches. When controls are absent, a failed lookup returns without advancing the counter at `:764–768`. Searches can therefore repeat indefinitely as apply runs. The current live-stream context makes this worth checking, but unresolved chat was not confirmed. This conditional work explains why the same extension may feel worse on some pages.

### 3. Wheel handling may delay scrolling

Medium confidence contributor. The document-wide non-passive wheel handler at `src/content.js:196` discovers playlist containers and reads scroll geometry at `:597–623` and `:692–699`. Scrolling writes and rereads `scrollTop` at `:589–591`. This work is synchronous with wheel handling and can trigger layout when styles are dirty.

Additional conditional rendering cost: `src/zen.css:232`, `:307` and `:844` use 22px backdrop blur. Playlist blur does not honor the glass-effect setting. Investigate this if lag concentrates on open drawers over moving video.

## Implementation order for the fixing agent

1. Verify the unpacked extension uses this checkout. Collect a brief baseline mutation count and performance trace before changing code. Avoid retaining DOM nodes in console logs, which can distort memory observations.
2. Break the observer loop. Only write changed button text and attributes. Ignore mutations within extension-owned controls, while preserving detection when YouTube removes a control so it can be recreated. Avoid blanket suppression of all page mutations.
3. Limit live-chat work. Search within the chat container first, combine selectors or traverse shadow roots once per attempt, and bound unsuccessful attempts as well as clicks. Reset the attempt state on navigation or a relevant chat reopening/replacement. Keep the existing iframe fallback functional.
4. Reprofile before broader optimization. If scrolling still stalls, use native overflow scrolling where possible, intercept wheel events only where custom drawer behavior requires it, and cache container discovery with invalidation on replacement/navigation.
5. If open drawers still cause rendering lag, make the playlist obey the glass-effect setting and compare traces with blur enabled/disabled.

## Acceptance checks

- After settling, a paused page produces no recurring extension-owned button mutations or self-triggered apply cycle.
- Open chat with missing close controls reaches a bounded retry limit; a later relevant chat change can restart detection.
- Navigation between live streams, ordinary videos and playlists still restores theater layout and drawer controls. Removing/replacing controls does not permanently lose them.
- Compare short traces for idle, playback and drawer scrolling. Inspect apply frequency, deep-query time, long tasks and forced layout.
- If memory remains high, compare fresh tabs at equal playback duration with Zen enabled/disabled, then isolate overlapping extensions. Record memory growth over time; a single high-memory reading cannot prove a leak.

Fix the observer loop first. It is the clearest defect and removing it reduces the frequency of the other expensive paths without redesigning the extension.
