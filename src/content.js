/** @typedef {YtztSettings} Settings */

if (!globalThis.YTZTSettings) {
  throw new Error('[YouTube Zen] src/settings.js must load before src/content.js.');
}

/** @type {Settings} */
const DEFAULT_SETTINGS = globalThis.YTZTSettings.defaultSettings;

const CHAT_CLOSE_SELECTORS = [
  '#show-hide-button button',
  '#show-hide-button #button',
  '#show-hide-button tp-yt-paper-button',
  '#close-button button',
  '#close-button #button'
];

const CHAT_TEXT_SELECTORS = ['button', '[role="button"]', '#button', 'tp-yt-paper-button', 'yt-button-shape'];

const LIVE_CHAT_ATTRIBUTE_FILTER = [
  'aria-label',
  'aria-disabled',
  'class',
  'collapsed',
  'disabled',
  'hidden',
  'style',
  'title'
];

const THEATER_BUTTON_SELECTORS = ['.ytp-size-button', 'button.ytp-size-button', '.html5-video-player .ytp-size-button'];

const WATCH_URL_PATTERN = /^\/watch\b|^\/live\//;

const META_REVEAL_CLASSES = ['ytzt-reveal-meta-hover', 'ytzt-reveal-meta-drawer'];

const PLAYLIST_REVEAL_CLASSES = ['ytzt-reveal-playlist-hover', 'ytzt-reveal-playlist-drawer'];

/** @type {Settings} */
let settings = { ...DEFAULT_SETTINGS };

let currentUrl = location.href;

/** @type {Map<string, number>} */
const applyTimers = new Map();

let chatClickCount = 0;

let chatLookupAttemptCount = 0;

let liveChatLookupRestartCount = 0;

let liveChatCloseResolved = false;

let liveChatOpenObserved = false;

/** @type {MutationObserver|null} */
let liveChatObserver = null;

/** @type {Element|null} */
let liveChatObserverRoot = null;

/** @type {Element|null} */
let liveChatFrame = null;

/** @type {MutationObserver|null} */
let liveChatFrameDocumentObserver = null;

/** @type {MutationObserver|null} */
let liveChatControlObserver = null;

/** @type {Element|null} */
let liveChatControlObserverRoot = null;

/** @type {Document|null} */
let liveChatFrameDocumentRoot = null;

/** @type {HTMLIFrameElement|null} */
let liveChatFrameIframe = null;

let liveChatLookupTimer = 0;

let liveChatLifecycleToken = 0;

let wideCookieWritten = false;

let wideCookiePreexisted = false;

let zenEnabled = DEFAULT_SETTINGS.autoZen;

let nativeTheaterRequested = false;

/** @type {HTMLElement|null} */
let headerHoverZone = null;

/** @type {HTMLElement|null} */
let metaHoverZone = null;

/** @type {HTMLButtonElement|null} */
let metaDrawerButton = null;

/** @type {HTMLElement|null} */
let playlistHoverZone = null;

/** @type {HTMLButtonElement|null} */
let playlistDrawerButton = null;

/** @type {HTMLButtonElement|null} */
let lastPanelTrigger = null;

/** @type {MutationObserver|null} */
let nativeControlsObserver = null;

/** @type {Element|null} */
let nativeControlsRoot = null;

let nativeControlsSignature = '';

/** @type {MutationObserver|null} */
let nativePanelsObserver = null;

/** @type {Element|null} */
let nativePanelsRoot = null;

let nativeResizeFrame = 0;

let nativeResizeTimer = 0;

let nativeResizeGeneration = 0;

let lastShortcutAt = 0;

let shortcutKeyActive = false;

let hoverRevealTimer = 0;

let pendingHoverClass = '';

let hoverRevealRequestId = 0;

let playlistOpenRequested = false;

let theaterFrame = 0;

let theaterClickPending = false;

let playerWasMinimized = false;

let playerMinimizeTouched = false;

let liveChatHideClickPending = false;

const MAX_AUTOPLAY_ATTEMPTS = 3;

let autoplayAttempts = 0;

let autoplayResolved = false;

/** @type {Element|null} */
let autoplayPlayer = null;

/** @type {MutationObserver|null} */
let titleObserver = null;

/** @type {HTMLElement|null} */
let observedTitle = null;

/** @type {WeakSet<Event>} */
const handledShortcutEvents = new WeakSet();

const MAX_LIVE_CHAT_LOOKUPS = 8;

const MAX_LIVE_CHAT_CLICKS = 12;

const MAX_LIVE_CHAT_LOOKUP_RESTARTS = 4;

bootWhenDocumentReady();

function bootWhenDocumentReady() {
  if (document.documentElement) {
    init();

    return;
  }

  window.setTimeout(bootWhenDocumentReady, 0);
}

async function init() {
  applyWatchFilters();
  await loadSettings();
  applyStartupPreference();
  bindEvents();
  scheduleApply(0);
  scheduleApply(800);
}

async function loadSettings() {
  if (!globalThis.chrome?.storage?.sync) {
    settings = { ...DEFAULT_SETTINGS };

    return;
  }

  try {
    const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    settings = normalizeSettings(stored);
  } catch (error) {
    console.error('[YouTube Zen] Could not load settings; using defaults.', error);
    settings = { ...DEFAULT_SETTINGS };
  }
}

/**
 * @param {Partial<Settings>} values
 * @returns {Settings}
 */
function normalizeSettings(values) {
  return globalThis.YTZTSettings.normalizeSettings(values);
}

function usesDetailsCard() {
  return (settings.detailsLocation || (settings.scrollBehavior === 'card' && settings.revealMetaOnHover ? 'card' : 'page')) === 'card';
}

function getPlaylistLocation() {
  return settings.playlistLocation || (!settings.revealPlaylistOnHover ? 'hidden' : settings.drawerImplementation === 'native' ? 'page' : 'card');
}

function detailsUseHover() {
  return usesDetailsCard() && (settings.detailsTrigger ? settings.detailsTrigger.includes('hover') : settings.sideRevealMode === 'hover');
}

function detailsUseScroll() {
  return usesDetailsCard() && (!settings.detailsTrigger || settings.detailsTrigger.includes('scroll'));
}

function playlistUsesHover() {
  return getPlaylistLocation() === 'card' && (settings.playlistTrigger ? settings.playlistTrigger === 'hover' : settings.sideRevealMode === 'hover');
}

function getMetaRevealSide() {
  return settings.detailsSide || settings.sideHoverPosition;
}

function getPlaylistRevealSide() {
  return settings.playlistSide || (settings.revealSideLayout === 'same' ? settings.sideHoverPosition : settings.sideHoverPosition === 'left' ? 'right' : 'left');
}

function sharesHoverEdge() {
  return detailsUseHover() && playlistUsesHover() && getMetaRevealSide() === getPlaylistRevealSide();
}

function getMetaHoverZone() {
  return sharesHoverEdge() ? (settings.sameSideSplit === 'details-top' ? 'top' : 'bottom') : 'full';
}

function getPlaylistHoverZone() {
  return sharesHoverEdge() ? (settings.sameSideSplit === 'details-top' ? 'bottom' : 'top') : 'full';
}

function bindEvents() {
  window.addEventListener('yt-navigate-finish', handleNavigation);

  window.addEventListener('yt-page-data-fetched', () => {
    scheduleApply(200);
  });
  window.addEventListener('yt-page-data-updated', () => {
    scheduleApply(200);
  });
  window.addEventListener('yt-navigate-cache-restored', () => {
    scheduleApply(200);
  });
  window.addEventListener('ytd-player-updated', () => scheduleApply(120));
  window.addEventListener('popstate', handleNavigation);

  document.addEventListener('fullscreenchange', handleFullscreenChange);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      scheduleApply(150);
    }
  });

  window.addEventListener('keydown', handleShortcut, true);
  document.addEventListener('keydown', handleShortcut, true);
  window.addEventListener('keypress', handleShortcut, true);
  document.addEventListener('keypress', handleShortcut, true);
  window.addEventListener('keyup', handleShortcut, true);
  document.addEventListener('keyup', handleShortcut, true);

  document.addEventListener('mousemove', handleHoverReveal, true);
  document.addEventListener('wheel', handleDrawerWheel, { capture: true, passive: false });
  document.addEventListener('keydown', handlePanelEscape, true);

  globalThis.chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'sync') {
      return;
    }

    const previousSettings = { ...settings };

    const changedSettings = Object.fromEntries(
      Object.keys(DEFAULT_SETTINGS)
        .filter((key) => changes[key])
        .map((key) => [key, changes[key].newValue])
    );

    settings = normalizeSettings({ ...settings, ...changedSettings });

    if (Object.keys(changes).some(isHoverSetting)) {
      clearHoverRevealTimer();
      clearHoverRevealClasses();
    }

    if (changes.autoZen || changes.startupMode) {
      applyStartupPreference();
    }

    if (changes.hideLiveChat) {
      chatClickCount = 0;
      chatLookupAttemptCount = 0;
      liveChatLookupRestartCount = 0;
      liveChatCloseResolved = false;
      liveChatOpenObserved = false;
      detachLiveChatObserver();
    }

    if (changes.disableAutoplay) {
      resetAutoplayAttempt();
    }

    if (changes.hideNotifications && !settings.hideNotifications) {
      detachTitleObserver();
    }

    if (
      previousSettings.sideRevealMode !== settings.sideRevealMode ||
      previousSettings.scrollBehavior !== settings.scrollBehavior ||
      (/** @type {(keyof Settings)[]} */ (['detailsLocation', 'detailsSide', 'detailsTrigger', 'playlistLocation', 'playlistSide', 'playlistTrigger'])).some((key) => previousSettings[key] !== settings[key])
    ) {
      clearMetaReveal();
      clearPlaylistReveal();
    }

    scheduleApply(0);
  });
}

