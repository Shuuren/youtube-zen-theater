# Content-first prototype critique

Disposable prototype: `popup/content-model.prototype.html`. Production unchanged.

Context: user rejected three organizations of the same coupled settings model. Preserve capabilities and original visual language; simplify how settings relate.

First impression: General now answers two concrete questions: where video details appear, and where the playlist appears. Distractions and appearance have separate responsibilities.

| Before | After | Why |
| --- | --- | --- |
| Placement depended on a reference side, same/opposite layout, and renderer choice. | Each content type has its own location and side. | Users can predict the result without combining settings. |
| Details enable and scroll-card selection could contradict each other. | One location choice: below video or side card. | Removes redundant state while preserving natural scrolling and cards. |
| Simplification initially omitted combined triggers and hiding the playlist. | Preserve scroll + hover, always-available edge buttons, and Hidden playlist. | Reduces configuration without dropping capabilities. |
| Shared edge setting could suggest panels stack. | Top edge region appears only for two hover cards sharing an edge. | Describes the actual activation regions; opening one card closes the other. |
| T changed Auto Zen preference. | T changes transient preview state only. | Trying a shortcut must not rewrite future-video preferences. |
| Card-mode details made a page playlist unreachable. | Page sidebar stays independently reachable and scrollable. | Independent placement must work for mixed configurations. |
| Closed cards could open on upward scroll. | Only downward vertical unmodified video scrolling opens details; native controls remain excluded. | Matches the intended natural interaction. |
| Inactive summary described cards while native page was shown. | Explicit Zen-off summary describes current native locations. | Visible feedback agrees with the scene. |

Visual review: original popup header, type, red accent, bordered rows and native controls retained. Preview uses a separate understated surface. Desktop and 360px renders have no horizontal clipping. Dense states retain a bounded settings scroller. Labels and keyboard focus remain explicit; keyboard card closing restores edge-control focus.

User-context review: default is natural scrolling. Side-card complexity appears only after choosing a side card. Dormant preferences survive switching location. Appearance never changes placement. The preview is in-memory and explicitly identifies its simulated video.

Validation: browser execution checked shortcut/preference separation, inactive summary, mixed page/card reachability, scroll direction, independent sides, exclusive card opening and appearance navigation. Rendered at 728px and 360px without console errors.

Remaining decision: whether this independent content model solves the product problem. This is a concept prototype, not a claim that native YouTube rendering exactly matches the miniature scene. No production migration implemented.

## Integrated preview refinement

User asked to explore including the preview in the popup. Moved the existing interactive scene above category tabs, keeping original popup styling. Compact scene is112px high with location/trigger summaries and Scroll/Expand actions; expanding gives260px and exposes instructions/reset/feedback. Named edge buttons identify Details and Playlist.

| Before | After | Why |
| --- | --- | --- |
| Full watch-page preview occupied a separate column. | Compact preview inside the popup, with explicit expansion. | Makes configuration results visible in the actual proposed product layout. |
| First integrated attempt repeated instructions and actions under the scene. | Compact mode keeps scene, summaries, Scroll and Expand only. | Avoids spending popup height on repeated explanations. |
| Chevron buttons did not identify their drawer. | Edge buttons name Details and Playlist. | Side placement becomes readable and controls are distinguishable. |

Browser smoke passed expansion/collapse without preference changes, named left/right edges, scroll-to-details and playlist button opening. Rendered728px and360px with no console errors. Production unchanged.

Independent source review caught unsupported Scroll silently doing nothing while compact status was hidden. Disabled Scroll in button/hover-only modes with explanatory title. Expanded preview reallocates148px from settings so total popup height stays fixed. Compact hover, pinning, and pointerleave checks pass.
Expanded preview keeps the same chrome as compact mode; only the scene grows. This removes repeated instructions and keeps the height reallocation exact.
