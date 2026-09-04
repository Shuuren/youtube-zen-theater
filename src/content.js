const DEFAULT_SETTINGS = {
  autoZen: true,
  hideLiveChat: true,
  hideHeader: true,
  hideRecommendations: true,
  revealHeaderOnHover: true,
  revealMetaOnHover: true,
  revealPlaylistOnHover: true,
  sideRevealMode: 'drawer',
  drawerImplementation: 'custom',
  revealSideLayout: 'separate',
  sideHoverPosition: 'right',
  sameSideSplit: 'playlist-top',
  hoverRevealDelay: 140,
  drawerGlassEffect: true,
  shortcutEnabled: true
};

const CHAT_CLOSE_SELECTORS = [
  'ytd-live-chat-frame#chat:not([collapsed]) #show-hide-button button',
  'ytd-live-chat-frame#chat:not([collapsed]) #show-hide-button #button',
  'ytd-live-chat-frame#chat:not([collapsed]) #show-hide-button tp-yt-paper-button',
  'ytd-live-chat-frame#chat:not([collapsed]) yt-button-shape button',
  'ytd-live-chat-frame#chat:not([collapsed]) #close-button button',
  'ytd-live-chat-frame#chat:not([collapsed]) #close-button #button',
  'ytd-live-chat-frame#chat:not([collapsed]) button[title*="Close"]',
  'ytd-live-chat-frame#chat:not([collapsed]) button[title*="Hide"]',
  'ytd-live-chat-frame#chat:not([collapsed]) button[aria-label*="Close"]',
  'ytd-live-chat-frame#chat:not([collapsed]) button[aria-label*="Hide"]',
  '#chat:not([collapsed]) #show-hide-button button',
  '#chat:not([collapsed]) #close-button button',
  '#chat:not([collapsed]) button[aria-label*="Close"]',
  '#chat:not([collapsed]) button[aria-label*="Hide"]'
];

const THEATER_BUTTON_SELECTORS = [
  '.ytp-size-button',
  'button.ytp-size-button',
  '.html5-video-player .ytp-size-button'
];

const WATCH_URL_PATTERN = /^\/watch\b|^\/live\//;
const LIVE_CHAT_URL_PATTERN = /^\/live_chat\b|^\/live_chat_replay\b/;
const META_REVEAL_CLASSES = ['ytzt-reveal-meta-hover', 'ytzt-reveal-meta-drawer'];
const PLAYLIST_REVEAL_CLASSES = ['ytzt-reveal-playlist-hover', 'ytzt-reveal-playlist-drawer'];

let settings = { ...DEFAULT_SETTINGS };
let currentUrl = location.href;
const applyTimers = new Map();
let observer = null;
let observerTimer = 0;
let chatClickCount = 0;
let liveChatCloseResolved = false;
let liveChatOpenObserved = false;
let wideCookieWritten = false;
let zenEnabled = DEFAULT_SETTINGS.autoZen;
let headerHoverZone = null;
let metaHoverZone = null;
let metaDrawerButton = null;
let playlistHoverZone = null;
let playlistDrawerButton = null;
let lastShortcutAt = 0;
let hoverRevealTimer = 0;
let pendingHoverClass = '';
let playlistOpenRequested = false;

bootWhenDocumentReady();

function bootWhenDocumentReady() {
  if (document.documentElement) {
    init();
    return;
  }

  window.setTimeout(bootWhenDocumentReady, 0);
}

function init() {
  loadSettings().then(() => {
    if (isLiveChatFramePage()) {
      bindFrameEvents();
      scheduleFrameChatClose(300);
      scheduleFrameChatClose(1200);
      return;
    }

    zenEnabled = settings.autoZen;
    startObserver();
    bindEvents();
    scheduleApply(0);
    scheduleApply(800);
  });
}

async function loadSettings() {
  if (!globalThis.chrome?.storage?.sync) {
    return;
  }

  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = { ...DEFAULT_SETTINGS, ...stored };
  normalizeRevealSettings();
}

function normalizeRevealSettings() {
  settings.revealSideLayout = ['same', 'separate'].includes(settings.revealSideLayout) ? settings.revealSideLayout : DEFAULT_SETTINGS.revealSideLayout;
  settings.sideHoverPosition = settings.sideHoverPosition === 'left' ? 'left' : 'right';
  settings.sameSideSplit = settings.sameSideSplit === 'details-top' ? 'details-top' : 'playlist-top';
}