/** @param {string} key */
function isHoverSetting(key) {
  return [
    'detailsLocation', 'detailsSide', 'detailsTrigger',
    'playlistLocation', 'playlistSide', 'playlistTrigger',
    'scrollBehavior',
    'hideHeader',
    'revealHeaderOnHover',
    'revealMetaOnHover',
    'revealPlaylistOnHover',
    'sideRevealMode',
    'drawerImplementation',
    'revealSideLayout',
    'sideHoverPosition',
    'sameSideSplit',
    'hoverRevealDelay'
  ].includes(key);
}

function nativeActionsReady() {
  const buttons = Array.from(document.querySelectorAll('.ytp-fullscreen-quick-actions button'));

  return buttons.length >= 4 && buttons.every((button) => Boolean(button.getAttribute('aria-label')?.trim() &&
    (button.querySelector('svg path[d], svg use[href]') || button.textContent?.trim())));
}

function getNativeControlsSignature() {
  return `${Boolean(document.querySelector('.ytp-fullscreen-quick-actions'))}:${nativeActionsReady()}:${Boolean(document.querySelector('.ytp-size-button'))}`;
}

/** @param {boolean} active */
function syncNativeControlsObserver(active) {
  syncNativePanelsObserver(active);
  const root = active ? document.querySelector('#movie_player') || document.body : null;

  if (root === nativeControlsRoot) return;

  nativeControlsObserver?.disconnect();
  nativeControlsObserver = null;
  nativeControlsRoot = root;
  nativeControlsSignature = getNativeControlsSignature();

  if (!root) return;

  nativeControlsObserver = new MutationObserver(() => {
    const signature = getNativeControlsSignature();
    const playerMounted = nativeControlsRoot === document.body && Boolean(document.querySelector('#movie_player'));

    if (signature !== nativeControlsSignature || playerMounted) {
      nativeControlsSignature = signature;
      scheduleApply(0);
    }
  });
  nativeControlsObserver.observe(root, { childList: true, characterData: true, attributes: true, attributeFilter: ['aria-label', 'd', 'href', 'xlink:href'], subtree: true });
}

/** @param {boolean} active */
function syncNativePanelsObserver(active) {
  const root = active ? document.querySelector('ytd-watch-flexy') : null;

  if (root === nativePanelsRoot) return;

  nativePanelsObserver?.disconnect();
  nativePanelsObserver = null;
  nativePanelsRoot = root;

  if (!root) return;

  nativePanelsObserver = new MutationObserver((records) => {
    if (usesNativeTheater() && records.some((record) => record.target instanceof Element && record.target.matches('ytd-engagement-panel-section-list-renderer'))) {
      scheduleNativeResize();
    }
  });
  nativePanelsObserver.observe(root, { attributes: true, attributeFilter: ['visibility'], subtree: true });
}

function applyStartupPreference() {
  const automatic = settings.autoZen && isWatchPage();
  zenEnabled = automatic && settings.startupMode === 'zen';
  nativeTheaterRequested = automatic && settings.startupMode === 'theater';
}

function usesNativeTheater() {
  return document.documentElement.classList.contains('ytzt-native-theater');
}

function isWatchPage() {
  return WATCH_URL_PATTERN.test(location.pathname);
}

/** @param {string} url */
function watchNavigationTarget(url) {
  const noHash = String(url).split('#')[0];
  const queryIndex = noHash.indexOf('?');
  const beforeQuery = queryIndex === -1 ? noHash : noHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? '' : noHash.slice(queryIndex + 1);
  const path = beforeQuery.replace(/^https?:\/\/[^/]+/, '');

  if (path !== '/watch') {
    return path;
  }

  const videoPart = query.split('&').find((part) => part.startsWith('v='));

  return path + '?' + (videoPart ? videoPart.slice(2) : '');
}

function scheduleApply(delay = 120) {
  const timerKey = delay > 500 ? 'settle' : 'soon';
  window.clearTimeout(applyTimers.get(timerKey));

  const timer = window.setTimeout(() => {
    applyTimers.delete(timerKey);
    applyZen();
  }, delay);

  applyTimers.set(timerKey, timer);
}

function isShortsPage() {
  return location.pathname === '/shorts' || location.pathname.startsWith('/shorts/');
}

function resetAutoplayAttempt() {
  autoplayAttempts = 0;
  autoplayResolved = false;
  autoplayPlayer = null;
}

function detachTitleObserver() {
  titleObserver?.disconnect();
  titleObserver = null;
  observedTitle = null;
}

/**
 * @param {HTMLElement} title
 */
function stripUnreadCount(title) {
  const text = title.textContent || '';
  const next = text.replace(/^\(\d+\)\s+/, '');

  if (next !== text) {
    title.textContent = next;
  }
}

function syncNotificationTitle() {
  if (!settings.hideNotifications) {
    detachTitleObserver();

    return;
  }

  const title = document.querySelector('title');

  if (!(title instanceof HTMLElement)) {
    return;
  }

  stripUnreadCount(title);

  if (title === observedTitle && titleObserver) {
    return;
  }

  detachTitleObserver();
  observedTitle = title;
  titleObserver = new MutationObserver(() => {
    if (!settings.hideNotifications) {
      return;
    }

    stripUnreadCount(title);
  });
  titleObserver.observe(title, { childList: true, characterData: true, subtree: true });
}

function syncAutoplay() {
  if (!settings.disableAutoplay || autoplayResolved || !isWatchPage()) {
    return;
  }

  const player = document.querySelector('#movie_player');

  if (!(player instanceof HTMLElement)) {
    return;
  }

  if (player !== autoplayPlayer) {
    autoplayPlayer = player;
    autoplayAttempts = 0;
  }

  if (autoplayAttempts >= MAX_AUTOPLAY_ATTEMPTS) {
    return;
  }

  const toggle = player.querySelector('.ytp-autonav-toggle-button');

  if (!(toggle instanceof HTMLElement)) {
    autoplayAttempts += 1;

    return;
  }

  const enabled = toggle.getAttribute('aria-checked') === 'true' || toggle.getAttribute('aria-pressed') === 'true';

  if (enabled) {
    toggle.click();
  }

  autoplayResolved = true;
}

function applyWatchFilters() {
  const root = document.documentElement;
  const zenActive = zenEnabled && isWatchPage();
  root.classList.toggle('ytzt-shorts-page', isShortsPage());

  for (const filter of globalThis.YTZTSettings.distractionFilters) {
    root.classList.toggle(filter.rootClass, settings[filter.key] === true);
  }

  root.classList.toggle('ytzt-filter-recommendations', settings.hideRecommendations === true);
  root.classList.toggle('ytzt-filter-live-chat', settings.hideLiveChat === true && !zenActive);
  root.classList.toggle('ytzt-filter-playlist', getPlaylistLocation() === 'hidden');
  syncAutoplay();
  syncNotificationTitle();
}

