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
 * With no mode on and a stage kit to draw handles in (plan 368, D4), a press on an object
 * selects it and a drag that starts on one moves it along the floor, selecting it first; a
 * click on empty space clears the selection. The selected object's handles (handles.ts)
 * turn, lift and scale the selection. With an object selected the arrow keys nudge it, Delete removes
 * it from an arrangement and Escape clears the selection; with none, the arrows orbit.
 *
 * The modes (Tilt, Move lights, Pick focus) keep one-pointer drags and their keys for
 * themselves. Two fingers, a pinch and the wheel move the camera in every mode.
 *
 * A gesture previews through the renderer without saving (`view`, `moveObject`,
 * `turnObject`, `scaleObject`, `moveLight`) and saves once: on release for a drag or a
 * pinch, and after a pause for the wheel and for a run of keys, so one gesture is one undo
 * step. A finger that lifts from a pinch re-anchors the one left, `pointercancel` and a
 * lost capture put the preview back, and a capture that starts mid-gesture
 * (`studio-reset-gesture`) does the same, saving a wheel or key view that was only waiting
 * for its pause.
 */
import * as THREE from 'three';
import { studioObjectSelect } from '../../../../../engine/src/studio3d-arrangement.ts';
import { studioFocusEdit } from '../../../../../engine/src/studio3d-collection.ts';
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
  focusQuietly,
  modeStatus,
  note,
  objectEditing,
  resetCamera,
  selectedLight,
  selectedObject,
  setSelected,
  setStudioMode,
  studioFit,
  studioMode,
} from './controls.ts';
import { createStudioHandles } from './handles.ts';
import { moveEdits, objectPlace, positionLimit, removeEdits, turnEdits } from './object-edit.ts';

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
  | { kind: 'tilt'; row: number; x: number; y: number; from: StudioVector3; current: StudioVector3; moved: boolean }
  | { kind: 'light'; index: number; x: number; y: number; from: StudioVector3; current: StudioVector3; moved: boolean }
  /** A press that does nothing until it is released: a miss in a mode, or a finger left over from a pinch. */
  | { kind: 'idle' };

const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

