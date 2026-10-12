// SPDX-License-Identifier: MPL-2.0
/** Nested Design groups share global geometry with their children. */
import {
  remapDesignLayout,
  refreshDesignGroupBounds,
  designHierarchyAncestors,
  designHierarchyDescendants,
  designHierarchyFlags,
  designHierarchyIndex,
  migrateDesignHierarchy,
  remapDesignHierarchy,
} from '@lolly/engine';
import {
  boxAABB,
  boxRect,
  normAngle,
  rectCentre,
  rotateVec,
  withRect,
  type Box,
} from '../free-canvas-math.ts';
import { t } from '../../i18n.ts';
import { ulid } from '../../lib/row-id.ts';
import { bindOp, type FcCtx } from './context.ts';

const positions = new WeakMap<Box[], Map<string, number>>();
const scopes = new WeakMap<Box[], Map<string, Set<string>>>();
const transforms = new WeakMap<Box[], Map<string, number[]>>();
const framesByRevision = new WeakMap<Box[], Map<string, Box[]>>();
const legacyWarnings = new WeakSet<Box[]>();
export const enabled = (fc: FcCtx): boolean =>
  !!fc.cv?.textDocumentInput && fc.cfg?.groupField === 'group';
export const isGroup = (fc: FcCtx, box: Box | undefined): boolean =>
  enabled(fc) && box?.[fc.cfg.kindField] === 'group';
export function projectSource(fc: FcCtx, boxes: Box[], pages = pagesOf(fc)): Box[] {
  if (!enabled(fc)) return boxes;
  const migrated = migrateDesignHierarchy(boxes, pages);
  if (migrated.findings.length && !legacyWarnings.has(boxes) && fc.stage?.flash) {
    legacyWarnings.add(boxes);
    fc.stage.flash(migrated.findings[0]!.message);
  }
  return migrated.boxes as Box[];
}
const pagesOf = (fc: FcCtx) => fc.opts?.getDesignPages?.();
const indexOf = (fc: FcCtx, boxes: Box[]) => designHierarchyIndex(boxes, pagesOf(fc));
function indexPositions(boxes: Box[]): Map<string, number> {
  let result = positions.get(boxes);
  if (!result) {
    result = new Map(boxes.map((box, i) => [String(box.id ?? ''), i]));
    positions.set(boxes, result);
  }
  return result;
}
export function scopeIds(fc: FcCtx, boxes: Box[], ids: Set<string>): Set<string> {
  if (!enabled(fc)) return ids;
  const key = [...ids].sort().join('\0');
  let cache = scopes.get(boxes);
  if (!cache) {
    cache = new Map();
    scopes.set(boxes, cache);
  }
  const saved = cache.get(key);
  if (saved) return saved;
  const hierarchy = indexOf(fc, boxes);
  const groups = new Set(
    [...ids].filter((id) => isGroup(fc, hierarchy.byId.get(id) as Box | undefined))
  );
  const result = new Set([...ids, ...designHierarchyDescendants(hierarchy, groups)]);
  if (cache.size > 32) cache.clear();
  cache.set(key, result);
  return result;
}
export function transformIndices(fc: FcCtx, boxes: Box[]): number[] {
  if (!enabled(fc)) return fc.select.selIndices(boxes);
  const key = [...fc.selection].sort().join('\0');
  let cache = transforms.get(boxes);
  if (!cache) {
    cache = new Map();
    transforms.set(boxes, cache);
  }
  const saved = cache.get(key);
  if (saved) return saved;
  const ids = scopeIds(fc, boxes, fc.selection),
    at = indexPositions(boxes);
  const result = [...ids]
    .flatMap((id) => {
      const i = at.get(id);
      return i === undefined ? [] : [i];
    })
    .sort((a, b) => a - b);
  if (cache.size > 32) cache.clear();
  cache.set(key, result);
  return result;
}

export function selectable(fc: FcCtx, boxes: Box[], id: string): boolean {
  if (!enabled(fc)) return true;
  const hierarchy = indexOf(fc, boxes);
  const page = fc.opts?.getActivePage?.();
  return (
    (!page || hierarchy.pageById.get(id) === page) && !designHierarchyFlags(hierarchy, id).hidden
  );
}

