const fs = require('node:fs');

const path = require('node:path');

const vm = require('node:vm');

const expectedIds = [
  'hide_feed',
  'hide_redirect_home',
  'hide_sidebar',
  'hide_recommended',
  'hide_chat',
  'hide_playlists',
  'hide_donate',
  'hide_endscreen',
  'hide_cards',
  'hide_shorts',
  'hide_comments',
  'hide_prof',
  'hide_mix',
  'hide_merch',
  'hide_meta',
  'hide_bar',
  'hide_channel',
  'hide_desc',
  'hide_header',
  'hide_notifs',
  'hide_search',
  'hide_trending',
  'hide_moreyt',
  'hide_subs',
  'hide_autoplay',
  'hide_annotations',
  'yt_on',
  'dark_mode',
  'sidebar_tree',
  'comment_tree',
  'meta_tree',
  'header_tree',
  'surveys_promos'
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function loadSettings() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.js'), 'utf8');
  const context = {};
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'src/settings.js' });

  return context.YTZTSettings;
}

function testCatalog(api) {
  const ids = api.unhookFeatures.map((feature) => feature.id);
  assert(ids.length === new Set(ids).size, 'an Unhook feature was listed twice');
  assert(ids.length === expectedIds.length, `expected ${expectedIds.length} Unhook features, found ${ids.length}`);

  for (const id of expectedIds) {
    assert(ids.includes(id), `missing Unhook feature ${id}`);
  }

  for (const feature of api.unhookFeatures) {
    assert(['adopted', 'merged', 'cut'].includes(feature.decision), `${feature.id} has no decision`);
    assert(feature.reason.length > 20, `${feature.id} has no reason`);

    if (feature.decision === 'cut') {
      assert(feature.setting === '', `${feature.id} was cut but still names a setting`);
    } else {
      assert(Object.hasOwn(api.defaultSettings, feature.setting), `${feature.id} does not map to a stored setting`);
    }
  }
}

function testDefaultsAndNormalize(api) {
  for (const filter of api.distractionFilters) {
    assert(api.defaultSettings[filter.key] === filter.defaultValue, `${filter.key} default does not match its filter`);
    assert(filter.label && filter.detail && filter.rootClass.startsWith('ytzt-'), `${filter.key} is missing popup copy`);
  }

  const normalized = api.normalizeSettings({
    autoZen: false,
    hideHomeFeed: false,
    detailsLocation: 'nope',
    hoverRevealDelay: 5000,
    disableAutoplay: true
  });

  assert(normalized.autoZen === false, 'a false boolean was coerced to true');
  assert(normalized.hideHomeFeed === false, 'an explicit off switch was restored');
  assert(normalized.hideEndScreen === true, 'an omitted adopted default was lost');
  assert(normalized.detailsLocation === null, 'an unknown placement was stored');
  assert(normalized.hoverRevealDelay === 1000, 'hover delay was not clamped');
  assert(normalized.disableAutoplay === true, 'autoplay disable did not normalize');

  const popup = api.normalizePopupSettings({ scrollBehavior: 'card', revealMetaOnHover: true, sideRevealMode: 'hover' });
  assert(popup.detailsLocation === 'card', 'popup normalize lost the legacy card placement');
  assert(popup.detailsTrigger === 'scroll-hover', 'popup normalize lost the legacy hover trigger');
  assert(api.normalizePopupSettings({}).playlistLocation === 'card', 'popup normalize lost the default playlist card');
}

function testStylesAndPopup(api) {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'zen.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.html'), 'utf8');
  assert(html.includes('id="site-filters"'), 'popup has no host for the distraction filters');
  assert(html.includes('../src/settings.js'), 'popup does not load the settings module');

  for (const filter of api.distractionFilters) {
    assert(css.includes(filter.rootClass), `${filter.rootClass} is missing from zen.css`);
  }

  for (const className of ['ytzt-filter-recommendations', 'ytzt-filter-live-chat', 'ytzt-filter-playlist', 'ytzt-shorts-page']) {
    assert(css.includes(className), `${className} is missing from zen.css`);
  }

  assert(!css.includes('ytp-next-button'), 'autoplay hiding removed the next button');
  assert(!css.includes('.ytp-drawer'), 'offer hiding removed the generic player drawer');
}

