// SPDX-License-Identifier: MPL-2.0
/**
 * The handles on 3D Studio's lights, drawn in the stage kit's handle layer.
 *
 * A light stands round the subject, and most lights stand outside the picture: a rim
 * light is behind and above, a key light is beside the camera. Drawn inside the picture,
 * a light's handle was cut off at the frame's edge the moment the light left the frame.
 * The handle layer covers the whole stage, so here a handle stands where its light is,
 * inside the frame or beyond the edge, and can be dragged from there.
 *
 * Each placeable light gets a round handle in the light's own colour and a line to the
 * point the lights aim at. A light far off to one side is held within reach: its handle
 * stands a little beyond the frame on that side, never off the screen. A light behind the camera cannot be seen from the camera, so
 * its handle stands just beyond the frame on the side the light is on, drawn fainter.
 * A drag turns the light round the subject exactly as a drag on the picture does
 * (gestures.ts), previews through the renderer and saves once on release.
 */
import * as THREE from 'three';
import type { StudioVector3 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { STUDIO_LIGHT_TARGET, studioLightEdit, studioOrbitLight, studioPlaceableLights } from '../../../../../engine/src/studio3d-lights.ts';
import { tRaw } from '../../i18n.ts';
import { type StudioControls, commit, lightName, modeStatus, note, selectedLight, setStudioMode, studioMode } from './controls.ts';
import { studioHoldInRect, studioLightPoint, studioProject } from './handle-geometry.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** How far beyond the frame's edge the handle of a light behind the camera stands. */
const BEHIND_GAP = 28;
/** A handle stands at most this far beyond the frame, so every light is in reach beside the picture. */
const REACH = 72;
/** A handle keeps this far inside the stage's own edge, and clear of the bar across the top. */
const STAGE_INSET = 20;
const STAGE_TOP = 72;
/** A drag shorter than this is a press: the light is selected and nothing moves. */
const SLOP = 3;

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

export interface StudioLightHandles {
  /** Place the handles on the frame just drawn. */
  draw(): void;
  /** True while a handle is being dragged. */
  busy(): boolean;
  /** Put a dragged light back and stop the drag; true when a drag was cancelled. */
  cancel(): boolean;
  /** Take the handles off the stage. */
  remove(): void;
  /** True when the handles are drawn in the layer, so the picture need not draw its own. */
  active(): boolean;
}

interface Knob { el: HTMLElement; line: SVGLineElement }
interface Drag { id: number; index: number; x: number; y: number; from: StudioVector3; current: StudioVector3; moved: boolean }

/** The light handles for one mount. `redraw` asks for a preview frame, which places the handles after the frame. */
export function createStudioLightHandles(entry: StudioControls, redraw: () => void): StudioLightHandles {
  let layer: HTMLElement | null = null;
  let root: HTMLElement | null = null;
  let lines: SVGSVGElement | null = null;
  const knobs = new Map<number, Knob>();
  let drag: Drag | null = null;

  function attach(): boolean {
    const next = entry.options.chrome?.layer?.() ?? null;
    if (next !== layer) {
      root?.remove();
      knobs.clear();
      layer = next;
      root = null;
    }
    if (!layer) return false;
    if (!root) {
      const doc = layer.ownerDocument;
      root = doc.createElement('div');
      root.className = 'studio-light-handles';
      lines = doc.createElementNS(SVG_NS, 'svg') as SVGSVGElement;
      lines.setAttribute('class', 'stage-kit-lines');
      root.append(lines);
      layer.append(root);
    }
    return true;
  }

  function knobFor(index: number): Knob {
    const held = knobs.get(index);
    if (held) return held;
    const doc = root!.ownerDocument;
    const el = doc.createElement('div');
    el.className = 'stage-kit-handle studio-light-handle';
    el.dataset.shape = 'round';
    el.dataset.cursor = 'grab';
    el.dataset.studioLight = String(index);
    const line = doc.createElementNS(SVG_NS, 'line') as SVGLineElement;
    line.setAttribute('class', 'studio-light-line');
    lines!.append(line);
    root!.append(el);
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || drag) return;
      const position = entry.recipe.lights[index]?.position;
      if (!position) return;
      e.preventDefault();
      e.stopPropagation();
      el.setPointerCapture(e.pointerId);
      entry.selectedLight = index;
      setStudioMode(entry, 'lights');
      note(entry, modeStatus(entry, 'lights'), false);
      const from = [...position] as StudioVector3;
      drag = { id: e.pointerId, index, x: e.clientX, y: e.clientY, from, current: from, moved: false };
      if (layer) layer.dataset.dragging = '';
    });
    el.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < SLOP) return;
      drag.moved = true;
      // The same turn a drag on the picture gives (gestures.ts), so both feel alike.
      drag.current = studioOrbitLight(drag.from, -dx * 0.4, dy * 0.3);
      entry.handle.moveLight(drag.index, drag.current);
      redraw();
    });
    const finish = (e: PointerEvent, keep: boolean): void => {
      if (!drag || e.pointerId !== drag.id) return;
      const done = drag;
      drag = null;
      if (layer) delete layer.dataset.dragging;
      if (!done.moved) return;
      if (keep) commit(entry, tRaw('Light'), studioLightEdit(entry.inputValues, entry.recipe, done.index, done.current));
      else { entry.handle.moveLight(done.index, done.from); redraw(); }
    };
    el.addEventListener('pointerup', (e) => finish(e, true));
    el.addEventListener('pointercancel', (e) => finish(e, false));
    el.addEventListener('lostpointercapture', (e) => finish(e as PointerEvent, false));
    const knob = { el, line };
    knobs.set(index, knob);
    return knob;
  }

  function hideAll(): void {
    if (root) root.hidden = true;
  }

  function draw(): void {
    if (!attach() || !layer || !root) return;
    const camera = entry.handle.frameCamera();
    const box = entry.canvas.getBoundingClientRect();
    const failed = entry.marker.dataset.studioState === 'error';
    if (studioMode(entry) !== 'lights' || !camera || failed || !box.width || !box.height) { hideAll(); return; }
    root.hidden = false;
    const frame = layer.getBoundingClientRect();
    const left = box.left - frame.left, top = box.top - frame.top;
    const aim = studioProject(camera, new THREE.Vector3(...STUDIO_LIGHT_TARGET)) ?? [0.5, 0.5];
    const aimX = left + aim[0] * box.width, aimY = top + aim[1] * box.height;
    const reach = {
      left: Math.max(STAGE_INSET, left - REACH),
      top: Math.max(STAGE_TOP, top - REACH),
      right: Math.min(frame.width - STAGE_INSET, left + box.width + REACH),
      bottom: Math.min(frame.height - STAGE_INSET, top + box.height + REACH),
    };
    const placeable = studioPlaceableLights(entry.recipe);
    const chosen = selectedLight(entry);
    for (const [index, knob] of knobs) if (!placeable.includes(index)) { knob.el.remove(); knob.line.remove(); knobs.delete(index); }
    for (const index of placeable) {
      const light = entry.recipe.lights[index]!;
      // A light being dragged is drawn at the place the drag has given the light, not at its saved place.
      const position = drag?.index === index ? drag.current : light.position;
      const at = studioLightPoint(camera, new THREE.Vector3(...position));
      const half = Math.max(box.width, box.height) / 2 + BEHIND_GAP;
      const wantX = at.behind ? left + box.width / 2 + at.point[0] * half : left + at.point[0] * box.width;
      const wantY = at.behind ? top + box.height / 2 + at.point[1] * half : top + at.point[1] * box.height;
      // A light far off to one side would put its handle off the screen. The handle is held
      // within reach: a little beyond the frame at most, and always inside the stage.
      const held = studioHoldInRect([aimX, aimY], [wantX, wantY], reach);
      const [x, y] = held.point;
      const knob = knobFor(index);
      knob.el.style.transform = `translate(${fmt(x)}px, ${fmt(y)}px)`;
      knob.el.style.setProperty('--studio-light', light.color);
      knob.el.title = lightName(entry, index);
      knob.el.toggleAttribute('data-selected', index === chosen);
      knob.el.toggleAttribute('data-behind', at.behind);
      knob.el.toggleAttribute('data-held', held.held);
      knob.line.setAttribute('x1', fmt(x));
      knob.line.setAttribute('y1', fmt(y));
      knob.line.setAttribute('x2', fmt(aimX));
      knob.line.setAttribute('y2', fmt(aimY));
      knob.line.style.setProperty('--studio-light', light.color);
      knob.line.toggleAttribute('data-selected', index === chosen);
      knob.line.toggleAttribute('data-behind', at.behind);
    }
  }

  return {
    draw,
    busy: () => drag !== null,
    cancel(): boolean {
      if (!drag) return false;
      const done = drag;
      drag = null;
      if (layer) delete layer.dataset.dragging;
      if (done.moved) entry.handle.moveLight(done.index, done.from);
      return true;
    },
    remove(): void {
      root?.remove();
      root = null;
      knobs.clear();
    },
    active: () => !!(entry.options.chrome?.layer?.()),
  };
}
