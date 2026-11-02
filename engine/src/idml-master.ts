// SPDX-License-Identifier: MPL-2.0
/**
 * IDML master spreads: the items of an applied master are placed on each page, below the
 * page's own items, unless the page overrides them or hides master items.
 */
import { boxGeomFromBBox } from './design-map.ts';
import type { IdmlNode } from './idml-read.ts';
import { tally, type IdmlStats } from './idml-styles.ts';

export interface Rect { x: number; y: number; w: number; h: number }
export const MAX_MASTERS = 256;
const MAX_DEPTH = 8;

/** A page's rectangle in its spread, or null when its bounds are unreadable. */
export function pageRect(page: Element, transform: { a: number; b: number; c: number; d: number; e: number; f: number }): Rect | null {
  const bounds = (page.getAttribute('GeometricBounds') || '').split(/\s+/).map(Number);
  if (bounds.length !== 4 || bounds.some(n => !Number.isFinite(n))) return null;
  const g = boxGeomFromBBox({ x: bounds[1]!, y: bounds[0]!, width: bounds[3]! - bounds[1]!, height: bounds[2]! - bounds[0]! }, transform);
  return { x: g.x, y: g.y, w: g.w, h: g.h };
}

interface Master {
  pages: { rect: Rect; applied: string }[];
  /** Top-level items with the nodes they produced and the master item's own id. */
  items: { self: string; nodes: IdmlNode[]; centre: { x: number; y: number } }[];
}

export class MasterBook {
  private readonly masters = new Map<string, Master>();
  constructor(
    entries: { id: string; el: Element }[],
    pageRectOf: (page: Element) => Rect | null,
    walk: (item: Element) => IdmlNode[],
  ) {
    if (entries.length > MAX_MASTERS) throw new Error('IDML contains more than 256 master spreads.');
    for (const { id, el } of entries) {
      const pages = Array.from(el.children).filter(c => c.localName === 'Page').flatMap(page => {
        const rect = pageRectOf(page);
        return rect ? [{ rect, applied: page.getAttribute('AppliedMaster') || '' }] : [];
      });
      const items: Master['items'] = [];
      for (const child of Array.from(el.children)) {
        if (child.localName === 'Page') continue;
        const nodes = walk(child);
        if (!nodes.length) continue;
        const x0 = Math.min(...nodes.map(n => n.x)), y0 = Math.min(...nodes.map(n => n.y));
        const x1 = Math.max(...nodes.map(n => n.x + n.w)), y1 = Math.max(...nodes.map(n => n.y + n.h));
        items.push({ self: child.getAttribute('Self') || '', nodes, centre: { x: (x0 + x1) / 2, y: (y0 + y1) / 2 } });
      }
      this.masters.set(id, { pages, items });
    }
  }

  get size(): number { return this.masters.size; }

  has(id: string | null | undefined): boolean { return !!id && this.masters.has(id); }

  /** The master's nodes for one target page, parents first, with page positions applied. */
  place(id: string, target: Rect, overrides: ReadonlySet<string>, stats?: IdmlStats, depth = 0, seen: Set<string> = new Set()): IdmlNode[] {
    const master = this.masters.get(id);
    if (!master?.pages.length) return [];
    if (depth >= MAX_DEPTH || seen.has(id)) { tally(stats, 'master.nested', 'dropped'); return []; }
    seen.add(id);
    const page = master.pages.reduce((best, p) => Math.abs(p.rect.x - target.x) < Math.abs(best.rect.x - target.x) ? p : best);
    const dx = target.x - page.rect.x, dy = target.y - page.rect.y;
    const out: IdmlNode[] = page.applied && this.masters.has(page.applied) ? this.place(page.applied, target, overrides, stats, depth + 1, seen) : [];
    seen.delete(id);
    const r = page.rect;
    for (const item of master.items) {
      if (item.centre.x < r.x || item.centre.x > r.x + r.w || item.centre.y < r.y || item.centre.y > r.y + r.h) { tally(stats, 'master.pasteboard', 'dropped'); continue; }
      if (item.self && overrides.has(item.self)) { tally(stats, 'master.overridden', 'mapped'); continue; }
      for (const n of item.nodes) {
        if (n.empty) continue;
        out.push({ ...n, x: n.x + dx, y: n.y + dy, group: n.group ? `${id}:${depth}:${n.group}` : '' });
      }
      tally(stats, 'master.items', 'mapped');
    }
    return out;
  }
}
