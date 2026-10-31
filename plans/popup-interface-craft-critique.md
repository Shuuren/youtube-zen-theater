# Interface Craft critique: popup organization

Current decision supersedes simplification recommendations below: restore all 15 original controls and original appearance first. Current categories are General, Distractions, Panels; original controls remain available. General no longer reserves blank minimum height. Further disclosure/layout changes require explicit decisions after parity review. The following critique describes the earlier four-tab snapshot.

Reviewed 2026-10-18 using Interface Craft Design Critique. Scope: current popup with original styling restored. Evidence: rendered Details, Watching, Distractions, and fully expanded Advanced at372px; independent read-only source review. Rendering used stubbed storage, not the installed popup. No popup implementation changed during this critique.

## Context

This is a browser extension settings popup for people adjusting YouTube while watching a video. The task is casual and brief. Viewers need clear choices and a quick return to playback. Preserve the original colors, typography, switches, row treatment, and icon.

## First impressions

The four categories give the popup a clear structure. The original visual language is coherent. The main friction is uneven information density: default Details has one setting followed by a large blank area, while expanded Advanced needs internal scrolling. Several related panel choices are separated across categories.

## Visual design

- **Unused vertical space.** `.settings` enforces a280px minimum height. Default Details uses one row and a two-line explanation, leaving substantial blank space before status. Reduce the minimum height or choose a smaller shared panel height. This improves density without changing visual style.
- **Clipped final control.** In expanded Advanced, the category contains458px of content in a425px scroll area. The popup reaches606px, and the final setting is partly cut off in the initial view. Group secondary tuning in a disclosure section or make the continuation clearly visible.
- **Equal weight for dependent controls.** Hide top bar and Show top bar on hover use identical full-width row cards. The second control depends on the first. Indent or group it under its parent while retaining the existing row styling.

The near-black background, red control accent, bordered rows, SVG mark, and type hierarchy are internally consistent. They do not require replacement.

## Interface design

- We are missing an opportunity to keep related panel choices together. Card side is in Details, edge activation is in Advanced, and playlist enablement is in Watching. Keep routine opening and placement choices beside the relevant panel setting; reserve Advanced for timing and appearance.
- We are missing an opportunity to remove irrelevant controls. With Scroll page selected and playlist access disabled, Edge controls, Panel appearance, and Panel shadow remain visible. Their conditions currently check appearance or hover mode rather than whether an applicable panel is enabled. Hide them when they have no target.
- We are missing an opportunity to shorten card instructions. Card mode explains opening via scrolling in both its result paragraph and its hint. Use one concise paragraph describing opening, scrolling, and closing.

## Consistency and conventions

- Tab behavior follows web conventions: selected state, one tab stop, Left/Right arrows, Home/End, and hidden inactive panels are implemented.
- The mode explanation has an ID but the select lacks `aria-describedby`. Attach the explanation so assistive technology communicates the result of the choice.
- Persistence feedback distinguishes saving and failure, but the failure message names no setting or recovery step. The code already tracks failed keys. Report the affected setting and provide a direct retry instruction or control.

## User context

A viewer wants to change a behavior and return to the video. Inactive options, repeated instructions, and controls split across categories increase the effort needed to predict the result. The most useful refinement is to show only relevant choices and keep related choices together. Preserve the familiar appearance throughout.

## Top opportunities

1. Hide panel settings when neither a details card nor a playlist is enabled, preventing changes that have no visible effect.
2. Keep ordinary opening and placement choices with their corresponding panel controls, reducing category switching.
3. Remove the excessive minimum-height blank area and make all Advanced controls discoverable without a partly clipped final row.
4. Combine card instructions and attach the explanation to its select with `aria-describedby`.
5. Identify the setting when saving fails and provide a clear way to retry.

## Evidence

- `popup/popup.css`: `.settings` min-height280px and max-height425px; existing original row/control styling.
- `popup/popup.html`: four category panels, repeated card instructions, dependent top-bar controls, placement of panel settings.
- `popup/popup.js`: `updateConditionalControls`, `publishWriteStatus`, and tracked failed keys.
- `popup/navigation.js`: tab selection and keyboard navigation.
- Rendered measurements: Watching280px; Distractions301px; expanded Advanced425px visible/458px content; no horizontal overflow at372px.
