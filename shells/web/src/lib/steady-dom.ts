// SPDX-License-Identifier: MPL-2.0
/**
 * DOM writes for code that runs on every frame of a pan or zoom: the canvas chrome, the
 * zoom readout, the rulers. Each one leaves the DOM alone when nothing changed.
 *
 * Why this matters more than it looks: the shell's stylesheets carry `:has()` rules on
 * `<html>`, `<body>` and the stage (`html:has(.tool-view.is-chrome-hidden) .edge-dock`
 * and others), and several of their arguments test `[hidden]`. Chromium cannot tell which
 * `:has()` rule a change concerns, so a write to `hidden` anywhere below those elements
 * (even one that sets the value the attribute already has) and any change to an
 * element's children (`textContent =` replaces the text node) make it check them all,
 * walking the whole page for the descendants Chromium's one shared `:has()`
 * invalidation set matches. While two rules made that set "every descendant" (see
 * has-invalidation.browser.test.ts), each check restyled the whole page: on a
 * 2,000-object Design document, 7,000 elements twice a frame for the whole of a pan
 * (plans/327, measured with a Chrome trace). The walk is still there on every check.
 *
 * Writing a text node's `data` is not a tree change, so a readout whose number moves
 * every frame (the zoom percentage during a pinch) stays cheap as well.
 */

/** Set `el.hidden`, and only when it differs. */
export function setHidden(el: HTMLElement, hidden: boolean): void {
  if (el.hidden !== hidden) el.hidden = hidden;
}

/**
 * Show `text` in `el`. Nothing happens when it already reads `text`; when the element
 * holds one text node, that node's data changes and the node stays.
 */
export function setText(el: Element, text: string): void {
  const node = el.firstChild;
  if (node && !node.nextSibling && node.nodeType === 3 /* Node.TEXT_NODE */) {
    const t = node as Text;
    if (t.data !== text) t.data = text;
    return;
  }
  if (el.textContent !== text) el.textContent = text;
}