/** Ownership resolution considers artboards from the same canvas page. */
export function frameCandidates(fc: FcCtx, boxes: Box[], box: Box, frames: Box[]): Box[] {
  if (!enabled(fc)) return frames;
  const hierarchy = indexOf(fc, boxes);
  let pages = framesByRevision.get(boxes);
  if (!pages) {
    pages = new Map();
    for (const frame of frames) {
      const page = hierarchy.pageById.get(String(frame.id)) || 'page-1';
      const rows = pages.get(page) || []; rows.push(frame); pages.set(page, rows);
    }
    framesByRevision.set(boxes, pages);
  }
  const raw = fc.runtime.getModel().find(input => input.id === fc.blockId)?.value;
  const isNew = Array.isArray(raw) && !indexPositions(raw).has(String(box.id));
  const page = String(box.pageId || (isNew && !hierarchy.parent.has(String(box.id)) ? fc.opts?.getActivePage?.() : hierarchy.pageById.get(String(box.id))) || 'page-1');
  return pages.get(page) || [];
}

export function acquisitionSkip(fc: FcCtx, boxes: Box[], id: string): boolean {
  if (!enabled(fc)) return false;
  const hierarchy = indexOf(fc, boxes);
  return (
    !selectable(fc, boxes, id) ||
    designHierarchyFlags(hierarchy, id).locked ||
    isGroup(fc, hierarchy.byId.get(id) as Box | undefined)
  );
}
export function selectHitIds(fc: FcCtx, boxes: Box[], id: string, solo: boolean): string[] {
  if (!enabled(fc) || solo) return [id];
  const hierarchy = indexOf(fc, boxes);
  const ancestors = designHierarchyAncestors(hierarchy, id).filter((parent) =>
    isGroup(fc, hierarchy.byId.get(parent) as Box | undefined)
  );
  const scope = fc.hierarchyScope;
  const scopeAt = scope ? ancestors.indexOf(scope) : -1;
  const candidates = scopeAt >= 0 ? ancestors.slice(0, scopeAt) : ancestors;
  return [candidates.at(-1) || id];
}
/** One double-click enters one group level before editing the leaf itself. */
export function drillIn(fc: FcCtx, boxes: Box[], id: string): boolean {
  if (!enabled(fc)) return false;
  const selected = selectHitIds(fc, boxes, id, false)[0]!;
  const hierarchy = indexOf(fc, boxes);
  if (!isGroup(fc, hierarchy.byId.get(selected) as Box | undefined)) return false;
  fc.hierarchyScope = selected;
  fc.selection = new Set(selectHitIds(fc, boxes, id, false));
  fc.chromeSync.renderChrome();
  return true;
}
export function leaveScope(fc: FcCtx): boolean {
  if (!fc.hierarchyScope) return false;
  const scope = fc.hierarchyScope;
  const hierarchy = indexOf(fc, fc.select.getBoxes());
  fc.hierarchyScope =
    designHierarchyAncestors(hierarchy, scope).find((id) =>
      isGroup(fc, hierarchy.byId.get(id) as Box | undefined)
    ) || '';
  fc.selection = new Set([scope]);
  fc.chromeSync.renderChrome();
  return true;
}
export function retainSelection(fc: FcCtx, boxes: Box[]): void {
  if (!enabled(fc)) return;
  const hierarchy = indexOf(fc, boxes),
    page = fc.opts?.getActivePage?.();
  if (
    fc.hierarchyScope &&
    (!hierarchy.byId.has(fc.hierarchyScope) ||
      (page && hierarchy.pageById.get(fc.hierarchyScope) !== page))
  )
    fc.hierarchyScope = '';
  for (const id of fc.selection)
    if (!hierarchy.byId.has(id) || (page && hierarchy.pageById.get(id) !== page))
      fc.selection.delete(id);
}
/** Marquee and Select all acquire the current group level once per root. */
export function selectionIds(fc: FcCtx, boxes: Box[], indices: number[]): string[] {
  const ids = new Set<string>();
  for (const i of indices) {
    const id = fc.select.idOf(boxes[i], i);
    if (enabled(fc) && acquisitionSkip(fc, boxes, id)) continue;
    for (const selected of enabled(fc)
      ? selectHitIds(fc, boxes, id, false)
      : fc.select.selectionForHit(boxes, i, false))
      ids.add(selected);
  }
  return [...ids];
}
export function group(fc: FcCtx): boolean {
  if (!enabled(fc)) return false;
  if (fc.opts?.canEdit?.() === false) return true;
  const boxes = fc.select.getBoxes(),
    hierarchy = indexOf(fc, boxes);
  const selected = new Set([...fc.selection].filter((id) => selectable(fc, boxes, id)));
  // Selected descendants already belong to the selected ancestor.
  for (const id of selected)
    if (designHierarchyAncestors(hierarchy, id).some((parent) => selected.has(parent)))
      selected.delete(id);
  if (selected.size < 2) return true;
  const members = [...selected].map((id) => hierarchy.byId.get(id) as Box).filter(Boolean);
  if (members.some((box) => box.kind === fc.frameCfg?.frameKind)) {
    fc.stage.flash(t('Group layers within one artboard.'));
    return true;
  }
  const first = members[0]!;
  const same = (field: string): boolean =>
    members.every((box) => String(box[field] ?? '') === String(first[field] ?? ''));
  if (
    !['group', 'frame', 'layoutOwner'].every(same) ||
    members.some(
      (box) => hierarchy.pageById.get(String(box.id)) !== hierarchy.pageById.get(String(first.id))
    )
  ) {
    fc.stage.flash(t('Group layers within one parent.'));
    return true;
  }
  const bounds = members.map((box) => boxAABB(box, fc.cfg));
  const minX = Math.min(...bounds.map((b) => b.minX)),
    minY = Math.min(...bounds.map((b) => b.minY));
  const maxX = Math.max(...bounds.map((b) => b.maxX)),
    maxY = Math.max(...bounds.map((b) => b.maxY));
  const id = fc.select.freshId(boxes);
  const row: Box = {
    id,
    kind: 'group',
    name: t('Group'),
    x: minX,
    y: minY,
    w: maxX - minX,
    h: maxY - minY,
    rot: 0,
    pageId: hierarchy.pageById.get(String(first.id)) || 'page-1',
    group: String(first.group || ''),
    frame: String(first.frame || ''),
    layoutOwner: String(first.layoutOwner || ''),
  };
  const last = Math.max(...members.map((box) => indexPositions(boxes).get(String(box.id))!));
  const next = boxes.map((box) =>
    selected.has(String(box.id)) ? { ...box, group: id, frame: '', layoutOwner: '' } : box
  );
  next.splice(last + 1, 0, row);
  fc.history?.endGesture?.();
  fc.selection = new Set([id]);
  fc.select.commit(next, {}, t('Group layers'));
  return true;
}
export function ungroup(fc: FcCtx): boolean {
  if (!enabled(fc)) return false;
  if (fc.opts?.canEdit?.() === false) return true;
  const boxes = fc.select.getBoxes(),
    hierarchy = indexOf(fc, boxes);
  const groups = new Set(
    [...fc.selection].filter((id) => isGroup(fc, hierarchy.byId.get(id) as Box | undefined))
  );
  for (const id of groups)
    if (designHierarchyAncestors(hierarchy, id).some((parent) => groups.has(parent)))
      groups.delete(id);
  if (!groups.size) return false;
  const selection = new Set<string>();
  const next = boxes.flatMap((box) => {
    const id = String(box.id);
    if (groups.has(id)) return [];
    const parent = hierarchy.byId.get(String(box.group || ''));
    if (!parent || !groups.has(String(parent.id))) return [box];
    selection.add(id);
    return [
      {
        ...box,
        group: String(parent.group || ''),
        frame: String(parent.frame || ''),
        layoutOwner: String(parent.layoutOwner || ''),
      },
    ];
  });
  fc.history?.endGesture?.();
  fc.selection = selection;
  fc.select.commit(next, {}, t('Ungroup layers'));
  return true;
}
export function remapCopies(fc: FcCtx, boxes: Box[], copies: Map<string, string>): Box[] {
  if (!enabled(fc)) return boxes;
  // Clones already have fresh ids; rewrite only references to copied records.
  const result = remapDesignHierarchy(boxes, copies) as Box[];
  const ids = new Set(result.map((box) => String(box.id)));
  const page = fc.opts?.getActivePage?.();
  return result.map((box) => ({
    ...box,
    ...(page ? { pageId: page } : {}),
    group: copies.has(String(box.group || ''))
      ? String(copies.get(String(box.group)))
      : ids.has(String(box.group))
        ? box.group
        : '',
  }));
}
export function rootCopySelection(fc: FcCtx, boxes: Box[], ids: Set<string>): Set<string> {
  if (!enabled(fc)) return ids;
  const hierarchy = indexOf(fc, boxes);
  return new Set(
    [...ids].filter(
      (id) => !designHierarchyAncestors(hierarchy, id).some((parent) => ids.has(parent))
    )
  );
}

