// SPDX-License-Identifier: MPL-2.0
/**
 * input-readonly - how a locked sidebar control is drawn.
 *
 * Two kinds of lock reach the sidebar through lib/input-policy.ts, and they want
 * opposite things from the markup:
 *
 *  - A governed lock (a workspace policy) keeps the old treatment: the control is
 *    wrapped in `inert` and dimmed. Nothing in it can be reached, which is the point
 *    of a value someone else decided. The markup is byte-identical to what the
 *    sidebar drew before this module existed.
 *  - The document layer (`setDocumentReadOnly`, a viewer of a team project) locks
 *    every input of the document, and `inert` would take every VALUE out of the
 *    accessibility tree too: a screen reader would hear a sidebar of nothing. So the
 *    control stays in the tree and readable instead (plan 75 J5 step 5, G19):
 *    text-like fields get `readonly` and `aria-readonly="true"` and keep focus, so a
 *    value can be read and copied; native choice controls (select, checkbox, radio,
 *    range, colour, file, button) are `disabled`, which keeps their value and state
 *    in the tree; anything else that took focus leaves the tab order and says it is
 *    unavailable.
 *
 * Cooperative only, like the governed lock: the server's READ_ONLY refusal is the
 * boundary, and Save offers a copy instead (org/team-scope.ts).
 *
 * Every attribute this adds is recorded on the element, so {@link releaseReadableLocks}
 * can hand the controls back in place when the person makes their own copy and the
 * document stops being read-only before the sidebar next draws.
 */
import type { InputPolicy } from './input-policy.ts';
import './input-readonly.css';

/** Input types a person types into: these stay focusable and become `readonly`. */
const TEXT_TYPES = new Set([
  '', 'text', 'search', 'url', 'email', 'tel', 'number', 'password',
  'date', 'time', 'datetime-local', 'month', 'week',
]);
/** Native controls whose value or state `disabled` keeps readable. */
const DISABLE = new Set(['SELECT', 'BUTTON']);
/** The record of what was added, so a release restores exactly that. */
const MARK = 'data-readonly-added';

/** The markup for a locked control. `control` is the control's own HTML. */
export function lockedControlHtml(control: string, policy: InputPolicy | undefined): string {
  if (!policy?.readable) return `<span class="input-locked" inert aria-disabled="true">${control}</span>`;
  return `<span class="input-locked input-locked--readable">${readableControlHtml(control)}</span>`;
}

/** Set one attribute and remember that it was added (or what it held before). */
function add(el: Element, name: string, value: string, added: string[]): void {
  const before = el.getAttribute(name);
  if (before === value) return;
  added.push(before === null ? name : `${name}=${before}`);
  el.setAttribute(name, value);
}

/** One element of a control, made read-only and readable. */
function readOnly(el: Element): void {
  const added: string[] = [];
  const tag = el.tagName.toUpperCase();
  const type = tag === 'INPUT' ? (el.getAttribute('type') ?? '').toLowerCase() : '';
  if (tag === 'INPUT' && type === 'hidden') return;
  if (tag === 'TEXTAREA' || (tag === 'INPUT' && TEXT_TYPES.has(type)) || tag.startsWith('JELLY-INPUT') || tag.startsWith('JELLY-TEXTAREA')) {
    add(el, 'readonly', '', added);
    add(el, 'aria-readonly', 'true', added);
  } else if (tag === 'INPUT' || DISABLE.has(tag) || tag === 'JELLY-BUTTON') {
    add(el, 'disabled', '', added);
  } else if (el.getAttribute('contenteditable') !== null && el.getAttribute('contenteditable') !== 'false') {
    add(el, 'contenteditable', 'false', added);
    add(el, 'aria-readonly', 'true', added);
  } else if (el.getAttribute('tabindex') !== null) {
    add(el, 'tabindex', '-1', added);
    add(el, 'aria-disabled', 'true', added);
  }
  if (added.length) el.setAttribute(MARK, added.join(' '));
}

const CONTROLS = 'input, textarea, select, button, jelly-input, jelly-textarea, jelly-button, [contenteditable], [tabindex]';

/**
 * A control's HTML with every part of it read-only and readable. Outside a document
 * (a test with no DOM) the markup is returned unchanged: there is nothing to draw.
 */
export function readableControlHtml(control: string): string {
  if (typeof document === 'undefined') return control;
  const tpl = document.createElement('template');
  tpl.innerHTML = control;
  for (const el of tpl.content.querySelectorAll(CONTROLS)) readOnly(el);
  return tpl.innerHTML;
}

/**
 * Hand every readable lock under `root` back: restore what {@link readableControlHtml}
 * added and drop the lock's wrapper class, so the controls work again without waiting
 * for the sidebar to draw. Used when the document stops being read-only in place (the
 * person made a copy they can edit). Governed locks are left alone.
 */
export function releaseReadableLocks(root: ParentNode): void {
  for (const el of root.querySelectorAll(`[${MARK}]`)) {
    for (const entry of (el.getAttribute(MARK) ?? '').split(' ').filter(Boolean)) {
      const at = entry.indexOf('=');
      if (at < 0) el.removeAttribute(entry);
      else el.setAttribute(entry.slice(0, at), entry.slice(at + 1));
    }
    el.removeAttribute(MARK);
  }
  for (const wrap of root.querySelectorAll('.input-locked--readable')) {
    wrap.classList.remove('input-locked', 'input-locked--readable');
  }
}
