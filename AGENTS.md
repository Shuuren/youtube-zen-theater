# Agent instructions

- The handoff gate is `bun run check`.
- Treat the first lint result as the baseline. Fix only findings introduced by the task or needed to restore green; keep semantic edits separate from readable-spacing autofixes.
- `tsc --noEmit` checkJs covers the direct-loaded `src/` and `popup/` runtime. Fake-DOM regression and DevTools/Helium diagnostic scripts stay outside that typecheck and must pass their focused execution or syntax gates.
- Preserve direct-loadable MV3 JavaScript, stored keys, and native YouTube controls. Do not add runtime frameworks, permissions, telemetry, or generated bundles.
- Zen root classes are toggled in `src/content.js` `applyZen` and matched by `html.ytzt-*` rules in `src/zen.css`. `ytzt-native-playlist` means a playlist panel is present in native drawer mode.
- For delegated work or handoffs, read and update `plans/WORKFLOW.md`; otherwise use the repository files and scripts as the source of truth.
