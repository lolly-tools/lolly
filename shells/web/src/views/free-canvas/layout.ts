// SPDX-License-Identifier: MPL-2.0
/** Canvas commands write layout intent; evaluated geometry remains a disposable projection. */
import {
  designLayoutSourceEdit,
  hasDesignLayout,
  remapDesignLayout,
  validateDesignLayout,
} from '@lolly/engine';
import type { Box } from '../free-canvas-math.ts';
import { announce } from '../../a11y.ts';
import { t } from '../../i18n.ts';
import { bindOp, type FcCtx } from './context.ts';
import {
  basis,
  containingFrame,
  dynamicScope,
  flowOrder,
  flowDropMarker,
  gridCellAt,
  gridCellPolygon,
  localPoint,
  materialize,
  relativePlacement,
  worldPoint,
} from './shared.ts';
import type { GridProjection } from './shared.ts';

type LayoutReceipt = { source: Box[]; text: string; boxes: Box[] };
const projections = new WeakMap<FcCtx, LayoutReceipt>();
const sourceKeys = new WeakMap<Box[], string>();
const activeSources = new WeakMap<Box[], boolean>();
const gridReceipts = new WeakMap<FcCtx, { source: Box[]; text: string; grids: GridProjection[] }>();
const layers = new WeakMap<FcCtx, HTMLElement>();
const spacingGestures = new WeakSet<FcCtx>();
const on = (value: unknown): boolean =>
  value === true || value === 'true' || value === 1 || value === '1';
const scalar = (value: unknown): number => Number(value || 0);
const key = (row: Box): string => String(row.id || '');
const isContainer = (row: Box | undefined): boolean =>
  row?.layout === 'flex' || row?.layout === 'grid';
const ownership = (row: Box): string => String(row.layoutOwner || row.frame || '');
const safeJson = (value: unknown): string =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

function sourceHasLayout(source: Box[]): boolean {
  const found = activeSources.get(source);
  if (found !== undefined) return found;
  const active = hasDesignLayout(source) || source.some(row =>
    row.kind === 'group' && (row.layoutW === 'hug' || row.layoutH === 'hug'));
  activeSources.set(source, active);
  return active;
}
function sourceKey(source: Box[]): string {
  let value = sourceKeys.get(source);
  if (!value) {
    value = safeJson(source);
    sourceKeys.set(source, value);
  }
  return value;
}
export function project(fc: FcCtx, source: Box[]): Box[] {
  if (fc.blockId !== 'boxes' || !sourceHasLayout(source)) return source;
  const text = fc.runtime.getHydratedText?.('{{{layoutBoxesJson}}}');
  const provenance = fc.runtime.getHydratedText?.('{{{layoutSourceJson}}}');
  if (!text || provenance !== sourceKey(source)) return source;
  const hit = projections.get(fc);
  if (hit?.source === source && hit.text === text) return hit.boxes;
  try {
    const boxes = JSON.parse(text);
    if (
      !Array.isArray(boxes) ||
      boxes.length !== source.length ||
      boxes.some((r, i) => r.id !== source[i]?.id)
    )
      return source;
    projections.set(fc, { source, text, boxes });
    return boxes;
  } catch {
    return source;
  }
}
export function grids(fc: FcCtx): GridProjection[] {
  const source = fc.runtime.getModel().find((i) => i.id === fc.blockId)?.value;
  if (
    !Array.isArray(source) ||
    !sourceHasLayout(source) ||
    fc.runtime.getHydratedText?.('{{{layoutSourceJson}}}') !== sourceKey(source)
  )
    return [];
  try {
    const text = fc.runtime.getHydratedText?.('{{{layoutGridsJson}}}') || '[]';
    const hit = gridReceipts.get(fc);
    if (hit?.source === source && hit.text === text) return hit.grids;
    const value = JSON.parse(text);
    const result: GridProjection[] = Array.isArray(value)
      ? value.filter(
          (g) => typeof g.id === 'string' && Array.isArray(g.columns) && Array.isArray(g.rows)
        )
      : [];
    gridReceipts.set(fc, { source, text, grids: result });
    return result;
  } catch {
    return [];
  }
}

