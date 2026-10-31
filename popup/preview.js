/** @typedef {'details'|'playlist'} PreviewPanel */
/** @typedef {import('./popup.js').PopupSettings} PopupSettings */
/** @type {PopupSettings|null} */
let previewSettings = null;

/** @type {PreviewPanel|null} */
let previewOpen = null;

let previewPinned = false;

let previewExpanded = false;

let previewHoverTimer = 0;

/** @type {PreviewPanel|null} */
let previewHoverTarget = null;

const previewScene = document.getElementById('preview-scene');

const previewScroll = /** @type {HTMLButtonElement|null} */ (document.getElementById('preview-scroll'));

const previewExpand = document.getElementById('preview-expand');

/** @param {PopupSettings} next */
function updateZenPreview(next) {
  window.clearTimeout(previewHoverTimer);
  previewHoverTarget = null;

  if (previewOpen && ((previewOpen === 'details' ? next.detailsLocation : next.playlistLocation) !== 'card' || !previewPinned)) previewOpen = null;
  previewSettings = { ...next };
  window.renderPreviewScene(next, previewOpen, previewPinned);
  window.renderPreviewSummary(next);

  if (previewScroll) {
    previewScroll.disabled = next.detailsLocation === 'card' && !next.detailsTrigger.includes('scroll');
    previewScroll.title = previewScroll.disabled ? 'Details open with the drawer button or hover.' : 'Try scrolling down';
  }
}

/** @param {string} message */
function previewMessage(message) {
  const output = document.getElementById('preview-feedback');

  if (output) output.textContent = message;
}

/** @param {PreviewPanel|null} panel @param {boolean} [pinned=false] */
function openPreviewPanel(panel, pinned = false) {
  window.clearTimeout(previewHoverTimer);
  previewHoverTarget = null;
  previewOpen = panel;
  previewPinned = pinned;

  if (previewSettings) window.renderPreviewScene(previewSettings, panel, pinned);
  previewMessage(panel ? `${panel === 'details' ? 'Details' : 'Playlist'} preview opened. Escape closes it.` : 'Preview card closed.');
}

/** @param {number} [delta=100] */
function scrollZenPreview(delta = 100) {
  if (!previewSettings || !previewScene) return;

  if (previewSettings.detailsLocation === 'card') {
    if (!previewSettings.detailsTrigger.includes('scroll')) return;

    if (previewOpen !== 'details') {
      if (delta > 0) openPreviewPanel('details', true);
    } else {
      const card = previewScene.querySelector('.sample-card');

      if (card) card.scrollTop += delta;
    }
  } else {
    const page = previewScene.querySelector('.sample-page');

    if (page) page.scrollTop += delta;
  }
}

previewScroll?.addEventListener('click', () => scrollZenPreview());

previewExpand?.addEventListener('click', () => {
  previewExpanded = !previewExpanded;
  document.querySelector('.layout-preview')?.classList.toggle('expanded', previewExpanded);
  previewExpand.setAttribute('aria-expanded', String(previewExpanded));
  previewExpand.textContent = previewExpanded ? 'Collapse' : 'Expand';
});

previewScene?.addEventListener('click', (event) => {
  const target = event.target instanceof Element ? event.target.closest('button') : null;

  if (!(target instanceof HTMLButtonElement)) return;

  if (target.hasAttribute('data-preview-close')) {
    const previous = previewOpen;
    openPreviewPanel(null);
    focusPreviewControl('button[data-preview-open="' + previous + '"]');
  } else {
    const panel = /** @type {PreviewPanel} */ (target.dataset.previewOpen);

    if (!panel) return;
    const close = previewOpen === panel && previewPinned;
    openPreviewPanel(close ? null : panel, !close);

    if (event.detail === 0) focusPreviewControl(close ? 'button[data-preview-open="' + panel + '"]' : 'button[data-preview-close]');
  }
});

previewScene?.addEventListener('keydown', (event) => {
  if (!(event instanceof KeyboardEvent)) return;

  if (event.key === 'Escape' && previewOpen) {
    event.preventDefault();
    const previous = previewOpen;
    openPreviewPanel(null);
    focusPreviewControl('button[data-preview-open="' + previous + '"]');
  } else if (event.target === previewScene && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
    event.preventDefault();
    scrollZenPreview(event.key === 'ArrowDown' ? 70 : -70);
  }
});

previewScene?.addEventListener('wheel', (event) => {
  if (!(event instanceof WheelEvent) || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;

  if (!(event.target instanceof Element) || !event.target.closest('.sample-video') || event.target.closest('button')) return;

  if (previewSettings?.detailsLocation === 'card' && previewSettings.detailsTrigger.includes('scroll')) {
    event.preventDefault();
    scrollZenPreview(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 130 : 1));
  }
}, { passive: false });

previewScene?.addEventListener('pointermove', (event) => {
  if (!(event instanceof PointerEvent) || event.pointerType === 'touch' || !previewSettings) return;

  if (event.target instanceof Element && event.target.closest('button')) {
    window.clearTimeout(previewHoverTimer);
    previewHoverTarget = null;

    return;
  }

  if (event.target instanceof Element && event.target.closest('.sample-card')) return;
  const rect = previewScene.getBoundingClientRect();
  const x = event.clientX - rect.left;
  let candidates = (/** @type {PreviewPanel[]} */ (['details', 'playlist'])).filter((name) => (name === 'details' ? previewSettings.detailsLocation : previewSettings.playlistLocation) === 'card' && (name === 'details' ? previewSettings.detailsTrigger : previewSettings.playlistTrigger).includes('hover') && ((name === 'details' ? previewSettings.detailsSide : previewSettings.playlistSide) === 'left' ? x < 20 : x > rect.width - 20));

  if (candidates.length === 2) {
    const top = previewSettings.sameSideSplit === 'details-top' ? 'details' : 'playlist';
    candidates = [event.clientY - rect.top < rect.height / 2 ? top : top === 'details' ? 'playlist' : 'details'];
  }

  const next = candidates[0] || null;

  if (previewPinned && (!next || next === previewOpen)) return;

  if (next === previewHoverTarget) return;
  window.clearTimeout(previewHoverTimer);
  previewHoverTarget = next;

  if (next) previewHoverTimer = window.setTimeout(() => openPreviewPanel(next), previewSettings.hoverRevealDelay);
  else if (previewOpen) openPreviewPanel(null);
});

previewScene?.addEventListener('pointerleave', () => {
  window.clearTimeout(previewHoverTimer);
  previewHoverTarget = null;

  if (!previewPinned) openPreviewPanel(null);
});

window.updateZenPreview = updateZenPreview;

/** @param {string} selector */
function focusPreviewControl(selector) {
  const target = previewScene?.querySelector(selector);

  if (target instanceof HTMLElement) target.focus();
}
