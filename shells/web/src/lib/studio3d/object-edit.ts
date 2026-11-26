// SPDX-License-Identifier: MPL-2.0
/**
 * The saved edits for one placed object in 3D Studio (plan 368, W3): a move, a lift, a
 * turn, a scale, a copy, a removal and a rest on the stage. The canvas gestures, the
 * handles and the bar all build their edits here, so a change made by a drag, a key or a
 * button writes the same values.
 *
 * An arrangement row and the lone subject take the same calls. Row 0 of a lone subject
 * is the scene's own `position`, `rotation` and `transform` inputs, which the sidebar shows
 * under Expert; the engine's edit builder bounds an arrangement row
 * (engine/src/studio3d-arrangement.ts).
 */
import {
  STUDIO_ARRANGEMENT_EXTENT,
  STUDIO_ARRANGEMENT_LIMIT,
  studioArrangementRows,
  studioObjectEdit,
  studioObjectId,
} from '../../../../../engine/src/studio3d-arrangement.ts';
import type { StudioVector3 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { tRaw } from '../../i18n.ts';
import type { StudioControls } from './controls.ts';
import { studioClampScale, studioWrapDegrees } from './handle-geometry.ts';

export interface StudioEdit {
  id: string;
  value: unknown;
}

/** How far the lone subject may move from the centre: its position input's own range. */
const LONE_EXTENT = 5;

const round = (n: number): number => Math.round(n * 1000) / 1000;
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};

/** The place of one object now, as the recipe on screen holds the object. */
export interface StudioObjectPlace {
  position: StudioVector3;
  rotation: StudioVector3;
  scale: number;
  grounded: boolean;
}

export function objectPlace(entry: StudioControls, row: number): StudioObjectPlace | null {
  const spec = entry.recipe.objects ? entry.recipe.objects[row] : { transform: entry.recipe.transform, grounded: true };
  if (!spec) return null;
  const { position, rotation, scale } = spec.transform;
  return {
    position: [...position] as StudioVector3,
    rotation: [...rotation] as StudioVector3,
    scale,
    grounded: spec.grounded,
  };
}

/** How far from the centre an object may stand, on either axis. */
export function positionLimit(entry: StudioControls): number {
  return entry.recipe.objects ? STUDIO_ARRANGEMENT_EXTENT : LONE_EXTENT;
}

/**
 * A move along the floor or a lift. An arrangement row takes only the axes given, so a
 * move along the floor writes no height the row did not have; the lone subject's position
 * is one input and takes all three.
 */
export function moveEdits(
  entry: StudioControls,
  row: number,
  position: StudioVector3,
  axes: readonly ('x' | 'y' | 'z')[] = ['x', 'y', 'z']
): StudioEdit[] {
  const [x, y, z] = position;
  if (entry.recipe.objects) {
    const all = { x, y, z };
    return [studioObjectEdit(entry.inputValues, row, Object.fromEntries(axes.map((axis) => [axis, all[axis]])))];
  }
  const bound = (n: number): number => round(Math.max(-LONE_EXTENT, Math.min(LONE_EXTENT, n)));
  return [{ id: 'position', value: { x: bound(x), y: bound(y), z: bound(z) } }];
}

/** A turn, a tilt or a lean: the row's rotation, or the subject's Turn and tilt. */
export function turnEdits(entry: StudioControls, row: number, rotation: StudioVector3): StudioEdit[] {
  const [x, y, z] = rotation.map((angle) => Math.round(studioWrapDegrees(angle)) || 0) as StudioVector3;
  if (entry.recipe.objects) return [studioObjectEdit(entry.inputValues, row, { rotX: x, rotY: y, rotZ: z })];
  // Words face the camera until they are given the object's pose, so a turn gives them one.
  const pose = entry.inputValues.source === 'text' && entry.inputValues.wordPose !== 'scene'
    ? [{ id: 'wordPose', value: 'scene' }]
    : [];
  return [{ id: 'rotation', value: { x, y, z } }, ...pose];
}

/** A uniform scale, held in 0.1 to 5: the row's scale, or the subject's Object scale. */
export function scaleEdits(entry: StudioControls, row: number, scale: number): StudioEdit[] {
  const value = studioClampScale(scale);
  if (entry.recipe.objects) return [studioObjectEdit(entry.inputValues, row, { scale: value })];
  return [{ id: 'transform', value: { ...record(entry.inputValues.transform), scale: value } }];
}

