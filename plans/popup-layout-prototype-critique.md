# Interface Craft critique and refinement: popup layout prototypes

## Context

Three disposable layouts compare how to simplify a casual YouTube extension settings task while preserving all15 original controls plus scroll behavior. Original372px visual styling and General/Distractions/Panels categories are fixed constraints. Changes live only in prototype memory.

## First impressions

A makes the hierarchy explicit through visible groups, but longer categories require scrolling. B keeps ordinary choices available and names every expandable section. C provides compact summaries and focused pages, at the cost of an extra navigation step. These are structural differences, with the same settings and visual language.

## Visual design

Initial A clipped its final General setting. Combining Playlist with Watching removed an unnecessary group and made General fit. Initial B clipped its final collapsed section by5px at360px width. Applying correct summary box sizing reduced its panel category to376px, with all collapsed sections visible. The external prototype switcher initially sat outside shorter captured pages; a consistent study canvas now keeps it reachable. The production popup is unaffected by that canvas.

Colors, switches, typography, icon, row surfaces, and control styling remain based on the original popup. No replacement theme was introduced.

## Interface design

C initially required a separate page for a single Playlist toggle. Playlist now lives with the other Watching controls. B explicitly names the controls inside More viewing controls, so simplification does not make features undiscoverable. Its disabled-details fallback now identifies the section containing the enable control. A explicitly announces that its longer panel category scrolls to appearance settings.

All16 controls remain reachable in every prototype. No layout switch mutates setting values. There are no presets or implicit setting combinations that remove expressiveness.

## Consistency and conventions

The initial same-edge summary said Playlist above, incorrectly implying stacked panels. It now says Top hover region: Playlist or Details, matching the actual setting.

Scroll behavior now references its changing explanation with aria-describedby. New category and drill-in destinations reset scroll position; edits preserve scroll position and focus. Expandable sections retain their open state during edits and ignore delayed toggle events from removed elements. Tabs use arrow navigation; drill-in/back navigation moves focus to a useful control.

## User context

The viewer should spend less time scanning settings while retaining access to less common capabilities. A prioritizes immediate inspection, B reduces initial visible choices, and C limits each editing task to one group. Preserve that comparison instead of making all three variants converge on one layout.

## Top opportunities

1. B offers the strongest starting point for simplification without feature loss: everyday choices stay visible and additional controls remain explicitly named.
2. A remains useful when direct access matters more than shorter categories; its scroll tradeoff is deliberate and disclosed.
3. C suits people who prefer focused tasks and accept one extra click; it no longer creates a single-toggle detour.
4. Validate the chosen navigation with the user before changing the installed popup.

## Verification

Actual prototype HTML rendered at728px,372px,and360px. Interaction smoke checks confirmed16 reachable settings in each variant, unchanged values after navigation, preserved expansion during edits, linked explanations, and scroll resets. B's final panel view measured376px content with no vertical clipping at360px width. Independent read-only source critique verified coverage and identified semantic/accessibility/navigation issues corrected above. No live installed-extension verification or production popup change is claimed.

Artifact: popup/layout.prototype.html. Open directly; ?variant=A, B, or C selects a layout. State is not persisted.
