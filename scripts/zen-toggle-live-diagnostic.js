/*
 * Paste this file into the YouTube tab's DevTools console to instrument Zen
 * toggles in that exact tab. It does not change extension code or intercept
 * keyboard behavior. Stop it with: __ytztResizeDiag.stop()
 */
(() => {
  const previous = window.__ytztResizeDiag;
  previous?.stop?.();

  const runStartedAt = performance.now();
  const runId = `ytzt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const firstFailureStorageKey = 'ytztResizeDiag:firstUndersized';
  const snapshotDelays = [0, 16, 50, 100, 250, 500, 1000, 1500, 2000];
  const maxSnapshots = 300;
  const maxTimelineEvents = 2500;
  const geometryTolerance = 3;
  const timers = new Set();
  const state = {
    version: 1,
    runId,
    startedAt: new Date().toISOString(),
    stoppedAt: null,
    toggleCount: 0,
    timeline: [],
    snapshots: [],
    firstFailure: null,
    firstFailureStorageKey,
    persistenceError: null,
    stopped: false,
  };

  const timestamp = () => ({
    elapsedMs: Math.round((performance.now() - runStartedAt) * 10) / 10,
    wallClock: new Date().toISOString(),
  });

  const pushCapped = (list, value, limit) => {
    list.push(value);
    if (list.length > limit) {
      list.splice(0, list.length - limit);
    }
  };

  const round = (value) => Math.round(value * 100) / 100;

  const rectOf = (element) => {
    if (!element?.isConnected) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    return {
      x: round(rect.x),
      y: round(rect.y),
      top: round(rect.top),
      left: round(rect.left),
      right: round(rect.right),
      bottom: round(rect.bottom),
      width: round(rect.width),
      height: round(rect.height),
    };
  };

  const attributesOf = (element) => {
    if (!element?.attributes) {
      return {};
    }

    return Object.fromEntries([...element.attributes].map(({ name, value }) => [name, value]));
  };

  const computedOf = (element) => {
    if (!element?.isConnected) {
      return null;
    }

    const style = getComputedStyle(element);
    return {
      width: style.width,
      minWidth: style.minWidth,
      maxWidth: style.maxWidth,
      height: style.height,
      minHeight: style.minHeight,
      maxHeight: style.maxHeight,
      top: style.top,
      left: style.left,
      position: style.position,
      transform: style.transform,
      objectFit: style.objectFit,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
    };
  };

  const viewport = () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    visualWidth: window.visualViewport?.width ?? null,
    visualHeight: window.visualViewport?.height ?? null,
    devicePixelRatio: window.devicePixelRatio,
  });

  const intersectionArea = (rect, view) => {
    if (!rect) {
      return 0;
    }

    const width = Math.max(0, Math.min(rect.right, view.width) - Math.max(rect.left, 0));
    const height = Math.max(0, Math.min(rect.bottom, view.height) - Math.max(rect.top, 0));
    return width * height;
  };

  const visibilityOf = (element, view) => {
    if (!element?.isConnected) {
      return { connected: false, visible: false, intersectionArea: 0 };
    }

    const rect = rectOf(element);
    const style = getComputedStyle(element);
    const visible = Boolean(rect && rect.width > 0 && rect.height > 0 &&
      style.display !== 'none' && style.visibility !== 'hidden' &&
      style.opacity !== '0' && intersectionArea(rect, view) > 0);
    return { connected: true, visible, intersectionArea: round(intersectionArea(rect, view)) };
  };

  const describeOwner = (element) => {
    const owner = element?.closest?.('#movie_player, .html5-video-player');
    if (!owner) {
      return null;
    }

    return {
      id: owner.id,
      classes: typeof owner.className === 'string' ? owner.className : '',
      tagName: owner.tagName.toLowerCase(),
    };
  };

  const gatherCandidates = (selectors) => {
    const elements = [...new Set(selectors.flatMap((selector) => [...document.querySelectorAll(selector)]))];
    const view = viewport();
    return elements.map((element) => {
      const rect = rectOf(element);
      const visibility = visibilityOf(element, view);
      return {
        element,
        matchedSelectors: selectors.filter((selector) => element.matches(selector)),
        tagName: element.tagName.toLowerCase(),
        id: element.id,
        classes: typeof element.className === 'string' ? element.className : '',
        connected: visibility.connected,
        visible: visibility.visible,
        intersectionArea: visibility.intersectionArea,
        rect,
        computed: computedOf(element),
        inlineStyle: element.getAttribute('style') || '',
        attributes: attributesOf(element),
        owner: describeOwner(element),
      };
    });
  };

  const publicCandidate = (candidate) => {
    if (!candidate) {
      return null;
    }

    const { element, ...details } = candidate;
    return details;
  };

  const chooseLargestVisible = (candidates) => candidates
    .filter((candidate) => candidate.connected && candidate.visible)
    .sort((left, right) => right.intersectionArea - left.intersectionArea)[0] || null;

  const elementSummary = (element) => {
    if (!(element instanceof Element)) {
      return { nodeType: element?.nodeType ?? null };
    }

    return {
      tagName: element.tagName.toLowerCase(),
      id: element.id,
      classes: typeof element.className === 'string' ? element.className.slice(0, 240) : '',
      attributeName: null,
    };
  };

  const watchFlexyState = () => [...document.querySelectorAll('ytd-watch-flexy')].map((element) => ({
    id: element.id,
    classes: typeof element.className === 'string' ? element.className : '',
    attributes: attributesOf(element),
    theater: element.hasAttribute('theater'),
    rect: rectOf(element),
  }));

  const boundsMismatch = (candidate, view) => {
    if (!candidate?.visible || !candidate.rect) {
      return candidate ? ['missing-or-hidden'] : ['missing'];
    }

    const rect = candidate.rect;
    const reasons = [];
    if (Math.abs(rect.left) > geometryTolerance) reasons.push('left');
    if (Math.abs(rect.top) > geometryTolerance) reasons.push('top');
    if (Math.abs(rect.width - view.width) > geometryTolerance) reasons.push('width');
    if (Math.abs(rect.height - view.height) > geometryTolerance) reasons.push('height');
    if (Math.abs(rect.right - view.width) > geometryTolerance) reasons.push('right');
    if (Math.abs(rect.bottom - view.height) > geometryTolerance) reasons.push('bottom');
    return reasons;
  };

  const collectSnapshot = (phase, toggleId = null, trigger = null) => {
    const view = viewport();
    const playerCandidates = gatherCandidates(['#movie_player', '.html5-video-player']);
    const videoCandidates = gatherCandidates(['video.html5-main-video', 'video']);
    const chosenPlayer = chooseLargestVisible(playerCandidates);
    const playerVideos = chosenPlayer
      ? videoCandidates.filter((candidate) => chosenPlayer.element.contains(candidate.element))
      : videoCandidates;
    const chosenVideo = chooseLargestVisible(playerVideos);
    const html = document.documentElement;
    const active = html.classList.contains('ytzt-watch-page');
    const playerMismatch = boundsMismatch(chosenPlayer, view);
    const videoMismatch = boundsMismatch(chosenVideo, view);
    const undersizedZen = active && (playerMismatch.length > 0 || videoMismatch.length > 0);
    const snapshot = {
      ...timestamp(),
      phase,
      toggleId,
      trigger,
      zenActive: active,
      theaterActive: Boolean(document.querySelector('ytd-watch-flexy[theater]')),
      undersizedZen,
      mismatch: { player: playerMismatch, video: videoMismatch },
      viewport: view,
      ytztClasses: [...html.classList].filter((className) => className.startsWith('ytzt-')),
      html: {
        classes: html.className,
        attributes: attributesOf(html),
      },
      body: document.body ? {
        classes: document.body.className,
        attributes: attributesOf(document.body),
      } : null,
      watchFlexy: watchFlexyState(),
      playerCandidateCount: playerCandidates.length,
      visiblePlayerCandidateCount: playerCandidates.filter((candidate) => candidate.visible).length,
      videoCandidateCount: videoCandidates.length,
      visibleVideoCandidateCount: videoCandidates.filter((candidate) => candidate.visible).length,
      chosenPlayer: publicCandidate(chosenPlayer),
      chosenVideo: publicCandidate(chosenVideo),
      playerCandidates: playerCandidates.map(publicCandidate),
      videoCandidates: videoCandidates.map(publicCandidate),
      intrinsicVideo: chosenVideo?.element ? {
        videoWidth: chosenVideo.element.videoWidth,
        videoHeight: chosenVideo.element.videoHeight,
        readyState: chosenVideo.element.readyState,
      } : null,
    };

    pushCapped(state.snapshots, snapshot, maxSnapshots);
    if (undersizedZen && !state.firstFailure) {
      state.firstFailure = snapshot;
      try {
        localStorage.setItem(firstFailureStorageKey, JSON.stringify({
          savedAt: new Date().toISOString(),
          runId,
          snapshot,
        }));
      } catch (error) {
        state.persistenceError = String(error);
      }
      console.error('[YTZT resize diagnostic] FIRST UNDERSIZED ZEN STATE', snapshot);
    }

    return snapshot;
  };

  const recordTimeline = (type, details = {}) => {
    pushCapped(state.timeline, { ...timestamp(), type, ...details }, maxTimelineEvents);
  };

  const scheduleToggleSnapshots = (source) => {
    const toggleId = ++state.toggleCount;
    const active = document.documentElement.classList.contains('ytzt-watch-page');
    recordTimeline('zen-transition', { toggleId, active, source });
    for (const delay of snapshotDelays) {
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        collectSnapshot(`toggle+${delay}ms`, toggleId, source);
      }, delay);
      timers.add(timer);
    }
  };

  let lastZenActive = document.documentElement.classList.contains('ytzt-watch-page');
  const onResize = () => recordTimeline('resize', {
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const onKeyDown = (event) => {
    const isT = event.code === 'KeyT' || event.key?.toLowerCase() === 't';
    if (isT && !event.metaKey && !event.ctrlKey && !event.altKey) {
      recordTimeline('t-keydown', {
        repeat: event.repeat,
        defaultPrevented: event.defaultPrevented,
        target: elementSummary(event.target),
      });
    }
  };
  const observer = new MutationObserver((records) => {
    recordTimeline('mutation', {
      count: records.length,
      records: records.slice(0, 80).map((record) => ({
        type: record.type,
        attributeName: record.attributeName,
        target: elementSummary(record.target),
      })),
    });

    const active = document.documentElement.classList.contains('ytzt-watch-page');
    if (active !== lastZenActive) {
      lastZenActive = active;
      scheduleToggleSnapshots('html.ytzt-watch-page mutation');
    }
  });

  window.addEventListener('resize', onResize, true);
  window.addEventListener('keydown', onKeyDown, true);
  document.addEventListener('keydown', onKeyDown, true);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeOldValue: false,
    childList: true,
    subtree: true,
    attributeFilter: ['class', 'style', 'width', 'height', 'top', 'left', 'transform', 'theater', 'hidden', 'collapsed'],
  });

  collectSnapshot('armed');
  recordTimeline('armed', {
    initialZenActive: lastZenActive,
    initialTheaterActive: Boolean(document.querySelector('ytd-watch-flexy[theater]')),
  });

  const diagnostic = {
    version: state.version,
    runId,
    firstFailureStorageKey,
    snapshot: (label = 'manual') => collectSnapshot(label),
    dump: () => ({ ...state, snapshots: [...state.snapshots], timeline: [...state.timeline] }),
    json: () => JSON.stringify({ ...state, snapshots: [...state.snapshots], timeline: [...state.timeline] }, null, 2),
    download: () => {
      const blob = new Blob([diagnostic.json()], { type: 'application/json' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${runId}.json`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    },
    stop: () => {
      if (state.stopped) {
        return;
      }

      state.stopped = true;
      state.stoppedAt = new Date().toISOString();
      observer.disconnect();
      window.removeEventListener('resize', onResize, true);
      window.removeEventListener('keydown', onKeyDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
      timers.clear();
      recordTimeline('stopped');
      console.info('[YTZT resize diagnostic] stopped', diagnostic.dump());
    },
  };

  window.__ytztResizeDiag = diagnostic;
  console.info(
    '[YTZT resize diagnostic] armed',
    runId,
    'Perform t out/in cycles, then run __ytztResizeDiag.dump() or __ytztResizeDiag.download().',
  );
})();
