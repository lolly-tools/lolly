// SPDX-License-Identifier: MPL-2.0
/**
 * motion-path.ts - the PATH a keyframed box travels, drawn over the canvas while that
 * box is selected (plans/104 section 8's motion-path bullet, under section 6.5's projection rule).
 *
 * One polyline per selected animated box, with a diamond at every keyframe time. The
 * numbers are not this module's: `kfMotionPath` (views/timeline-math.ts) samples
 * `pose(t) = evaluateKf → resolveCamera → projectLayer` straight out of the engine and
 * hands over native-px points, which this file maps through the SAME `nativeToStage`
 * the selection outline uses. That division is section 6.5's rule made structural - a path
 * drawn from raw keyframe offsets would promise a straight line where a camera will
 * actually render a parallax curve, i.e. it would lie about the export.
 *
 * ── THE EXPORT CONTRACT (verbatim from onion-skin.ts, and for the same reason) ───────
 * A path must never reach a rendered file. Three INDEPENDENT guarantees, each with its
 * own test in motion-path.test.ts:
 *
 *   1. The layer is a child of `.fc-overlay`, a STAGE SIBLING of `#tool-canvas` - it is
 *      outside the node `runtime.export` is ever handed.
 *   2. It carries `data-export-hide`, so bridge/export.ts's `detachExportHidden` REMOVES
 *      it from the DOM upstream of every format dispatch (including parseSequenceStage),
 *      even if an export node were ever widened to the whole stage.
 *   3. It never writes a class or an inline style to a `.lolly-box`. Here that is
 *      STRUCTURAL rather than merely observed: this module is never handed the canvas
 *      element at all, so there is no `.lolly-box` in reach to write to - it draws from
 *      the model's own numbers and the injected metrics, and a source scan pins that.
 *
 * ── WHY SVG, AND WHY ONE ELEMENT PER RUN ────────────────────────────────────────────
 * A polyline needs real path geometry, so this is the one overlay layer that is an
 * `<svg>` rather than positioned divs. Stroke widths are plain px in STAGE space, so
 * they stay constant under canvas zoom by construction (there is no vector-effect and
 * none is wanted - a hairline that thins as you zoom out is the failure mode).
 *
 * The engine's behind-camera ramp (`projectDepth().alphaGuard`) is carried on every
 * sample, and a run of samples is BROKEN wherever it reaches 0: a layer that passes
 * behind the camera is not on screen there, and a polyline drawn straight across that
 * gap would draw travel that never happens.
 *
 * ── MOTION ──────────────────────────────────────────────────────────────────────────
 * The path itself is a SOLID static line and is drawn under every preference - it is
 * geometry, and geometry is information. The one ANIMATED affordance is a second,
 * additive stroke over the same points (`.mp-flow`) whose dashes travel forward to
 * read out the direction of the move, and it has two independent gates:
 *
 *   1. `prefersReducedMotion()` (which ORs the OS media query with the app pref) - 
 *      checked at paint, so the element is NOT MINTED AT ALL. The gate is therefore a
 *      DOM fact a test can assert, not a CSS property nobody can see in jsdom.
 *   2. The stylesheet's own `prefers-reduced-motion` + `html[data-a11y-motion]` blocks,
 *      which stop a layer painted BEFORE the pref flipped from marching on.
 *
 * plans/104 section 8's a11y note is the reason there are two: canvas visuals are exempt from
 * the a11y prefs by contract (`a11y-prefs.ts:14–18`), so the lever for anything moving
 * over the canvas is playback policy - and an animated affordance is playback.
 *
 * ── EDITING (plans/330) ─────────────────────────────────────────────────────────────
 * With an `edit` port the path can be changed by pointer. Each point that keys a
 * position gets a hit target; the LINE never does, so a drag along the path between
 * points does nothing and nothing here creates a keyframe. Dragging a point moves that
 * keyframe's x/y; a click selects it, which shows its handles (the pen tool's own
 * `.fc-pen-handle`/`.fc-pen-arm` marks) and a chip with its time and **Curve the path**
 * or **Straighten**. While dragging, the chip shows the time of the keyframe in hand.
 * Every edit is previewed on the path alone and written with ONE `commit` on release.
 *
 * The numbers are motion-path-math.ts's: a pointer is read in NATIVE px, as the camera
 * shows the box at that keyframe's time, and `pathProjector` maps it back to the box's
 * own surface offsets exactly (the camera's scale and translate undone, or its
 * homography inverted when it is tilted). Snapping and Shift's 15 degree steps are the
 * pen tool's, through the port; Alt bypasses snapping, and breaks two in-line handles
 * apart while one is dragged, as it does on a pen node.
 *
 * The export contract above still holds: every node the editing adds is minted here,
 * inside the same `[data-export-hide]` layer, and none of it is a `.lolly-box`. The
 * layer stays `aria-hidden`: the keyboard and screen-reader route to the same edits is
 * the Keyframes popup (timeline-panel/kf-path.ts), as it is for the timeline's diamonds.
 */
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { announce } from '../a11y.ts';
import { t } from '../i18n.ts';
import { iconNode } from '../lib/icon-node.ts';
import { constrainAngle } from './free-canvas-pen-ops.ts';
import { boxRect, rectCentre, type Box } from './free-canvas-math.ts';
import {
  deriveDuration, fmtTime, indexOfId, kfBoxTrack, kfCameraClips, kfMotionPath, kfTimelineSec, setKfTrack,
  type MotionPathEnv, type TimeCfg,
} from './timeline-math.ts';
import {
  handlesInLine, hasHandles, holdsPosition, keyPosition, kfTrackCurve, kfTrackSetHandles, kfTrackSetPosition,
  kfTrackStraighten, mirrorHandle, pathKeyPoints, pathProjector, type PathKeyPoint, type Pt,
} from './motion-path-math.ts';
import type { KfHandle, KfKey } from '../../../../engine/src/keyframes.ts';
import '../styles/parts/motion-path.css';

