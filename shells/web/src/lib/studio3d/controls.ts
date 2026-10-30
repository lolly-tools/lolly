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
  studioAddCameraKey,
  studioCameraApparentSize,
  studioCameraFromKey,
  studioCameraKeyLabel,
  studioCameraPresetEdit,
  studioIsCameraPreset,
} from '../../../../../engine/src/studio3d-camera-path.ts';
import {
  studioLightEdit,
  studioOrbitLight,
  studioPlaceableLights,
  studioScaleLightDistance,
} from '../../../../../engine/src/studio3d-lights.ts';
import type { StudioSceneV1, StudioVector3 } from '../../../../../packages/core/src/studio3d-v1.ts';
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
    endGesture?: () => void;
    addObjects?: () => void;
  };
  /** The light the Move lights mode acts on; chrome state, never saved. */
  selectedLight?: number;
  render(quality: 'preview'): void;
}
const FOCUSABLE = ['fit', 'fit-selected', 'reset', 'focus', 'auto-focus', 'move', 'turn', 'lights', 'orbit', 'add', 'add-key', 'go-key', 'play'];

function commit(entry: StudioControls, ...edits: { id: string; value: unknown }[]): void {
  const focused = document.activeElement;
  if (focused === entry.canvas) entry.canvas.dataset.restoreFocus = 'canvas';
  else
    for (const name of FOCUSABLE)
      if (focused?.hasAttribute(`data-studio-${name}`)) entry.canvas.dataset.restoreFocus = name;
  entry.options.endGesture?.();
  for (const edit of edits) entry.options.setInput?.(edit.id, edit.value);
  entry.options.endGesture?.();
}
function cameraEdit(entry: StudioControls, values: StudioValues): void {
  commit(entry, studioCameraEdit(entry.inputValues, { ...entry.inputCamera, ...values }));
}
function note(entry: StudioControls, text: string): void {
  const el = entry.marker.querySelector('[data-studio-camera-note]');
  if (el) el.textContent = text;
}
function picking(entry: StudioControls, value: boolean): void {
  entry.canvas.dataset.pickFocus = String(value);
  if (value) {
    moving(entry, false);
    lighting(entry, false);
    turning(entry, false);
  }
  entry.canvas.style.cursor = value ? 'crosshair' : arranging(entry) || relighting(entry) ? 'move' : 'grab';
  entry.marker.querySelector('[data-studio-focus]')?.setAttribute('aria-pressed', String(value));
  reflectModes(entry);
  note(entry, value ? 'Click the subject to focus. Escape cancels.' : '');
}
function arranging(entry: StudioControls): boolean {
  return entry.canvas.dataset.moveObject === 'true';
}
function turnsObject(entry: StudioControls): boolean {
  return entry.canvas.dataset.turnObject === 'true';
}
/** The Orbit button reads pressed whenever no other pointer mode is on. */
function reflectModes(entry: StudioControls): void {
  const orbit =
    !arranging(entry) && !relighting(entry) && !turnsObject(entry) && entry.canvas.dataset.pickFocus !== 'true';
  entry.marker.querySelector('[data-studio-orbit]')?.setAttribute('aria-pressed', String(orbit));
}
function relighting(entry: StudioControls): boolean {
  return entry.canvas.dataset.moveLight === 'true';
}
function lightName(entry: StudioControls, index: number): string {
  const id = entry.recipe.lights[index]?.id ?? '';
  return { key: 'Key light', fill: 'Fill light', rim: 'Rim light' }[id] ?? id.replace('light-', 'Light ');
}
function selectedLight(entry: StudioControls): number {
  const placeable = studioPlaceableLights(entry.recipe);
  const current = entry.selectedLight ?? placeable[0] ?? 0;
  return placeable.includes(current) ? current : (placeable[0] ?? 0);
}
/** Light mode: drags orbit a light about the subject; keys turn it and change its distance. */
function lighting(entry: StudioControls, value: boolean): void {
  entry.canvas.dataset.moveLight = String(value);
  if (value) {
    entry.canvas.dataset.moveObject = 'false';
    entry.canvas.dataset.turnObject = 'false';
    entry.marker.querySelector('[data-studio-turn]')?.setAttribute('aria-pressed', 'false');
  }
  entry.canvas.style.cursor = value ? 'move' : 'grab';
  entry.marker.querySelector('[data-studio-lights]')?.setAttribute('aria-pressed', String(value));
  entry.marker.querySelector('[data-studio-move]')?.setAttribute('aria-pressed', String(arranging(entry)));
  entry.handle.showLightHandles(value ? { selected: selectedLight(entry) } : null);
  reflectModes(entry);
  if (entry.ready) entry.render('preview');
  note(
    entry,
    value
      ? `${lightName(entry, selectedLight(entry))} selected. Drag a light to orbit it. Arrow keys turn, plus and minus change distance, brackets select. Escape finishes.`
      : ''
  );
}
/** Move mode: drags and arrow keys move the selected object; orbit gestures pause. */
function moving(entry: StudioControls, value: boolean): void {
  entry.canvas.dataset.moveObject = String(value);
  if (value) {
    lighting(entry, false);
    turning(entry, false);
  }
  entry.canvas.style.cursor = value ? 'move' : 'grab';
  entry.marker.querySelector('[data-studio-move]')?.setAttribute('aria-pressed', String(value));
  entry.handle.highlight(value && entry.recipe.objects ? activeObject(entry) : null);
  reflectModes(entry);
  if (entry.ready) entry.render('preview');
  note(
    entry,
    value
      ? 'Drag an object to move it. Arrow keys nudge, comma and full stop turn, brackets select. Escape finishes.'
      : ''
  );
}
/**
 * Turn mode: a sideways drag turns the object on the floor and an up or down drag tilts
 * it; arrow keys do the same and comma and full stop lean the object sideways. In an
 * arrangement the drag acts on the object under the pointer, else the selected one.
 * Orbit gestures pause.
 */
