const fs = require('node:fs');

const path = require('node:path');

const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.js'), 'utf8');

const settingIds = [
  'detailsLocation', 'detailsSide', 'detailsTrigger',
  'playlistLocation', 'playlistSide', 'playlistTrigger',
  'startupMode', 'zenShortcut', 'autoZen', 'shortcutEnabled', 'hideLiveChat', 'hideHeader',
  'hideRecommendations', 'revealHeaderOnHover', 'drawerImplementation',
  'sameSideSplit', 'hoverRevealDelay', 'drawerGlassEffect'
];

class FakeElement {
  constructor(id, type = 'div') {
    this.id = id;
    this.type = type;
    this.value = '';
    this.checked = false;
    this.hidden = false;
    this.textContent = '';
    this.dataset = {};
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ type, target: this });
    }
  }
}

class FakeDocument {
  constructor() {
    this.elements = new Map();

    for (const id of settingIds) {
      const type =
        id === 'autoZen' ||
        id === 'hideLiveChat' ||
        id === 'hideHeader' ||
        id === 'hideRecommendations' ||
        id === 'revealHeaderOnHover' ||
        id === 'revealMetaOnHover' ||
        id === 'revealPlaylistOnHover' ||
        id === 'drawerGlassEffect' ||
        id === 'shortcutEnabled'
          ? 'checkbox'
          : id === 'hoverRevealDelay'
            ? 'range'
            : 'select-one';

      this.elements.set(id, new FakeElement(id, type));
    }

    this.elements.set('status', new FakeElement('status', 'p'));
    this.sameSideSetting = new FakeElement('same-side-setting');
    this.sidePositionTitle = new FakeElement('side-position-title');
    this.sidePositionHelp = new FakeElement('side-position-help');
    this.rangeOutput = new FakeElement('range-output');
    this.rangeOutput.dataset.rangeValue = 'hoverRevealDelay';
  }

  getElementById(id) {
    return this.elements.get(id) || null;
  }

  querySelector(selector) {
    if (selector === '[data-range-value="hoverRevealDelay"]') return this.rangeOutput;

    if (selector === '[data-side-position-title]') return this.sidePositionTitle;

    if (selector === '[data-side-position-help]') return this.sidePositionHelp;

    return null;
  }

  querySelectorAll(selector) {
    return selector === '[data-same-side-only]' ? [this.sameSideSetting] : [];
  }
}

function createStorage({ rejectGet = false, initialSettings = {}, pendingSets = [] } = {}) {
  const writes = [];

  const storage = {
    sync: {
      get(defaults) {
        if (rejectGet) return Promise.reject(new Error('popup read failed'));

        return Promise.resolve({ ...defaults, ...initialSettings });
      },
      set(values) {
        writes.push(values);

        return new Promise((resolve, reject) => {
          pendingSets.push({ values, resolve, reject });
        });
      }
    },
    writes,
    pendingSets
  };

  return storage;
}

async function flush() {
  for (let index = 0; index < 5; index += 1) {
    await Promise.resolve();
  }
}

async function createHarness(options = {}) {
  const document = new FakeDocument();
  const storage = createStorage(options);

  const sandbox = {
    console,
    document,
    window: {},
    HTMLElement: FakeElement,
    chrome: { storage },
    Promise,
    Number,
    String,
    Object,
    Boolean
  };

  vm.runInNewContext(source, sandbox, { filename: 'popup/popup.js' });
  await flush();

  return { document, storage };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function testOriginalControlCoverage() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.html'), 'utf8');
  const ids = Array.from(html.matchAll(/<(?:input|select)\b[^>]*\bid="([^"]+)"/g), (match) => match[1]);

  for (const id of settingIds) {
    assert(ids.filter((candidate) => candidate === id).length === 1, `original setting ${id} is missing or duplicated in the real popup`);
  }
}

async function testOriginalPlacementControls() {
  const harness = await createHarness({ initialSettings: {
    scrollBehavior: 'card', revealMetaOnHover: false, sideRevealMode: 'hover',
    sideHoverPosition: 'left', revealSideLayout: 'same', sameSideSplit: 'details-top',
    drawerImplementation: 'native'
  } });

  const doc = harness.document;
  assert(doc.getElementById('detailsLocation').value === 'page', 'disabled legacy details did not map to page');
  assert(doc.getElementById('playlistLocation').value === 'page', 'native legacy playlist did not stay on page');
  assert(doc.getElementById('detailsSide').value === 'left', 'saved details edge was lost');
  assert(doc.getElementById('playlistSide').value === 'left', 'saved shared playlist edge was lost');
  assert(doc.getElementById('detailsTrigger').value === 'scroll-hover', 'legacy combined scroll/hover was lost');
  assert(doc.getElementById('sameSideSplit').value === 'details-top', 'saved hover split was lost');
  assert(harness.storage.writes.length === 0, 'loading silently rewrote preferences');
  const side = doc.getElementById('detailsSide');
  side.value = 'right';
  side.dispatch('change');
  assert(harness.storage.writes.at(-1).detailsSide === 'right', 'independent details side did not save');
  assert(doc.getElementById('playlistSide').value === 'left', 'moving details changed playlist side');
  const location = doc.getElementById('detailsLocation');
  location.value = 'card';
  location.dispatch('change');
  location.value = 'page';
  location.dispatch('change');
  assert(doc.getElementById('detailsSide').value === 'right', 'page selection reset dormant side');
  const hidden = await createHarness({ initialSettings: { revealPlaylistOnHover: false } });
  assert(hidden.document.getElementById('playlistLocation').value === 'hidden', 'disabled playlist was not preserved');
  const explicit = await createHarness({ initialSettings: { detailsLocation: 'card', detailsTrigger: 'button', playlistLocation: 'card', playlistSide: 'right', drawerImplementation: 'native' } });
  assert(explicit.document.getElementById('playlistLocation').value === 'card', 'native styling overrode explicit card location');
  assert(explicit.document.getElementById('detailsTrigger').value === 'button', 'explicit button trigger was lost');
  const appearance = doc.getElementById('drawerImplementation');
  appearance.value = 'custom';
  appearance.dispatch('change');
  assert(harness.storage.writes.at(-1).playlistLocation === 'page', 'changing migrated appearance did not preserve page playlist');
}