const placementFields = ['x', 'y', 'w', 'h', 'rot'] as const;
const placementWait = () =>
  t('Wait for the layout to finish rendering before changing layer placement.');

/** Commands that read placement need the receipt for the current authored source. */
export function requirePlacement(fc: FcCtx): void {
  const source = fc.runtime.getModel().find((input) => input.id === fc.blockId)?.value;
  if (
    fc.blockId !== 'boxes' ||
    !Array.isArray(source) ||
    !sourceHasLayout(source) ||
    project(fc, source) !== source
  )
    return;
  throw new Error(placementWait());
}
/** Pointer and keyboard placement must start and finish against a current receipt. */
export function placementReady(fc: FcCtx): boolean {
  try {
    requirePlacement(fc);
    return true;
  } catch (error) {
    fc.layout.failure(error);
    return false;
  }
}
export function gestureReady(fc: FcCtx, type: string): boolean {
  return !['move', 'resize', 'rotate', 'gscale', 'grotate'].includes(type) || placementReady(fc);
}
function needsEvaluatedPlacement(source: Box[], proposed: Box[]): boolean {
  const originals = new Map(source.map((row) => [key(row), row])),
    containers = new Set(source.filter(isContainer).map(key));
  for (const row of proposed) {
    const old = originals.get(key(row));
    if (!old) {
      if (placementFields.some((field) => row[field] != null && row[field] !== '')) return true;
      continue;
    }
    if (
      (isContainer(old) && !isContainer(row)) ||
      String(old.layoutOwner || '') !== String(row.layoutOwner || '') ||
      (!on(old.layoutAbsolute) && on(row.layoutAbsolute))
    )
      return true;
    if (
      (isContainer(old) || old.layoutOwner || containers.has(ownership(old))) &&
      placementFields.some((field) => old[field] !== row[field])
    )
      return true;
  }
  return false;
}

