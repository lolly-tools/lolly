// SPDX-License-Identifier: MPL-2.0
/**
 * IDML tables as grouped Design frames: one text frame per cell carrying its text, fill and
 * borders, placed on the table grid. Design has no table, so a table stays a set of frames
 * that move together, and the report says so.
 */
import type { IdmlNode } from './idml-read.ts';
import { buildText, type TextEnv } from './idml-text.ts';
import { numericAttr, ownProps, tally } from './idml-styles.ts';

export const MAX_CELLS_PER_TABLE = 5000;
export const MAX_CELLS_PER_DOCUMENT = 20000;
const MAX_TRACKS = 512;
const EDGES = ['Top', 'Left', 'Bottom', 'Right'] as const;

function direct(el: Element, name: string): Element[] { return Array.from(el.children).filter(c => c.localName === name); }

export interface TableBudget { cells: number }

/**
 * Nodes for one table placed with its top-left corner at (x, y). Returns the nodes and the
 * table's height so a following table in the same story can start below the first.
 */
export function tableNodes(table: Element, at: { x: number; y: number; group: string }, env: TextEnv, budget: TableBudget): { nodes: IdmlNode[]; height: number } {
  const { book, stats } = env;
  const cols = direct(table, 'Column').map(c => numericAttr(c.getAttribute('SingleColumnWidth'), 0, 20000) ?? 0);
  const rows = direct(table, 'Row').map(r => numericAttr(r.getAttribute('SingleRowHeight'), 0, 20000) ?? numericAttr(r.getAttribute('MinimumHeight'), 0, 20000) ?? 0);
  const cells = direct(table, 'Cell');
  if (!cols.length || !rows.length || cols.length > MAX_TRACKS || rows.length > MAX_TRACKS) { tally(stats, 'table.skipped', 'dropped'); return { nodes: [], height: 0 }; }
  budget.cells += cells.length;
  if (cells.length > MAX_CELLS_PER_TABLE || budget.cells > MAX_CELLS_PER_DOCUMENT) { tally(stats, 'table.skipped', 'dropped'); return { nodes: [], height: 0 }; }
  const xs = [0], ys = [0];
  for (const w of cols) xs.push(xs.at(-1)! + w);
  for (const h of rows) ys.push(ys.at(-1)! + h);
  const style = table.getAttribute('AppliedTableStyle') || '';
  if (style && !/\[(?:Basic Table|No table style)\]/.test(style)) tally(stats, 'table.styles', 'dropped');
  tally(stats, 'table.layout', 'approximated');

  const nodes: IdmlNode[] = [];
  for (const cell of cells) {
    const [c, r] = (cell.getAttribute('Name') || '').split(':').map(Number);
    if (!Number.isInteger(c) || !Number.isInteger(r) || c! < 0 || r! < 0 || c! >= cols.length || r! >= rows.length) { tally(stats, 'table.skipped', 'dropped'); continue; }
    const cs = Math.max(1, Math.min(cols.length - c!, numericAttr(cell.getAttribute('ColumnSpan'), 1, MAX_TRACKS) ?? 1));
    const rs = Math.max(1, Math.min(rows.length - r!, numericAttr(cell.getAttribute('RowSpan'), 1, MAX_TRACKS) ?? 1));
    if (cs > 1 || rs > 1) tally(stats, 'table.spans', 'approximated');
    const w = xs[c! + cs]! - xs[c!]!, h = ys[r! + rs]! - ys[r!]!;
    if (w < 1 || h < 1) continue;
    const a = { ...book.resolve('cell', cell.getAttribute('AppliedCellStyle')), ...ownProps(cell, 'cell') };
    const fill = env.colour(a.FillColor, numericAttr(a.FillTint, 0, 100));
    const widths = EDGES.map(e => numericAttr(a[`${e}EdgeStrokeWeight`], 0, 200) ?? 0);
    const colours = EDGES.map((e, i) => widths[i]! > 0 ? env.colour(a[`${e}EdgeStrokeColor`], numericAttr(a[`${e}EdgeStrokeTint`], 0, 100)) : '');
    const ink = colours.find(Boolean) || '';
    const insets = (['Top', 'Left', 'Bottom', 'Right'] as const).map(e => numericAttr(a[`${e}Inset`], 0, 400) ?? 0);
    const node: IdmlNode = { kind: 'box', x: at.x + xs[c!]!, y: at.y + ys[r!]!, w, h, rot: 0, group: at.group, fill };
    if (ink) {
      node.stroke = ink; node.strokeW = Math.max(...widths); node.strokeAlign = 'inside';
      if (new Set(widths).size > 1) [node.strokeTop, node.strokeLeft, node.strokeBottom, node.strokeRight] = widths as [number, number, number, number];
      if (new Set(colours.filter(Boolean)).size > 1) tally(stats, 'table.border-colours', 'approximated');
    }
    const story = buildText(cell, env);
    if (story.text.trim()) {
      Object.assign(node, {
        kind: 'text', text: story.text, fg: story.fg || '#000000', fontSize: story.fontSize || 12,
        fontFamily: story.font || '', fontWeight: story.weight || 400, textAlign: story.align || 'left',
        pad: Math.round(insets.reduce((s, v) => s + v, 0) / 4),
        ...(story.lineHeight ? { lineHeight: story.lineHeight } : {}), ...(story.tracking ? { tracking: story.tracking } : {}),
      });
    }
    nodes.push(node);
    tally(stats, 'table.cells', 'mapped');
  }
  return { nodes, height: ys.at(-1)! };
}