/** What `nativeToStage` needs, and nothing more - so a test can pass plain objects. */
export interface MotionMetrics {
  cr: { left: number; top: number };
  sr: { left: number; top: number };
  scale: number;
}

/**
 * What EDITING the path needs from the canvas (plans/330). Absent, the path is drawn
 * read-only, exactly as before.
 */
export interface MotionPathEditPort {
  /** Write a rebuilt boxes array: one commit, one undo step. */
  commit(boxes: Box[]): void;
  /** Can this box's path be edited now? False for a locked box, or one off the playhead. */
  editable(id: string): boolean;
  /**
   * Snap a native point the way the pen tool snaps a node (grid, smart guides, and
   * `nodes` as extra lines), drawing the guides that caught. `alt` bypasses the snap.
   */
  snap(at: Pt, alt: boolean, nodes: readonly Pt[], id: string): Pt;
  /** Take the snap guides down. */
  clearGuides(): void;
  /**
   * The selection chrome's bounds in stage px (the outline and its rotate handle), so
   * the chip of a point that sits under the selected box goes below that chrome rather
   * than over its handles. Optional; null when nothing is drawn.
   */
  clearOf?(): { left: number; top: number; right: number; bottom: number } | null;
  /**
   * Open the canvas's own context menu at a client point. A point's target takes only
   * the primary button, and the resting point sits on the box's centre, so a right-click
   * there has to reach the box's menu rather than the browser's. Optional.
   */
  menu?(clientX: number, clientY: number, soloBox: boolean): void;
}

/**
 * The SPATIAL field names (free-canvas's own `cfg`), narrowed to what a path needs - 
 * the box's authored rect, whose CENTRE is what `projectLayer` folds (section 4.1's `bx`/`by`).
 * Structural, so the canvas hands over its resolved config unchanged.
 */
export interface MotionGeomCfg {
  idField: string;
  xField: string; yField: string; wField: string; hField: string;
  rotationField: string;
}

/** One sampled centre, native px, plus the engine's behind-camera ramp. */
export interface MotionPoint {
  x: number;
  y: number;
  /** `projectDepth().alphaGuard`. 0 breaks the run. Absent reads as fully on screen. */
  a?: number;
}

export interface MountMotionPathOpts {
  /** `.fc-overlay` - the layer becomes its FIRST child, under every selection chrome. */
  overlayEl: HTMLElement;
  /** free-canvas's resolved geometry field names. */
  geom: MotionGeomCfg;
  /** free-canvas's resolved TIME field names - `kfField` is what makes a box animated. */
  time: TimeCfg;
  /** The live model. Read once per paint, exactly like the ghost layer's. */
  getBoxes: () => Box[];
  /** The canvas→stage mapping, read fresh on every paint so a pan/zoom tracks. */
  metricsOf: () => MotionMetrics;
  /** The artboard's CURRENT native size - the projection's principal point is its centre. */
  canvasSize: () => { w: number; h: number };
  /** Editing by pointer (plans/330); omitted, the path is read-only. */
  edit?: MotionPathEditPort;
}