/** Build the collision set once for a whole copy, instead of once per layer. */
export function idFactory(fc: FcCtx, boxes: Box[]): () => string {
  const used = new Set(boxes.map((box) => String(box[fc.cfg.idField])));
  return () => {
    let id = ulid();
    while (used.has(id)) id = ulid();
    used.add(id);
    return id;
  };
}
export function cleanDeletedReferences(fc: FcCtx, before: Box[], after: Box[]): Box[] {
  if (!enabled(fc)) return after;
  const remaining = new Set(after.map((row) => String(row.id)));
  const deleted = new Set(before.map((row) => String(row.id)).filter((id) => !remaining.has(id)));
  if (!deleted.size) return after;
  return after.map((row) => {
    let next = row;
    for (const field of [fc.cfg.clipField, fc.cfg.bindStartField, fc.cfg.bindEndField])
      if (field && deleted.has(String(row[field]))) next = { ...next, [field]: '' };
    return next;
  });
}

const placementFields = ['x', 'y', 'w', 'h', 'rot'] as const;
const placementChanged = (before: Box, after: Box): boolean =>
  placementFields.some((field) => Number(before[field] || 0) !== Number(after[field] || 0));
/** Precision and arrange commands edit a group record; carry unchanged children once. */
export function cascadeGroupEdits(fc: FcCtx, before: Box[], after: Box[]): Box[] {
  const hierarchy = indexOf(fc, before),
    byId = new Map(after.map((row) => [String(row.id), row]));
  const changed = new Set(
    after
      .filter(
        (row) =>
          isGroup(fc, row) &&
          hierarchy.byId.has(String(row.id)) &&
          placementChanged(hierarchy.byId.get(String(row.id)) as Box, row)
      )
      .map((row) => String(row.id))
  );
  const transforms = new Map<string, Box>();
  for (const id of changed) {
    if (designHierarchyAncestors(hierarchy, id).some((parent) => changed.has(parent))) continue;
    const descendants = designHierarchyDescendants(hierarchy, new Set([id]));
    descendants.delete(id);
    if (
      [...descendants].some(
        (child) =>
          byId.has(child) && placementChanged(hierarchy.byId.get(child) as Box, byId.get(child)!)
      )
    )
      continue;
    const previous = boxRect(hierarchy.byId.get(id) as Box, fc.cfg),
      authored = boxRect(byId.get(id), fc.cfg);
    let next = authored,
      k = 1;
    const widthChanged = Math.abs(next.w - previous.w) > 1e-8,
      heightChanged = Math.abs(next.h - previous.h) > 1e-8;
    if (widthChanged || heightChanged) {
      const kw = next.w / previous.w,
        kh = next.h / previous.h;
      if (widthChanged && heightChanged && Math.abs(kw - kh) > 1e-6)
        throw new Error(t('Resize groups proportionally to preserve rotated layers.'));
      k = widthChanged ? kw : kh;
      if (!Number.isFinite(k) || k <= 0) throw new Error(t('Choose a positive group size.'));
      next = { ...next, w: previous.w * k, h: previous.h * k };
      transforms.set(id, withRect(byId.get(id)!, next, fc.cfg));
    }
    const from = rectCentre(previous),
      to = rectCentre(next),
      delta = (next.rot || 0) - (previous.rot || 0);
    for (const child of descendants) {
      const row = byId.get(child);
      if (!row) continue;
      const rect = boxRect(row, fc.cfg),
        centre = rectCentre(rect),
        offset = rotateVec((centre.x - from.x) * k, (centre.y - from.y) * k, delta);
      transforms.set(
        child,
        withRect(
          row,
          {
            x: to.x + offset.x - (rect.w * k) / 2,
            y: to.y + offset.y - (rect.h * k) / 2,
            w: rect.w * k,
            h: rect.h * k,
            rot: normAngle((rect.rot || 0) + delta),
          },
          fc.cfg
        )
      );
    }
  }
  return transforms.size ? after.map((row) => transforms.get(String(row.id)) || row) : after;
}

