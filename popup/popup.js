/**
 * @typedef {Object} PopupSettings
 * @property {'page'|'card'|null} detailsLocation
 * @property {'left'|'right'|null} detailsSide
 * @property {'scroll'|'button'|'hover'|'scroll-hover'|null} detailsTrigger
 * @property {'page'|'card'|'hidden'|null} playlistLocation
 * @property {'left'|'right'|null} playlistSide
 * @property {'button'|'hover'|null} playlistTrigger
 * @property {'page'|'card'} scrollBehavior
 * @property {'zen'|'theater'} startupMode
 * @property {'t'|'shift-t'} zenShortcut
 * @property {boolean} autoZen
 * @property {boolean} hideLiveChat
 * @property {boolean} hideHeader
 * @property {boolean} hideRecommendations
 * @property {boolean} revealHeaderOnHover
 * @property {boolean} revealMetaOnHover
 * @property {boolean} revealPlaylistOnHover
 * @property {'drawer'|'hover'} sideRevealMode
 * @property {'custom'|'native'} drawerImplementation
 * @property {'same'|'separate'} revealSideLayout
 * @property {'left'|'right'} sideHoverPosition
 * @property {'playlist-top'|'details-top'} sameSideSplit
 * @property {number} hoverRevealDelay
 * @property {boolean} drawerGlassEffect
 * @property {boolean} shortcutEnabled
 */

/** @type {PopupSettings} */
const DEFAULT_SETTINGS = {
  detailsLocation: null,
  detailsSide: null,
  detailsTrigger: null,
  playlistLocation: null,
  playlistSide: null,
  playlistTrigger: null,
  scrollBehavior: 'page',
  startupMode: 'zen',
  zenShortcut: 't',
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

/** @typedef {HTMLInputElement|HTMLSelectElement} SettingControl */

/** @type {Record<string, SettingControl>} */
const controls = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS)
    .map((key) => [key, document.getElementById(key)])
    .filter((entry) => Boolean(entry[1]))
);

const statusElement = document.getElementById('status');

/** @type {Map<string, number>} */
const writeVersions = new Map();

/** @type {Set<string>} */
const failedKeys = new Set();

let pendingWrites = 0;

/** @type {PopupSettings} */
let currentSettings = { ...DEFAULT_SETTINGS };

void init();

async function init() {
  setControlsEnabled(false);

  let loadedSettings = normalizeSettings(DEFAULT_SETTINGS);
  let loadFailed = false;

  try {
    loadedSettings = normalizeSettings(await chrome.storage.sync.get(DEFAULT_SETTINGS));
  } catch (error) {
    loadFailed = true;
    console.error('[YouTube Zen] Could not load settings.', error);
  }

  currentSettings = loadedSettings;
  hydrateControls(loadedSettings);
  bindControlEvents();
  setControlsEnabled(true);
  updateConditionalControls();
  setStatus(loadFailed ? 'Could not load settings. Defaults shown.' : 'Settings loaded.', loadFailed);
}

/** @param {boolean} enabled */
function setControlsEnabled(enabled) {
  for (const control of Object.values(controls)) {
    control.disabled = !enabled;
  }
}

/**
 * @param {Partial<PopupSettings>} values
 * @returns {PopupSettings}
 */
function normalizeSettings(values) {
  const next = { ...DEFAULT_SETTINGS, ...values };
  next.detailsLocation = ['page', 'card'].includes(next.detailsLocation) ? next.detailsLocation : null;
  next.detailsSide = ['left', 'right'].includes(next.detailsSide) ? next.detailsSide : null;
  next.detailsTrigger = ['scroll', 'button', 'hover', 'scroll-hover'].includes(next.detailsTrigger) ? next.detailsTrigger : null;
  next.playlistLocation = ['page', 'card', 'hidden'].includes(next.playlistLocation) ? next.playlistLocation : null;
  next.playlistSide = ['left', 'right'].includes(next.playlistSide) ? next.playlistSide : null;
  next.playlistTrigger = ['button', 'hover'].includes(next.playlistTrigger) ? next.playlistTrigger : null;
  next.scrollBehavior = next.scrollBehavior === 'card' ? 'card' : 'page';
  next.startupMode = next.startupMode === 'theater' ? 'theater' : 'zen';
  next.zenShortcut = next.zenShortcut === 'shift-t' ? 'shift-t' : 't';
  next.autoZen = next.autoZen === true;
  next.hideLiveChat = next.hideLiveChat === true;
  next.hideHeader = next.hideHeader === true;
  next.hideRecommendations = next.hideRecommendations === true;
  next.revealHeaderOnHover = next.revealHeaderOnHover === true;
  next.revealMetaOnHover = next.revealMetaOnHover === true;
  next.revealPlaylistOnHover = next.revealPlaylistOnHover === true;
  next.sideRevealMode = next.sideRevealMode === 'hover' ? 'hover' : 'drawer';
  next.drawerImplementation = next.drawerImplementation === 'native' ? 'native' : 'custom';
  next.revealSideLayout = next.revealSideLayout === 'same' ? 'same' : 'separate';
  next.sideHoverPosition = next.sideHoverPosition === 'left' ? 'left' : 'right';
  next.sameSideSplit = next.sameSideSplit === 'details-top' ? 'details-top' : 'playlist-top';
  next.hoverRevealDelay = Number.isFinite(Number(next.hoverRevealDelay))
    ? Math.min(1000, Math.max(0, Number(next.hoverRevealDelay)))
    : DEFAULT_SETTINGS.hoverRevealDelay;
  next.drawerGlassEffect = next.drawerGlassEffect === true;
  next.shortcutEnabled = next.shortcutEnabled === true;

  next.detailsLocation ||= next.scrollBehavior === 'card' && next.revealMetaOnHover ? 'card' : 'page';
  next.detailsSide ||= next.sideHoverPosition;
  next.detailsTrigger ||= next.sideRevealMode === 'hover' ? 'scroll-hover' : 'scroll';
  next.playlistLocation ||= !next.revealPlaylistOnHover ? 'hidden' : next.drawerImplementation === 'native' ? 'page' : 'card';
  next.playlistSide ||= next.revealSideLayout === 'same' ? next.sideHoverPosition : next.sideHoverPosition === 'left' ? 'right' : 'left';
  next.playlistTrigger ||= next.sideRevealMode === 'hover' ? 'hover' : 'button';

  return next;
}

