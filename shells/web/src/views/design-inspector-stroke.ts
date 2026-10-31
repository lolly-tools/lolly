// SPDX-License-Identifier: MPL-2.0
/**
 * The Inspector's stroke width, its widths per side and its position.
 *
 * Kept outside `initDesignInspector`, which has a no-growth maintainability budget: the
 * column hands this module its own cell builders and a commit, and reads the rows back
 * as one string.
 *
 * The model is the Design renderer's (engine `design-stroke.ts`): `strokeW` is the width,
 * `strokeTop`, `strokeRight`, `strokeBottom` and `strokeLeft` override it per side on a
 * rectangle, rounded box, pill or board (empty uses the width, 0 hides the side), and
 * `strokeAlign` places the stroke inside, centred on or outside the outline.
 *
 * The behaviour follows Penpot's "stroke per side" (2.19): the per-side toggle only shows
 * or hides the four cells and never changes a value; while the sides differ the width
 * reads Mixed, and typing a width there sets all four sides by clearing them back to it;
 * editing one side writes all four, so the others keep the width they were drawn with,
 * and the main width becomes the widest side, which is what a reader that knows no sides
 * draws. Colour, style and position stay shared by all four sides.
 */
import { designStrokeAlign, designStrokeSides } from '@lolly/engine';
import { t } from '../i18n.ts';
import { escape as escapeHtml } from '../utils.ts';
import { FIELD_GLYPH, segHtml, svgIcon } from './free-canvas-fields.ts';
import type { Box, BoxFieldConfig } from './free-canvas-math.ts';
import type { ModelPort } from './design-ports.ts';
import type { InspectorKeys } from './design-inspector-keys.ts';

type CellOpts = { name?: string; unit?: string; min?: number; max?: number; onCommit?(v: number): void };
type Cell = (label: string, field: string | undefined, value: number | 'mixed', o?: CellOpts) => string;

/** The four per-side fields, top, right, bottom and left: the CSS `border-width` order. */
export const STROKE_SIDE_FIELDS = ['strokeTop', 'strokeRight', 'strokeBottom', 'strokeLeft'] as const;
/** The position field, spelled exactly as in the manifest. */
export const STROKE_ALIGN_FIELD = 'strokeAlign';
/** Every field these rows read, for the column's repaint memo. */
export const STROKE_PLACEMENT_FIELDS: readonly string[] = [STROKE_ALIGN_FIELD, ...STROKE_SIDE_FIELDS];

/** A glyph of four separate edges of different weights: the per-side toggle and its rows. */
const SIDES_GLYPH = '<path d="M5 4h14" stroke-width="3.2"/><path d="M20 7v10" stroke-width="1.2"/><path d="M5 20h14" stroke-width="1.2"/><path d="M4 7v10" stroke-width="3.2"/>';

export interface StrokeRowsCtx {
  /** The field the width is stored in (`strokeW`). */
  widthField: string;
  kindField: string;
  shapeField?: string;
  /** The column's number cell builder and its icon row. */
  numCell: Cell;
  ctrlRow(glyph: string, label: string, html: string): string;
  /** One commit across the selection: each row patched with the fields `patch` returns. */
  patchRows(patch: (b: Box) => Record<string, unknown>): void;
  /** Whether the four side cells are showing. */
  sidesOpen: boolean;
  /** Offer the position control: boxes and paths, but not a board, which always strokes inside its page. */
  position: boolean;
  /** The width's keyframe diamond and routing (plans/328); absent where there is no timeline. */
  keys?: InspectorKeys;
}

const sidesOf = (b: Box): number[] => designStrokeSides(b as Record<string, unknown>).map((v) => Math.max(0, v));
const round2 = (v: number): number => Math.round(v * 100) / 100;

/** Whether per-side widths apply to a row: a rectangle-like outline, not an ellipse, a circle or a pen path. */
export function strokeSidesApply(b: Box, kindField: string, shapeField = 'shape'): boolean {
  if (String(b[kindField] ?? '') === 'path') return false;
  const shape = String(b[shapeField] ?? '');
  return shape !== 'ellipse' && shape !== 'circle';
}

/** Whether a row's four sides differ from one another. */
export function strokeSidesDiffer(b: Box): boolean {
  const s = sidesOf(b);
  return !(s[0] === s[1] && s[0] === s[2] && s[0] === s[3]);
}

