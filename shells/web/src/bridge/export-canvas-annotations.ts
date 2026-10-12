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

/** Hide editor chrome during capture, keeping model camera markers attached. */
export function detachExportHidden(node: Element): () => void {
  if (!node?.querySelectorAll) return () => {};
  const marked = [...node.querySelectorAll('[data-export-hide]:not([data-cam])')]
    // Detach only outermost markers so their parent references remain valid.
    .filter(el => !el.parentElement?.closest('[data-export-hide]:not([data-cam])'));
  const slots = marked.map(el => ({ el, parent: el.parentNode, next: el.nextSibling }));
  for (const { el } of slots) el.remove();
  // Restore in reverse order because a saved next sibling may also be detached.
  return () => {
    for (let i = slots.length - 1; i >= 0; i--) {
      const { el, parent, next } = slots[i]!;
      if (!parent) continue;
      const ref = next && next.parentNode === parent ? next : null;
      parent.insertBefore(el, ref);
    }
  };
}
