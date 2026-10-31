/** @typedef {import('./popup.js').PopupSettings} PopupSettings */
/** @typedef {'details'|'playlist'} PreviewPanel */

/** @param {PopupSettings} settings @param {PreviewPanel|null} open @param {boolean} [pinned=false] */
function renderPreviewScene(settings, open, pinned = false) {
  const scene = document.getElementById('preview-scene');

  if (!scene) return;
  const viewport = scene.querySelector('.sample-page');
  const scroll = viewport?.scrollTop || 0;
  const details = '<div class="sample-details"><b>A quieter way to watch</b><span>Channel · Like · Share</span><p>Video description and links</p><b>Comments</b><p>A little more room to focus.</p><p>Another viewer’s comment.</p><p>The conversation continues here.</p></div>';
  const playlist = '<div class="sample-playlist"><b>Playlist</b><span>1 · Current video</span><span>2 · Next video</span><span>3 · Another video</span></div>';
  const detailsCard = settings.detailsLocation === 'card';
  const playlistCard = settings.playlistLocation === 'card';
  const sameSide = detailsCard && playlistCard && settings.detailsSide === settings.playlistSide;
  const sharedHover = sameSide && settings.detailsTrigger.includes('hover') && settings.playlistTrigger === 'hover';
  const top = sharedHover && settings.sameSideSplit === 'details-top' ? 'details' : 'playlist';
  let buttons = '';

  for (const name of /** @type {PreviewPanel[]} */ (['details', 'playlist'])) {
    if ((name === 'details' ? settings.detailsLocation : settings.playlistLocation) !== 'card') continue;
    const side = (name === 'details' ? settings.detailsSide : settings.playlistSide);
    buttons += `<button type="button" class="sample-edge ${side} ${sameSide ? name === top ? 'upper' : 'lower' : ''}" data-preview-open="${name}" aria-expanded="${open === name}" aria-label="${open === name ? pinned ? 'Close' : 'Keep open' : 'Open'} ${name} preview">${name === 'details' ? 'Details' : 'Playlist'} <span aria-hidden="true">${side === 'left' ? '›' : '‹'}</span></button>`;
  }

  scene.innerHTML = `<div class="sample-page">${settings.hideHeader ? '' : '<div class="sample-header">YouTube <span>Search</span></div>'}<div class="sample-video"><span class="sample-caption">Sample video</span><svg class="sample-play" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5v14l11-7z" fill="currentColor"/></svg><div class="sample-controls"><i></i><span>▶ &nbsp; 0:07 / 12:14</span></div></div><div class="sample-columns"><div>${detailsCard ? '' : details}</div><aside>${settings.playlistLocation === 'page' ? playlist : ''}${settings.hideRecommendations ? '' : '<div class="sample-recommendations">Recommended<div></div><div></div></div>'}${settings.hideLiveChat ? '' : '<p>Live chat</p>'}</aside></div></div>${buttons}${open ? `<section class="sample-card ${(open === 'details' ? settings.detailsSide : settings.playlistSide)} ${settings.drawerImplementation} ${settings.drawerGlassEffect ? 'accented' : ''}" aria-label="${open} preview"><header><b>${open === 'details' ? 'Video details' : 'Playlist'}</b><button type="button" data-preview-close aria-label="Close preview card">×</button></header>${open === 'details' ? details : playlist}</section>` : ''}`;
  const nextViewport = scene.querySelector('.sample-page');

  if (nextViewport) nextViewport.scrollTop = scroll;
}

/** @param {PopupSettings} settings */
function renderPreviewSummary(settings) {
  const summary = document.getElementById('preview-summary');

  if (!summary) return;
  summary.textContent = ['details', 'playlist'].map((name) => {
    const location = (name === 'details' ? settings.detailsLocation : settings.playlistLocation);
    const label = name === 'details' ? 'Details' : 'Playlist';
    const trigger = (name === 'details' ? settings.detailsTrigger : settings.playlistTrigger);

    return `${label} · ${location === 'card' ? (name === 'details' ? settings.detailsSide : settings.playlistSide) + ' · ' + (trigger === 'scroll-hover' ? 'scroll + hover' : trigger) : location === 'page' ? name === 'details' ? 'below video' : 'on page' : 'hidden'}`;
  }).join('\n');
}

window.renderPreviewScene = renderPreviewScene;

window.renderPreviewSummary = renderPreviewSummary;