/** The width row, the per-side rows when open, and the position row. */
export function strokeRows(c: StrokeRowsCtx, rows: Box[]): string {
  const sidesAllowed = rows.length > 0 && rows.every((b) => strokeSidesApply(b, c.kindField, c.shapeField));
  // One width, or Mixed: across the selection, or across one row's own four sides.
  const widths = rows.map((b) => { const s = sidesOf(b); return s.every((v) => v === s[0]) ? Math.round(c.keys?.num(b, 'lw', s[0]!) ?? s[0]!) : NaN; });
  const width: number | 'mixed' = widths.length && widths.every((v) => v === widths[0]) && Number.isFinite(widths[0]!) ? widths[0]! : 'mixed';
  const label = t('Stroke per side');
  const toggle = sidesAllowed
    ? `<button type="button" class="fc-aspect-lock fc-stroke-sides" data-act="strokesides" aria-pressed="${c.sidesOpen}"`
      + ` aria-label="${escapeHtml(label)}" data-tip="${escapeHtml(label)}">${svgIcon(SIDES_GLYPH)}</button>`
    : '';
  // A width typed here sets every side: the sides go back to following the width.
  // An animated width writes its keyframe instead (plans/328), or is refused off one.
  const commitWidth = (v: number): void => c.keys?.routeProp('lw', v) ? undefined : c.patchRows((b) => {
    const out: Record<string, unknown> = { [c.widthField]: v };
    for (const f of STROKE_SIDE_FIELDS) if (String(b[f] ?? '').trim() !== '') out[f] = '';
    return out;
  });
  let html = c.ctrlRow(FIELD_GLYPH.strokeIc, t('Stroke width'),
    c.numCell('', c.widthField, width, { name: t('Stroke width'), min: 0, max: 400, unit: 'px', onCommit: commitWidth }) + toggle + (c.keys?.diamond('lw') ?? ''));
  if (sidesAllowed && c.sidesOpen) {
    const names = [t('Top'), t('Right'), t('Bottom'), t('Left')];
    const cell = (k: number): string => {
      const per = rows.map((b) => Math.round(sidesOf(b)[k]! * 100) / 100);
      const value: number | 'mixed' = per.every((v) => v === per[0]) ? per[0]! : 'mixed';
      return c.numCell(names[k]!, STROKE_SIDE_FIELDS[k], value, {
        name: names[k], min: 0, max: 400, unit: 'px',
        // One side changes; the other three are written as they are drawn, and the
        // width becomes the widest side.
        onCommit: (v) => c.patchRows((b) => {
          const s = sidesOf(b);
          s[k] = Math.min(400, Math.max(0, v));
          const out: Record<string, unknown> = { [c.widthField]: round2(Math.max(...s)) };
          STROKE_SIDE_FIELDS.forEach((f, i) => { out[f] = round2(s[i]!); });
          return out;
        }),
      });
    };
    const pair = (a: number, b: number): string => `<div class="fc-dims-row"><span class="fc-dims-ic" data-tip="${escapeHtml(label)}">${svgIcon(SIDES_GLYPH)}</span>${cell(a)}${cell(b)}</div>`;
    html += pair(0, 1) + pair(2, 3);
  }
  if (c.position) {
    const aligns = rows.map((b) => designStrokeAlign(b as Record<string, unknown>));
    const cur = aligns.every((a) => a === aligns[0]) ? aligns[0] ?? '' : '';
    const choices: Array<[string, string]> = [['inside', t('Inside')], ['center', t('Centre')], ['outside', t('Outside')]];
    html += c.ctrlRow(FIELD_GLYPH.strokeIc, t('Position'), segHtml(STROKE_ALIGN_FIELD, cur, choices, t('Position')));
  }
  return html;
}

/** What the column lends the stroke rows: its model, the ids it shows, and its cell builders. */
export interface StrokeRowsHost {
  model: Pick<ModelPort, 'getBoxes' | 'commit'>;
  cfg: BoxFieldConfig & { kindField?: string; shapeField?: string };
  ids(): readonly string[];
  idOf(b: Box, i: number): string;
  numCell: Cell;
  ctrlRow(glyph: string, label: string, html: string): string;
  keys?: InspectorKeys;
}

/**
 * The stroke rows with the toggle's state: the per-side cells start open for a selection
 * whose sides already differ, and the toggle then shows or hides them for that selection.
 */
export function createStrokeRows(host: StrokeRowsHost): { rows(widthField: string, rows: Box[], position: boolean): string; toggle(): void } {
  let open = false, openFor = '';
  const patchRows = (patch: (b: Box) => Record<string, unknown>): void => {
    const want = new Set(host.ids());
    host.model.commit(host.model.getBoxes().map((r, i) => (want.has(host.idOf(r, i)) ? { ...r, ...patch(r) } as Box : r)));
  };
  return {
    rows(widthField, rows, position) {
      const key = rows.map((r, i) => host.idOf(r, i)).join(',');
      if (key !== openFor) { openFor = key; open = rows.some(strokeSidesDiffer); }
      return strokeRows({ widthField, kindField: host.cfg.kindField ?? 'kind', shapeField: host.cfg.shapeField,
        numCell: host.numCell, ctrlRow: host.ctrlRow, patchRows, sidesOpen: open, position, ...(host.keys ? { keys: host.keys } : {}) }, rows);
    },
    toggle() { open = !open; },
  };
}
