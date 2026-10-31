const fs = require('node:fs');

const path = require('node:path');

const vm = require('node:vm');

const settingsSource = fs.readFileSync(path.join(__dirname, '..', 'src', 'settings.js'), 'utf8');

const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'content.js'), 'utf8');

class FakeClassList {
  constructor() {
    this.values = new Set();
  }

  add(...values) {
    values.forEach((value) => this.values.add(value));
  }

  remove(...values) {
    values.forEach((value) => this.values.delete(value));
  }

  toggle(value, force) {
    const shouldHave = force === undefined ? !this.values.has(value) : force;

    if (shouldHave) this.values.add(value);
    else this.values.delete(value);

    return shouldHave;
  }

  contains(value) {
    return this.values.has(value);
  }

  [Symbol.iterator]() {
    return this.values[Symbol.iterator]();
  }
}

class FakeNodeList {
  constructor(nodes) {
    nodes.forEach((node, index) => {
      this[index] = node;
    });
    this.length = nodes.length;
  }

  [Symbol.iterator]() {
    return Array.from({ length: this.length }, (_, index) => this[index])[Symbol.iterator]();
  }
}

class FakeNode {
  constructor(nodeType) {
    this.nodeType = nodeType;
    this.parentElement = null;
    this.childNodes = [];
    this.listeners = new Map();
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    this.listeners.set(
      type,
      listeners.filter((candidate) => candidate !== listener)
    );
  }

  dispatchEvent(event) {
    for (const listener of this.listeners.get(event.type) || []) {
      event.currentTarget = this;
      listener(event);
    }

    return true;
  }

  append(...nodes) {
    nodes.forEach((node) => {
      node.parentElement = this;
      node.ownerDocument = this.ownerDocument || (this.nodeType === 9 ? this : null);
      this.childNodes.push(node);
      emitMutation({
        type: 'childList',
        target: this,
        addedNodes: new FakeNodeList([node]),
        removedNodes: new FakeNodeList([])
      });
    });
  }

  prepend(...nodes) {
    nodes.reverse().forEach((node) => {
      node.parentElement = this;
      node.ownerDocument = this.ownerDocument || (this.nodeType === 9 ? this : null);
      this.childNodes.unshift(node);
      emitMutation({
        type: 'childList',
        target: this,
        addedNodes: new FakeNodeList([node]),
        removedNodes: new FakeNodeList([])
      });
    });
  }

  remove() {
    if (!this.parentElement) return;
    const parent = this.parentElement;
    const index = parent.childNodes.indexOf(this);

    if (index >= 0) parent.childNodes.splice(index, 1);
    this.parentElement = null;
    emitMutation({
      type: 'childList',
      target: parent,
      addedNodes: new FakeNodeList([]),
      removedNodes: new FakeNodeList([this])
    });
  }

  get isConnected() {
    let node = this;

    while (node?.parentElement) node = node.parentElement;

    return node?.nodeType === 9 || node?.tagName === 'HTML';
  }

  get textContent() {
    return this.childNodes.map((node) => node.textContent || '').join('');
  }

  set textContent(value) {
    const removedNodes = this.childNodes.splice(0);
    removedNodes.forEach((node) => {
      node.parentElement = null;
    });

    if (removedNodes.length > 0) {
      emitMutation({
        type: 'childList',
        target: this,
        addedNodes: new FakeNodeList([]),
        removedNodes: new FakeNodeList(removedNodes)
      });
    }

    if (value !== '') {
      const text = new FakeText(value);
      text.parentElement = this;
      this.childNodes.push(text);
      emitMutation({
        type: 'childList',
        target: this,
        addedNodes: new FakeNodeList([text]),
        removedNodes: new FakeNodeList([])
      });
    }
  }

  descendants() {
    return this.childNodes.flatMap((node) => [node, ...node.descendants()]);
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    return this.descendants().filter((node) => node.nodeType === 1 && matchesSelector(node, selector));
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let node = this;

    while (node?.nodeType === 1) {
      if (node.matches(selector)) return node;
      node = node.parentElement;
    }

    return null;
  }
}

class FakeText extends FakeNode {
  constructor(value) {
    super(3);
    this.value = value;
  }

  get textContent() {
    return this.value;
  }

  set textContent(value) {
    this.value = value;
  }

  descendants() {
    return [];
  }
}

class FakeElement extends FakeNode {
  constructor(tagName) {
    super(1);
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.dataset = {};
    this.style = {};
    this.shadowRoot = null;
    this.scrollHeight = 0;
    this.clientHeight = 0;
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.isContentEditable = false;
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
  }

  click() {
    this.dispatchEvent({
      type: 'click',
      detail: 1,
      target: this,
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {}
    });
  }

  focus() {
    this.focused = true;
    let root = this;

    while (root.parentElement) root = root.parentElement;

    if (root.nodeType === 9) root.activeElement = this;
  }

  setAttribute(name, value) {
    const stringValue = String(value);

    if (this.attributes.get(name) === stringValue) return;
    this.attributes.set(name, stringValue);

    if (name === 'class') {
      this.classList = new FakeClassList();
      stringValue
        .split(/\s+/)
        .filter(Boolean)
        .forEach((className) => this.classList.add(className));
    }

    emitMutation({ type: 'attributes', target: this, attributeName: name });
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    if (!this.attributes.delete(name)) return;
    emitMutation({ type: 'attributes', target: this, attributeName: name });
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get className() {
    return [...this.classList].join(' ');
  }

  set className(value) {
    this.setAttribute('class', value);
  }
}

class ForeignElement extends FakeNode {
  constructor(tagName) {
    super(1);
    this.tagName = tagName.toUpperCase();
    this.attributes = new Map();
    this.classList = new FakeClassList();
    this.shadowRoot = null;
    this.style = {};
  }

  getBoundingClientRect() {
    return { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 };
  }

  click() {
    this.dispatchEvent({
      type: 'click',
      detail: 1,
      target: this,
      preventDefault() {},
      stopPropagation() {},
      stopImmediatePropagation() {}
    });
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    emitMutation({ type: 'attributes', target: this, attributeName: name });
  }

  getAttribute(name) {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    if (!this.attributes.delete(name)) return;
    emitMutation({ type: 'attributes', target: this, attributeName: name });
  }

  get id() {
    return this.getAttribute('id') || '';
  }
}

class FakeDocument extends FakeNode {
  constructor() {
    super(9);
    this.documentElement = new FakeElement('html');
    this.documentElement.parentElement = this;
    this.documentElement.ownerDocument = this;
    this.body = new FakeElement('body');
    this.body.ownerDocument = this;
    this.documentElement.append(this.body);
    this.activeElement = this.body;
    this.hidden = false;
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    if (matchesSelector(this.documentElement, selector)) return this.documentElement;

    return this.documentElement.querySelector(selector);
  }

  querySelectorAll(selector) {
    const rootMatch = matchesSelector(this.documentElement, selector) ? [this.documentElement] : [];

    return [...rootMatch, ...this.documentElement.querySelectorAll(selector)];
  }