export function prepareCommit(fc: FcCtx, boxes: Box[], pages = pagesOf(fc)): Box[] {
  if (!enabled(fc)) return boxes;
  const raw = fc.runtime.getModel().find((input) => input.id === fc.blockId)?.value;
  const known = new Set((Array.isArray(raw) ? raw : []).map((row: Box) => String(row.id)));
  const page = fc.opts?.getActivePage?.();
  boxes = cascadeGroupEdits(fc, fc.select.getBoxes(), boxes);
  boxes = cleanDeletedReferences(fc, Array.isArray(raw) ? raw : [], boxes);
  const next = page
    ? boxes.map((box) =>
        !known.has(String(box.id)) && !box.pageId ? { ...box, pageId: page } : box
      )
    : boxes;
  return refreshDesignGroupBounds(projectSource(fc, next, pages), pages) as Box[];
}

/** All copies share one identity map, including clipping and connector references. */
function cloneRows(
  fc: FcCtx,
  boxes: Box[],
  rows: Box[],
  page?: string,
  dx = 24,
  dy = 24
): { rows: Box[]; copies: Map<string, string>; patch: Record<string, unknown> } {
  const mint = idFactory(fc, boxes),
    copies = new Map<string, string>();
  for (const row of rows) copies.set(String(row.id), mint());
  const layout = remapDesignLayout(rows, fc.layout.tracks(), copies);
  const ids = new Set(copies.keys());
  const result = (layout.boxes as Box[]).map((row, i) => {
    const original = rows[i]!;
    const copy: Box = { ...row, ...(page ? { pageId: page } : {}) };
    for (const field of [...fc.ops.dupRefFields(), 'frame', 'group'])
      if (copies.has(String(original[field]))) copy[field] = copies.get(String(original[field]));
    if (copy.group && !ids.has(String(original.group))) copy.group = '';
    if (!original.layoutOwner || !ids.has(String(original.layoutOwner))) {
      copy.x = Number(original.x || 0) + dx;
      copy.y = Number(original.y || 0) + dy;
    }
    return copy;
  });
  const tracks = layout.tracks.map((row) => {
    return { ...row, id: mint() };
  });
  return {
    rows: result,
    copies,
    patch: tracks.length ? { layoutTracks: [...fc.layout.tracks(), ...tracks] } : {},
  };
}
export function duplicateSelection(fc: FcCtx): boolean {
  if (!enabled(fc)) return false;
  const boxes = fc.select.getBoxes(),
    selected = fc.select.selIndices(boxes);
  const rows = fc.modes.copyRows(boxes, selected);
  if (!rows.some((box) => isGroup(fc, box))) return false;
  if (fc.opts?.canEdit?.() === false || !fc.layout.placementReady()) return true;
  const frames = rows.filter((row) => row.kind === fc.frameCfg?.frameKind);
  const page = fc.opts?.getActivePage?.();
  const others = boxes.filter(
    (row) => row.kind === fc.frameCfg?.frameKind && selectable(fc, boxes, String(row.id))
  );
  const dx = frames.length
    ? Math.max(...others.map((row) => Number(row.x || 0) + Number(row.w || 0))) +
      fc.FRAME_DUP_GAP -
      Math.min(...frames.map((row) => Number(row.x || 0)))
    : 24;
  const made = cloneRows(fc, boxes, rows, page, dx, frames.length ? 0 : 24);
  const selection = new Set([...fc.selection].map((id) => made.copies.get(id)!).filter(Boolean));
  void fc.storyFlow.duplicate([...boxes, ...made.rows], made.copies, selection, made.patch);
  return true;
}
export async function duplicatePage(fc: FcCtx, id: string): Promise<string | undefined> {
  if (!enabled(fc) || fc.opts?.canEdit?.() === false || !fc.layout.placementReady()) return;
  const boxes = fc.select.getBoxes(),
    pages = pagesOf(fc) || [],
    page = pages.find((row) => row.id === id);
  if (!page) return;
  const index = indexOf(fc, boxes),
    selected = boxes.flatMap((row, i) => (index.pageById.get(String(row.id)) === id ? [i] : []));
  const rows = fc.modes.copyRows(boxes, selected);
  const nextId = fc.select.freshId([...boxes, ...pages] as Box[]);
  const made = cloneRows(fc, boxes, rows, nextId, 0, 0);
  const nextPages = [
    ...pages,
    { ...page, id: nextId, name: t('{name} copy', { name: page.name }), order: pages.length },
  ];
  await fc.storyFlow.duplicate([...boxes, ...made.rows], made.copies, new Set(), {
    ...made.patch,
    pages: nextPages,
  });
  return pagesOf(fc)?.some((row) => row.id === nextId) ? nextId : undefined;
}
export function removePage(fc: FcCtx, id: string): void {
  if (!enabled(fc) || fc.opts?.canEdit?.() === false) return;
  const pages = pagesOf(fc) || [];
  if (pages.length < 2 || !pages.some((page) => page.id === id)) return;
  const boxes = fc.select.getBoxes(),
    hierarchy = indexOf(fc, boxes);
  const next = boxes.filter((box) => hierarchy.pageById.get(String(box.id)) !== id);
  fc.selection.clear();
  fc.hierarchyScope = '';
  fc.history?.endGesture?.();
  fc.select.commit(
    next,
    { pages: pages.filter((page) => page.id !== id), ...fc.layout.trackPatch(next) },
    t('Delete page')
  );
}

