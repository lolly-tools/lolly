// SPDX-License-Identifier: MPL-2.0
/**
 * 3D Studio's pointer modes, its selection, its status line and the way its canvas edits
 * are saved. The gestures are in gestures.ts, the handles on the selected object in
 * handles.ts and the controls in toolbar.ts; all three call through here, so a mode, a
 * selection, a commit and a framing behave the same from a key, a drag or a button.
 *
 * With no mode on, a press on an object selects it and a drag on one moves it; a drag on
 * empty space orbits (plan 368, D4). Tilt, Move lights and Pick focus are the modes left,
 * each a tool with no handle of its own.
 */
import { studioActiveObject } from '../../../../../engine/src/studio3d-arrangement.ts';
import { studioCameraEdit, type StudioValues } from '../../../../../engine/src/studio3d-collection.ts';
import { studioPlaceableLights } from '../../../../../engine/src/studio3d-lights.ts';
import type { StudioSceneV1 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { tRaw } from '../../i18n.ts';
import type { StageKitPort } from '../stage-kit.ts';
import { STUDIO_REST_CAMERA } from './camera-nav.ts';
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
  /**
   * Whether the object shows its handles: chrome state, never saved. Which object it is
   * comes from the saved `activeObject` in an arrangement; a lone subject is row 0.
   */
  selected?: boolean;
  /** Place the handles on the selected object again, or take them away; set by handles.ts. */
  drawHandles?: () => void;
  /** True when the lights' handles are drawn in the stage kit's layer (light-handles.ts), so the picture draws none. */
  lightHandlesInLayer?: () => boolean;
  /** Take the handles off the stage for good: the mount is going. */
  clearHandles?: () => void;
  /** The source notes the Info panel shows; empty until the scene has loaded. */
  notes?: string;
  /** The status sentence on show, and whether it reports one action rather than the mode. */
  status?: { text: string; once: boolean };
  /** Draw the controls again from the current state; set by lib/studio3d/toolbar.ts. */
  refreshChrome?: () => void;
  /** Save a camera view a wheel or key run is still previewing; set by gestures.ts. */
  flushView?: () => void;
  /** Keep a waiting wheel or key view unsaved until `flushView` is called (gestures.ts). */
  holdView?: () => void;
  render(quality: 'preview'): void;
}

/**
 * The pointer modes. Orbit is the rest state, where a press selects, a drag on an object
 * moves it and a drag on empty space orbits; Pick focus waits for one press.
 */
export type StudioMode = 'orbit' | 'tilt' | 'lights' | 'focus';

/**
 * Write edits. One gesture or one key press is one undo step: the history's gesture is
 * closed before and after, and edits to several inputs go through `commitMany`, which the
 * history keeps as one step (views/tool-transaction.ts).
 */
export function commit(entry: StudioControls, label: string, ...edits: { id: string; value: unknown }[]): void {
  if (!edits.length) return;
  // The repaint moves the canvas, which takes its focus away; the sync gives it back, with
  // the focus ring only if the ring was on show (a key press, not a press of the pointer).
  if (entry.canvas.ownerDocument?.activeElement === entry.canvas)
    entry.canvas.dataset.restoreFocus = entry.canvas.matches(':focus-visible') ? 'canvas' : 'canvas-quiet';
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
  const camera = { ...entry.inputCamera, ...values };
  const edit = studioCameraEdit(entry.inputValues, camera);
  commit(entry, 'Camera', edit);
  // The saved inputs come back with the next render. An action that runs in the same
  // turn reads the view from the entry (Add key straight after an arrow key saved the
  // view before the key), so the entry is brought up to date at once.
  entry.inputValues = { ...entry.inputValues, [edit.id]: edit.value };
  entry.inputCamera = camera;
}
/**
 * Focus the canvas without the focus ring, for a press of the pointer: the keys still reach
 * the canvas, and the ring stays for a person who arrived by keyboard.
 */