interface SourceEditState {
  evaluated: Box[];
  next: Box[];
  originals: Map<string, Box>;
  visible: Map<string, Box>;
  requested: Map<string, Box>;
  byId: Map<string, Box>;
  disabled: Set<string>;
  moves: Map<string, Set<string>>;
}
function rowIntent(fc: FcCtx, state: SourceEditState, initial: Box): Box {
  const { next, originals, visible, requested, byId, disabled, moves } = state;
  let row = initial;
  const old = originals.get(String(row[fc.cfg.idField] || '')),
    shown = visible.get(key(row)),
    wanted = requested.get(key(row))!;
  if (disabled.has(key(row))) {
    row = {
      ...row,
      x: shown?.x ?? row.x,
      y: shown?.y ?? row.y,
      w: shown?.w ?? row.w,
      h: shown?.h ?? row.h,
      rot: shown?.rot ?? row.rot,
    };
  }
  const oldOwner = old ? ownership(old) : '',
    newOwner = String(row.layoutOwner || '');
  const disabledOwner = ownership(row);
  if (disabled.has(disabledOwner))
    row = materialize(
      row,
      shown,
      byId.get(disabledOwner)?.kind === 'frame'
        ? disabledOwner
        : containingFrame(byId.get(disabledOwner)!, byId)
    );
  else if (old?.layoutOwner && !newOwner)
    row = materialize(
      row,
      wanted,
      shown?.frame ? String(shown.frame) : containingFrame(old, originals)
    );
  else if (newOwner) {
    const parent = byId.get(newOwner),
      parentShown = visible.get(newOwner) || parent;
    if (!isContainer(parent)) throw new Error(t('Choose an existing layout container.'));
    row = { ...row, frame: '' };
    const parentBefore = visible.get(newOwner),
      parentWanted = requested.get(newOwner);
    const parentMoved =
      parentBefore &&
      parentWanted &&
      (parentBefore.x !== parentWanted.x || parentBefore.y !== parentWanted.y);
    const attached = String(old?.layoutOwner || '') !== newOwner,
      absolute = on(row.layoutAbsolute),
      moved = !parentMoved && shown && (wanted.x !== shown.x || wanted.y !== shown.y),
      resized = shown && (wanted.w !== shown.w || wanted.h !== shown.h);
    if (attached) {
      row.layoutOrder = row.layoutOrder ?? next.filter((r) => ownership(r) === newOwner).length - 1;
      if (
        parent?.layout === 'grid' &&
        wanted.layoutRow === old?.layoutRow &&
        wanted.layoutColumn === old?.layoutColumn
      ) {
        row.layoutRow = 0;
        row.layoutColumn = 0;
        row.layoutArea = '';
      }
    }
    if (
      attached ||
      (absolute && (!on(old?.layoutAbsolute) || moved || resized)) ||
      (shown && wanted.rot !== shown.rot)
    ) {
      const placement = relativePlacement(wanted, parentShown!);
      if (absolute || attached) {
        if (old || row.layoutX == null || row.layoutX === '') row.layoutX = placement.layoutX;
        if (old || row.layoutY == null || row.layoutY === '') row.layoutY = placement.layoutY;
      }
      if (old || row.layoutAngle == null || row.layoutAngle === '')
        row.layoutAngle = placement.layoutAngle;
    }
    if (
      !absolute &&
      moved &&
      old &&
      oldOwner === newOwner &&
      row.layoutOrder === old.layoutOrder &&
      row.layoutRow === old.layoutRow &&
      row.layoutColumn === old.layoutColumn
    ) {
      const ids = moves.get(newOwner) || new Set<string>();
      ids.add(key(row));
      moves.set(newOwner, ids);
    }
    // Child positions are owned by flow or local absolute offsets.
    if (old && oldOwner === newOwner) {
      row.x = old.x;
      row.y = old.y;
      if (shown && wanted.rot !== shown.rot) row.rot = old.rot;
    }
  }
  return row;
}
function applyFlowMoves(fc: FcCtx, state: SourceEditState): void {
  const { evaluated, next, byId, requested, visible, moves } = state;
  const gridMap = new Map(grids(fc).map((g) => [g.id, g]));
  for (const [parentId, moving] of moves) {
    const parent = byId.get(parentId)!,
      at = requested.get([...moving][0]!)!,
      shownParent = visible.get(parentId) || parent;
    if (parent.layout === 'grid') {
      const grid = gridMap.get(parentId);
      if (!grid)
        throw new Error(t('Wait for the grid to finish rendering before moving its layers.'));
      const cell = gridCellAt(
        shownParent,
        grid,
        scalar(at.x) + scalar(at.w) / 2,
        scalar(at.y) + scalar(at.h) / 2
      );
      for (const row of next)
        if (moving.has(key(row))) Object.assign(row, cell, { layoutArea: '' });
    } else {
      const order = flowOrder(evaluated, shownParent, moving, at);
      for (const row of next) if (order.has(key(row))) row.layoutOrder = order.get(key(row));
    }
  }
}