export function enterGroup(fc: FcCtx, id: string): void {
  const boxes = fc.select.getBoxes(),
    hierarchy = indexOf(fc, boxes);
  if (!isGroup(fc, hierarchy.byId.get(id) as Box | undefined) || !selectable(fc, boxes, id)) return;
  fc.hierarchyScope = id;
  const child = hierarchy.children.get(id)?.find(
    (child) => selectable(fc, boxes, child) && !designHierarchyFlags(hierarchy, child).locked
  );
  fc.selection = new Set(child ? [child] : []);
  fc.chromeSync.renderChrome();
}

export function pageChanged(fc: FcCtx): void {
  if (fc.gesture) fc.gestures.cancelGesture();
  fc.textEdit?.finishEdit();
  fc.hierarchyScope = '';
  fc.selection.clear();
  fc.chromeSync.renderChrome();
}

export function hierarchyOps(fc: FcCtx) {
  return {
    idFactory: bindOp(fc, idFactory),
    cleanDeletedReferences: bindOp(fc, cleanDeletedReferences),
    enterGroup: bindOp(fc, enterGroup),
    pageChanged: bindOp(fc, pageChanged),
    duplicateSelection: bindOp(fc, duplicateSelection),
    duplicatePage: bindOp(fc, duplicatePage),
    removePage: bindOp(fc, removePage),
    prepareCommit: bindOp(fc, prepareCommit),
    enabled: bindOp(fc, enabled),
    isGroup: bindOp(fc, isGroup),
    projectSource: bindOp(fc, projectSource),
    scopeIds: bindOp(fc, scopeIds),
    transformIndices: bindOp(fc, transformIndices),
    selectable: bindOp(fc, selectable),
    frameCandidates: bindOp(fc, frameCandidates),
    acquisitionSkip: bindOp(fc, acquisitionSkip),
    selectHitIds: bindOp(fc, selectHitIds),
    drillIn: bindOp(fc, drillIn),
    leaveScope: bindOp(fc, leaveScope),
    retainSelection: bindOp(fc, retainSelection),
    selectionIds: bindOp(fc, selectionIds),
    group: bindOp(fc, group),
    ungroup: bindOp(fc, ungroup),
    remapCopies: bindOp(fc, remapCopies),
    rootCopySelection: bindOp(fc, rootCopySelection),
  };
}