function getMetaRevealSide() {
  return settings.sideHoverPosition === 'left' ? 'left' : 'right';
}

function getPlaylistRevealSide() {
  if (settings.revealSideLayout === 'same') {
    return getMetaRevealSide();
  }

  return getMetaRevealSide() === 'left' ? 'right' : 'left';
}

function getMetaHoverZone() {
  if (settings.revealSideLayout !== 'same') {
    return 'full';
  }

  return settings.sameSideSplit === 'details-top' ? 'top' : 'bottom';
}

function getPlaylistHoverZone() {
  if (settings.revealSideLayout !== 'same') {
    return 'full';
  }

  return settings.sameSideSplit === 'details-top' ? 'bottom' : 'top';
}

function bindFrameEvents() {
  chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'sync') {
      return;
    }

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
      }
    }

    normalizeRevealSettings();

    if (settings.hideLiveChat) {
      chatClickCount = 0;
      liveChatCloseResolved = false;
      liveChatOpenObserved = false;
      scheduleFrameChatClose(100);
    }
  });
}

function bindEvents() {
  window.addEventListener('yt-navigate-finish', () => {
    resetWatchSurfaceState();
    chatClickCount = 0;
    scheduleApply(250);
    scheduleApply(1000);
  });

  window.addEventListener('yt-page-data-fetched', () => {
    resetWatchSurfaceState();
    scheduleApply(200);
  });
  window.addEventListener('yt-page-data-updated', () => {
    resetWatchSurfaceState();
    scheduleApply(200);
  });
  window.addEventListener('yt-navigate-cache-restored', () => {
    resetWatchSurfaceState();
    scheduleApply(200);
  });
  window.addEventListener('ytd-player-updated', () => scheduleApply(120));
  window.addEventListener('popstate', () => scheduleApply(250));

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      scheduleApply(150);
    }
  });

  for (const eventName of ['keydown', 'keypress', 'keyup']) {
    window.addEventListener(eventName, handleShortcut, true);
    document.addEventListener(eventName, handleShortcut, true);
  }
  document.addEventListener('mousemove', handleHoverReveal, true);
  document.addEventListener('wheel', handleDrawerWheel, { capture: true, passive: false });

  chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'sync') {
      return;
    }

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
      }
    }

    normalizeRevealSettings();

    if (!settings.autoZen) {
      zenEnabled = false;
    }

    if (settings.autoZen && isWatchPage()) {
      zenEnabled = true;
    }

    if (changes.hideLiveChat) {
      chatClickCount = 0;
      liveChatCloseResolved = false;
      liveChatOpenObserved = false;
    }

    scheduleApply(0);
  });
}

function isWatchPage() {
  return WATCH_URL_PATTERN.test(location.pathname);
}