export interface MotionPathHandle {
  /** Draw the paths of these box ids (free-canvas's selection). Empty hides the layer. */
  paint(ids: readonly string[] | null | undefined): void;
  /**
   * The canvas's key handler asks first (plans/330). Escape drops a selected point, or
   * cancels a drag; Backspace or Delete retracts the selected point's handles. True when
   * the key was used, so the canvas does nothing else with that key.
   */
  onKey(e: KeyboardEvent): boolean;
  destroy(): void;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Half-diagonal of a keyframe diamond, STAGE px. Matches the timeline strip's dots. */
const KEY_R = 4.5;

/** A run shorter than this is a single sample with nowhere to go - nothing to stroke. */
const MIN_RUN = 2;

const fin = (v: unknown): number => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Native px → stage px, the identical map free-canvas's own outlines use. */
const toStage = (p: MotionPoint, m: MotionMetrics): { x: number; y: number } => ({
  x: m.cr.left - m.sr.left + fin(p.x) * fin(m.scale),
  y: m.cr.top - m.sr.top + fin(p.y) * fin(m.scale),
});

/** On screen at all? The engine's ramp; an absent one is "yes" (no camera involved). */
const onScreen = (p: MotionPoint): boolean => (p.a == null ? true : fin(p.a) > 0);

/**
 * Split a sample list into the CONTIGUOUS runs that are actually on screen. Exported
 * for its own test: this is the only geometry decision the module makes by itself, and
 * "a path that jumps behind the camera draws two strokes, not one straight lie" is a
 * claim worth pinning without a DOM.
 */
export function motionRuns(pts: readonly MotionPoint[] | null | undefined): MotionPoint[][] {
  const out: MotionPoint[][] = [];
  let run: MotionPoint[] = [];
  for (const p of Array.isArray(pts) ? pts : []) {
    if (!p || !onScreen(p)) { if (run.length >= MIN_RUN) out.push(run); run = []; continue; }
    run.push(p);
  }
  if (run.length >= MIN_RUN) out.push(run);
  return out;
}

/** One box's resolved path - what {@link samplePaths} produces and `paint` draws. */
interface MotionPathItem {
  id: string;
  pts: readonly MotionPoint[];
  keys: readonly PathKeyPoint[];
  /** The box's authored centre and the world it moves through, for the editing maths. */
  centre: Pt;
  env: MotionPathEnv;
}

/** Which part of a point is selected or in hand. */
type PathPart = 'key' | 'hi' | 'ho';

/** A pointer below this many STAGE px of travel is a click, not a drag. */
const DRAG_SLOP = 3;

/** The chip's offset from its point, STAGE px: below and right, clear of the handles' usual reach. */
const CHIP_DX = 14;
const CHIP_DY = 14;
/** The gap between the selection's chrome and a chip placed below it, STAGE px. */
const CHIP_GAP = 10;

interface PathDrag {
  pointerId: number;
  id: string;
  t: number;
  part: PathPart;
  /** Where the pointer went down, client px, and the native point it grabbed. */
  downX: number;
  downY: number;
  grab: Pt;
  moved: boolean;
  /** The other handle at the start, and whether the two left the point in one line. */
  other: KfHandle | undefined;
  inLine: boolean;
  /** The rows being previewed, or null before the first move. */
  preview: Box[] | null;
}

export function mountMotionPath(opts: MountMotionPathOpts): MotionPathHandle {
  const { overlayEl, geom, time, getBoxes, metricsOf, canvasSize, edit } = opts;
  const doc = overlayEl.ownerDocument;
  const win = doc.defaultView;

  const layer = doc.createElement('div');
  layer.className = 'mp-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.setAttribute('data-export-hide', '');
  layer.hidden = true;
  // FIRST child of the overlay, exactly like the ghost layer: a path belongs UNDER the
  // frame scrim and under every piece of selection chrome, so the outline and handles
  // of the box being manipulated are never drawn over by a line describing it.
  overlayEl.prepend(layer);

  const svg = doc.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'mp-svg');
  // No viewBox and no width/height attributes: the sheet stretches it over the whole
  // overlay and every coordinate below is already in STAGE px, so the user unit IS the
  // CSS pixel and nothing scales twice.
  layer.appendChild(svg);

