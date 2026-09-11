// SPDX-License-Identifier: MPL-2.0
/**
 * Studio split pane - the Colour tab's draggable divider between the main
 * column and the sticky palette side pane (≥1100px; below that the divider is
 * display:none, so it can't be dragged or focused, and the side content just
 * follows in flow). Cloned from the tool view's sidebar drag (views/tool.ts):
 * pointer capture, a CSS width var, snap-collapse, localStorage persist - plus
 * keyboard support, since this handle is a focusable `role="separator"`.
 *
 * `el` is the split grid itself (`.be-tab--split`); this writes `--be-side-w`
 * onto it and toggles `.is-collapsed`. It must never set z-index/transform/
 * contain on the side pane - the swatch popover (.be-editor) positions against
 * `.be` and has to keep beating the sticky action row (the fixed-popover
 * containing-block trap).
 */

const STORE_KEY = 'brandStudioPaneW';
// MUST equal the CSS track floor - brand-studio.css's `minmax(280px, …)`. A
// smaller clamp here would let keyboard End / a drag park the logical width in
// a 220–279px dead zone the rendered track can't follow (aria-valuenow and the
// persisted width would disagree with what's on screen).
const SIDE_MIN = 280;
const SNAP_COLLAPSE = 220; // dragging under this snaps the pane closed
const SIDE_DEFAULT = 400;  // keyboard fallback when the pane can't be measured
const KEY_STEP = 24;

export function mountStudioSplit(el: HTMLElement): () => void {
  const divider = el.querySelector<HTMLElement>('[data-be-split-divider]');
  if (!divider) return () => {};

  const maxW = (): number => Math.round(el.getBoundingClientRect().width * 0.6);
  const clamp = (w: number): number => Math.max(SIDE_MIN, Math.min(w, maxW()));

  // Default = EXPANDED at the CSS track's own 50% (no inline var at all - 
  // brand-studio.css's `var(--be-side-w, 50%)` fallback carries it). Width goes
  // pixel-explicit only once the user drags/keys a size, and stays persisted
  // from then on. `0` persisted = collapsed - but ONLY an explicit stored '0'
  // (a user's own snap/Enter) reads as that sentinel: a missing key maps to
  // NaN (Number(null) is 0, which used to boot fresh profiles collapsed), and
  // any unusable value falls back to the open 50% default.
  const raw = localStorage.getItem(STORE_KEY);
  const saved = raw == null ? NaN : Number(raw);
  let width: number | null = Number.isFinite(saved) && saved >= SIDE_MIN ? saved : null;
  let collapsed = raw != null && saved === 0;

  /** The pane's effective width - the explicit px when set, else the live
   *  rendered width of the 50% default track (for keyboard steps to build on). */
  const currentWidth = (): number => {
    if (width != null) return width;
    const side = el.querySelector<HTMLElement>('.be-split-side');
    const w = side ? Math.round(side.getBoundingClientRect().width) : 0;
    return w >= SIDE_MIN ? w : SIDE_DEFAULT;
  };

  const apply = (save = true): void => {
    el.classList.toggle('is-collapsed', collapsed);
    if (width == null) el.style.removeProperty('--be-side-w'); // CSS 50% default
    else el.style.setProperty('--be-side-w', `${width}px`);
    divider.setAttribute('aria-valuemin', String(SIDE_MIN));
    divider.setAttribute('aria-valuemax', String(maxW()));
    divider.setAttribute('aria-valuenow', String(collapsed ? 0 : (width ?? currentWidth())));
    if (save) {
      if (collapsed) localStorage.setItem(STORE_KEY, '0');
      else if (width != null) localStorage.setItem(STORE_KEY, String(width));
      else localStorage.removeItem(STORE_KEY); // back to the percentage default
    }
  };
  apply(false);

  // ── Drag (pointer capture, live width, snap-collapse; persist on release) ──
  let dragging = false;
  const onDown = (e: PointerEvent): void => {
    dragging = true;
    divider.classList.add('is-dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    divider.setPointerCapture(e.pointerId);
    e.preventDefault();
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const rect = el.getBoundingClientRect();
    const raw = rect.right - e.clientX; // pointer → the side pane's would-be width
    if (raw < SNAP_COLLAPSE) collapsed = true;
    else { collapsed = false; width = Math.max(SIDE_MIN, Math.min(raw, rect.width * 0.6)); }
    apply(false);
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = false;
    divider.classList.remove('is-dragging');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
    apply(); // commit + persist
  };

  // ── Keyboard (Left grows the pane - the separator moves left) ─────────────
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowLeft') { collapsed = false; width = clamp(currentWidth() + KEY_STEP); }
    else if (e.key === 'ArrowRight') { if (!collapsed) width = clamp(currentWidth() - KEY_STEP); }
    else if (e.key === 'Home') { collapsed = false; width = maxW(); }
    else if (e.key === 'End') { collapsed = false; width = SIDE_MIN; }
    else if (e.key === 'Enter') collapsed = !collapsed;
    else return;
    e.preventDefault();
    apply();
  };

  divider.addEventListener('pointerdown', onDown);
  divider.addEventListener('pointermove', onMove);
  divider.addEventListener('pointerup', onUp);
  divider.addEventListener('pointercancel', onUp);
  divider.addEventListener('keydown', onKey);

  return () => {
    divider.removeEventListener('pointerdown', onDown);
    divider.removeEventListener('pointermove', onMove);
    divider.removeEventListener('pointerup', onUp);
    divider.removeEventListener('pointercancel', onUp);
    divider.removeEventListener('keydown', onKey);
    if (dragging) { document.body.style.cursor = ''; document.body.style.userSelect = ''; }
  };
}
