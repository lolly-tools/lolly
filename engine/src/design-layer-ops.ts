// SPDX-License-Identifier: MPL-2.0
/**
 * Design layer edits by stable id (plans/289 D1): `layerOperations` (add, duplicate,
 * remove, reparent, reorder) and `layerPatches` (set fields on one layer). The MCP
 * server applies them to a render's inputs, and the live editor bridge applies them
 * to the open document, so an agent's edit means the same on both. Moved unchanged
 * from services/mcp/src/tools.ts. Pure: rows in, rows out.
 */

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

function sameReorderDomain(a: DesignRow, b: DesignRow): boolean {
  const aFrame = a.kind === 'frame';
  const bFrame = b.kind === 'frame';
  if (aFrame || bFrame) return aFrame && bFrame;
  return String(a.frame ?? '') === String(b.frame ?? '');
}

/** Move one row relative to a sibling and rewrite the renderer's actual order field:
 * `order` for artboards, `z` for layers in the same artboard/pasteboard. */
function reorderDesignRow(rows: unknown[], id: string, anchor: { side: 'before' | 'after'; id: string }, path: string): void {
  const target = rowAt(rows, id, `${path}/id`);
  const relative = rowAt(rows, anchor.id, `${path}/${anchor.side}Id`);
  if (target.index === relative.index) throw new Error(`${path}: a layer cannot be reordered relative to itself.`);
  if (!sameReorderDomain(target.row, relative.row))
    throw new Error(`${path}: reorder targets must be sibling layers or two artboards.`);

  const isFrame = target.row.kind === 'frame';
  const parent = String(target.row.frame ?? '');
  const domain = rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return false;
      const r = row as DesignRow;
      return isFrame ? r.kind === 'frame' : r.kind !== 'frame' && String(r.frame ?? '') === parent;
    })
    .sort((a, b) => {
      const field = isFrame ? 'order' : 'z';
      const av = typeof (a.row as DesignRow)[field] === 'number' ? (a.row as DesignRow)[field] as number : a.index;
      const bv = typeof (b.row as DesignRow)[field] === 'number' ? (b.row as DesignRow)[field] as number : b.index;
      return av - bv || a.index - b.index;
    })
    .map(({ row }) => row as DesignRow);
  const movingAt = domain.indexOf(target.row);
  domain.splice(movingAt, 1);
  const anchorAt = domain.indexOf(relative.row);
  domain.splice(anchorAt + (anchor.side === 'after' ? 1 : 0), 0, target.row);
  const field = isFrame ? 'order' : 'z';
  domain.forEach((row, index) => { row[field] = index; });

  // Keep the flat document's order aligned with the semantic order as well. Other
  // sibling domains stay in place; only the target crosses the named anchor.
  const [moving] = rows.splice(target.index, 1);
  const anchorNow = rows.indexOf(relative.row);
  rows.splice(anchorNow + (anchor.side === 'after' ? 1 : 0), 0, moving);
}

/** Strict, stateful Design mutations for agents. Operations run in array order, so
 * a later operation can address a layer added by an earlier one. Returns a new rows
 * array (the rows are copied); throws an Error naming the JSON path at fault. */
export function applyLayerOperations(
  sourceRows: readonly unknown[],
  value: unknown,
  fieldDefault: (id: string, fallback: unknown) => unknown = (_id, fallback) => fallback,
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
              ? ['op', 'id', 'artboardId', 'beforeId', 'afterId']
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
        if (!sameReorderDomain(layer, relative.row))
          throw new Error(`${path}: an added layer and its anchor must be siblings or two artboards.`);
        rows.splice(relative.index + (anchor.side === 'after' ? 1 : 0), 0, layer);
        reorderDesignRow(rows, id, anchor, path);
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
      const children = isFrame
        ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)
          && (row as DesignRow).kind !== 'frame'
          && (row as DesignRow).frame === source.row.id) as DesignRow[]
        : [];
      const childIdsValue = record.childIds;
      if (!isFrame && childIdsValue !== undefined)
        throw new Error(`${path}/childIds: only an artboard duplicate may supply child ids.`);
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

      const clone: DesignRow = { ...source.row, id: newId };
      rows.push(clone);
      reorderDesignRow(rows, newId, anchor, path);
      for (const child of children) {
        rows.push({
          ...child,
          id: mappedChildIds.get(String(child.id))!,
          frame: newId,
        });
      }
      continue;
    }

    if (op === 'remove') {
      const target = rowAt(rows, record.id, `${path}/id`);
      const children = target.row.kind === 'frame'
        ? rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row) && (row as DesignRow).frame === target.row.id)
        : [];
      if (children.length && record.cascade !== true)
        throw new Error(`${path}/cascade: artboard "${String(target.row.id)}" has ${children.length} child layer${children.length === 1 ? '' : 's'}; pass cascade:true to remove them.`);
      const removeIds = new Set([target.row.id, ...children.map((row) => (row as DesignRow).id)]);
      for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex--) {
        const row = rows[rowIndex];
        if (row && typeof row === 'object' && !Array.isArray(row) && removeIds.has((row as DesignRow).id)) rows.splice(rowIndex, 1);
      }
      continue;
    }

    if (op === 'reparent') {
      const target = rowAt(rows, record.id, `${path}/id`);
      if (target.row.kind === 'frame')
        throw new Error(`${path}/id: artboards cannot be reparented.`);
      const artboardId = record.artboardId;
      if (artboardId !== null && (typeof artboardId !== 'string' || !artboardId.trim()))
        throw new Error(`${path}/artboardId: expected an artboard stable id or null for the pasteboard.`);
      if (typeof artboardId === 'string') {
        const destination = rowAt(rows, artboardId, `${path}/artboardId`);
        if (destination.row.kind !== 'frame')
          throw new Error(`${path}/artboardId: layer "${artboardId}" is not an artboard.`);
      }
      target.row.frame = artboardId ?? '';
      const anchor = optionalAnchorOf(record, path);
      if (anchor) {
        reorderDesignRow(rows, String(target.row.id), anchor, path);
      } else {
        const parent = String(target.row.frame ?? '');
        const siblings = rows.filter((row) => row && typeof row === 'object' && !Array.isArray(row)
          && row !== target.row && (row as DesignRow).kind !== 'frame'
          && String((row as DesignRow).frame ?? '') === parent) as DesignRow[];
        target.row.z = siblings.reduce((max, sibling) =>
          Math.max(max, typeof sibling.z === 'number' ? sibling.z : -1), -1) + 1;
        const [moving] = rows.splice(target.index, 1);
        let lastSibling = -1;
        rows.forEach((row, rowIndex) => {
          if (siblings.includes(row as DesignRow)) lastSibling = rowIndex;
        });
        rows.splice(lastSibling >= 0 ? lastSibling + 1 : rows.length, 0, moving);
      }
      continue;
    }

    const id = record.id;
    if (typeof id !== 'string' || !id.trim()) throw new Error(`${path}/id: a stable layer id is required.`);
    reorderDesignRow(rows, id, anchorOf(record, path), path);
  }
  return rows;
}

/** Stable-id edits are the small semantic delta an agent needs after choosing a
 * template. Geometry stays in the template; the patch can replace a headline,
 * image or other declared field without rebuilding a 99-field block row. Returns a
 * new rows array; throws an Error naming the JSON path at fault. */
export function applyLayerPatches(sourceRows: readonly unknown[], value: unknown): unknown[] {
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
    rows[match.index] = { ...match.row, ...(set as Record<string, unknown>) };
  }
  return rows;
}
