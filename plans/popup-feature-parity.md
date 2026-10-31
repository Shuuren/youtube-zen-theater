# Popup feature parity baseline

Original visual style retained. All 15 original stored settings remain available, plus the new scrollBehavior choice. General is the first tab; Distractions remains separate. No control is removed based on another setting.

| Original setting | Location | Behavior |
| --- | --- | --- |
| autoZen | General | Apply Zen automatically |
| shortcutEnabled | General | T shortcut |
| hideLiveChat | Distractions | Native live-chat close control |
| hideHeader | Distractions | Hide top bar |
| hideRecommendations | Distractions | Hide list while preserving sidebar space |
| revealHeaderOnHover | Distractions | Reveal hidden top bar at upper edge |
| revealMetaOnHover | Panels | Enable/disable Side details in card scroll mode |
| revealPlaylistOnHover | Panels | Native playlist access |
| sideRevealMode | Panels | Hover edge or drawer button |
| revealSideLayout | Panels | Separate or shared edges |
| sideHoverPosition | Panels | Left/right details or shared edge; playlist opposite when separate |
| sameSideSplit | Panels | Which panel uses upper half of shared hover edge |
| hoverRevealDelay | Panels | Hover timing |
| drawerImplementation | Panels | Zen or native YouTube surface |
| drawerGlassEffect | Panels | Zen drawer shadow styling |

The new scrollBehavior setting stays in General. Page mode remains the intentional default. Card mode provides the original details drawer/hover interactions plus scroll opening. Turning Side details off falls back to native page scrolling without deleting the saved card preference; General explains this state. Placement remains editable in page mode because playlists also use it.

Validation: regression checks compare the real popup HTML with all original control IDs, preserve saved placement/toggle values, save placement in page mode, and exercise runtime Side details off/on. Browser preview verifies all 16 controls, three tabs, keyboard navigation, and placement availability.
