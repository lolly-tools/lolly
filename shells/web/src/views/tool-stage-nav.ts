// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas stage navigation for the tool view: pinch-zoom + drag-pan on touch,
 * trackpad-native zoom/pan on desktop, a Fit/% HUD, and keyboard shortcuts - 
 * all layered on top of the fitCanvas scale via a transform on the OUTER wrapper.
 * Extracted verbatim from views/tool.ts (was a standalone module-level factory
 * there); `isTyping` moved with it because it was used only by this controller.
 * The HUD widget itself (markup/click-delegation/disabled-state) now lives in
 * components/zoom-hud.ts, shared with multi-edit and the catalog inspector/crop
 * dialog - this module keeps the pinch/pan/wheel/keyboard math, which is real
 * per-canvas behaviour, not accidental duplication.
 *
 * Fit is content-aware (plan 179 C5). The mounting view may hand this controller two
 * rect providers - the union of the document's artboards, and the current selection's
 * AABB - and Fit then frames the WORK rather than the export box, while Shift+2 frames
 * the selection. Both providers are optional and may answer null, and in that state
 * every fit is byte-for-byte what it was before: a tool with no artboards cannot tell
 * the difference.
 */
import { mountZoomHud } from '../components/zoom-hud.ts';
import type { ZoomHud } from '../components/zoom-hud.ts';
import { isTypingTarget } from '../lib/typing-target.ts';
import { icon } from '../lib/icons.ts';
import { t } from '../i18n.ts';
import {
  requestDock, releaseDock, isDocked, dockedFullCount, onDockChange,
  edgeDockHitTest, edgeDockPreview, edgeDockAvailable,
} from '../lib/edge-dock.ts';

/**
 * This module's ONE raw-markup sink. Every caller passes a trusted constant - `icon()`
 * output from lib/icons.ts - with nothing interpolated.
 */
function setGlyph(el: HTMLElement, markup: string): void { el.innerHTML = markup; }

/** A client-space point. */
export interface Point { x: number; y: number; }
/** A client-space rect, the shape both fit targets answer in. */
export interface StageRect { x: number; y: number; w: number; h: number }
/**
 * The two rects the stage can zoom to, supplied by whoever mounted the canvas (tool.ts
 * asks the free-canvas overlay for both). CLIENT coords, deliberately - see focusRect.
 * Absent, or answering null, means "this document has no such thing", and every fit
 * behaves exactly as it did before plan 179.
 */
export interface StageNavOpts {
  /** Union of every artboard page in the document; null when it has no artboards. */
  contentRect?: () => StageRect | null;
  /** The current artboard. On compact touch screens Fit favours this over the
   * unreadably small union of every page. */
  activeRect?: () => StageRect | null;
  /** The current selection's AABB; null when nothing is selected. */
  selectionRect?: () => StageRect | null;
  /**
   * Build the floating zoom HUD? Default true, which is every caller but the Design
   * editor: its top bar carries the same verbs (plan 179 M1), and two zoom controls on
   * one stage is one too many. False builds no `.stage-nav` node at all - so nothing is
   * appended to the stage, nothing docks to the edge, and `themeToggle`/`soundToggle`/
   * `profileToggle` are NOT adopted (the caller re-homes them itself). Every gesture
   * binding - pinch, wheel, space-pan, the 0/1/+/- keys - is untouched: the HUD was only
   * ever a second way to reach them.
   */
  hud?: boolean;
  /**
   * EDITOR LAYOUT (the Design editor). The app has one right sidebar - the dock column
   * in lib/edge-dock.ts - and in this layout the zoom HUD belongs IN it: while a panel
   * is docked there the HUD rides along as the column's compact bar (zoom,
   * zoom out / Fit / zoom in, theme and sound), and while the sidebar holds nothing the
   * HUD is hidden and the top bar owns zoom. Andy, 2026-09-02: "if the right sidebar is
   * open the lolly zoom controls theme switcher menu element etc go there too".
   *
   * It implies the HUD is BUILT (it overrides `hud: false`), because the docked bar is
   * the same widget; what it changes is where it lives and when it is visible. A drag
   * out of the column by hand wins for the rest of the session - the pill then floats,
   * as it does in every other layout.
   */
  editorLayout?: boolean;
  /**
   * AUTO-DOCK THE HUD for an ordinary canvas tool (Timezone, Darkroom, every stage tool
   * that is NOT the Design editor). Andy, 2026-09-07: "the right sidebar tabs we have in
   * the design tool are not reflected in other tools like the timezone or darkroom" - so
   * these tools consolidate their right side into the same one column too. Like
   * `editorLayout` the zoom controls FOLLOW the sidebar: while a full panel is docked the
   * HUD rides in it as the compact bar, and it leaves with the panel.
   *
   * Unlike `editorLayout` the floating pill is NOT hidden while undocked: an ordinary tool
   * has no top bar carrying the zoom verbs, so the stage pill stays its everyday control
   * (see paintHudVisible, which is editor-only on purpose). Mutually exclusive with
   * `editorLayout` in practice - the Design editor uses that path, everyone else this one.
   */
  autoDockHud?: boolean;
}
/** The canvas pan/zoom handle setupStageNav returns. */
export interface StageNav {
  reset(): void;
  isZoomed(): boolean;
  /**
   * True only when the view was moved by a PERSON (pinch, wheel, drag, a zoom key, or a
   * navigator focus). A Fit-all framing reads false: it is still a fit, so a resize is
   * free to recompute it rather than treating it as a view the user chose.
   */
  isUserZoomed(): boolean;
  sync(): void;
  /** Fit: the canvas, then the artboard union on top of it when the document has one. */
  fit(): void;
  /** Zoom to the current selection's AABB (Shift+2). No-op when nothing is selected. */
  fitSelection(): void;
  focusRect(x: number, y: number, w: number, h: number): void;
  /**
   * Multiply the current zoom about the stage centre - the keyboard's `+`/`-` verb, so a
   * button can spend it too. A MULTIPLIER (1.25 in, 0.8 out), not an absolute.
   */
  zoomBy(factor: number): void;
  /**
   * Zoom to an ABSOLUTE ratio of native export pixels: 1 is true 100%, 0.5 is half size.
   * The same units `actual()` and `subscribe()` report - see the note on absScale().
   */
  zoomTo(abs: number): void;
  /** The current absolute ratio of native pixels (1 === 100%). 0 before the canvas is laid out. */
  actual(): number;
  /**
   * Fire `cb` with the absolute ratio on every applied view change (and once, now, with
   * the current one, so a readout is never born blank). Returns the unsubscribe.
   */
  subscribe(cb: (abs: number) => void): () => void;
  /**
   * Where the profile avatar goes while this HUD is the right dock's compact bar
   * (editor layout). There is ONE avatar node in the editor and two surfaces that can
   * show it - this bar and the Design top bar - so it is handed over rather than
   * copied: the top bar gives it up when the column takes the zoom controls and takes
   * it back when the column gives them up. Null when no HUD was built, which is the
   * top bar's signal to keep the avatar itself.
   */
  profileHome(): HTMLElement | null;
  destroy(): void;
}

