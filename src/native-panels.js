(() => {
/**
 * @typedef {{panelIdentifier: string}} PanelEndpoint
 * @typedef {{signalServiceEndpoint: {signal: string, actions: Array<{showEngagementPanelEndpoint?: PanelEndpoint, hideEngagementPanelEndpoint?: PanelEndpoint}>}}} PanelCommand
 * @typedef {{resolveCommand?: (command: PanelCommand, context: Record<string, never>, quiet: boolean) => void|Promise<void>}} NativePanelController
 * @typedef {HTMLElement & NativePanelController & {polymerController?: NativePanelController, inst?: NativePanelController}} NativeWatchElement
 */
  let replaying = false;
  let requestGeneration = 0;

  document.addEventListener('click', (event) => {
    if (replaying || document.fullscreenElement || !document.documentElement.classList.contains('ytzt-native-theater')) return;

    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest('.ytp-fullscreen-quick-actions button');
    const metadata = target?.closest('.ytp-fullscreen-metadata');
    const toggle = button?.closest('toggle-button-view-model');
    const comments = toggle?.parentElement?.tagName === 'YT-PLAYER-QUICK-ACTION-BUTTONS' || button?.getAttribute('aria-label') === 'Comments';

    if (metadata && target?.closest('a, button, input, [role="link"]')) return;

    const panelId = metadata ? 'engagement-panel-structured-description'
      : comments ? 'engagement-panel-comments-section' : null;

    if (!panelId) return;

    /** @type {NativeWatchElement|null} */
    const flexy = document.querySelector('ytd-watch-flexy');
    const controller = flexy?.polymerController || flexy?.inst || flexy;
    const panel = document.querySelector(`ytd-engagement-panel-section-list-renderer[target-id="${panelId}"]`);

    if (!controller?.resolveCommand || !panel) return;

    const endpoint = { panelIdentifier: panelId };
    const expanded = panel.getAttribute('visibility') === 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
    const expected = expanded ? 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN' : 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';
    const trigger = button || metadata?.querySelector('[role="button"]') || metadata;
    let settled = false;
    const generation = ++requestGeneration;
    const page = location.pathname + location.search;

    const fallback = () => {
      if (settled) return;

      settled = true;

      if (generation !== requestGeneration || panel.getAttribute('visibility') === expected ||
        document.fullscreenElement || !trigger.isConnected || page !== location.pathname + location.search ||
        !document.documentElement.classList.contains('ytzt-native-theater')) return;

      replaying = true;

      try {
        if (trigger instanceof HTMLElement) trigger.click();
      } finally {
        replaying = false;
      }
    };

    // Native watch-page command shape used by Tabview Totara, commit 05a2ab38f00f4dad36b59ef078d2b0db4994f93e.
    try {
      const result = controller.resolveCommand({
        signalServiceEndpoint: {
          signal: 'CLIENT_SIGNAL',
          actions: [expanded ? { hideEngagementPanelEndpoint: endpoint } : { showEngagementPanelEndpoint: endpoint }]
        }
      }, {}, false);

      Promise.resolve(result).catch(fallback);
    } catch {
      // Preserve YouTube's default action if this internal command is unavailable.
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    window.setTimeout(fallback, 250);
  }, true);
})();