export function sourceEdit(fc: FcCtx, source: Box[], proposed: Box[], groupSizeAxes?: ReadonlyMap<string, ReadonlySet<'W' | 'H'>>): Box[] {
  if (fc.blockId !== 'boxes' || (!sourceHasLayout(source) && !sourceHasLayout(proposed)))
    return proposed;
  const evaluated = project(fc, source),
    originals = new Map(source.map((r) => [key(r), r])),
    visible = new Map(evaluated.map((r) => [key(r), r]));
  if (
    sourceHasLayout(source) &&
    evaluated === source &&
    needsEvaluatedPlacement(source, proposed) &&
    !validateDesignLayout(source, tracks(fc)).length
  )
    throw new Error(placementWait());
  const requested = new Map(proposed.map((r) => [key(r), r]));
  const next = designLayoutSourceEdit(source, evaluated, proposed, { groupSizeAxes }) as Box[];
  const byId = new Map(next.map((r) => [key(r), r]));
  const disabled = new Set(
    source
      .filter((r) => isContainer(r) && byId.has(key(r)) && !isContainer(byId.get(key(r))))
      .map(key)
  );
  // Enabling a layout on a static artboard converts existing membership to one source owner.
  for (const parent of next)
    if (
      isContainer(parent) &&
      !isContainer(originals.get(key(parent))) &&
      parent.kind === 'frame'
    ) {
      let order = 0;
      for (const row of next)
        if (!row.layoutOwner && row.frame === parent.id) {
          row.layoutOwner = parent.id;
          row.frame = '';
          row.layoutOrder = order++;
        }
    }
  const moves = new Map<string, Set<string>>();
  const state: SourceEditState = {
    evaluated,
    next,
    originals,
    visible,
    requested,
    byId,
    disabled,
    moves,
  };
  for (let n = 0; n < next.length; n++) {
    const row = rowIntent(fc, state, next[n]!);
    next[n] = row;
    byId.set(key(row), row);
  }
  applyFlowMoves(fc, state);

  const findings = validateDesignLayout(
    next,
    tracks(fc).filter(
      (r) =>
        isContainer(byId.get(String(r.container))) &&
        byId.get(String(r.container))?.layout === 'grid'
    )
  );
  if (findings.length) throw new Error(findings[0]!.message);
  return next;
}
export function tracks(fc: FcCtx): Box[] {
  const value = fc.runtime.getModel().find((i) => i.id === 'layoutTracks')?.value;
  return Array.isArray(value) ? value : [];
}
export function trackPatch(fc: FcCtx, boxes: Box[]): Record<string, unknown> {
  if (fc.blockId !== 'boxes') return {};
  const old = tracks(fc),
    ids = new Set(boxes.filter((b) => b.layout === 'grid').map(key)),
    next = old.filter((r) => ids.has(String(r.container)));
  return next.length === old.length ? {} : { layoutTracks: next };
}

/** Drop reassigns ownership before source restoration. Alt releases a child from flow. */
export function drop(
  fc: FcCtx,
  before: Box[],
  proposed: Box[],
  moved: number[],
  detach: boolean
): Box[] {
  if (fc.blockId !== 'boxes' || !hasDesignLayout(before)) return proposed;
  const movedIds = new Set(moved.map((i) => key(before[i]!))),
    forbidden = dynamicScope(before, movedIds),
    byId = new Map(before.map((r) => [key(r), r]));
  const movedIndices = new Set(moved);
  const containers = before
    .filter(
      (parent) =>
        isContainer(parent) &&
        !forbidden.has(key(parent)) &&
        !on(parent.hidden) &&
        !on(parent.locked)
    )
    .reverse();
  return proposed.map((row, i) => {
    if (!movedIndices.has(i)) return row;
    if (detach)
      return before[i]?.layoutOwner
        ? { ...row, layoutOwner: '', frame: containingFrame(before[i]!, byId) }
        : row;
    const center = { x: scalar(row.x) + scalar(row.w) / 2, y: scalar(row.y) + scalar(row.h) / 2 };
    const candidate = containers.find((parent) => {
      const p = localPoint(parent, center.x, center.y);
      return p.x >= 0 && p.y >= 0 && p.x <= scalar(parent.w) && p.y <= scalar(parent.h);
    });
    if (candidate && key(candidate) !== ownership(before[i]!)) {
      const projection = grids(fc).find((grid) => grid.id === key(candidate));
      const cell = projection
        ? gridCellAt(candidate, projection, center.x, center.y)
        : { layoutRow: 0, layoutColumn: 0 };
      return {
        ...row,
        layoutOwner: candidate.id,
        frame: '',
        layoutOrder: undefined,
        ...cell,
        layoutArea: '',
      };
    }
    return row;
  });
}