  // The editing chrome (plans/330): plain divs in stage px, like the pen tool's own node
  // chrome. The points' targets stay in this layer, UNDER the selection chrome, so a
  // resize handle that happens to sit on a point keeps working. The selected point's
  // handles and its chip go in a second layer at the TOP of the overlay, where nothing
  // covers them; it carries the same export guarantees as the first.
  const chrome = doc.createElement('div');
  chrome.className = 'mp-chrome';
  layer.appendChild(chrome);
  const top = doc.createElement('div');
  top.className = 'mp-chrome mp-top';
  top.setAttribute('aria-hidden', 'true');
  top.setAttribute('data-export-hide', '');
  top.hidden = true;
  overlayEl.appendChild(top);

  let destroyed = false;
  /** The last sampling, reused while the model array, the selection and the artboard
   *  size are all unchanged (see `samplePaths`). */
  let memo: { boxes: Box[]; key: string; items: MotionPathItem[] } | null = null;
  /** The ids the canvas last asked for, so the path can repaint itself mid-gesture. */
  let lastIds: readonly string[] = [];
  /** The selected point, if any. */
  let sel: { id: string; t: number; part: PathPart } | null = null;
  let drag: PathDrag | null = null;

  /** The rows a paint reads: a drag's preview while one is in flight, else the model. */
  const rowsNow = (): Box[] => drag?.preview ?? getBoxes();

  /**
   * The MODEL half: turn a selection into projected paths, all of it through
   * `timeline-math` (which is itself all engine). The camera set and the sequence
   * length are resolved ONCE for the whole paint, not once per box - a camera is a
   * property of the scene, not of the thing looking at it.
   *
   * A CAMERA box is skipped outright: it has no canvas footprint at all (section 5.4), so the
   * only path it could draw would be of a rectangle nobody can see. Its move is already
   * visible as the parallax on every OTHER box's path, which is the honest picture. For
   * the same reason a camera's own path is not editable on the canvas.
   */
  function samplePaths(ids: readonly string[]): MotionPathItem[] {
    const out: MotionPathItem[] = [];
    if (!time.kfField || !ids.length) return out;
    const boxes = rowsNow();
    if (!Array.isArray(boxes) || !boxes.length) return out;
    const wh = canvasSize();
    // The samples are in NATIVE px, so a pan or a zoom does not change one of them - 
    // only the map applied to them afterwards. `paint` runs on every chrome repaint
    // (which is every rAF of a pan), and re-evaluating up to 240 poses per selected box
    // sixty times a second to arrive at the same numbers is the kind of cost that shows
    // up on a phone. So the memo's key is an IDENTITY test on the model array - 
    // free-canvas hands out the input's own value, whose reference changes exactly when
    // a commit does - plus the selection and the artboard size, which are the only other
    // inputs to a sample. Nothing here depends on the metrics, which is what makes the
    // memo sound rather than merely cheap.
    const key = `${ids.join(',')}|${wh.w}x${wh.h}`;
    if (memo && memo.boxes === boxes && memo.key === key) return memo.items;
    const wanted = new Set(ids.map((id) => String(id ?? '')).filter(Boolean));
    if (!wanted.size) return out;
    const cameras = kfCameraClips(boxes, time);
    const totalMs = deriveDuration(boxes, time);
    for (const b of boxes) {
      if (!b) continue;
      const id = b[geom.idField] == null ? '' : String(b[geom.idField]);
      if (!id || !wanted.has(id)) continue;
      if (String(b.kind ?? '') === 'camera') continue;
      const c = rectCentre(boxRect(b, geom));
      const env: MotionPathEnv = { stageW: wh.w, stageH: wh.h, cameras, totalMs };
      const s = kfMotionPath(boxes, time, id, c, env);
      if (s.pts.length >= MIN_RUN) out.push({ id, pts: s.pts, keys: pathKeyPoints(b, time, c, env), centre: c, env });
    }
    memo = { boxes, key, items: out };
    return out;
  }

