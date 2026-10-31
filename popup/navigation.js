const tabs = Array.from(document.querySelectorAll('[role="tab"]'));

/** @param {Element} selected */
function selectSettingsTab(selected) {
  for (const tab of tabs) {
    const active = tab === selected;
    tab.setAttribute('aria-selected', String(active));
    tab.setAttribute('tabindex', active ? '0' : '-1');
    const panel = document.getElementById(tab.getAttribute('aria-controls'));

    if (panel) {
      panel.hidden = !active;
    }
  }
}

for (const tab of tabs) {
  tab.addEventListener('click', () => selectSettingsTab(tab));
  tab.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    const index = tabs.indexOf(tab);
    let next = index;

    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;

    event.preventDefault();
    const nextTab = tabs[next];
    selectSettingsTab(nextTab);

    if (nextTab instanceof HTMLElement) {
      nextTab.focus();
    }
  });
}
