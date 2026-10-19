// SPDX-License-Identifier: MPL-2.0
/**
 * The Inspector's aspect lock and Scale % (plan 311 follow-up).
 *
 * Kept outside `initDesignInspector`, which has a no-growth maintainability budget: the
 * column hands this module its own cell builders and reads two strings back (the Size
 * row, then the Scale row). The lock is a per-box, in-memory convenience. It is not a
 * field, so it never reaches the document or a collaborator. A locked W or H commits both
 * sides in ONE `model.commit`, one undo step, at the ratio the box has at that moment.
 * Scale % delegates to the overlay's Scale popover commit (`actions.scaleSelection`), so
 * content, descendants and composed text scale exactly as a Scale drag does.
 */
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { icon } from '../lib/icons.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';
import { iconNode } from '../lib/icon-node.ts';

/** The shell's size bound for a box side, shared with the W and H cells. */
const SIDE_MIN = 1;
const SIDE_MAX = 100000;

type CellOpts = { name?: string; unit?: string; min?: number; max?: number; step?: number; precision?: number; onCommit?(v: number): void };
type Cell = (label: string, field: string | undefined, value: number | 'mixed', o?: CellOpts) => string;

export interface AspectScaleCtx {
  model: ModelPort;
  cfg: BoxFieldConfig;
  /** The id of the box the rows are built for. */
  id: string;
  /** The box's width and height in CSS px. */
  w: number;
  h: number;
  /** The W and H cell builder (document unit aware) and the plain cell builder. */
  dimCell: Cell;
  numCell: Cell;
  /** CSS px per displayed unit: a committed value is shown value x scale. */
  scale: number;
  /** The overlay's Scale commit; absent hosts get no Scale row. */
  scaleSelection?(k: number): boolean;
  /** Repaint the column (a Scale that wrote nothing leaves a stale number in its cell). */
  resync(): void;
}

/** The boxes locked to their ratio, by id, for as long as the column lives. */
export interface AspectLocks {
  has(id: string): boolean;
  toggle(id: string): boolean;
}

export function createAspectLocks(): AspectLocks {
  const on = new Set<string>();
  return {
    has: (id) => on.has(id),
    toggle: (id) => {
      if (on.delete(id)) return false;
      on.add(id);
      return true;
    },
  };
}

const clampSide = (v: number): number => Math.min(SIDE_MAX, Math.max(SIDE_MIN, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/**
 * The two sides after `field` takes `value`, holding the ratio `h / w` of the start. A
 * side that would leave its bounds pulls the other one back in step, so the ratio holds
 * at the edge rather than one side sticking alone.
 */
export function lockedSides(w: number, h: number, axis: 'w' | 'h', value: number): { w: number; h: number } {
  if (!(w > 0) || !(h > 0) || !Number.isFinite(value)) return { w, h };
  const k = value / (axis === 'w' ? w : h);
  const lo = Math.max(SIDE_MIN / w, SIDE_MIN / h), hi = Math.min(SIDE_MAX / w, SIDE_MAX / h);
  const kk = Math.min(hi, Math.max(lo, k));
  return { w: round2(w * kk), h: round2(h * kk) };
}

function commitSide(c: AspectScaleCtx, locks: AspectLocks, axis: 'w' | 'h', value: number): void {
  const field = axis === 'w' ? c.cfg.wField : c.cfg.hField;
  if (!locks.has(c.id)) {
    c.model.setField([c.id], field, clampSide(value));
    return;
  }
  const idField = c.cfg.idField;
  const rows = c.model.getBoxes();
  const at = rows.findIndex((b, i) => String(idField ? b[idField] ?? i : i) === c.id);
  if (at < 0) return;
  const row = rows[at] as Box;
  const w = Number(row[c.cfg.wField]), h = Number(row[c.cfg.hField]);
  const next = lockedSides(w, h, axis, value);
  if (next.w === w && next.h === h) return;
  c.model.commit(rows.map((b, i) => (i === at ? { ...b, [c.cfg.wField]: next.w, [c.cfg.hField]: next.h } : b)));
}

/** The Size row (W, the lock, H) and, when the host can scale, the Scale % row. */
export function sizeAndScaleRows(c: AspectScaleCtx, locks: AspectLocks): string {
  const on = locks.has(c.id);
  const label = t('Keep proportions');
  const lock = `<button type="button" class="fc-aspect-lock" data-aspect-lock="${escapeHtml(c.id)}" aria-pressed="${on}"`
    + ` aria-label="${escapeHtml(label)}" data-tip="${escapeHtml(label)}">${icon(on ? 'link' : 'unlink')}</button>`;
  const side = (axis: 'w' | 'h'): CellOpts => ({
    min: SIDE_MIN, max: SIDE_MAX, name: axis === 'w' ? t('Width') : t('Height'),
    onCommit: (v) => commitSide(c, locks, axis, v * c.scale),
  });
  const size = `<div class="fc-dims-row fc-dims-row--size"><span class="fc-dims-ic" data-tip="${escapeHtml(t('Size'))}">${icon('resize')}</span>`
    + c.dimCell(t('W'), c.cfg.wField, clampSide(c.w), side('w')) + lock
    + c.dimCell(t('H'), c.cfg.hField, clampSide(c.h), side('h')) + '</div>';
  if (!c.scaleSelection) return size;
  const scale = c.scaleSelection;
  // A fresh 100 each time: the number is the factor to apply next, not a stored value.
  return size + `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escapeHtml(t('Scale the selection'))}">${icon('resize')}</span>`
    + c.numCell('', undefined, 100, {
      name: t('Scale (%)'), unit: '%', min: 1, max: 10000, step: 1, precision: 1,
      onCommit: (pct) => { if (!scale(pct / 100)) c.resync(); },
    }) + '</div>';
}

/** One delegated click for every lock button the column draws; call once at mount. */
export function wireAspectLocks(root: HTMLElement, locks: AspectLocks): () => void {
  const onClick = (ev: Event): void => {
    const btn = (ev.target as Element | null)?.closest<HTMLButtonElement>('[data-aspect-lock]');
    if (!btn || !root.contains(btn)) return;
    const pressed = locks.toggle(btn.dataset.aspectLock ?? '');
    btn.setAttribute('aria-pressed', String(pressed));
    const glyph = iconNode(pressed ? 'link' : 'unlink');
    if (glyph) btn.replaceChildren(glyph);
  };
  root.addEventListener('click', onClick);
  return () => root.removeEventListener('click', onClick);
}