  /** The box, its track and the keyframe at `t`, read from the rows a paint reads. */
  function keyOf(id: string, t: number): { box: Box; key: KfKey } | null {
    const rows = getBoxes();
    const i = indexOfId(rows, time, id);
    if (i < 0) return null;
    const key = kfBoxTrack(rows[i], time).find((k) => k.t === t);
    return key ? { box: rows[i]!, key } : null;
  }

  /** A diamond around a stage point. */
  const diamond = (x: number, y: number, r: number): string =>
    `M${x} ${y - r}L${x + r} ${y}L${x} ${y + r}L${x - r} ${y}Z`;

  function paint(ids: readonly string[] | null | undefined): void {
    if (destroyed) return;
    lastIds = Array.isArray(ids) ? ids : [];
    svg.textContent = '';
    chrome.textContent = '';
    top.textContent = '';
    const list = samplePaths(lastIds);
    if (sel && (!list.some((it) => it.id === sel!.id) || !keyOf(sel.id, sel.t))) sel = null;
    top.hidden = !sel && !drag;
    if (!list.length) { layer.hidden = true; top.hidden = true; return; }

    const m = metricsOf();
    // Asked ONCE per paint, not once per path. An attribute rather than a class so the
    // export-contract scan can keep banning `classList.*` outright.
    const still = prefersReducedMotion();
    layer.setAttribute('data-motion', still ? 'still' : 'flow');
    layer.hidden = false;

    for (const item of list) {
      const g = doc.createElementNS(SVG_NS, 'g');
      g.setAttribute('class', 'mp-path');
      // The box id travels as data, never as an `id`: a duplicate id in the document
      // would capture the original's references, which is the same trap the ghost
      // layer's cloned text avoids.
      g.setAttribute('data-box-id', String(item.id ?? ''));
      for (const run of motionRuns(item.pts)) {
        const pointsAttr = run.map((p) => {
          const s = toStage(p, m);
          return `${s.x},${s.y}`;
        }).join(' ');
        const line = doc.createElementNS(SVG_NS, 'polyline');
        line.setAttribute('class', 'mp-line');
        line.setAttribute('points', pointsAttr);
        g.appendChild(line);
        // The direction cue, over the same geometry - and simply NOT MINTED when the
        // user has asked for less motion (see the module doc's two gates).
        if (!still) {
          const flow = doc.createElementNS(SVG_NS, 'polyline');
          flow.setAttribute('class', 'mp-flow');
          flow.setAttribute('points', pointsAttr);
          g.appendChild(flow);
        }
      }
      const editable = !!edit && edit.editable(item.id);
      for (const k of item.keys || []) {
        if (!k || !onScreen(k)) continue;
        const s = toStage(k, m);
        const on = !!sel && sel.id === item.id && sel.t === k.t;
        const dot = doc.createElementNS(SVG_NS, 'path');
        // A DIAMOND, not a circle: the same mark the timeline strip uses for a
        // keyframe, so one thing looks like one thing across the two surfaces. A
        // keyframe that keys no position sits on the path as a smaller, hollow mark:
        // it is a moment on the travel, not a point that sets the travel.
        dot.setAttribute('class', `mp-key${k.pos ? '' : ' is-other'}${on ? ' is-on' : ''}`);
        dot.setAttribute('d', diamond(s.x, s.y, k.pos ? KEY_R : KEY_R - 1.5));
        g.appendChild(dot);
        if (editable && k.pos) paintPoint(item, k, s, on, m);
      }
      svg.appendChild(g);
    }
  }

  /** A pointer target over one point or handle tip, carrying what it addresses as data. */
  function hit(id: string, t: number, part: PathPart, at: Pt, host: HTMLElement = chrome): void {
    const el = doc.createElement('div');
    el.className = `mp-hit mp-hit-${part}`;
    el.setAttribute('data-box-id', id);
    el.setAttribute('data-t', String(t));
    el.setAttribute('data-part', part);
    el.style.left = `${at.x}px`;
    el.style.top = `${at.y}px`;
    host.appendChild(el);
  }

