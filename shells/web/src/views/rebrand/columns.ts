// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the resizable columns (plan 275 close-out section 9.1).
 *
 * Owns `rb.els.queueGrip` and `rb.els.decideGrip`, the two grips the orchestrator
 * places between the queue, the work area and the decision column. Each is a window
 * splitter (`lib/splitter.ts`): drag it, click it to widen the column a step (at the
 * widest a click goes back to the narrowest), or focus it and use Left and Right (Shift
 * for bigger steps), Home and End for the limits, Enter or a double click for the default.
 * Each names the column it resizes (`aria-controls`) and says its width in words.
 *
 * - The queue moves between 220 and 420 px (272 by default), the decision column
 *   between 280 and 480 px (320 by default). The limits and the defaults follow the
 *   large-text multiplier, as the columns' words do.
 * - The stage between them never goes under `STAGE_MIN_PX`: while one column is
 *   dragged the other gives way first, down to its own minimum, and then the drag
 *   stops. A window made narrower takes from the decision column first, then the queue.
 * - The widths on screen when a drag or a key ends are stored per viewer in
 *   `localStorage` under `COLUMNS_KEY`, a chrome preference, never plan or project
 *   state, and they come back on the next open. A reset forgets that column's width,
 *   so it follows the default again.
 * - The grips show on the wide layout, and for the decision column alone on the
 *   medium one (the queue is the chip row there). None on the narrow layout, none on
 *   the medium one under a coarse pointer, where the column is a sheet, and none in
 *   Keep the design.
 *
 * The widths reach the grid as `--rb-col-queue` and `--rb-col-decide` on `.rb-body`,
 * and `data-columns` there says which grid applies (`styles/parts/rebrand-columns.css`).
 * The hero follows through its pane's size container, so it re-fits in the frame the
 * width is written.
 */
import { tRaw } from '../../i18n.ts';
import {
  clampWidth,
  mountSplitter,
  readStoredWidths,
  writeStoredWidths,
  type SplitterHandle,
  type SplitterLimits,
} from '../../lib/splitter.ts';
import { bindOp, type RbCtx } from './context.ts';

/** The per-viewer store for the two widths. */
export const COLUMNS_KEY = 'lolly-rebrand-columns';
/** The narrowest the stage between the columns may become from a drag. */
export const STAGE_MIN_PX = 480;
/** The queue's limits and default at the regular type size. */
export const QUEUE_LIMITS: SplitterLimits = { min: 220, max: 420, initial: 272 };
/** The decision column's limits and default at the regular type size. */
export const DECIDE_LIMITS: SplitterLimits = { min: 280, max: 480, initial: 320 };

type Column = 'queue' | 'decide';
/** Which grid the grips drive: both columns, the decision column alone, or none. */
export type ColumnsTier = 'wide' | 'medium' | null;

export interface ColumnWidths {
  queue: number;
  decide: number;
}

interface ColumnsState {
  /** The stored widths; a missing one follows the default. */
  prefs: Partial<ColumnWidths>;
  /** What is on screen now (0 for a column without a grip). */
  shown: ColumnWidths;
  /** `.rb-body`'s width, from its resize observer; 0 before the first measure. */
  width: number;
  /** The large-text multiplier the limits are scaled by. */
  factor: number;
  tier: ColumnsTier;
  queue: SplitterHandle | null;
  decide: SplitterHandle | null;
}

const states = new WeakMap<RbCtx, ColumnsState>();

function stateOf(rb: RbCtx): ColumnsState {
  let st = states.get(rb);
  if (!st) {
    st = { prefs: {}, shown: { queue: 0, decide: 0 }, width: 0, factor: 1, tier: null, queue: null, decide: null };
    states.set(rb, st);
  }
  return st;
}

/** Limits scaled by the large-text multiplier, rounded to whole pixels. */
export function scaledLimits(base: SplitterLimits, factor: number): SplitterLimits {
  const f = Number.isFinite(factor) && factor > 0 ? factor : 1;
  return { min: Math.round(base.min * f), max: Math.round(base.max * f), initial: Math.round(base.initial * f) };
}

