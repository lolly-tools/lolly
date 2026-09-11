// SPDX-License-Identifier: MPL-2.0
/**
 * Keyboard focus containment for a modal overlay that is a `<div role="dialog">`
 * (NOT a native `<dialog>`, which the browser traps for free). Two guards, matching
 * the belt-and-braces pattern the Export popup already ships (views/tool.ts):
 *
 *   1. INERT the background - walking up from the overlay, every sibling at each
 *      ancestor level is marked `inert`, so pointer events and the accessibility
 *      tree skip everything behind the modal, wherever the overlay is mounted
 *      (document.body or a view container). Pass `inertBackground: false` to skip
 *      this guard - required for any overlay whose OWN trigger lives inside the
 *      branch that would get inerted (a body-mounted anchored dropdown, e.g. the
 *      profile/lang menus): `inert` cascades to descendants with no way for a
 *      child to opt back out, so inerting the app root would inert the trigger
 *      button too, killing its re-click-to-close affordance and, since the whole
 *      viewport is then non-hit-testable, making the page look entirely unresponsive
 *      until Escape is pressed. Reserve `inertBackground: true` (the default) for
 *      TRUE modals - the trigger that opened them is not meant to stay reachable.
 *   2. WRAP Tab/Shift+Tab within the overlay's focusables - inert alone can still
 *      let Tab graze the browser chrome between the last and first stop. Runs
 *      regardless of `inertBackground`.
 *
 * Callers keep their own Escape/close + focus-restore (most dialogs already have it);
 * pass `onEscape` only if the dialog has none. `release()` restores inert + listeners.
 */

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/**
 * Set by a11y.ts on its shared screen-reader live regions. They mount as <body>
 * children, so for a body-mounted overlay they're siblings and the inert walk below
 * would hit them - and `inert` drops a subtree from the accessibility tree, so every
 * announce() raised while the modal was open would be silently lost. They're
 * visually-hidden and hold no focusables, so leaving them live can't leak a Tab stop
 * or a hit-testable target into the inerted background.
 */
const LIVE_REGION_ATTR = 'data-a11y-live';

export interface FocusTrap { release(): void; }

export interface FocusTrapOptions {
  /** Element (or a getter) to focus on open. Omit to leave focus where it is. */
  initialFocus?: HTMLElement | null | (() => HTMLElement | null);
  /** Only pass this if the overlay does NOT already handle Escape itself. */
  onEscape?: () => void;
  /** False for a lightweight anchored dropdown whose trigger lives in the branch
   *  that would otherwise get inerted (see the module doc). Default true. */
  inertBackground?: boolean;
}

export function trapFocus(overlay: HTMLElement, opts: FocusTrapOptions = {}): FocusTrap {
  const visible = (el: HTMLElement): boolean => el.offsetParent !== null || el === document.activeElement;
  const focusables = (): HTMLElement[] =>
    // Exclude roving tabindex=-1 stops (e.g. a menuitemradio group where only the checked
    // one is tab-reachable): they're reachable via JS/arrow-keys but NOT via Tab, so they
    // must not define the wrap boundary. (The element selectors above still match them via
    // `button`/`input`; el.tabIndex reflects the effective, roving value.)
    [...overlay.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => visible(el) && el.tabIndex !== -1);

  // 1. Inert everything outside the overlay's branch (siblings up the ancestor chain).
  //    Skip already-inert nodes so a nested trap doesn't clobber an outer one on release,
  //    and the shared live regions so announcements still land (see LIVE_REGION_ATTR).
  const inerted: HTMLElement[] = [];
  let node: HTMLElement | null = overlay;
  while (opts.inertBackground !== false && node && node.parentElement && node !== document.body) {
    for (const sib of node.parentElement.children) {
      const el = sib as HTMLElement;
      if (el === node || el.inert || el.hasAttribute(LIVE_REGION_ATTR)) continue;
      el.inert = true;
      inerted.push(el);
    }
    node = node.parentElement;
  }

  // 2. Tab wrap (+ optional Escape).
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && opts.onEscape) { e.preventDefault(); opts.onEscape(); return; }
    if (e.key !== 'Tab') return;
    const active = document.activeElement as HTMLElement | null;
    // Only wrap when focus is inside THIS overlay - so a nested modal (e.g. the
    // webcam over the picker) is handled solely by its own trap, and this outer
    // trap stays quiet. The inert background already stops Tab escaping the modal.
    if (!active || !overlay.contains(active)) return;
    const f = focusables();
    if (!f.length) { e.preventDefault(); return; }
    const first = f[0]!, last = f[f.length - 1]!;
    if (e.shiftKey && active === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown', onKey);

  const target = typeof opts.initialFocus === 'function' ? opts.initialFocus() : opts.initialFocus;
  target?.focus();

  let released = false;
  return {
    release(): void {
      if (released) return;
      released = true;
      document.removeEventListener('keydown', onKey);
      for (const el of inerted) el.inert = false;
    },
  };
}