function isLiveChatFramePage() {
  return LIVE_CHAT_URL_PATTERN.test(location.pathname);
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

function applyZen() {
  const watchPage = isWatchPage();
  const active = zenEnabled && watchPage;
  if (active && document.documentElement.classList.contains('ytzt-watch-page') && isVideoContextMenuOpen()) {
    return;
  }

  const drawerIsNative = settings.drawerImplementation === 'native';
  const drawerIsCustom = !drawerIsNative;
  const shouldRevealMeta = active && settings.revealMetaOnHover;
  const metaSide = getMetaRevealSide();
  const playlistSide = getPlaylistRevealSide();
  const canRevealPlaylist = active && settings.revealPlaylistOnHover && drawerIsCustom;
  if (canRevealPlaylist) {
    ensurePlaylistPanelOpen();
  }
  const hasPlaylist = canRevealPlaylist && hasPlaylistPanel();

  document.documentElement.classList.toggle('ytzt-watch-page', active);
  document.documentElement.classList.toggle('ytzt-hide-header', active && settings.hideHeader);
  document.documentElement.classList.toggle('ytzt-hide-recommendations', active && settings.hideRecommendations);
  document.documentElement.classList.toggle('ytzt-reveal-header-enabled', active && settings.hideHeader && settings.revealHeaderOnHover);
  document.documentElement.classList.toggle('ytzt-reveal-meta-enabled', shouldRevealMeta);
  document.documentElement.classList.toggle('ytzt-reveal-playlist-enabled', hasPlaylist);
  document.documentElement.classList.toggle('ytzt-side-mode-hover', active && settings.sideRevealMode === 'hover');
  document.documentElement.classList.toggle('ytzt-side-mode-drawer', active && settings.sideRevealMode !== 'hover');
  document.documentElement.classList.toggle('ytzt-drawer-custom', active && drawerIsCustom);
  document.documentElement.classList.toggle('ytzt-drawer-native', active && drawerIsNative);
  document.documentElement.classList.toggle('ytzt-side-left', active && metaSide === 'left');
  document.documentElement.classList.toggle('ytzt-side-right', active && metaSide !== 'left');
  document.documentElement.classList.toggle('ytzt-playlist-left', hasPlaylist && playlistSide === 'left');
  document.documentElement.classList.toggle('ytzt-playlist-right', hasPlaylist && playlistSide !== 'left');
  document.documentElement.classList.toggle('ytzt-drawer-glass', active && settings.drawerGlassEffect);
  document.documentElement.classList.toggle('ytzt-drawer-solid', active && drawerIsCustom && !settings.drawerGlassEffect);
  syncHoverZones(active);

  if (!active) {
    chatClickCount = 0;
    liveChatCloseResolved = false;
    liveChatOpenObserved = false;
    clearHoverRevealTimer();
    document.documentElement.classList.remove('ytzt-reveal-header', 'ytzt-reveal-meta', ...META_REVEAL_CLASSES, ...PLAYLIST_REVEAL_CLASSES);
    return;
  }

  setWideCookie();
  requestAnimationFrame(() => {
    forceNativeTheater();
    suppressCinematicBackdrop();
    if (settings.hideLiveChat) {
      hideLiveChatByClick();
    }
  });
}

function setWideCookie() {
  if (wideCookieWritten) {
    return;
  }

  const expires = 'Fri, 31 Dec 9999 23:59:59 GMT';
  document.cookie = `wide=1; domain=.youtube.com; path=/; expires=${expires}; SameSite=Lax`;
  wideCookieWritten = true;
}

function forceNativeTheater() {
  const watchFlexy = document.querySelector('ytd-watch-flexy');
  if (watchFlexy?.hasAttribute('theater')) {
    return;
  }

  const button = findFirst(THEATER_BUTTON_SELECTORS);
  if (button && isVisible(button)) {
    button.click();
  }
}

function suppressCinematicBackdrop() {
  const player = document.querySelector('.html5-video-player');
  player?.classList.remove('ytp-player-minimized');

  for (const element of document.querySelectorAll('#cinematics, #cinematics-container, .ytp-cinematic-container')) {
    element.setAttribute('hidden', '');
    element.style.display = 'none';
  }
}

function toggleZenMode() {
  const nextEnabled = !zenEnabled;
  if (!nextEnabled) {
    resetWatchSurfaceState();
  }

  zenEnabled = nextEnabled;
  scheduleApply(0);
  scheduleApply(600);
}

function syncHoverZones(active) {
  const wantsHeaderZone = active && settings.hideHeader && settings.revealHeaderOnHover;
  const wantsMetaZone = active && settings.revealMetaOnHover && settings.sideRevealMode === 'hover';
  const wantsMetaDrawerButton = active && settings.revealMetaOnHover && settings.sideRevealMode !== 'hover';
  const wantsPlaylist = active && settings.revealPlaylistOnHover && settings.drawerImplementation !== 'native' && hasPlaylistPanel();
  const playlistUsesCustomDrawer = settings.drawerImplementation !== 'native';
  const wantsPlaylistZone = wantsPlaylist && playlistUsesCustomDrawer && settings.sideRevealMode === 'hover';
  const wantsPlaylistDrawerButton = wantsPlaylist && playlistUsesCustomDrawer && settings.sideRevealMode !== 'hover';

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
    playlistHoverZone = syncHoverZone(playlistHoverZone, 'ytzt-playlist-hover-zone', true, 'ytzt-reveal-playlist-hover');
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

function syncMetaDrawerButton(button, shouldExist) {
  if (!shouldExist) {
    button?.remove();
    document.documentElement.classList.remove('ytzt-reveal-meta-drawer');
    return null;
  }

  if (button?.isConnected) {
    updateMetaDrawerButton(button);
    return button;
  }

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'ytzt-meta-drawer-button';
  nextButton.addEventListener('click', toggleMetaDrawer);
  document.documentElement.append(nextButton);
  updateMetaDrawerButton(nextButton);
  return nextButton;
}

function syncPlaylistDrawerButton(button, shouldExist) {
  if (!shouldExist) {
    button?.remove();
    document.documentElement.classList.remove('ytzt-reveal-playlist-drawer');
    return null;
  }

  if (button?.isConnected) {
    updatePlaylistDrawerButton(button);
    return button;
  }

  const nextButton = document.createElement('button');
  nextButton.type = 'button';
  nextButton.className = 'ytzt-playlist-drawer-button';
  nextButton.addEventListener('click', togglePlaylistDrawer);
  document.documentElement.append(nextButton);
  updatePlaylistDrawerButton(nextButton);
  return nextButton;
}

function toggleMetaDrawer(event) {
  event?.preventDefault();
  event?.stopPropagation();
  event?.stopImmediatePropagation();

  const nextOpen = !document.documentElement.classList.contains('ytzt-reveal-meta-drawer');
  document.documentElement.classList.toggle('ytzt-reveal-meta-drawer', nextOpen);
  if (nextOpen) {
    document.documentElement.classList.remove(...PLAYLIST_REVEAL_CLASSES);
  }
  document.documentElement.classList.remove('ytzt-reveal-meta');
  if (metaDrawerButton) {
    updateMetaDrawerButton(metaDrawerButton);
  }
  if (playlistDrawerButton) {
    updatePlaylistDrawerButton(playlistDrawerButton);
  }
}

function togglePlaylistDrawer(event) {
  event?.preventDefault();
  event?.stopPropagation();
  event?.stopImmediatePropagation();

  const nextOpen = !document.documentElement.classList.contains('ytzt-reveal-playlist-drawer');
  document.documentElement.classList.toggle('ytzt-reveal-playlist-drawer', nextOpen);
  if (nextOpen) {
    document.documentElement.classList.remove(...META_REVEAL_CLASSES);
  }
  if (playlistDrawerButton) {
    updatePlaylistDrawerButton(playlistDrawerButton);
  }
  if (metaDrawerButton) {
    updateMetaDrawerButton(metaDrawerButton);
  }
}

function updateMetaDrawerButton(button) {
  const isOpen = document.documentElement.classList.contains('ytzt-reveal-meta-drawer');
  const isLeftSide = getMetaRevealSide() === 'left';
  button.setAttribute('aria-label', `${isOpen ? 'Hide' : 'Show'} video details`);
  button.setAttribute('aria-expanded', String(isOpen));
  button.dataset.ytztDrawer = 'details';
  button.textContent = isOpen === isLeftSide ? '‹' : '›';
}

function updatePlaylistDrawerButton(button) {
  const isOpen = document.documentElement.classList.contains('ytzt-reveal-playlist-drawer');
  const isLeftSide = getPlaylistRevealSide() === 'left';
  button.setAttribute('aria-label', `${isOpen ? 'Hide' : 'Show'} playlist`);
  button.setAttribute('aria-expanded', String(isOpen));
  button.dataset.ytztDrawer = 'playlist';
  button.textContent = isOpen === isLeftSide ? '‹' : '›';
}

function clearMetaReveal() {
  document.documentElement.classList.remove('ytzt-reveal-meta', ...META_REVEAL_CLASSES);
}

function clearPlaylistReveal() {
  document.documentElement.classList.remove(...PLAYLIST_REVEAL_CLASSES);
}

function resetWatchSurfaceState() {
  clearHoverRevealTimer();
  playlistOpenRequested = false;
  liveChatOpenObserved = false;
  chatClickCount = 0;
  liveChatCloseResolved = false;
  document.documentElement.classList.remove('ytzt-reveal-meta', ...META_REVEAL_CLASSES, ...PLAYLIST_REVEAL_CLASSES);
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

function handleHoverReveal(event) {
  if (!zenEnabled || !isWatchPage()) {
    return;
  }

  const targetElement = event.target instanceof Element ? event.target : null;
  const isInsideMetaDrawer = Boolean(targetElement?.closest('ytd-watch-flexy[theater] #below'));
  const isInsidePlaylistDrawer = Boolean(targetElement?.closest('ytd-watch-flexy[theater] #secondary'));
  const canRevealHeader = settings.hideHeader && settings.revealHeaderOnHover;
  const canRevealMeta = settings.revealMetaOnHover && settings.sideRevealMode === 'hover';
  const canRevealPlaylist = settings.revealPlaylistOnHover && settings.drawerImplementation !== 'native' && settings.sideRevealMode === 'hover' && hasPlaylistPanel();
  const headerOpen = document.documentElement.classList.contains('ytzt-reveal-header');
  const metaOpen = isMetaRevealed();
  const playlistOpen = isPlaylistRevealed();
  const headerLimit = headerOpen ? 96 : 22;
  const metaLimit = metaOpen ? 460 : 28;
  const playlistLimit = playlistOpen ? 460 : 28;
  const sideRevealTopLimit = headerOpen ? 104 : 72;
  const sideRevealBottomLimit = 96;
  const isLeftSideReveal = getMetaRevealSide() === 'left';
  const isInsideMetaRevealEdge = isLeftSideReveal ? event.clientX <= metaLimit : event.clientX >= window.innerWidth - metaLimit;
  const isLeftPlaylistReveal = getPlaylistRevealSide() === 'left';
  const isInsidePlaylistRevealEdge = isLeftPlaylistReveal ? event.clientX <= playlistLimit : event.clientX >= window.innerWidth - playlistLimit;
  const isInsideMetaRevealBand = isInsideHoverZone(event.clientY, getMetaHoverZone(), sideRevealTopLimit, sideRevealBottomLimit);
  const isInsidePlaylistRevealBand = isInsideHoverZone(event.clientY, getPlaylistHoverZone(), sideRevealTopLimit, sideRevealBottomLimit);

  document.documentElement.classList.toggle('ytzt-reveal-header', canRevealHeader && event.clientY <= headerLimit);

  if (canRevealMeta) {
    setDelayedRevealClass('ytzt-reveal-meta-hover', isInsideMetaDrawer || (isInsideMetaRevealBand && isInsideMetaRevealEdge));
    if (isInsideMetaRevealBand && isInsideMetaRevealEdge) {
      document.documentElement.classList.remove('ytzt-reveal-meta', ...PLAYLIST_REVEAL_CLASSES);
    }
  }

  if (canRevealPlaylist) {
    setDelayedRevealClass('ytzt-reveal-playlist-hover', isInsidePlaylistDrawer || (isInsidePlaylistRevealBand && isInsidePlaylistRevealEdge));
    if (isInsidePlaylistRevealBand && isInsidePlaylistRevealEdge) {
      document.documentElement.classList.remove(...META_REVEAL_CLASSES);
    }
  }
}

function handleDrawerWheel(event) {
  if (!zenEnabled || !isWatchPage()) {
    return;
  }

  const scrollTarget = getWheelScrollTarget(event);
  if (!scrollTarget) {
    return;
  }

  const beforeTop = scrollTarget.scrollTop;
  scrollTarget.scrollTop += event.deltaY;
  if (scrollTarget.scrollTop !== beforeTop) {
    event.preventDefault();
    event.stopPropagation();
  }
}

function getWheelScrollTarget(event) {
  for (const playlistScrollContainer of getPlaylistScrollContainers()) {
    if (isPointInsideScrollable(event, playlistScrollContainer)) {
      return playlistScrollContainer;
    }
  }

  const metaDrawer = document.querySelector('ytd-watch-flexy[theater] #below');
  if (isPointInsideScrollable(event, metaDrawer)) {
    return metaDrawer;
  }

  const playlistDrawer = document.querySelector('ytd-watch-flexy[theater] #secondary');
  if (isPointInsideScrollable(event, playlistDrawer)) {
    return playlistDrawer;
  }

  return null;
}

function isPointInsideScrollable(event, element) {
  if (!element || element.scrollHeight <= element.clientHeight) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
}

function isInsideHoverZone(clientY, zone, topLimit, bottomLimit) {
  const usableTop = topLimit;
  const usableBottom = window.innerHeight - bottomLimit;
  const midpoint = usableTop + ((usableBottom - usableTop) / 2);

  if (zone === 'top') {
    return clientY > usableTop && clientY <= midpoint;
  }

  if (zone === 'bottom') {
    return clientY > midpoint && clientY < usableBottom;
  }

  return clientY > usableTop && clientY < usableBottom;
}

function setDelayedRevealClass(className, shouldReveal) {
  if (!shouldReveal) {
    if (pendingHoverClass === className) {
      clearHoverRevealTimer();
    }
    document.documentElement.classList.remove(className);
    return;
  }

  if (document.documentElement.classList.contains(className) || pendingHoverClass === className) {
    return;
  }

  clearHoverRevealTimer();
  pendingHoverClass = className;
  hoverRevealTimer = window.setTimeout(() => {
    pendingHoverClass = '';
    hoverRevealTimer = 0;
    document.documentElement.classList.add(className);
  }, normalizeHoverDelay(settings.hoverRevealDelay));
}

function clearHoverRevealTimer() {
  window.clearTimeout(hoverRevealTimer);
  hoverRevealTimer = 0;
  pendingHoverClass = '';
}

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
  return getPlaylistPanels().find((panel) => {
    return Boolean(panel.querySelector('ytd-playlist-panel-video-renderer'));
  }) || null;
}

function getPlaylistPanels() {
  return Array.from(document.querySelectorAll([
    'ytd-watch-flexy[theater] #secondary ytd-playlist-panel-renderer',
    'ytd-watch-flexy[theater] #secondary ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-playlist"] ytd-playlist-panel-renderer'
  ].join(', ')));
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

  if (playlistOpenRequested) {
    return;
  }

  const panel = getPlaylistPanels()[0];
  const toggle = panel?.querySelector('#header-top-row > #trailing-button button, #header-top-row > #trailing-button');
  if (!toggle) {
    return;
  }

  playlistOpenRequested = true;
  toggle.click();
  scheduleApply(250);
  scheduleApply(900);
}

function hasPlaylistContext() {
  const params = new URLSearchParams(location.search);
  return Boolean(params.get('list')) || getPlaylistPanels().length > 0;
}

function hideLiveChatByClick() {
  const chatFrame = document.querySelector('ytd-live-chat-frame#chat, ytd-live-chat-frame');
  if (!chatFrame) {
    if (liveChatOpenObserved) {
      liveChatCloseResolved = true;
    }
    return;
  }

  const chatCollapsed = chatFrame.hasAttribute('collapsed') || chatFrame.collapsed === true;
  if (chatCollapsed) {
    if (liveChatOpenObserved || chatClickCount > 0) {
      liveChatCloseResolved = true;
    }
    return;
  }

  liveChatOpenObserved = true;
  if (liveChatCloseResolved) {
    liveChatCloseResolved = false;
    chatClickCount = 0;
  }

  if (chatClickCount > 12) {
    return;
  }

  const chatFrameDocument = getLiveChatFrameDocument();
  const closeButton = findFirst(CHAT_CLOSE_SELECTORS) || findChatButtonByText() ||
    (chatFrameDocument && (findFirst(CHAT_CLOSE_SELECTORS, chatFrameDocument) || findFrameChatButtonByText(chatFrameDocument)));
  if (!closeButton || !isVisible(closeButton)) {
    return;
  }

  chatClickCount += 1;
  closeButton.click();
  scheduleApply(800);
}

function scheduleFrameChatClose(delay) {
  window.setTimeout(closeChatInsideFrame, delay);
}

function closeChatInsideFrame() {
  if (!settings.hideLiveChat) {
    return;
  }

  const candidates = [
    '#close-button button',
    '#close-button #button',
    'button[aria-label*="Close"]',
    'button[aria-label*="Hide"]',
    'yt-icon-button[aria-label*="Close"] button',
    'yt-icon-button[aria-label*="Hide"] button'
  ];

  const button = findFirst(candidates) || findFrameChatButtonByText();
  if (button && isVisible(button)) {
    button.click();
  }
}

function findFrameChatButtonByText(root = document) {
  const candidates = Array.from(root.querySelectorAll('button, [role="button"], #button'));
  return candidates.find((element) => {
    const label = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent
    ].filter(Boolean).join(' ').trim().toLowerCase();

    return label === 'close' || label === 'hide' || label.includes('close chat') || label.includes('hide chat');
  }) || null;
}

function findChatButtonByText() {
  const chatFrame = document.querySelector('ytd-live-chat-frame#chat, ytd-live-chat-frame');
  if (!chatFrame) {
    return null;
  }

  const candidates = Array.from(chatFrame.querySelectorAll('button, #button, tp-yt-paper-button, yt-button-shape'));
  return candidates.find((element) => {
    const label = [
      element.getAttribute('aria-label'),
      element.getAttribute('title'),
      element.textContent
    ].filter(Boolean).join(' ').toLowerCase();

    return label.includes('hide chat') || label.includes('close chat') || label === 'hide' || label === 'close';
  }) || null;
}

function getLiveChatFrameDocument() {
  const chatFrame = document.querySelector('ytd-live-chat-frame#chat, ytd-live-chat-frame');
  const iframe = chatFrame ? deepQuerySelector(chatFrame, 'iframe') : null;
  try {
    return iframe?.contentDocument || null;
  } catch {
    return null;
  }
}

function findFirst(selectors, root = document) {
  for (const selector of selectors) {
    const element = deepQuerySelector(root, selector);
    if (element) {
      return element;
    }
  }

  return null;
}

function deepQuerySelector(root, selector) {
  const direct = root.querySelector?.(selector);
  if (direct) {
    return direct;
  }

  const nodes = root.querySelectorAll?.('*') || [];
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

function isVisible(element) {
  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
}

function isVideoContextMenuOpen() {
  return [...document.querySelectorAll('.ytp-contextmenu')].some(isVisible);
}

function handleNavigation() {
  if (location.href === currentUrl) {
    return;
  }

  currentUrl = location.href;
  chatClickCount = 0;
  liveChatCloseResolved = false;
  resetWatchSurfaceState();
  if (settings.autoZen && isWatchPage()) {
    zenEnabled = true;
  }

  scheduleApply(250);
  scheduleApply(900);
}

function shouldApplyForMutation(record) {
  if (record.type === 'childList') {
    const target = record.target instanceof Element ? record.target : null;
    if (target?.closest('#movie_player, .html5-video-player')) {
      return false;
    }

    const changedNodes = [...record.addedNodes, ...record.removedNodes];
    return !changedNodes.some((node) => {
      const element = node instanceof Element ? node : node.parentElement;
      return element?.matches('.ytp-contextmenu') || Boolean(element?.querySelector('.ytp-contextmenu'));
    });
  }

  if (record.type !== 'attributes') {
    return true;
  }

  const target = record.target instanceof Element ? record.target : null;
  if (!target) {
    return false;
  }

  if (record.attributeName === 'theater') {
    return target.matches('ytd-watch-flexy');
  }

  if (record.attributeName === 'collapsed' || record.attributeName === 'hidden') {
    return target.matches('ytd-live-chat-frame') || Boolean(target.closest('ytd-live-chat-frame'));
  }

  return false;
}

function startObserver() {
  observer?.disconnect();
  window.clearTimeout(observerTimer);
  observerTimer = 0;

  observer = new MutationObserver((records) => {
    if (!records.some(shouldApplyForMutation)) {
      return;
    }

    if (observerTimer) {
      return;
    }

    observerTimer = window.setTimeout(() => {
      observerTimer = 0;
      if (isVideoContextMenuOpen()) {
        return;
      }

      handleNavigation();
      if (isWatchPage()) {
        scheduleApply(180);
      }
    }, 120);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['theater', 'collapsed', 'hidden']
  });
}

function handleShortcut(event) {
  if (event.ytztHandled || !settings.shortcutEnabled || event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) {
    return;
  }

  const isTKey = event.code === 'KeyT' || event.key?.toLowerCase() === 't';
  if (!isTKey || isEditableTarget(event.target)) {
    return;
  }

  const now = Date.now();
  if (event.repeat || now - lastShortcutAt < 350) {
    event.ytztHandled = true;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
    return;
  }

  lastShortcutAt = now;
  event.ytztHandled = true;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
  toggleZenMode();
}

function isEditableTarget(target) {
  const element = target instanceof Element ? target : null;
  if (!element) {
    return false;
  }

  return Boolean(element.closest('input, textarea, select, [contenteditable="true"], [contenteditable="plaintext-only"]'));
}