function applyZen() {
  applyWatchFilters();

  if (document.fullscreenElement) {
    return;
  }

  const watchPage = isWatchPage();
  const active = zenEnabled && watchPage;
  const wasActive = document.documentElement.classList.contains('ytzt-watch-page');

  if (active && document.documentElement.classList.contains('ytzt-watch-page') && isVideoContextMenuOpen()) {
    return;
  }

  syncNativeControlsObserver(active || nativeTheaterRequested);
  const nativeTheater = active && Boolean(document.querySelector('.ytp-fullscreen-quick-actions'));
  document.documentElement.classList.toggle('ytzt-native-theater', nativeTheater);
  document.documentElement.classList.toggle('ytzt-native-actions-ready', nativeTheater && nativeActionsReady());

  const drawerIsNative = settings.drawerImplementation === 'native';
  const drawerIsCustom = !drawerIsNative;
  const shouldRevealMeta = active && !nativeTheater && usesDetailsCard();
  const enteringCard = shouldRevealMeta && !document.documentElement.classList.contains('ytzt-reveal-meta-enabled');
  const metaSide = getMetaRevealSide();
  const playlistSide = getPlaylistRevealSide();
  const canRevealPlaylist = active && getPlaylistLocation() === 'card';

  const canOpenNativePlaylist =
    active && getPlaylistLocation() === 'page' && hasPlaylistContext();

  if (canRevealPlaylist || canOpenNativePlaylist) {
    ensurePlaylistPanelOpen();
  }

  const hasPlaylist = canRevealPlaylist && hasPlaylistPanel();
  const hasNativePlaylist = canOpenNativePlaylist && hasPlaylistPanel();

  document.documentElement.classList.toggle('ytzt-watch-page', active);
  document.documentElement.classList.toggle('ytzt-hide-header', active && settings.hideHeader);
  document.documentElement.classList.toggle('ytzt-hide-recommendations', active && settings.hideRecommendations);
  document.documentElement.classList.toggle(
    'ytzt-reveal-header-enabled',
    active && settings.hideHeader && settings.revealHeaderOnHover
  );
  document.documentElement.classList.toggle('ytzt-reveal-meta-enabled', shouldRevealMeta);

  if (enteringCard) {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  document.documentElement.classList.toggle('ytzt-reveal-playlist-enabled', hasPlaylist);
  document.documentElement.classList.toggle('ytzt-playlist-hidden', active && getPlaylistLocation() === 'hidden');
  document.documentElement.classList.toggle('ytzt-details-hover', active && detailsUseHover());
  document.documentElement.classList.toggle('ytzt-playlist-hover', active && playlistUsesHover());
  document.documentElement.classList.toggle('ytzt-side-mode-hover', active && settings.sideRevealMode === 'hover');
  document.documentElement.classList.toggle('ytzt-side-mode-drawer', active && settings.sideRevealMode !== 'hover');
  document.documentElement.classList.toggle('ytzt-drawer-custom', active && drawerIsCustom);
  document.documentElement.classList.toggle('ytzt-drawer-native', active && drawerIsNative);
  document.documentElement.classList.toggle('ytzt-native-playlist', hasNativePlaylist);
  document.documentElement.classList.toggle('ytzt-side-left', active && metaSide === 'left');
  document.documentElement.classList.toggle('ytzt-side-right', active && metaSide !== 'left');
  document.documentElement.classList.toggle('ytzt-playlist-left', hasPlaylist && playlistSide === 'left');
  document.documentElement.classList.toggle('ytzt-playlist-right', hasPlaylist && playlistSide !== 'left');
  document.documentElement.classList.toggle('ytzt-drawer-glass', active && settings.drawerGlassEffect);
  document.documentElement.classList.toggle(
    'ytzt-drawer-solid',
    active && drawerIsCustom && !settings.drawerGlassEffect
  );

  if (nativeTheater) {
    clearHoverRevealTimer();
    clearHoverRevealClasses();
  }

  if (wasActive !== active) {
    scheduleNativeResize();
  }

  syncHoverZones(active);
  syncLiveChatObserver(active && !nativeTheater && settings.hideLiveChat);

  if (!active) {
    window.cancelAnimationFrame(theaterFrame);
    theaterFrame = 0;
    theaterClickPending = false;
    chatClickCount = 0;
    chatLookupAttemptCount = 0;
    liveChatLookupRestartCount = 0;
    liveChatCloseResolved = false;
    liveChatOpenObserved = false;
    liveChatHideClickPending = false;
    detachLiveChatObserver();
    clearHoverRevealTimer();
    clearHoverRevealClasses();
    restoreMinimizedPlayer();
    clearWideCookie();

    if (nativeTheaterRequested && watchPage) {
      theaterFrame = window.requestAnimationFrame(() => {
        theaterFrame = 0;
        forceNativeTheater();
      });
    }

    return;
  }

  setWideCookie();
  window.cancelAnimationFrame(theaterFrame);
  theaterFrame = window.requestAnimationFrame(() => {
    theaterFrame = 0;

    if (!zenEnabled || !isWatchPage() || document.fullscreenElement) {
      return;
    }

    forceNativeTheater();
    expandMinimizedPlayer();

    if (settings.hideLiveChat && !nativeTheater) {
      hideLiveChatByClick();
      scheduleLiveChatLookup();
    }
  });
}

function handleFullscreenChange() {
  window.cancelAnimationFrame(nativeResizeFrame);
  window.clearTimeout(nativeResizeTimer);
  nativeResizeGeneration += 1;

  if (!document.fullscreenElement) {
    applyZen();
    scheduleNativeResize();
  }
}

function scheduleNativeResize() {
  window.cancelAnimationFrame(nativeResizeFrame);
  window.clearTimeout(nativeResizeTimer);
  const generation = ++nativeResizeGeneration;

  const notify = () => {
    if (generation === nativeResizeGeneration && isWatchPage() && !document.fullscreenElement) {
      window.dispatchEvent(new Event('resize'));
    }
  };

  nativeResizeFrame = window.requestAnimationFrame(() => {
    nativeResizeFrame = 0;
    notify();
    nativeResizeTimer = window.setTimeout(() => {
      nativeResizeTimer = 0;
      notify();
    }, 700);
  });
}

function cookieAlreadyHasWide() {
  const cookie = document.cookie;

  if (!cookie) {
    return false;
  }

  return cookie.split(';').some((part) => part.trim() === 'wide=1');
}

function setWideCookie() {
  if (wideCookieWritten) {
    return;
  }

  wideCookiePreexisted = cookieAlreadyHasWide();
  document.cookie = 'wide=1; domain=.youtube.com; path=/; SameSite=Lax';
  wideCookieWritten = true;
}

function clearWideCookie() {
  if (!wideCookieWritten) {
    return;
  }

  if (!wideCookiePreexisted) {
    document.cookie = 'wide=; domain=.youtube.com; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
  }

  wideCookieWritten = false;
  wideCookiePreexisted = false;
}

function forceNativeTheater() {
  if ((!zenEnabled && !nativeTheaterRequested) || !isWatchPage() || document.fullscreenElement) {
    return;
  }

  const watchFlexy = document.querySelector('ytd-watch-flexy');

  if (watchFlexy?.hasAttribute('theater')) {
    nativeTheaterRequested = false;
    theaterClickPending = false;

    return;
  }

  if (theaterClickPending) {
    return;
  }

  const button = findFirst(THEATER_BUTTON_SELECTORS);

  if (button instanceof HTMLElement && isVisible(button) && isTheaterEnterControl(button)) {
    theaterClickPending = true;
    nativeTheaterRequested = false;
    button.click();
  }
}

/** @param {HTMLElement} button */
function isTheaterEnterControl(button) {
  const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''}`.toLowerCase();

  if (!label.trim()) {
    return true;
  }

  return label.includes('theater') && !label.includes('default');
}

function expandMinimizedPlayer() {
  const player = document.querySelector('.html5-video-player');

  if (player && !playerMinimizeTouched) {
    playerWasMinimized = player.classList.contains('ytp-player-minimized');
    playerMinimizeTouched = true;
  }

  player?.classList.remove('ytp-player-minimized');
}

function restoreMinimizedPlayer() {
  const player = document.querySelector('.html5-video-player');

  if (player && playerMinimizeTouched && playerWasMinimized) {
    player.classList.add('ytp-player-minimized');
  }

  playerWasMinimized = false;
  playerMinimizeTouched = false;
}

function toggleZenMode() {
  const nextEnabled = !zenEnabled;
  nativeTheaterRequested = false;

  if (!nextEnabled) {
    resetWatchSurfaceState();
  }

  zenEnabled = nextEnabled;
  scheduleApply(0);
  scheduleApply(600);
}

/** @param {boolean} active */
function syncHoverZones(active) {
  const wantsHeaderZone = active && settings.hideHeader && settings.revealHeaderOnHover;
  const wantsMetaZone = active && !usesNativeTheater() && detailsUseHover();
  const wantsMetaDrawerButton = active && !usesNativeTheater() && usesDetailsCard();

  const wantsPlaylist =
    active && getPlaylistLocation() === 'card' && hasPlaylistPanel();

  const wantsPlaylistZone = wantsPlaylist && playlistUsesHover();
  const wantsPlaylistDrawerButton = wantsPlaylist;

  headerHoverZone = syncHoverZone(headerHoverZone, 'ytzt-header-hover-zone', wantsHeaderZone, 'ytzt-reveal-header');

  if (wantsMetaZone) {
    metaHoverZone = syncHoverZone(metaHoverZone, 'ytzt-meta-hover-zone', true, 'ytzt-reveal-meta-hover');
  } else {
    metaHoverZone?.remove();
    metaHoverZone = null;
    document.documentElement.classList.remove('ytzt-reveal-meta-hover');

    if (!wantsMetaDrawerButton) {
      clearMetaReveal();
    }
  }

  metaDrawerButton = syncMetaDrawerButton(metaDrawerButton, wantsMetaDrawerButton);

  if (wantsPlaylistZone) {
    playlistHoverZone = syncHoverZone(
      playlistHoverZone,
      'ytzt-playlist-hover-zone',
      true,
      'ytzt-reveal-playlist-hover'
    );
  } else {
    playlistHoverZone?.remove();
    playlistHoverZone = null;
    document.documentElement.classList.remove('ytzt-reveal-playlist-hover');

    if (!wantsPlaylistDrawerButton) {
      clearPlaylistReveal();
    }
  }

  playlistDrawerButton = syncPlaylistDrawerButton(playlistDrawerButton, wantsPlaylistDrawerButton);
}

/** @param {HTMLElement|null} zone @param {string} className @param {boolean} shouldExist @param {string} revealClass */
function syncHoverZone(zone, className, shouldExist, revealClass) {
  if (!shouldExist) {
    zone?.remove();
    document.documentElement.classList.remove(revealClass);

    return null;
  }

  if (zone?.isConnected) {
    return zone;
  }

  const nextZone = document.createElement('div');
  nextZone.className = className;
  nextZone.setAttribute('aria-hidden', 'true');
  document.documentElement.append(nextZone);

  return nextZone;
}

/** @param {HTMLButtonElement|null} button @param {boolean} shouldExist @returns {HTMLButtonElement|null} */
function syncMetaDrawerButton(button, shouldExist) {
  if (!shouldExist) {
    if (button === lastPanelTrigger) {
      lastPanelTrigger = null;
    }

    button?.remove();
    document.documentElement.classList.remove('ytzt-reveal-meta-drawer');

    return null;
  }

  if (button?.isConnected) {
    updateMetaDrawerButton(button);

    return button;
  }

  if (button === lastPanelTrigger) {
    lastPanelTrigger = null;
  }

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'ytzt-meta-drawer-button';
  nextButton.addEventListener('click', toggleMetaDrawer);
  appendPanelControl(nextButton);
  updateMetaDrawerButton(nextButton);

  return nextButton;
}

/** @param {HTMLButtonElement|null} button @param {boolean} shouldExist @returns {HTMLButtonElement|null} */
function syncPlaylistDrawerButton(button, shouldExist) {
  if (!shouldExist) {
    if (button === lastPanelTrigger) {
      lastPanelTrigger = null;
    }

    button?.remove();
    document.documentElement.classList.remove('ytzt-reveal-playlist-drawer');

    return null;
  }

  if (button?.isConnected) {
    updatePlaylistDrawerButton(button);

    return button;
  }

  if (button === lastPanelTrigger) {
    lastPanelTrigger = null;
  }

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'ytzt-playlist-drawer-button';
  nextButton.addEventListener('click', togglePlaylistDrawer);
  appendPanelControl(nextButton);
  updatePlaylistDrawerButton(nextButton);

  return nextButton;
}

/** @param {MouseEvent|undefined} event */
function toggleMetaDrawer(event) {
  event?.preventDefault();
  event?.stopPropagation();
  event?.stopImmediatePropagation();
  clearHoverRevealTimer();

  const nextOpen = !document.documentElement.classList.contains('ytzt-reveal-meta-drawer');
  document.documentElement.classList.toggle('ytzt-reveal-meta-drawer', nextOpen);

  if (nextOpen) {
    lastPanelTrigger = getPanelTrigger(event, metaDrawerButton);
    document.documentElement.classList.remove(...PLAYLIST_REVEAL_CLASSES);
    clearHoverRevealTimer();

    if (isKeyboardActivation(event)) {
      focusFirstPanelControl('ytd-watch-flexy[theater] #below');
    }
  } else {
    lastPanelTrigger = null;
  }

  document.documentElement.classList.remove('ytzt-reveal-meta', 'ytzt-reveal-meta-hover');

  if (metaDrawerButton) {
    updateMetaDrawerButton(metaDrawerButton);
  }

  if (playlistDrawerButton) {
    updatePlaylistDrawerButton(playlistDrawerButton);
  }
}

/** @param {MouseEvent|undefined} event */
function togglePlaylistDrawer(event) {
  event?.preventDefault();
  event?.stopPropagation();
  event?.stopImmediatePropagation();
  clearHoverRevealTimer();

  const nextOpen = !document.documentElement.classList.contains('ytzt-reveal-playlist-drawer');
  document.documentElement.classList.toggle('ytzt-reveal-playlist-drawer', nextOpen);

  if (nextOpen) {
    lastPanelTrigger = getPanelTrigger(event, playlistDrawerButton);
    document.documentElement.classList.remove(...META_REVEAL_CLASSES);
    clearHoverRevealTimer();

    if (isKeyboardActivation(event)) {
      focusFirstPanelControl('ytd-watch-flexy[theater] #secondary ytd-playlist-panel-renderer');
    }
  } else {
    lastPanelTrigger = null;
  }

  document.documentElement.classList.remove('ytzt-reveal-playlist-hover');

  if (playlistDrawerButton) {
    updatePlaylistDrawerButton(playlistDrawerButton);
  }

  if (metaDrawerButton) {
    updateMetaDrawerButton(metaDrawerButton);
  }
}

/** @param {HTMLButtonElement} button */
function updateMetaDrawerButton(button) {
  const isOpen = isMetaRevealed();
  const preview = isOpen && !document.documentElement.classList.contains('ytzt-reveal-meta-drawer');
  const isLeftSide = getMetaRevealSide() === 'left';
  setAttributeIfChanged(button, 'aria-label', preview ? 'Keep video details open' : `${isOpen ? 'Hide' : 'Show'} video details`);
  setAttributeIfChanged(button, 'aria-expanded', String(isOpen));
  setAttributeIfChanged(button, 'data-ytzt-drawer', 'details');
  setTextContentIfChanged(button, isOpen === isLeftSide ? '‹' : '›');
}

/** @param {HTMLButtonElement} button */
function updatePlaylistDrawerButton(button) {
  const isOpen = isPlaylistRevealed();
  const preview = isOpen && !document.documentElement.classList.contains('ytzt-reveal-playlist-drawer');
  const isLeftSide = getPlaylistRevealSide() === 'left';
  setAttributeIfChanged(button, 'aria-label', preview ? 'Keep playlist open' : `${isOpen ? 'Hide' : 'Show'} playlist`);
  setAttributeIfChanged(button, 'aria-expanded', String(isOpen));
  setAttributeIfChanged(button, 'data-ytzt-drawer', 'playlist');
  setTextContentIfChanged(button, isOpen === isLeftSide ? '‹' : '›');
}

function updatePanelButtons() {
  if (metaDrawerButton) updateMetaDrawerButton(metaDrawerButton);

  if (playlistDrawerButton) updatePlaylistDrawerButton(playlistDrawerButton);
}

/** @param {HTMLButtonElement} button */
function appendPanelControl(button) {
  const parent = document.body || document.documentElement;

  parent.prepend(button);
}

/**
 * @param {MouseEvent|undefined} event
 * @param {HTMLButtonElement|null} fallback
 * @returns {HTMLButtonElement|null}
 */
function getPanelTrigger(event, fallback) {
  const target = event?.currentTarget;

  return isButtonElement(target) ? target : fallback;
}

/** @param {EventTarget|null|undefined} target @returns {target is HTMLButtonElement} */
function isButtonElement(target) {
  return target instanceof HTMLElement && target.tagName.toLowerCase() === 'button';
}

/** @param {MouseEvent|undefined} event */
function isKeyboardActivation(event) {
  return event?.detail === 0;
}

/** @param {string} selector */
function focusFirstPanelControl(selector) {
  const panel = document.querySelector(selector);

  if (!panel) {
    return;
  }

  const control = Array.from(panel.querySelectorAll('button, a, input, select, textarea, [tabindex]')).find(
    isFocusablePanelControl
  );

  control?.focus();
}

/** @param {Element} element @returns {element is HTMLElement} */
function isFocusablePanelControl(element) {
  return (
    !element.hasAttribute('disabled') &&
    element.getAttribute('aria-hidden') !== 'true' &&
    element.getAttribute('tabindex') !== '-1' &&
    isVisible(element)
  );
}

/** @param {Element} element @param {string} name @param {string} value */
function setAttributeIfChanged(element, name, value) {
  if (element.getAttribute(name) !== value) {
    element.setAttribute(name, value);
  }
}

/** @param {Element} element @param {string} value */
function setTextContentIfChanged(element, value) {
  if (element.textContent !== value) {
    element.textContent = value;
  }
}

function clearMetaReveal() {
  document.documentElement.classList.remove('ytzt-reveal-meta', ...META_REVEAL_CLASSES);
}

function clearPlaylistReveal() {
  document.documentElement.classList.remove(...PLAYLIST_REVEAL_CLASSES);
}

/** @param {KeyboardEvent} event */
function handlePanelEscape(event) {
  if (event.key !== 'Escape' || document.fullscreenElement || usesNativeTheater()) {
    return;
  }

  const metaWasOpen = isMetaRevealed();
  const playlistWasOpen = isPlaylistRevealed();

  if (!metaWasOpen && !playlistWasOpen) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  clearHoverRevealTimer();
  clearMetaReveal();
  clearPlaylistReveal();

  if (metaDrawerButton) {
    updateMetaDrawerButton(metaDrawerButton);
  }

  if (playlistDrawerButton) {
    updatePlaylistDrawerButton(playlistDrawerButton);
  }

  const matchingButton = metaWasOpen ? metaDrawerButton : playlistDrawerButton;

  const restoreTarget =
    (lastPanelTrigger?.isConnected && lastPanelTrigger) || (matchingButton?.isConnected && matchingButton) || null;

  lastPanelTrigger = null;

  if (restoreTarget) {
    restoreTarget.focus();
  }
}

/**
 * @param {Element|null} child
 * @param {Element|null} parent
 * @returns {boolean}
 */
function isDescendantOrSelf(child, parent) {
  let current = child;

  while (current) {
    if (current === parent) {
      return true;
    }

    current = current.parentElement;
  }

  return false;
}

function resetWatchSurfaceState() {
  clearHoverRevealTimer();
  playlistOpenRequested = false;
  lastPanelTrigger = null;
  resetAutoplayAttempt();
  liveChatOpenObserved = false;
  chatClickCount = 0;
  chatLookupAttemptCount = 0;
  liveChatLookupRestartCount = 0;
  liveChatCloseResolved = false;
  liveChatHideClickPending = false;
  theaterClickPending = false;
  clearHoverRevealClasses();

  for (const selector of ['ytd-watch-flexy[theater] #below', 'ytd-watch-flexy[theater] #secondary']) {
    const element = document.querySelector(selector);

    if (element) {
      element.scrollTop = 0;
      element.scrollLeft = 0;
    }
  }

  for (const element of getPlaylistScrollContainers()) {
    element.scrollTop = 0;
    element.scrollLeft = 0;
  }
}

function isMetaRevealed() {
  return META_REVEAL_CLASSES.some((className) => document.documentElement.classList.contains(className));
}

function isPlaylistRevealed() {
  return PLAYLIST_REVEAL_CLASSES.some((className) => document.documentElement.classList.contains(className));
}

/** @param {MouseEvent} event */
function handleHoverReveal(event) {
  if (!zenEnabled || !isWatchPage() || document.fullscreenElement) {
    clearHoverRevealTimer();
    clearHoverRevealClasses();

    return;
  }

  const targetElement = event.target instanceof Element ? event.target : null;
  const isInsideMetaDrawer = Boolean(targetElement?.closest('ytd-watch-flexy[theater] #below'));
  const isInsidePlaylistDrawer = Boolean(targetElement?.closest('ytd-watch-flexy[theater] #secondary ytd-playlist-panel-renderer'));
  const canRevealHeader = settings.hideHeader && settings.revealHeaderOnHover;
  const canRevealMeta = detailsUseHover();

  const canRevealPlaylist =
    playlistUsesHover() &&
    hasPlaylistPanel();

  const headerOpen = document.documentElement.classList.contains('ytzt-reveal-header');
  const metaOpen = isMetaRevealed();
  const playlistOpen = isPlaylistRevealed();
  const headerLimit = headerOpen ? 96 : 22;
  const metaLimit = metaOpen ? 460 : 28;
  const playlistLimit = playlistOpen ? 460 : 28;
  const sidesDiffer = (getMetaRevealSide() === 'left') !== (getPlaylistRevealSide() === 'left');
  const edgeCap = sidesDiffer ? Math.max(28, window.innerWidth / 2 - 1) : Number.POSITIVE_INFINITY;
  const metaEdgeLimit = Math.min(metaLimit, edgeCap);
  const playlistEdgeLimit = Math.min(playlistLimit, edgeCap);
  const sideRevealTopLimit = headerOpen ? 104 : 72;
  const sideRevealBottomLimit = 96;
  const isLeftSideReveal = getMetaRevealSide() === 'left';

  const isInsideMetaRevealEdge = isLeftSideReveal
    ? event.clientX <= metaEdgeLimit
    : event.clientX >= window.innerWidth - metaEdgeLimit;

  const isLeftPlaylistReveal = getPlaylistRevealSide() === 'left';

  const isInsidePlaylistRevealEdge = isLeftPlaylistReveal
    ? event.clientX <= playlistEdgeLimit
    : event.clientX >= window.innerWidth - playlistEdgeLimit;

  const isInsideMetaRevealBand = isInsideHoverZone(
    event.clientY,
    getMetaHoverZone(),
    sideRevealTopLimit,
    sideRevealBottomLimit
  );

  const isInsidePlaylistRevealBand = isInsideHoverZone(
    event.clientY,
    getPlaylistHoverZone(),
    sideRevealTopLimit,
    sideRevealBottomLimit
  );

  document.documentElement.classList.toggle('ytzt-reveal-header', canRevealHeader && event.clientY <= headerLimit);

  if (usesNativeTheater()) {
    return;
  }

  const metaPinned = document.documentElement.classList.contains('ytzt-reveal-meta-drawer');
  const playlistPinned = document.documentElement.classList.contains('ytzt-reveal-playlist-drawer');
  const switchToPlaylist = metaPinned && canRevealPlaylist && isInsidePlaylistRevealBand && isInsidePlaylistRevealEdge && !isInsideMetaDrawer;
  const switchToMeta = playlistPinned && canRevealMeta && isInsideMetaRevealBand && isInsideMetaRevealEdge && !isInsidePlaylistDrawer;

  if (
    targetElement?.closest('.ytzt-meta-drawer-button, .ytzt-playlist-drawer-button') ||
    ((metaPinned || playlistPinned) && !switchToPlaylist && !switchToMeta)
  ) {
    clearHoverRevealTimer();

    return;
  }

  if (switchToPlaylist) clearMetaReveal();

  if (switchToMeta) clearPlaylistReveal();

  if (canRevealMeta) {
    setDelayedRevealClass(
      'ytzt-reveal-meta-hover',
      isInsideMetaDrawer || (isInsideMetaRevealBand && isInsideMetaRevealEdge)
    );

    if (isInsideMetaRevealBand && isInsideMetaRevealEdge && !isInsidePlaylistDrawer) {
      document.documentElement.classList.remove('ytzt-reveal-meta', ...PLAYLIST_REVEAL_CLASSES);
    }
  }

  if (canRevealPlaylist) {
    setDelayedRevealClass(
      'ytzt-reveal-playlist-hover',
      isInsidePlaylistDrawer || (isInsidePlaylistRevealBand && isInsidePlaylistRevealEdge)
    );

    if (isInsidePlaylistRevealBand && isInsidePlaylistRevealEdge && !isInsideMetaDrawer) {
      document.documentElement.classList.remove(...META_REVEAL_CLASSES);
    }
  }
}

/** @param {WheelEvent} event */
function handleDrawerWheel(event) {
  if (
    !zenEnabled || !isWatchPage() || !detailsUseScroll() || document.fullscreenElement || usesNativeTheater() ||
    event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey ||
    !event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)
  ) {
    return;
  }

  const target = event.target instanceof Element ? event.target : null;

  const nativeControls = [
    'button', 'input', 'textarea', 'select', '[contenteditable]',
    '[role="dialog"]', '[role="menu"]', '[role="slider"]',
    '.ytp-chrome-bottom', '.ytp-chrome-top', '.ytp-settings-menu', '.ytp-popup', '.ytp-contextmenu'
  ].join(', ');

  if (
    !target?.closest('.html5-video-player, #player-container, #player-theater-container, #full-bleed-container') ||
    target.closest(nativeControls)
  ) {
    return;
  }

  const panel = document.querySelector('ytd-watch-flexy[theater] #below');

  if (!panel || (!isMetaRevealed() && event.deltaY < 0)) {
    return;
  }

  event.preventDefault();
  event.stopPropagation();

  if (!document.documentElement.classList.contains('ytzt-reveal-meta-drawer')) {
    toggleMetaDrawer(undefined);

    return;
  }

  const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? panel.clientHeight : 1);
  panel.scrollTop += delta;
}

/** @param {number} clientY @param {string} zone @param {number} topLimit @param {number} bottomLimit */
function isInsideHoverZone(clientY, zone, topLimit, bottomLimit) {
  const usableTop = topLimit;
  const usableBottom = window.innerHeight - bottomLimit;
  const midpoint = usableTop + (usableBottom - usableTop) / 2;

  if (zone === 'top') {
    return clientY > usableTop && clientY <= midpoint;
  }

  if (zone === 'bottom') {
    return clientY > midpoint && clientY < usableBottom;
  }

  return clientY > usableTop && clientY < usableBottom;
}

/** @param {string} className @param {boolean} shouldReveal */
function setDelayedRevealClass(className, shouldReveal) {
  if (!shouldReveal) {
    if (pendingHoverClass === className) {
      clearHoverRevealTimer();
    }

    document.documentElement.classList.remove(className);
    updatePanelButtons();

    return;
  }

  if (document.documentElement.classList.contains(className) || pendingHoverClass === className) {
    return;
  }

  clearHoverRevealTimer();
  pendingHoverClass = className;
  const requestId = ++hoverRevealRequestId;
  const requestUrl = currentUrl;
  hoverRevealTimer = window.setTimeout(() => {
    pendingHoverClass = '';
    hoverRevealTimer = 0;

    if (requestId !== hoverRevealRequestId || requestUrl !== currentUrl || !canRevealHoverClass(className)) {
      return;
    }

    document.documentElement.classList.add(className);
    updatePanelButtons();
  }, normalizeHoverDelay(settings.hoverRevealDelay));
}

function clearHoverRevealTimer() {
  window.clearTimeout(hoverRevealTimer);
  hoverRevealTimer = 0;
  pendingHoverClass = '';
  hoverRevealRequestId += 1;
}

function clearHoverRevealClasses() {
  document.documentElement.classList.remove('ytzt-reveal-header', ...META_REVEAL_CLASSES, ...PLAYLIST_REVEAL_CLASSES);
}

/** @param {string} className */
function canRevealHoverClass(className) {
  if (!zenEnabled || !isWatchPage() || document.fullscreenElement || usesNativeTheater()) {
    return false;
  }

  if (className === 'ytzt-reveal-meta-hover') {
    return detailsUseHover();
  }

  if (className === 'ytzt-reveal-playlist-hover') {
    return (
      playlistUsesHover() &&
      hasPlaylistPanel()
    );
  }

  return false;
}

/** @param {number} delay */
function normalizeHoverDelay(delay) {
  const numericDelay = Number(delay);

  if (!Number.isFinite(numericDelay)) {
    return DEFAULT_SETTINGS.hoverRevealDelay;
  }

  return Math.min(1000, Math.max(0, numericDelay));
}

function hasPlaylistPanel() {
  return Boolean(getVisiblePlaylistPanel());
}

function getVisiblePlaylistPanel() {
  return (
    getPlaylistPanels().find((panel) => {
      return Boolean(panel.querySelector('ytd-playlist-panel-video-renderer'));
    }) || null
  );
}

function getPlaylistPanels() {
  return Array.from(
    document.querySelectorAll(
      [
        'ytd-watch-flexy[theater] #secondary ytd-playlist-panel-renderer',
        'ytd-watch-flexy[theater] #secondary ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-playlist"] ytd-playlist-panel-renderer'
      ].join(', ')
    )
  );
}

function getPlaylistScrollContainers() {
  return getPlaylistPanels()
    .flatMap((panel) => Array.from(panel.querySelectorAll('#items, #contents')))
    .filter((element) => element.scrollHeight > element.clientHeight);
}

function ensurePlaylistPanelOpen() {
  if (!hasPlaylistContext()) {
    playlistOpenRequested = false;

    return;
  }

  if (hasPlaylistPanel()) {
    playlistOpenRequested = false;

    return;
  }

  const panel = getPlaylistPanels()[0];

  if (!panel || !isPlaylistPanelCollapsed(panel) || playlistOpenRequested) {
    return;
  }

  const toggle = panel.querySelector('#header-top-row > #trailing-button button, #header-top-row > #trailing-button');

  if (!(toggle instanceof HTMLElement)) {
    return;
  }

  playlistOpenRequested = true;
  toggle.click();
  scheduleApply(250);
  scheduleApply(900);
}

/** @param {Element} panel */
function isPlaylistPanelCollapsed(panel) {
  if (panel.hasAttribute('collapsed')) {
    return true;
  }

  const toggle = panel.querySelector('#header-top-row > #trailing-button button, #header-top-row > #trailing-button');
  const expanded = toggle?.getAttribute('aria-expanded');

  if (expanded === 'false') {
    return true;
  }

  if (expanded === 'true') {
    return false;
  }

  const items = panel.querySelector('#items');

  return items instanceof HTMLElement && items.hidden;
}

function hasPlaylistContext() {
  const params = new URLSearchParams(location.search);

  return Boolean(params.get('list')) || getPlaylistPanels().length > 0;
}

/** @param {boolean} shouldObserve */
function syncLiveChatObserver(shouldObserve) {
  if (!shouldObserve || !zenEnabled || !isWatchPage() || document.fullscreenElement) {
    detachLiveChatObserver();

    return;
  }

  const nextFrame = getLiveChatFrameHost();

  if (nextFrame !== liveChatFrame) {
    clearLiveChatLookupTimer();
    liveChatControlObserver?.disconnect();
    liveChatControlObserver = null;
    liveChatControlObserverRoot = null;
    liveChatFrame = nextFrame;
    liveChatLifecycleToken += 1;
    chatClickCount = 0;
    chatLookupAttemptCount = 0;
    liveChatLookupRestartCount = 0;
    liveChatCloseResolved = false;
    liveChatOpenObserved = false;
    liveChatHideClickPending = false;

    if (nextFrame) {
      scheduleLiveChatLookup(true);
    }
  }

  const nextRoot = nextFrame?.parentElement?.parentElement || nextFrame?.parentElement || getLiveChatObserverRoot();

  if (nextRoot && nextRoot !== liveChatObserverRoot) {
    liveChatObserver?.disconnect();
    liveChatObserverRoot = nextRoot;
    liveChatObserver = new MutationObserver(handleLiveChatMutations);
    liveChatObserver.observe(nextRoot, {
      childList: true,
      subtree: true
    });
  }

  if (nextFrame && nextFrame !== liveChatControlObserverRoot) {
    liveChatControlObserver?.disconnect();
    liveChatControlObserverRoot = nextFrame;
    liveChatControlObserver = new MutationObserver(handleLiveChatMutations);
    liveChatControlObserver.observe(nextFrame, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: LIVE_CHAT_ATTRIBUTE_FILTER
    });
  }

  const nextFrameIframe = getLiveChatFrameIframe();

  if (nextFrameIframe !== liveChatFrameIframe) {
    liveChatFrameIframe?.removeEventListener('load', handleLiveChatFrameLoad);
    liveChatFrameIframe = nextFrameIframe;
    liveChatFrameIframe?.addEventListener('load', handleLiveChatFrameLoad);
  }

  const nextFrameDocument = getLiveChatFrameDocument();

  if (nextFrameDocument !== liveChatFrameDocumentRoot) {
    liveChatFrameDocumentObserver?.disconnect();
    liveChatFrameDocumentRoot = nextFrameDocument;
    liveChatFrameDocumentObserver = null;
    resetLiveChatRetryLifecycle();

    if (nextFrameDocument) {
      liveChatFrameDocumentObserver = new MutationObserver(handleLiveChatMutations);
      liveChatFrameDocumentObserver.observe(nextFrameDocument, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: LIVE_CHAT_ATTRIBUTE_FILTER
      });
    }

    if (nextFrame) {
      scheduleLiveChatLookup(true);
    }
  }
}

function detachLiveChatObserver() {
  clearLiveChatLookupTimer();
  liveChatLifecycleToken += 1;
  liveChatObserver?.disconnect();
  liveChatControlObserver?.disconnect();
  liveChatFrameDocumentObserver?.disconnect();
  liveChatObserver = null;
  liveChatControlObserver = null;
  liveChatControlObserverRoot = null;
  liveChatObserverRoot = null;
  liveChatFrame = null;
  liveChatFrameIframe?.removeEventListener('load', handleLiveChatFrameLoad);
  liveChatFrameIframe = null;
  liveChatFrameDocumentObserver = null;
  liveChatFrameDocumentRoot = null;
}

function clearLiveChatLookupTimer() {
  window.clearTimeout(liveChatLookupTimer);
  liveChatLookupTimer = 0;
}

function getLiveChatFrameHost() {
  return document.querySelector('ytd-live-chat-frame#chat, ytd-live-chat-frame');
}

/** @returns {HTMLIFrameElement|null} */
function getLiveChatFrameIframe() {
  const chatFrame = getLiveChatFrameHost();
  const iframe = chatFrame ? deepQuerySelector(chatFrame, 'iframe') : null;

  return isIframeElement(iframe) ? iframe : null;
}

function handleLiveChatFrameLoad() {
  syncLiveChatObserver(true);
}

function getLiveChatObserverRoot() {
  return (
    document.querySelector('ytd-watch-flexy') ||
    document.querySelector('ytd-page-manager, #page-manager, #content') ||
    document.body
  );
}

/** @param {MutationRecord[]} records */
function handleLiveChatMutations(records) {
  if (!settings.hideLiveChat || !zenEnabled || !isWatchPage() || document.fullscreenElement || usesNativeTheater()) {
    return;
  }

  syncLiveChatObserver(true);
  let foundRelevantMutation = false;

  for (const record of records) {
    if (isExtensionOwnedNode(record.target)) {
      continue;
    }

    if (isLiveChatCollapseMutation(record)) {
      resolveCollapsedLiveChat();
      continue;
    }

    if (isLiveChatReopenMutation(record)) {
      resetLiveChatRetryLifecycle();
      foundRelevantMutation = true;
      continue;
    }

    if (isRelevantLiveChatMutation(record)) {
      foundRelevantMutation = true;
      break;
    }
  }

  if (foundRelevantMutation) {
    scheduleLiveChatLookup(true);
  }
}

/** @param {MutationRecord} record @returns {boolean} */
function isLiveChatCollapseMutation(record) {
  const target = isElementLike(record.target) ? record.target : record.target.parentElement;

  return Boolean(
    record.type === 'attributes' &&
    record.attributeName === 'collapsed' &&
    target &&
    target === liveChatFrame &&
    target.hasAttribute('collapsed')
  );
}

/** @param {MutationRecord} record @returns {boolean} */
function isLiveChatReopenMutation(record) {
  const target = isElementLike(record.target) ? record.target : record.target.parentElement;

  return Boolean(
    record.type === 'attributes' &&
    record.attributeName === 'collapsed' &&
    target &&
    target === liveChatFrame &&
    !target.hasAttribute('collapsed')
  );
}

/** @param {Node|null} node */
function isExtensionOwnedNode(node) {
  const element = isElementLike(node) ? node : node?.parentElement;

  return Boolean(
    element?.closest(
      '.ytzt-header-hover-zone, .ytzt-meta-hover-zone, .ytzt-playlist-hover-zone, .ytzt-meta-drawer-button, .ytzt-playlist-drawer-button'
    )
  );
}

/** @param {MutationRecord} record */
function isRelevantLiveChatMutation(record) {
  const target = isElementLike(record.target) ? record.target : record.target.parentElement;
  const frame = liveChatFrame;

  const inFrameDocument = Boolean(
    target && liveChatFrameDocumentRoot && target.ownerDocument === liveChatFrameDocumentRoot
  );

  if (record.type === 'attributes') {
    return Boolean(
      target &&
      ((target === frame && record.attributeName === 'collapsed' && !target.hasAttribute('collapsed')) ||
        ((isDescendantOrSelf(target, frame) || inFrameDocument) && isChatControlArea(target)))
    );
  }

  if (record.type !== 'childList') {
    return false;
  }

  const addedNodes = Array.from(record.addedNodes);

  if (addedNodes.some(isLiveChatFrameNode)) {
    return true;
  }

  if (!target || (!isDescendantOrSelf(target, frame) && !inFrameDocument)) {
    return false;
  }

  if (isChatControlArea(target)) {
    return addedNodes.length > 0;
  }

  return addedNodes.some(nodeContainsLiveChatCloseControl);
}

/** @param {Node|unknown} node @returns {boolean} */
function isLiveChatFrameNode(node) {
  return isElementLike(node) && node.tagName.toLowerCase() === 'ytd-live-chat-frame';
}

/** @param {Element} element @returns {boolean} */
function isChatControlArea(element) {
  return Boolean(
    findChatControlContainer(element) ||
    (isChatControlLike(element) && (isSemanticChatCloseControl(element) || hasChatCloseLabel(element))) ||
    element === liveChatFrame
  );
}

/** @param {Element} element @returns {boolean} */
function hasChatCloseLabel(element) {
  const label = [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();

  return label.includes('hide chat') || label.includes('close chat');
}

/** @param {Element} element */
function hasChatOpenLabel(element) {
  const label = [element.getAttribute('aria-label'), element.getAttribute('title'), element.textContent]
    .filter(Boolean)
    .join(' ')
    .trim()
    .toLowerCase();

  return label.includes('show chat') || label.includes('open chat');
}

/** @param {unknown} value @returns {value is Element} */
function isElementLike(value) {
  if (!isObjectValue(value)) {
    return false;
  }

  return 'nodeType' in value && value.nodeType === 1 && 'getAttribute' in value && 'getBoundingClientRect' in value;
}

/** @param {Node|unknown} node */
function nodeContainsLiveChatCloseControl(node) {
  if (!isQueryableNode(node)) {
    return false;
  }

  if (isElementLike(node) && isSemanticChatCloseControl(node)) {
    return true;
  }

  return Array.from(node.querySelectorAll(CHAT_TEXT_SELECTORS.join(', '))).some(isSemanticChatCloseControl);
}

/**
 * @typedef {Node & {querySelectorAll: (selectors: string) => NodeListOf<Element>}} QueryableNode
 */

/** @param {unknown} value @returns {value is QueryableNode} */
function isQueryableNode(value) {
  return isObjectValue(value) && 'querySelectorAll' in value;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isObjectValue(value) {
  return Boolean(value && Object(value) === value);
}

function resetLiveChatRetryLifecycle() {
  clearLiveChatLookupTimer();
  liveChatLifecycleToken += 1;
  chatClickCount = 0;
  chatLookupAttemptCount = 0;
  liveChatLookupRestartCount = 0;
  liveChatCloseResolved = false;
  liveChatOpenObserved = false;
  liveChatHideClickPending = false;
}

function resolveCollapsedLiveChat() {
  clearLiveChatLookupTimer();
  liveChatLifecycleToken += 1;
  chatLookupAttemptCount = 0;
  liveChatCloseResolved = true;
  liveChatOpenObserved = true;
  liveChatHideClickPending = false;
}

function scheduleLiveChatLookup(resetAttempts = false) {
  if (!settings.hideLiveChat || !zenEnabled || !isWatchPage() || document.fullscreenElement || usesNativeTheater()) {
    return;
  }

  if (resetAttempts) {
    if (chatLookupAttemptCount >= MAX_LIVE_CHAT_LOOKUPS) {
      if (liveChatLookupRestartCount >= MAX_LIVE_CHAT_LOOKUP_RESTARTS) {
        return;
      }

      liveChatLookupRestartCount += 1;
      chatLookupAttemptCount = 0;
    }

    if (!getLiveChatFrameHost()?.hasAttribute('collapsed')) {
      liveChatCloseResolved = false;
    }
  }

  if (liveChatCloseResolved) {
    return;
  }

  if (liveChatLookupTimer || !hasLiveChatRetryBudget()) {
    return;
  }

  const lifecycleToken = liveChatLifecycleToken;
  liveChatLookupTimer = window.setTimeout(() => {
    liveChatLookupTimer = 0;

    if (lifecycleToken !== liveChatLifecycleToken || !settings.hideLiveChat || !zenEnabled || !isWatchPage() || document.fullscreenElement || usesNativeTheater()) {
      return;
    }

    if (getLiveChatFrameHost()?.hasAttribute('collapsed')) {
      resolveCollapsedLiveChat();

      return;
    }

    if (!liveChatHideClickPending) {
      hideLiveChatByClick();
    }

    if (getLiveChatFrameHost()?.hasAttribute('collapsed')) {
      resolveCollapsedLiveChat();

      return;
    }

    if (liveChatHideClickPending) {
      return;
    }

    if (liveChatOpenObserved && !liveChatCloseResolved && hasLiveChatRetryBudget()) {
      scheduleLiveChatLookup();
    }
  }, 250);
}

function hasLiveChatRetryBudget() {
  return chatClickCount < MAX_LIVE_CHAT_CLICKS && chatLookupAttemptCount < MAX_LIVE_CHAT_LOOKUPS;
}

function hideLiveChatByClick() {
  const chatFrame = getLiveChatFrameHost();

  if (!chatFrame) {
    chatLookupAttemptCount = 0;

    if (liveChatOpenObserved) {
      liveChatCloseResolved = true;
    }

    return;
  }

  const chatCollapsed = chatFrame.hasAttribute('collapsed');

  if (chatCollapsed) {
    liveChatHideClickPending = false;
    resolveCollapsedLiveChat();

    return;
  }

  liveChatOpenObserved = true;

  if (!hasLiveChatRetryBudget() || liveChatHideClickPending) {
    return;
  }

  chatLookupAttemptCount += 1;
  const chatFrameDocument = getLiveChatFrameDocument();

  const closeButton =
    findFirstValid(CHAT_CLOSE_SELECTORS, chatFrame, isUsableChatCloseControl) ||
    findFirstValid(CHAT_TEXT_SELECTORS, chatFrame, isUsableChatCloseControl) ||
    (chatFrameDocument &&
      (findFirstValid(CHAT_CLOSE_SELECTORS, chatFrameDocument, isUsableChatCloseControl) ||
        findFirstValid(CHAT_TEXT_SELECTORS, chatFrameDocument, isUsableChatCloseControl)));

  if (!isClickableElement(closeButton)) {
    return;
  }

  chatClickCount += 1;
  chatLookupAttemptCount = 0;
  liveChatHideClickPending = true;
  closeButton.click();
}

/** @param {Element|null} element @returns {element is Element & {click: () => void}} */
function isClickableElement(element) {
  return isElementLike(element) && 'click' in element && isCallable(element.click);
}

/** @param {Element} element @returns {boolean} */
function isUsableChatCloseControl(element) {
  return isSemanticChatCloseControl(element) && isClickableElement(element);
}

/** @param {unknown} value @returns {value is (...args: never[]) => unknown} */
function isCallable(value) {
  return Object.prototype.toString.call(value) === '[object Function]';
}

/** @param {Element|null} element */
function isSemanticChatCloseControl(element) {
  if (
    !isElementLike(element) ||
    !isVisible(element) ||
    !isChatControlLike(element) ||
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true'
  ) {
    return false;
  }

  if (hasChatOpenLabel(element)) {
    return false;
  }

  if (findChatControlContainer(element)) {
    return true;
  }

  return hasChatCloseLabel(element);
}

/** @param {Element} element @returns {Element|null} */
function findChatControlContainer(element) {
  let current = element;

  while (current) {
    if (current.id === 'show-hide-button' || current.id === 'close-button') {
      return current;
    }

    const parent = current.parentElement;

    if (!parent) {
      break;
    }

    current = parent;
  }

  return null;
}

/** @param {Element} element @returns {boolean} */
function isChatControlLike(element) {
  const tagName = element.tagName.toLowerCase();
  const role = element.getAttribute('role')?.toLowerCase();

  return (
    tagName === 'button' ||
    role === 'button' ||
    tagName === 'tp-yt-paper-button' ||
    tagName === 'yt-button-shape' ||
    element.id === 'button' ||
    Boolean(findChatControlContainer(element))
  );
}

function getLiveChatFrameDocument() {
  const chatFrame = document.querySelector('ytd-live-chat-frame#chat, ytd-live-chat-frame');
  const iframe = chatFrame ? deepQuerySelector(chatFrame, 'iframe') : null;

  if (!isIframeElement(iframe)) {
    return null;
  }

  try {
    return iframe.contentDocument;
  } catch {
    return null;
  }
}

/** @param {unknown} value @returns {value is HTMLIFrameElement} */
function isIframeElement(value) {
  return isElementLike(value) && value.tagName.toLowerCase() === 'iframe';
}

/**
 * @param {string[]} selectors
 * @param {Document|Element|ShadowRoot} [root=document]
 * @returns {Element|null}
 */
function findFirst(selectors, root = document) {
  for (const selector of selectors) {
    const element = deepQuerySelector(root, selector);

    if (element) {
      return element;
    }
  }

  return null;
}

/**
 * @param {string[]} selectors
 * @param {Document|Element|ShadowRoot} root
 * @param {(element: Element) => boolean} predicate
 * @returns {Element|null}
 */
function findFirstValid(selectors, root, predicate) {
  for (const selector of selectors) {
    const element = deepQuerySelectorAll(root, selector).find(predicate);

    if (element) {
      return element;
    }
  }

  return null;
}

/**
 * @param {Document|Element|ShadowRoot} root
 * @param {string} selector
 * @returns {Element|null}
 */
function deepQuerySelector(root, selector) {
  const direct = root.querySelector?.(selector);

  if (direct) {
    return direct;
  }

  const nodes = Array.from(root.querySelectorAll?.('*') || []);

  for (const node of nodes) {
    if (!node.shadowRoot) {
      continue;
    }

    const match = deepQuerySelector(node.shadowRoot, selector);

    if (match) {
      return match;
    }
  }

  return null;
}

/**
 * @param {Document|Element|ShadowRoot} root
 * @param {string} selector
 * @returns {Element[]}
 */
function deepQuerySelectorAll(root, selector) {
  const matches = Array.from(root.querySelectorAll?.(selector) || []);
  const descendants = Array.from(root.querySelectorAll?.('*') || []);

  for (const node of descendants) {
    if (!node.shadowRoot) {
      continue;
    }

    matches.push(...deepQuerySelectorAll(node.shadowRoot, selector));
  }

  return [...new Set(matches)];
}

/** @param {Element} element */
function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);

  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function isVideoContextMenuOpen() {
  return [...document.querySelectorAll('.ytp-contextmenu')].some(isVisible);
}

function handleNavigation() {
  const previousTarget = watchNavigationTarget(currentUrl);
  const nextTarget = watchNavigationTarget(location.href);
  const targetChanged = previousTarget !== nextTarget;
  currentUrl = location.href;

  if (targetChanged) {
    window.cancelAnimationFrame(nativeResizeFrame);
    window.clearTimeout(nativeResizeTimer);
    nativeResizeGeneration += 1;
    resetWatchSurfaceState();
    applyStartupPreference();
  }

  syncLiveChatObserver(false);
  scheduleApply(250);
  scheduleApply(900);
}

/** @param {KeyboardEvent} event */
function handleShortcut(event) {
  if (document.fullscreenElement) {
    shortcutKeyActive = false;

    return;
  }

  if (handledShortcutEvents.has(event)) {
    return;
  }

  const isTKey = event.code === 'KeyT' || event.key?.toLowerCase() === 't';

  if (!isTKey) {
    return;
  }

  if (event.type !== 'keydown' && !shortcutKeyActive) {
    return;
  }

  if (
    event.type === 'keydown' &&
    (event.defaultPrevented ||
      event.metaKey ||
      event.ctrlKey ||
      event.altKey ||
      !isWatchPage() ||
      shortcutPathHasEditable(event))
  ) {
    shortcutKeyActive = false;

    return;
  }

  if (event.type === 'keydown' && settings.zenShortcut === 'shift-t' && !event.shiftKey) {
    shortcutKeyActive = false;
    nativeTheaterRequested = false;

    if (zenEnabled) {
      zenEnabled = false;
      resetWatchSurfaceState();
      applyZen();
    }

    return;
  }

  if (event.type === 'keydown' && !settings.shortcutEnabled) {
    shortcutKeyActive = false;

    return;
  }

  if (event.type === 'keydown') {
    const now = Date.now();

    if (shortcutKeyActive && now - lastShortcutAt > 350 && !event.repeat) {
      shortcutKeyActive = false;
    }

    if (shortcutKeyActive || event.repeat) {
      markShortcutHandled(event);

      return;
    }

    lastShortcutAt = now;
    shortcutKeyActive = true;
    markShortcutHandled(event);
    toggleZenMode();

    return;
  }

  if (!isWatchPage()) {
    shortcutKeyActive = false;

    return;
  }

  markShortcutHandled(event);

  if (event.type === 'keyup') {
    shortcutKeyActive = false;
  }
}

/** @param {KeyboardEvent} event */
function markShortcutHandled(event) {
  handledShortcutEvents.add(event);
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

/** @param {KeyboardEvent} event */
function shortcutPathHasEditable(event) {
  const path = event.composedPath?.() || [event.target];

  return path.some((node) => isEditableTarget(node));
}

/**
 * @param {EventTarget|null} target
 * @returns {boolean}
 */
function isEditableTarget(target) {
  const element = target instanceof Element ? target : null;

  if (!element) {
    return false;
  }

  return (
    (element instanceof HTMLElement && element.isContentEditable) ||
    Boolean(element.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'))
  );
}
