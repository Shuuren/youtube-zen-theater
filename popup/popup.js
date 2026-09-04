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

const controls = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS)
    .map((key) => [key, document.getElementById(key)])
    .filter(([, control]) => Boolean(control))
);

init();

async function init() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  for (const [key, control] of Object.entries(controls)) {
    if (control.type === 'checkbox') {
      control.checked = settings[key] === true;
    } else if (control.type === 'range') {
      control.value = settings[key];
      updateRangeValue(control);
    } else {
      control.value = settings[key];
    }

    control.addEventListener(control.type === 'range' ? 'input' : 'change', () => {
      if (control.type === 'range') {
        updateRangeValue(control);
      }

      chrome.storage.sync.set({ [key]: getControlValue(control) });
      updateConditionalControls();
    });
  }

  updateConditionalControls();
}

function getControlValue(control) {
  if (control.type === 'checkbox') {
    return control.checked;
  }

  if (control.type === 'range') {
    return Number(control.value);
  }

  return control.value;
}

function updateRangeValue(control) {
  const output = document.querySelector(`[data-range-value="${control.id}"]`);
  if (output) {
    output.textContent = `${control.value}ms`;
  }
}

function updateConditionalControls() {
  const sideLayout = controls.revealSideLayout?.value || DEFAULT_SETTINGS.revealSideLayout;
  const sameSide = sideLayout === 'same';
  const sameSideSettings = document.querySelectorAll('[data-same-side-only]');
  const sidePositionTitle = document.querySelector('[data-side-position-title]');
  const sidePositionHelp = document.querySelector('[data-side-position-help]');

  for (const element of sameSideSettings) {
    element.hidden = !sameSide;
  }

  if (sidePositionTitle) {
    sidePositionTitle.textContent = sameSide ? 'Shared side' : 'Details side';
  }

  if (sidePositionHelp) {
    sidePositionHelp.textContent = sameSide ? 'Both panels use this side' : 'Playlist uses the opposite side';
  }
}
