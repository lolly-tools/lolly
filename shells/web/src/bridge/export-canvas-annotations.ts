// SPDX-License-Identifier: MPL-2.0
/** Remove editor affordances from an export copy, preserving the live canvas. */
export function stripCanvasAnnotations(root: Element): void {
  for (const el of [root, ...root.querySelectorAll('[data-canvas-settings]')]) {
    if (!el.hasAttribute('data-canvas-settings')) continue;
    el.removeAttribute('tabindex');
    if (el.getAttribute('role') === 'button') el.removeAttribute('role');
  }
  for (const attr of ['data-canvas-input', 'data-canvas-settings', 'data-canvas-name', 'data-lolly-paint', 'data-lolly-bind']) {
    root.removeAttribute(attr);
    root.querySelectorAll(`[${attr}]`).forEach(el => { el.removeAttribute(attr); });
  }
}
