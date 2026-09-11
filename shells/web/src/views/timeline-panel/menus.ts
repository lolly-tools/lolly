// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: context menus, onion skin and stagger popovers, the ease editor.
 *
 * Every function takes the shared `tp: TpCtx` first (see context.ts). Sibling
 * calls in this file are direct; anything in another module, and any function used as
 * a value (an event listener), goes through `tp.<module>.<fn>`. Extracted verbatim
 * from initTimelinePanel() by scripts/split-closure.ts.
 */
import { t } from '../../i18n.ts';
import { icon } from '../../lib/icons.ts';
import type { IconName } from '../../lib/icons.ts';
import { announce } from '../../a11y.ts';
import { edgeDockWidth } from '../../lib/edge-dock.ts';
import type { PopoverAnchor } from '../../components/body-popover.ts';
import { boxTiming, indexOfId, isTimed } from '../timeline-math.ts';
import type { Box } from '../timeline-math.ts';
import { finite } from '../timeline-config.ts';
import { ONION_DEFAULT, writeOnionPref } from './shared.ts';
import type { OnionPref, TimelineAddDetail } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

export function menuPosition(_tp: TpCtx, el: HTMLDivElement, anchor: PopoverAnchor): void {
  const r = anchor.getBoundingClientRect();
  const pw = el.offsetWidth;
  const ph = el.offsetHeight;
  const vw = window.innerWidth || 1024;
  const vh = window.innerHeight || 768;
  // Align to the anchor's NEAR edge - left under ltr, right under rtl (body-popover's
  // own default is right-aligned for the same reason). Aligning to `left` in Arabic
  // opens the menu away from the button that spawned it.
  const rtl = document.documentElement.dir === 'rtl';
  const near = rtl ? r.right - pw : r.left;
  // Clamp to the CONTENT area, not the viewport: a docked column reserves inline-end
  // space (right in ltr, left in rtl), so keep the popover clear of it.
  const dockW = edgeDockWidth();
  const left = Math.max(8 + (rtl ? dockW : 0), Math.min(near, vw - pw - 12 - (rtl ? 0 : dockW)));
  const top = r.bottom + 6 + ph > vh - 8 ? Math.max(8, r.top - ph - 6) : r.bottom + 6;
  el.style.left = `${Math.round(left)}px`;
  el.style.top = `${Math.round(top)}px`;
}
/**
 * One menu row. Same markup + classes as the projects/folder menus, so no new CSS -
 * except `sub`, a second line in the plainer register for an action whose NAME cannot
 * carry its meaning ("Detach audio" says what, not what for). The two lines live in
 * one column so the icon still centres against the pair.
 */
export function menuItem(_tp: TpCtx, 
  label: string,
  glyph: IconName,
  run: () => void,
  opts?: { danger?: boolean; sub?: string }
): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = `folder-menu-item${opts?.danger ? ' folder-menu-item--danger' : ''}${opts?.sub ? ' tl-menu-item--sub' : ''}`;
  b.setAttribute('role', 'menuitem');
  b.innerHTML = icon(glyph);
  const span = document.createElement('span');
  span.className = 'tl-menu-label';
  span.textContent = label; // textContent, so a manifest label can never inject markup
  b.appendChild(span);
  if (opts?.sub) {
    const wrap = document.createElement('span');
    wrap.className = 'tl-menu-stack';
    const sub = document.createElement('span');
    sub.className = 'tl-menu-sub';
    sub.textContent = opts.sub;
    b.replaceChild(wrap, span);
    wrap.append(span, sub);
  }
  b.addEventListener('click', run);
  return b;
}
/**
 * The cross-module seam (see the panel's contract with free-canvas): the panel never
 * creates a box itself - it names an add-kind and the time it wants, and free-canvas's
 * create pipeline does the rest. `atMs` is the PLAYHEAD, because a box added from the
 * timeline must land timed where the user is looking, which is the opposite default
 * from the canvas `+` (that one makes scenery).
 */
