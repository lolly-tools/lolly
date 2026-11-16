// SPDX-License-Identifier: MPL-2.0
/**
 * Pointer, wheel and keyboard handling on 3D Studio's canvas (plan 368, W2 and W3).
 *
 * One controller for every pointer type, on the model of Chart's `wireView`
 * (community/chart/lib/chart-three.js):
 *  - one finger or a left drag on empty space orbits, and the orbit wraps all the way round;
 *  - two fingers, a Shift-drag or a middle-button drag pan the target in the view plane;
 *  - a pinch (whose midpoint also pans), a plain wheel, or plus and minus zoom;
 *  - a double-click or a double-tap frames the object under the pointer, or everything;
 *  - the arrow keys orbit the way a drag in that direction does, 0 and Home reset the camera.
 * Ctrl or Cmd with the wheel, and a trackpad pinch, are left to the stage's own zoom.
 *
 * The modes (Move objects, Turn object, Move lights, Pick focus) keep one-pointer drags
 * and their keys for themselves. Two fingers, a pinch and the wheel move the camera in
 * every mode.
 *
 * A gesture previews through the renderer without saving (`view`, `moveObject`,
 * `turnObject`, `moveLight`) and saves once: on release for a drag or a pinch, and after a
 * pause for the wheel and for a run of keys, so one gesture is one undo step. A finger
 * that lifts from a pinch re-anchors the one left, `pointercancel` and a lost capture put
 * the preview back, and a capture that starts mid-gesture (`studio-reset-gesture`) does the
 * same, saving a wheel or key view that was only waiting for its pause.
 */
import * as THREE from 'three';
import {
  STUDIO_ARRANGEMENT_EXTENT,
  studioObjectEdit,
  studioObjectSelect,
} from '../../../../../engine/src/studio3d-arrangement.ts';
import { studioFocusEdit, type StudioValues } from '../../../../../engine/src/studio3d-collection.ts';
import {
  studioLightEdit,
  studioOrbitLight,
  studioPlaceableLights,
  studioScaleLightDistance,
} from '../../../../../engine/src/studio3d-lights.ts';
import type { StudioVector3 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { tRaw } from '../../i18n.ts';
import {
  STUDIO_KEY_ZOOM,
  type StudioView,
  arrowOrbit,
  orbitBy,
  panBy,
  turnBy,
  wheelZoomFactor,
  zoomBy,
} from './camera-nav.ts';
import {
  type StudioControls,
  activeObject,
  cameraEdit,
  coarsePointer,
  commit,
  modeStatus,
  note,
  resetCamera,
  selectedLight,
  setStudioMode,
  studioFit,
  studioMode,
} from './controls.ts';

/** The pause after the last wheel event or key press before the view is saved. */
export const STUDIO_SAVE_PAUSE_MS = 400;
const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_PX = 24;
/** A press that travels less than this many pixels is a tap, not a drag. */
const DRAG_PX = 3;

type Gesture =
  | { kind: 'orbit'; x: number; y: number; moved: boolean; hit: number | null }
  | { kind: 'pan'; x: number; y: number; moved: boolean }
  | { kind: 'pinch'; d: number; mx: number; my: number }
  | { kind: 'object'; index: number; origin: THREE.Vector3; from: StudioVector3; current: StudioVector3; height: number; moved: boolean }
  | { kind: 'turn'; row: number; x: number; y: number; from: StudioVector3; current: StudioVector3; moved: boolean }
  | { kind: 'light'; index: number; x: number; y: number; from: StudioVector3; current: StudioVector3; moved: boolean }
  /** A press that does nothing until it is released: a miss in a mode, or a finger left over from a pinch. */
  | { kind: 'idle' };

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

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
function selectedRow(entry: StudioControls, index: number): StudioValues {
  const rows = entry.inputValues.objects;
  return Array.isArray(rows) ? ((rows[index] as StudioValues) ?? {}) : {};
}
/** The point on the horizontal plane through `height` that a canvas position looks at. */
function groundPoint(entry: StudioControls, x: number, y: number, height: number): THREE.Vector3 | null {
  const box = entry.canvas.getBoundingClientRect();
  const view = entry.handle.camera(box.width / box.height);
  if (!view) return null;
  const ray = new THREE.Raycaster();
  ray.setFromCamera(
    new THREE.Vector2(((x - box.left) / box.width) * 2 - 1, 1 - ((y - box.top) / box.height) * 2),
    view
  );
  return ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -height), new THREE.Vector3());
}

