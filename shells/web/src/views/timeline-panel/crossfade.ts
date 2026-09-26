// SPDX-License-Identifier: MPL-2.0
/**
 * timeline-panel: the crossfade you can SEE and DRAG (plans/268 SI-07).
 *
 * A crossfade stores nothing at the cut. It is a fade out of one clip and a fade into
 * the next, and the handover is derived from the pair. Until now the only sign of one on
 * the timeline was a tinted 18px seam chip, and the only way to change its length was to
 * type milliseconds into a dialog in the middle of the screen. Every editor a person has
 * used draws the transition across the cut and lets them pull its edge.
 *
 * So each crossfade gets a BAND over the head of the incoming clip. It starts at the cut
 * and is as wide as the handover, because that is where and for how long the two
 * pictures are both on screen, in the preview and in the file alike (SI-01). Its right
 * end is a grip. Dragging the grip changes the length; dragging the seam chip of a plain
 * cut to the right makes a crossfade; dragging a crossfade back to the cut removes it.
 * A press with no travel is still a click, and a click still opens the dialog.
 *
 * Where the outgoing clip runs out of source before the handover ends, that part of the
 * band is hatched. The export holds the last frame there and never invents picture, and
 * a person should see that before they export, not after.
 *
 * The arithmetic is timeline-math's (`seqJunctions`, `clampJunctionMs`, `setJunction`).
 * One model write, on release, through the same writer the dialog uses.
 */
import { t } from '../../i18n.ts';
import {
  JUNCTION_STEP_FINE_MS, JUNCTION_STEP_MS, MIN_JUNCTION_MS,
  boxTiming, clampJunctionMs, fmtDur, indexOfId, seqJunctions, setJunction, setTransitionMs,
  type Box, type SeqJunction,
} from '../timeline-math.ts';
import { EDGE_PX, EDGE_PX_COARSE } from '../timeline-config.ts';
import { isCoarsePointer, timeToPx } from './shared.ts';
import { bindOp, type TpCtx } from './context.ts';

/** Travel, px, before a press on a seam stops being a click and becomes a drag. */
const DRAG_START_PX = 4;
/** A wedge narrower than this shows no grip: the bar's trim edge owns that end. */
const RAMP_GRIP_MIN_PX = 2 * EDGE_PX;

/** A clip's own enter or exit being resized by its wedge (see `paintRamps`). */
export interface RampDrag {
  pointerId: number;
  pointerType: string;
  src: HTMLElement;
  bar: HTMLElement;
  id: string;
  side: 'in' | 'out';
  /** Client x of the clip end the wedge grows from. */
  edgeClientX: number;
  /** The most the wedge may be, ms: half the clip. */
  maxMs: number;
  fromMs: number;
  ms: number;
  onKey: (e: KeyboardEvent) => void;
}

export interface XfadeDrag {
  pointerId: number;
  pointerType: string;
  /** The seam chip or the grip that took the press. */
  src: HTMLElement;
  aId: string;
  bId: string;
  /** Client x of the cut, so the length is read from the pointer and not from its travel. */
  cutClientX: number;
  startX: number;
  maxMs: number;
  /** What the junction was when the press began. null = a cut. */
  fromMs: number | null;
  /** The live answer. null = a cut. */
  ms: number | null;
  dragging: boolean;
  /** Escape cancels a running drag. Attached for the drag only, removed when it ends. */
  onKey: (e: KeyboardEvent) => void;
}

const junctionFor = (list: SeqJunction[], aId: string, bId: string): SeqJunction | undefined =>
  list.find((j) => j.aId === aId && j.bId === bId);

function bandFor(tp: TpCtx, aId: string, bId: string): HTMLElement | null {
  for (const el of Array.from(tp.laneWrap.querySelectorAll<HTMLElement>('.tl-xfade'))) {
    if (el.dataset.a === aId && el.dataset.b === bId) return el;
  }
  return null;
}

