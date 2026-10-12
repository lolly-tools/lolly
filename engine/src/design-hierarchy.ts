// SPDX-License-Identifier: MPL-2.0
/** Document ownership is independent of geometry and the active editor canvas. */
import { cos, sin } from './geom/portable-math.ts';

export class DesignHierarchyError extends Error {}
export type DesignHierarchyRow = Record<string, unknown>;
export interface DesignPage extends DesignHierarchyRow { id: string; name: string; order?: number }
export interface DesignHierarchyFinding { id: string; code: string; message: string }
export interface DesignHierarchyIndex {
  byId: Map<string, DesignHierarchyRow>;
  children: Map<string, string[]>;
  parent: Map<string, string>;
  pageById: Map<string, string>;
  pages: DesignPage[];
  rootsByPage: Map<string, string[]>;
  findings: DesignHierarchyFinding[];
  flags: Map<string, { hidden: boolean; locked: boolean }>;
  rowsByPage: Map<string, DesignHierarchyRow[]>;
}
export const DEFAULT_DESIGN_PAGE = 'page-1';
export const DESIGN_HIERARCHY_LIMITS = Object.freeze({ layers: 20000, pages: 256, depth: 64, id: 160, name: 1000, scalar: 1e7 });
const emptyPages: readonly DesignHierarchyRow[] = Object.freeze([]);
const cache = new WeakMap<readonly DesignHierarchyRow[], WeakMap<readonly unknown[], DesignHierarchyIndex>>();
const migrationCache = new WeakMap<readonly DesignHierarchyRow[], WeakMap<readonly unknown[], { boxes: DesignHierarchyRow[]; pages: DesignPage[]; findings: DesignHierarchyFinding[] }>>();
const key = (value: unknown): string => value == null ? '' : String(value);
const on = (value: unknown): boolean => value === true || value === 'true' || value === 1 || value === '1';
const record = (value: unknown): value is DesignHierarchyRow => !!value && typeof value === 'object' && !Array.isArray(value);
const validId = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= DESIGN_HIERARCHY_LIMITS.id;
const number = (value: unknown): number => { const n = Number(value); return Number.isFinite(n) ? n : 0; };

/** Missing metadata denotes the original single canvas, with a stable identity. */
export function resolveDesignPages(pages: readonly unknown[] = emptyPages): DesignPage[] {
  if (!Array.isArray(pages) || !pages.length) return [{ id: DEFAULT_DESIGN_PAGE, name: 'Page 1' }];
  const resolved = pages.slice(0, DESIGN_HIERARCHY_LIMITS.pages).filter(record).map((page, n) => ({
    id: key(page.id), name: typeof page.name === 'string' ? page.name : `Page ${n + 1}`,
    ...(Number.isFinite(Number(page.order)) && page.order !== '' && page.order != null ? { order: Number(page.order) } : {}),
  }));
  return resolved.length ? resolved : [{ id: DEFAULT_DESIGN_PAGE, name: 'Page 1' }];
}