/**
 * The widths to show, from the stored ones, the grid's width and, during a drag or a
 * key, the column being moved and the width it asks for. Pure, so the rule is tested
 * on its own.
 *
 * Each column is first held inside its own limits. When the two leave the stage under
 * `STAGE_MIN_PX`, the column that is not being moved gives way down to its minimum,
 * then the moved one stops. With nothing moving, the decision column gives way first.
 * A width of 0 (not measured yet) applies no stage rule.
 */
export function fitColumns(input: {
  tier: Exclude<ColumnsTier, null>;
  width: number;
  factor: number;
  prefs: Partial<ColumnWidths>;
  moving?: { column: Column; want: number } | null;
}): ColumnWidths {
  const q = scaledLimits(QUEUE_LIMITS, input.factor);
  const d = scaledLimits(DECIDE_LIMITS, input.factor);
  const wide = input.tier === 'wide';
  const pick = (column: Column, limits: SplitterLimits): number => {
    const want = input.moving?.column === column ? input.moving.want : input.prefs[column] ?? limits.initial;
    return clampWidth(Math.round(want), limits.min, limits.max);
  };
  let queue = wide ? pick('queue', q) : 0;
  let decide = pick('decide', d);
  if (input.width <= 0) return { queue, decide };
  const room = input.width - STAGE_MIN_PX;
  const qMin = wide ? q.min : 0;
  if (queue + decide > room) {
    if (input.moving?.column === 'decide') {
      queue = Math.max(qMin, room - decide);
      if (queue + decide > room) decide = Math.max(d.min, room - queue);
    } else {
      decide = Math.max(d.min, room - queue);
      if (queue + decide > room) queue = Math.max(qMin, room - decide);
    }
  }
  return { queue: Math.round(queue), decide: Math.round(decide) };
}

/**
 * The largest width `column` can take now: its own maximum, or less when the stage
 * would go under its floor with the other column at its minimum.
 */
function reach(st: ColumnsState, column: Column): SplitterLimits {
  const own = scaledLimits(column === 'queue' ? QUEUE_LIMITS : DECIDE_LIMITS, st.factor);
  if (st.width <= 0 || !st.tier) return own;
  const other = column === 'queue'
    ? scaledLimits(DECIDE_LIMITS, st.factor).min
    : st.tier === 'wide' ? scaledLimits(QUEUE_LIMITS, st.factor).min : 0;
  const room = st.width - STAGE_MIN_PX - other;
  return { ...own, max: Math.max(own.min, Math.min(own.max, room)) };
}

function coarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/** Which grips show for the current layout and mode. */
export function columnsTier(rb: Pick<RbCtx, 'narrow' | 'medium' | 'state'>, coarse = coarsePointer()): ColumnsTier {
  if (rb.narrow || rb.state.mode === 'keep-design') return null;
  if (rb.medium) return coarse ? null : 'medium';
  return 'wide';
}

/** The large-text multiplier on the view, 1 when it cannot be read. */
function readFactor(rb: RbCtx): number {
  try {
    const raw = getComputedStyle(rb.els.root).getPropertyValue('--a11y-fs').trim();
    const n = Number.parseFloat(raw);
    return Number.isFinite(n) && n > 0 ? n : 1;
  } catch {
    return 1;
  }
}

/** Write the widths to the grid and the values to the grips. */
function paint(rb: RbCtx, st: ColumnsState, widths: ColumnWidths): void {
  st.shown = widths;
  const body = rb.els.body;
  if (st.tier === 'wide') body.style.setProperty('--rb-col-queue', `${widths.queue}px`);
  else body.style.removeProperty('--rb-col-queue');
  body.style.setProperty('--rb-col-decide', `${widths.decide}px`);
  st.queue?.sync();
  st.decide?.sync();
}

/** Lay the columns out again from the stored widths, with nothing being moved. */
function refit(rb: RbCtx, st: ColumnsState): void {
  if (!st.tier) return;
  if (st.queue?.dragging() || st.decide?.dragging()) return;
  paint(rb, st, fitColumns({ tier: st.tier, width: st.width, factor: st.factor, prefs: st.prefs }));
}

/** Apply a wanted width for one column; on `done`, keep what is on screen. */
function move(rb: RbCtx, st: ColumnsState, column: Column, want: number, done: boolean): number {
  if (!st.tier) return want;
  const widths = fitColumns({ tier: st.tier, width: st.width, factor: st.factor, prefs: st.prefs, moving: { column, want } });
  paint(rb, st, widths);
  if (done) {
    st.prefs = st.tier === 'wide' ? { ...widths } : { ...st.prefs, decide: widths.decide };
    writeStoredWidths(COLUMNS_KEY, st.prefs);
  }
  return widths[column];
}

