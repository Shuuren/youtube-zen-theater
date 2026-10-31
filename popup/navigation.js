const summaries = Array.from(document.querySelectorAll('.fold > summary'));

/** @param {Element | undefined} summary */
function focusSummary(summary) {
  if (summary instanceof HTMLElement) {
    summary.focus();
  }
}

for (const summary of summaries) {
  summary.addEventListener('keydown', (event) => {
    if (!(event instanceof KeyboardEvent)) {
      return;
    }

    const index = summaries.indexOf(summary);
    let next = index;

    if (event.key === 'ArrowDown') {
      next = (index + 1) % summaries.length;
    } else if (event.key === 'ArrowUp') {
      next = (index + summaries.length - 1) % summaries.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = summaries.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    focusSummary(summaries[next]);
  });
}