export function wireStudioGestures(entry: StudioControls): void {
  const { canvas } = entry;
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: Gesture | null = null;
  /** The camera on show and not yet saved; null while the preview is the saved camera. */
  let live: StudioView | null = null;
  /** The camera last saved, kept until the mount brings a recipe with that camera. */
  let committed: { view: StudioView; recipe: unknown } | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  let lastTap = { at: Number.NEGATIVE_INFINITY, x: 0, y: 0, mode: '' };

  /** When the last wheel event or key press was handled: a timed save waits for a real pause. */
  let lastInput = 0;
  let frame = 0;
  const editable = (): boolean => entry.ready && !!entry.options.setInput;
  /**
   * Draw the preview once per animation frame, however many events arrive: a frame on a
   * slow GPU must not hold up the next wheel event or the pointer that follows.
   */
  const redraw = (): void => {
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      if (!entry.ready) return;
      try {
        entry.render('preview');
      } catch {
        /* the status line shows a failed preview */
      }
    });
  };
  /** The saved camera, with the pan the recipe's target was built from. */
  const recipeView = (): StudioView => ({
    azimuth: entry.recipe.camera.azimuth,
    elevation: entry.recipe.camera.elevation,
    zoom: entry.recipe.camera.zoom,
    panX: num(entry.inputCamera.panX),
    panY: num(entry.inputCamera.panY),
    panZ: num(entry.inputCamera.panZ),
  });
  /**
   * Where the next gesture starts. A view saved a moment ago is the start until the mount
   * hands over the recipe holding it, so a wheel that resumes straight after a save does
   * not jump back to the camera before that save.
   */
  const current = (): StudioView => {
    if (live) return live;
    if (committed && committed.recipe === entry.recipe) return committed.view;
    committed = null;
    return recipeView();
  };
  const lens = () => ({ fov: entry.recipe.camera.fov, projection: entry.recipe.camera.projection });
  const box = (): DOMRect => canvas.getBoundingClientRect();
  const cursor = (): string => {
    const mode = studioMode(entry);
    return mode === 'focus' ? 'crosshair' : mode === 'move' || mode === 'lights' ? 'move' : 'grab';
  };

  function preview(view: StudioView): void {
    live = view;
    const base = recipeView();
    const [x, y, z] = entry.recipe.camera.target;
    entry.handle.view({
      azimuth: view.azimuth,
      elevation: view.elevation,
      zoom: view.zoom,
      target: [x + view.panX - base.panX, y + view.panY - base.panY, z + view.panZ - base.panZ],
    });
    redraw();
  }

  /** Save the view on show, as one camera step, if it differs from the saved one. */
  function save(): void {
    clearTimeout(saveTimer);
    saveTimer = undefined;
    const view = live;
    live = null;
    if (!view) return;
    const was = current();
    if (JSON.stringify(view) === JSON.stringify(was)) return;
    committed = { view, recipe: entry.recipe };
    cameraEdit(entry, { ...view });
  }
  // Which item a waiting view belongs to. In a collection the camera is the selected
  // item's own, so a view made on one item must never be saved on another.
  const viewScope = (): string => JSON.stringify([entry.inputValues.source ?? '', entry.inputValues.activeSubject ?? '']);
  let liveScope = '';
  const saveSoon = (): void => {
    lastInput = performance.now();
    liveScope = viewScope();
    clearTimeout(saveTimer);
    const wait = (delay: number): void => {
      saveTimer = setTimeout(() => {
        // A long frame can hold the timer and the next event back together; the save
        // waits until the input has really paused.
        const left = STUDIO_SAVE_PAUSE_MS - (performance.now() - lastInput);
        if (left > 16) wait(left);
        else save();
      }, delay);
    };
    wait(STUDIO_SAVE_PAUSE_MS);
  };
  /** Save a waiting wheel or key view now; a toolbar action calls this before it acts. */
  entry.flushView = () => {
    if (saveTimer !== undefined && !pointers.size) save();
  };

  /** Put back what a mode's drag was previewing: an object, a turn or a light. */
  function revertModePreview(): void {
    if (gesture?.kind === 'object') entry.handle.moveObject(gesture.index, gesture.from);
    else if (gesture?.kind === 'turn') entry.handle.turnObject(gesture.row, gesture.from);
    else if (gesture?.kind === 'light') entry.handle.moveLight(gesture.index, gesture.from);
  }

  /** Drop the gesture and its preview. A wheel or key view that only waited for its pause is kept. */
  function cancel(): void {
    const waiting = saveTimer !== undefined && !pointers.size && gesture === null;
    revertModePreview();
    gesture = null;
    for (const id of pointers.keys()) {
      try { canvas.releasePointerCapture(id); } catch { /* the pointer has already gone */ }
    }
    pointers.clear();
    canvas.style.cursor = cursor();
    // A waiting view is saved only while its own item is still the selected one. If the
    // selection changed in the pause, the view is dropped with the rest below.
    if (waiting && liveScope === viewScope()) {
      save();
      return;
    }
    clearTimeout(saveTimer);
    saveTimer = undefined;
    live = null;
    entry.handle.view(entry.recipe.camera);
    redraw();
  }

  const point = (x: number, y: number): { aspect: number; nx: number; ny: number } => {
    const b = box();
    return { aspect: b.width / Math.max(1, b.height), nx: ((x - b.left) / b.width) * 2 - 1, ny: 1 - ((y - b.top) / b.height) * 2 };
  };

  function beginPinch(): void {
    revertModePreview();
    redraw();
    const [a, b] = [...pointers.values()];
    gesture = { kind: 'pinch', d: Math.hypot(a!.x - b!.x, a!.y - b!.y) || 1, mx: (a!.x + b!.x) / 2, my: (a!.y + b!.y) / 2 };
  }

  /** A first pointer goes down: what it does follows the button, Shift and the mode. */
  function begin(e: PointerEvent): void {
    const { aspect, nx, ny } = point(e.clientX, e.clientY);
    const touch = coarsePointer();
    if (e.button === 1 || e.shiftKey) {
      gesture = { kind: 'pan', x: e.clientX, y: e.clientY, moved: false };
      canvas.style.cursor = 'grabbing';
      return;
    }
    const mode = studioMode(entry);
    if (mode === 'focus') {
      const focus = entry.handle.focus(aspect, nx, ny);
      if (focus !== null) {
        setStudioMode(entry, 'orbit');
        commit(entry, tRaw('Focus'), studioFocusEdit(entry.inputValues, focus));
      } else note(entry, touch ? tRaw('No subject here: tap the object.') : tRaw('No subject here: click the object, or press Escape to cancel.'));
      gesture = { kind: 'idle' };
      return;
    }
    if (mode === 'lights') {
      const index = entry.handle.pickLight(aspect, nx, ny);
      if (index === null) {
        note(entry, touch ? tRaw('No light here: drag one of the light handles.') : tRaw('No light here: drag a light handle, or press Escape to finish.'));
        gesture = { kind: 'idle' };
        return;
      }
      entry.selectedLight = index;
      setStudioMode(entry, 'lights');
      note(entry, modeStatus(entry, 'lights'), false);
      const from = [...entry.recipe.lights[index]!.position] as StudioVector3;
      gesture = { kind: 'light', index, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      return;
    }
    if (mode === 'turn') {
      const row = entry.recipe.objects ? (entry.handle.pick(aspect, nx, ny)?.index ?? activeObject(entry)) : 0;
      const from = rotationOf(entry, row);
      gesture = { kind: 'turn', row, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      if (entry.recipe.objects) entry.handle.highlight(row);
      canvas.style.cursor = 'grabbing';
      return;
    }
    if (mode === 'move' && entry.recipe.objects) {
      const hit = entry.handle.pick(aspect, nx, ny);
      if (!hit) {
        note(entry, touch ? tRaw('No object here: drag one of the objects.') : tRaw('No object here: drag an object, or press Escape to finish.'));
        gesture = { kind: 'idle' };
        return;
      }
      const position = [...entry.recipe.objects[hit.index]!.transform.position] as StudioVector3;
      gesture = { kind: 'object', index: hit.index, origin: hit.point, from: position, current: position, height: hit.point.y, moved: false };
      entry.handle.highlight(hit.index);
      redraw();
      return;
    }
    gesture = {
      kind: 'orbit',
      x: e.clientX,
      y: e.clientY,
      moved: false,
      // A plain click on an object selects it even while orbiting, so the sidebar and
      // the frame controls follow what the person pointed at.
      hit: entry.recipe.objects ? (entry.handle.pick(aspect, nx, ny)?.index ?? null) : null,
    };
    canvas.style.cursor = 'grabbing';
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (!editable()) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    // A report of the last action gives way to the mode's own sentence.
    if (entry.status?.once && pointers.size === 0) note(entry, modeStatus(entry, studioMode(entry)), false);
    canvas.focus({ preventScroll: true });
    e.preventDefault();
    // A wheel or key view still waiting for its pause rides into this gesture, and the
    // release saves both.
    clearTimeout(saveTimer);
    saveTimer = undefined;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone */ }
    if (pointers.size >= 2) beginPinch();
    else begin(e);
  });

  canvas.addEventListener('pointermove', (e) => {
    const p = pointers.get(e.pointerId);
    if (!p || !gesture || !entry.ready) return;
    p.x = e.clientX;
    p.y = e.clientY;
    const g = gesture;
    switch (g.kind) {
      case 'pinch': {
        const [a, b] = [...pointers.values()];
        if (!a || !b) return;
        const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const view = panBy(zoomBy(current(), d / g.d), lens(), mx - g.mx, my - g.my, box().height);
        g.d = d;
        g.mx = mx;
        g.my = my;
        preview(view);
        return;
      }
      case 'orbit':
      case 'pan': {
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.moved && Math.hypot(dx, dy) < DRAG_PX) return;
        g.moved = true;
        g.x = e.clientX;
        g.y = e.clientY;
        preview(g.kind === 'pan' || e.shiftKey ? panBy(current(), lens(), dx, dy, box().height) : orbitBy(current(), dx, dy));
        return;
      }
      case 'turn': {
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.moved && Math.hypot(dx, dy) < DRAG_PX) return;
        g.moved = true;
        g.current = [Math.max(-180, Math.min(180, g.from[0] + dy * 0.4)), g.from[1] + dx * 0.5, g.from[2]];
        entry.handle.turnObject(g.row, g.current);
        redraw();
        return;
      }
      case 'light': {
        const dx = e.clientX - g.x, dy = e.clientY - g.y;
        if (!g.moved && Math.hypot(dx, dy) < DRAG_PX) return;
        g.moved = true;
        g.current = studioOrbitLight(g.from, -dx * 0.4, dy * 0.3);
        entry.handle.moveLight(g.index, g.current);
        redraw();
        return;
      }
      case 'object': {
        const hit = groundPoint(entry, e.clientX, e.clientY, g.height);
        if (!hit) return;
        const limit = STUDIO_ARRANGEMENT_EXTENT;
        const next: StudioVector3 = [
          Math.max(-limit, Math.min(limit, g.from[0] + hit.x - g.origin.x)),
          g.from[1],
          Math.max(-limit, Math.min(limit, g.from[2] + hit.z - g.origin.z)),
        ];
        if (!g.moved && Math.hypot(next[0] - g.from[0], next[2] - g.from[2]) < 0.01) return;
        g.moved = true;
        g.current = next;
        entry.handle.moveObject(g.index, next);
        redraw();
        return;
      }
      default:
        return;
    }
  });

  /**
   * Two taps close together in time and place, in the same mode, frame the object under
   * them, or everything.
   */
  function doubleTap(e: PointerEvent): boolean {
    const mode = studioMode(entry);
    const twice = e.timeStamp - lastTap.at < DOUBLE_TAP_MS && lastTap.mode === mode
      && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < DOUBLE_TAP_PX;
    lastTap = twice ? { at: Number.NEGATIVE_INFINITY, x: 0, y: 0, mode: '' } : { at: e.timeStamp, x: e.clientX, y: e.clientY, mode };
    if (!twice) return false;
    const { aspect, nx, ny } = point(e.clientX, e.clientY);
    const hit = entry.recipe.objects ? entry.handle.pick(aspect, nx, ny) : null;
    studioFit(entry, hit?.index);
    return true;
  }

  /** The last pointer came up: save what the gesture made. */
  function finish(e: PointerEvent): void {
    const g = gesture;
    gesture = null;
    canvas.style.cursor = cursor();
    if (!g) return;
    switch (g.kind) {
      case 'orbit':
        if (g.moved) {
          save();
          return;
        }
        // A tap: a waiting wheel or key view is saved first, then the tap selects or frames.
        save();
        if (!doubleTap(e) && g.hit !== null && g.hit !== activeObject(entry))
          commit(entry, tRaw('Select'), studioObjectSelect(entry.inputValues, g.hit));
        return;
      case 'turn': {
        save();
        const edits = g.moved ? turnEdits(entry, g.row, g.current) : [];
        if (entry.recipe.objects && g.row !== activeObject(entry)) edits.unshift(studioObjectSelect(entry.inputValues, g.row));
        if (!g.moved && doubleTap(e)) return;
        commit(entry, tRaw('Turn'), ...edits);
        return;
      }
      case 'light':
        save();
        if (g.moved) commit(entry, tRaw('Light'), studioLightEdit(entry.inputValues, entry.recipe, g.index, g.current));
        return;
      case 'object': {
        save();
        if (!g.moved && doubleTap(e)) return;
        const edits: { id: string; value: unknown }[] = [];
        if (g.index !== activeObject(entry)) edits.push(studioObjectSelect(entry.inputValues, g.index));
        if (g.moved) edits.push(studioObjectEdit(entry.inputValues, g.index, { x: g.current[0], z: g.current[2] }));
        if (edits.length) commit(entry, tRaw('Move'), ...edits);
        else redraw();
        return;
      }
      default:
        save();
    }
  }

  function lift(e: PointerEvent): void {
    if (!pointers.delete(e.pointerId)) return;
    try { canvas.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    if (pointers.size >= 2) {
      beginPinch();
      return;
    }
    if (pointers.size === 1) {
      // A finger lifted from a pinch: the one left carries on from where it is, orbiting
      // in Orbit and waiting for its release in a mode.
      if (gesture?.kind === 'pinch') {
        const [p] = [...pointers.values()];
        gesture = studioMode(entry) === 'orbit' ? { kind: 'orbit', x: p!.x, y: p!.y, moved: true, hit: null } : { kind: 'idle' };
      }
      return;
    }
    finish(e);
  }
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', cancel);
  canvas.addEventListener('studio-reset-gesture', cancel);
  canvas.addEventListener('lostpointercapture', (e) => {
    if (pointers.has(e.pointerId)) cancel();
  });

  canvas.addEventListener('wheel', (e) => {
    // Ctrl or Cmd with the wheel, and a trackpad pinch, zoom the stage, not the camera.
    if (e.ctrlKey || e.metaKey || !editable()) return;
    e.preventDefault();
    preview(zoomBy(current(), wheelZoomFactor(e.deltaY, e.deltaMode)));
    if (!pointers.size) saveSoon();
  }, { passive: false });

  /** Keys that turn the object in Turn object. True when the key was used. */
  function turnKey(e: KeyboardEvent): boolean {
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
    if (!next) return false;
    commit(entry, tRaw('Turn'), ...turnEdits(entry, row, next));
    return true;
  }

  /** Keys that move the selected light in Move lights. The arrows go the way a drag does. */
  function lightKey(e: KeyboardEvent): boolean {
    const index = selectedLight(entry);
    const position = entry.recipe.lights[index]?.position;
    if (!position) return false;
    const placeable = studioPlaceableLights(entry.recipe);
    if (e.key === '[' || e.key === ']') {
      const at = placeable.indexOf(index) + (e.key === '[' ? -1 : 1);
      entry.selectedLight = placeable[Math.max(0, Math.min(placeable.length - 1, at))];
      setStudioMode(entry, 'lights');
      note(entry, modeStatus(entry, 'lights'), false);
      return true;
    }
    const turn = e.shiftKey ? 10 : 3;
    const moves: Record<string, StudioVector3> = {
      ArrowLeft: studioOrbitLight(position, turn, 0),
      ArrowRight: studioOrbitLight(position, -turn, 0),
      ArrowUp: studioOrbitLight(position, 0, -turn),
      ArrowDown: studioOrbitLight(position, 0, turn),
      '+': studioScaleLightDistance(position, 1.1),
      '=': studioScaleLightDistance(position, 1.1),
      '-': studioScaleLightDistance(position, 1 / 1.1),
    };
    const next = moves[e.key];
    if (!next) return false;
    commit(entry, tRaw('Light'), studioLightEdit(entry.inputValues, entry.recipe, index, next));
    return true;
  }

  /** Keys that nudge, turn and select objects in Move objects. */
  function moveKey(e: KeyboardEvent): boolean {
    const index = activeObject(entry);
    const spec = entry.recipe.objects?.[index];
    if (!spec) return false;
    const row = selectedRow(entry, index);
    const step = e.shiftKey ? 0.5 : 0.1,
      turn = e.shiftKey ? 15 : 5;
    const [px, , pz] = spec.transform.position;
    const edits: Record<string, { id: string; value: unknown } | undefined> = {
      ArrowLeft: studioObjectEdit(entry.inputValues, index, { x: px - step }),
      ArrowRight: studioObjectEdit(entry.inputValues, index, { x: px + step }),
      ArrowUp: studioObjectEdit(entry.inputValues, index, { z: pz - step }),
      ArrowDown: studioObjectEdit(entry.inputValues, index, { z: pz + step }),
      ',': studioObjectEdit(entry.inputValues, index, { rotY: num(row.rotY) - turn }),
      '.': studioObjectEdit(entry.inputValues, index, { rotY: num(row.rotY) + turn }),
      '[': studioObjectSelect(entry.inputValues, index - 1),
      ']': studioObjectSelect(entry.inputValues, index + 1),
    };
    const edit = edits[e.key];
    if (!edit) return false;
    commit(entry, tRaw('Move'), edit);
    return true;
  }

  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      setStudioMode(entry, 'orbit');
      cancel();
      return;
    }
    if (!editable() || e.altKey || e.ctrlKey || e.metaKey) return;
    const used = (): void => {
      e.preventDefault();
      e.stopPropagation();
    };
    // 0 and Home put the camera back; the stage's own 0 (fit the view) never hears the key.
    if ((e.key === '0' || e.key === 'Home') && !e.shiftKey) {
      used();
      clearTimeout(saveTimer);
      saveTimer = undefined;
      live = null;
      resetCamera(entry);
      return;
    }
    const mode = studioMode(entry);
    const modeKey = (mode === 'turn' && turnKey(e)) || (mode === 'lights' && lightKey(e)) || (mode === 'move' && !!entry.recipe.objects && moveKey(e));
    if (modeKey) {
      used();
      return;
    }
    const turn = arrowOrbit(e.key, e.shiftKey);
    const zoom = e.key === '+' || e.key === '=' ? STUDIO_KEY_ZOOM : e.key === '-' || e.key === '_' ? 1 / STUDIO_KEY_ZOOM : 0;
    if (!turn && !zoom) return;
    used();
    let view = current();
    if (turn) view = turnBy(view, turn);
    if (zoom) view = zoomBy(view, zoom);
    preview(view);
    // A run of key presses is one step: the view is saved once the keys pause.
    saveSoon();
  });
}