async function testLoadFailureStillBinds() {
  const harness = await createHarness({ rejectGet: true });
  const status = harness.document.getElementById('status');
  const autoZen = harness.document.getElementById('autoZen');
  assert(harness.document.getElementById('detailsLocation').value === 'page', 'load failure did not normalize fallback locations');
  assert(harness.document.getElementById('detailsTrigger').value === 'scroll', 'load failure did not normalize fallback triggers');
  assert(status.textContent.includes('Could not load'), 'popup load failure was not announced');
  autoZen.checked = false;
  autoZen.dispatch('change');
  await flush();
  assert(harness.storage.writes.length === 1, 'controls were not bound after popup load failure');
}

async function testConcurrentWrites() {
  const harness = await createHarness();
  const autoZen = harness.document.getElementById('autoZen');
  const status = harness.document.getElementById('status');
  autoZen.checked = false;
  autoZen.dispatch('change');
  autoZen.checked = true;
  autoZen.dispatch('change');
  assert(harness.storage.pendingSets.length === 2, 'second setting write waited for the first');
  const older = harness.storage.pendingSets.shift();
  const newer = harness.storage.pendingSets.shift();
  older.resolve();
  await flush();
  assert(status.textContent === 'Saving settings.', 'older write announced success while a newer write was in flight');
  newer.resolve();
  await flush();
  assert(harness.storage.writes.length === 2, 'concurrent setting writes lost a completion');
  assert(harness.storage.writes[1].autoZen === true, 'newer setting value did not win');
  assert(status.textContent === 'Settings saved.', 'latest successful write was not announced');
}

async function testRejectedWriteAndRangeCoalescing() {
  const harness = await createHarness();
  const autoZen = harness.document.getElementById('autoZen');
  autoZen.checked = false;
  autoZen.dispatch('change');
  await flush();
  harness.storage.pendingSets.shift().reject(new Error('popup write failed'));
  await flush();
  const status = harness.document.getElementById('status');
  assert(status.textContent === 'Could not save settings.', 'rejected write was shown as saved');
  assert(status.dataset.state === 'error', 'rejected write did not set an accessible error state');

  const range = harness.document.getElementById('hoverRevealDelay');
  range.value = '80';
  range.dispatch('input');
  range.value = '220';
  range.dispatch('input');
  range.dispatch('change');
  await flush();
  assert(harness.storage.pendingSets.length === 1, 'range input events were not coalesced to change');
  assert(harness.storage.writes.at(-1).hoverRevealDelay === 220, 'final range value was not queued');
  harness.storage.pendingSets.shift().resolve();
  await flush();
  assert(
    status.textContent === 'Could not save settings.',
    'successful write of another key cleared an earlier failure'
  );
  assert(status.dataset.state === 'error', 'earlier failure lost its accessible error state');

  autoZen.checked = true;
  autoZen.dispatch('change');
  await flush();
  harness.storage.pendingSets.shift().resolve();
  await flush();
  assert(status.textContent === 'Settings saved.', 'failed key stayed failed after it saved successfully');
  assert(status.dataset.state === 'ok', 'successful rewrite of the failed key stayed an error');
}

async function testStartupChoices() {
  const harness = await createHarness({ initialSettings: { startupMode: 'theater', zenShortcut: 'shift-t', autoZen: false } });
  const startup = harness.document.getElementById('startupMode');
  const chord = harness.document.getElementById('zenShortcut');
  const automatic = harness.document.getElementById('autoZen');
  assert(startup.value === 'theater' && startup.disabled, 'dormant startup preference did not hydrate');
  assert(chord.value === 'shift-t', 'shortcut preference did not hydrate');
  automatic.checked = true;
  automatic.dispatch('change');
  assert(!startup.disabled && startup.value === 'theater', 'enabling automatic startup lost its mode');
  startup.value = 'zen';
  startup.dispatch('change');
  chord.value = 't';
  chord.dispatch('change');
  assert(harness.storage.writes.some((v) => v.startupMode === 'zen'), 'startup choice was not saved');
  assert(harness.storage.writes.some((v) => v.zenShortcut === 't'), 'shortcut choice was not saved');
}

async function main() {
  await testStartupChoices();
  testOriginalControlCoverage();
  await testOriginalPlacementControls();
  await testLoadFailureStillBinds();
  await testConcurrentWrites();
  await testRejectedWriteAndRangeCoalescing();
  console.log('popup regression: PASS (load fallback; concurrent writes; sticky failure until that key saves)');
}

main().catch((error) => {
  console.error(`popup regression: FAIL: ${error.message}`);
  process.exitCode = 1;
});
