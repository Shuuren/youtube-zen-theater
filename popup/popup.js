/** @typedef {YtztSettings} PopupSettings */

if (!globalThis.YTZTSettings) {
  throw new Error('[YouTube Zen] src/settings.js must load before popup.js.');
}

/** @type {PopupSettings} */
const DEFAULT_SETTINGS = globalThis.YTZTSettings.defaultSettings;

renderDistractionFilters();

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
  return globalThis.YTZTSettings.normalizePopupSettings(values);
}

function renderDistractionFilters() {
  const host = document.getElementById('site-filters');

  if (!host) {
    return;
  }

  for (const filter of globalThis.YTZTSettings.distractionFilters) {
    if (document.getElementById(filter.key)) {
      continue;
    }

    const label = document.createElement('label');
    label.className = 'row compact-row';
    const text = document.createElement('span');
    const title = document.createElement('strong');
    title.textContent = filter.label;
    const detail = document.createElement('small');
    detail.textContent = filter.detail;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = filter.key;
    text.append(title, detail);
    label.append(text, input);
    host.append(label);
  }
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
