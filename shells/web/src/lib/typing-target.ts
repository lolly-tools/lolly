// SPDX-License-Identifier: MPL-2.0
/**
 * typing-target - "is the user typing right now?", answered through shadow roots.
 *
 * Every keyboard shortcut in the shell has to bail while focus sits in a field,
 * or the keystroke gets eaten. The classic test - `document.activeElement.tagName
 * === 'INPUT'` - silently stopped working once the sidebar's text fields became
 * <jelly-input> custom elements: the real <input> lives in the host's shadow root,
 * so `document.activeElement` reports the HOST (`JELLY-INPUT`), which is neither
 * an INPUT nor contentEditable. Result: single-key shortcuts fired mid-typing - 
 * the stage's `0` (fit) and `1` (100%) meant those two digits could never be
 * typed into a text field at all.
 *
 * `deepActiveElement()` walks the `shadowRoot.activeElement` chain to the real
 * focused node, and `isTypingTarget()` classifies it. Both are shadow-agnostic,
 * so they keep working for native controls and for any future custom element.
 */

/**
 * Follow `el`'s own shadow-root focus down to the innermost focused node.
 * Each hop descends one shadow root, and the chain is shallow. A closed shadow
 * root reports `shadowRoot === null`, so the walk stops at the host - the best
 * answer available, and the same one a plain tagName test used to give.
 */
export function deepestFocus(el: Element | null | undefined): Element | null {
  let node: Element | null = el ?? null;
  while (node) {
    const inner = (node as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot?.activeElement;
    if (!inner || inner === node) return node;
    node = inner;
  }
  return null;
}

/** The genuinely focused element, descending through open shadow roots. */
export function deepActiveElement(doc: Document = document): Element | null {
  return deepestFocus(doc.activeElement);
}

/**
 * True when `el` is a control the user types (or picks) into, so a single-key
 * shortcut must not fire. Defaults to the deep active element.
 *
 * SELECT is included: it eats type-to-select keystrokes of its own.
 */
export function isTypingTarget(el: Element | null | undefined = deepActiveElement()): boolean {
  // Descend first, so callers can hand us a shadow HOST (what document.activeElement
  // reports for a focused jelly field) and still get the right answer.
  const node = deepestFocus(el);
  if (!node) return false;
  if ((node as HTMLElement).isContentEditable) return true;
  return /^(INPUT|TEXTAREA|SELECT)$/.test(node.tagName || '');
}

// <input> types that carry a native caret and native per-character undo. A range
// slider / colour swatch / checkbox / number IS an <input> but has neither, so
// callers wanting the narrow test (e.g. "let ⌘Z fall through to the browser")
// use isTextEditingTarget rather than isTypingTarget.
const TEXTUAL_INPUT_TYPES = new Set(['text', 'search', 'url', 'tel', 'email', 'password', '']);

/** True only for a caret-bearing text field - a strict subset of isTypingTarget. */
export function isTextEditingTarget(el: Element | null | undefined = deepActiveElement()): boolean {
  const node = deepestFocus(el);
  if (!node) return false;
  if ((node as HTMLElement).isContentEditable || node.tagName === 'TEXTAREA') return true;
  if (node.tagName !== 'INPUT') return false;
  return TEXTUAL_INPUT_TYPES.has(((node as HTMLInputElement).type || 'text').toLowerCase());
}
