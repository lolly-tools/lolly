// SPDX-License-Identifier: MPL-2.0
/**
 * Design layer edits by stable id (plans/289 D1): `layerOperations` (add, duplicate,
 * remove, reparent, reorder) and `layerPatches` (set fields on one layer). The MCP
 * server applies them to a render's inputs, and the live editor bridge applies them
 * to the open document, so an agent's edit means the same on both. Moved unchanged
 * from services/mcp/src/tools.ts. Pure: rows in, rows out.
 */

import { designHierarchyIndex, designHierarchyDescendants, type DesignHierarchyIndex } from './design-hierarchy.ts';

export type DesignRow = Record<string, unknown>;

/** A shallow copy of each row object, so the caller's rows are never changed. */
function copyRows(rows: readonly unknown[]): unknown[] {
  return rows.map((row) => (row && typeof row === 'object' && !Array.isArray(row) ? { ...(row as DesignRow) } : row));
}

function rowAt(rows: unknown[], id: unknown, path: string): { index: number; row: DesignRow } {
  if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}: a stable layer id is required.`);
  const matches = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => Boolean(row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).id === id));
  if (matches.length !== 1)
    throw new Error(`${path}: layer "${id}" ${matches.length ? 'is duplicated' : 'does not exist'}.`);
  return matches[0] as { index: number; row: DesignRow };
}

function anchorOf(record: DesignRow, path: string): { side: 'before' | 'after'; id: string } {
  const before = record.beforeId;
  const after = record.afterId;
  if (before !== undefined && (typeof before !== 'string' || !before.trim()))
    throw new Error(`${path}/beforeId: a stable layer id is required.`);
  if (after !== undefined && (typeof after !== 'string' || !after.trim()))
    throw new Error(`${path}/afterId: a stable layer id is required.`);
  if ((before === undefined) === (after === undefined))
    throw new Error(`${path}: provide exactly one of beforeId or afterId.`);
  return before !== undefined
    ? { side: 'before', id: before as string }
    : { side: 'after', id: after as string };
}

function optionalAnchorOf(
  record: DesignRow,
  path: string,
): { side: 'before' | 'after'; id: string } | null {
  if (record.beforeId === undefined && record.afterId === undefined) return null;
  return anchorOf(record, path);
}

function assertNewDesignId(rows: unknown[], value: unknown, path: string): string {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${path}: a new stable layer id is required.`);
  if (rows.some((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).id === value))
    throw new Error(`${path}: layer "${value}" already exists.`);
  return value;
}

function isRow(row: unknown): row is DesignRow { return !!row && typeof row === 'object' && !Array.isArray(row); }
function hierarchyOf(rows: readonly unknown[], pages?: readonly unknown[]): DesignHierarchyIndex {
  const records = rows.filter(isRow);
  const inferred = [...new Set(records.map(row => String(row.pageId || '')).filter(Boolean))].map(id => ({id,name:id}));
  return designHierarchyIndex(records, pages ?? inferred);
}
function sameReorderDomain(a: DesignRow, b: DesignRow, graph?: DesignHierarchyIndex): boolean {
  const aFrame = a.kind === 'frame', bFrame = b.kind === 'frame';
  if (aFrame !== bFrame) return false;
  const parent = (row: DesignRow) => graph?.parent.get(String(row.id)) || String(row.layoutOwner || row.frame || '');
  const page = (row: DesignRow) => graph?.pageById.get(String(row.id)) || String(row.pageId || '');
  return parent(a) === parent(b) && page(a) === page(b);
}
function subtreeRows(rows: readonly unknown[], id: string, pages?: readonly unknown[]): DesignRow[] {
  const scope = designHierarchyDescendants(hierarchyOf(rows, pages), new Set([id]));
  return rows.filter((row): row is DesignRow => isRow(row) && row.id !== id && scope.has(String(row.id)));
}
function remapLayerRow(row: DesignRow, copies: ReadonlyMap<string,string>): DesignRow {
  const next = {...row};
  for (const field of ['id','group','frame','layoutOwner','clip','mask','linkOf','matchOf','bindStart','bindEnd']) if (copies.has(String(row[field]))) next[field]=copies.get(String(row[field]));
  return next;
}

