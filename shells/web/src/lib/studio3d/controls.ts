// SPDX-License-Identifier: MPL-2.0
import * as THREE from 'three';
import {
  STUDIO_ARRANGEMENT_EXTENT,
  studioActiveObject,
  studioObjectEdit,
  studioObjectSelect,
} from '../../../../../engine/src/studio3d-arrangement.ts';
import {
  studioCameraEdit,
  studioFocusEdit,
  type StudioValues,
} from '../../../../../engine/src/studio3d-collection.ts';
import {
  studioLightEdit,
  studioOrbitLight,
  studioPlaceableLights,
  studioScaleLightDistance,
} from '../../../../../engine/src/studio3d-lights.ts';
import type { StudioSceneV1, StudioVector3 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { tRaw } from '../../i18n.ts';
import type { StageKitPort } from '../stage-kit.ts';
import type { StudioRenderer } from './renderer.ts';

export interface StudioControls {
  canvas: HTMLCanvasElement;
  marker: HTMLElement;
  handle: StudioRenderer;
  ready: boolean;
  recipe: StudioSceneV1;
  inputValues: StudioValues;
  inputCamera: StudioValues;
  options: {
    setInput?: (id: string, value: unknown) => void;
    /** Write several inputs as one undo step. Without it each input is written on its own. */
    commitMany?: (values: Record<string, unknown>, label: string) => void;
    endGesture?: () => void;
    addObjects?: () => void;
    reviewCollection?: () => void;
    /** The stage kit the studio's controls are drawn in. Absent: the studio draws none. */
    chrome?: StageKitPort | null;
  };
  /** The light the Move lights mode acts on; chrome state, never saved. */
  selectedLight?: number;
  /** The source notes the Info panel shows; empty until the scene has loaded. */
  notes?: string;
  /** The status sentence on show, and whether it reports one action rather than the mode. */
  status?: { text: string; once: boolean };
  /** Draw the controls again from the current state; set by lib/studio3d/toolbar.ts. */
  refreshChrome?: () => void;
  render(quality: 'preview'): void;
}

/** The pointer modes. Orbit is the rest state; Pick focus waits for one press. */
export type StudioMode = 'orbit' | 'move' | 'turn' | 'lights' | 'focus';

/**
 * Write edits. One gesture or one key press is one undo step: the history's gesture is
 * closed before and after, and edits to several inputs go through `commitMany`, which the
 * history keeps as one step (views/tool-transaction.ts).
 */
export function commit(entry: StudioControls, label: string, ...edits: { id: string; value: unknown }[]): void {
  if (!edits.length) return;
  if (entry.canvas.ownerDocument?.activeElement === entry.canvas) entry.canvas.dataset.restoreFocus = 'canvas';
  const ids = new Set(edits.map((edit) => edit.id));
  if (ids.size > 1 && entry.options.commitMany) {
    entry.options.commitMany(Object.fromEntries(edits.map((edit) => [edit.id, edit.value])), label);
    return;
  }
  entry.options.endGesture?.();
  for (const edit of edits) entry.options.setInput?.(edit.id, edit.value);
  entry.options.endGesture?.();
}
export function cameraEdit(entry: StudioControls, values: StudioValues): void {
  commit(entry, 'Camera', studioCameraEdit(entry.inputValues, { ...entry.inputCamera, ...values }));
}
/** The primary pointer is a finger: status lines name no keys there. */
export function coarsePointer(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}
/**
 * Show one sentence in the stage kit's status line. `once` marks a report of one action;
 * the next press on the canvas puts the mode's own sentence back.
 */
export function note(entry: StudioControls, text: string, once = true): void {
  entry.status = { text, once: once && !!text };
  entry.options.chrome?.setStatus(text);
}
export function studioMode(entry: StudioControls): StudioMode {
  const flags = entry.canvas.dataset;
  if (flags.pickFocus === 'true') return 'focus';
  if (flags.moveLight === 'true') return 'lights';
  if (flags.turnObject === 'true') return 'turn';
  if (flags.moveObject === 'true') return 'move';
  return 'orbit';
}
export function arranging(entry: StudioControls): boolean {
  return studioMode(entry) === 'move';
}
export function turnsObject(entry: StudioControls): boolean {
  return studioMode(entry) === 'turn';
}
export function relighting(entry: StudioControls): boolean {
  return studioMode(entry) === 'lights';
}
export function lightName(entry: StudioControls, index: number): string {
  const id = entry.recipe.lights[index]?.id ?? '';
  const names: Record<string, string> = { key: tRaw('Key light'), fill: tRaw('Fill light'), rim: tRaw('Rim light') };
  return names[id] ?? tRaw('Light {n}', { n: id.replace('light-', '') });
}
export function selectedLight(entry: StudioControls): number {
  const placeable = studioPlaceableLights(entry.recipe);
  const current = entry.selectedLight ?? placeable[0] ?? 0;
  return placeable.includes(current) ? current : (placeable[0] ?? 0);
}
/** The sentence a mode shows while it is on, worded for the pointer in use. */
export function modeStatus(entry: StudioControls, mode: StudioMode): string {
  const touch = coarsePointer();
  switch (mode) {
    case 'focus':
      return touch ? tRaw('Tap the subject to set the focus.') : tRaw('Click the subject to set the focus, or press Escape to cancel.');
    case 'lights': {
      const light = lightName(entry, selectedLight(entry));
      return touch
        ? tRaw('{light} selected: drag a light round the subject.', { light })
        : tRaw('{light} selected: drag a light round the subject, or use the arrow keys.', { light });
    }
    case 'move':
      return touch ? tRaw('Drag an object to move it on the stage.') : tRaw('Drag an object to move it, or nudge the selected one with the arrow keys.');
    case 'turn':
      return touch ? tRaw('Drag sideways to turn the object and up or down to tilt.') : tRaw('Drag sideways to turn and up or down to tilt, or use the arrow keys.');
    default:
      return '';
  }
}
/**
 * Change the pointer mode. The canvas carries the mode as data flags (read by tests and by
 * the cursor), the renderer shows the selection outline or the light handles that go with
 * it, and the controls and the status line follow.
 */
export function setStudioMode(entry: StudioControls, mode: StudioMode): void {
  const flags = entry.canvas.dataset;
  const was = studioMode(entry);
  flags.pickFocus = String(mode === 'focus');
  flags.moveLight = String(mode === 'lights');
  flags.turnObject = String(mode === 'turn');
  flags.moveObject = String(mode === 'move');
  entry.canvas.style.cursor = mode === 'focus' ? 'crosshair' : mode === 'move' || mode === 'lights' ? 'move' : 'grab';
  entry.handle.highlight((mode === 'move' || mode === 'turn') && entry.recipe.objects ? activeObject(entry) : null);
  entry.handle.showLightHandles(mode === 'lights' ? { selected: selectedLight(entry) } : null);
  if (entry.ready) entry.render('preview');
  // A mode's sentence replaces a report of one action; a report survives a repaint in the same mode.
  if (mode !== was || !entry.status?.once) note(entry, modeStatus(entry, mode), false);
  entry.refreshChrome?.();
}
/** The camera the studio rests at: the engine's defaults (engine/src/studio3d.ts). */
export const STUDIO_REST_CAMERA = { azimuth: 25, elevation: 14, fov: 29, zoom: 1, panX: 0, panY: 0, panZ: 0 } as const;
/**
 * Frame every object, or one row, with the renderer's fit, saved as one camera step. The
 * fit answers a world target; the camera keeps it as pan added to the saved target.
 */
export function studioFit(entry: StudioControls, index?: number): boolean {
  const box = entry.canvas.getBoundingClientRect();
  const result = entry.handle.fit(box.width / Math.max(1, box.height), index);
  if (!result) return false;
  cameraEdit(entry, {
    zoom: result.zoom,
    ...Object.fromEntries(
      ['panX', 'panY', 'panZ'].map((key, i) => [
        key,
        Number(entry.inputCamera[key] || 0) + result.target.getComponent(i) - entry.recipe.camera.target[i]!,
      ])
    ),
  });
  return true;
}
export function resetCamera(entry: StudioControls): void {
  cameraEdit(entry, { ...STUDIO_REST_CAMERA });
}
/** The rotation, in degrees, of an arrangement row or of the lone subject (row 0). */
function rotationOf(entry: StudioControls, row: number): StudioVector3 {
  const transform = entry.recipe.objects ? entry.recipe.objects[row]?.transform : entry.recipe.transform;
  return [...(transform?.rotation ?? [0, 0, 0])] as StudioVector3;
}
/** An angle kept in -180 to 180, whole degrees. */
const wrapDegrees = (angle: number): number => {
  const turned = ((((angle + 180) % 360) + 360) % 360) - 180;
  return Math.round(turned === -180 && angle > 0 ? 180 : turned);
};
/** The saved edit for a turned object: the row's rotation, or the subject's Turn and tilt. */
function turnEdits(entry: StudioControls, row: number, rotation: StudioVector3): { id: string; value: unknown }[] {
  const [x, y, z] = rotation.map(wrapDegrees) as StudioVector3;
  if (entry.recipe.objects) return [studioObjectEdit(entry.inputValues, row, { rotX: x, rotY: y, rotZ: z })];
  // Words face the camera until they are given the object's pose, so a turn gives them one.
  const pose = entry.inputValues.source === 'text' && entry.inputValues.wordPose !== 'scene'
    ? [{ id: 'wordPose', value: 'scene' }]
    : [];
  return [{ id: 'rotation', value: { x, y, z } }, ...pose];
}
export function activeObject(entry: StudioControls): number {
  try {
    return studioActiveObject(entry.inputValues);
  } catch {
    return 0;
  }
}
function selectedRow(entry: StudioControls, index: number): StudioValues {
  const rows = entry.inputValues.objects;
  return Array.isArray(rows) ? ((rows[index] as StudioValues) ?? {}) : {};
}
function rowNumber(row: StudioValues, key: string, fallback: number): number {
  const n = Number(row[key]);
  return Number.isFinite(n) ? n : fallback;
}
/** The point on the horizontal plane through `height` that a canvas position looks at. */
function groundPoint(
  entry: StudioControls,
  e: PointerEvent,
  height: number
): THREE.Vector3 | null {
  const box = entry.canvas.getBoundingClientRect();
  const view = entry.handle.camera(box.width / box.height);
  if (!view) return null;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(
      ((e.clientX - box.left) / box.width) * 2 - 1,
      1 - ((e.clientY - box.top) / box.height) * 2
    ),
    view
  );
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
}