/** Enter or a double click: forget the column's width, so it follows the default. */
function reset(rb: RbCtx, st: ColumnsState, column: Column): void {
  const prefs = { ...st.prefs };
  delete prefs[column];
  st.prefs = prefs;
  writeStoredWidths(COLUMNS_KEY, prefs);
  refit(rb, st);
}

/** Wire the grips once, at mount. */
export function wireColumns(rb: RbCtx): void {
  const st = stateOf(rb);
  st.prefs = readStoredWidths(COLUMNS_KEY);
  st.factor = readFactor(rb);
  const { queueGrip, decideGrip, body } = rb.els;
  for (const grip of [queueGrip, decideGrip]) grip.classList.add('resize-grip');
  // Stable ids for the columns the grips name, so a screen reader can go to the one it resizes.
  if (!rb.els.queue.id) rb.els.queue.id = 'rb-col-queue';
  if (!rb.els.decide.id) rb.els.decide.id = 'rb-col-decide';
  const hint = tRaw('Drag, or click to widen. Double-click restores the width.');
  const splitter = (column: Column, grip: HTMLElement, label: string): SplitterHandle => mountSplitter({
    grip,
    panel: column === 'queue' ? 'start' : 'end',
    label,
    valueText: (px) => tRaw('{count} pixels wide', { count: px }),
    controls: column === 'queue' ? rb.els.queue : rb.els.decide,
    hint,
    value: () => st.shown[column],
    limits: () => reach(st, column),
    set: (px, done) => move(rb, st, column, px, done),
    reset: () => reset(rb, st, column),
    onDrag: (on) => {
      if (on) {
        st.factor = readFactor(rb);
        body.dataset.resizing = 'true';
      } else delete body.dataset.resizing;
    },
  });
  st.queue = splitter('queue', queueGrip, tRaw('Resize the review list'));
  st.decide = splitter('decide', decideGrip, tRaw('Resize the side panel'));

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver((entries) => {
      const box = entries[entries.length - 1]?.contentRect;
      if (!box || box.width <= 0) return;
      st.width = box.width;
      st.factor = readFactor(rb);
      refit(rb, st);
    });
    observer.observe(body);
    rb.disposers.push(() => observer.disconnect());
  }

  // A pointer change (a tablet's keyboard attached or taken off) can move the medium
  // layout between a column and a sheet.
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    const pointer = window.matchMedia('(pointer: coarse)');
    const onPointer = (): void => renderColumns(rb);
    pointer.addEventListener?.('change', onPointer);
    rb.disposers.push(() => pointer.removeEventListener?.('change', onPointer));
  }

  rb.disposers.push(() => {
    st.queue?.dispose();
    st.decide?.dispose();
    states.delete(rb);
  });
}

/** Show the grips the layout has and lay the columns out. */
export function renderColumns(rb: RbCtx): void {
  const st = stateOf(rb);
  const tier = columnsTier(rb);
  const { body, queueGrip, decideGrip } = rb.els;
  queueGrip.hidden = tier !== 'wide';
  decideGrip.hidden = tier === null;
  if (tier === st.tier && tier !== null && body.dataset.columns === tier) return;
  st.tier = tier;
  if (!tier) {
    delete body.dataset.columns;
    body.style.removeProperty('--rb-col-queue');
    body.style.removeProperty('--rb-col-decide');
    st.shown = { queue: 0, decide: 0 };
    return;
  }
  body.dataset.columns = tier;
  // The body was hidden or on another layout until now, so its last measure is stale.
  const measured = body.getBoundingClientRect?.().width ?? 0;
  if (measured > 0) st.width = measured;
  refit(rb, st);
}

/** The widths on screen, for tests and for a module that places something beside a column. */
export function shownColumns(rb: RbCtx): ColumnWidths {
  return { ...stateOf(rb).shown };
}

export function columnsOps(rb: RbCtx) {
  return {
    wire: bindOp(rb, wireColumns),
    render: bindOp(rb, renderColumns),
    shown: bindOp(rb, shownColumns),
  };
}