/** Arrow keys reorder flow items and move grid cells; absolute items keep pixel nudging. */
export function nudge(
  fc: FcCtx,
  before: Box[],
  proposed: Box[],
  indices: number[],
  dx: number,
  dy: number,
  step: number
): Box[] {
  if (fc.blockId !== 'boxes' || !sourceHasLayout(before)) return proposed;
  const selected = new Set(indices.map((index) => key(before[index]!))),
    parents = new Map(before.filter(isContainer).map((parent) => [key(parent), parent]));
  const groups = new Map<string, Set<string>>();
  for (const row of before)
    if (selected.has(key(row)) && !on(row.layoutAbsolute) && parents.has(ownership(row))) {
      const ids = groups.get(ownership(row)) || new Set<string>();
      ids.add(key(row));
      groups.set(ownership(row), ids);
    }
  const changes = new Map<string, Partial<Box>>(),
    projections = new Map(grids(fc).map((grid) => [grid.id, grid]));
  for (const [parentId, ids] of groups) {
    const parent = parents.get(parentId)!,
      axis = basis(parent),
      localX = dx * axis.ux + dy * axis.uy,
      localY = dx * axis.vx + dy * axis.vy;
    if (parent.layout === 'grid') {
      const grid = projections.get(parentId);
      if (!grid) continue;
      const placements = new Map(grid.cells?.map((cell) => [cell.id, cell]));
      const horizontal = Math.abs(localX) >= Math.abs(localY),
        delta = Math.sign(horizontal ? localX : localY) * step;
      for (const row of before)
        if (ids.has(key(row))) {
          const placement = placements.get(key(row));
          const cell = placement
            ? { layoutRow: placement.row, layoutColumn: placement.column }
            : gridCellAt(
                parent,
                grid,
                scalar(row.x) + scalar(row.w) / 2,
                scalar(row.y) + scalar(row.h) / 2
              );
          if (horizontal)
            cell.layoutColumn = Math.max(1, Math.min(1024, cell.layoutColumn + delta));
          else cell.layoutRow = Math.max(1, Math.min(1024, cell.layoutRow + delta));
          changes.set(key(row), { ...cell, layoutArea: '' });
        }
    } else {
      const vertical = String(parent.layoutDirection || 'row').startsWith('column'),
        reverse = String(parent.layoutDirection).endsWith('reverse');
      const sign = Math.sign(vertical ? localY : localX) * (reverse ? -1 : 1);
      if (!sign) continue;
      const members = before
        .filter((row) => ownership(row) === parentId && !on(row.layoutAbsolute) && !on(row.hidden))
        .map((row, index) => ({ row, index }))
        .sort(
          (a, b) =>
            scalar(a.row.layoutOrder ?? a.index) - scalar(b.row.layoutOrder ?? b.index) ||
            a.index - b.index
        )
        .map((item) => item.row);
      for (let distance = 0; distance < step; distance++) {
        if (sign > 0) {
          for (let n = members.length - 2; n >= 0; n--)
            if (ids.has(key(members[n]!)) && !ids.has(key(members[n + 1]!)))
              [members[n], members[n + 1]] = [members[n + 1]!, members[n]!];
        } else {
          for (let n = 1; n < members.length; n++)
            if (ids.has(key(members[n]!)) && !ids.has(key(members[n - 1]!)))
              [members[n], members[n - 1]] = [members[n - 1]!, members[n]!];
        }
      }
      members.forEach((row, order) => {
        changes.set(key(row), { layoutOrder: order });
      });
    }
  }
  return proposed.map((row) =>
    changes.has(key(row)) ? { ...row, ...changes.get(key(row)) } : row
  );
}

