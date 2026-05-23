const DEFAULT_SETTINGS = {
  autoZen: true,
  hideLiveChat: true,
  hideHeader: true,
  hideRecommendations: true,
  revealHeaderOnHover: true,
  revealMetaOnHover: true,
  sideHoverPosition: 'right',
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

let settings = { ...DEFAULT_SETTINGS };
let currentUrl = location.href;
let applyTimer = 0;
let observer = null;
let chatClickCount = 0;
let zenEnabled = DEFAULT_SETTINGS.autoZen;
let headerHoverZone = null;
let metaHoverZone = null;
let lastShortcutAt = 0;

init();

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

    if (settings.hideLiveChat) {
      scheduleFrameChatClose(100);
    }
  });
}

function bindEvents() {
  window.addEventListener('yt-navigate-finish', () => {
    chatClickCount = 0;
    scheduleApply(250);
    scheduleApply(1000);
  });

  window.addEventListener('yt-page-data-fetched', () => scheduleApply(200));
  window.addEventListener('yt-page-data-updated', () => scheduleApply(200));
  window.addEventListener('yt-navigate-cache-restored', () => scheduleApply(200));
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

  chrome?.storage?.onChanged?.addListener((changes, area) => {
    if (area !== 'sync') {
      return;
    }

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (changes[key]) {
        settings[key] = changes[key].newValue;
      }
    }

    if (!settings.autoZen) {
      zenEnabled = false;
    }

    if (settings.autoZen && isWatchPage()) {
      zenEnabled = true;
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
  window.clearTimeout(applyTimer);
  applyTimer = window.setTimeout(applyZen, delay);
}

function applyZen() {
  const watchPage = isWatchPage();
  const active = zenEnabled && watchPage;

  document.documentElement.classList.toggle('ytzt-watch-page', active);
  document.documentElement.classList.toggle('ytzt-hide-header', active && settings.hideHeader);
  document.documentElement.classList.toggle('ytzt-hide-recommendations', active && settings.hideRecommendations);
  document.documentElement.classList.toggle('ytzt-reveal-header-enabled', active && settings.hideHeader && settings.revealHeaderOnHover);
  document.documentElement.classList.toggle('ytzt-reveal-meta-enabled', active && settings.revealMetaOnHover);
  document.documentElement.classList.toggle('ytzt-side-left', active && settings.sideHoverPosition === 'left');
  document.documentElement.classList.toggle('ytzt-side-right', active && settings.sideHoverPosition !== 'left');
  syncHoverZones(active);

  if (!active) {
    chatClickCount = 0;
    document.documentElement.classList.remove('ytzt-reveal-header', 'ytzt-reveal-meta');
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
  const expires = 'Fri, 31 Dec 9999 23:59:59 GMT';
  document.cookie = `wide=1; domain=.youtube.com; path=/; expires=${expires}; SameSite=Lax`;
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
  zenEnabled = !zenEnabled;
  scheduleApply(0);
  scheduleApply(600);
}

function syncHoverZones(active) {
  const wantsHeaderZone = active && settings.hideHeader && settings.revealHeaderOnHover;
  const wantsMetaZone = active && settings.revealMetaOnHover;

  headerHoverZone = syncHoverZone(headerHoverZone, 'ytzt-header-hover-zone', wantsHeaderZone, 'ytzt-reveal-header');
  metaHoverZone = syncHoverZone(metaHoverZone, 'ytzt-meta-hover-zone', wantsMetaZone, 'ytzt-reveal-meta');
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

function handleHoverReveal(event) {
  if (!zenEnabled || !isWatchPage()) {
    return;
  }

  const canRevealHeader = settings.hideHeader && settings.revealHeaderOnHover;
  const canRevealMeta = settings.revealMetaOnHover;
  const headerOpen = document.documentElement.classList.contains('ytzt-reveal-header');
  const metaOpen = document.documentElement.classList.contains('ytzt-reveal-meta');
  const headerLimit = headerOpen ? 96 : 22;
  const metaLimit = metaOpen ? 460 : 28;
  const sideRevealTopLimit = headerOpen ? 104 : 72;
  const sideRevealBottomLimit = 96;
  const isInsideSideRevealBand = event.clientY > sideRevealTopLimit && event.clientY < window.innerHeight - sideRevealBottomLimit;
  const isLeftSideReveal = settings.sideHoverPosition === 'left';
  const isInsideSideRevealEdge = isLeftSideReveal ? event.clientX <= metaLimit : event.clientX >= window.innerWidth - metaLimit;

  document.documentElement.classList.toggle('ytzt-reveal-header', canRevealHeader && event.clientY <= headerLimit);
  document.documentElement.classList.toggle('ytzt-reveal-meta', canRevealMeta && isInsideSideRevealBand && isInsideSideRevealEdge);
}

function hideLiveChatByClick() {
  const chatFrame = document.querySelector('ytd-live-chat-frame#chat, ytd-live-chat-frame');
  if (!chatFrame || chatFrame.hasAttribute('collapsed') || chatFrame.collapsed === true) {
    return;
  }

  if (chatClickCount > 12) {
    return;
  }

  const closeButton = findFirst(CHAT_CLOSE_SELECTORS) || findChatButtonByText();
  if (!closeButton || !isVisible(closeButton)) {
    return;
  }

  chatClickCount += 1;
  closeButton.click();
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

  const button = findFirst(candidates);
  if (button && isVisible(button)) {
    button.click();
  }
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

function findFirst(selectors) {
  for (const selector of selectors) {
    const element = deepQuerySelector(document, selector);
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

function handleNavigation() {
  if (location.href === currentUrl) {
    return;
  }

  currentUrl = location.href;
  chatClickCount = 0;
  if (settings.autoZen && isWatchPage()) {
    zenEnabled = true;
  }

  scheduleApply(250);
  scheduleApply(900);
}

function startObserver() {
  observer?.disconnect();
  observer = new MutationObserver(() => {
    handleNavigation();
    if (isWatchPage()) {
      scheduleApply(180);
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['theater', 'collapsed', 'hidden', 'class']
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