export function wireStudioGestures(entry: StudioControls): void {
  let start: {
    x: number;
    y: number;
    azimuth: number;
    elevation: number;
    hit: number | null;
  } | null = null;
  let pose: { azimuth: number; elevation: number } | null = null;
  let drag: {
    index: number;
    origin: THREE.Vector3;
    from: [number, number, number];
    current: [number, number, number];
    height: number;
    moved: boolean;
  } | null = null;
  let lightDrag: {
    index: number;
    x: number;
    y: number;
    from: StudioVector3;
    current: StudioVector3;
    moved: boolean;
  } | null = null;
  let turn: {
    row: number;
    x: number;
    y: number;
    from: StudioVector3;
    current: StudioVector3;
    moved: boolean;
  } | null = null;
  const cancel = () => {
    start = null;
    pose = null;
    if (drag) {
      entry.handle.moveObject(drag.index, drag.from);
      drag = null;
    }
    if (lightDrag) {
      entry.handle.moveLight(lightDrag.index, lightDrag.from);
      lightDrag = null;
    }
    if (turn) {
      entry.handle.turnObject(turn.row, turn.from);
      turn = null;
    }
    entry.handle.view(entry.recipe.camera);
    if (entry.ready) entry.render('preview');
  };
  entry.canvas.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !entry.ready || !entry.options.setInput) return;
    // A report of the last action gives way to the mode's own sentence.
    if (entry.status?.once) note(entry, modeStatus(entry, studioMode(entry)), false);
    entry.canvas.focus({ preventScroll: true });
    const box = entry.canvas.getBoundingClientRect();
    const nx = ((e.clientX - box.left) / box.width) * 2 - 1,
      ny = 1 - ((e.clientY - box.top) / box.height) * 2;
    if (entry.canvas.dataset.pickFocus === 'true') {
      const focus = entry.handle.focus(box.width / box.height, nx, ny);
      if (focus !== null) {
        setStudioMode(entry, 'orbit');
        commit(entry, 'Focus', studioFocusEdit(entry.inputValues, focus));
      } else note(entry, coarsePointer() ? tRaw('No subject here: tap the object.') : tRaw('No subject here: click the object, or press Escape to cancel.'));
      e.preventDefault();
      return;
    }
    if (relighting(entry)) {
      const index = entry.handle.pickLight(box.width / box.height, nx, ny);
      if (index === null) {
        note(entry, coarsePointer() ? tRaw('No light here: drag one of the light handles.') : tRaw('No light here: drag a light handle, or press Escape to finish.'));
        e.preventDefault();
        return;
      }
      entry.selectedLight = index;
      const from = [...entry.recipe.lights[index]!.position] as StudioVector3;
      lightDrag = { index, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      setStudioMode(entry, 'lights');
      note(entry, modeStatus(entry, 'lights'), false);
      entry.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (turnsObject(entry)) {
      const row = entry.recipe.objects
        ? (entry.handle.pick(box.width / box.height, nx, ny)?.index ?? activeObject(entry))
        : 0;
      const from = rotationOf(entry, row);
      turn = { row, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      if (entry.recipe.objects) entry.handle.highlight(row);
      entry.canvas.style.cursor = 'grabbing';
      entry.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    if (arranging(entry) && entry.recipe.objects) {
      const hit = entry.handle.pick(box.width / box.height, nx, ny);
      if (!hit) {
        note(entry, coarsePointer() ? tRaw('No object here: drag one of the objects.') : tRaw('No object here: drag an object, or press Escape to finish.'));
        e.preventDefault();
        return;
      }
      const spec = entry.recipe.objects[hit.index]!;
      drag = {
        index: hit.index,
        origin: hit.point,
        from: [...spec.transform.position] as [number, number, number],
        current: [...spec.transform.position] as [number, number, number],
        height: hit.point.y,
        moved: false,
      };
      entry.handle.highlight(hit.index);
      entry.render('preview');
      entry.canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }
    start = {
      x: e.clientX,
      y: e.clientY,
      azimuth: entry.recipe.camera.azimuth,
      elevation: entry.recipe.camera.elevation,
      // A plain click on an object selects it even while orbiting, so the sidebar
      // and the frame controls follow what the person pointed at.
      hit: entry.recipe.objects ? (entry.handle.pick(box.width / box.height, nx, ny)?.index ?? null) : null,
    };
    pose = null;
    entry.canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  entry.canvas.addEventListener('pointermove', (e) => {
    if (!entry.ready) return;
    if (turn) {
      const dx = e.clientX - turn.x,
        dy = e.clientY - turn.y;
      if (!turn.moved && Math.hypot(dx, dy) < 3) return;
      turn.moved = true;
      turn.current = [
        Math.max(-180, Math.min(180, turn.from[0] + dy * 0.4)),
        turn.from[1] + dx * 0.5,
        turn.from[2],
      ];
      entry.handle.turnObject(turn.row, turn.current);
      entry.render('preview');
      return;
    }
    if (lightDrag) {
      const dx = e.clientX - lightDrag.x,
        dy = e.clientY - lightDrag.y;
      if (!lightDrag.moved && Math.hypot(dx, dy) < 3) return;
      lightDrag.moved = true;
      lightDrag.current = studioOrbitLight(lightDrag.from, -dx * 0.4, dy * 0.3);
      entry.handle.moveLight(lightDrag.index, lightDrag.current);
      entry.render('preview');
      return;
    }
    if (drag) {
      const point = groundPoint(entry, e, drag.height);
      if (!point) return;
      const limit = STUDIO_ARRANGEMENT_EXTENT;
      const next: [number, number, number] = [
        Math.max(-limit, Math.min(limit, drag.from[0] + point.x - drag.origin.x)),
        drag.from[1],
        Math.max(-limit, Math.min(limit, drag.from[2] + point.z - drag.origin.z)),
      ];
      if (Math.hypot(next[0] - drag.from[0], next[2] - drag.from[2]) < 0.01 && !drag.moved) return;
      drag.moved = true;
      drag.current = next;
      entry.handle.moveObject(drag.index, next);
      entry.render('preview');
      return;
    }
    if (!start || Math.hypot(e.clientX - start.x, e.clientY - start.y) < 3) return;
    pose = {
      azimuth: Math.max(-180, Math.min(180, start.azimuth - (e.clientX - start.x) * 0.3)),
      elevation: Math.max(-60, Math.min(80, start.elevation + (e.clientY - start.y) * 0.2)),
    };
    entry.handle.view(pose);
    entry.render('preview');
  });
  entry.canvas.addEventListener('pointerup', () => {
    const clicked = start && !pose ? start.hit : null;
    start = null;
    if (turn) {
      const { row, moved, current } = turn;
      turn = null;
      entry.canvas.style.cursor = 'grab';
      const edits = moved ? turnEdits(entry, row, current) : [];
      if (entry.recipe.objects && row !== activeObject(entry)) edits.unshift(studioObjectSelect(entry.inputValues, row));
      commit(entry, 'Turn', ...edits);
      return;
    }
    if (lightDrag) {
      const { index, moved, current } = lightDrag;
      lightDrag = null;
      if (moved) commit(entry, 'Light', studioLightEdit(entry.inputValues, entry.recipe, index, current));
      return;
    }
    if (drag) {
      const { index, moved, current } = drag;
      drag = null;
      const edits: { id: string; value: unknown }[] = [];
      if (index !== activeObject(entry)) edits.push(studioObjectSelect(entry.inputValues, index));
      if (moved) edits.push(studioObjectEdit(entry.inputValues, index, { x: current[0], z: current[2] }));
      if (edits.length) commit(entry, 'Move', ...edits);
      else entry.render('preview');
      return;
    }
    if (pose) {
      cameraEdit(entry, pose);
      pose = null;
    } else if (clicked !== null && clicked !== activeObject(entry)) {
      commit(entry, 'Select', studioObjectSelect(entry.inputValues, clicked));
    }
  });
  entry.canvas.addEventListener('pointercancel', cancel);
  entry.canvas.addEventListener('studio-reset-gesture', cancel);
  entry.canvas.addEventListener('lostpointercapture', () => {
    if (start || drag || lightDrag || turn) cancel();
  });
  entry.canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setStudioMode(entry, 'orbit');
      cancel();
      return;
    }
    if (!entry.ready || !entry.options.setInput) return;
    if (turnsObject(entry)) {
      const row = entry.recipe.objects ? activeObject(entry) : 0;
      const [x, y, z] = rotationOf(entry, row);
      const step = e.shiftKey ? 15 : 5;
      const turned: Record<string, StudioVector3> = {
        ArrowLeft: [x, y - step, z],
        ArrowRight: [x, y + step, z],
        ArrowUp: [Math.max(-180, x - step), y, z],
        ArrowDown: [Math.min(180, x + step), y, z],
        ',': [x, y, z + step],
        '.': [x, y, z - step],
      };
      const next = turned[e.key];
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      commit(entry, 'Turn', ...turnEdits(entry, row, next));
      return;
    }
    if (relighting(entry)) {
      const index = selectedLight(entry),
        position = entry.recipe.lights[index]?.position;
      if (!position) return;
      const turn = e.shiftKey ? 10 : 3;
      const placeable = studioPlaceableLights(entry.recipe),
        at = placeable.indexOf(index);
      const select = (next: number) => {
        entry.selectedLight = placeable[Math.max(0, Math.min(placeable.length - 1, next))];
        setStudioMode(entry, 'lights');
        note(entry, modeStatus(entry, 'lights'), false);
      };
      const moves: Record<string, StudioVector3 | undefined> = {
        ArrowLeft: studioOrbitLight(position, -turn, 0),
        ArrowRight: studioOrbitLight(position, turn, 0),
        ArrowUp: studioOrbitLight(position, 0, turn),
        ArrowDown: studioOrbitLight(position, 0, -turn),
        '+': studioScaleLightDistance(position, 1.1),
        '=': studioScaleLightDistance(position, 1.1),
        '-': studioScaleLightDistance(position, 1 / 1.1),
      };
      if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        e.stopPropagation();
        select(at + (e.key === '[' ? -1 : 1));
        return;
      }
      const next = moves[e.key];
      if (!next) return;
      e.preventDefault();
      e.stopPropagation();
      commit(entry, 'Light', studioLightEdit(entry.inputValues, entry.recipe, index, next));
      return;
    }
    if (arranging(entry) && entry.recipe.objects) {
      const index = activeObject(entry),
        row = selectedRow(entry, index),
        spec = entry.recipe.objects[index];
      if (!spec) return;
      const step = e.shiftKey ? 0.5 : 0.1,
        turn = e.shiftKey ? 15 : 5;
      const edits: Record<string, { id: string; value: unknown } | undefined> = {
        ArrowLeft: studioObjectEdit(entry.inputValues, index, { x: spec.transform.position[0] - step }),
        ArrowRight: studioObjectEdit(entry.inputValues, index, { x: spec.transform.position[0] + step }),
        ArrowUp: studioObjectEdit(entry.inputValues, index, { z: spec.transform.position[2] - step }),
        ArrowDown: studioObjectEdit(entry.inputValues, index, { z: spec.transform.position[2] + step }),
        ',': studioObjectEdit(entry.inputValues, index, { rotY: rowNumber(row, 'rotY', 0) - turn }),
        '.': studioObjectEdit(entry.inputValues, index, { rotY: rowNumber(row, 'rotY', 0) + turn }),
        '[': studioObjectSelect(entry.inputValues, index - 1),
        ']': studioObjectSelect(entry.inputValues, index + 1),
      };
      const edit = edits[e.key];
      if (!edit) return;
      e.preventDefault();
      e.stopPropagation();
      commit(entry, 'Move', edit);
      return;
    }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    e.stopPropagation();
    const amount = e.shiftKey ? 10 : 2;
    cameraEdit(entry, {
      azimuth: Math.max(
        -180,
        Math.min(
          180,
          entry.recipe.camera.azimuth +
            (e.key === 'ArrowLeft' ? -amount : e.key === 'ArrowRight' ? amount : 0)
        )
      ),
      elevation: Math.max(
        -60,
        Math.min(
          80,
          entry.recipe.camera.elevation +
            (e.key === 'ArrowUp' ? amount : e.key === 'ArrowDown' ? -amount : 0)
        )
      ),
    });
  });
}