/** A deep copy includes tracks and all descendants but preserves paint order. */
export function duplicate(fc: FcCtx): boolean {
  const boxes = fc.select.getBoxes();
  const pickedIds = fc.modes.copyScope(boxes, fc.select.selIndices(boxes)),
    selected = boxes.filter((row) => pickedIds.has(key(row)));
  if (!selected.some((b) => isContainer(b) || b.layoutOwner)) return false;
  if (!placementReady(fc)) return true;
  const raw = fc.runtime.getModel().find((i) => i.id === fc.blockId)?.value as Box[];
  const sourceMap = new Map((Array.isArray(raw) ? raw : boxes).map((r) => [key(r), r]));
  const pool = boxes.slice(),
    copies = new Map<string, string>();
  for (const row of selected) {
    const id = fc.select.freshId(pool);
    copies.set(key(row), id);
    pool.push({ id });
  }
  const source = selected.map((row) => sourceMap.get(key(row)) || row),
    remapped = remapDesignLayout(source, tracks(fc), copies);
  const isPage = selected.some((b) => b.kind === 'frame');
  const dx = isPage
    ? Math.max(...boxes.filter((b) => b.kind === 'frame').map((b) => scalar(b.x) + scalar(b.w))) +
      fc.FRAME_DUP_GAP -
      Math.min(...selected.filter((b) => b.kind === 'frame').map((b) => scalar(b.x)))
    : 24;
  const refs = fc.ops.dupRefFields();
  const clones = remapped.boxes.map((box, n) => {
    const row = { ...box } as Box,
      original = selected[n]!;
    for (const field of refs)
      if (copies.has(String(original[field]))) row[field] = copies.get(String(original[field]));
    if (!original.layoutOwner) {
      row.x = scalar(original.x) + dx;
      row.y = scalar(original.y) + (isPage ? 0 : 24);
    } else if (!pickedIds.has(String(original.layoutOwner)) && on(original.layoutAbsolute)) {
      const parent = boxes.find((box) => key(box) === String(original.layoutOwner));
      if (parent)
        Object.assign(
          row,
          relativePlacement(
            { ...original, x: scalar(original.x) + dx, y: scalar(original.y) + (isPage ? 0 : 24) },
            parent
          )
        );
    }
    if (row.kind === 'frame')
      row.order =
        Math.max(-1, ...boxes.filter((b) => b.kind === 'frame').map((b) => scalar(b.order))) +
        1 +
        n;
    return row;
  });
  const nextTracks = [
    ...tracks(fc),
    ...remapped.tracks.map((row) => ({ ...row, id: fc.select.freshId(pool) })),
  ];
  const selectedCopies = new Set([...fc.selection].map((id) => copies.get(id)!).filter(Boolean));
  const patch = remapped.tracks.length ? { layoutTracks: nextTracks } : {};
  if (pickedIds.size && selected.some((b) => b[fc.cv.textStoryField!]))
    void fc.storyFlow.duplicate([...boxes, ...clones], copies, selectedCopies, patch);
  else {
    fc.selection = selectedCopies;
    fc.select.commit([...boxes, ...clones], patch, t('Duplicate layout'));
  }
  return true;
}

