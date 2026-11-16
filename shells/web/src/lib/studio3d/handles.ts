// SPDX-License-Identifier: MPL-2.0
/**
 * The handles on 3D Studio's selected object (plan 368, W3), drawn in the stage kit's
 * handle layer at the size of the screen, never in the picture:
 *  - a floor ring round the object's footprint. A drag on the ring or its knob turns the
 *    object about the upright axis, in steps of 15 degrees; Alt held turns it freely;
 *  - a square on a stem above the object that lifts the object, and snaps it down to the
 *    stage when the height comes close to zero;
 *  - a square at the upper right of the ring that scales the object, from 0.1 to 5;
 *  - while a handle drags, a chip by the pointer with the number: "Turn 45°", "Lift 0.30",
 *    "Scale 120 %".
 *
 * Every point is worked out from what the renderer reports (`selection`, `frameCamera`),
 * through handle-geometry.ts. The handles are placed again straight after each preview
 * frame is drawn (mount.ts calls `drawHandles` in the same task as the draw), when the
 * stage view pans or zooms, and when the stage changes size, so they never trail the
 * picture by a frame. A drag previews through the renderer without saving and saves once,
 * on release: one gesture is one undo step. Tilt shows the ring alone; Move lights and
 * Pick focus show nothing.
 */
import * as THREE from 'three';
import type { StudioVector3 } from '../../../../../packages/core/src/studio3d-v1.ts';
import { tRaw } from '../../i18n.ts';
import { type StudioControls, commit, focusQuietly, modeStatus, note, selectedObject, studioMode } from './controls.ts';
import {
  type StudioFootprint,
  type StudioScreenPoint,
  STUDIO_RING_SEGMENTS,
  studioClampScale,
  studioFloorAngle,
  studioProject,
  studioRingFront,
  studioRingPoint,
  studioRingRuns,
  studioSnapLift,
  studioSnapTurn,
  studioWrapDegrees,
} from './handle-geometry.ts';
import { moveEdits, objectPlace, positionLimit, scaleEdits, turnEdits } from './object-edit.ts';

/** The stem from the top of the object to the lift square: Design's rotate stem (ROTATE_STEM). */
const STEM_PX = 30;
/** The touch target round a handle (stage-kit.css): 30px with a mouse, 44px on a coarse pointer. */
const MOUSE_PX = 30;
const TOUCH_PX = 44;
/** The chip stands this far below and to the right of a mouse pointer, as Design's does. */
const CHIP_OFFSET = 14;
const SVG_NS = 'http://www.w3.org/2000/svg';
/** The group of the selected object's actions, which the kit floats by the selection (toolbar.ts). */
const OBJECT_BAR = 'studio-object';
/** The space between the ring and the actions under it, clear of the knob's touch target. */
const OBJECT_BAR_GAP = 20;
/** The height the actions take: one row of the kit's buttons and its padding. */
const OBJECT_BAR_HEIGHT = 44;

type Point = [number, number];

type Drag =
  | { kind: 'turn'; id: number; row: number; from: StudioVector3; footprint: StudioFootprint; last: number; total: number; knob: number; value: number }
  | { kind: 'lift'; id: number; row: number; from: StudioVector3; plane: THREE.Plane | null; start: number; y0: number; perUnit: number; value: number }
  | { kind: 'scale'; id: number; row: number; from: number; center: Point; d0: number; value: number };

interface Nodes {
  root: HTMLElement;
  lines: SVGSVGElement;
  hit: SVGPathElement;
  /** The whole ring, faint: the part the object hides is still read as a ring. */
  behind: SVGPathElement;
  ring: SVGPathElement;
  stem: SVGLineElement;
  /** Joins the scale square to the ring where the square had to stand off the ring. */
  reach: SVGLineElement;
  knob: HTMLElement;
  lift: HTMLElement;
  scale: HTMLElement;
  chip: HTMLElement;
}