function makeBand(aId: string, bId: string): HTMLElement {
  const band = document.createElement('div');
  band.className = 'tl-xfade';
  band.dataset.a = aId;
  band.dataset.b = bId;
  // Pointer affordances only, like the seam chip: the same length is a number field in
  // the junction dialog, which is in the tab order.
  band.setAttribute('aria-hidden', 'true');
  const held = document.createElement('span');
  held.className = 'tl-xfade-held';
  const grip = document.createElement('span');
  grip.className = 'tl-xfade-grip';
  // `title`, not [data-tip]: the tip bubble is drawn above its element and this one lives
  // inside the .tl-tracks scroller, which clips it (see the scenery chips in rows.ts).
  grip.title = t('Drag to change the crossfade length');
  band.append(held, grip);
  return band;
}

function sizeBand(tp: TpCtx, band: HTMLElement, j: { cutSec: number; ms: number; heldMs: number }): void {
  const w = Math.max(0, timeToPx(j.ms / 1000, tp.pxPerSec));
  band.style.left = `${timeToPx(j.cutSec, tp.pxPerSec)}px`;
  band.style.width = `${w}px`;
  band.hidden = !(j.ms > 0);
  const held = band.querySelector<HTMLElement>('.tl-xfade-held');
  if (held) {
    const hw = j.ms > 0 ? Math.min(w, timeToPx(j.heldMs / 1000, tp.pxPerSec)) : 0;
    held.style.width = `${hw}px`;
    held.hidden = !(hw >= 2);
    held.title = hw >= 2 ? t('The first clip runs out of footage here and holds its last frame') : '';
  }
}

/**
 * The RAMPS: a wedge at the head of a clip that animates in and at the tail of one that
 * animates out, as wide as the transition is long. Before these a person had to select
 * each clip and read the inspector to learn which ones move and for how long. A side of
 * a crossfade gets no ramp: the band already says it, and the outgoing clip of a
 * crossfade does NOT fade before its cut any more (SI-01), so a wedge there would lie.
 */
function paintRamps(tp: TpCtx, boxes: Box[], junctions: SeqJunction[]): void {
  const { cfg, bars } = tp;
  const outSide = new Set(junctions.filter((j) => j.kind === 'xfade').map((j) => j.aId));
  const inSide = new Set(junctions.filter((j) => j.kind === 'xfade').map((j) => j.bId));
  const lengthPx = (kind: unknown, ms: unknown, barPx: number): number => {
    if (typeof kind !== 'string' || kind === '' || kind === 'none') return 0;
    const n = Number(ms);
    const sec = Math.min(3000, Math.max(100, Number.isFinite(n) ? n : 400)) / 1000;
    return Math.min(barPx / 2, timeToPx(sec, tp.pxPerSec));
  };
  const setRamp = (bar: HTMLElement, side: 'in' | 'out', px: number): void => {
    let el = bar.querySelector<HTMLElement>(`:scope > .tl-ramp-${side}`);
    let grip = bar.querySelector<HTMLElement>(`:scope > .tl-ramp-grip-${side}`);
    if (px < 3) { el?.remove(); grip?.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.className = `tl-ramp tl-ramp-${side}`;
      el.setAttribute('aria-hidden', 'true');
      bar.appendChild(el);
    }
    el.style.width = `${px}px`;
    // The grip is a SIBLING of the wedge, because the wedge is a clip-path triangle and
    // would cut a child to its own shape. It sits on the wedge's inner end, clear of the
    // bar's own trim edge: a wedge too narrow for both keeps the trim edge and shows no
    // grip (zoom in to reach it), so a press near a clip's end never means two things.
    if (px < RAMP_GRIP_MIN_PX) { grip?.remove(); return; }
    if (!grip) {
      grip = document.createElement('span');
      grip.className = `tl-ramp-grip tl-ramp-grip-${side}`;
      grip.dataset.side = side;
      grip.setAttribute('aria-hidden', 'true');
      grip.title = side === 'in' ? t('Enter') : t('Exit');
      bar.appendChild(grip);
    }
    grip.style[side === 'in' ? 'left' : 'right'] = `${px}px`;
  };
  for (const b of boxes) {
    const id = String(b?.[cfg.idField] ?? '');
    const bar = id ? bars.get(id) : null;
    if (!bar) continue;
    if (tp.rampDrag?.id === id) continue;   // sized by the pointer until it lets go
    const barPx = parseFloat(bar.style.width) || 0;
    // An open-ended clip has no tail to animate out of, exactly as the player reads it.
    const bounded = b[cfg.durField] !== '' && b[cfg.durField] != null && Number.isFinite(Number(b[cfg.durField]));
    setRamp(bar, 'in', inSide.has(id) ? 0 : lengthPx(b[cfg.enterField], b[cfg.enterMsField], barPx));
    setRamp(bar, 'out', outSide.has(id) || !bounded ? 0 : lengthPx(b[cfg.exitField], b[cfg.exitMsField], barPx));
  }
}

