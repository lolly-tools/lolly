// SPDX-License-Identifier: MPL-2.0
/**
 * free-canvas: the artboard title tabs - which ones show, where, and the view preference.
 *
 * A title is the one canvas route to select or drag an artboard that a full-bleed box
 * covers, and the place to rename an artboard. Showing one for every artboard on every sync cost
 * a title per artboard per frame and piled them into a strip of text when zoomed out. By
 * default ("Selected and hovered") a title shows for:
 *
 *   - a selected artboard, and the artboard that holds the selection;
 *   - the artboard under the pointer (hover reveals the route to a covered artboard);
 *   - a title with keyboard focus, and one being renamed.
 *
 * "Always" shows every artboard on screen, and "Off" none, apart from a title with focus
 * or one being renamed. The choice is a device-local view preference, kept the way
 * "Rulers and guides" is (stage.ts). An artboard under TITLE_MIN_HOVER_PX on screen shows
 * no hover or "Always" title, and a kept title is drawn no narrower than
 * TITLE_MIN_KEPT_PX. Every title is capped to its artboard's width on screen.
 *
 * Titles are placed from the model, never measured: the artboard's rect, the live rect a
 * gesture is drawing while one runs (`fc.liveRects`), and the pose the timeline applier
 * published for its page (transitions move a page; `fc.seqPoseOf`). A peer's live drag
 * is drawn as its own overlay (tool-canvas-interactions.ts), not by moving the page, so
 * the model is where a local title belongs. Only the titles shown exist: each is keyed
 * by artboard id, kept across syncs and patched in place, so a hidden title is out of
 * the tab order.
 */
import { boxRect, num, posedRect } from '../free-canvas-math.ts';
import type { Box } from '../free-canvas-math.ts';
import { t } from '../../i18n.ts';
import type { Metrics, Rect } from './shared.ts';
import { bindOp, type FcCtx } from './context.ts';

export type TitleMode = 'always' | 'selected' | 'off';
/** The device-local preference key, beside `lolly-design-guides-visible`. */
export const TITLE_MODE_KEY = 'lolly-design-artboard-titles';
const TITLE_MODES: readonly TitleMode[] = ['selected', 'always', 'off'];
/** Below this width on screen an artboard shows no hover or "Always" title. */
export const TITLE_MIN_HOVER_PX = 64;
/** A title kept for the selection is never drawn narrower than this, so it can be grabbed. */
export const TITLE_MIN_KEPT_PX = 32;
/** How far above its artboard a title sits. */
const TITLE_LIFT_PX = 20;

type Frame = { b: Box; i: number };

export function readTitleMode(_fc: FcCtx): TitleMode {
  try {
    const v = localStorage.getItem(TITLE_MODE_KEY);
    return v === 'always' || v === 'off' ? v : 'selected';
  } catch {
    return 'selected';
  }
}
export function setTitleMode(fc: FcCtx, mode: TitleMode): void {
  fc.titleMode = mode;
  try { localStorage.setItem(TITLE_MODE_KEY, mode); } catch { /* best effort: the choice holds until the editor closes */ }
  fc.chromeSync.renderChrome();
}
/** The document menu's row cycles Selected and hovered, Always, Off. */
export function cycleTitleMode(fc: FcCtx): void {
  setTitleMode(fc, TITLE_MODES[(TITLE_MODES.indexOf(fc.titleMode) + 1) % TITLE_MODES.length]!);
}
export function titleModeLabel(_fc: FcCtx, mode: TitleMode): string {
  return mode === 'always' ? t('Always') : mode === 'off' ? t('Off') : t('Selected and hovered');
}

/** The artboards on the active page, in page order (the order field, then left to right). */
export function pageFrames(fc: FcCtx, boxes: Box[]): Frame[] {
  const { cfg, frameCfg } = fc;
  if (!frameCfg) return [];
  const fk = frameCfg.frameKind;
  const of = frameCfg.orderField ?? '';
  return boxes
    .map((b, i) => ({ b, i }))
    .filter(({ b }) => String(b?.[cfg.kindField]) === fk)
    .sort((a, c) => num(a.b?.[of]) - num(c.b?.[of]) || num(a.b?.[cfg.xField]) - num(c.b?.[cfg.xField]));
}