/** Arrays are model revisions: repeated pointer queries reuse all ownership indexes. */
export function designHierarchyIndex(boxes: readonly DesignHierarchyRow[], pages: readonly unknown[] = emptyPages): DesignHierarchyIndex {
  const saved = cache.get(boxes)?.get(pages);
  if (saved) return saved;
  const result: DesignHierarchyIndex = { byId: new Map(), children: new Map(), parent: new Map(), pageById: new Map(), pages: resolveDesignPages(pages), rootsByPage: new Map(), findings: [], flags: new Map(), rowsByPage: new Map() };
  const add = (id: string, code: string, message: string) => { if (result.findings.length < 256) result.findings.push({ id, code: `hierarchy.${code}`, message }); };
  if (!Array.isArray(boxes) || !Array.isArray(pages) || boxes.length > DESIGN_HIERARCHY_LIMITS.layers || pages.length > DESIGN_HIERARCHY_LIMITS.pages) {
    add('', 'limit', 'A document supports up to 20,000 layers and 256 pages.');
    return result;
  }
  const pageIds = new Set<string>();
  for (const page of result.pages) {
    if (!validId(page.id) || pageIds.has(page.id)) add(page.id, 'page-identity', 'Pages require unique permanent IDs of at most 160 characters.');
    if (page.name.length > DESIGN_HIERARCHY_LIMITS.name) add(page.id, 'page-name', 'Page names support at most 1,000 characters.');
    pageIds.add(page.id);
    result.rootsByPage.set(page.id, []);
    result.rowsByPage.set(page.id, []);
  }
  if (pages.some(page => !record(page))) add('', 'page-record', 'Pages must be records.');
  for (const row of boxes) {
    if (!record(row)) { add('', 'record', 'Layers must be records.'); continue; }
    const id = key(row.id);
    if (!validId(row.id) || result.byId.has(id)) add(id, 'identity', 'Layers require unique permanent IDs of at most 160 characters.');
    for (const field of ['x', 'y', 'w', 'h', 'rot']) if (row[field] != null && row[field] !== '' && (!Number.isFinite(Number(row[field])) || Math.abs(Number(row[field])) > DESIGN_HIERARCHY_LIMITS.scalar)) add(id, 'number', 'Layer geometry must be finite and at most 10,000,000 in magnitude.');
    if (typeof row.name === 'string' && row.name.length > DESIGN_HIERARCHY_LIMITS.name) add(id, 'name', 'Layer names support at most 1,000 characters.');
    result.byId.set(id, row);
  }
  const hasGroups = [...result.byId.values()].some(row => row.kind === 'group');
  for (const [id, row] of result.byId) {
    const group = key(row.group), layout = key(row.layoutOwner), frame = key(row.frame);
    if (group && hasGroups && result.byId.get(group)?.kind !== 'group') add(id, 'group-missing', 'The owning group is missing.');
    if (group && result.byId.get(group)?.kind === 'group' && layout) add(id, 'owner-conflict', 'A grouped layer cannot also have a layout owner.');
    const owner = group && result.byId.get(group)?.kind === 'group' ? group : layout || frame;
    if (owner && !result.byId.has(owner)) { add(id, 'owner-missing', 'The owning layer is missing.'); continue; }
    if (owner) {
      result.parent.set(id, owner);
      const children = result.children.get(owner) || [];
      children.push(id); result.children.set(owner, children);
    }
  }
  for (const [id, row] of result.byId) {
    const seen = new Set<string>([id]), chain = [id];
    let owner = result.parent.get(id);
    while (owner) {
      if (seen.has(owner)) { add(id, 'cycle', 'Layer ownership contains a cycle.'); break; }
      if (chain.length > DESIGN_HIERARCHY_LIMITS.depth) { add(id, 'depth', 'Layer ownership supports up to 64 ancestors.'); break; }
      seen.add(owner); chain.push(owner); owner = result.parent.get(owner);
    }
    let page = '', hidden = false, locked = false;
    for (const ancestor of chain) {
      const r = result.byId.get(ancestor)!;
      hidden ||= on(r.hidden); locked ||= on(r.locked);
      const declared = key(r.pageId);
      if (declared) {
        if (!pageIds.has(declared)) add(id, 'page-missing', 'The owning page is missing.');
        if (page && page !== declared) add(id, 'page-conflict', 'A layer and its ancestors must belong to one page.');
        page = declared;
      }
    }
    page ||= result.pages[0]!.id;
    result.pageById.set(id, page); result.flags.set(id, { hidden, locked });
    result.rowsByPage.get(page)?.push(row);
    if (!result.parent.has(id)) result.rootsByPage.get(page)?.push(id);
  }
  // A group appended by migration keeps the stack slot of its top member.
  const positions = new Map(boxes.map((row, n) => [key(row.id), n]));
  const stackPosition = (id: string): number => {
    const own = positions.get(id) ?? 0, children = result.children.get(id);
    return result.byId.get(id)?.kind === 'group' && children?.length ? Math.min(own, Math.max(...children.map(child => positions.get(child) ?? 0))) : own;
  };
  for (const siblings of [...result.children.values(), ...result.rootsByPage.values()]) siblings.sort((a,b) => stackPosition(a)-stackPosition(b));
  let revisions = cache.get(boxes);
  if (!revisions) { revisions = new WeakMap(); cache.set(boxes, revisions); }
  revisions.set(pages, result);
  return result;
}
export function validateDesignHierarchy(boxes: readonly DesignHierarchyRow[], pages: readonly unknown[] = emptyPages): DesignHierarchyFinding[] {
  return designHierarchyIndex(boxes, pages).findings;
}
export function designHierarchyPageBoxes(index: DesignHierarchyIndex, pageId: string): DesignHierarchyRow[] {
  return index.rowsByPage.get(pageId) || [];
}
export function designHierarchyAncestors(index: DesignHierarchyIndex, id: string): string[] {
  const result: string[] = [], seen = new Set([id]);
  let owner = index.parent.get(id);
  while (owner && !seen.has(owner) && result.length < DESIGN_HIERARCHY_LIMITS.depth) {
    seen.add(owner); result.push(owner); owner = index.parent.get(owner);
  }
  return result;
}
export function designHierarchyDescendants(index: DesignHierarchyIndex, selected: ReadonlySet<string>): Set<string> {
  const result = new Set(selected), pending = [...selected];
  for (let n = 0; n < pending.length; n++) for (const id of index.children.get(pending[n]!) || []) {
    if (!result.has(id)) { result.add(id); pending.push(id); }
  }
  return result;
}
export function designHierarchyFlags(index: DesignHierarchyIndex, id: string): { hidden: boolean; locked: boolean } {
  return index.flags.get(id) || { hidden: false, locked: false };
}
/** Bounds include the actual rotated geometry; group rows preserve authored transforms. */
export function designHierarchyBounds(index: DesignHierarchyIndex, ids: Iterable<string>): { x: number; y: number; w: number; h: number } | null {
  let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
  for (const id of ids) {
    const row = index.byId.get(id); if (!row) continue;
    const w = Math.max(0, number(row.w)), h = Math.max(0, number(row.h)), angle = number(row.rot) * Math.PI / 180;
    const cx = number(row.x) + w / 2, cy = number(row.y) + h / 2;
    const ex = Math.abs(cos(angle)) * w / 2 + Math.abs(sin(angle)) * h / 2, ey = Math.abs(sin(angle)) * w / 2 + Math.abs(cos(angle)) * h / 2;
    left = Math.min(left, cx - ex); right = Math.max(right, cx + ex); top = Math.min(top, cy - ey); bottom = Math.max(bottom, cy + ey);
  }
  return left === Infinity ? null : { x: left, y: top, w: right - left, h: bottom - top };
}