/** Lay every crossfade band over its cut. Called from the rows' cheap restyle pass. */
export function paint(tp: TpCtx, boxes: Box[]): void {
  const { cfg, laneWrap } = tp;
  const junctions = seqJunctions(boxes, cfg, tp.helpers.mediaDur);
  paintRamps(tp, boxes, junctions);
  const seqLane = laneWrap.querySelector<HTMLElement>('.tl-lane-seq');
  if (!seqLane) return;
  const live = new Set<HTMLElement>();
  for (const j of junctions) {
    // While a drag is running its own band is sized by the pointer, not by the model.
    const drag = tp.xfadeDrag;
    if (drag?.dragging && drag.aId === j.aId && drag.bId === j.bId) {
      const mine = bandFor(tp, j.aId, j.bId);
      if (mine) live.add(mine);
      continue;
    }
    if (j.kind !== 'xfade') continue;
    let band = bandFor(tp, j.aId, j.bId);
    if (!band) {
      band = makeBand(j.aId, j.bId);
      seqLane.appendChild(band);
    }
    sizeBand(tp, band, j);
    live.add(band);
  }
  for (const el of Array.from(seqLane.querySelectorAll<HTMLElement>('.tl-xfade'))) {
    if (!live.has(el)) el.remove();
  }
  // The seam chip says which kind of junction it is, by the planner's rule (the PAIR of
  // fades), so a chip never claims a crossfade the file will not have.
  for (const chip of Array.from(laneWrap.querySelectorAll<HTMLElement>('.tl-seam'))) {
    const j = junctionFor(junctions, chip.dataset.a || '', chip.dataset.b || '');
    chip.classList.toggle('is-xfade', j?.kind === 'xfade');
  }
}

/**
 * Place the length badge over the sequence lane. The boxes are measured by the caller at
 * the top of its pointermove, before it writes any style, so this only writes.
 */
function showBadge(tp: TpCtx, d: XfadeDrag, clientX: number, innerBox: DOMRect, laneBox: DOMRect): void {
  const { trimBadge } = tp;
  const top = laneBox.top - innerBox.top;
  const below = top < 24;
  const lift = isCoarsePointer(d.pointerType) ? 44 : 0;
  trimBadge.classList.toggle('is-below', below);
  trimBadge.style.top = `${below ? top + laneBox.height + lift : top - lift}px`;
  trimBadge.style.left = `${clientX - innerBox.left}px`;
  trimBadge.hidden = false;
  trimBadge.textContent = d.ms === null ? t('Cut') : `${t('Crossfade')} ${fmtDur(d.ms / 1000)}`;
}

// ── the ramp drag: a clip's own enter or exit ────────────────────────────────