export function focusQuietly(canvas: HTMLElement): void {
  canvas.focus({ preventScroll: true, focusVisible: false } as FocusOptions);
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
  if (flags.tiltObject === 'true') return 'tilt';
  return 'orbit';
}
/**
 * Whether objects are selected and handled on the canvas: a mount whose edits are saved,
 * drawn with a stage kit that has a handle layer. A collection's items share one pose, so
 * it keeps the sidebar for that. Without the kit (multi-edit, a Design scene box) every
 * drag moves the camera, as before.
 */
export function objectEditing(entry: StudioControls): boolean {
  return !!entry.options.setInput && !!entry.options.chrome?.layer && entry.inputValues.source !== 'collection';
}
/** The row whose handles show, or null: the arrangement's selected row, or 0 for a lone subject. */
export function selectedObject(entry: StudioControls): number | null {
  if (!entry.selected || !objectEditing(entry)) return null;
  if (!entry.recipe.objects) return 0;
  const row = activeObject(entry);
  const spec = entry.recipe.objects[row];
  return spec?.visible && !spec.pending ? row : null;
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
    case 'tilt':
      return touch ? tRaw('Drag sideways to turn the object and up or down to tilt.') : tRaw('Drag sideways to turn and up or down to tilt, or use the arrow keys.');
    default: {
      if (!objectEditing(entry)) return '';
      if (selectedObject(entry) !== null) {
        // A motion moves the object off its rest place, where the handles stand.
        if (entry.recipe.motion.kind !== 'still')
          return touch
            ? tRaw('Drag to move. The handles show when Motion is Still image.')
            : tRaw('Drag or use the arrow keys to move. The handles show when Motion is Still image.');
        return touch
          ? tRaw('Drag to move. Drag the ring to turn and the squares to lift and scale.')
          : tRaw('Drag or use the arrow keys to move. Drag the ring to turn and the squares to lift and scale.');
      }
      const one = !entry.recipe.objects;
      if (touch) return one ? tRaw('Tap the object to select it, or drag empty space to orbit.') : tRaw('Tap an object to select it, or drag empty space to orbit.');
      return one
        ? tRaw('Click the object or press Enter to select it, or drag empty space to orbit.')
        : tRaw('Click an object or press Enter to select it, or drag empty space to orbit.');
    }
  }
}
/**
 * Show or hide the selected object's handles. Chrome only: nothing is saved, and the
 * picture does not move, because the handles sit on their own layer and the status line
 * keeps its row.
 */
export function setSelected(entry: StudioControls, on: boolean): void {
  const was = selectedObject(entry);
  entry.selected = on;
  const now = selectedObject(entry);
  entry.drawHandles?.();
  if (was === now) return;
  if (studioMode(entry) === 'orbit') note(entry, modeStatus(entry, 'orbit'), false);
  entry.refreshChrome?.();
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
  flags.tiltObject = String(mode === 'tilt');
  entry.canvas.style.cursor = mode === 'focus' ? 'crosshair' : mode === 'lights' ? 'move' : 'grab';
  // In the layer a handle can stand outside the frame; the picture draws its own only when there is no layer.
  entry.handle.showLightHandles(mode === 'lights' && !entry.lightHandlesInLayer?.() ? { selected: selectedLight(entry) } : null);
  if (entry.ready) entry.render('preview');
  // A mode keeps the handles to itself: Tilt shows the ring alone, the others none.
  entry.drawHandles?.();
  // A mode's sentence replaces a report of one action; a report survives a repaint in the same mode.
  if (mode !== was || !entry.status?.once) note(entry, modeStatus(entry, mode), false);
  entry.refreshChrome?.();
}
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
/** Turn the camera to a named view: azimuth and elevation only, one undo step. */
export function viewFrom(entry: StudioControls, azimuth: number, elevation: number): void {
  cameraEdit(entry, { azimuth, elevation });
}
export function activeObject(entry: StudioControls): number {
  try {
    return studioActiveObject(entry.inputValues);
  } catch {
    return 0;
  }
}