  /** The chrome of one editable point: its target, and when selected its handles and chip. */
  function paintPoint(item: MotionPathItem, k: PathKeyPoint, s: Pt, on: boolean, m: MotionMetrics): void {
    if (on) {
      // The pen tool's own marks, so a handle reads the same wherever it is met. Arms
      // first, then dots, so a dot is never under an arm (tree order is paint order).
      const tips: [PathPart, Pt | undefined][] = [['hi', k.hi], ['ho', k.ho]];
      for (const [, tip] of tips) {
        if (!tip) continue;
        const b = toStage(tip, m);
        const arm = doc.createElement('div');
        arm.className = 'fc-pen-arm';
        arm.style.left = `${s.x}px`;
        arm.style.top = `${s.y}px`;
        arm.style.width = `${Math.hypot(b.x - s.x, b.y - s.y)}px`;
        arm.style.transform = `rotate(${(Math.atan2(b.y - s.y, b.x - s.x) * 180) / Math.PI}deg)`;
        top.appendChild(arm);
      }
      for (const [part, tip] of tips) {
        if (!tip) continue;
        const b = toStage(tip, m);
        const dot = doc.createElement('div');
        dot.className = sel?.part === part ? 'fc-pen-handle is-on' : 'fc-pen-handle';
        dot.style.left = `${b.x}px`;
        dot.style.top = `${b.y}px`;
        top.appendChild(dot);
        hit(item.id, k.t, part, b, top);
      }
      // The point itself over its arms, as a pen node sits over its own: the selected
      // keyframe's diamond, drawn again in the top layer so no arm crosses the mark.
      const mark = doc.createElement('div');
      mark.className = 'mp-sel';
      mark.style.left = `${s.x}px`;
      mark.style.top = `${s.y}px`;
      top.appendChild(mark);
    }
    hit(item.id, k.t, 'key', s);
    if (on || (drag?.moved && drag.id === item.id && drag.t === k.t)) paintChip(item.id, k, s);
  }

  /** The selected point's chip: its time, and the one action that changes its shape. */
  function paintChip(id: string, k: PathKeyPoint, s: Pt): void {
    const found = keyOf(id, k.t);
    if (!found) return;
    const chip = doc.createElement('div');
    // Beside the point, unless the point sits under the selected box: then below the
    // box's own chrome, centred, so the chip never covers a resize or rotate handle.
    const avoid = edit?.clearOf?.() ?? null;
    const under = !!avoid && s.x >= avoid.left - CHIP_DX && s.x <= avoid.right + CHIP_DX
      && s.y >= avoid.top - CHIP_DY && s.y <= avoid.bottom + CHIP_DY;
    chip.className = under ? 'mp-chip is-under' : 'mp-chip';
    chip.style.left = `${under && avoid ? (avoid.left + avoid.right) / 2 : s.x + CHIP_DX}px`;
    chip.style.top = `${under && avoid ? avoid.bottom + CHIP_GAP : s.y + CHIP_DY}px`;
    const when = doc.createElement('span');
    when.className = 'mp-chip-time';
    when.textContent = fmtTime(kfTimelineSec(found.box, time, k.t));
    chip.appendChild(when);
    // Mid-drag the chip is a readout only; the action waits for the hand to let go.
    if (!drag?.moved && k.curve) {
      const curved = hasHandles(found.key);
      const act = doc.createElement('button');
      act.type = 'button';
      act.className = 'mp-chip-act';
      // Pointer sugar inside an aria-hidden layer, like the diamonds: the Keyframes
      // popup's row carries the same action as a labelled control.
      act.tabIndex = -1;
      act.setAttribute('data-act', curved ? 'straighten' : 'curve');
      const glyph = iconNode(curved ? 'pathStraight' : 'pathCurve', doc);
      if (glyph) act.appendChild(glyph);
      const label = doc.createElement('span');
      label.textContent = curved ? t('Straighten') : t('Curve the path');
      act.appendChild(label);
      chip.appendChild(act);
    }
    top.appendChild(chip);
  }

  /** Write one box's rebuilt track, as a preview or as the commit. */
  function withTrack(id: string, keys: readonly KfKey[]): Box[] {
    return setKfTrack(getBoxes(), time, id, keys);
  }

  /** Curve or straighten the selected point's travel: one commit. */
  function curveAt(id: string, at: number, straighten: boolean): void {
    const found = keyOf(id, at);
    if (!found || !edit || !holdsPosition(found.key)) return;
    const track = kfBoxTrack(found.box, time);
    const keys = straighten ? kfTrackStraighten(track, at) : kfTrackCurve(track, at);
    edit.commit(withTrack(id, keys));
    const when = fmtTime(kfTimelineSec(found.box, time, at));
    announce(straighten ? t('Path straightened at {t}', { t: when }) : t('Path curved at {t}', { t: when }));
  }