async function flush() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

async function testPopupRendersFilters() {
  const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.js'), 'utf8');
  const popupSource = fs.readFileSync(path.join(__dirname, '..', 'popup', 'popup.js'), 'utf8');

  class Element {
    constructor(tagName) {
      this.tagName = tagName.toUpperCase();
      this.id = '';
      this.className = '';
      this.type = '';
      this.children = [];
      this.textContent = '';
      this.hidden = false;
      this.checked = false;
      this.value = '';
      this.disabled = false;
      this.dataset = {};
      this.listeners = new Map();
    }

    addEventListener(type, listener) {
      const listeners = this.listeners.get(type) || [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    append(...nodes) {
      this.children.push(...nodes);
    }

    querySelectorAll() {
      return [];
    }
  }

  class DocumentRoot {
    constructor() {
      this.host = new Element('fieldset');
      this.host.id = 'site-filters';
      this.elements = new Map([['site-filters', this.host], ['status', new Element('p')]]);

      for (const id of ['startupMode', 'zenShortcut', 'autoZen', 'shortcutEnabled', 'hoverRevealDelay', 'detailsLocation', 'detailsSide', 'detailsTrigger', 'playlistLocation', 'playlistSide', 'playlistTrigger', 'sameSideSplit', 'hideHeader', 'revealHeaderOnHover', 'hideRecommendations', 'hideLiveChat', 'drawerImplementation', 'drawerGlassEffect']) {
        const element = new Element(id === 'hoverRevealDelay' || id.endsWith('Location') || id.endsWith('Side') || id.endsWith('Trigger') || id === 'startupMode' || id === 'zenShortcut' || id === 'sameSideSplit' || id === 'drawerImplementation' ? 'select' : 'input');
        element.id = id;
        element.type = element.tagName === 'SELECT' ? 'select-one' : id === 'hoverRevealDelay' ? 'range' : 'checkbox';
        this.elements.set(id, element);
      }
    }

    walk(node, id) {
      if (node.id === id) {
        return node;
      }

      for (const child of node.children) {
        const found = this.walk(child, id);

        if (found) {
          return found;
        }
      }

      return null;
    }

    getElementById(id) {
      return this.elements.get(id) || this.walk(this.host, id);
    }

    createElement(tagName) {
      return new Element(tagName);
    }

    querySelector() {
      return null;
    }

    querySelectorAll() {
      return [];
    }
  }

  const document = new DocumentRoot();
  const writes = [];

  const context = {
    console,
    document,
    HTMLElement: Element,
    window: {},
    Promise,
    Number,
    String,
    Object,
    Boolean,
    chrome: {
      storage: {
        sync: {
          get(defaults) {
            return Promise.resolve({ ...defaults });
          },
          set(values) {
            writes.push(values);

            return Promise.resolve();
          }
        }
      }
    }
  };

  context.window = context;
  vm.createContext(context);
  vm.runInContext(settingsSource, context, { filename: 'src/settings.js' });
  vm.runInContext(popupSource, context, { filename: 'popup/popup.js' });
  await flush();
  const filters = context.YTZTSettings.distractionFilters;
  assert(document.host.children.length === filters.length, 'popup did not render one row per distraction filter');

  const home = document.getElementById('hideHomeFeed');
  assert(home && home.checked === true, 'home feed toggle did not hydrate from the default');
  home.checked = false;
  const change = home.listeners.get('change') || [];
  assert(change.length === 1, 'rendered toggle was not bound');

  for (const listener of change) {
    listener();
  }

  assert(writes.at(-1)?.hideHomeFeed === false, 'rendered toggle did not save');
}

async function main() {
  const api = loadSettings();
  testCatalog(api);
  testDefaultsAndNormalize(api);
  testStylesAndPopup(api);
  await testPopupRendersFilters();
  console.log('settings regression: PASS (catalog; defaults; popup host; css classes; rendered toggles)');
}

main().catch((error) => {
  console.error(`settings regression: FAIL: ${error.message}`);
  process.exitCode = 1;
});