/** Move one row relative to a sibling and rewrite the renderer's actual order field:
 * `order` for artboards, `z` for layers in the same artboard/pasteboard. */
function reorderDesignRow(rows: unknown[], id: string, anchor: { side: 'before' | 'after'; id: string }, path: string, pages?: readonly unknown[]): void {
  const target = rowAt(rows, id, `${path}/id`);
  const relative = rowAt(rows, anchor.id, `${path}/${anchor.side}Id`);
  if (target.index === relative.index) throw new Error(`${path}: a layer cannot be reordered relative to itself.`);
  const graph = hierarchyOf(rows, pages);
  if (!sameReorderDomain(target.row, relative.row, graph))
    throw new Error(`${path}: reorder targets must be sibling layers or two artboards.`);

  const isFrame = target.row.kind === 'frame';
  const parent = graph.parent.get(String(target.row.id)) || '';
  const orderField = isFrame ? 'order' : graph.byId.get(parent)?.layout === 'flex' || graph.byId.get(parent)?.layout === 'grid' ? 'layoutOrder' : 'z';
  const domain = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      const r = row as DesignRow;
      return sameReorderDomain(target.row, r, graph);
    })
    .sort((a, b) => {
      const field = orderField;
      const av = typeof (a.row as DesignRow)[field] === 'number' ? (a.row as DesignRow)[field] as number : a.index;
      const bv = typeof (b.row as DesignRow)[field] === 'number' ? (b.row as DesignRow)[field] as number : b.index;
      return av - bv || a.index - b.index;
    })
    .map(({ row }) => row as DesignRow);
  const movingAt = domain.indexOf(target.row);
  domain.splice(movingAt, 1);
  const anchorAt = domain.indexOf(relative.row);
  domain.splice(anchorAt + (anchor.side === 'after' ? 1 : 0), 0, target.row);
  const field = orderField;
  domain.forEach((row, index) => { row[field] = index; });

  // Keep the flat document's order aligned with the semantic order as well. Other
  // sibling domains stay in place; only the target crosses the named anchor.
  const scope = designHierarchyDescendants(graph, new Set([id]));
  const moving = rows.filter(row => isRow(row) && scope.has(String(row.id)));
  for (let n = rows.length - 1; n >= 0; n--) { const row = rows[n]; if (isRow(row) && scope.has(String(row.id))) rows.splice(n,1); }
  const anchorScope = anchor.side === 'after' ? designHierarchyDescendants(graph, new Set([anchor.id])) : new Set([anchor.id]);
  let anchorNow = rows.indexOf(relative.row);
  if (anchor.side === 'after') for (let n = anchorNow; n < rows.length; n++) { const row = rows[n]; if (isRow(row) && anchorScope.has(String(row.id))) anchorNow = n; }
  rows.splice(anchorNow + (anchor.side === 'after' ? 1 : 0), 0, ...moving);

}