export interface StudioHandles {
  /** Place the handles on the selected object again, or hide them. */
  draw(): void;
  /** Drop a handle drag in progress and put its preview back. True when one was running. */
  cancel(): boolean;
  /** True while a handle drags. */
  busy(): boolean;
  /** Take the handles off the stage. */
  remove(): void;
}

const fmt = (n: number): string => (Math.round(n * 10) / 10).toString();

function handleEl(doc: Document, kind: string, cursor: string, round = false): HTMLElement {
  const el = doc.createElement('div');
  el.className = 'stage-kit-handle';
  el.dataset.studioHandle = kind;
  el.dataset.cursor = cursor;
  if (round) el.dataset.shape = 'round';
  el.hidden = true;
  return el;
}

/** The handles for one mount. `redraw` asks for a preview frame, which draws the handles after the frame. */
export function createStudioHandles(entry: StudioControls, redraw: () => void): StudioHandles {
  let nodes: Nodes | null = null;
  let layer: HTMLElement | null = null;
  let drag: Drag | null = null;
  /** The ring's centre on the screen at the last draw, in layer pixels; the scale drag measures from this point. */
  let center: Point | null = null;
  let resize: ResizeObserver | null = null;
  /** True while the status line holds a drag's number (touch). */
  let readout = false;

  function build(doc: Document): Nodes {
    const root = doc.createElement('div');
    root.dataset.studioHandles = '';
    root.hidden = true;
    const lines = doc.createElementNS(SVG_NS, 'svg');
    lines.setAttribute('class', 'stage-kit-lines');
    const hit = doc.createElementNS(SVG_NS, 'path');
    hit.setAttribute('class', 'stage-kit-outline-hit');
    hit.dataset.studioHandle = 'ring';
    const behind = doc.createElementNS(SVG_NS, 'path');
    behind.setAttribute('class', 'stage-kit-outline stage-kit-outline--behind');
    const ring = doc.createElementNS(SVG_NS, 'path');
    ring.setAttribute('class', 'stage-kit-outline');
    ring.dataset.studioRing = '';
    const stem = doc.createElementNS(SVG_NS, 'line');
    stem.setAttribute('class', 'stage-kit-stem');
    const reach = doc.createElementNS(SVG_NS, 'line');
    reach.setAttribute('class', 'stage-kit-stem');
    lines.append(behind, ring, stem, reach, hit);
    const knob = handleEl(doc, 'turn', 'grab', true);
    const lift = handleEl(doc, 'lift', 'ns');
    const scale = handleEl(doc, 'scale', 'nesw');
    const chip = doc.createElement('div');
    chip.className = 'stage-kit-chip';
    chip.dataset.studioChip = '';
    chip.hidden = true;
    root.append(lines, knob, lift, scale, chip);
    for (const [el, kind] of [[hit, 'turn'], [knob, 'turn'], [lift, 'lift'], [scale, 'scale']] as const) {
      el.addEventListener('pointerdown', (e) => press(kind, e as PointerEvent));
      el.addEventListener('pointermove', (e) => move(e as PointerEvent));
      el.addEventListener('pointerup', (e) => release(e as PointerEvent));
      el.addEventListener('pointercancel', () => cancel());
      el.addEventListener('lostpointercapture', (e) => {
        if (drag && (e as PointerEvent).pointerId === drag.id) cancel();
      });
    }
    return { root, lines, hit, behind, ring, stem, reach, knob, lift, scale, chip };
  }

  /** Find the kit's layer and put the handles in it; null when the mount draws no handles. */
  function attach(): Nodes | null {
    const next = entry.options.chrome?.layer?.() ?? null;
    if (next !== layer) {
      layer?.parentElement?.removeEventListener('lolly:stage-view', draw);
      resize?.disconnect();
      resize = null;
      nodes?.root.remove();
      layer = next;
      if (layer) {
        nodes ??= build(layer.ownerDocument);
        layer.append(nodes.root);
        // The stage's own pan and zoom move the canvas without drawing a frame.
        layer.parentElement?.addEventListener('lolly:stage-view', draw);
        const RO = layer.ownerDocument.defaultView?.ResizeObserver;
        resize = RO ? new RO(() => draw()) : null;
        resize?.observe(layer);
      }
    }
    return layer && nodes;
  }

  function hide(n: Nodes): void {
    n.root.hidden = true;
    center = null;
    entry.options.chrome?.placeFloat?.(OBJECT_BAR, null);
  }

  function place(el: HTMLElement, at: Point | null): void {
    el.hidden = !at;
    if (at) el.style.transform = `translate(${fmt(at[0])}px, ${fmt(at[1])}px)`;
  }

  function draw(): void {
    const n = attach();
    if (!n || !layer) return;
    const row = selectedObject(entry);
    const mode = studioMode(entry);
    const camera = entry.handle.frameCamera();
    const failed = entry.marker.dataset.studioState === 'error';
    // The handles stand at the object's rest place, so they show only on a frame drawn there.
    const atRest = entry.handle.frameAtRest();
    const selection = row !== null && camera && !failed && atRest && (mode === 'orbit' || mode === 'tilt') ? entry.handle.selection(row) : null;
    const box = entry.canvas.getBoundingClientRect();
    if (!selection || !camera || !box.width || !box.height) {
      if (drag) cancel();
      hide(n);
      // A motion has moved the object off its rest place, so no handle is drawn. The
      // object's actions must still be in reach: they stand at the foot of the picture.
      if (row !== null && !failed && !atRest && (mode === 'orbit' || mode === 'tilt') && box.width && box.height) {
        const frame = layer.getBoundingClientRect();
        entry.options.chrome?.placeFloat?.(OBJECT_BAR, {
          x: box.left - frame.left + box.width / 2,
          y: box.bottom - frame.top - OBJECT_BAR_HEIGHT - OBJECT_BAR_GAP,
        });
      }
      return;
    }
    const footprint: StudioFootprint = {
      center: selection.center,
      radius: selection.radius,
      box: new THREE.Box3(selection.min, selection.max),
    };
    const frame = layer.getBoundingClientRect();
    const px = ([fx, fy]: StudioScreenPoint): Point => [box.left - frame.left + fx * box.width, box.top - frame.top + fy * box.height];
    const runs = studioRingRuns(camera, footprint).map((run) => run.map(px));
    if (!runs.length) {
      hide(n);
      return;
    }
    const d = runs.map((run) => `M${run.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}`).join('');
    n.ring.setAttribute('d', d);
    n.hit.setAttribute('d', d);
    // Every point of the ring on screen, in order. The whole ring is drawn faint under
    // the visible runs, so the part behind the object still reads as one ring.
    const ring: Point[] = [];
    for (let i = 0; i < STUDIO_RING_SEGMENTS; i++) {
      const p = studioProject(camera, studioRingPoint(footprint, (i * 360) / STUDIO_RING_SEGMENTS));
      if (p) ring.push(px(p));
    }
    const whole = ring.length === STUDIO_RING_SEGMENTS;
    n.behind.setAttribute('d', whole ? `M${ring.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join('L')}Z` : '');
    n.root.hidden = false;
    const middle = studioProject(camera, footprint.center);
    center = middle ? px(middle) : null;
    // Tilt keeps the ring as the selection's outline and gives the drag to the whole canvas.
    const handles = mode === 'orbit';
    n.hit.style.display = handles ? '' : 'none';

    // The knob rests on the side of the ring that faces the eye; a turn carries it round.
    const knobAngle = drag?.kind === 'turn' ? drag.knob : studioRingFront(camera, footprint);
    const knob = handles ? studioProject(camera, studioRingPoint(footprint, knobAngle)) : null;
    place(n.knob, knob && px(knob));

    // The lift square stands on a stem that rises from the top of the object: the point
    // over its centre at the height of its bounds. (The top of the bounds' box on screen
    // is higher than the object looks, and left the stem standing in the air.)
    const crown = studioProject(camera, new THREE.Vector3(footprint.center.x, footprint.box.max.y, footprint.center.z));
    const base: Point | null = handles && crown ? px(crown) : null;
    const tip: Point | null = base && [base[0], base[1] - STEM_PX];
    n.stem.style.display = base ? '' : 'none';
    if (base && tip) {
      n.stem.setAttribute('x1', fmt(base[0]));
      n.stem.setAttribute('y1', fmt(base[1]));
      n.stem.setAttribute('x2', fmt(tip[0]));
      n.stem.setAttribute('y2', fmt(tip[1]));
    }
    place(n.lift, tip);

    // The scale square sits on the ring, at the ring's right end on screen: a drag away
    // from the centre makes the ring, and the object, larger. Where the knob or the lift
    // square comes closer than one touch target, the square moves further out along the
    // line from the centre, so one press never reaches two handles.
    let corner: Point | null = null;
    let joined: Point | null = null;
    if (handles && ring.length && center) {
      const end: Point = ring.reduce((best, p) => (p[0] > best[0] ? p : best));
      const gap = layer.ownerDocument.defaultView?.matchMedia?.('(any-pointer: coarse)').matches ? TOUCH_PX : MOUSE_PX;
      const out = Math.hypot(end[0] - center[0], end[1] - center[1]) || 1;
      const dir: Point = [(end[0] - center[0]) / out, (end[1] - center[1]) / out];
      let x = end[0], y = end[1];
      for (const other of [knob && px(knob), tip]) {
        if (!other) continue;
        const short: number = gap - Math.hypot(x - other[0], y - other[1]);
        if (short > 0) { x += short * dir[0]; y += short * dir[1]; }
      }
      corner = [x, y];
      // A square that stands off the ring keeps a line to the ring, as the lift square
      // keeps its stem: a handle is never left floating.
      if (Math.hypot(x - end[0], y - end[1]) > 4) joined = end;
    }
    place(n.scale, corner);
    n.reach.style.display = corner && joined ? '' : 'none';
    if (corner && joined) {
      n.reach.setAttribute('x1', fmt(joined[0]));
      n.reach.setAttribute('y1', fmt(joined[1]));
      n.reach.setAttribute('x2', fmt(corner[0]));
      n.reach.setAttribute('y2', fmt(corner[1]));
    }

    // The object's own actions stand under the ring, clear of the knob. Where the stage
    // ends below the ring they stand over the lift square. A handle drag hides them.
    const low = ring.length ? Math.max(...ring.map((p) => p[1])) : null;
    if (drag || low === null || !center) entry.options.chrome?.placeFloat?.(OBJECT_BAR, null);
    else {
      const below = low + OBJECT_BAR_GAP;
      const fits = below + OBJECT_BAR_HEIGHT <= frame.height - OBJECT_BAR_GAP;
      const high = Math.min(tip ? tip[1] : Infinity, ...ring.map((p) => p[1]));
      entry.options.chrome?.placeFloat?.(OBJECT_BAR, { x: center[0], y: fits ? below : Math.max(0, high - OBJECT_BAR_GAP - OBJECT_BAR_HEIGHT) });
    }
    place(n.scale, corner);
  }

  /** The ray under a pointer, through the camera the frame on screen was drawn with. */
  function rayAt(e: PointerEvent): THREE.Ray | null {
    const camera = entry.handle.frameCamera();
    const box = entry.canvas.getBoundingClientRect();
    if (!camera || !box.width || !box.height) return null;
    const caster = new THREE.Raycaster();
    caster.setFromCamera(new THREE.Vector2(((e.clientX - box.left) / box.width) * 2 - 1, 1 - ((e.clientY - box.top) / box.height) * 2), camera);
    return caster.ray;
  }

  /** The floor angle under the pointer: through the floor, or round the ring's centre on screen when the floor is seen edge on. */
  function angleAt(e: PointerEvent, footprint: StudioFootprint): number {
    const hit = rayAt(e)?.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), -footprint.center.y), new THREE.Vector3());
    if (hit && hit.distanceTo(footprint.center) < footprint.radius * 40) return studioFloorAngle(footprint, hit);
    const camera = entry.handle.frameCamera();
    const at = local(e);
    if (!camera || !center || !at) return 0;
    return studioRingFront(camera, footprint) + THREE.MathUtils.radToDeg(Math.atan2(at[0] - center[0], at[1] - center[1]));
  }

  /** A pointer in layer pixels. */
  function local(e: PointerEvent): Point | null {
    const frame = layer?.getBoundingClientRect();
    return frame ? [e.clientX - frame.left, e.clientY - frame.top] : null;
  }

  function showChip(e: PointerEvent, text: string): void {
    const n = nodes;
    const at = local(e);
    if (!n || !at || !layer) return;
    if (e.pointerType !== 'mouse') {
      // A finger covers what it drags and a chip by the finger covered the subject. On
      // touch the number goes in the status line, which stands clear of the picture.
      n.chip.hidden = true;
      readout = true;
      note(entry, text, false);
      return;
    }
    if (n.chip.textContent !== text) n.chip.textContent = text;
    n.chip.hidden = false;
    const room = layer.getBoundingClientRect();
    const w = n.chip.offsetWidth, h = n.chip.offsetHeight;
    // Below and to the right of the pointer, turned to the other side where the stage
    // edge would cut it off.
    const x = at[0] + CHIP_OFFSET + w > room.width ? at[0] - CHIP_OFFSET - w : at[0] + CHIP_OFFSET;
    const y = at[1] + CHIP_OFFSET + h > room.height ? at[1] - CHIP_OFFSET - h : at[1] + CHIP_OFFSET;
    n.chip.style.transform = `translate(${fmt(x)}px, ${fmt(y)}px)`;
  }

  function chipText(d: Drag): string {
    if (d.kind === 'turn') return tRaw('Turn {n}°', { n: d.value });
    if (d.kind === 'lift') return tRaw('Lift {n}', { n: d.value.toFixed(2) });
    return tRaw('Scale {n} %', { n: Math.round(d.value * 100) });
  }

  function press(kind: Drag['kind'], e: PointerEvent): void {
    if (drag || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const row = selectedObject(entry);
    const place = row === null ? null : objectPlace(entry, row);
    const selection = row === null ? null : entry.handle.selection(row);
    const camera = entry.handle.frameCamera();
    if (row === null || !place || !selection || !camera || !entry.ready || studioMode(entry) !== 'orbit') return;
    e.preventDefault();
    e.stopPropagation();
    // A wheel or key view still waiting for its pause is kept until this drag ends.
    entry.holdView?.();
    focusQuietly(entry.canvas);
    if (entry.status?.once) note(entry, modeStatus(entry, 'orbit'), false);
    const footprint: StudioFootprint = { center: selection.center, radius: selection.radius, box: new THREE.Box3(selection.min, selection.max) };
    if (kind === 'turn') {
      const angle = angleAt(e, footprint);
      drag = { kind, id: e.pointerId, row, from: place.rotation, footprint, last: angle, total: 0, knob: angle, value: Math.round(studioWrapDegrees(place.rotation[1])) || 0 };
    } else if (kind === 'lift') {
      // A vertical plane through the object, facing the eye, keeps the square under the pointer.
      const facing = camera.getWorldDirection(new THREE.Vector3()).setY(0);
      const plane = facing.lengthSq() > 1e-6 ? new THREE.Plane().setFromNormalAndCoplanarPoint(facing.normalize(), footprint.center) : null;
      const hit = plane && rayAt(e)?.intersectPlane(plane, new THREE.Vector3());
      // Where the floor is seen from straight above, the drag reads screen pixels instead.
      const top = studioProject(camera, footprint.center.clone().setY(footprint.box.max.y));
      const above = studioProject(camera, footprint.center.clone().setY(footprint.box.max.y + 1));
      const box = entry.canvas.getBoundingClientRect();
      const perUnit = top && above ? Math.max(1, Math.abs(top[1] - above[1]) * box.height) : 100;
      drag = { kind, id: e.pointerId, row, from: place.position, plane: hit ? plane : null, start: hit ? hit.y : e.clientY, y0: place.position[1], perUnit, value: place.position[1] };
    } else {
      const at = local(e);
      const d0 = at && center ? Math.hypot(at[0] - center[0], at[1] - center[1]) : 0;
      if (d0 < 4 || !center) return;
      drag = { kind, id: e.pointerId, row, from: place.scale, center, d0, value: place.scale };
    }
    try { (e.currentTarget as Element).setPointerCapture(e.pointerId); } catch { /* a pointer that has already gone */ }
    layer?.setAttribute('data-dragging', kind);
    showChip(e, chipText(drag));
  }

  function move(e: PointerEvent): void {
    const d = drag;
    if (!d || e.pointerId !== d.id) return;
    const free = e.altKey;
    if (d.kind === 'turn') {
      const angle = angleAt(e, d.footprint);
      d.total += studioWrapDegrees(angle - d.last);
      d.last = angle;
      const value = studioSnapTurn(d.from[1] + d.total, free);
      // The knob turns with the object, so it moves in the same steps the object does.
      d.knob += studioWrapDegrees(value - d.value);
      d.value = value;
      entry.handle.turnObject(d.row, [d.from[0], value, d.from[2]]);
    } else if (d.kind === 'lift') {
      const hit = d.plane && rayAt(e)?.intersectPlane(d.plane, new THREE.Vector3());
      const rise = hit ? hit.y - d.start : (d.start - e.clientY) / d.perUnit;
      const limit = positionLimit(entry);
      d.value = studioSnapLift(Math.max(Math.min(0, d.y0), Math.min(limit, d.y0 + rise)), free);
      entry.handle.moveObject(d.row, [d.from[0], d.value, d.from[2]]);
    } else {
      const at = local(e);
      if (!at) return;
      d.value = studioClampScale((d.from * Math.hypot(at[0] - d.center[0], at[1] - d.center[1])) / d.d0);
      entry.handle.scaleObject(d.row, d.value);
    }
    showChip(e, chipText(d));
    redraw();
  }

  /** End a drag: the chip and the grabbing cursor go. */
  function end(): Drag | null {
    const d = drag;
    drag = null;
    layer?.removeAttribute('data-dragging');
    if (nodes) nodes.chip.hidden = true;
    // The status line showed the number on touch; the mode's own sentence comes back.
    if (readout) {
      readout = false;
      note(entry, modeStatus(entry, studioMode(entry)), false);
    }
    return d;
  }

  function release(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.id) return;
    const d = end()!;
    // The view that waited through the drag is saved first, as its own step.
    entry.flushView?.();
    if (d.kind === 'turn' && d.value !== (Math.round(studioWrapDegrees(d.from[1])) || 0))
      commit(entry, tRaw('Turn'), ...turnEdits(entry, d.row, [d.from[0], d.value, d.from[2]]));
    else if (d.kind === 'lift' && d.value !== d.from[1])
      commit(entry, tRaw('Lift'), ...moveEdits(entry, d.row, [d.from[0], d.value, d.from[2]], ['y']));
    else if (d.kind === 'scale' && d.value !== d.from)
      commit(entry, tRaw('Scale'), ...scaleEdits(entry, d.row, d.value));
    else draw();
  }

  function cancel(): boolean {
    const d = end();
    if (!d) return false;
    if (d.kind === 'turn') entry.handle.turnObject(d.row, d.from);
    else if (d.kind === 'lift') entry.handle.moveObject(d.row, d.from);
    else entry.handle.scaleObject(d.row, d.from);
    redraw();
    return true;
  }

  function remove(): void {
    end();
    layer?.parentElement?.removeEventListener('lolly:stage-view', draw);
    resize?.disconnect();
    resize = null;
    nodes?.root.remove();
    layer = null;
  }

  return { draw, cancel, busy: () => drag !== null, remove };
}
