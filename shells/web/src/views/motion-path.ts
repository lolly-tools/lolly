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
 */
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { boxRect, rectCentre, type Box } from './free-canvas-math.ts';
import { deriveDuration, kfCameraClips, kfMotionPath, type TimeCfg } from './timeline-math.ts';
import '../styles/parts/motion-path.css';

/** What `nativeToStage` needs, and nothing more - so a test can pass plain objects. */
export interface MotionMetrics {
  cr: { left: number; top: number };
  sr: { left: number; top: number };
  scale: number;
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
}

export interface MotionPathHandle {
  /** Draw the paths of these box ids (free-canvas's selection). Empty hides the layer. */
  paint(ids: readonly string[] | null | undefined): void;
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
  keys: readonly MotionPoint[];
}

export function mountMotionPath(opts: MountMotionPathOpts): MotionPathHandle {
  const { overlayEl, geom, time, getBoxes, metricsOf, canvasSize } = opts;
  const doc = overlayEl.ownerDocument;

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

  let destroyed = false;
  /** The last sampling, reused while the model array, the selection and the artboard
   *  size are all unchanged (see `samplePaths`). */
  let memo: { boxes: Box[]; key: string; items: MotionPathItem[] } | null = null;

  /**
   * The MODEL half: turn a selection into projected paths, all of it through
   * `timeline-math` (which is itself all engine). The camera set and the sequence
   * length are resolved ONCE for the whole paint, not once per box - a camera is a
   * property of the scene, not of the thing looking at it.
   *
   * A CAMERA box is skipped outright: it has no canvas footprint at all (section 5.4), so the
   * only path it could draw would be of a rectangle nobody can see. Its move is already
   * visible as the parallax on every OTHER box's path, which is the honest picture.
   */
  function samplePaths(ids: readonly string[]): MotionPathItem[] {
    const out: MotionPathItem[] = [];
    if (!time.kfField || !ids.length) return out;
    const boxes = getBoxes();
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
      const s = kfMotionPath(boxes, time, id, c, {
        stageW: wh.w, stageH: wh.h, cameras, totalMs,
      });
      if (s.pts.length >= MIN_RUN) out.push({ id, pts: s.pts, keys: s.keys });
    }
    memo = { boxes, key, items: out };
    return out;
  }

  function paint(ids: readonly string[] | null | undefined): void {
    if (destroyed) return;
    svg.textContent = '';
    const list = samplePaths(Array.isArray(ids) ? ids : []);
    if (!list.length) { layer.hidden = true; return; }

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
      for (const k of item.keys || []) {
        if (!k || !onScreen(k)) continue;
        const s = toStage(k, m);
        const dot = doc.createElementNS(SVG_NS, 'path');
        dot.setAttribute('class', 'mp-key');
        // A DIAMOND, not a circle: the same mark the timeline strip uses for a
        // keyframe, so one thing looks like one thing across the two surfaces.
        dot.setAttribute('d',
          `M${s.x} ${s.y - KEY_R}L${s.x + KEY_R} ${s.y}L${s.x} ${s.y + KEY_R}L${s.x - KEY_R} ${s.y}Z`);
        g.appendChild(dot);
      }
      svg.appendChild(g);
    }
  }

  return {
    paint,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      layer.remove();
    },
  };
}
