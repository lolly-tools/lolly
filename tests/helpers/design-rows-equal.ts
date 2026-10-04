// SPDX-License-Identifier: MPL-2.0
/**
 * "The same Design document" for authoring tests (plan 291 W5). Byte identity is the
 * wrong bar: a path's frame and codec string can differ while it draws the same
 * curve, and an artboard may sit anywhere on the canvas. Two row lists are equal here
 * when:
 *
 *   - they hold the same ids, the artboards carry the same `order` and page in the
 *     same order, and each artboard paints its layers in the same sequence;
 *   - every layer sits at the same artboard-local x, y, w and h within 0.011 px
 *     (artboard canvas x and y are free);
 *   - every path draws the same nodes and handles, decoded and compared in
 *     artboard-local px within 0.05 px, with the same contour count, kind and
 *     closure (its stored box and codec string are not compared);
 *   - every other field has the same value: weights compare as strings, hex colours
 *     ignore case, and a pill or circle box equals a rounded one with radius
 *     min(w, h) / 2;
 *   - the actual rows add no field the expected rows lack (unless `allowExtra` names
 *     it) and leave none out, and carry no `z` at all (z is depth, not stacking).
 *
 * `media` maps an expected image value (a placeholder such as `photo:title`) to the
 * user media id the actual rows carry, for a packaged copy.
 */
import assert from 'node:assert/strict';
import { decodeAuthoredPaths } from '../../engine/src/geom/authored-url.ts';

type Row = Record<string, unknown>;

export interface DesignRowsEqualOptions {
  /** Compare only these artboards and their layers. */
  frames?: readonly string[];
  /** Expected image value to the `user/media/<sha>` id the actual rows carry. */
  media?: ReadonlyMap<string, string> | Readonly<Record<string, string>>;
  /** Fields the actual rows may add. */
  allowExtra?: readonly string[];
  /** Geometry tolerance in px (default 0.011). */
  tolerance?: number;
  /** Path node tolerance in px (default 0.05). */
  pathTolerance?: number;
}

const GEOM = new Set(['x', 'y', 'w', 'h']);
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));
const isHex = (v: unknown): v is string => typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v);

function normalise(key: string, value: unknown): unknown {
  if (value == null) return value;
  if (key === 'weight') return String(value);
  if (isHex(value)) return value.toLowerCase();
  return value;
}

function shapeOf(row: Row): { shape: unknown; radius: number } {
  if (row.kind === 'box' && (row.shape === 'pill' || row.shape === 'circle'))
    return { shape: 'rounded', radius: Math.min(num(row.w), num(row.h)) / 2 };
  return { shape: row.shape, radius: row.radius === undefined ? 0 : num(row.radius) };
}

/** Each contour's nodes as [x, y, hInX, hInY, hOutX, hOutY] in px, relative to `origin`. */
function pathNodes(row: Row, origin: { x: number; y: number }): Array<{ kind: string; closed: boolean; nodes: number[][] }> | null {
  const paths = decodeAuthoredPaths(String(row.path ?? ''));
  if (!paths) return null;
  const x = num(row.x) - origin.x, y = num(row.y) - origin.y, w = num(row.w), h = num(row.h);
  return paths.map((p) => ({
    kind: p.kind,
    closed: !!p.closed,
    nodes: p.nodes.map((n) => [
      x + n.x * w, y + n.y * h,
      (n.hInX ?? 0) * w, (n.hInY ?? 0) * h, (n.hOutX ?? 0) * w, (n.hOutY ?? 0) * h,
    ]),
  }));
}