  addEventListener(type, listener) {
    super.addEventListener(type, listener);
  }
}

function splitSelectors(selector) {
  return selector
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function matchesSimple(element, selector) {
  const withoutNot = selector.replace(/:not\(([^)]+)\)/g, (_, excluded) => {
    element.__excludedSelector = excluded;

    return '';
  });

  if (element.__excludedSelector) {
    const excluded = element.__excludedSelector;
    delete element.__excludedSelector;

    if (matchesSimple(element, excluded)) return false;
  }

  const tag = withoutNot.match(/^[a-z][\w-]*/i)?.[0];

  if (tag && element.tagName.toLowerCase() !== tag.toLowerCase()) return false;
  const id = withoutNot.match(/#([\w-]+)/)?.[1];

  if (id && element.id !== id) return false;
  const classes = [...withoutNot.matchAll(/\.([\w-]+)/g)].map((match) => match[1]);

  if (classes.some((className) => !element.classList.contains(className))) return false;

  for (const [, name, operator, rawValue] of withoutNot.matchAll(/\[([\w-]+)(?:([*^$|~]?=)["']?([^\]"']+)["']?)?\]/g)) {
    if (!element.hasAttribute(name)) return false;

    if (operator) {
      const value = element.getAttribute(name);

      if (operator === '=' && value !== rawValue) return false;

      if (operator === '*=' && !value.includes(rawValue)) return false;
    }
  }

  return true;
}

function matchesSelector(element, selector) {
  return splitSelectors(selector).some((alternative) => {
    const parts = alternative.split(/\s+/).filter(Boolean);
    let candidate = element;

    for (let index = parts.length - 1; index >= 0; index -= 1) {
      if (!candidate || !matchesSimple(candidate, parts[index])) return false;

      if (index > 0) candidate = candidate.parentElement;
    }

    return true;
  });
}

const observers = new Set();

let pendingRecords = [];

let deliveryQueued = false;

function emitMutation(record) {
  pendingRecords.push(record);

  if (deliveryQueued) return;
  deliveryQueued = true;
  queueMicrotask(() => {
    deliveryQueued = false;
    const records = pendingRecords;
    pendingRecords = [];

    for (const observer of observers) {
      const relevant = records.filter((record) => observer.accepts(record));

      if (relevant.length > 0) observer.callback(relevant);
    }
  });
}

class FakeMutationObserver {
  constructor(callback) {
    this.callback = callback;
    this.root = null;
    this.options = null;
    observers.add(this);
  }

  observe(root, options) {
    this.root = root;
    this.options = options;
  }

  disconnect() {
    observers.delete(this);
  }

  accepts(record) {
    if (!this.root || !this.options) return false;
    let node = record.target;

    while (node && node !== this.root) node = node.parentElement;

    if (node !== this.root) return false;

    if (record.type === 'childList') {
      return this.options.childList && this.options.subtree;
    }

    if (record.type === 'attributes') {
      return (
        this.options.attributes &&
        (!this.options.attributeFilter || this.options.attributeFilter.includes(record.attributeName))
      );
    }

    return false;
  }
}

class FakeClock {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.timers = new Map();
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextId;
    this.nextId += 1;
    this.timers.set(id, { callback, due: this.now + Math.max(0, delay) });

    return id;
  }

  clearTimeout(id) {
    this.timers.delete(id);
  }

  advance(milliseconds) {
    const target = this.now + milliseconds;

    while (true) {
      const next = [...this.timers.entries()]
        .filter(([, timer]) => timer.due <= target)
        .sort((left, right) => left[1].due - right[1].due)[0];

      if (!next) break;
      this.timers.delete(next[0]);
      this.now = next[1].due;
      next[1].callback();
    }

    this.now = target;
  }

  pendingCount() {
    return this.timers.size;
  }
}

function createStorage(initialSettings, shouldRejectGet = false) {
  const listeners = [];
  const writes = [];

  const storage = {
    sync: {
      get(defaults) {
        if (shouldRejectGet) {
          return Promise.reject(new Error('storage read failed'));
        }

        return Promise.resolve({ ...defaults, ...initialSettings });
      },
      set(values) {
        writes.push(values);

        return Promise.resolve();
      }
    },
    onChanged: {
      addListener(listener) {
        listeners.push(listener);
      }
    },
    writes,
    emit(changes) {
      for (const listener of listeners) {
        listener(changes, 'sync');
      }
    }
  };

  return storage;
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

async function createHarness(initialSettings = {}, shouldRejectGet = false) {
  observers.clear();
  pendingRecords = [];
  deliveryQueued = false;
  const clock = new FakeClock();
  const document = new FakeDocument();
  const windowListeners = new Map();
  const storage = createStorage(initialSettings, shouldRejectGet);
  let animationFrameRequests = 0;

  const location = {
    href: 'https://www.youtube.com/watch?v=lag-check',
    pathname: '/watch',
    search: '?v=lag-check'
  };

  const originalTextContent = Object.getOwnPropertyDescriptor(FakeNode.prototype, 'textContent');
  let drawerTextWrites = 0;
  Object.defineProperty(FakeElement.prototype, 'textContent', {
    configurable: true,
    get: originalTextContent.get,
    set(value) {
      if (this.matches('.ytzt-meta-drawer-button, .ytzt-playlist-drawer-button')) drawerTextWrites += 1;
      originalTextContent.set.call(this, value);
    }
  });
  const RealDate = Date;

  class HarnessDate extends RealDate {
    static now() {
      return clock.now;
    }
  }

  const sandbox = {
    console,
    document,
    Element: FakeElement,
    HTMLElement: FakeElement,
    HTMLIFrameElement: FakeElement,
    MutationObserver: FakeMutationObserver,
    URLSearchParams,
    location,
    chrome: { storage },
    getComputedStyle: (element) => ({
      display: element?.hasAttribute?.('hidden') ? 'none' : element?.style?.display || 'block',
      visibility: element?.style?.visibility || 'visible'
    }),
    requestAnimationFrame: (callback) => {
      animationFrameRequests += 1;

      return clock.setTimeout(() => callback(clock.now), 0);
    },
    cancelAnimationFrame: (id) => {
      clock.clearTimeout(id);
    },
    performance: { now: () => clock.now },
    Date: HarnessDate,
    setTimeout: clock.setTimeout.bind(clock),
    clearTimeout: clock.clearTimeout.bind(clock),
    queueMicrotask,
    scrollY: 0,
    scrollTo: ({ top = 0 }) => { sandbox.scrollY = top; },
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener: (type, listener) => {
      const listeners = windowListeners.get(type) || [];
      listeners.push(listener);
      windowListeners.set(type, listeners);
    }
  };

  sandbox.Event = Event;
  sandbox.dispatchEvent = (event) => {
    for (const listener of windowListeners.get(event.type) || []) listener(event);
  };

  sandbox.window = sandbox;
  vm.runInNewContext(settingsSource, sandbox, { filename: 'src/settings.js' });
  vm.runInNewContext(source, sandbox, { filename: 'src/content.js' });

  const harness = {
    clock,
    document,
    location,
    storage,
    windowListeners,
    get pageScrollY() { return sandbox.scrollY; },
    setPageScroll(top) { sandbox.scrollY = top; },
    get animationFrameRequests() {
      return animationFrameRequests;
    },
    get drawerTextWrites() {
      return drawerTextWrites;
    },
    dispatch(type, options = {}) {
      const target = options.target || document.body;

      const event = {
        type,
        target,
        key: options.key || 't',
        code: options.code || 'KeyT',
        detail: options.detail ?? 0,
        repeat: options.repeat === true,
        defaultPrevented: false,
        metaKey: options.metaKey === true,
        ctrlKey: options.ctrlKey === true,
        altKey: options.altKey === true,
        shiftKey: options.shiftKey === true,
        deltaY: options.deltaY ?? 0,
        deltaX: options.deltaX ?? 0,
        deltaMode: options.deltaMode ?? 0,
        clientX: options.clientX ?? 1279,
        clientY: options.clientY ?? 200,
        composedPath: () => options.path || [target],
        preventDefault() {
          this.defaultPrevented = true;
        },
        stopPropagation() {
          this.propagationStopped = true;
        },
        stopImmediatePropagation() {
          this.immediatePropagationStopped = true;
        }
      };

      for (const listener of windowListeners.get(type) || []) {
        listener(event, true);
      }

      document.dispatchEvent(event);

      return event;
    },
    async settle(milliseconds = 0) {
      await flushMicrotasks();
      clock.advance(milliseconds);
      await flushMicrotasks();
      clock.advance(0);
      await flushMicrotasks();
    }
  };

  await harness.settle();

  return harness;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function hasClass(harness, className) {
  return harness.document.documentElement.classList.contains(className);
}

async function testStartupAndShortcut() {
  const rejected = await createHarness({}, true);
  const rejectedEvent = rejected.dispatch('keydown');
  await rejected.settle();
  assert(!hasClass(rejected, 'ytzt-watch-page'), 'startup read rejection did not bind shortcut events');
  assert(rejectedEvent.defaultPrevented, 'bound shortcut did not prevent YouTube after read rejection');

  const harness = await createHarness({ hideLiveChat: false });
  assert(hasClass(harness, 'ytzt-watch-page'), 'Auto Zen did not activate on a watch page');
  harness.dispatch('keydown');
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-watch-page'), 'T keydown did not toggle exactly once');
  harness.dispatch('keypress');
  harness.dispatch('keyup');
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-watch-page'), 'T keypress/keyup toggled a second time');

  harness.clock.advance(400);
  harness.dispatch('keydown', { repeat: true });
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-watch-page'), 'held T repeat toggled Zen');
  harness.dispatch('keyup');
  harness.dispatch('keydown');
  await harness.settle();
  assert(hasClass(harness, 'ytzt-watch-page'), 'rapid independent T press was suppressed');
  harness.dispatch('keyup');

  const editable = harness.document.createElement('input');
  harness.document.body.append(editable);
  const editableEvent = harness.dispatch('keydown', { target: editable, path: [editable] });
  await harness.settle();
  assert(hasClass(harness, 'ytzt-watch-page'), 'editable T keydown toggled Zen');
  assert(!editableEvent.defaultPrevented, 'editable T keydown was intercepted');

  const modifierEvent = harness.dispatch('keydown', { ctrlKey: true });
  await harness.settle();
  assert(hasClass(harness, 'ytzt-watch-page') && !modifierEvent.defaultPrevented, 'modified T keydown was intercepted');

  harness.location.pathname = '/feed';
  harness.location.href = 'https://www.youtube.com/feed';
  const routeEvent = harness.dispatch('keydown');
  assert(!routeEvent.defaultPrevented, 'non-watch T keydown was intercepted');
}

async function testStartupAndShortcutChoices() {
  const harness = await createHarness({ hideLiveChat: false, zenShortcut: 'shift-t' });
  const plain = harness.dispatch('keydown');
  harness.dispatch('keyup');
  await harness.settle(1000);
  assert(!plain.defaultPrevented, 'plain T was intercepted in native-T mode');
  assert(!hasClass(harness, 'ytzt-watch-page'), 'plain T left Zen active');
  harness.dispatch('ytd-player-updated');
  await harness.settle(1000);
  assert(!hasClass(harness, 'ytzt-watch-page'), 'player update overrode the native T choice');
  const shifted = harness.dispatch('keydown', { shiftKey: true });
  harness.dispatch('keypress', { shiftKey: true });
  harness.dispatch('keyup');
  await harness.settle();
  assert(shifted.defaultPrevented && hasClass(harness, 'ytzt-watch-page'), 'Shift+T did not toggle Zen once');
  harness.dispatch('keydown', { shiftKey: true });
  harness.dispatch('keyup');
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-watch-page'), 'releasing Shift before T left shortcut latched');
  const disabled = await createHarness({ zenShortcut: 'shift-t', shortcutEnabled: false });
  const nativeT = disabled.dispatch('keydown');
  disabled.dispatch('keyup');
  disabled.dispatch('ytd-player-updated');
  await disabled.settle(1000);
  assert(!nativeT.defaultPrevented && !hasClass(disabled, 'ytzt-watch-page'), 'disabled Zen chord prevented yielding to native T');

  const native = await createHarness({ startupMode: 'theater', hideLiveChat: false });
  const flexy = native.document.createElement('ytd-watch-flexy');
  const button = native.document.createElement('button');
  button.classList.add('ytp-size-button');
  button.setAttribute('aria-label', 'Theater mode (t)');
  let clicks = 0;
  button.addEventListener('click', () => {
    clicks += 1;
    flexy.setAttribute('theater', '');
  });
  flexy.append(button);
  native.document.body.append(flexy);
  native.dispatch('ytd-player-updated');
  await native.settle(1000);
  native.dispatch('ytd-player-updated');
  await native.settle(200);
  assert(flexy.hasAttribute('theater') && clicks === 1, 'native theater did not start exactly once');
  assert(!hasClass(native, 'ytzt-watch-page'), 'native startup applied Zen layout');
  flexy.removeAttribute('theater');
  native.dispatch('ytd-player-updated');
  await native.settle(1000);
  assert(clicks === 1, 'native startup kept forcing theater after the user left it');
  native.location.href = 'https://www.youtube.com/watch?v=next-native-video';
  native.dispatch('yt-navigate-finish');
  await native.settle(1000);
  assert(clicks === 2 && flexy.hasAttribute('theater'), 'new-video navigation did not reapply native startup');
  const off = await createHarness({ autoZen: false, startupMode: 'theater' });
  assert(!hasClass(off, 'ytzt-watch-page'), 'disabled automatic startup enabled Zen');
}

async function testAutoZenNavigation() {
  const harness = await createHarness({ hideLiveChat: false });
  harness.dispatch('keydown');
  harness.dispatch('keyup');
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-watch-page'), 'setup toggle did not disable Zen');

  harness.location.href = 'https://www.youtube.com/watch?v=lag-check#comments';
  harness.dispatch('yt-navigate-finish');
  await harness.settle(1000);
  assert(!hasClass(harness, 'ytzt-watch-page'), 'same-video navigation re-enabled Zen');

  harness.location.href = 'https://www.youtube.com/watch?v=new-video';
  harness.location.search = '?v=new-video';
  harness.dispatch('yt-navigate-finish');
  await harness.settle(1000);
  assert(hasClass(harness, 'ytzt-watch-page'), 'new-video navigation did not re-enable Auto Zen');
}

async function testHoverInvalidation() {
  const harness = await createHarness({ scrollBehavior: 'card', hideLiveChat: false, sideRevealMode: 'hover', hoverRevealDelay: 100 });
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  harness.clock.advance(99);
  await flushMicrotasks();
  assert(!hasClass(harness, 'ytzt-reveal-meta-hover'), 'hover reveal fired before its delay');

  harness.storage.emit({ sideRevealMode: { newValue: 'drawer' } });
  await harness.settle(200);
  assert(!hasClass(harness, 'ytzt-reveal-meta-hover'), 'drawer switch failed to cancel hover reveal');

  harness.storage.emit({ sideRevealMode: { newValue: 'hover' } });
  await harness.settle();
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  harness.clock.advance(50);
  harness.location.href = 'https://www.youtube.com/watch?v=other-video';
  harness.location.search = '?v=other-video';
  harness.dispatch('yt-navigate-finish');
  await harness.settle(200);
  assert(!hasClass(harness, 'ytzt-reveal-meta-hover'), 'navigation failed to invalidate hover reveal');

  harness.storage.emit({ sideRevealMode: { newValue: 'hover' }, autoZen: { newValue: true } });
  await harness.settle();
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  harness.clock.advance(50);
  harness.storage.emit({ autoZen: { newValue: false } });
  await harness.settle(200);
  assert(!hasClass(harness, 'ytzt-reveal-meta-hover'), 'Zen disable failed to invalidate hover reveal');
}

function appendChatSurface(harness) {
  const flexy = harness.document.createElement('ytd-watch-flexy');
  flexy.setAttribute('theater', '');
  harness.document.body.append(flexy);
  const frame = harness.document.createElement('ytd-live-chat-frame');
  frame.setAttribute('id', 'chat');
  flexy.append(frame);
  const closeContainer = harness.document.createElement('div');
  closeContainer.setAttribute('id', 'show-hide-button');
  frame.append(closeContainer);

  return { flexy, frame, closeContainer };
}

function appendChatControl(surface, label, onClick) {
  const closeButton = surface.frame.ownerDocument?.createElement('button') || new FakeElement('button');
  closeButton.setAttribute('aria-label', label);
  closeButton.addEventListener('click', onClick);
  surface.closeContainer.append(closeButton);

  return closeButton;
}

async function testLiveChatBoundaries() {
  const harness = await createHarness({ hideLiveChat: true });
  const surface = appendChatSurface(harness);
  await harness.settle(2200);
  const unrelatedButton = harness.document.createElement('button');
  unrelatedButton.setAttribute('aria-label', 'Close');
  let unrelatedClicks = 0;
  unrelatedButton.addEventListener('click', () => {
    unrelatedClicks += 1;
  });
  surface.frame.append(unrelatedButton);
  await harness.settle(1000);
  assert(unrelatedClicks === 0, 'generic unrelated chat control was clicked');

  let closeClicks = 0;
  const closeButton = harness.document.createElement('button');
  closeButton.setAttribute('aria-label', 'Hide chat');
  closeButton.addEventListener('click', () => {
    closeClicks += 1;
    surface.frame.setAttribute('collapsed', '');
  });
  surface.closeContainer.append(closeButton);
  await harness.settle(300);
  assert(closeClicks === 1, 'late semantic chat control was not clicked');
  await harness.settle(1000);
  assert(harness.clock.pendingCount() === 0, 'chat lookup timer leaked after close');

  for (let index = 0; index < 5; index += 1) {
    surface.frame.append(harness.document.createElement('div'));
  }

  await flushMicrotasks();
  assert(harness.clock.pendingCount() === 0, 'collapsed chat churn rescheduled a lookup timer');

  surface.frame.remove();
  const replacementFrame = harness.document.createElement('ytd-live-chat-frame');
  replacementFrame.setAttribute('id', 'chat');
  surface.flexy.append(replacementFrame);
  const replacementContainer = harness.document.createElement('div');
  replacementContainer.setAttribute('id', 'show-hide-button');
  replacementFrame.append(replacementContainer);
  const replacement = { flexy: surface.flexy, frame: replacementFrame, closeContainer: replacementContainer };
  let replacementClicks = 0;
  const replacementButton = harness.document.createElement('button');
  replacementButton.setAttribute('aria-label', 'Close chat');
  replacementButton.addEventListener('click', () => {
    replacementClicks += 1;
    replacement.frame.setAttribute('collapsed', '');
  });
  replacement.closeContainer.append(replacementButton);
  await harness.settle(400);
  assert(
    replacementClicks === 1,
    `frame replacement did not restart bounded chat handling: clicks=${replacementClicks}, collapsed=${replacement.frame.hasAttribute('collapsed')}, pending=${harness.clock.pendingCount()}`
  );

  const pendingHarness = await createHarness({ hideLiveChat: true });
  const pendingSurface = appendChatSurface(pendingHarness);
  await pendingHarness.settle(2200);
  appendChatControl(pendingSurface, 'Hide chat', () => {});
  await flushMicrotasks();
  assert(pendingHarness.clock.pendingCount() > 0, 'replacement fixture did not create an old pending lookup');
  pendingSurface.frame.remove();
  const pendingReplacementFrame = pendingHarness.document.createElement('ytd-live-chat-frame');
  pendingReplacementFrame.setAttribute('id', 'chat');
  pendingSurface.flexy.append(pendingReplacementFrame);
  const pendingReplacementContainer = pendingHarness.document.createElement('div');
  pendingReplacementContainer.setAttribute('id', 'show-hide-button');
  pendingReplacementFrame.append(pendingReplacementContainer);
  let pendingReplacementClicks = 0;
  const pendingReplacementButton = pendingHarness.document.createElement('button');
  pendingReplacementButton.setAttribute('aria-label', 'Hide chat');
  pendingReplacementButton.addEventListener('click', () => {
    pendingReplacementClicks += 1;
    pendingReplacementFrame.setAttribute('collapsed', '');
  });
  pendingReplacementContainer.append(pendingReplacementButton);
  await pendingHarness.settle(1200);
  await pendingHarness.settle(1000);
  assert(pendingReplacementClicks === 1, 'replacement frame did not get a fresh schedule after old timer cancellation');
  assert(pendingHarness.clock.pendingCount() === 0, 'replacement lifecycle left a pending timer');

  const collapseHarness = await createHarness({ hideLiveChat: true });
  const collapseSurface = appendChatSurface(collapseHarness);
  await collapseHarness.settle(2200);
  collapseSurface.closeContainer.append(collapseHarness.document.createElement('div'));
  await flushMicrotasks();
  assert(collapseHarness.clock.pendingCount() > 0, 'collapse fixture did not queue a lookup');
  collapseSurface.frame.setAttribute('collapsed', '');
  await collapseHarness.settle();
  assert(collapseHarness.clock.pendingCount() === 0, 'collapse mutation left its queued retry timer pending');

  let collapseClicks = 0;

  appendChatControl(collapseSurface, 'Hide chat', () => {
    collapseClicks += 1;
    collapseSurface.frame.setAttribute('collapsed', '');
  });

  collapseSurface.frame.removeAttribute('collapsed');
  await collapseHarness.settle(1200);
  assert(collapseClicks === 1, 'reopening a collapsed frame did not start a fresh retry lifecycle');
  assert(collapseHarness.clock.pendingCount() === 0, 'reopened chat left a retry timer pending');

  const candidateHarness = await createHarness({ hideLiveChat: true });
  const candidateSurface = appendChatSurface(candidateHarness);
  await candidateHarness.settle(2200);
  const disabledCandidate = candidateHarness.document.createElement('button');
  disabledCandidate.setAttribute('aria-label', 'Hide chat');
  disabledCandidate.setAttribute('disabled', '');
  candidateSurface.closeContainer.append(disabledCandidate);
  let localizedClicks = 0;
  const localizedButton = candidateHarness.document.createElement('button');
  localizedButton.setAttribute('aria-label', 'Ocultar chat');
  localizedButton.addEventListener('click', () => {
    localizedClicks += 1;
    candidateSurface.frame.setAttribute('collapsed', '');
  });
  candidateSurface.closeContainer.append(localizedButton);
  await candidateHarness.settle(1200);
  await candidateHarness.settle(1000);
  assert(localizedClicks === 1, 'valid localized control was blocked by disabled structural candidate');
  assert(candidateHarness.clock.pendingCount() === 0, 'candidate validation left a timer pending');

  const disabledRecoveryHarness = await createHarness({ hideLiveChat: true });
  const disabledRecoverySurface = appendChatSurface(disabledRecoveryHarness);
  let disabledRecoveryClicks = 0;

  const disabledRecoveryButton = appendChatControl(disabledRecoverySurface, 'Hide chat', () => {
    disabledRecoveryClicks += 1;
    disabledRecoverySurface.frame.setAttribute('collapsed', '');
  });

  disabledRecoveryButton.setAttribute('disabled', '');
  await disabledRecoveryHarness.settle(2200);
  assert(disabledRecoveryClicks === 0, 'disabled chat control was selected before recovery');
  disabledRecoveryButton.removeAttribute('disabled');
  await disabledRecoveryHarness.settle(1200);
  assert(disabledRecoveryClicks === 1, 'disabled chat control did not restart after becoming enabled');
  assert(disabledRecoveryHarness.clock.pendingCount() === 0, 'disabled-control recovery left a timer pending');

  const stubbornHarness = await createHarness({ hideLiveChat: true });
  const stubbornSurface = appendChatSurface(stubbornHarness);
  await stubbornHarness.settle(2200);
  const hiddenCandidate = stubbornHarness.document.createElement('button');
  hiddenCandidate.setAttribute('aria-label', 'Hide chat');
  hiddenCandidate.setAttribute('hidden', '');
  stubbornSurface.closeContainer.append(hiddenCandidate);
  let stubbornClicks = 0;
  const stubbornButton = stubbornHarness.document.createElement('button');
  stubbornButton.setAttribute('aria-label', 'Hide chat');
  stubbornButton.addEventListener('click', () => {
    stubbornClicks += 1;
  });
  stubbornSurface.closeContainer.append(stubbornButton);
  await stubbornHarness.settle(5000);
  assert(stubbornClicks === 1, `non-collapsing close control was clicked again: ${stubbornClicks}`);
  assert(stubbornHarness.clock.pendingCount() === 0, 'non-collapsing chat control leaked a retry timer');

  const visibilityHarness = await createHarness({ hideLiveChat: true });
  const visibilitySurface = appendChatSurface(visibilityHarness);
  await visibilityHarness.settle(2200);
  let visibilityClicks = 0;

  const visibilityButton = appendChatControl(visibilitySurface, 'Hide chat', () => {
    visibilityClicks += 1;
    visibilitySurface.frame.setAttribute('collapsed', '');
  });

  visibilityButton.setAttribute('hidden', '');
  await visibilityHarness.settle(300);
  assert(visibilityClicks === 0, 'hidden chat control was selected');
  visibilityButton.removeAttribute('hidden');
  await visibilityHarness.settle(600);
  await visibilityHarness.settle(1000);
  assert(visibilityClicks === 1, 'relevant visibility change did not restart exhausted lookup');
  assert(visibilityHarness.clock.pendingCount() === 0, 'visibility restart left a timer pending');

  const iframeHarness = await createHarness({ hideLiveChat: true });
  const iframeSurface = appendChatSurface(iframeHarness);
  const iframe = iframeHarness.document.createElement('iframe');
  const foreignDocument = new FakeDocument();
  iframe.contentDocument = foreignDocument;
  iframeSurface.frame.append(iframe);
  const foreignContainer = new ForeignElement('div');
  foreignContainer.setAttribute('id', 'close-button');
  foreignDocument.body.append(foreignContainer);
  const foreignUnclickable = new ForeignElement('div');
  foreignUnclickable.setAttribute('role', 'button');
  foreignUnclickable.setAttribute('aria-label', 'Close chat');
  foreignContainer.append(foreignUnclickable);
  const foreignButton = new ForeignElement('button');
  foreignButton.setAttribute('aria-label', 'Close chat');
  let foreignClicks = 0;
  foreignButton.addEventListener('click', () => {
    foreignClicks += 1;
    iframeSurface.frame.setAttribute('collapsed', '');
  });
  foreignContainer.append(foreignButton);
  await iframeHarness.settle(1200);
  await iframeHarness.settle(1000);
  assert(foreignClicks === 1, 'cross-realm iframe close control was not selected safely');
  assert(
    iframeHarness.clock.pendingCount() === 0,
    `iframe close handling left ${iframeHarness.clock.pendingCount()} timer(s) pending`
  );

  const iframeReplacementHarness = await createHarness({ hideLiveChat: true });
  const iframeReplacementSurface = appendChatSurface(iframeReplacementHarness);
  const replacementIframe = iframeReplacementHarness.document.createElement('iframe');
  replacementIframe.contentDocument = new FakeDocument();
  iframeReplacementSurface.frame.append(replacementIframe);
  await iframeReplacementHarness.settle(2200);
  const replacementDocument = new FakeDocument();
  replacementIframe.contentDocument = replacementDocument;
  replacementIframe.dispatchEvent({ type: 'load', target: replacementIframe });
  const replacementForeignContainer = new ForeignElement('div');
  replacementForeignContainer.setAttribute('id', 'close-button');
  replacementDocument.body.append(replacementForeignContainer);
  const replacementForeignButton = new ForeignElement('button');
  replacementForeignButton.setAttribute('aria-label', 'Close chat');
  let replacementForeignClicks = 0;
  replacementForeignButton.addEventListener('click', () => {
    replacementForeignClicks += 1;
    iframeReplacementSurface.frame.setAttribute('collapsed', '');
  });
  replacementForeignContainer.append(replacementForeignButton);
  await iframeReplacementHarness.settle(1200);
  assert(replacementForeignClicks === 1, 'iframe document replacement did not attach a fresh observer');
  assert(iframeReplacementHarness.clock.pendingCount() === 0, 'iframe document replacement left a timer pending');

  const lifecycleHarness = await createHarness({ hideLiveChat: true });
  const lifecycleSurface = appendChatSurface(lifecycleHarness);
  const lifecycleIframe = lifecycleHarness.document.createElement('iframe');
  const firstLifecycleDocument = new FakeDocument();
  lifecycleIframe.contentDocument = firstLifecycleDocument;
  lifecycleSurface.frame.append(lifecycleIframe);
  const firstLifecycleContainer = new ForeignElement('div');
  firstLifecycleContainer.setAttribute('id', 'close-button');
  firstLifecycleDocument.body.append(firstLifecycleContainer);
  let lifecycleClicks = 0;
  const stubbornLifecycleButton = new ForeignElement('button');
  stubbornLifecycleButton.setAttribute('aria-label', 'Close chat');
  stubbornLifecycleButton.addEventListener('click', () => {
    lifecycleClicks += 1;
  });
  firstLifecycleContainer.append(stubbornLifecycleButton);
  await lifecycleHarness.settle(5000);
  assert(lifecycleClicks === 1, `iframe lifecycle clicked the same close control again: ${lifecycleClicks}`);
  assert(lifecycleHarness.clock.pendingCount() === 0, 'click-exhausted iframe lifecycle left a timer pending');

  const secondLifecycleDocument = new FakeDocument();
  lifecycleIframe.contentDocument = secondLifecycleDocument;
  lifecycleIframe.dispatchEvent({ type: 'load', target: lifecycleIframe });
  await lifecycleHarness.settle(2200);
  const secondLifecycleContainer = new ForeignElement('div');
  secondLifecycleContainer.setAttribute('id', 'close-button');
  secondLifecycleDocument.body.append(secondLifecycleContainer);

  for (let index = 0; index < 5; index += 1) {
    secondLifecycleContainer.append(new ForeignElement('div'));
    await lifecycleHarness.settle(2200);
  }

  assert(lifecycleHarness.clock.pendingCount() === 0, 'lookup/restart-exhausted iframe lifecycle left a timer pending');

  const thirdLifecycleDocument = new FakeDocument();
  lifecycleIframe.contentDocument = thirdLifecycleDocument;
  lifecycleIframe.dispatchEvent({ type: 'load', target: lifecycleIframe });
  const thirdLifecycleContainer = new ForeignElement('div');
  thirdLifecycleContainer.setAttribute('id', 'close-button');
  thirdLifecycleDocument.body.append(thirdLifecycleContainer);
  const freshLifecycleButton = new ForeignElement('button');
  freshLifecycleButton.setAttribute('aria-label', 'Close chat');
  freshLifecycleButton.addEventListener('click', () => {
    lifecycleClicks += 1;
    lifecycleSurface.frame.setAttribute('collapsed', '');
  });
  thirdLifecycleContainer.append(freshLifecycleButton);
  await lifecycleHarness.settle(1200);
  assert(lifecycleClicks === 2, 'new iframe document did not reset the close-click lifecycle');
  assert(lifecycleHarness.clock.pendingCount() === 0, 'fresh iframe lifecycle left a timer pending');

  const burstHarness = await createHarness({ hideLiveChat: true });
  const burstSurface = appendChatSurface(burstHarness);
  await burstHarness.settle(2500);

  for (let index = 0; index < 100; index += 1) {
    burstSurface.frame.append(burstHarness.document.createElement('div'));
  }

  await burstHarness.settle(5000);
  assert(burstHarness.clock.pendingCount() === 0, 'unrelated chat mutation burst left a timer running');

  const disabledHarness = await createHarness({ hideLiveChat: false });
  const disabledSurface = appendChatSurface(disabledHarness);
  let disabledClicks = 0;
  appendChatControl(disabledSurface, 'Hide chat', () => {
    disabledClicks += 1;
  });
  await disabledHarness.settle(1000);
  assert(disabledClicks === 0, 'disabled chat hiding clicked a control');
}

function appendPanelSurface(harness) {
  const flexy = harness.document.createElement('ytd-watch-flexy');
  flexy.setAttribute('theater', '');
  const below = harness.document.createElement('div');
  below.setAttribute('id', 'below');
  const nativeControl = harness.document.createElement('button');
  nativeControl.setAttribute('aria-label', 'Native panel control');
  below.append(nativeControl);
  flexy.append(below);
  const secondary = harness.document.createElement('div');
  secondary.setAttribute('id', 'secondary');
  flexy.append(secondary);
  harness.document.body.append(flexy);

  return { flexy, below, nativeControl, secondary };
}

async function testNativePlayerTreatment() {
  const harness = await createHarness({ hideLiveChat: false });
  const player = harness.document.createElement('div');
  player.className = 'html5-video-player ytp-player-minimized';
  const ambient = harness.document.createElement('div');
  ambient.id = 'cinematics';
  ambient.style.display = 'grid';
  player.append(ambient);
  const disabledAmbient = harness.document.createElement('div');
  disabledAmbient.id = 'cinematics-container';
  disabledAmbient.setAttribute('hidden', '');
  disabledAmbient.style.display = 'none';
  player.append(disabledAmbient);
  harness.document.body.append(player);
  await harness.settle(800);
  assert(!ambient.hasAttribute('hidden') && ambient.style.display === 'grid', 'Zen changed native ambient visibility');
  assert(disabledAmbient.hasAttribute('hidden') && disabledAmbient.style.display === 'none', 'Zen forced disabled ambient on');
  assert(!player.classList.contains('ytp-player-minimized'), 'Zen failed to expand minimized player');
  assert(hasClass(harness, 'ytzt-hide-recommendations'), 'recommendation hiding is not enabled by default');
  harness.storage.emit({ hideRecommendations: { newValue: false } });
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-hide-recommendations'), 'recommendation toggle failed to restore native visibility');
  harness.dispatch('keydown');
  harness.dispatch('keyup');
  await harness.settle();
  assert(player.classList.contains('ytp-player-minimized'), 'Zen exit failed to restore prior minimization');
  assert(!ambient.hasAttribute('hidden') && ambient.style.display === 'grid', 'Zen exit changed ambient styling');
}

async function testScrollingModes() {
  const harness = await createHarness({ hideLiveChat: false });
  const surface = appendPanelSurface(harness);
  const player = harness.document.createElement('div');
  player.className = 'html5-video-player';
  surface.flexy.append(player);
  await harness.settle(800);
  assert(!hasClass(harness, 'ytzt-reveal-meta-enabled'), 'default page mode removed details from page flow');
  assert(!harness.document.querySelector('.ytzt-meta-drawer-button'), 'page mode created a details drawer button');
  assert(!harness.dispatch('wheel', { target: player, deltaY: 100 }).defaultPrevented, 'page scrolling was intercepted');

  harness.setPageScroll(1500);
  harness.storage.emit({ scrollBehavior: { newValue: 'card' }, sideHoverPosition: { newValue: 'left' } });
  await harness.settle();
  assert(hasClass(harness, 'ytzt-reveal-meta-enabled') && hasClass(harness, 'ytzt-side-left'), 'left card mode was not applied');
  assert(harness.pageScrollY === 0, 'switching from deep comments left the video offscreen');
  harness.storage.emit({ revealMetaOnHover: { newValue: false } });
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-reveal-meta-enabled'), 'original Side details off toggle did not restore page flow');
  assert(!harness.document.querySelector('.ytzt-meta-drawer-button'), 'disabled details kept its drawer control');
  assert(!harness.dispatch('wheel', { target: player, deltaY: 100 }).defaultPrevented, 'disabled details still intercepted scrolling');
  harness.storage.emit({ revealMetaOnHover: { newValue: true } });
  await harness.settle();
  assert(hasClass(harness, 'ytzt-reveal-meta-enabled'), 'original Side details on toggle did not restore card mode');

  assert(!harness.dispatch('wheel', { target: player, deltaY: 100, ctrlKey: true }).defaultPrevented, 'pinch zoom was intercepted');
  assert(!harness.dispatch('wheel', { target: player, deltaY: 5, deltaX: 100 }).defaultPrevented, 'horizontal gesture was intercepted');
  assert(!harness.dispatch('wheel', { target: player, deltaY: -100 }).defaultPrevented, 'upward scroll opened a closed card');
  const nativeButton = harness.document.createElement('button');
  player.append(nativeButton);
  assert(!harness.dispatch('wheel', { target: nativeButton, deltaY: 100 }).defaultPrevented, 'native player control wheel was intercepted');

  const opening = harness.dispatch('wheel', { target: player, deltaY: 100 });
  assert(opening.defaultPrevented && hasClass(harness, 'ytzt-reveal-meta-drawer'), 'scroll did not open and pin the card');
  const button = harness.document.querySelector('.ytzt-meta-drawer-button');
  assert(button.getAttribute('aria-expanded') === 'true', 'scroll opening left stale button state');
  surface.below.clientHeight = 400;
  harness.dispatch('wheel', { target: player, deltaY: 3, deltaMode: 1 });
  assert(surface.below.scrollTop === 48, 'line wheel units were not normalized');
  assert(!harness.dispatch('wheel', { target: surface.nativeControl, deltaY: 100 }).defaultPrevented, 'native card scrolling was intercepted');

  harness.storage.emit({ scrollBehavior: { newValue: 'page' } });
  await harness.settle();
  assert(!hasClass(harness, 'ytzt-reveal-meta-enabled') && !hasClass(harness, 'ytzt-reveal-meta-drawer'), 'page mode retained card layout or reveal state');
}

async function testIndependentContentSettings() {
  const harness = await createHarness({ hideLiveChat: false, detailsLocation: 'card', detailsSide: 'left', detailsTrigger: 'button', playlistLocation: 'card', playlistSide: 'right', playlistTrigger: 'hover', drawerImplementation: 'native', hoverRevealDelay: 0 });
  const surface = appendPanelSurface(harness);
  const playlist = harness.document.createElement('ytd-playlist-panel-renderer');
  playlist.append(harness.document.createElement('ytd-playlist-panel-video-renderer'));
  surface.secondary.append(playlist);
  const player = harness.document.createElement('div');
  player.className = 'html5-video-player';
  surface.flexy.append(player);
  await harness.settle(800);
  assert(hasClass(harness, 'ytzt-side-left') && hasClass(harness, 'ytzt-playlist-right'), 'independent sides were not applied');
  assert(hasClass(harness, 'ytzt-reveal-playlist-enabled'), 'YouTube appearance moved playlist out of card mode');
  assert(!hasClass(harness, 'ytzt-details-hover') && hasClass(harness, 'ytzt-playlist-hover'), 'per-panel hover flags were coupled');
  assert(!harness.dispatch('wheel', { target: player, deltaY: 100 }).defaultPrevented, 'button-only details intercepted scrolling');
  assert(harness.document.querySelector('.ytzt-meta-drawer-button'), 'button-only details lost edge control');
  assert(harness.document.querySelector('.ytzt-playlist-drawer-button'), 'hover playlist lost edge control');
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  await harness.settle(30);
  assert(hasClass(harness, 'ytzt-reveal-playlist-hover'), 'independent playlist hover did not open');
  harness.storage.emit({ detailsTrigger: { newValue: 'scroll-hover' }, playlistLocation: { newValue: 'page' } });
  await harness.settle(50);
  assert(!hasClass(harness, 'ytzt-reveal-playlist-enabled'), 'page playlist retained overlay geometry');
  assert(hasClass(harness, 'ytzt-details-hover'), 'combined details trigger lost hover');
  assert(harness.dispatch('wheel', { target: player, deltaY: 100 }).defaultPrevented, 'combined details trigger lost scrolling');
  harness.storage.emit({ playlistLocation: { newValue: 'card' } });
  await harness.settle(50);
  harness.dispatch('wheel', { target: player, deltaY: 100 });
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  await harness.settle(30);
  assert(hasClass(harness, 'ytzt-reveal-playlist-hover') && !hasClass(harness, 'ytzt-reveal-meta-drawer'), 'scroll-pinned details blocked independent playlist hover');
  harness.storage.emit({ playlistLocation: { newValue: 'hidden' } });
  await harness.settle(50);
  assert(hasClass(harness, 'ytzt-playlist-hidden'), 'hidden playlist class missing');
  assert(!harness.document.querySelector('.ytzt-playlist-drawer-button'), 'hidden playlist retained edge control');
  harness.storage.emit({ drawerImplementation: { newValue: 'custom' } });
  await harness.settle(50);
  assert(hasClass(harness, 'ytzt-playlist-hidden'), 'appearance changed explicit playlist location');
}

async function testHoverButtonOwnership() {
  const harness = await createHarness({ scrollBehavior: 'card', hideLiveChat: false, sideRevealMode: 'hover', hoverRevealDelay: 100 });
  appendPanelSurface(harness);
  const button = harness.document.querySelector('.ytzt-meta-drawer-button');
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  harness.clock.advance(50);
  harness.dispatch('mousemove', { target: button, clientX: 1279, clientY: 240 });
  await harness.settle(200);
  assert(!hasClass(harness, 'ytzt-reveal-meta-hover'), 'button hover opened the card');
  harness.dispatch('mousemove', { clientX: 1279, clientY: 240 });
  await harness.settle(100);
  assert(hasClass(harness, 'ytzt-reveal-meta-hover'), 'edge hover failed to open card');
  assert(button.getAttribute('aria-expanded') === 'true', 'hover preview left stale accessibility state');
  assert(button.getAttribute('aria-label') === 'Keep video details open', 'hover preview button did not describe pin action');
  button.click();
  assert(hasClass(harness, 'ytzt-reveal-meta-drawer'), 'first click closed a hover-open panel instead of pinning it');
  harness.dispatch('mousemove', { clientX: 600, clientY: 400 });
  await harness.settle(200);
  assert(hasClass(harness, 'ytzt-reveal-meta-drawer'), 'pointer movement closed a pinned card');
  button.click();
  harness.dispatch('mousemove', { target: button, clientX: 1279, clientY: 240 });
  await harness.settle(200);
  assert(!hasClass(harness, 'ytzt-reveal-meta-drawer') && !hasClass(harness, 'ytzt-reveal-meta-hover'), 'button close immediately reopened the card');
}

async function testPanelKeyboardFocus() {
  const harness = await createHarness({ scrollBehavior: 'card', hideLiveChat: false, sideRevealMode: 'hover' });
  const panelSurface = appendPanelSurface(harness);
  await harness.settle(500);
  const drawerButton = harness.document.querySelector('.ytzt-meta-drawer-button');
  assert(drawerButton, 'details drawer trigger was not created');

  drawerButton.dispatchEvent({
    type: 'click',
    detail: 0,
    target: drawerButton,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {}
  });
  assert(
    harness.document.activeElement?.getAttribute('aria-label') === 'Native panel control',
    'keyboard drawer opening did not enter native panel content'
  );

  const escapeEvent = harness.dispatch('keydown', {
    key: 'Escape',
    code: 'Escape',
    target: harness.document.activeElement,
    path: [harness.document.activeElement]
  });

  assert(escapeEvent.defaultPrevented, 'panel Escape was not handled');
  assert(harness.document.activeElement === drawerButton, 'panel Escape did not restore trigger focus');

  drawerButton.dispatchEvent({
    type: 'click',
    detail: 1,
    target: drawerButton,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {}
  });
  assert(harness.document.activeElement === drawerButton, 'pointer drawer opening stole focus');

  const player = harness.document.createElement('div');
  player.className = 'html5-video-player';
  harness.document.body.append(player);

  const playerEscape = harness.dispatch('keydown', {
    key: 'Escape',
    code: 'Escape',
    target: player,
    path: [player]
  });

  assert(playerEscape.defaultPrevented, 'Escape left an open panel while focus was on the player');
  assert(!hasClass(harness, 'ytzt-reveal-meta-drawer'), 'Escape did not close the open drawer');
  assert(harness.document.activeElement === drawerButton, 'Escape did not focus the matching drawer button');

  const idleEscape = harness.dispatch('keydown', {
    key: 'Escape',
    code: 'Escape',
    target: player,
    path: [player]
  });

  assert(!idleEscape.defaultPrevented, 'Escape was handled while no panel was open');

  drawerButton.dispatchEvent({
    type: 'click',
    detail: 0,
    target: drawerButton,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() {}
  });
  panelSurface.nativeControl.focus();
  drawerButton.remove();

  const removedTriggerEscape = harness.dispatch('keydown', {
    key: 'Escape',
    code: 'Escape',
    target: harness.document.activeElement,
    path: [harness.document.activeElement]
  });

  assert(removedTriggerEscape.defaultPrevented, 'Escape from an open panel was not handled after trigger removal');
  assert(
    harness.document.activeElement === panelSurface.nativeControl,
    'focus restoration used a disconnected trigger'
  );
}

async function testNativeExitResize() {
  const harness = await createHarness({ hideLiveChat: false });
  await harness.settle(1000);
  let resizeCount = 0;
  harness.windowListeners.set('resize', [() => { resizeCount += 1; }]);
  harness.dispatch('keydown');
  harness.dispatch('keyup');
  await harness.settle(800);
  assert(!hasClass(harness, 'ytzt-watch-page'), 'Zen did not exit');
  assert(resizeCount === 2, 'native exit must notify once after layout and once after settling');
  const settled = resizeCount;
  await harness.settle(2000);
  assert(resizeCount === settled, 'native resize recovery kept recurring');
}

async function testNativeTheaterOwnership() {
  const harness = await createHarness({ scrollBehavior: 'card', hideLiveChat: false });
  const actions = harness.document.createElement('div');
  actions.classList.add('ytp-fullscreen-quick-actions');
  actions.append(harness.document.createElement('button'));
  harness.document.body.append(actions);
  harness.dispatch('yt-page-data-updated');
  await harness.settle(300);
  assert(hasClass(harness, 'ytzt-native-theater'), 'mounted native actions were not adopted');
  assert(!hasClass(harness, 'ytzt-native-actions-ready'), 'partial native action row was exposed');
  actions.querySelector('button').remove();

  for (const label of ['Like', 'Dislike', 'Comments', 'Share']) {
    const button = harness.document.createElement('button');
    button.setAttribute('aria-label', label);
    const icon = harness.document.createElement('svg');
    button.append(icon);
    actions.append(button);
  }

  await harness.settle();
  assert(!hasClass(harness, 'ytzt-native-actions-ready'), 'empty native icons were exposed');

  for (const icon of actions.querySelectorAll('svg')) {
    const path = harness.document.createElement('path');
    path.setAttribute('d', 'M0 0h24v24H0z');
    icon.append(path);
  }

  await harness.settle();
  assert(hasClass(harness, 'ytzt-native-actions-ready'), 'late native controls did not become ready without a page event');
  assert(!hasClass(harness, 'ytzt-reveal-meta-enabled'), 'custom details competed with native actions');
  harness.dispatch('mousemove', { clientY: 0 });
  assert(hasClass(harness, 'ytzt-reveal-header'), 'native theater lost the top-edge search reveal');
  harness.dispatch('mousemove', { clientY: 300 });
  assert(!hasClass(harness, 'ytzt-reveal-header'), 'top-edge header did not close');
  actions.remove();
  harness.dispatch('yt-page-data-updated');
  await harness.settle(300);
  assert(!hasClass(harness, 'ytzt-native-theater'), 'native mode remained after native actions disappeared');
  assert(hasClass(harness, 'ytzt-reveal-meta-enabled'), 'custom fallback did not restore');
}

async function testNativeFullscreenOwnership() {
  const harness = await createHarness({ scrollBehavior: 'card', hideLiveChat: true });
  assert(hasClass(harness, 'ytzt-watch-page'), 'Zen did not start');
  harness.document.fullscreenElement = harness.document.body;
  harness.dispatch('fullscreenchange');
  await harness.settle(1200);
  assert(hasClass(harness, 'ytzt-watch-page'), 'fullscreen entry tore down the saved Zen presentation');
  assert(hasClass(harness, 'ytzt-reveal-meta-enabled'), 'fullscreen entry changed saved details presentation');
  const shortcut = harness.dispatch('keydown');
  assert(!shortcut.defaultPrevented, 'Zen consumed native fullscreen shortcut');
  const escape = harness.dispatch('keydown', { key: 'Escape', code: 'Escape' });
  assert(!escape.defaultPrevented, 'Zen consumed native fullscreen Escape');
  harness.document.fullscreenElement = null;
  harness.dispatch('fullscreenchange');
  await harness.settle(250);
  assert(hasClass(harness, 'ytzt-watch-page'), 'Zen state was lost after fullscreen exit');
  assert(hasClass(harness, 'ytzt-reveal-meta-enabled'), 'details preference was lost after fullscreen exit');
}

async function testIdleLagRegression() {
  const harness = await createHarness({ scrollBehavior: 'card' });
  harness.clock.advance(450);
  await flushMicrotasks();
  assert(
    harness.drawerTextWrites === 1,
    `idle drawer text writes recurred: expected 1, got ${harness.drawerTextWrites}`
  );

  const button = harness.document.querySelector('.ytzt-meta-drawer-button');
  assert(button, 'drawer button was not created');
  button.remove();
  harness.dispatch('yt-navigate-finish');
  await harness.settle(1100);
  assert(harness.document.querySelector('.ytzt-meta-drawer-button'), 'removed drawer button was not recreated');
  assert(
    harness.drawerTextWrites === 2,
    `recreated drawer text write count mismatch: expected 2, got ${harness.drawerTextWrites}`
  );

  await harness.settle(700);
  const settledAnimationFrameRequests = harness.animationFrameRequests;

  for (let index = 0; index < 100; index += 1) {
    harness.document.body.append(harness.document.createElement('div'));
  }

  await flushMicrotasks();
  await harness.settle(450);
  assert(harness.animationFrameRequests === settledAnimationFrameRequests, 'unrelated page churn triggered Zen work');
}

async function testDistractionFilters() {
  const harness = await createHarness();
  await harness.settle(50);
  assert(hasClass(harness, 'ytzt-hide-home-feed'), 'home feed hiding is not on by default');
  assert(hasClass(harness, 'ytzt-hide-endscreen'), 'end screen hiding is not on by default');
  assert(hasClass(harness, 'ytzt-hide-info-cards'), 'info card hiding is not on by default');
  assert(hasClass(harness, 'ytzt-disable-autoplay'), 'autoplay control is not armed by default');
  assert(hasClass(harness, 'ytzt-hide-offers'), 'offers are not hidden by default');
  assert(hasClass(harness, 'ytzt-filter-recommendations'), 'recommendation filter is not applied with the existing setting');
  assert(!hasClass(harness, 'ytzt-hide-shorts'), 'shorts hiding is on without being chosen');
  assert(!hasClass(harness, 'ytzt-hide-comments'), 'comments are hidden by default');
  assert(!hasClass(harness, 'ytzt-filter-live-chat'), 'live chat CSS hide ran during Zen and duplicated the native close');

  harness.storage.emit({
    hideHomeFeed: { newValue: false },
    hideShorts: { newValue: true },
    hideComments: { newValue: true },
    disableAutoplay: { newValue: false }
  });
  await harness.settle(50);
  assert(!hasClass(harness, 'ytzt-hide-home-feed'), 'home feed toggle did not restore the feed');
  assert(hasClass(harness, 'ytzt-hide-shorts'), 'shorts toggle did not apply');
  assert(hasClass(harness, 'ytzt-hide-comments'), 'comments toggle did not apply');
  assert(!hasClass(harness, 'ytzt-disable-autoplay'), 'autoplay toggle did not turn off');

  const player = harness.document.createElement('div');
  player.id = 'movie_player';
  const toggle = harness.document.createElement('button');
  toggle.className = 'ytp-autonav-toggle-button';
  toggle.setAttribute('aria-checked', 'true');
  let clicks = 0;
  toggle.addEventListener('click', () => {
    clicks += 1;
  });
  player.append(toggle);
  harness.document.body.append(player);
  const title = harness.document.createElement('title');
  title.textContent = '(4) a video';
  harness.document.documentElement.append(title);
  harness.storage.emit({ disableAutoplay: { newValue: true } });
  await harness.settle(900);
  assert(clicks === 1, `autoplay toggle clicked ${clicks} times`);
  assert(title.textContent === 'a video', 'unread count stayed in the tab title');
  await harness.settle(900);
  assert(clicks === 1, 'autoplay toggle was clicked again on a later apply');

  harness.location.pathname = '/shorts/clip';
  harness.location.href = 'https://www.youtube.com/shorts/clip';
  harness.dispatch('yt-navigate-finish');
  await harness.settle(1000);
  assert(hasClass(harness, 'ytzt-shorts-page'), 'shorts watch page was not recognized');
  assert(!hasClass(harness, 'ytzt-watch-page'), 'a Shorts URL entered Zen theater');
}

async function main() {
  await testStartupAndShortcut();
  await testStartupAndShortcutChoices();
  await testAutoZenNavigation();
  await testHoverInvalidation();
  await testLiveChatBoundaries();
  await testNativePlayerTreatment();
  await testScrollingModes();
  await testIndependentContentSettings();
  await testHoverButtonOwnership();
  await testPanelKeyboardFocus();
  await testNativeExitResize();
  await testNativeTheaterOwnership();
  await testNativeFullscreenOwnership();
  await testIdleLagRegression();
  await testDistractionFilters();
  console.log(
    'lag regression: PASS (storage fallback; shortcut phases; Auto Zen navigation; hover cancellation; page/card scrolling; hover/button ownership; bounded live chat; idle writes; unrelated churn)'
  );
}

main().catch((error) => {
  console.error(`lag regression: FAIL: ${error.message}`);
  process.exitCode = 1;
});