function reparentLayerRows(rows: unknown[], record: DesignRow, path: string, options: {pages?:readonly unknown[]}): void {
      const target = rowAt(rows, record.id, `${path}/id`);
      if (target.row.kind === 'frame')
        throw new Error(`${path}/id: artboards cannot be reparented.`);
      const graph = hierarchyOf(rows, options.pages);
      const explicit = record.parentId !== undefined;
      if (explicit && record.artboardId !== undefined) throw new Error(`${path}: choose parentId or artboardId.`);
      const parentId = explicit ? record.parentId : record.artboardId;
      if (parentId !== null && (typeof parentId !== 'string' || !parentId.trim())) throw new Error(`${path}/${explicit ? 'parentId' : 'artboardId'}: expected a stable parent id or null for the pasteboard.`);
      const destination = typeof parentId === 'string' ? rowAt(rows,parentId,`${path}/${explicit ? 'parentId' : 'artboardId'}`).row : null;
      if (destination && (!explicit && destination.kind !== 'frame' || explicit && destination.kind !== 'frame' && destination.kind !== 'group' && destination.layout !== 'flex' && destination.layout !== 'grid')) throw new Error(`${path}/${explicit ? 'parentId' : 'artboardId'}: layer "${String(parentId)}" is not an ${explicit ? 'owning container' : 'artboard'}.`);
      const scope = designHierarchyDescendants(graph,new Set([String(target.row.id)]));
      if (scope.has(String(parentId))) throw new Error(`${path}/parentId: a layer cannot be moved into its own subtree.`);
      const pageId = record.pageId === undefined ? destination ? graph.pageById.get(String(destination.id)) : graph.pageById.get(String(target.row.id)) : record.pageId;
      if (typeof pageId !== 'string' || !graph.pages.some(page=>page.id===pageId)) throw new Error(`${path}/pageId: choose an existing page.`);
      if (options.pages || rows.some(row=>isRow(row) && row.pageId) || record.pageId !== undefined)
        for (const row of rows) if (isRow(row) && scope.has(String(row.id))) row.pageId = pageId;
      target.row.group = destination?.kind === 'group' ? parentId : '';
      target.row.layoutOwner = destination && (destination.layout === 'flex' || destination.layout === 'grid') ? parentId : '';
      target.row.frame = destination?.kind === 'frame' && !target.row.layoutOwner ? parentId : '';
      const anchor = optionalAnchorOf(record, path);
      if (anchor) {
        reorderDesignRow(rows, String(target.row.id), anchor, path, options.pages);
      } else {
        const reorderedGraph = hierarchyOf(rows,options.pages);
        const siblings = rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)
          && row !== target.row && (row as DesignRow).kind !== 'frame'
          && sameReorderDomain(target.row,row as DesignRow,reorderedGraph)) as DesignRow[];
        target.row.z = siblings.reduce((max, sibling) =>
          Math.max(max, typeof sibling.z === 'number' ? sibling.z : -1), -1) + 1;
        const [moving] = rows.splice(target.index, 1);
        let lastSibling = -1;
        rows.forEach((row, rowIndex) => {
          if (siblings.includes(row as DesignRow)) lastSibling = rowIndex;
        });
        rows.splice(lastSibling >= 0 ? lastSibling + 1 : rows.length, 0, moving);
      }
}

/** Strict, stateful Design mutations for agents. Operations run in array order, so
 * a later operation can address a layer added by an earlier one. Returns a new rows
 * array (the rows are copied); throws an Error naming the JSON path at fault. */