/** Selected artboards and the artboards that hold a selected row. */
function keptBySelection(fc: FcCtx, boxes: Box[]): Set<string> {
  const kept = new Set<string>();
  if (!fc.selection.size || !fc.frameCfg) return kept;
  const field = fc.frameCfg.frameField || 'frame';
  for (let i = 0; i < boxes.length; i++) {
    const id = fc.select.idOf(boxes[i], i);
    if (!fc.selection.has(id)) continue;
    if (String(boxes[i]?.[fc.cfg.kindField]) === fc.frameCfg.frameKind) kept.add(id);
    const holder = String(boxes[i]?.[field] ?? '');
    if (holder) kept.add(holder);
  }
  return kept;
}

/** Where an artboard is drawn, in stage px: the gesture's live rect, else the model's,
 *  through the pose its page is in. No layout read. */
export function frameStageRect(fc: FcCtx, b: Box, i: number, m: Metrics): Rect {
  const id = fc.select.idOf(b, i);
  const live = fc.gesture ? fc.liveRects?.get(id) : undefined;
  let r: Rect = live ?? boxRect(b, fc.cfg);
  if (!live && fc.seqPoseOf) {
    const page = fc.stage.liveBoxEl(id);
    if (page) r = posedRect({ ...r, rot: r.rot ?? 0 }, fc.seqPoseOf(page));
  }
  const tl = fc.stage.nativeToStage(r.x, r.y, m);
  return { x: tl.x, y: tl.y, w: r.w * m.scale, h: r.h * m.scale, rot: 0 };
}

function clearTitles(fc: FcCtx): void {
  const { frameLabels } = fc;
  fc.frameTitleEls.clear();
  if (frameLabels.childElementCount) frameLabels.replaceChildren();
}

/**
 * The title tabs. `boxes` is the active page's rows and `source` the whole array they
 * came from. A `view` sync (the view moved, or the pointer hovered another artboard)
 * reuses the frames and the kept set the last full sync worked out for that same array.
 */
export function syncTitles(fc: FcCtx, boxes: Box[], source: Box[] = boxes, view = false): void {
  const { frameCfg, frameLabels, nameField } = fc;
  if (!frameCfg) return;
  if (fc.editing || fc.penDraft || fc.penEdit) {
    clearTitles(fc);
    return;
  }
  const held = view && fc.frameLabelFrames?.source === source ? fc.frameLabelFrames.frames : null;
  const frames = held ?? pageFrames(fc, boxes);
  if (!held) {
    fc.frameLabelFrames = { source, frames };
    fc.titleKept = keptBySelection(fc, boxes);
  }
  const m = fc.stage.metrics();
  fc.titleMetrics = m;
  const mode = fc.titleMode;
  const stageW = m.sr.width, stageH = m.sr.height;
  const shown: Array<{ id: string; b: Box; n: number; r: Rect; kept: boolean }> = [];
  for (let n = 0; n < frames.length; n++) {
    const { b, i } = frames[n]!;
    const id = fc.select.idOf(b, i);
    const kept = (mode !== 'off' && fc.titleKept.has(id)) || id === fc.titleFocusId || id === fc.renamingFrameId;
    const hovered = mode === 'selected' && id === fc.hoverFrameId;
    if (!kept && !hovered && mode !== 'always') continue;
    const r = frameStageRect(fc, b, i, m);
    if (!kept) {
      if (r.w < TITLE_MIN_HOVER_PX) continue;
      // "Always" draws the artboards on screen only.
      if (r.x > stageW || r.x + r.w < 0 || r.y - TITLE_LIFT_PX > stageH || r.y + r.h < 0) continue;
    }
    shown.push({ id, b, n, r, kept });
  }
  const wanted = new Set(shown.map((s) => s.id));
  for (const [id, el] of fc.frameTitleEls) {
    if (wanted.has(id)) continue;
    el.remove();
    fc.frameTitleEls.delete(id);
  }
  let prev: Element | null = null;
  for (const s of shown) {
    let el = fc.frameTitleEls.get(s.id);
    if (!el) {
      el = document.createElement('button');
      el.type = 'button';
      el.dataset.frameId = s.id;
      if (nameField) {
        el.title = t('Double-click to rename');
        el.setAttribute('aria-keyshortcuts', 'F2 Enter');
      }
      fc.frameTitleEls.set(s.id, el);
    }
    const cls = 'fc-frame-label' + (fc.selection.has(s.id) ? ' is-active' : '');
    if (el.className !== cls) el.className = cls;
    const text = fc.chromeSync.frameLabelText(s.b, s.n);
    if (el.textContent !== text) el.textContent = text;
    // Page order is tab order: each shown title follows the previous title.
    const slot: ChildNode | null = prev ? prev.nextSibling : frameLabels.firstChild;
    if (el !== slot) frameLabels.insertBefore(el, slot);
    prev = el;
    const left = `${Math.round(s.r.x)}px`;
    const top = `${Math.round(s.r.y - TITLE_LIFT_PX)}px`;
    const cap = `${Math.max(s.kept ? TITLE_MIN_KEPT_PX : 0, Math.floor(s.r.w))}px`;
    if (el.style.left !== left) el.style.left = left;
    if (el.style.top !== top) el.style.top = top;
    if (el.style.maxWidth !== cap) el.style.maxWidth = cap;
    // The rename prompt rides on the same rect as the tab it replaces, so a pan or zoom
    // mid-rename does not leave it behind.
    if (fc.renamingFrameId === s.id) {
      const prompt = frameLabels.querySelector<HTMLElement>('.fc-frame-rename');
      if (prompt) {
        prompt.style.left = left;
        prompt.style.top = top;
      }
    }
  }
}

