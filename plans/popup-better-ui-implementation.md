# better-ui polish and production implementation

Scope: production popup, compact preview and the runtime changes required for the independent content model. Original colors, native controls, density and header retained.

## Surfaces and optical alignment

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM, fixed | popup/preview.css:1 | Preview and inset scene used unrelated corner radii. | Outer19px = inner8px + padding10px + border1px. | Concentric surfaces keep a visibly even inset. |
| MEDIUM, fixed | popup/preview.css:49 | Temporary cards used one structural-looking outline for depth. | Transparent forced-colors border plus layered ring/lift/ambient shadows. | Elevation stays distinct from form-input structure. |
| LOW, fixed | popup/preview.css:28 | Triangle centered geometrically. | Play icon nudged2px toward its point. | Optical alignment centers the visible shape. |
| LOW, fixed | popup/popup.css:45 | Header icon hard-coded its drawing color. | SVG uses currentColor with CSS state colors. | One icon asset keeps consistent strokes and state styling. |

## Interaction states and motion

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM, fixed | popup/popup.css:315 | Press used a one-pixel shift. | Enabled buttons scale to0.96 over150ms ease-out, gated by no-preference. | Exact press feedback; disabled controls do not move. |
| MEDIUM, fixed | popup/preview.css:58 | Hover styling assumed a mouse. | Hover rules require hover-capable input. | Prevents sticky touch hover states. |
| MEDIUM, fixed | popup/popup.css:307 | Settings scroll could propagate out of its panel. | Settings, sample page and cards contain overscroll. | Reaching the end does not move the surrounding surface. |

Broken interactions took priority over polish: independent runtime sides/triggers and migration were implemented; queued hover cancellation, hover-pin labels, native page wheel scope and pinned cross-panel hover switching were corrected after read-only reviews.

Verification: actual production popup sources rendered at372px within600px, including expansion. Browser checks exercised both sides, scroll/button state, hover timer cancellation, hover pin/close labels, keyboard category navigation, dormant preference retention, appearance isolation and zero storage writes from preview actions. Actual runtime JS/CSS fixture checked native-style card positioning, reserved sidebar, mixed page/card reachability and playlist hiding. checkJs, lint and regression suite pass.

Not verified: installed Helium extension after reload; browser Animations panel playback at10% speed; forced-colors rendering. Reduced-motion gating, disabled press exclusion and shadow fallback border inspected in source. No animated card entrances or icon swaps were introduced.

Approve for the inspected scope. Unverified checks remain listed above.