  /** Native px from a pointer, through the same metrics the paint uses. */
  function nativeOf(e: PointerEvent): Pt {
    const m = metricsOf();
    const sc = Number(m.scale) || 1;
    return { x: (e.clientX - m.cr.left) / sc, y: (e.clientY - m.cr.top) / sc };
  }

  /** The item and point a drag is addressing, read fresh from the memo. */
  function itemOf(id: string): MotionPathItem | undefined {
    return memo?.items.find((it) => it.id === id);
  }

  /**
   * A press on the path takes the keyboard to the canvas. `preventDefault` below stops
   * the browser moving focus as it does for any other press on the canvas, and focus
   * left in the timeline would hand Backspace to the timeline, which deletes the clip
   * rather than retracting a handle.
   */
  function takeKeys(): void {
    const active = doc.activeElement as HTMLElement | null;
    if (active && active !== doc.body && typeof active.blur === 'function') active.blur();
  }

  function onDown(e: PointerEvent): void {
    const target = e.target as Element | null;
    const act = target?.closest?.('.mp-chip-act');
    if (act && sel) {
      e.stopPropagation();
      e.preventDefault();
      takeKeys();
      curveAt(sel.id, sel.t, act.getAttribute('data-act') === 'straighten');
      return;
    }
    const el = target?.closest?.('.mp-hit');
    if (!el || !edit || e.button > 0) return;
    // Ours, and only ours: the backdrop would otherwise read this as a click on empty
    // stage and drop the box selection the path belongs to.
    e.stopPropagation();
    e.preventDefault();
    takeKeys();
    const id = el.getAttribute('data-box-id') ?? '';
    const at = Number(el.getAttribute('data-t'));
    const part = (el.getAttribute('data-part') ?? 'key') as PathPart;
    if (!id || !Number.isFinite(at) || !edit.editable(id)) return;
    const found = keyOf(id, at);
    const point = itemOf(id)?.keys.find((k) => k.t === at);
    if (!found || !point) return;
    sel = { id, t: at, part };
    const other = part === 'hi' ? found.key.ho : part === 'ho' ? found.key.hi : undefined;
    const grab = part === 'key' ? { x: point.x, y: point.y } : (part === 'hi' ? point.hi : point.ho) ?? { x: point.x, y: point.y };
    drag = {
      pointerId: e.pointerId, id, t: at, part,
      downX: e.clientX, downY: e.clientY, grab,
      moved: false, other, inLine: handlesInLine(found.key.hi, found.key.ho), preview: null,
    };
    win?.addEventListener('pointermove', onMove);
    win?.addEventListener('pointerup', onUp);
    win?.addEventListener('pointercancel', onCancel);
    paint(lastIds);
  }

  function onMove(e: PointerEvent): void {
    const d = drag;
    if (!d || e.pointerId !== d.pointerId || !edit) return;
    if (!d.moved && Math.hypot(e.clientX - d.downX, e.clientY - d.downY) < DRAG_SLOP) return;
    d.moved = true;
    const found = keyOf(d.id, d.t);
    const item = itemOf(d.id);
    if (!found || !item) return;
    const m = metricsOf();
    const sc = Number(m.scale) || 1;
    const nat = nativeOf(e);
    const want = { x: d.grab.x + nat.x - (d.downX - m.cr.left) / sc, y: d.grab.y + nat.y - (d.downY - m.cr.top) / sc };
    const track = kfBoxTrack(found.box, time);
    const proj = pathProjector(found.box, time, item.centre, item.env);
    const pos = keyPosition(track, found.key);
    let keys: KfKey[] | null = null;
    if (d.part === 'key') {
      // Shift steps the travel from the previous point (the next one for the first), the
      // pen's 15 degrees; Alt is the raw pointer; otherwise the pen's snapping, with the
      // path's other points as lines to line up on.
      const others = item.keys.filter((k) => k.t !== d.t && k.pos);
      const ref = [...others].reverse().find((k) => k.t < d.t) ?? others.find((k) => k.t > d.t);
      let to: Pt;
      if (e.shiftKey && ref) { edit.clearGuides(); to = constrainAngle(ref, want); }
      else to = edit.snap(want, e.altKey, others, d.id);
      const s = proj.unproject(d.t, to.x, to.y);
      if (s) keys = kfTrackSetPosition(track, d.t, s.x, s.y);
    } else {
      // A handle steps round its own point under Shift and never snaps, as on a pen node.
      const base = proj.project(d.t, pos.x, pos.y);
      const to = e.shiftKey ? constrainAngle(base, want) : want;
      const s = proj.unproject(d.t, to.x, to.y);
      if (s) {
        const h: KfHandle = [s.x - pos.x, s.y - pos.y];
        const mirrored = d.inLine && !e.altKey && d.other ? mirrorHandle(h, d.other) : null;
        keys = d.part === 'hi'
          ? kfTrackSetHandles(track, d.t, h, mirrored ?? undefined)
          : kfTrackSetHandles(track, d.t, mirrored ?? undefined, h);
      }
    }
    // Past a tilted camera's horizon there is no surface point under the pointer: the
    // preview holds its last good position rather than jumping.
    if (keys) d.preview = withTrack(d.id, keys);
    paint(lastIds);
  }