/** The rotation, in degrees, of an arrangement row or of the lone subject (row 0). */
function rotationOf(entry: StudioControls, row: number): StudioVector3 {
  return objectPlace(entry, row)?.rotation ?? [0, 0, 0];
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
    return mode === 'focus' ? 'crosshair' : mode === 'lights' ? 'move' : 'grab';
  };
  // The selected object's handles, drawn after every preview frame (mount.ts).
  const handles = createStudioHandles(entry, redraw);
  entry.drawHandles = handles.draw;
  entry.clearHandles = handles.remove;

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

  /** Put back what a drag was previewing: an object, a turn or a light. */
  function revertModePreview(): void {
    if (gesture?.kind === 'object') entry.handle.moveObject(gesture.index, gesture.from);
    else if (gesture?.kind === 'tilt') entry.handle.turnObject(gesture.row, gesture.from);
    else if (gesture?.kind === 'light') entry.handle.moveLight(gesture.index, gesture.from);
  }

  /** Drop the gesture and its preview. A wheel or key view that only waited for its pause is kept. */
  function cancel(): void {
    handles.cancel();
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
    if (mode === 'tilt') {
      const row = entry.recipe.objects ? (entry.handle.pick(aspect, nx, ny)?.index ?? activeObject(entry)) : 0;
      const from = rotationOf(entry, row);
      gesture = { kind: 'tilt', row, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      canvas.style.cursor = 'grabbing';
      return;
    }
    const hit = entry.recipe.objects || objectEditing(entry) ? entry.handle.pick(aspect, nx, ny) : null;
    const place = hit && objectEditing(entry) ? objectPlace(entry, hit.index) : null;
    if (hit && place) {
      // A press on an object selects it, and a drag from it moves it along the floor.
      gesture = { kind: 'object', index: hit.index, origin: hit.point, from: place.position, current: place.position, height: hit.point.y, moved: false };
      canvas.style.cursor = 'grabbing';
      return;
    }
    gesture = {
      kind: 'orbit',
      x: e.clientX,
      y: e.clientY,
      moved: false,
      // Without handles (multi-edit, a Design scene box) a plain click on an object still
      // selects it, so the sidebar and the frame controls follow what was pointed at.
      hit: hit?.index ?? null,
    };
    canvas.style.cursor = 'grabbing';
  }

  canvas.addEventListener('pointerdown', (e) => {
    // A second finger on the canvas while a handle drags is left alone.
    if (!editable() || handles.busy()) return;
    if (e.pointerType === 'mouse' && e.button !== 0 && e.button !== 1) return;
    // A report of the last action gives way to the mode's own sentence.
    if (entry.status?.once && pointers.size === 0) note(entry, modeStatus(entry, studioMode(entry)), false);
    focusQuietly(canvas);
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
      case 'tilt': {
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
        const limit = positionLimit(entry);
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
   * Show the handles, on an arrangement row just selected when `row` is given. The saved
   * selection comes back with the next render; the entry takes it now, so the handles
   * land on the object that was pressed rather than on the object selected before.
   */
  function showSelection(row: number | null): void {
    if (row !== null) entry.inputValues = { ...entry.inputValues, activeObject: row + 1 };
    setSelected(entry, true);
  }

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
        // A tap: a waiting wheel or key view is saved first, then the tap selects, clears
        // the selection or frames.
        save();
        if (doubleTap(e)) return;
        if (objectEditing(entry)) setSelected(entry, false);
        else if (g.hit !== null && g.hit !== activeObject(entry))
          commit(entry, tRaw('Select'), studioObjectSelect(entry.inputValues, g.hit));
        return;
      case 'tilt': {
        save();
        const edits = g.moved ? turnEdits(entry, g.row, g.current) : [];
        const select = !!entry.recipe.objects && g.row !== activeObject(entry);
        if (select) edits.unshift(studioObjectSelect(entry.inputValues, g.row));
        if (!g.moved && doubleTap(e)) return;
        commit(entry, tRaw('Turn'), ...edits);
        if (objectEditing(entry)) showSelection(select ? g.row : null);
        return;
      }
      case 'light':
        save();
        if (g.moved) commit(entry, tRaw('Light'), studioLightEdit(entry.inputValues, entry.recipe, g.index, g.current));
        return;
      case 'object': {
        save();
        // The press selected the object, whatever the release does next: a move and the
        // selection it needed are one step.
        const select = !!entry.recipe.objects && g.index !== activeObject(entry);
        const edits: { id: string; value: unknown }[] = [];
        if (select) edits.push(studioObjectSelect(entry.inputValues, g.index));
        if (g.moved) edits.push(...moveEdits(entry, g.index, g.current, ['x', 'z']));
        const framed = !g.moved && doubleTap(e);
        if (edits.length) commit(entry, g.moved ? tRaw('Move') : tRaw('Select'), ...edits);
        else if (!framed) redraw();
        showSelection(select ? g.index : null);
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

  /** Keys that turn and tilt the object in Tilt. True when the key was used. */
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

  /**
   * Keys for the selected object: the arrows nudge it along the floor (Shift for larger
   * steps), comma and full stop turn it, the square brackets select the previous or next
   * object of an arrangement, and Delete or Backspace takes it out of the arrangement.
   * True when the key was used.
   */
  function objectKey(e: KeyboardEvent): boolean {
    const row = selectedObject(entry);
    const place = row === null ? null : objectPlace(entry, row);
    if (row === null || !place) return false;
    const arrangement = !!entry.recipe.objects;
    if (arrangement && (e.key === '[' || e.key === ']')) {
      const edit = studioObjectSelect(entry.inputValues, row + (e.key === '[' ? -1 : 1));
      commit(entry, tRaw('Select'), edit);
      showSelection(Number(edit.value) - 1);
      return true;
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (!arrangement) return false;
      const edits = removeEdits(entry, row);
      if (edits.length) {
        setSelected(entry, false);
        commit(entry, tRaw('Remove'), ...edits);
      } else note(entry, tRaw('An arrangement keeps at least one object you can see.'));
      return true;
    }
    const step = e.shiftKey ? 0.5 : 0.1,
      turn = e.shiftKey ? 15 : 5;
    const limit = positionLimit(entry);
    const [px, py, pz] = place.position;
    const along = (x: number, z: number): StudioVector3 => [
      Math.max(-limit, Math.min(limit, x)),
      py,
      Math.max(-limit, Math.min(limit, z)),
    ];
    const moves: Record<string, StudioVector3> = {
      ArrowLeft: along(px - step, pz),
      ArrowRight: along(px + step, pz),
      ArrowUp: along(px, pz - step),
      ArrowDown: along(px, pz + step),
    };
    if (moves[e.key]) {
      commit(entry, tRaw('Move'), ...moveEdits(entry, row, moves[e.key]!, ['x', 'z']));
      return true;
    }
    if (e.key === ',' || e.key === '.') {
      const [x, y, z] = place.rotation;
      commit(entry, tRaw('Turn'), ...turnEdits(entry, row, [x, y + (e.key === ',' ? -turn : turn), z]));
      return true;
    }
    return false;
  }

  canvas.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      // Escape drops a drag first, then leaves a mode, then clears the selection.
      const dragging = gesture !== null || handles.busy();
      cancel();
      if (dragging) return;
      if (studioMode(entry) !== 'orbit') setStudioMode(entry, 'orbit');
      else if (selectedObject(entry) !== null) setSelected(entry, false);
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
    const modeKey = (mode === 'tilt' && turnKey(e)) || (mode === 'lights' && lightKey(e)) || (mode === 'orbit' && objectKey(e));
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