function turning(entry: StudioControls, value: boolean): void {
  entry.canvas.dataset.turnObject = String(value);
  if (value) {
    entry.canvas.dataset.moveObject = 'false';
    entry.canvas.dataset.moveLight = 'false';
    entry.marker.querySelector('[data-studio-move]')?.setAttribute('aria-pressed', 'false');
    entry.marker.querySelector('[data-studio-lights]')?.setAttribute('aria-pressed', 'false');
    entry.handle.showLightHandles(null);
  }
  entry.canvas.style.cursor = value ? 'grab' : arranging(entry) || relighting(entry) ? 'move' : 'grab';
  entry.marker.querySelector('[data-studio-turn]')?.setAttribute('aria-pressed', String(value));
  entry.handle.highlight(value && entry.recipe.objects ? activeObject(entry) : null);
  reflectModes(entry);
  if (entry.ready) entry.render('preview');
  note(
    entry,
    value
      ? 'Drag sideways to turn and up or down to tilt. Arrow keys turn and tilt, comma and full stop lean. Escape finishes.'
      : ''
  );
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
function activeObject(entry: StudioControls): number {
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
    entry.canvas.focus({ preventScroll: true });
    const box = entry.canvas.getBoundingClientRect();
    const nx = ((e.clientX - box.left) / box.width) * 2 - 1,
      ny = 1 - ((e.clientY - box.top) / box.height) * 2;
    if (entry.canvas.dataset.pickFocus === 'true') {
      const focus = entry.handle.focus(box.width / box.height, nx, ny);
      if (focus !== null) {
        picking(entry, false);
        commit(entry, studioFocusEdit(entry.inputValues, focus));
      } else note(entry, 'No subject here. Click the object, or press Escape to cancel.');
      e.preventDefault();
      return;
    }
    if (relighting(entry)) {
      const index = entry.handle.pickLight(box.width / box.height, nx, ny);
      if (index === null) {
        note(entry, 'No light here. Drag a light handle, or press Escape to finish.');
        e.preventDefault();
        return;
      }
      entry.selectedLight = index;
      entry.handle.showLightHandles({ selected: index });
      const from = [...entry.recipe.lights[index]!.position] as StudioVector3;
      lightDrag = { index, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      note(entry, `${lightName(entry, index)} selected.`);
      entry.render('preview');
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
        note(entry, 'No object here. Drag an object, or press Escape to finish moving.');
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
      if (edits.length) commit(entry, ...edits);
      return;
    }
    if (lightDrag) {
      const { index, moved, current } = lightDrag;
      lightDrag = null;
      if (moved) commit(entry, studioLightEdit(entry.inputValues, entry.recipe, index, current));
      return;
    }
    if (drag) {
      const { index, moved, current } = drag;
      drag = null;
      const edits: { id: string; value: unknown }[] = [];
      if (index !== activeObject(entry)) edits.push(studioObjectSelect(entry.inputValues, index));
      if (moved) edits.push(studioObjectEdit(entry.inputValues, index, { x: current[0], z: current[2] }));
      if (edits.length) commit(entry, ...edits);
      else entry.render('preview');
      return;
    }
    if (pose) {
      cameraEdit(entry, pose);
      pose = null;
    } else if (clicked !== null && clicked !== activeObject(entry)) {
      commit(entry, studioObjectSelect(entry.inputValues, clicked));
    }
  });
  entry.canvas.addEventListener('pointercancel', cancel);
  entry.canvas.addEventListener('studio-reset-gesture', cancel);
  entry.canvas.addEventListener('lostpointercapture', () => {
    if (start || drag || lightDrag || turn) cancel();
  });
  entry.canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      picking(entry, false);
      moving(entry, false);
      lighting(entry, false);
      turning(entry, false);
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
      commit(entry, ...turnEdits(entry, row, next));
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
        lighting(entry, true);
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
      commit(entry, studioLightEdit(entry.inputValues, entry.recipe, index, next));
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
      commit(entry, edit);
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

export function syncStudioControls(entry: StudioControls): void {
  if (!entry.ready) entry.canvas.dispatchEvent(new Event('studio-reset-gesture'));
  const actions = entry.marker.querySelector<HTMLElement>('[data-studio-camera-actions]');
  if (actions) actions.hidden = !entry.options.setInput;
  entry.canvas.tabIndex = entry.options.setInput ? 0 : -1;
  const button = (selector: string, action: () => void) => {
    const b = entry.marker.querySelector<HTMLButtonElement>(selector);
    if (b) {
      b.disabled = !entry.ready;
      b.onclick = () => {
        try {
          action();
        } catch (error) {
          note(entry, (error as Error).message);
        }
      };
    }
    return b;
  };
  const fit = (index?: number) => {
    const box = entry.canvas.getBoundingClientRect(),
      result = entry.handle.fit(box.width / box.height, index);
    if (!result) return;
    cameraEdit(entry, {
      zoom: result.zoom,
      ...Object.fromEntries(
        ['panX', 'panY', 'panZ'].map((key, i) => [
          key,
          Number(entry.inputCamera[key] || 0) +
            result.target.getComponent(i) -
            entry.recipe.camera.target[i]!,
        ])
      ),
    });
  };
  button('[data-studio-fit]', () => fit());
  button('[data-studio-fit-selected]', () => fit(activeObject(entry)));
  button('[data-studio-reset]', () =>
    cameraEdit(entry, { azimuth: 25, elevation: 14, fov: 29, zoom: 1, panX: 0, panY: 0, panZ: 0 })
  );
  const focus = button('[data-studio-focus]', () => {
    picking(entry, entry.canvas.dataset.pickFocus !== 'true');
    entry.canvas.focus({ preventScroll: true });
  });
  if (focus) focus.disabled = !entry.ready || entry.recipe.camera.aperture === 0;
  button('[data-studio-auto-focus]', () => commit(entry, studioFocusEdit(entry.inputValues, 0)));
  button('[data-studio-move]', () => {
    moving(entry, !arranging(entry));
    entry.canvas.focus({ preventScroll: true });
  });
  button('[data-studio-lights]', () => {
    lighting(entry, !relighting(entry));
    entry.canvas.focus({ preventScroll: true });
  });
  button('[data-studio-turn]', () => {
    turning(entry, !turnsObject(entry));
    entry.canvas.focus({ preventScroll: true });
  });
  button('[data-studio-orbit]', () => {
    picking(entry, false);
    moving(entry, false);
    lighting(entry, false);
    turning(entry, false);
    entry.canvas.focus({ preventScroll: true });
  });
  const add = button('[data-studio-add]', () => entry.options.addObjects?.());
  if (add) add.hidden = !entry.options.addObjects;
  button('[data-studio-add-key]', () => {
    const edit = studioAddCameraKey(entry.inputValues);
    const count = (edit.value as unknown[]).length;
    commit(entry, edit, ...(count >= 2 ? [] : [{ id: 'cameraMotion', value: 'still' }]));
    note(
      entry,
      count >= 2
        ? `Key ${count} saved. Play path shows the move; export as video or GIF to keep it.`
        : 'First key saved. Orbit to the next view and add another key.'
    );
  });
  // Each press shows the next saved key, wrapping at the end, so a view already in the
  // path can be recalled and composed from. It moves the camera and nothing else.
  button('[data-studio-go-key]', () => {
    const rows = Array.isArray(entry.inputValues.cameraKeys)
      ? (entry.inputValues.cameraKeys as StudioValues[])
      : [];
    if (!rows.length) throw new Error('Add a camera key first.');
    const last = Number(entry.canvas.dataset.cameraKey);
    const next = Number.isInteger(last) && last >= 0 ? (last + 1) % rows.length : 0;
    entry.canvas.dataset.cameraKey = String(next);
    commit(entry, ...studioCameraFromKey(entry.inputValues, next));
    note(
      entry,
      `${studioCameraKeyLabel(entry.inputValues, next)}.${
        entry.inputValues.cameraMotion === 'keys' && rows.length >= 2
          ? ' Turn Play path off to hold this view.'
          : ''
      }`
    );
  });
  button('[data-studio-play]', () =>
    commit(entry, {
      id: 'cameraMotion',
      value: entry.inputValues.cameraMotion === 'keys' ? 'still' : 'keys',
    })
  );
  // A camera move draws its keys from the live view. Convert to keys hands those rows
  // over as one edit, so one undo takes the move back, and the button is here only
  // while a move is chosen: authored keys are already editable.
  const moveKeys = studioIsCameraPreset(entry.recipe.cameraMotion?.kind ?? 'still')
    ? (entry.recipe.cameraMotion?.keys ?? [])
    : [];
  const convert = button('[data-studio-convert-keys]', () => {
    const edits = studioCameraPresetEdit(entry.recipe);
    // A dolly holds the subject's size by trading lens for distance. Where the zoom
    // range cannot go that far, the framing moves, and the reader is told so. Both are
    // read before the commit, because the commit hands this view its next recipe.
    const live = studioCameraApparentSize(entry.recipe.camera);
    const framed = moveKeys.every(
      (key) => Math.abs(studioCameraApparentSize(key) - live) <= live * 0.02
    );
    commit(entry, ...edits);
    note(
      entry,
      `Converted to ${moveKeys.length} keys. Edit them under Motion.${
        framed ? '' : ' The zoom range limited this move, so the subject changes size.'
      }`
    );
  });
  if (convert) convert.hidden = moveKeys.length < 2;
  const lightsButton = entry.marker.querySelector<HTMLButtonElement>('[data-studio-lights]');
  if (lightsButton) lightsButton.hidden = !studioPlaceableLights(entry.recipe).length;
  picking(entry, false);
  // A repaint keeps a mode and its overlay on the newly selected object or light.
  if (relighting(entry)) lighting(entry, true);
  else if (turnsObject(entry)) turning(entry, true);
  else if (arranging(entry) && entry.recipe.objects) moving(entry, true);
  else if (arranging(entry)) moving(entry, false);
  reflectModes(entry);
  if (entry.ready && entry.canvas.dataset.restoreFocus) {
    const name = entry.canvas.dataset.restoreFocus;
    const target =
      name === 'canvas'
        ? entry.canvas
        : entry.marker.querySelector<HTMLElement>(`[data-studio-${name}]`);
    target?.focus({ preventScroll: true });
    delete entry.canvas.dataset.restoreFocus;
  }
}