export function applyLayerOperations(
  sourceRows: readonly unknown[],
  value: unknown,
  fieldDefault: (id: string, fallback: unknown) => unknown = (_id, fallback) => fallback,
  options: { pages?: readonly unknown[] } = {},
): unknown[] {
  if (!Array.isArray(value)) throw new Error('layerOperations must be an array.');
  const rows = copyRows(sourceRows);
  for (let index = 0; index < value.length; index++) {
    const path = `/layerOperations/${index}`;
    const operation = value[index];
    if (!operation || typeof operation !== 'object' || Array.isArray(operation))
      throw new Error(`${path}: operation must be an object.`);
    const record = operation as DesignRow;
    const op = record.op;
    if (op !== 'add' && op !== 'duplicate' && op !== 'remove' && op !== 'reparent' && op !== 'reorder')
      throw new Error(`${path}/op: expected add, duplicate, remove, reparent or reorder.`);
    const allowed = new Set(
      op === 'add'
        ? ['op', 'layer', 'beforeId', 'afterId']
        : op === 'duplicate'
          ? ['op', 'id', 'newId', 'childIds', 'beforeId', 'afterId']
          : op === 'remove'
            ? ['op', 'id', 'cascade']
            : op === 'reparent'
              ? ['op', 'id', 'artboardId', 'parentId', 'pageId', 'beforeId', 'afterId']
              : ['op', 'id', 'beforeId', 'afterId']
    );
    const extra = Object.keys(record).find((key) => !allowed.has(key));
    if (extra) throw new Error(`${path}/${extra}: unknown ${op} field.`);

    if (op === 'add') {
      const valueLayer = record.layer;
      if (!valueLayer || typeof valueLayer !== 'object' || Array.isArray(valueLayer))
        throw new Error(`${path}/layer: a layer object is required.`);
      const supplied = valueLayer as DesignRow;
      const id = supplied.id;
      if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}/layer/id: a stable layer id is required.`);
      if (rows.some((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).id === id))
        throw new Error(`${path}/layer/id: layer "${id}" already exists.`);
      const layer: DesignRow = {
        kind: fieldDefault('kind', 'box'),
        x: fieldDefault('x', 120),
        y: fieldDefault('y', 120),
        w: fieldDefault('w', 320),
        h: fieldDefault('h', 200),
        ...supplied,
      };
      const hasAnchor = record.beforeId !== undefined || record.afterId !== undefined;
      if (!hasAnchor) rows.push(layer);
      else {
        const anchor = anchorOf(record, path);
        const relative = rowAt(rows, anchor.id, `${path}/${anchor.side}Id`);
        if (!sameReorderDomain(layer, relative.row, hierarchyOf([...rows,layer],options.pages)))
          throw new Error(`${path}: an added layer and its anchor must be siblings or two artboards.`);
        rows.splice(relative.index + (anchor.side === 'after' ? 1 : 0), 0, layer);
        reorderDesignRow(rows, id, anchor, path, options.pages);
      }
      continue;
    }

    if (op === 'duplicate') {
      const source = rowAt(rows, record.id, `${path}/id`);
      const newId = assertNewDesignId(rows, record.newId, `${path}/newId`);
      const anchor = optionalAnchorOf(record, path) ?? {
        side: 'after' as const,
        id: String(source.row.id),
      };
      const isFrame = source.row.kind === 'frame';
      const children = subtreeRows(rows,String(source.row.id),options.pages);
      const isContainer = isFrame || source.row.kind === 'group' || source.row.layout === 'flex' || source.row.layout === 'grid';
      if ([source.row,...children].some(row=>row.textStory || row.layout === 'grid')) throw new Error(`${path}: duplicating linked stories or grids requires copying their document metadata. Use the canvas duplicate action.`);
      const childIdsValue = record.childIds;
      if (!isContainer && childIdsValue !== undefined)
        throw new Error(`${path}/childIds: only a container duplicate may supply child ids.`);
      if (childIdsValue !== undefined && (!childIdsValue || typeof childIdsValue !== 'object' || Array.isArray(childIdsValue)))
        throw new Error(`${path}/childIds: expected an old child id to new child id object.`);
      if (children.length && childIdsValue === undefined)
        throw new Error(`${path}/childIds: duplicating artboard "${String(source.row.id)}" requires a new id for each of its ${children.length} child layers.`);
      const childIds = (childIdsValue ?? {}) as Record<string, unknown>;
      const sourceChildIds = children.map((child, childIndex) => {
        const id = child.id;
        if (typeof id !== 'string' || !id.trim())
          throw new Error(`${path}/childIds: source child at index ${childIndex} has no stable id.`);
        return id;
      });
      const extraChild = Object.keys(childIds).find((id) => !sourceChildIds.includes(id));
      if (extraChild) throw new Error(`${path}/childIds/${extraChild}: source artboard has no child with this id.`);
      const proposed = [newId];
      const mappedChildIds = new Map<string, string>();
      for (const sourceId of sourceChildIds) {
        const mapped = childIds[sourceId];
        if (typeof mapped !== 'string' || !mapped.trim())
          throw new Error(`${path}/childIds/${sourceId}: a new stable layer id is required.`);
        proposed.push(mapped);
        mappedChildIds.set(sourceId, mapped);
      }
      const duplicateProposed = proposed.find((id, proposedIndex) => proposed.indexOf(id) !== proposedIndex);
      if (duplicateProposed)
        throw new Error(`${path}: new layer id "${duplicateProposed}" is used more than once.`);
      const collision = proposed.find((id) => rows.some((row) => row && typeof row === 'object'
        && !Array.isArray(row) && (row as DesignRow).id === id));
      if (collision)
        throw new Error(`${path}: layer "${collision}" already exists.`);

      mappedChildIds.set(String(source.row.id),newId);
      const clone = remapLayerRow(source.row,mappedChildIds);
      rows.push(clone);
      reorderDesignRow(rows, newId, anchor, path, options.pages);
      for (const child of children) rows.push(remapLayerRow(child,mappedChildIds));
      continue;
    }

    if (op === 'remove') {
      const target = rowAt(rows, record.id, `${path}/id`);
      const children = subtreeRows(rows,String(target.row.id),options.pages);
      if (children.length && record.cascade !== true)
        throw new Error(`${path}/cascade: artboard "${String(target.row.id)}" has ${children.length} child layer${children.length === 1 ? '' : 's'}; pass cascade:true to remove them.`);
      const removeIds = new Set([target.row.id, ...children.map((row) => (row as DesignRow).id)]);
      for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
        const row = rows[rowIndex];
        if (row && typeof row === 'object' && !Array.isArray(row) && removeIds.has((row as DesignRow).id)) rows.splice(rowIndex, 1);
      }
      continue;
    }

    if (op === 'reparent') { reparentLayerRows(rows,record,path,options); continue; }

    const id = record.id;
    if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}/id: a stable layer id is required.`);
    reorderDesignRow(rows, id, anchorOf(record, path), path, options.pages);
  }
  if (rows.some(row=>isRow(row) && (row.kind==='group' || row.pageId))) {
    const finding = hierarchyOf(rows,options.pages).findings[0];
    if (finding) throw new Error(`/layerOperations: ${finding.message}`);
  }
  return rows;
}

