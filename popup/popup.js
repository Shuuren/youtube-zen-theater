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

const controls = Object.fromEntries(
  Object.keys(DEFAULT_SETTINGS).map((key) => [key, document.getElementById(key)])
);

init();

async function init() {
  const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

  for (const [key, control] of Object.entries(controls)) {
    if (control.type === 'checkbox') {
      control.checked = settings[key] === true;
    } else {
      control.value = settings[key];
    }

    control.addEventListener('change', () => {
      chrome.storage.sync.set({ [key]: control.type === 'checkbox' ? control.checked : control.value });
    });
  }
}
