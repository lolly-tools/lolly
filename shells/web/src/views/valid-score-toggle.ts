// SPDX-License-Identifier: MPL-2.0

/** Append the expandable scorecard control without opening a raw-HTML sink. */
export function appendScoreToggle(
  wrap: HTMLElement,
  count: number,
  label: string
): HTMLButtonElement {
  const button = wrap.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'valid-score-more';
  button.dataset.scoreToggle = '';
  button.dataset.scoreCount = String(count);
  button.setAttribute('aria-expanded', 'false');
  button.textContent = label;
  wrap.appendChild(button);
  return button;
}