/** Every difference between the two row lists, as sentences; empty when they are equal. */
export function designRowsProblems(expected: readonly unknown[], actual: readonly unknown[], opts: DesignRowsEqualOptions = {}): string[] {
  const tol = opts.tolerance ?? 0.011;
  const pathTol = opts.pathTolerance ?? 0.05;
  const allowExtra = new Set(opts.allowExtra ?? []);
  const media = opts.media instanceof Map ? opts.media : new Map(Object.entries(opts.media ?? {}));
  const keep = (rows: readonly unknown[]): Row[] => rows.filter((r): r is Row => !!r && typeof r === 'object' && !Array.isArray(r))
    .filter((r) => !opts.frames || opts.frames.includes(String(r.kind === 'frame' ? r.id : r.frame)));
  const E = keep(expected), A = keep(actual);
  const problems: string[] = [];
  const byId = (rows: Row[], label: string): Map<unknown, Row> => {
    const map = new Map<unknown, Row>();
    for (const r of rows) {
      if (map.has(r.id)) problems.push(`${label}: id ${String(r.id)} appears twice`);
      map.set(r.id, r);
    }
    return map;
  };
  const eById = byId(E, 'expected'), aById = byId(A, 'actual');
  for (const id of eById.keys()) if (!aById.has(id)) problems.push(`missing ${String(id)}`);
  for (const id of aById.keys()) if (!eById.has(id)) problems.push(`extra ${String(id)}`);

  const children = (rows: Row[], frame: unknown): string => rows.filter((r) => r.kind !== 'frame' && r.frame === frame).map((r) => String(r.id)).join(' ');
  for (const f of E.filter((r) => r.kind === 'frame')) {
    if (children(E, f.id) !== children(A, f.id)) problems.push(`${String(f.id)}: its layers paint in a different order`);
  }
  const pages = (rows: Row[]): string => rows.filter((r) => r.kind === 'frame')
    .sort((p, q) => num(p.order) - num(q.order) || num(p.x) - num(q.x)).map((r) => String(r.id)).join(' ');
  if (pages(E) !== pages(A)) problems.push('the artboards page in a different order');

  const originOf = (byIdMap: Map<unknown, Row>, row: Row): { x: number; y: number } => {
    const f = row.kind === 'frame' ? undefined : byIdMap.get(row.frame);
    return f ? { x: num(f.x), y: num(f.y) } : { x: 0, y: 0 };
  };
  for (const [id, e] of eById) {
    const a = aById.get(id);
    if (!a) continue;
    const label = String(id);
    const eo = originOf(eById, e), ao = originOf(aById, a);
    if ('z' in a) problems.push(`${label}: z written (it is depth, not stacking)`);
    for (const key of new Set([...Object.keys(e), ...Object.keys(a)])) {
      if (key === 'id' || key === 'z') continue;
      if (e.kind === 'frame' && (key === 'x' || key === 'y')) continue;
      if (e.kind === 'path' && (GEOM.has(key) || key === 'path')) continue;
      // A circle or pill is a rounded box with half its short side as the radius.
      if (e.kind === 'box' && (key === 'shape' || key === 'radius')) {
        const se = shapeOf(e), sa = shapeOf(a);
        if (se.shape !== sa.shape || Math.abs(se.radius - sa.radius) > tol) problems.push(`${label}: ${key} ${JSON.stringify(se)} vs ${JSON.stringify(sa)}`);
        continue;
      }
      if (!(key in e)) {
        if (!allowExtra.has(key)) problems.push(`${label}: extra field ${key}=${JSON.stringify(a[key])}`);
        continue;
      }
      if (!(key in a)) {
        problems.push(`${label}: missing field ${key}`);
        continue;
      }
      if (GEOM.has(key)) {
        const local = (r: Row, o: { x: number; y: number }): number => num(r[key]) - (key === 'x' ? o.x : key === 'y' ? o.y : 0);
        const d = Math.abs(local(e, eo) - local(a, ao));
        if (!(d <= tol)) problems.push(`${label}: ${key} ${local(e, eo)} vs ${local(a, ao)}`);
        continue;
      }
      let ev = normalise(key, e[key]);
      const av = normalise(key, a[key]);
      if (key === 'image' && typeof ev === 'string' && media.has(ev)) ev = { id: media.get(ev), source: 'user' };
      if (JSON.stringify(ev) !== JSON.stringify(av)) problems.push(`${label}: ${key} ${JSON.stringify(ev)?.slice(0, 80)} vs ${JSON.stringify(av)?.slice(0, 80)}`);
    }
    if (e.kind === 'path') {
      const pe = pathNodes(e, eo), pa = pathNodes(a, ao);
      if (!pe || !pa) {
        problems.push(`${label}: path does not decode`);
        continue;
      }
      if (pe.length !== pa.length) {
        problems.push(`${label}: ${pe.length} vs ${pa.length} contours`);
        continue;
      }
      pe.forEach((c, i) => {
        const d = pa[i]!;
        if (c.kind !== d.kind || c.closed !== d.closed || c.nodes.length !== d.nodes.length) {
          problems.push(`${label}: contour ${i} kind, closure or node count differs`);
          return;
        }
        c.nodes.forEach((n, j) => {
          n.forEach((v, q) => {
            const w = d.nodes[j]![q]!;
            if (!(Math.abs(v - w) <= pathTol)) problems.push(`${label}: contour ${i} node ${j} value ${q}: ${v.toFixed(3)} vs ${w.toFixed(3)}`);
          });
        });
      });
    }
  }
  return problems;
}

/** Fails with the first problems when the row lists are not the same document. */
export function assertDesignRowsEqual(expected: readonly unknown[], actual: readonly unknown[], opts: DesignRowsEqualOptions = {}, message = 'rows differ'): void {
  const problems = designRowsProblems(expected, actual, opts);
  if (problems.length) assert.fail(`${message}: ${problems.length} problem${problems.length === 1 ? '' : 's'}\n  ${problems.slice(0, 25).join('\n  ')}`);
}
