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
  setStatus(loadFailed ? 'Could not load settings. Defaults shown.' : '', loadFailed);
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
    label.className = 'row';
    const text = document.createElement('span');
    text.textContent = filter.label;
    const detail = document.createElement('small');
    detail.textContent = filter.detail;
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.id = filter.key;

    if (filter.group !== 'playback') {
      input.dataset.quiet = '';
      input.dataset.quietLabel = quietName(filter.label);
    }

    text.append(detail);
    label.append(text, input);

    const groupHost = document.querySelector(`[data-filter-group="${filter.group}"] .fold-body`);
    const follow = groupHost ? groupHost.querySelector('[data-when]') : null;

    if (groupHost && follow) {
      groupHost.insertBefore(label, follow);
    } else {
      (groupHost || host).append(label);
    }
  }
}

/** @param {string} label */
function quietName(label) {
  return label.replace(/^(Hide |Disable )/i, '').toLowerCase();
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

  if (detailsHelp) {
    detailsHelp.textContent = detailsCard
      ? 'Edge button stays available.'
      : 'Channel, actions, and comments stay on the page.';
  }

  if (playlistHelp) {
    playlistHelp.textContent = playlistCard
      ? 'Edge button stays available.'
      : currentSettings.playlistLocation === 'hidden'
        ? 'Hidden. Card preferences stay saved.'
        : 'The queue stays in the sidebar.';
  }

  const headerReveal = document.querySelector('[data-when="header-hidden"]');

  if (headerReveal instanceof HTMLElement) {
    headerReveal.hidden = !currentSettings.hideHeader;
  }

  writeQuietCopy();
  window.updateZenPreview?.(currentSettings);
}

function writeQuietCopy() {
  const labels = [];

  for (const box of document.querySelectorAll('#quiet [data-quiet]')) {
    if (!(box instanceof HTMLInputElement) || !box.checked || box.closest('[hidden]') || !box.dataset.quietLabel) {
      continue;
    }

    labels.push(box.dataset.quietLabel);
  }

  const quietSummary = document.getElementById('quiet-summary');

  if (quietSummary) {
    if (labels.length === 0) {
      quietSummary.textContent = 'Nothing on the page is hidden.';
    } else if (labels.length > 3) {
      quietSummary.textContent = `${labels.length} distractions stay hidden.`;
    } else {
      quietSummary.textContent = `${joinLabels(labels)} stay hidden.`;
    }
  }

  for (const count of document.querySelectorAll('[data-fold-count]')) {
    const fold = count.closest('.fold');

    if (!fold) {
      continue;
    }

    let on = 0;

    for (const box of fold.querySelectorAll('[data-quiet]')) {
      if (box instanceof HTMLInputElement && box.checked && !box.closest('[hidden]')) {
        on += 1;
      }
    }

    count.textContent = on === 0 ? 'Shown' : on === 1 ? '1 hidden' : `${on} hidden`;
  }

  const playback = document.getElementById('playback-summary');
  const look = document.getElementById('look-summary');

  if (playback) {
    const start = !currentSettings.autoZen
      ? 'Manual start'
      : currentSettings.startupMode === 'theater'
        ? 'Starts in theater'
        : 'Starts in Zen';

    const autoplay = currentSettings.disableAutoplay ? 'Autoplay off' : 'Autoplay on';

    playback.textContent = `${start} · ${autoplay}`;
  }

  if (look) {
    const surface = currentSettings.drawerImplementation === 'native' ? 'YouTube surface' : 'Zen surface';
    const shadow = currentSettings.drawerGlassEffect ? 'Accented shadow' : 'Flat shadow';

    look.textContent = `${surface} · ${shadow}`;
  }
}

/**
 * @param {string[]} labels
 * @returns {string}
 */
function joinLabels(labels) {
  const first = labels[0] || '';
  const head = first.charAt(0).toUpperCase() + first.slice(1);

  if (labels.length === 1) {
    return head;
  }

  if (labels.length === 2) {
    return `${head} and ${labels[1]}`;
  }

  return `${head}, ${labels[1]}, and ${labels[2]}`;
}