// True when focus is in a text field, so global canvas shortcuts don't hijack typing.
// Shadow-aware (lib/typing-target.ts): the sidebar's fields are <jelly-input> custom
// elements whose real <input> is in a shadow root, and a host-only test used to read
// as "not typing" - which is why `0` and `1` could not be typed into any text field.
const isTyping = (): boolean => isTypingTarget();

/**
 * Touch pinch-to-zoom + pan for the canvas stage.
 *
 * The page's native pinch-zoom is disabled (viewport user-scalable=no) so the
 * sticky sidebar header can't be stranded off-screen on mobile. To compensate,
 * the canvas preview gets gesture zoom here. It applies a transform to the OUTER
 * wrapper - fitCanvas only ever touches the inner canvas's width/height/transform,
 * so the two layers compose cleanly (fit-to-screen, then pinch on top of that).
 *
 * Returns { reset } so callers can snap back to the fitted view.
 */
// Unified canvas navigation for the stage: pinch-zoom + drag-pan on touch, and
// trackpad-native zoom/pan (+ a Fit/% HUD and keyboard shortcuts) on desktop.
// One module so both pointer types share a single transform model and never drift.
// The transform sits on the OUTER wrapper, layered on top of the fitCanvas scale;
// `scale` is a multiplier where 1 == the fitted view ("Fit").
export function setupStageNav(stageEl: HTMLElement, outerEl: HTMLElement, canvasEl: HTMLElement | null, nativeW: number, onFit: (() => void) | null | undefined, themeToggle?: HTMLElement, soundToggle?: HTMLElement, profileToggle?: HTMLElement, opts?: StageNavOpts): StageNav {
  const MAX_ABS = 16;             // zoom-IN ceiling: 16× native export pixels (≈1600% in the HUD)
  const MIN_ABS = 0.2;            // zoom-out floor: 20% of native export pixels
  const PINCH_DEADZONE = 0.02;    // ignore <2% finger-spread wobble so a pan ≠ zoom
  const FIT_MARGIN = 0.94;        // Fit-all leaves a gutter, matching fitCanvas's own ~32px
  const SEL_MARGIN = 0.85;        // Zoom-to-selection sits back further - context around the box
  // A Fit-all within this much of the plain fit is NOT applied. Two reasons: a doc whose
  // single artboard IS the export frame must keep the fit it has always had (the union
  // then differs from the canvas only by fitCanvas's gutter), and a transform for a <5%
  // move would make isZoomed() true for nothing.
  const FIT_SNAP = 0.05;
  const FIT_FLOOR = 0.05;         // hard stop on how far a computed fit may widen the zoom-out floor
  let scale = 1, tx = 0, ty = 0;
  let originX = 0, originY = 0;   // outer's natural (untransformed) top-left, client coords
  const pts = new Map<number, Point>();          // pointerId -> { x, y }   (touch / pen)
  let pinchDist = 0;              // finger separation at the previous move
  let lastMid: Point | null = null;             // previous pinch midpoint (client coords)
  let panPt: Point | null = null;               // previous single-finger point (client coords)
  let lastTap = 0;
  let spaceDown = false;          // desktop: hold Space to drag-pan
  let mousePanPt: Point | null = null;          // desktop: previous mouse point while panning
  // The current transform is a Fit-all framing (not a view a person chose). Set only by
  // fitContent; cleared by reset() and by every user-driven zoom/pan below.
  let contentFit = false;
  // Zoom-out floor widened by the last Fit-all, as a fit-multiplier. 1 = no widening.
  let contentFloor = 1;

  // transform-origin must be the top-left for the focal-point math below to hold
  // (CSS defaults to centre). fitCanvas never sets a transform on the outer wrapper.
  outerEl.style.transformOrigin = '0 0';

  const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
  const mid  = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  /**
   * ── THE VISIBLE BAND, not the whole stage ────────────────────────────────────
   *
   * A view may reserve edges of the stage for docked chrome (`--stage-reserve-top` /
   * `-bottom` / `-left` / `-right`): the Design top bar writes the top band, and the
   * overlay's column arbiter writes the two sides for the navigator, the inspector and
   * the docked tool rail. `fitCanvas` honours them as MARGINS on the canvas wrapper, so
   * the artboard is already laid out inside the bands - which means every fit and every
   * framing here has to measure and centre against the same box.
   *
   * Measuring the full stage instead is not a small error: with both columns open it
   * scales the artwork up by their combined width and slides its centre under them (a
   * 1400px stage with a 232px navigator and a 280px inspector fits the artboard into
   * 856px and then, from the full width, computes `want` ≈ 1.54 - which also defeats the
   * FIT_SNAP dead zone that is supposed to leave a single-artboard document alone).
   *
   * Read off the stage's own INLINE style, not `getComputedStyle`: every writer of these
   * properties sets them on this element's style attribute (design-topbar's `measure`,
   * free-canvas's `syncStageReserves` / `reserveBottom`), and a computed read would cost
   * a style recalc on a path a wheel tick reaches.
   */
  function reserveOf(prop: string): number {
    const v = parseFloat(stageEl.style.getPropertyValue(prop));
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  const compactTouch = (): boolean => typeof matchMedia === 'function'
    && matchMedia('(pointer: coarse) and (max-width: 640px), (pointer: coarse) and (max-height: 430px)').matches;
  function stageBox(): { left: number; top: number; right: number; bottom: number; width: number; height: number } {
    const sr = stageEl.getBoundingClientRect();
    const left = sr.left + reserveOf('--stage-reserve-left');
    const right = sr.right - reserveOf('--stage-reserve-right');
    const top = sr.top + reserveOf('--stage-reserve-top');
    let bottom = sr.bottom - reserveOf('--stage-reserve-bottom');
    // The compact tool rail becomes a horizontal palette at the foot of a touch
    // screen. It intentionally remains draggable chrome rather than claiming the
    // timeline's reserve property, so account for its actual visible rectangle here.
    if (compactTouch()) {
      const rail = stageEl.querySelector<HTMLElement>('.fc-toolbar-dock');
      if (rail && getComputedStyle(rail).display !== 'none') {
        const rr = rail.getBoundingClientRect();
        if (rr.height > 0 && rr.top < bottom && rr.bottom > sr.top) bottom = Math.min(bottom, rr.top - 8);
      }
    }
    // A stage narrower than the bands it carries (a phone with every panel open) would
    // hand back an inverted box, and a fit computed from it is nonsense. Fall back to the
    // whole stage - which is exactly what this module measured before the bands existed.
    if (!(right - left > 0) || !(bottom - top > 0)) {
      return { left: sr.left, top: sr.top, right: sr.right, bottom: sr.bottom, width: sr.width, height: sr.height };
    }
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }

  // Readouts that want to follow the view (the Design top bar's NN%). Fired from apply(),
  // the ONE place a transform is written, so no zoom path can forget to announce itself.
  const zoomListeners = new Set<(abs: number) => void>();

  function apply(): void {
    outerEl.style.transform = (scale === 1 && tx === 0 && ty === 0)
      ? '' : `translate(${tx}px, ${ty}px) scale(${scale})`;
    syncHud();
    if (zoomListeners.size) {
      const abs = absScale();
      for (const cb of zoomListeners) { try { cb(abs); } catch { /* a bad readout must not break the view */ } }
    }
  }

  /**
   * The view's ABSOLUTE zoom: on-screen canvas pixels per native export pixel, so 1 is
   * true 100% regardless of how much of the ratio came from fitCanvas's scale and how
   * much from this module's transform. Measured, not derived, for exactly that reason.
   * 0 before the canvas has a laid-out box (a caller shows "Fit" rather than "0%").
   */
  function absScale(): number {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    return w > 0 ? w / nativeW : 0;
  }

  // Recover the wrapper's natural top-left from its current rect + transform, so
  // the math works regardless of the flex centring that positions it in the stage.
  function captureOrigin(): void {
    const r = outerEl.getBoundingClientRect();
    originX = r.left - tx;
    originY = r.top  - ty;
  }

  // Keep the (scaled) content centre inside the stage so it can never be lost.
  function clampPan(): void {
    const sr = stageEl.getBoundingClientRect();
    const w  = outerEl.offsetWidth  * scale;
    const h  = outerEl.offsetHeight * scale;
    const cx = originX + tx + w / 2;
    const cy = originY + ty + h / 2;
    if (cx < sr.left)   tx += sr.left   - cx;
    if (cx > sr.right)  tx += sr.right  - cx;
    if (cy < sr.top)    ty += sr.top    - cy;
    if (cy > sr.bottom) ty += sr.bottom - cy;
  }

  // Zooming OUT past Fit is allowed down to an absolute floor of MIN_ABS (so
  // objects parked off the artboard stay reachable in editor tools) - or Fit
  // itself when a huge canvas already fits below that floor.
  //
  // `contentFloor` is the same carve-out one step further out. The floor exists so a
  // person cannot zoom into nothingness; a COMPUTED fit is meaningful by construction,
  // so the last Fit-all's scale is never above the floor either. Without this a 3-slide
  // deck's Fit-all would clamp at 20% of native and cut the last slide in half - i.e. the
  // rule would forbid the view it just calculated. Read from a cached value, not by
  // re-measuring the artboards, so a wheel tick stays free of DOM work.
  function minScale(): number {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    if (!(w > 0)) return 1;
    const fitAbs = (w / scale) / nativeW;   // absolute zoom the Fit view shows
    return Math.min(1, contentFloor, MIN_ABS / fitAbs);
  }

  // Zoom-IN ceiling as a fit-multiplier - the `scale` that renders at MAX_ABS× native
  // pixels, so the HUD tops out at a consistent ~1600% regardless of stage/canvas size
  // (MAX_ABS is an ABSOLUTE cap; the fit ratio varies, so a fixed multiplier wouldn't).
  // Never below 1, so a tiny canvas already shown large still zooms to at least Fit.
  function maxScale(): number {
    const w = canvasEl ? canvasEl.getBoundingClientRect().width : 0;
    if (!(w > 0)) return MAX_ABS;
    const fitAbs = (w / scale) / nativeW;
    return Math.max(1, MAX_ABS / fitAbs);
  }

  function isZoomed(): boolean { return Math.abs(scale - 1) > 0.001 || tx !== 0 || ty !== 0; }
  function isUserZoomed(): boolean { return isZoomed() && !contentFit; }
  function reset(): void { scale = 1; tx = 0; ty = 0; contentFit = false; contentFloor = 1; apply(); }

  /**
   * Fit the WORK, not the canvas (plan 179 C5).
   *
   * `r` is the union of the document's artboard pages in CLIENT coords, measured at the
   * plain fit that has just been applied. A slide deck lays its artboards out side by
   * side on the pasteboard, so that union is several times the 1920×1080 export box: Fit
   * used to frame the box and leave slides 2 and 3 off-screen with nothing saying they
   * existed. Framing the union instead makes "every artboard is visible" the thing Fit
   * guarantees, and it cuts both ways - a document whose artboards are SMALLER than the
   * canvas zooms in on them rather than showing acres of empty pasteboard.
   *
   * Not applied when the answer is within FIT_SNAP of the plain fit: the overwhelmingly
   * common single-artboard-is-the-export-frame document keeps exactly the fit it had.
   */
  function fitContent(r: StageRect): void {
    const sr = stageBox();
    if (!(r.w > 0) || !(r.h > 0) || !(sr.width > 0) || !(sr.height > 0)) return;
    const want = FIT_MARGIN * Math.min(sr.width / r.w, sr.height / r.h);
    if (!(want > 0) || Math.abs(want - 1) <= FIT_SNAP) return;
    // Widen the zoom-out floor BEFORE focusRect clamps against it (see minScale).
    contentFloor = Math.min(1, Math.max(scale * want, FIT_FLOOR));
    focusRect(r.x, r.y, r.w, r.h, FIT_MARGIN);
    contentFit = true;             // focusRect cleared it; this framing is a fit, not a gesture
  }

  // "Fit" = clear any zoom/pan, then recompute the fit for the current layout
  // (so it accounts for e.g. the mobile sheet's current coverage). reset() first
  // so isZoomed() is false and onFit's fitCanvas isn't skipped. Then, in a document
  // that HAS artboards, frame all of them (fitContent). No artboards - or no provider,
  // which is every tool but the canvas editors - and this is byte-for-byte what Fit
  // has always been.
  function fit(): void {
    reset();
    onFit?.();
    const r = (compactTouch() ? opts?.activeRect?.() : null) ?? opts?.contentRect?.();
    if (r) fitContent(r);
  }

  // Zoom to the current selection's AABB. Deliberately the same framing routine the
  // Artboards navigator gets, at its usual 85% - a selected box wants context around it,
  // where Fit-all wants the tightest honest gutter. Nothing selected = nothing to frame,
  // so the view is left exactly as it is rather than snapping somewhere arbitrary.
  function fitSelection(): void {
    const r = opts?.selectionRect?.();
    if (!r || !(r.w > 0) || !(r.h > 0)) return;
    focusRect(r.x, r.y, r.w, r.h, SEL_MARGIN);
  }

  // Zoom by `factor`, keeping the client point (fx, fy) pinned under the cursor.
  function zoomAbout(factor: number, fx: number, fy: number): void {
    captureOrigin();
    const next = Math.max(minScale(), Math.min(maxScale(), scale * factor));
    if (next === scale) return;
    const r = next / scale;
    const lx = fx - originX, ly = fy - originY;
    tx = lx - (lx - tx) * r;
    ty = ly - (ly - ty) * r;
    scale = next;
    contentFit = false;   // a hand on the wheel/keys owns the view from here
    clampPan();
    apply();
  }

  function stageCentre(): Point {
    const sr = stageBox();
    return { x: (sr.left + sr.right) / 2, y: (sr.top + sr.bottom) / 2 };
  }

  // Multiply the current zoom about the stage centre - the `+`/`-` keys' verb, exported so
  // a button (the Design top bar's ± pair) spends the same one.
  function zoomBy(factor: number): void {
    const c = stageCentre();
    zoomAbout(factor, c.x, c.y);
  }

  // Zoom to an ABSOLUTE ratio of native pixels about the stage centre: the factor that
  // takes today's absScale() to `abs`. Clamped by zoomAbout like every other zoom, so a
  // menu offering 400% on a canvas that cannot reach it stops at the ceiling, not nowhere.
  function zoomTo(abs: number): void {
    const cur = absScale();
    if (!(cur > 0) || !(abs > 0)) return;
    zoomBy(abs / cur);
  }

  // Jump to true 100% (1 CSS px per export px) about the stage centre.
  function zoomActual(): void { zoomTo(1); }

  // Zoom + pan so a CLIENT-space rect (an artboard's live on-screen box) fills `margin` of
  // the stage, centred. The Artboards navigator reads the frame element's getBoundingClientRect
  // and passes it through an `fc-focus-rect` event - client coords, deliberately, so this is
  // immune to how the canvas is sized (a frames tool's canvas overflows its nominal width
  // with pasteboard frames, so a native→screen scale derived from `nativeW` is wrong by the
  // pasteboard ratio). Clamped to the same min/max as every other zoom; clampPan keeps it
  // reachable.
  function focusRect(cx: number, cy: number, cw: number, ch: number, margin = SEL_MARGIN): void {
    if (!(cw > 0) || !(ch > 0)) return;
    captureOrigin();
    const sr = stageBox();
    const fcx = cx + cw / 2;   // frame centre, client coords, at the CURRENT transform
    const fcy = cy + ch / 2;
    // Factor that makes the frame fill `margin` of the stage, letterboxed to its aspect.
    const want = margin * Math.min(sr.width / cw, sr.height / ch);
    const next = Math.max(minScale(), Math.min(maxScale(), scale * want));
    const r = next / scale;
    // Zoom about the frame centre (pin it), exactly like zoomAbout…
    const lx = fcx - originX, ly = fcy - originY;
    tx = lx - (lx - tx) * r;
    ty = ly - (ly - ty) * r;
    scale = next;
    contentFit = false;   // a framed artboard/selection is a chosen view; fitContent re-sets it
    // …then slide the (still-pinned) frame centre onto the stage centre. NO clampPan here:
    // it keeps the whole WRAPPER's centre in view, which for a multi-frame canvas makes an
    // edge artboard un-centrable (the wrapper centre would have to leave the stage). A frame
    // parked at the stage centre is in view by construction, so the clamp is not needed.
    const sc = stageCentre();
    tx += sc.x - fcx;
    ty += sc.y - fcy;
    apply();
  }

  // ── Touch / pen: pinch-zoom + drag-pan (mouse stays free for click-to-focus) ──
  stageEl.addEventListener('pointerdown', e => {
    if (e.pointerType === 'mouse') return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    captureOrigin();
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinchDist = dist(a!, b!);
      lastMid   = mid(a!, b!);
      panPt     = null;
    } else if (pts.size === 1) {
      panPt = { x: e.clientX, y: e.clientY };
      if (e.timeStamp - lastTap < 300 && isZoomed()) { fit(); lastTap = 0; }  // double-tap → fit (sheet-aware)
      else lastTap = e.timeStamp;
    }
  });

  stageEl.addEventListener('pointermove', e => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size >= 2) {
      const [a, b] = [...pts.values()];
      const d = dist(a!, b!);
      const m = mid(a!, b!);
      contentFit = false;                                             // fingers own the view now
      if (lastMid) { tx += m.x - lastMid.x; ty += m.y - lastMid.y; }  // two-finger pan
      // Pinch-zoom with a dead-zone: ignore small finger-spread wobble so a
      // two-finger PAN doesn't register as zoom. (Without this, every frame
      // applied a tiny zoom about the moving midpoint and the jitter compounded - 
      // "zooms like crazy" - while also fighting the pan so it felt sluggish.)
      // Hold pinchDist as the reference until we actually zoom, so a slow,
      // deliberate pinch still accumulates past the threshold and applies smoothly.
      if (pinchDist > 0 && Math.abs(d / pinchDist - 1) > PINCH_DEADZONE) {
        const next = Math.max(minScale(), Math.min(maxScale(), scale * (d / pinchDist)));
        const r = next / scale;
        const fx = m.x - originX, fy = m.y - originY;
        tx = fx - (fx - tx) * r;   // zoom about the pinch midpoint
        ty = fy - (fy - ty) * r;
        scale = next;
        pinchDist = d;             // reset the reference only when we actually zoom
      }
      lastMid = m;
      clampPan();
      apply();
      e.preventDefault();
    } else if (pts.size === 1 && isZoomed() && panPt) {
      contentFit = false;
      tx += e.clientX - panPt.x;
      ty += e.clientY - panPt.y;
      panPt = { x: e.clientX, y: e.clientY };
      clampPan();
      apply();
      e.preventDefault();
    }
  });

  const endTouch = (e: PointerEvent) => {
    // Mouse pointerups belong to the desktop pan path (endMouse below). Without
    // this guard - the pointerdown/move handlers have it, this one didn't - a
    // middle-drag PAN at Fit fell through to the settle check: pan never changes
    // `scale`, so "scale ≈ 1" read as "back at fit" and the release snapped the
    // canvas straight back to centre. The fit lock is released by the pan itself
    // (tx/ty ≠ 0 → isZoomed() → fitCanvas preserves the view); letting go of the
    // button must not re-engage it.
    if (e.pointerType === 'mouse') return;
    pts.delete(e.pointerId);
    if (pts.size < 2) { lastMid = null; pinchDist = 0; }
    if (pts.size === 1) {
      const [p] = [...pts.values()];
      panPt = { x: p!.x, y: p!.y };
    } else if (pts.size === 0) {
      panPt = null;
      // Settled back AT fit - clear the transform. (Not <=: zoomed OUT past fit
      // is a legitimate resting state now.)
      if (Math.abs(scale - 1) <= 0.001) reset();
    }
  };
  stageEl.addEventListener('pointerup', endTouch);
  stageEl.addEventListener('pointercancel', endTouch);

  // Suppress native scroll/zoom on the stage so the gestures above own the touch.
  // Scoped here (not in CSS) so scrollable no-canvas tools keep normal touch scroll.
  stageEl.style.touchAction = 'none';

  // ── Desktop: trackpad-native zoom/pan + a Fit/% HUD + keyboard shortcuts ──────
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  let hud: ZoomHud | null = null;

  // The HUD's "zoomed" state is what it says on the tin - the view is somewhere the USER
  // put it - so a Fit-all reads as not-zoomed: it IS the fit. In a document with no
  // artboards the two are the same predicate, so this is inert for every other tool.
  function syncHud(): void {
    hud?.setZoomed(isUserZoomed());
  }

  const onKeyDown = (e: KeyboardEvent) => {
    // CHORDS BELONG TO THE BROWSER. Cmd/Ctrl+= and Cmd/Ctrl+- are the browser's
    // whole-UI zoom (Cmd/Ctrl+0 its reset), and this handler used to catch their
    // bare `key` values ('=', '-', '0') and preventDefault them - so native page
    // zoom could never fire on any canvas tool. Canvas zoom answers only the bare
    // keys and their Shift siblings ('+' is Shift+'=' and '_' is Shift+'-' on
    // most layouts); the moment Meta/Ctrl/Alt is down the key is the browser's,
    // the same rule timeline-panel.ts's onKey applies to its bindings.
    // The desktop shell now answers those chords itself (plans/202 WP4.1). A wry
    // webview ships no page-zoom UI, so Cmd/Ctrl += - 0 used to fall through to
    // nothing there; the View > Zoom menu items in
    // shells/tauri-desktop/src-tauri/src/menu.rs carry the accelerators and call
    // bridge-overrides/zoom.ts, which drives WebviewWindow.setZoom under the
    // core:webview:allow-set-webview-zoom capability, clamps to 0.5-3 and saves
    // the factor in the profile. The mobile shell still has no zoom hook. Nothing
    // changes here either way: the chords stay the host's, and this handler must
    // never re-capture them.
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space' && !isTyping()) { spaceDown = true; stageEl.classList.add('is-grabbable'); return; }
    if (isTyping()) return;
    // Shift+1 / Shift+2 are matched on `code`, not `key`: the shifted digits are '!' and
    // '@' on a US layout and something else on every other, while Digit1/Digit2 name the
    // physical key on all of them. The bare keys above stay on `key` - they are unshifted,
    // so the two readings agree there, and the existing bindings are not worth churning.
    if (e.shiftKey && e.code === 'Digit1')   fit();                                              // Fit all
    else if (e.shiftKey && e.code === 'Digit2') fitSelection();                                  // Zoom to selection
    else if (e.key === '0')                  fit();                                              // Fit
    else if (e.key === '1')                  zoomActual();                                       // 100%
    else if (e.key === '+' || e.key === '=') { const c = stageCentre(); zoomAbout(1.25, c.x, c.y); }
    else if (e.key === '-' || e.key === '_') { const c = stageCentre(); zoomAbout(0.8,  c.x, c.y); }
    else return;
    e.preventDefault();
  };
  const onKeyUp = (e: KeyboardEvent) => { if (e.code === 'Space') { spaceDown = false; stageEl.classList.remove('is-grabbable'); } };

  // Zoom HUD (−  [NN%]  +  Fit) - created for EVERY pointer type. On touch it's the
  // primary way to snap to exact zoom levels and Fit (a pinch is imprecise); on
  // desktop it complements the trackpad/keyboard. The desktop-only wheel, mouse-pan
  // and keyboard wiring stays gated behind !isTouch further below.
  //
  // `opts.hud === false` (the Design editor, whose top bar carries the same verbs) builds
  // NOTHING here: no node on the stage, no adopted theme/sound/profile controls, no edge
  // dock. Everything below this block is guarded on `hudEl`, and every gesture path is
  // outside it, so a HUD-less stage still pinches, wheels, space-pans and answers the keys.
  // Editor layout still BUILDS the HUD - it is the dock column's compact bar there -
  // so it overrides `hud: false`; what changes is where it lives (see paintHudVisible).
  const editorLayout = !!opts?.editorLayout;
  // Ordinary canvas tools that consolidate the HUD into the one right column too (but keep
  // the floating pill visible when undocked - they have no top bar to carry zoom). The two
  // flags share the autoDock/onDockChange wiring; only paintHudVisible stays editor-only.
  const followSidebar = editorLayout || !!opts?.autoDockHud;
  const hudEl = (opts?.hud === false && !editorLayout) ? null : document.createElement('div');
  if (hudEl) {
    // The editor's pill is the dock column's compact bar, not a floating canvas pill: it
    // takes the avatar on loan from the top bar, so the
    // fold-anchor dressing (the enlarged avatar, ordered first) must not apply to it.
    // The modifier is what editor.css keys those two exceptions on.
    hudEl.className = editorLayout ? 'stage-nav stage-nav--editor' : 'stage-nav';
    // The canvas-keyboard opt-out, the same statement the Design top bar, the right edge
    // dock and the navigator make. This pill sits OVER the canvas with eight focusable
    // buttons (mark, fit, ±, theme, sound, avatar), and the canvas editor binds its
    // bare-key verbs on `window` - so Delete pressed on "Zoom in" deleted the selected
    // box and the arrows nudged it. Docked in the column the pill inherited the marker
    // from the column; floating (a dragged-out pill, a touch device, any window under
    // 640px where the dock does not exist) it carried none.
    hudEl.setAttribute('data-canvas-keys', 'off');
    // Hidden for the duration of a live-capture take: the HUD hovers over the stage,
    // and the element-crop recording tiers capture anything inside the stage box.
    // The rule ships in live-capture.ts's injected <style>, scoped to the take.
    hudEl.setAttribute('data-live-hide', '');
    stageEl.appendChild(hudEl);
    // Dock the theme cycle + sound toggles and the profile avatar at the end of the
    // HUD (a hairline separator sets them apart from the zoom controls), so every canvas
    // tool carries theme/sound/profile without cluttering the sidebar. Profile sits last
    // (right of the sound/mute toggle).
    //
    // In editor layout the HUD is hidden while it floats and docks whole into the
    // right sidebar's compact bar. There is ONE avatar node in that layout and the top
    // bar holds it while nothing is docked, so it arrives here by handover rather than
    // at build time: the top bar moves it into `profileHome()` (this pill) when the
    // column takes the zoom controls and takes it back when the column gives them up
    // (design-topbar syncDock). That is what keeps exactly one avatar on screen - never
    // a second one over the bar's Export button, and never none at all (Andy's
    // screenshots, 2026-09-02 and 09-03).
    const extras = [themeToggle, soundToggle, profileToggle]
      .filter((el): el is HTMLElement => !!el);
    hud = mountZoomHud(hudEl, {
      ariaLabel: 'Zoom',
      // editor.css's mobile stacked-order rules key off the literal `data-nav`
      // attribute (`.stage-nav [data-nav="in"]` etc.) - opt into it explicitly;
      // every other caller gets the component's private, collision-proof default.
      navAttr: 'data-nav',
      classes: { btn: 'stage-nav-btn', pct: 'stage-nav-pct', fit: 'stage-nav-fit', sep: 'stage-nav-sep' },
      // No percent readout (it doubled as a Fit/100% toggle, reading as a second Fit
      // control); a single Fit button sits BETWEEN − and + as the reset, shown as an
      // icon. True 100% still lives on the keyboard (`1`); double-tap still fits.
      noReadout: true,
      fitPosition: 'middle',
      onZoom: (dir) => { const c = stageCentre(); zoomAbout(dir > 0 ? 1.25 : 0.8, c.x, c.y); },
      onFit: fit,
      outAriaLabel: 'Zoom out',
      inAriaLabel: 'Zoom in',
      fitAriaLabel: 'Fit to window',
      fitTitle: 'Fit to window',
      fitContent: icon('resize'),
      extras,
    });
  }

  // #3: fold the zoom/theme/sound controls behind the lolly swirl so a cluttered tool
  // canvas becomes one unobtrusive anchor. Collapsed by default (persisted per device);
  // a LONG-PRESS on the swirl toggles the fold, while a short TAP still opens the profile
  // menu (kept behaving as it was). The swirl is enlarged + ordered first in editor.css.
  // The fold hides everything but the swirl (`.stage-nav.is-collapsed > :not(.profile-link)`),
  // so it needs the avatar to fold BEHIND. In editor layout the avatar is only on loan
  // from the top bar (see profileHome) and is gone from this pill whenever the column
  // gives the zoom controls up, so the anchor cannot be relied on and a fold would leave
  // an empty pill in the dock column. Neither the start state nor the gesture is offered
  // there - the block below is skipped, so the avatar keeps its plain click.
  const COLLAPSE_KEY = 'lolly:stage-nav-collapsed';
  const startCollapsed = (() => { try { return localStorage.getItem(COLLAPSE_KEY) !== '0'; } catch { return true; } })();
  if (startCollapsed && !editorLayout) hudEl?.classList.add('is-collapsed');
  const profileEl = hudEl?.querySelector<HTMLElement>('.stage-nav-profile') ?? null;
  if (profileEl && hudEl && !editorLayout) {
    // iOS fires a native long-press callout/context menu that would fight the hold-to-fold
    // gesture (and pop text/image selection). Suppress it on the anchor only.
    profileEl.style.touchAction = 'none';
    profileEl.addEventListener('contextmenu', (e) => e.preventDefault());
    let holdTimer: ReturnType<typeof setTimeout> | null = null;
    let held = false;
    const clearHold = () => { if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; } };
    profileEl.addEventListener('pointerdown', () => {
      held = false;
      clearHold();
      holdTimer = setTimeout(() => {
        held = true;
        const collapsed = hudEl.classList.toggle('is-collapsed');
        try { localStorage.setItem(COLLAPSE_KEY, collapsed ? '1' : '0'); } catch { /* best-effort */ }
      }, 450);
    });
    for (const ev of ['pointerup', 'pointercancel', 'pointerleave'] as const) profileEl.addEventListener(ev, clearHold);
    // A hold ends in a click; swallow it so the profile menu / #/profile nav doesn't fire too.
    profileEl.addEventListener('click', (e) => {
      if (held) { e.preventDefault(); e.stopImmediatePropagation(); held = false; }
    }, true);
  }

  // ── Drag the HUD (by its grip) to reposition it over the canvas, or onto the
  //    inline-end edge to dock it into the desktop dock column (lib/edge-dock.ts),
  //    exactly like the export/player panels. Desktop only: the dock does not exist
  //    below the mobile breakpoint, and the vertical touch capsule stays put. State
  //    (floated position, or docked) persists per this device. ──────────────────────
  const HUD_STATE_KEY = 'lolly:stage-nav-dock';
  const HUD_DRAG_THRESHOLD = 4;   // px travel before a press counts as a drag
  let hudDragCleanup: (() => void) | null = null;
  /** setupHudDrag's own dock verb, published so the auto-dock below spends the same one. */
  let hudDockEdge: (() => void) | null = null;
  /** A deliberate drag OUT of the column, for this session: the auto-dock stands down. */
  let hudUserUndocked = false;

  type HudState = { mode?: 'edge'; left?: number; top?: number };
  const loadHudState = (): HudState => {
    try { return (JSON.parse(localStorage.getItem(HUD_STATE_KEY) || 'null') as HudState) || {}; }
    catch { return {}; }
  };
  const saveHudState = (s: HudState): void => {
    try { localStorage.setItem(HUD_STATE_KEY, JSON.stringify(s)); } catch { /* best-effort */ }
  };

  function setupHudDrag(hudEl: HTMLElement): () => void {
    // The pill is all buttons, so a dedicated grip is the drag surface (the rest keeps
    // clicking through to zoom). It rides along in the mobile stacked capsule too.
    const grip = document.createElement('div');
    grip.className = 'stage-nav-grip';
    grip.setAttribute('aria-hidden', 'true');
    setGlyph(grip, icon('grip', { filled: true }));
    hudEl.prepend(grip);

    // No wobble spring here (unlike the URL gauge): docking re-parents the HUD into the
    // dock column mid-drag, which orphans the wobble's GPU layer as a stuck ghost. The
    // drag itself needs no spring.

    // Stage-relative bounds (the HUD is position:absolute in #tool-stage), matching the
    // URL gauge's offsetLeft/offsetParent model, so a drag can never leave it off-screen.
    const bounds = (): { maxL: number; maxT: number } => {
      const par = (hudEl.offsetParent as HTMLElement | null);
      const pw = par?.clientWidth ?? stageEl.clientWidth;
      const ph = par?.clientHeight ?? stageEl.clientHeight;
      return { maxL: Math.max(4, pw - hudEl.offsetWidth - 4), maxT: Math.max(4, ph - hudEl.offsetHeight - 4) };
    };

    // Float the HUD at an explicit stage-relative position (or clear back to the CSS
    // default top-right when no coords are given, e.g. after undocking).
    const applyFloat = (left?: number, top?: number): void => {
      hudEl.removeAttribute('data-docked');
      if (typeof left === 'number' && typeof top === 'number') {
        const { maxL, maxT } = bounds();
        hudEl.style.right = 'auto';
        hudEl.style.left = `${Math.min(Math.max(left, 4), maxL)}px`;
        hudEl.style.top = `${Math.min(Math.max(top, 4), maxT)}px`;
      } else {
        hudEl.style.left = hudEl.style.top = hudEl.style.right = '';
      }
    };

    // edge-dock moved the HUD back into the stage (drag-out, or the mobile-breakpoint
    // guard): just restore its float look. Persistence is driven by the user gesture
    // (onUp / dockEdge), NOT here, so a breakpoint bounce doesn't wipe the 'edge' pref.
    const onUndock = (): void => { applyFloat(); paintHudVisible(); };

    const dockEdge = (): void => {
      if (!requestDock('zoom', hudEl, { compact: true, onRelease: onUndock, icon: icon('resize'), label: t('Zoom') })) return;
      hudEl.setAttribute('data-docked', '');
      hudEl.hidden = false;                 // in the column it is always shown
      hudEl.style.left = hudEl.style.top = hudEl.style.right = '';
      hudUserUndocked = false;              // back in the column by choice
      saveHudState({ mode: 'edge' });
    };
    hudDockEdge = dockEdge;

    let dragging = false, moved = false, sx = 0, sy = 0, bl = 0, bt = 0;
    const onMove = (e: PointerEvent): void => {
      if (!dragging) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) > HUD_DRAG_THRESHOLD) moved = true;
      if (!moved) return;
      // Grabbing a docked HUD drags it out; re-baseline so it continues from the pointer
      // (its stage-relative home) rather than jumping by the dock's body-level coords.
      // The flag goes up BEFORE the release, or the auto-dock would hear the change and
      // put the bar straight back in the column mid-drag.
      if (isDocked('zoom')) {
        hudUserUndocked = true;
        releaseDock('zoom');
        sx = e.clientX; sy = e.clientY; bl = hudEl.offsetLeft; bt = hudEl.offsetTop;
      }
      const dx = e.clientX - sx, dy = e.clientY - sy;
      const { maxL, maxT } = bounds();
      hudEl.style.right = 'auto';
      hudEl.style.left = `${Math.min(Math.max(bl + dx, 4), maxL)}px`;
      hudEl.style.top = `${Math.min(Math.max(bt + dy, 4), maxT)}px`;
      edgeDockPreview(edgeDockHitTest(e.clientX));   // light the drop zone near the edge
    };
    const onUp = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      edgeDockPreview(false);
      if (!moved) return;
      if (edgeDockHitTest(e.clientX)) dockEdge();
      else saveHudState({ left: hudEl.offsetLeft, top: hudEl.offsetTop });
    };
    const onDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      dragging = true; moved = false;
      sx = e.clientX; sy = e.clientY;
      bl = hudEl.offsetLeft; bt = hudEl.offsetTop;
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    };
    grip.addEventListener('pointerdown', onDown);

    // Restore last session's placement. When the HUD follows the sidebar (editor layout,
    // or an ordinary canvas tool with autoDockHud) the column decides instead (autoDock
    // below): docking the bar there while the sidebar holds no panel would reserve a slice
    // of the canvas for a row of zoom buttons and nothing else.
    const saved = loadHudState();
    if (saved.mode === 'edge' && edgeDockAvailable() && !followSidebar) dockEdge();
    else if (typeof saved.left === 'number' && typeof saved.top === 'number') applyFloat(saved.left, saved.top);

    return () => {
      grip.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      edgeDockPreview(false);
      hudDockEdge = null;
      if (isDocked('zoom')) releaseDock('zoom');   // return the HUD to the stage before teardown removes it
    };
  }

  /**
   * Editor layout: the pill is HIDDEN while it is out of the sidebar, because the top bar
   * carries the same verbs there and two zoom controls on one stage is one too many. Shown
   * again the moment it is docked - or when the user has deliberately pulled it out, which
   * is them asking for the floating pill. Every other layout keeps the pill it always had.
   */
  function paintHudVisible(): void {
    if (!hudEl || !editorLayout) return;
    const dockable = !!hudDockEdge && edgeDockAvailable();
    hudEl.hidden = dockable && !isDocked('zoom') && !hudUserUndocked;
  }

  /**
   * Follow the one right sidebar: while it holds a full panel the zoom controls ride in
   * it as the compact bar, and when it empties they leave with it. A hand-dragged pill
   * (hudUserUndocked) is left alone for the rest of the session.
   */
  function autoDock(): void {
    if (!hudEl || !followSidebar) return;
    const wanted = dockedFullCount() > 0;
    if (wanted && !isDocked('zoom') && !hudUserUndocked) hudDockEdge?.();
    else if (!wanted && isDocked('zoom')) releaseDock('zoom');
    paintHudVisible();
  }
  const offDockChange = followSidebar ? onDockChange(() => autoDock()) : null;

  if (!isTouch) {
    if (hudEl) hudDragCleanup = setupHudDrag(hudEl);
    // Now that the dock verb exists, take the sidebar's current state into account: a
    // panel may already be docked (the inspector opens from a device preference).
    autoDock();

    // Cmd/Ctrl-wheel (and trackpad pinch, which the browser delivers as ctrl+wheel)
    // zooms about the cursor; a plain wheel pans, but only once zoomed in (nothing
    // to pan at Fit). passive:false so we can preventDefault the page zoom/scroll.
    stageEl.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        zoomAbout(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY);
      } else if (isZoomed()) {
        e.preventDefault();
        captureOrigin();
        contentFit = false;
        tx -= e.deltaX; ty -= e.deltaY;
        clampPan(); apply();
      }
    }, { passive: false });

    // Pan with middle-drag or Space+left-drag; plain left-clicks stay free so the
    // canvas click-to-focus behaviour keeps working.
    stageEl.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      if (!(e.button === 1 || (e.button === 0 && spaceDown))) return;
      e.preventDefault();
      stageEl.setPointerCapture(e.pointerId);
      mousePanPt = { x: e.clientX, y: e.clientY };
      stageEl.classList.add('is-grabbing');
    });
    stageEl.addEventListener('pointermove', e => {
      if (!mousePanPt || e.pointerType !== 'mouse') return;
      captureOrigin();
      contentFit = false;
      tx += e.clientX - mousePanPt.x;
      ty += e.clientY - mousePanPt.y;
      mousePanPt = { x: e.clientX, y: e.clientY };
      clampPan(); apply();
    });
    const endMouse = () => {
      if (!mousePanPt) return;
      mousePanPt = null;
      stageEl.classList.remove('is-grabbing');
      if (!isZoomed()) reset();
    };
    stageEl.addEventListener('pointerup', endMouse);
    stageEl.addEventListener('pointercancel', endMouse);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
  }

  syncHud();

  function destroy(): void {
    window.removeEventListener('keydown', onKeyDown);
    window.removeEventListener('keyup', onKeyUp);
    offDockChange?.();    // before the undock below, so the auto-dock can't answer its own release
    hudDragCleanup?.();   // undock (return the HUD to the stage) + drop drag listeners first
    hud?.destroy();
    hudEl?.remove();
    zoomListeners.clear();
  }

  return {
    reset, isZoomed, isUserZoomed, sync: syncHud, fit, fitSelection, focusRect,
    zoomBy, zoomTo, actual: absScale,
    // Called back once immediately so a fresh readout paints the current view rather than
    // waiting for the first gesture (the bar mounts before anything has been zoomed).
    subscribe: (cb) => { zoomListeners.add(cb); try { cb(absScale()); } catch { /* see apply() */ } return () => { zoomListeners.delete(cb); }; },
    profileHome: () => hudEl,
    destroy,
  };
}
