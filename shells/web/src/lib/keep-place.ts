// SPDX-License-Identifier: MPL-2.0
/**
 * Keep a person's place across a DOM move.
 *
 * Moving a live element to a new parent (the edge dock taking a panel, Design's
 * layers list joining the control pane on a fold) keeps its nodes, listeners and
 * state, but the browser drops two things on the way: the focus, and the scroll
 * offsets of everything inside the moved subtree. A half-typed field loses its
 * caret, and a long inspector jumps back to its top.
 *
 * `keepPlace(roots, move)` records both before `move` runs and puts them back
 * after: the focused element (if it is inside one of the roots) with its text
 * selection, and every scrolled element in the roots. Nothing is re-created, so
 * this is only ever a restore of the same nodes.
 */

interface ScrollMark { el: Element; top: number; left: number }

/** A text control whose caret can be read and set. */
function selectable(el: Element | null): el is HTMLInputElement | HTMLTextAreaElement {
  // Read by tag name rather than instanceof, so a test realm without the DOM
  // constructors on its globals reads the same.
  if (!el) return false;
  if (el.tagName === 'TEXTAREA') return true;
  if (el.tagName !== 'INPUT') return false;
  // Only these input types have a readable selection; the others throw on access.
  return /^(?:text|search|url|tel|password|email|)$/.test((el as HTMLInputElement).type);
}

/** Every element under `root` (and `root` itself) that is scrolled away from the origin. */
function scrolled(root: Element, out: ScrollMark[]): void {
  if (root.scrollTop || root.scrollLeft) out.push({ el: root, top: root.scrollTop, left: root.scrollLeft });
  for (const el of root.querySelectorAll('*')) {
    if (el.scrollTop || el.scrollLeft) out.push({ el, top: el.scrollTop, left: el.scrollLeft });
  }
}

/**
 * Run `move`, then restore the focus, the caret and the scroll offsets it would
 * otherwise lose inside `roots`. Returns whatever `move` returns.
 */
export function keepPlace<T>(roots: Iterable<Element | null | undefined>, move: () => T): T {
  const list = [...roots].filter((r): r is Element => !!r);
  if (!list.length || typeof document === 'undefined') return move();
  const active = document.activeElement;
  const focusInside = active && active !== document.body && list.some((r) => r === active || r.contains(active)) ? active as HTMLElement : null;
  let selection: { start: number | null; end: number | null; dir: 'forward' | 'backward' | 'none' | null } | null = null;
  if (selectable(focusInside)) {
    try { selection = { start: focusInside.selectionStart, end: focusInside.selectionEnd, dir: focusInside.selectionDirection }; } catch { selection = null; }
  }
  const marks: ScrollMark[] = [];
  for (const root of list) scrolled(root, marks);
  const result = move();
  for (const m of marks) {
    if (!m.el.isConnected) continue;
    m.el.scrollTop = m.top;
    m.el.scrollLeft = m.left;
  }
  if (focusInside?.isConnected && document.activeElement !== focusInside) {
    focusInside.focus({ preventScroll: true });
    if (selection && selectable(focusInside) && selection.start !== null && selection.end !== null) {
      try { focusInside.setSelectionRange(selection.start, selection.end, selection.dir ?? undefined); } catch { /* a type with no selection */ }
    }
  }
  return result;
}