/** Repaint the titles alone, for a change only they depend on (hover, focus). */
function refreshTitles(fc: FcCtx): void {
  const held = fc.frameLabelFrames;
  if (held) syncTitles(fc, held.source, held.source, true);
  else fc.chromeSync.scheduleSync();
}

/**
 * The pointer moved over the stage with no button down. Over a title, that title's
 * artboard stays the hovered one, so the pointer can travel from an artboard up onto its
 * title. Elsewhere the artboard under the point is picked from the model on the next
 * frame, from the stage metrics the last sync measured, so a hover reads no layout.
 */
export function hover(fc: FcCtx, e: { clientX: number; clientY: number; target?: EventTarget | null }): void {
  if (!fc.frameCfg || fc.titleMode !== 'selected' || fc.disposed) return;
  const title = (e.target as Element | null)?.closest?.<HTMLElement>('.fc-frame-label');
  fc.titleHoverAt = title ? { id: title.dataset.frameId || '' } : { x: e.clientX, y: e.clientY };
  if (!fc.titleHoverRaf) fc.titleHoverRaf = requestAnimationFrame(() => pickHover(fc));
}
function pickHover(fc: FcCtx): void {
  fc.titleHoverRaf = 0;
  const at = fc.titleHoverAt;
  let id = '';
  if (at && 'id' in at) id = at.id;
  else if (at && !fc.gesture) {
    const m = fc.titleMetrics ?? fc.stage.metrics();
    const x = (at.x - m.cr.left) / m.scale, y = (at.y - m.cr.top) / m.scale;
    let top = -1;
    for (const { b, i } of fc.frameLabelFrames?.frames ?? []) {
      if (i < top) continue;
      const r = boxRect(b, fc.cfg);
      if (x < r.x || y < r.y || x > r.x + r.w || y > r.y + r.h) continue;
      const fid = fc.select.idOf(b, i);
      if (fc.select.seqHiddenId(fid)) continue;
      top = i;
      id = fid;
    }
  }
  if (id === fc.hoverFrameId) return;
  fc.hoverFrameId = id;
  refreshTitles(fc);
}
/** The pointer left the stage: no artboard is under it any more. */
export function hoverEnd(fc: FcCtx): void {
  fc.titleHoverAt = null;
  if (!fc.hoverFrameId) return;
  fc.hoverFrameId = '';
  refreshTitles(fc);
}
/** A title took keyboard focus, and stays shown while focused. */
export function onTitleFocusIn(fc: FcCtx, e: Event): void {
  const id = (e.target as Element | null)?.closest?.<HTMLElement>('.fc-frame-label')?.dataset.frameId || '';
  if (id === fc.titleFocusId) return;
  fc.titleFocusId = id;
}
export function onTitleFocusOut(fc: FcCtx, e: FocusEvent): void {
  const next = (e.relatedTarget as Element | null)?.closest?.<HTMLElement>('.fc-frame-label')?.dataset.frameId || '';
  if (next === fc.titleFocusId) return;
  fc.titleFocusId = next;
  refreshTitles(fc);
}

export function frameTitlesOps(fc: FcCtx) {
  return {
    readTitleMode: bindOp(fc, readTitleMode),
    setTitleMode: bindOp(fc, setTitleMode),
    cycleTitleMode: bindOp(fc, cycleTitleMode),
    titleModeLabel: bindOp(fc, titleModeLabel),
    pageFrames: bindOp(fc, pageFrames),
    frameStageRect: bindOp(fc, frameStageRect),
    sync: bindOp(fc, syncTitles),
    hover: bindOp(fc, hover),
    hoverEnd: bindOp(fc, hoverEnd),
    onTitleFocusIn: bindOp(fc, onTitleFocusIn),
    onTitleFocusOut: bindOp(fc, onTitleFocusOut),
  };
}