export function emitAdd(tp: TpCtx, kind: string): void {
  const { clock, root } = tp;
  const detail: TimelineAddDetail = { kind, atMs: clock.t() };
  root.dispatchEvent(new CustomEvent('tl-add', { bubbles: true, detail }));
}
// ── onion skin (opt-in, OFF by default) ──────────────────────────────────────
//
// The panel owns the PREFERENCE and the emission; views/onion-skin.ts owns the
// drawing and is lazily imported by free-canvas off the `tl-time` detail. Nothing
// here touches the model, so nothing here is undoable - a view preference is not an
// edit, and putting it on the undo stack would make Cmd-Z stop meaning "unmake that
// change to my work".

export function syncOnionBtn(tp: TpCtx): void {
  const { onionBtn } = tp;
  const on = !!tp.onionPref;
  onionBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  onionBtn.classList.toggle('is-active', on);
}
/**
 * The ONE writer for the preference: persist, reflect on the button, and push a fresh
 * `tl-time` so the canvas repaints without waiting for the clock to move (a paused
 * timeline emits no ticks at all, which is exactly when someone is fiddling with these).
 */
export function setOnion(tp: TpCtx, next: OnionPref | null, opts?: { speak?: boolean }): void {
  const { clock } = tp;
  tp.onionPref = next;
  writeOnionPref(next);
  syncOnionBtn(tp);
  if (opts?.speak) announce(next ? t('Onion skin on') : t('Onion skin off'));
  tp.panel.emitTime(clock.t());
}
export function toggleOnion(tp: TpCtx): void {
  setOnion(tp, tp.onionPref ? null : { ...ONION_DEFAULT }, { speak: true });
}
/** Change one option, turning the feature ON if it was off (the popover implies intent). */
export function patchOnion(tp: TpCtx, patch: Partial<OnionPref>): void {
  setOnion(tp, { ...(tp.onionPref ?? ONION_DEFAULT), ...patch });
}
export const cancelOnionHold = (tp: TpCtx): void => {
  if (tp.onionHold) {
    clearTimeout(tp.onionHold);
    tp.onionHold = 0;
  }
};
// ── stagger starts (plans/175 WP-C - Jitter's right-click Stagger) ──────────
//
// One small anchored card: a gap in ms, Enter or the button applies it. The maths is
// timeline-math's staggerOverlays - this card is a door, never an implementation.

/** The selection members a Stagger can act on: timed OVERLAY boxes (a seq clip's
 *  start is pack-derived, so the magnetic row is never dealt). */
export function staggerableIds(tp: TpCtx, rows: Box[], ids: readonly string[]): string[] {
  const { cfg } = tp;
  return ids.filter((id) => {
    const i = indexOfId(rows, cfg, id);
    return i >= 0 && isTimed(rows[i]!, cfg) && boxTiming(rows[i]!, cfg).lane !== 'seq';
  });
}
export function openStaggerPop(tp: TpCtx, ids: string[]): void {
  const { ctxPoint, staggerPoint, staggerPop } = tp;
  tp.staggerIds = ids;
  staggerPoint.x = ctxPoint.x;
  staggerPoint.y = ctxPoint.y;
  staggerPoint.delegate = ctxPoint.delegate;
  staggerPop.close();
  staggerPop.open();
}
/**
 * Open the context menu on one box. Right-click SELECTS first (free-canvas's
 * contextMenuAt does the same), so whatever the menu acts on is also what the
 * inspector and the canvas chrome are showing.
 *
 * The selection COLLAPSES to the clicked box when it was already part of a
 * multi-selection the menu cannot act on as one: the per-box items act on `ctxId`
 * alone, so leaving three bars painted as selected while "Make always on" demotes
 * one of them shows the user a state that never existed - and the next act is an
 * undo of something they did not think they did. Free-canvas's sibling menu
 * resolves the same tension the other way (it disables per-box items on a
 * multi-selection); here collapsing is better, because the box under the pointer
 * is unambiguous. The ONE exception (plans/175 WP-C): a selection of two or more
 * staggerable overlays is kept, and the menu offers only the selection-wide
 * actions - the painted bars and the acted-on set stay the same set.
 */