/** Old anonymous tags become explicit containers once, without moving their artwork. */
export function migrateDesignHierarchy(boxes: readonly DesignHierarchyRow[], pages: readonly unknown[] = emptyPages): { boxes: DesignHierarchyRow[]; pages: DesignPage[]; findings: DesignHierarchyFinding[] } {
  const saved = migrationCache.get(boxes)?.get(pages); if (saved) return saved;
  const index = designHierarchyIndex(boxes, pages);
  if (boxes.length > DESIGN_HIERARCHY_LIMITS.layers) throw new DesignHierarchyError('The document exceeds the layer limit.');
  const tags = new Map<string, DesignHierarchyRow[]>();
  for (const row of boxes) {
    const tag = key(row.group);
    if (tag && index.byId.get(tag)?.kind !== 'group') { const list = tags.get(tag) || []; list.push(row); tags.set(tag, list); }
  }
  const siblingDomains = new Map<string, Map<string, number>>();
  for (const row of boxes) if (row.kind !== 'frame') {
    const domain = JSON.stringify([index.pageById.get(key(row.id)), index.parent.get(key(row.id)) || '']);
    const positions = siblingDomains.get(domain) || new Map<string, number>();
    positions.set(key(row.id), positions.size); siblingDomains.set(domain, positions);
  }
  const replacements = new Map<string, string>(), groups: DesignHierarchyRow[] = [], findings: DesignHierarchyFinding[] = [];
  const used = new Set(index.byId.keys());
  for (const [tag, members] of tags) {
    const pageSet = new Set(members.map(row => index.pageById.get(key(row.id))));
    const frameSet = new Set(members.map(row => key(row.frame)));
    const ownerSet = new Set(members.map(row => index.parent.get(key(row.id)) || ''));
    const domain = siblingDomains.get(JSON.stringify([[...pageSet][0], [...ownerSet][0]]));
    const slots = members.map(row => domain?.get(key(row.id)) ?? -1).filter(n => n >= 0);
    const interleaved = slots.length > 0 && slots[slots.length-1]! - slots[0]! + 1 !== slots.length;
    if (pageSet.size > 1 || frameSet.size > 1 || ownerSet.size > 1 || interleaved || members.some(row => key(row.layoutOwner))) {
      if (findings.length < 256) findings.push({id:tag,code:'hierarchy.legacy-group-scope',message:'An old group spans owning containers, contains layout items or interleaves other artwork. Its original membership and clipping are preserved; ungroup those layers before converting.'});
      continue;
    }
    let id = tag;
    if (!validId(id) || used.has(id)) { let n = groups.length + 1; do { id = `legacy-group-${n++}`; } while (used.has(id)); }
    used.add(id); replacements.set(tag, id);
    const bounds = designHierarchyBounds(index, members.map(row => key(row.id))) || { x: 0, y: 0, w: 0, h: 0 };
    if (Object.values(bounds).some(value => !Number.isFinite(value) || Math.abs(value) > DESIGN_HIERARCHY_LIMITS.scalar)) throw new DesignHierarchyError('The group bounds exceed the geometry limit.');
    groups.push({ id, kind: 'group', name: 'Group', ...bounds, rot: 0, group: '', pageId: [...pageSet][0] || index.pages[0]!.id, frame: [...frameSet][0] || '' });
  }
  // Conversion is atomic: an unsafe old tag cannot acquire real-group siblings.
  if (findings.length) {
    const result = { boxes: boxes as DesignHierarchyRow[], pages: index.pages, findings };
    let revisions = migrationCache.get(boxes); if (!revisions) { revisions = new WeakMap(); migrationCache.set(boxes, revisions); } revisions.set(pages, result);
    return result;
  }
  if (boxes.length + groups.length > DESIGN_HIERARCHY_LIMITS.layers) throw new DesignHierarchyError('Converting groups exceeds the layer limit.');
  const next = replacements.size ? boxes.map(row => replacements.has(key(row.group)) ? { ...row, group: replacements.get(key(row.group)), frame: '', layoutOwner: '' } : row) : boxes as DesignHierarchyRow[];
  const result = { boxes: groups.length ? [...next, ...groups] : next, pages: index.pages, findings };
  let revisions = migrationCache.get(boxes); if (!revisions) { revisions = new WeakMap(); migrationCache.set(boxes, revisions); } revisions.set(pages, result);
  return result;
}