/** Stable-id edits are the small semantic delta an agent needs after choosing a
 * template. Geometry stays in the template; the patch can replace a headline,
 * image or other declared field without rebuilding a 99-field block row. Returns a
 * new rows array; throws an Error naming the JSON path at fault. */
export function applyLayerPatches(sourceRows: readonly unknown[], value: unknown, options: {pages?: readonly unknown[]} = {}): unknown[] {
  if (!Array.isArray(value)) throw new Error('layerPatches must be an array.');
  const rows = copyRows(sourceRows);
  for (let index = 0; index < value.length; index++) {
    const patch = value[index];
    if (!patch || typeof patch !== 'object' || Array.isArray(patch))
      throw new Error(`/layerPatches/${index}: patch must be an object.`);
    const record = patch as Record<string, unknown>;
    const extra = Object.keys(record).find((key) => key !== 'id' && key !== 'set');
    if (extra) throw new Error(`/layerPatches/${index}/${extra}: unknown patch field.`);
    const id = record.id;
    if (typeof id !== 'string' || !id) throw new Error(`/layerPatches/${index}/id: a stable layer id is required.`);
    const set = record.set;
    if (!set || typeof set !== 'object' || Array.isArray(set)) throw new Error(`/layerPatches/${index}/set: fields must be an object.`);
    if (Object.hasOwn(set, 'id')) throw new Error(`/layerPatches/${index}/set/id: a stable layer id cannot be changed.`);
    const match = rowAt(rows, id, `/layerPatches/${index}/id`);
    if (match.row.kind === 'group' && Object.keys(set).some(field=>['x','y','w','h','rot'].includes(field))) throw new Error(`/layerPatches/${index}/set: group geometry requires a canvas transform that carries its descendants.`);
    rows[match.index] = { ...match.row, ...(set as Record<string, unknown>) };
  }
  if (rows.some(row=>isRow(row) && (row.kind==='group' || row.pageId))) {
    const finding = hierarchyOf(rows,options.pages).findings[0];
    if (finding) throw new Error(`/layerPatches: ${finding.message}`);
  }
  return rows;
}