function rampDown(tp: TpCtx, e: PointerEvent, grip: HTMLElement): void {
  const bar = grip.closest<HTMLElement>('.tl-clip');
  const id = bar?.dataset.id || '';
  const side = grip.dataset.side === 'out' ? 'out' : 'in';
  const rows = tp.getBoxes();
  const i = indexOfId(rows, tp.cfg, id);
  if (!bar || i < 0) return;
  const box = rows[i]!;
  const dur = boxTiming(box, tp.cfg).dur;
  const field = side === 'in' ? tp.cfg.enterMsField : tp.cfg.exitMsField;
  const cur = Number(box[field]);
  const fromMs = Number.isFinite(cur) ? cur : 400;
  const rect = bar.getBoundingClientRect();
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape' || !tp.rampDrag) return;
    ev.preventDefault();
    ev.stopPropagation();
    rampFinish(tp, false);
  };
  tp.rampDrag = {
    pointerId: e.pointerId, pointerType: e.pointerType, src: grip, bar, id, side,
    edgeClientX: side === 'in' ? rect.left : rect.right,
    maxMs: dur === null ? 3000 : Math.floor((dur * 1000) / 2),
    fromMs, ms: fromMs, onKey,
  };
  window.addEventListener('keydown', onKey, true);
  try { grip.setPointerCapture(e.pointerId); } catch { /* a synthetic event in a test */ }
  bar.classList.add('is-ramping');
  // The press belongs to the grip: the bar under it must not start a move or a trim.
  e.preventDefault();
  e.stopPropagation();
}

function rampMove(tp: TpCtx, e: PointerEvent): void {
  const d = tp.rampDrag;
  if (!d || e.pointerId !== d.pointerId) return;
  e.preventDefault();
  const px = d.side === 'in' ? e.clientX - d.edgeClientX : d.edgeClientX - e.clientX;
  const rawMs = (px / Math.max(1e-6, tp.pxPerSec)) * 1000;
  d.ms = clampJunctionMs(rawMs, Math.max(MIN_JUNCTION_MS, d.maxMs), tp.opts.projectTime ? tp.helpers.frameStep() * 1000 : e.altKey ? JUNCTION_STEP_FINE_MS : JUNCTION_STEP_MS);
  // Measure before any style write below, so the browser lays out at most once per move.
  // The wedge and grip are absolutely placed inside the bar, so resizing them never moves
  // either box: the numbers are the same as reading them after the writes.
  const { trimBadge, inner } = tp;
  const innerBox = inner.getBoundingClientRect();
  const barBox = d.bar.getBoundingClientRect();
  const w = timeToPx(d.ms / 1000, tp.pxPerSec);
  const wedge = d.bar.querySelector<HTMLElement>(`:scope > .tl-ramp-${d.side}`);
  if (wedge) wedge.style.width = `${w}px`;
  d.src.style[d.side === 'in' ? 'left' : 'right'] = `${w}px`;
  const top = barBox.top - innerBox.top;
  const below = top < 24;
  const lift = isCoarsePointer(d.pointerType) ? 44 : 0;
  trimBadge.classList.toggle('is-below', below);
  trimBadge.style.top = `${below ? top + barBox.height + lift : top - lift}px`;
  trimBadge.style.left = `${e.clientX - innerBox.left}px`;
  trimBadge.hidden = false;
  trimBadge.textContent = `${d.side === 'in' ? t('Enter') : t('Exit')} ${fmtDur(d.ms / 1000)}`;
}

function rampFinish(tp: TpCtx, commit: boolean): void {
  const d = tp.rampDrag;
  if (!d) return;
  tp.rampDrag = null;
  window.removeEventListener('keydown', d.onKey, true);
  try { d.src.releasePointerCapture(d.pointerId); } catch { /* already released */ }
  d.bar.classList.remove('is-ramping');
  tp.trimBadge.hidden = true;
  const rows = tp.getBoxes();
  if (commit && d.ms !== d.fromMs) {
    // Step 1: `rampMove` already put `ms` on the grid, so the writer must not move it again.
    const next = setTransitionMs(rows, tp.cfg, d.id, d.side === 'in' ? 'enter' : 'exit', d.ms, 1);
    if (next !== rows) { tp.helpers.write(next); return; }
  }
  paint(tp, rows);
}