/** Ownership edits never change document-global coordinates. */
export function reparentDesignHierarchy(boxes: readonly DesignHierarchyRow[], ids: ReadonlySet<string>, parentId: string, pageId?: string, pages: readonly unknown[] = emptyPages): DesignHierarchyRow[] {
  const index = designHierarchyIndex(boxes, pages), parent = index.byId.get(parentId);
  if (parentId && (!parent || !['group', 'frame'].includes(key(parent.kind)) && parent.layout !== 'flex' && parent.layout !== 'grid')) throw new DesignHierarchyError('Choose a group, artboard or layout container.');
  const scope = designHierarchyDescendants(index, ids);
  if (scope.has(parentId)) throw new DesignHierarchyError('A layer cannot be moved into its own subtree.');
  const targetPage = pageId || (parentId ? index.pageById.get(parentId) : undefined);
  if (targetPage && !index.pages.some(page => page.id === targetPage)) throw new DesignHierarchyError('Choose an existing page.');
  const result = boxes.map(row => {
    const id = key(row.id); if (!scope.has(id)) return row;
    const next: DesignHierarchyRow = { ...row, ...(targetPage ? { pageId: targetPage } : {}) };
    if (ids.has(id) && !designHierarchyAncestors(index, id).some(ancestor => ids.has(ancestor))) {
      next.group = parent?.kind === 'group' ? parentId : '';
      next.layoutOwner = parent && (parent.layout === 'flex' || parent.layout === 'grid') ? parentId : '';
      next.frame = parent?.kind === 'frame' && !next.layoutOwner ? parentId : '';
    }
    return next;
  });
  const findings = validateDesignHierarchy(result, pages); if (findings.length) throw new DesignHierarchyError(findings[0]!.message);
  return result;
}
export function remapDesignHierarchy(boxes: readonly DesignHierarchyRow[], copies: ReadonlyMap<string, string>): DesignHierarchyRow[] {
  return boxes.map(row => {
    const next = { ...row };
    for (const field of ['id', 'group', 'frame', 'layoutOwner', 'pageId']) if (copies.has(key(row[field]))) next[field] = copies.get(key(row[field]));
    return next;
  });
}
/** Refit containers after committed child edits in each group's own rotated axes. */
export function refreshDesignGroupBounds(boxes: readonly DesignHierarchyRow[], pages: readonly unknown[] = emptyPages, groupIds?: ReadonlySet<string>): DesignHierarchyRow[] {
  const index = designHierarchyIndex(boxes, pages), changed = new Map<string, DesignHierarchyRow>();
  for (const [id, group] of index.byId) {
    if (group.kind !== 'group' || groupIds && !groupIds.has(id)) continue;
    const angle = number(group.rot) * Math.PI / 180, c = cos(angle), s = sin(angle);
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const childId of designHierarchyDescendants(index, new Set([id]))) {
      const child = index.byId.get(childId)!; if (childId === id || child.kind === 'group') continue;
      const w = Math.max(0, number(child.w)), h = Math.max(0, number(child.h));
      const a = number(child.rot) * Math.PI / 180, cc = cos(a), ss = sin(a);
      const cx = number(child.x) + w / 2, cy = number(child.y) + h / 2;
      for (const [dx, dy] of [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]]) {
        const x = cx + dx! * cc - dy! * ss, y = cy + dx! * ss + dy! * cc;
        const u = x * c + y * s, v = -x * s + y * c;
        left = Math.min(left, u); right = Math.max(right, u); top = Math.min(top, v); bottom = Math.max(bottom, v);
      }
    }
    if (left === Infinity) continue;
    const u = (left + right) / 2, v = (top + bottom) / 2, w = right - left, h = bottom - top;
    const x = u * c - v * s - w / 2, y = u * s + v * c - h / 2;
    if ([x, y, w, h].some(value => !Number.isFinite(value) || Math.abs(value) > DESIGN_HIERARCHY_LIMITS.scalar)) throw new DesignHierarchyError('The group bounds exceed the geometry limit.');
    if (['x', 'y', 'w', 'h'].some((field, n) => Math.abs(number(group[field]) - [x, y, w, h][n]!) > 1e-8)) changed.set(id, { ...group, x, y, w, h });
  }
  return changed.size ? boxes.map(row => changed.get(key(row.id)) || row) : boxes as DesignHierarchyRow[];
}
