const fs = require('node:fs');

const path = require('node:path');

const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'native-panels.js'), 'utf8');

const hidden = 'ENGAGEMENT_PANEL_VISIBILITY_HIDDEN';

const expanded = 'ENGAGEMENT_PANEL_VISIBILITY_EXPANDED';

const timers = [];

const commands = [];

let visibility = hidden;

let listener;

let available = true;

let enabled = true;

let mode = 'success';

let nativeClicks = 0;

class NativeTarget {
  constructor(label, metadata = false, link = false) {
    this.label = label;
    this.metadata = metadata;
    this.link = link;
    this.isConnected = true;
  }
  closest(selector) {
    if (selector === '.ytp-fullscreen-metadata') return this.metadata ? this : null;

    if (selector === '.ytp-fullscreen-quick-actions button') return this.metadata ? null : this;

    if (selector === 'a, button, input, [role="link"]') return this.link ? this : null;

    return null;
  }
  querySelector() { return null; }
  getAttribute() { return this.label; }
  click() { nativeClicks++; dispatch(this); }
}

const location = { pathname: '/watch', search: '?v=test' };

const document = {
  fullscreenElement: null,
  documentElement: { classList: { contains: () => enabled } },
  addEventListener: (_, callback) => { listener = callback; },
  querySelector: (selector) => selector === 'ytd-watch-flexy'
    ? { polymerController: available ? { resolveCommand(command) {
      if (mode === 'throw') throw new Error('unavailable');
      commands.push(command);

      if (mode === 'success') visibility = command.signalServiceEndpoint.actions[0].showEngagementPanelEndpoint ? expanded : hidden;

      if (mode === 'reject') return Promise.reject(new Error('unavailable'));
    } } : {} }
    : { getAttribute: () => visibility }
};

vm.runInNewContext(source, { document, location, Element: NativeTarget, HTMLElement: NativeTarget, window: { setTimeout: (callback) => timers.push(callback) } });

function dispatch(target) {
  const event = { target, prevented: false, preventDefault() { this.prevented = true; }, stopImmediatePropagation() {} };
  listener(event);

  return event;
}

function click(label = 'Comments', metadata = false, link = false) { return dispatch(new NativeTarget(label, metadata, link)); }

function flush() { while (timers.length) timers.shift()(); }

function assert(value, message) { if (!value) throw new Error(message); }

async function main() {
  assert(click().prevented && visibility === expanded, 'comments did not open native drawer');
  flush();
  assert(nativeClicks === 0, 'successful command replayed');
  click();
  assert(visibility === hidden, 'second click did not hide drawer');
  click('', true);
  assert(commands.at(-1).signalServiceEndpoint.actions[0].showEngagementPanelEndpoint.panelIdentifier === 'engagement-panel-structured-description', 'title requested wrong panel');
  flush();
  assert(!click('Share').prevented && !click('', true, true).prevented, 'unrelated native action intercepted');
  available = false;
  assert(!click().prevented, 'missing controller blocked native fallback');
  available = true;
  mode = 'throw';
  assert(!click().prevented, 'throw blocked native fallback');
  mode = 'noop';
  click();
  flush();
  assert(nativeClicks === 1, 'silent no-op did not replay native action once');
  mode = 'reject';
  click();
  await Promise.resolve();
  await Promise.resolve();
  flush();
  assert(nativeClicks === 2, 'rejection replayed native action twice');
  mode = 'noop';
  click();
  enabled = false;
  flush();
  assert(nativeClicks === 2, 'fallback ran after leaving Zen');
  enabled = true;
  click();
  location.search = '?v=other';
  flush();
  assert(nativeClicks === 2, 'fallback ran after navigation');
  document.fullscreenElement = {};
  assert(!click().prevented, 'actual fullscreen intercepted');
  console.log('native panels regression: PASS');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