function failure(error: unknown): void {
  announce(error instanceof Error ? error.message : String(error), { assertive: true });
}
function commitGap(fc: FcCtx, id: string, field: string, value: number): void {
  fc.select.commit(
    fc.select
      .getBoxes()
      .map((row) => (key(row) === id ? { ...row, [field]: Math.max(0, value) } : row)),
    {},
    t('Change layout spacing')
  );
}
function gapControl(
  fc: FcCtx,
  root: HTMLElement,
  parent: Box,
  field: string,
  x: number,
  y: number,
  axis: 'x' | 'y',
  label: string
): void {
  const m = fc.stage.metrics(),
    point = fc.stage.nativeToStage(x, y, m),
    button = root.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'fc-layout-spacing';
  button.dataset.layoutSpacing = field;
  button.textContent = String(Math.round(scalar(parent[field])));
  button.title = label;
  button.setAttribute('aria-label', `${label}: ${button.textContent}`);
  Object.assign(button.style, {
    position: 'absolute',
    left: `${point.x}px`,
    top: `${point.y}px`,
    transform: 'translate(-50%,-50%)',
    pointerEvents: 'auto',
    fontSize: '10px',
    border: '1px solid currentColor',
    borderRadius: '4px',
    color: 'hsl(var(--primary))',
    background: 'var(--ui-color-surface-raised)',
    cursor: axis === 'x' ? 'ew-resize' : 'ns-resize',
  });
  button.addEventListener('keydown', (event) => {
    const sign =
      event.key === 'ArrowRight' || event.key === 'ArrowUp'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowDown'
          ? -1
          : 0;
    if (!sign) return;
    event.preventDefault();
    event.stopPropagation();
    commitGap(fc, key(parent), field, scalar(parent[field]) + sign * (event.shiftKey ? 10 : 1));
  });
  button.addEventListener('pointerdown', (event) => {
    if (fc.opts?.canEdit?.() === false || event.button !== 0 || fc.gesture) return;
    event.preventDefault();
    event.stopPropagation();
    spacingGestures.add(fc);
    const start = fc.stage.clientToNative(event.clientX, event.clientY),
      p = basis(parent),
      old = scalar(parent[field]);
    let value = old;
    try {
      button.setPointerCapture(event.pointerId);
    } catch {
      /* Capture is optional in older shells. */
    }
    const move = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      const at = fc.stage.clientToNative(ev.clientX, ev.clientY),
        dx = at.x - start.x,
        dy = at.y - start.y;
      value = Math.max(
        0,
        Math.round(old + (axis === 'x' ? dx * p.ux + dy * p.uy : dx * p.vx + dy * p.vy))
      );
      button.textContent = String(value);
    };
    const finish = (ev: PointerEvent) => {
      if (ev.pointerId !== event.pointerId) return;
      button.removeEventListener('pointermove', move);
      button.removeEventListener('pointerup', finish);
      button.removeEventListener('pointercancel', finish);
      spacingGestures.delete(fc);
      if (ev.type !== 'pointercancel' && value !== old) commitGap(fc, key(parent), field, value);
      else button.textContent = String(old);
    };
    button.addEventListener('pointermove', move);
    button.addEventListener('pointerup', finish);
    button.addEventListener('pointercancel', finish);
  });
  root.append(button);
}
function paintFlowInsertion(
  fc: FcCtx,
  svg: SVGSVGElement,
  parent: Box,
  boxes: Box[],
  selected: Box | undefined
): void {
  if (!selected || parent.layout !== 'flex' || fc.gesture?.type !== 'move' || !fc.gesture.moveDelta)
    return;
  const moved = {
    ...selected,
    x: scalar(selected.x) + fc.gesture.moveDelta.dx,
    y: scalar(selected.y) + fc.gesture.moveDelta.dy,
  };
  const points = flowDropMarker(parent, boxes, new Set([key(selected)]), moved);
  if (points.length !== 2) return;
  const m = fc.stage.metrics(),
    a = fc.stage.nativeToStage(points[0]!.x, points[0]!.y, m),
    b = fc.stage.nativeToStage(points[1]!.x, points[1]!.y, m);
  const line = svg.ownerDocument.createElementNS(svg.namespaceURI, 'line');
  line.setAttribute('data-layout-insertion', '');
  line.setAttribute('x1', String(a.x));
  line.setAttribute('y1', String(a.y));
  line.setAttribute('x2', String(b.x));
  line.setAttribute('y2', String(b.y));
  line.setAttribute('stroke', 'hsl(var(--primary))');
  line.setAttribute('stroke-width', '3');
  svg.append(line);
}
/** The grid lines are the same modern-solver track anchors used for placement. */
export function paint(fc: FcCtx): void {
  let root = layers.get(fc);
  if (!root && fc.overlay) {
    root = fc.overlay.ownerDocument.createElement('div');
    root.className = 'fc-layout-overlay';
    root.setAttribute('data-export-hide', '');
    root.style.pointerEvents = 'none';
    fc.overlay.insertBefore(root, fc.chrome);
    layers.set(fc, root);
  }
  if (!root) return;
  if (spacingGestures.has(fc)) return;
  root.replaceChildren();
  if (fc.editing || fc.penEdit || fc.penDraft || fc.selection.size !== 1) return;
  const boxes = fc.select.getBoxes(),
    selected = boxes.find((b) => fc.selection.has(key(b)));
  const parent = isContainer(selected)
    ? selected
    : boxes.find((b) => key(b) === selected?.layoutOwner);
  if (!parent || !isContainer(parent)) return;
  const m = fc.stage.metrics(),
    svg = root.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'svg');
  Object.assign(svg.style, {
    position: 'absolute',
    inset: '0',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    pointerEvents: 'none',
  });
  const polygon = (points: Array<{ x: number; y: number }>, highlight = false) => {
    if (!points.length) return;
    const node = root!.ownerDocument.createElementNS(svg.namespaceURI, 'polygon');
    node.setAttribute(
      'points',
      points
        .map((p) => {
          const q = fc.stage.nativeToStage(p.x, p.y, m);
          return `${q.x},${q.y}`;
        })
        .join(' ')
    );
    node.setAttribute('fill', highlight ? 'hsl(var(--primary) / .12)' : 'none');
    node.setAttribute('stroke', 'hsl(var(--primary))');
    node.setAttribute('stroke-width', '1');
    node.setAttribute('stroke-dasharray', '3 3');
    svg.append(node);
  };
  const grid = grids(fc).find((g) => g.id === key(parent));
  if (grid) {
    // A large imported grid stays usable without allocating a million SVG nodes.
    const cols = grid.columns.length,
      rows = grid.rows.length;
    for (let column = 1; column <= cols; column++) {
      const first = gridCellPolygon(parent, grid, 1, column),
        last = gridCellPolygon(parent, grid, rows, column);
      if (first.length && last.length) polygon([first[0]!, first[1]!, last[2]!, last[3]!]);
    }
    for (let row = 1; row <= rows; row++) {
      const first = gridCellPolygon(parent, grid, row, 1),
        last = gridCellPolygon(parent, grid, row, cols);
      if (first.length && last.length) polygon([first[0]!, last[1]!, last[2]!, first[3]!]);
    }
    if (selected && selected !== parent) {
      const at =
        fc.gesture?.type === 'move' && fc.gesture.moveDelta
          ? {
              x: scalar(selected.x) + fc.gesture.moveDelta.dx + scalar(selected.w) / 2,
              y: scalar(selected.y) + fc.gesture.moveDelta.dy + scalar(selected.h) / 2,
            }
          : {
              x: scalar(selected.x) + scalar(selected.w) / 2,
              y: scalar(selected.y) + scalar(selected.h) / 2,
            };
      const cell = gridCellAt(parent, grid, at.x, at.y);
      polygon(gridCellPolygon(parent, grid, cell.layoutRow, cell.layoutColumn), true);
    }
  } else {
    const children = boxes.filter(
      (b) => ownership(b) === key(parent) && !on(b.layoutAbsolute) && !on(b.hidden)
    );
    for (const child of children) {
      const b = basis(child);
      polygon([
        worldPoint(child, 0, 0),
        worldPoint(child, scalar(child.w), 0),
        worldPoint(child, scalar(child.w), scalar(child.h)),
        { x: b.x + b.vx * scalar(child.h), y: b.y + b.vy * scalar(child.h) },
      ]);
    }
  }
  paintFlowInsertion(fc, svg, parent, boxes, selected);
  root.append(svg);
  if (fc.gesture) return;
  const px = worldPoint(
    parent,
    scalar(parent.layoutPadLeft) + Math.max(12, scalar(parent.w) / 2),
    scalar(parent.layoutPadTop)
  );
  const py = worldPoint(
    parent,
    scalar(parent.layoutPadLeft),
    scalar(parent.layoutPadTop) + Math.max(12, scalar(parent.h) / 2)
  );
  gapControl(fc, root, parent, 'layoutGapX', px.x, px.y, 'x', t('Column gap'));
  gapControl(fc, root, parent, 'layoutGapY', py.x, py.y, 'y', t('Row gap'));
}
export function layoutOps(fc: FcCtx) {
  return {
    has: sourceHasLayout,
    placementReady: bindOp(fc, placementReady),
    requirePlacement: bindOp(fc, requirePlacement),
    gestureReady: bindOp(fc, gestureReady),
    project: bindOp(fc, project),
    sourceEdit: bindOp(fc, sourceEdit),
    duplicate: bindOp(fc, duplicate),
    dynamicScope: (boxes: Box[], selected: ReadonlySet<string>) => dynamicScope(boxes, selected),
    trackPatch: bindOp(fc, trackPatch),
    grids: bindOp(fc, grids),
    drop: bindOp(fc, drop),
    nudge: bindOp(fc, nudge),
    paint: bindOp(fc, paint),
    tracks: bindOp(fc, tracks),
    failure,
  };
}