export function openCtxMenu(tp: TpCtx, id: string, x: number, y: number, delegate: HTMLElement | null): void {
  const { bars, cfg, ctxMenu, ctxPoint, getBoxes, selection } = tp;
  if (!id || indexOfId(getBoxes(), cfg, id) < 0) return;
  tp.ctxId = id;
  const sel = selection.get();
  // ONE exception to the collapse (plans/175 WP-C): a multi-selection that
  // contains the clicked box AND can act as one (two or more staggerable
  // overlays) is kept, and the menu offers the selection-wide actions instead
  // of the per-box ones. Everything else collapses, for the reason above.
  const multi = sel.length >= 2 && sel.includes(id) ? staggerableIds(tp, getBoxes(), sel) : [];
  tp.ctxMulti = multi.length >= 2 ? multi : null;
  if (!tp.ctxMulti && (sel.length !== 1 || sel[0] !== id)) tp.rows.selectAndReveal([id]);
  if (bars.has(id)) {
    tp.focusedId = id;
    tp.rows.updateRovingTabindex();
  }
  ctxPoint.x = x;
  ctxPoint.y = y;
  ctxPoint.delegate = delegate;
  ctxMenu.close();
  ctxMenu.open();
}
export function onContextMenu(tp: TpCtx, e: MouseEvent): void {
  const { cfg, kfCtxMenu, kfCtxPoint, selection } = tp;
  const target = e.target as HTMLElement | null;
  // The diamond first: it lives inside a bar, so the bar's menu would always win.
  const dot = target?.closest<HTMLElement>('.tl-kf-dot');
  const dotBar = dot?.closest<HTMLElement>('.tl-clip');
  if (dot && dotBar?.dataset.id && cfg.kfField) {
    const at = finite(dot.dataset.t, NaN);
    if (Number.isFinite(at)) {
      e.preventDefault();
      e.stopPropagation();
      tp.kfCtxId = dotBar.dataset.id;
      tp.kfCtxT = at;
      if (!selection.get().includes(tp.kfCtxId)) tp.rows.selectAndReveal([tp.kfCtxId]);
      kfCtxPoint.x = e.clientX;
      kfCtxPoint.y = e.clientY;
      kfCtxPoint.delegate = null;
      kfCtxMenu.close();
      kfCtxMenu.open();
      return;
    }
  }
  const el = target?.closest<HTMLElement>('.tl-clip, .tl-chip, .tl-chip-add');
  const id = el?.dataset.id || '';
  if (!id) return;
  e.preventDefault();
  e.stopPropagation();
  openCtxMenu(tp, id, e.clientX, e.clientY, null);
}
/** The keyboard route (Menu key / Shift+F10) - a pointer-only menu is not reachable. */
export function openCtxForFocused(tp: TpCtx): void {
  const { bars, root } = tp;
  const active = document.activeElement as HTMLElement | null;
  const el =
    (root.contains(active) ? active?.closest<HTMLElement>('.tl-clip, .tl-chip') : null) ||
    bars.get(tp.focusedId) ||
    null;
  const id = el?.dataset.id || '';
  if (!el || !id) return;
  const r = el.getBoundingClientRect();
  openCtxMenu(tp, id, r.left, r.bottom, el);
}
/** Open the curve editor for one box + one ease field, anchored under its trigger. */
export function openEaseEditor(tp: TpCtx, id: string, field: string, trigger: HTMLElement): void {
  const { cfg, easeMenu, easePoint, getBoxes } = tp;
  if (!id || !field || indexOfId(getBoxes(), cfg, id) < 0) return;
  tp.easeId = id;
  tp.easeField = field;
  const r = trigger.getBoundingClientRect();
  easePoint.x = r.left;
  easePoint.y = r.bottom;
  easePoint.delegate = trigger;
  easeMenu.close();
  easeMenu.open();
}
export function menusOps(tp: TpCtx) {
  return {
    menuPosition: bindOp(tp, menuPosition),
    menuItem: bindOp(tp, menuItem),
    emitAdd: bindOp(tp, emitAdd),
    syncOnionBtn: bindOp(tp, syncOnionBtn),
    setOnion: bindOp(tp, setOnion),
    toggleOnion: bindOp(tp, toggleOnion),
    patchOnion: bindOp(tp, patchOnion),
    cancelOnionHold: bindOp(tp, cancelOnionHold),
    staggerableIds: bindOp(tp, staggerableIds),
    openStaggerPop: bindOp(tp, openStaggerPop),
    openCtxMenu: bindOp(tp, openCtxMenu),
    onContextMenu: bindOp(tp, onContextMenu),
    openCtxForFocused: bindOp(tp, openCtxForFocused),
    openEaseEditor: bindOp(tp, openEaseEditor),
  };
}
