// SPDX-License-Identifier: MPL-2.0
/**
 * 3D Studio's pointer modes, its status line and the way its canvas edits are saved.
 * The gestures themselves are in gestures.ts and the controls in toolbar.ts; both call
 * through here, so a mode, a commit and a framing behave the same from a key, a drag or
 * a button.
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
  /** The source notes the Info panel shows; empty until the scene has loaded. */
  notes?: string;
  /** The status sentence on show, and whether it reports one action rather than the mode. */
  status?: { text: string; once: boolean };
  /** Draw the controls again from the current state; set by lib/studio3d/toolbar.ts. */
  refreshChrome?: () => void;
  /** Save a camera view a wheel or key run is still previewing; set by gestures.ts. */
  flushView?: () => void;
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