/** @param {PopupSettings} settings */
function hydrateControls(settings) {
  /** @type {Record<string, boolean|number|string>} */
  const settingValues = settings;

  for (const [key, control] of Object.entries(controls)) {
    const value = settingValues[key];

    if (control.type === 'checkbox') {
      control.checked = value === true;
    } else if (control.type === 'range') {
      control.value = String(value);
      updateRangeValue(control);
    } else {
      control.value = String(value);
    }
  }
}

function bindControlEvents() {
  for (const [key, control] of Object.entries(controls)) {
    if (control.type === 'range') {
      control.addEventListener('input', () => updateRangeValue(control));
    }

    control.addEventListener('change', () => {
      if (control.type === 'range') {
        updateRangeValue(control);
      }

      currentSettings = { ...currentSettings, [key]: getControlValue(control) };
      updateConditionalControls();
      persistSetting(key, getControlValue(control));
    });
  }
}

/**
 * @param {string} key
 * @param {boolean|number|string} value
 */
function persistSetting(key, value) {
  const requestId = (writeVersions.get(key) || 0) + 1;
  writeVersions.set(key, requestId);
  failedKeys.delete(key);
  pendingWrites += 1;
  publishWriteStatus();

  const patch = key === 'drawerImplementation'
    ? { [key]: value, playlistLocation: currentSettings.playlistLocation }
    : { [key]: value };

  const write = chrome.storage.sync.set(patch);

  void write.then(
    () => {
      pendingWrites -= 1;

      if (writeVersions.get(key) === requestId) {
        failedKeys.delete(key);
      }

      publishWriteStatus();
    },
    (error) => {
      pendingWrites -= 1;
      console.error(`[YouTube Zen] Could not save ${key}.`, error);

      if (writeVersions.get(key) === requestId) {
        failedKeys.add(key);
      }

      publishWriteStatus();
    }
  );
}

function publishWriteStatus() {
  if (pendingWrites > 0) {
    setStatus('Saving settings.');

    return;
  }

  if (failedKeys.size > 0) {
    setStatus('Could not save settings.', true);

    return;
  }

  setStatus('Settings saved.');
}

/**
 * @param {SettingControl} control
 * @returns {boolean|number|string}
 */
function getControlValue(control) {
  if (control.type === 'checkbox') {
    return control.checked;
  }

  if (control.type === 'range') {
    return Number(control.value);
  }

  return control.value;
}

/** @param {HTMLInputElement} control */
function updateRangeValue(control) {
  const output = document.querySelector(`[data-range-value="${control.id}"]`);

  if (output) {
    output.textContent = `${control.value}ms`;
  }
}

/**
 * @param {string} message
 * @param {boolean} [isError=false]
 */
function setStatus(message, isError = false) {
  if (!statusElement) {
    return;
  }

  statusElement.textContent = message;
  statusElement.dataset.state = isError ? 'error' : 'ok';
}

function updateConditionalControls() {
  controls.startupMode.disabled = !currentSettings.autoZen;
  controls.zenShortcut.disabled = !currentSettings.shortcutEnabled;

  const detailsCard = currentSettings.detailsLocation === 'card';
  const playlistCard = currentSettings.playlistLocation === 'card';
  const detailsHover = detailsCard && currentSettings.detailsTrigger.includes('hover');
  const playlistHover = playlistCard && currentSettings.playlistTrigger === 'hover';
  const shared = detailsHover && playlistHover && currentSettings.detailsSide === currentSettings.playlistSide;

  for (const element of document.querySelectorAll('[data-card-options]')) {
    if (element instanceof HTMLElement) element.hidden = element.dataset.cardOptions === 'details' ? !detailsCard : !playlistCard;
  }

  for (const element of document.querySelectorAll('[data-hover-options], [data-shared-hover]')) {
    if (element instanceof HTMLElement) element.hidden = element.hasAttribute('data-hover-options') ? !detailsHover && !playlistHover : !shared;
  }

  const detailsHelp = document.getElementById('details-help');
  const playlistHelp = document.getElementById('playlist-help');

  if (detailsHelp) detailsHelp.textContent = detailsCard ? '' : 'Scroll down for the channel, actions, description and comments.';

  if (playlistHelp) playlistHelp.textContent = playlistCard ? '' : currentSettings.playlistLocation === 'hidden' ? 'Playlist hidden. Your card preferences are kept.' : 'The queue stays in the page sidebar.';
  window.updateZenPreview?.(currentSettings);
}