/**
 * Rest on the stage: no height, and an arrangement row stands on the floor again. Null
 * when the object already rests there.
 */
export function restEdits(entry: StudioControls, row: number): StudioEdit[] | null {
  const place = objectPlace(entry, row);
  if (!place || (place.position[1] === 0 && place.grounded)) return null;
  if (!entry.recipe.objects) return moveEdits(entry, row, [place.position[0], 0, place.position[2]]);
  const rows = studioArrangementRows(entry.inputValues);
  return [{ id: 'objects', value: rows.map((r, i) => (i === row ? { ...r, y: 0, grounded: true } : r)) }];
}

/** The id each row has now: the authored one, or the one the row's place gives. Null where two rows already clash. */
function rowIds(rows: Record<string, unknown>[]): string[] | null {
  const taken = new Set<string>();
  try {
    return rows.map((row, index) => studioObjectId(row, index, taken));
  } catch {
    return null;
  }
}

/** Whether an arrangement has room for a copy of one more object. */
export function canDuplicate(entry: StudioControls): boolean {
  return !!entry.recipe.objects && entry.recipe.objects.length < STUDIO_ARRANGEMENT_LIMIT;
}

/**
 * A copy of one arrangement row, added at the end and selected, standing `offset` units to
 * one side so the two do not overlap. The copy takes no authored id, so the arrangement
 * gives it one by its place in the list, and a named row's copy takes the row's name.
 * Where another row already holds that id (someone typed `object-3` into a two-row
 * arrangement), the copy takes the next free one, because two rows with one id cannot
 * be drawn.
 */
export function duplicateEdits(entry: StudioControls, row: number, offset: number): StudioEdit[] {
  const rows = studioArrangementRows(entry.inputValues);
  const source = rows[row];
  if (!source || !canDuplicate(entry)) return [];
  const { id: _id, ...copy } = source;
  const ids = rowIds(rows);
  let id: string | null = null;
  if (ids?.includes(`object-${rows.length + 1}`)) {
    let n = rows.length + 2;
    while (ids.includes(`object-${n}`)) n++;
    id = `object-${n}`;
  }
  const x = Number(entry.recipe.objects?.[row]?.transform.position[0] ?? 0);
  const right = x + offset <= STUDIO_ARRANGEMENT_EXTENT;
  const name = String(source.name ?? '').trim();
  return [
    {
      id: 'objects',
      value: [
        ...rows,
        {
          ...copy,
          ...(id ? { id } : {}),
          ...(name ? { name: tRaw('{name} copy', { name }) } : {}),
          x: round(Math.max(-STUDIO_ARRANGEMENT_EXTENT, Math.min(STUDIO_ARRANGEMENT_EXTENT, right ? x + offset : x - offset))),
        },
      ],
    },
    { id: 'activeObject', value: rows.length + 1 },
  ];
}

/**
 * Whether one arrangement row can go: another row must stay, and one of those left must
 * still show something, since an arrangement with nothing to show cannot render.
 */
export function canRemove(entry: StudioControls, row: number): boolean {
  const objects = entry.recipe.objects;
  return !!objects && objects.length > 1 && objects.some((object, i) => i !== row && object.visible && !object.pending);
}

/**
 * Take one row out of the arrangement; the row before it becomes the selected one. A row
 * with no authored id takes its id from its place, so the rows after the gap would each
 * take a new one. Where that makes two rows clash, the rows left keep the ids they had.
 */
export function removeEdits(entry: StudioControls, row: number): StudioEdit[] {
  if (!canRemove(entry, row)) return [];
  const rows = studioArrangementRows(entry.inputValues);
  const before = rowIds(rows);
  let left = rows.filter((_, i) => i !== row);
  if (before && !rowIds(left)) {
    const kept = before.filter((_, i) => i !== row);
    left = left.map((r, i) => (String(r.id ?? '').trim() ? r : { ...r, id: kept[i] }));
  }
  return [
    { id: 'objects', value: left },
    { id: 'activeObject', value: Math.max(1, Math.min(rows.length - 1, row)) },
  ];
}