function onDown(tp: TpCtx, e: PointerEvent): void {
  if (tp.xfadeDrag || tp.rampDrag || e.button !== 0) return;
  const rampGrip = (e.target as HTMLElement | null)?.closest<HTMLElement>('.tl-ramp-grip');
  if (rampGrip) { rampDown(tp, e, rampGrip); return; }
  const target = e.target as HTMLElement | null;
  const grip = target?.closest<HTMLElement>('.tl-xfade-grip');
  const seam = grip ? null : target?.closest<HTMLElement>('.tl-seam');
  const src = grip ?? seam;
  if (!src) return;
  const holder = grip ? grip.closest<HTMLElement>('.tl-xfade') : seam;
  const aId = holder?.dataset.a || '';
  const bId = holder?.dataset.b || '';
  const j = junctionFor(seqJunctions(tp.getBoxes(), tp.cfg, tp.helpers.mediaDur), aId, bId);
  if (!j || j.maxMs < MIN_JUNCTION_MS) return;
  const innerLeft = tp.inner.getBoundingClientRect().left;
  const onKey = (ev: KeyboardEvent): void => {
    if (ev.key !== 'Escape' || !tp.xfadeDrag?.dragging) return;
    ev.preventDefault();
    ev.stopPropagation();
    finish(tp, false);
  };
  tp.xfadeDrag = {
    pointerId: e.pointerId,
    pointerType: e.pointerType,
    src,
    aId, bId,
    cutClientX: innerLeft + timeToPx(j.cutSec, tp.pxPerSec),
    startX: e.clientX,
    maxMs: j.maxMs,
    fromMs: j.kind === 'xfade' ? j.ms : null,
    ms: j.kind === 'xfade' ? j.ms : null,
    // The grip has one job, so it drags from the first pixel. The seam chip is also a
    // button, so it waits to see whether this press travels.
    dragging: !!grip,
    onKey,
  };
  window.addEventListener('keydown', onKey, true);
  try { src.setPointerCapture(e.pointerId); } catch { /* a synthetic event in a test */ }
  // A press on the grip must not start a marquee or select the clip under it.
  if (grip) { e.preventDefault(); e.stopPropagation(); }
}

function onMove(tp: TpCtx, e: PointerEvent): void {
  if (tp.rampDrag) { rampMove(tp, e); return; }
  const d = tp.xfadeDrag;
  if (!d || e.pointerId !== d.pointerId) return;
  if (!d.dragging) {
    if (Math.abs(e.clientX - d.startX) < DRAG_START_PX) return;
    d.dragging = true;
  }
  e.preventDefault();
  const px = e.clientX - d.cutClientX;
  const rawMs = (px / Math.max(1e-6, tp.pxPerSec)) * 1000;
  // Pulled back to the cut (less than half the shortest crossfade): it is a cut.
  d.ms = rawMs < MIN_JUNCTION_MS / 2
    ? null
    : clampJunctionMs(rawMs, d.maxMs, tp.opts.projectTime ? tp.helpers.frameStep() * 1000 : e.altKey ? JUNCTION_STEP_FINE_MS : JUNCTION_STEP_MS);
  const seqLane = tp.laneWrap.querySelector<HTMLElement>('.tl-lane-seq');
  // Measure once, before the band and badge writes below, so a move costs one layout at
  // most. The band and badge are absolutely placed, so writing them never moves these boxes.
  const innerBox = tp.inner.getBoundingClientRect();
  const laneBox = seqLane?.getBoundingClientRect() ?? null;
  let band = bandFor(tp, d.aId, d.bId);
  if (!band && seqLane) {
    band = makeBand(d.aId, d.bId);
    seqLane.appendChild(band);
  }
  if (band) {
    band.classList.add('is-dragging');
    const cutSec = (d.cutClientX - innerBox.left) / Math.max(1e-6, tp.pxPerSec);
    // The held part is recomputed from the model on release; while dragging, the live
    // length against the same source is what `seqJunctions` would say, so ask it.
    const probe = d.ms === null ? null
      : junctionFor(seqJunctions(setJunction(tp.getBoxes(), tp.cfg, d.aId, d.bId, d.ms), tp.cfg, tp.helpers.mediaDur), d.aId, d.bId);
    sizeBand(tp, band, { cutSec, ms: d.ms ?? 0, heldMs: probe?.heldMs ?? 0 });
  }
  if (laneBox) showBadge(tp, d, e.clientX, innerBox, laneBox);
}