  function endDrag(): PathDrag | null {
    const d = drag;
    drag = null;
    win?.removeEventListener('pointermove', onMove);
    win?.removeEventListener('pointerup', onUp);
    win?.removeEventListener('pointercancel', onCancel);
    edit?.clearGuides();
    return d;
  }

  function onUp(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const d = endDrag();
    if (d?.moved && d.preview && edit) {
      edit.commit(d.preview);
      const found = keyOf(d.id, d.t);
      const when = found ? fmtTime(kfTimelineSec(found.box, time, d.t)) : '';
      announce(d.part === 'key' ? t('Keyframe at {t} moved', { t: when }) : t('Path handle at {t} moved', { t: when }));
    }
    paint(lastIds);
  }

  function onCancel(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag();
    paint(lastIds);
  }

  /** A press anywhere else drops the point selection, as a click off a pen node does. */
  function onDocDown(e: PointerEvent): void {
    if (!sel || drag) return;
    const target = e.target as Node | null;
    if (target && (layer.contains(target) || top.contains(target))) return;
    sel = null;
    paint(lastIds);
  }

  /** A right-click on a point is a right-click on the canvas under it (see `menu`). */
  function onMenu(e: MouseEvent): void {
    const target = e.target as Element | null;
    if (!edit?.menu || !target?.closest?.('.mp-hit')) return;
    e.preventDefault();
    e.stopPropagation();
    edit.menu(e.clientX, e.clientY, e.altKey);
  }

  layer.addEventListener('pointerdown', onDown);
  top.addEventListener('pointerdown', onDown);
  layer.addEventListener('contextmenu', onMenu);
  top.addEventListener('contextmenu', onMenu);
  doc.addEventListener('pointerdown', onDocDown, true);

  function onKey(e: KeyboardEvent): boolean {
    if (destroyed) return false;
    if (e.key === 'Escape') {
      if (drag) { endDrag(); paint(lastIds); return true; }
      if (sel) { sel = null; paint(lastIds); return true; }
      return false;
    }
    if ((e.key === 'Backspace' || e.key === 'Delete') && sel && edit && !drag) {
      const found = keyOf(sel.id, sel.t);
      if (!found) { sel = null; return false; }
      // The pen's rule: with a handle selected, that handle goes back onto its point;
      // with the point selected, both do. Neither ever deletes the box or the keyframe.
      const { part, id, t: at } = sel;
      if (!hasHandles(found.key)) { announce(t('This keyframe has no path handles')); return true; }
      const track = kfBoxTrack(found.box, time);
      const keys = part === 'hi' ? kfTrackSetHandles(track, at, null, undefined)
        : part === 'ho' ? kfTrackSetHandles(track, at, undefined, null)
          : kfTrackStraighten(track, at);
      sel = { id, t: at, part: 'key' };
      edit.commit(withTrack(id, keys));
      announce(t('Path handles retracted'));
      return true;
    }
    return false;
  }

  return {
    paint,
    onKey,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      endDrag();
      layer.removeEventListener('pointerdown', onDown);
      top.removeEventListener('pointerdown', onDown);
      layer.removeEventListener('contextmenu', onMenu);
      top.removeEventListener('contextmenu', onMenu);
      doc.removeEventListener('pointerdown', onDocDown, true);
      layer.remove();
      top.remove();
    },
  };
}