function finish(tp: TpCtx, commit: boolean): void {
  const d = tp.xfadeDrag;
  if (!d) return;
  tp.xfadeDrag = null;
  window.removeEventListener('keydown', d.onKey, true);
  try { d.src.releasePointerCapture(d.pointerId); } catch { /* already released */ }
  tp.trimBadge.hidden = true;
  bandFor(tp, d.aId, d.bId)?.classList.remove('is-dragging');
  if (d.dragging) {
    // The click that follows this release belongs to the drag, not to the seam button.
    const swallow = (ev: Event): void => { ev.stopPropagation(); ev.preventDefault(); };
    d.src.addEventListener('click', swallow, { capture: true, once: true });
    setTimeout(() => d.src.removeEventListener('click', swallow, { capture: true }), 0);
  }
  const rows = tp.getBoxes();
  if (commit && d.dragging && d.ms !== d.fromMs) {
    const next = setJunction(rows, tp.cfg, d.aId, d.bId, d.ms);
    if (next !== rows) { tp.helpers.write(next); return; }
  }
  // Nothing written (a cancel, or a drag that ended where it began): put the bands back
  // to what the model says.
  paint(tp, rows);
}

function onUp(tp: TpCtx, e: PointerEvent): void {
  if (tp.rampDrag && e.pointerId === tp.rampDrag.pointerId) rampFinish(tp, true);
  if (tp.xfadeDrag && e.pointerId === tp.xfadeDrag.pointerId) finish(tp, true);
}

function onCancel(tp: TpCtx, e: PointerEvent): void {
  if (tp.rampDrag && e.pointerId === tp.rampDrag.pointerId) rampFinish(tp, false);
  if (tp.xfadeDrag && e.pointerId === tp.xfadeDrag.pointerId) finish(tp, false);
}

/** The panel is going away: end a drag that is still open, writing nothing. */
export function destroy(tp: TpCtx): void {
  finish(tp, false);
  rampFinish(tp, false);
}

/** True while a crossfade length is being dragged, so other gestures can stand down. */
export function active(tp: TpCtx): boolean {
  return !!tp.xfadeDrag?.dragging || !!tp.rampDrag;
}

export function wire(tp: TpCtx): void {
  const { laneWrap } = tp;
  // Capture phase: the grip sits over a clip bar, and the bar's own press handler must
  // not see a press that belongs to the grip.
  laneWrap.addEventListener('pointerdown', (e) => onDown(tp, e), true);
  laneWrap.addEventListener('pointermove', (e) => onMove(tp, e));
  laneWrap.addEventListener('pointerup', (e) => onUp(tp, e));
  laneWrap.addEventListener('pointercancel', (e) => onCancel(tp, e));
  laneWrap.style.setProperty('--tl-xfade-grip', `${EDGE_PX}px`);
  laneWrap.style.setProperty('--tl-xfade-grip-coarse', `${EDGE_PX_COARSE}px`);
}

export function crossfadeOps(tp: TpCtx) {
  return { paint: bindOp(tp, paint), wire: bindOp(tp, wire), active: bindOp(tp, active), destroy: bindOp(tp, destroy) };
}
