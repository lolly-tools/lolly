// SPDX-License-Identifier: MPL-2.0
/**
 * easing-editor.ts - a cubic-bezier curve editor: the unit square, the curve, two
 * draggable control points, the wire string as a live editable readout, and a strip
 * showing the motion the curve actually produces.
 *
 * It owns NO validation of its own. `easingPoints` (lib/transitions.ts) is the single
 * definition of what a legal authored ease is - x pinned to [0,1] because it is time,
 * y unbounded because that is the entire overshoot family - and every value that
 * enters here (a seed, a pasted string) goes through it. Re-deriving those bounds
 * beside the drag maths is how the two drift.
 *
 * It also owns no popover lifecycle: it builds DOM into whatever parent it is given.
 * The timeline mounts it inside a body-mounted popover (mountBodyPopover), which is
 * what supplies Escape, the outside-click dismissal and the focus restore - this
 * module never reaches for `document` beyond the pointer capture a drag needs.
 *
 * Commit law, matching the timeline panel's: the model is written ONCE per gesture.
 * A drag commits on pointerup, a keyboard nudge on keyup (so a held arrow key is one
 * undo step, not thirty), a typed readout on `change`. Nothing commits on mount - an
 * editor that is opened and closed again must leave the box exactly as unauthored as
 * it found it.
 */
import { t } from '../i18n.ts';
import { cubicBezierAt, easingPoints, easingToWire } from '../lib/transitions.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import '../styles/parts/easing-editor.css';
import { clamp } from '@lolly/engine';

type Pts = [number, number, number, number];

/* Plot geometry, in SVG user units. The unit square is PLOT_W x PLOT_H; Y_OVER is how
   far outside it the view extends in each direction, expressed in unit-y - enough
   headroom to SEE an overshoot without making the card tall enough to need a scroller.
   A pasted curve with a y beyond that range is still legal and still drawn; only its
   handle leaves the frame, which is a better failure than silently rewriting the
   value the user asked for. */
const PLOT_W = 168;
const PLOT_H = 104;
const PAD_X = 14;
const Y_OVER = 0.45;
const OVER_PX = PLOT_H * Y_OVER;
const SVG_W = PLOT_W + PAD_X * 2;
const SVG_H = PLOT_H + OVER_PX * 2;

const toPx = (x: number): number => PAD_X + x * PLOT_W;
const toPy = (y: number): number => OVER_PX + (1 - y) * PLOT_H;

/** The curve the editor opens on when the field is UNAUTHORED - a shape to push
 *  around, never a value: nothing is written until the user moves something. */
const SEED: Pts = [0.33, 1, 0.68, 1];

const NS = 'http://www.w3.org/2000/svg';
const svgEl = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);

const round3 = (n: number): number => Math.round(n * 1000) / 1000;

export interface EasingEditorOptions {
  /** The current authored value, in wire form. Unauthored (empty/unparseable) is fine. */
  value?: unknown;
  /** One commit per gesture, with the canonical wire string. */
  onCommit(wire: string): void;
}

export interface EasingEditorHandle {
  root: HTMLElement;
  /** What the popover should focus on open - the readout, which is the one control
   *  here that both announces the whole value and accepts a pasted one. */
  focusTarget: HTMLElement;
  /** The live points, for a caller that wants to read without waiting for a commit. */
  points(): Pts;
  destroy(): void;
}

export function mountEasingEditor(parent: HTMLElement, opts: EasingEditorOptions): EasingEditorHandle {
  let pts: Pts = (easingPoints(opts.value) as Pts | null) ?? ([...SEED] as Pts);
  /** The last value handed to onCommit, so a gesture that ends where it started is
   *  not an edit - the same reason the panel's number fields commit on `change`. */
  let committed = easingToWire(opts.value);

  const root = document.createElement('div');
  root.className = 'ease-ed';

  // ── the plot ───────────────────────────────────────────────────────────────
  const svg = svgEl('svg');
  svg.setAttribute('class', 'ease-ed-plot');
  svg.setAttribute('viewBox', `0 0 ${round3(SVG_W)} ${round3(SVG_H)}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', t('Easing curve'));
  root.appendChild(svg);

  // Grid: solid hairlines. Dashed strokes are reserved for drop targets in this
  // codebase, so a dashed grid here would read as "you can drop something on me".
  for (let i = 0; i <= 4; i++) {
    const f = i / 4;
    const v = svgEl('line');
    v.setAttribute('class', 'ease-ed-grid');
    v.setAttribute('x1', String(round3(toPx(f)))); v.setAttribute('x2', String(round3(toPx(f))));
    v.setAttribute('y1', String(round3(toPy(1)))); v.setAttribute('y2', String(round3(toPy(0))));
    svg.appendChild(v);
    const hz = svgEl('line');
    hz.setAttribute('class', 'ease-ed-grid');
    hz.setAttribute('x1', String(round3(toPx(0)))); hz.setAttribute('x2', String(round3(toPx(1))));
    hz.setAttribute('y1', String(round3(toPy(f)))); hz.setAttribute('y2', String(round3(toPy(f))));
    svg.appendChild(hz);
  }
  const box = svgEl('rect');
  box.setAttribute('class', 'ease-ed-box');
  box.setAttribute('x', String(round3(toPx(0)))); box.setAttribute('y', String(round3(toPy(1))));
  box.setAttribute('width', String(PLOT_W)); box.setAttribute('height', String(PLOT_H));
  svg.appendChild(box);

  const leg = (n: 1 | 2): SVGLineElement => {
    const l = svgEl('line');
    l.setAttribute('class', 'ease-ed-leg');
    l.setAttribute('data-leg', String(n));
    svg.appendChild(l);
    return l;
  };
  const leg1 = leg(1), leg2 = leg(2);

  const curve = svgEl('path');
  curve.setAttribute('class', 'ease-ed-curve');
  svg.appendChild(curve);

  const handle = (n: 1 | 2, label: string): SVGCircleElement => {
    const c = svgEl('circle');
    c.setAttribute('class', 'ease-ed-handle');
    c.setAttribute('data-handle', String(n));
    c.setAttribute('r', '7');
    c.setAttribute('tabindex', '0');
    c.setAttribute('role', 'slider');
    c.setAttribute('aria-label', label);
    // The slider value is the TIME axis, which is the one with real bounds; the
    // vertical is reported through aria-valuetext, where an unbounded number can be
    // spoken honestly instead of being squeezed into a min/max that does not exist.
    c.setAttribute('aria-valuemin', '0');
    c.setAttribute('aria-valuemax', '1');
    svg.appendChild(c);
    return c;
  };
  const h1 = handle(1, t('First control point'));
  const h2 = handle(2, t('Second control point'));

  // ── the readout ────────────────────────────────────────────────────────────
  const readRow = document.createElement('label');
  readRow.className = 'field-row field-row--inline ease-ed-read';
  const readLab = document.createElement('span');
  readLab.className = 'field-label';
  readLab.textContent = t('Curve');
  const read = document.createElement('input');
  read.className = 'field-input ease-ed-input';
  read.type = 'text';
  read.spellcheck = false;
  read.setAttribute('autocomplete', 'off');
  readRow.append(readLab, read);
  root.appendChild(readRow);

  // ── the motion strip ───────────────────────────────────────────────────────
  // What the curve DOES, not what it looks like: the same object, moved by this ease.
  // Under reduced motion it becomes a static trail of samples - the clustering IS the
  // easing, so the information survives without anything moving.
  const PREV_W = 168, PREV_H = 26, PREV_PAD = 9;
  const strip = svgEl('svg');
  strip.setAttribute('class', 'ease-ed-preview');
  strip.setAttribute('viewBox', `0 0 ${PREV_W} ${PREV_H}`);
  strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', t('Preview of the motion this curve produces'));
  const track = svgEl('line');
  track.setAttribute('class', 'ease-ed-track');
  track.setAttribute('x1', String(PREV_PAD)); track.setAttribute('x2', String(PREV_W - PREV_PAD));
  track.setAttribute('y1', String(PREV_H / 2)); track.setAttribute('y2', String(PREV_H / 2));
  strip.appendChild(track);
  const dots: SVGCircleElement[] = [];
  const reduced = prefersReducedMotion();
  const SAMPLES = 13;
  for (let i = 0; i < (reduced ? SAMPLES : 1); i++) {
    const d = svgEl('circle');
    d.setAttribute('class', reduced ? 'ease-ed-dot ease-ed-dot--ghost' : 'ease-ed-dot');
    d.setAttribute('r', reduced ? '3' : '5');
    d.setAttribute('cy', String(PREV_H / 2));
    if (reduced) d.setAttribute('opacity', String(round3(0.25 + 0.75 * (i / (SAMPLES - 1)))));
    strip.appendChild(d);
    dots.push(d);
  }
  root.appendChild(strip);

  const dotX = (p: number): number => PREV_PAD + cubicBezierAt(pts[0], pts[1], pts[2], pts[3], p) * (PREV_W - PREV_PAD * 2);

  function paintPreview(now: number): void {
    if (reduced) {
      for (let i = 0; i < dots.length; i++) dots[i]!.setAttribute('cx', String(round3(dotX(i / (SAMPLES - 1)))));
      return;
    }
    // 1.1s of travel, 0.5s parked at the end so the arrival is legible rather than a
    // dot that instantly teleports back.
    const CYCLE = 1600, RUN = 1100;
    const p = Math.min(1, (now % CYCLE) / RUN);
    dots[0]!.setAttribute('cx', String(round3(dotX(p))));
  }

  // ── painting ───────────────────────────────────────────────────────────────
  function paint(): void {
    const [x1, y1, x2, y2] = pts;
    const p0x = toPx(0), p0y = toPy(0), p3x = toPx(1), p3y = toPy(1);
    const c1x = toPx(x1), c1y = toPy(y1), c2x = toPx(x2), c2y = toPy(y2);
    curve.setAttribute('d', `M${round3(p0x)},${round3(p0y)} C${round3(c1x)},${round3(c1y)} ${round3(c2x)},${round3(c2y)} ${round3(p3x)},${round3(p3y)}`);
    leg1.setAttribute('x1', String(round3(p0x))); leg1.setAttribute('y1', String(round3(p0y)));
    leg1.setAttribute('x2', String(round3(c1x))); leg1.setAttribute('y2', String(round3(c1y)));
    leg2.setAttribute('x1', String(round3(p3x))); leg2.setAttribute('y1', String(round3(p3y)));
    leg2.setAttribute('x2', String(round3(c2x))); leg2.setAttribute('y2', String(round3(c2y)));
    h1.setAttribute('cx', String(round3(c1x))); h1.setAttribute('cy', String(round3(c1y)));
    h2.setAttribute('cx', String(round3(c2x))); h2.setAttribute('cy', String(round3(c2y)));
    h1.setAttribute('aria-valuenow', String(round3(x1)));
    h1.setAttribute('aria-valuetext', `${round3(x1)}, ${round3(y1)}`);
    h2.setAttribute('aria-valuenow', String(round3(x2)));
    h2.setAttribute('aria-valuetext', `${round3(x2)}, ${round3(y2)}`);
    if (document.activeElement !== read) read.value = wire();
    if (reduced) paintPreview(0);
  }

  const wire = (): string => easingToWire(`cubic-bezier(${pts.map(round3).join(',')})`);

  /** One commit, and only when the value actually moved. */
  function commit(): void {
    const w = wire();
    if (w === committed) return;
    committed = w;
    opts.onCommit(w);
  }

  function setPoint(n: 1 | 2, x: number, y: number): void {
    const i = n === 1 ? 0 : 2;
    // x through the same [0,1] gate easingPoints enforces; y clamped only to the
    // VISIBLE range, so a dragged handle can never end up somewhere the user cannot
    // see it. A typed value is not clamped at all - see the readout handler.
    pts[i] = round3(clamp(x, 0, 1));
    pts[i + 1] = round3(clamp(y, -Y_OVER, 1 + Y_OVER));
    paint();
  }

  // ── dragging ───────────────────────────────────────────────────────────────
  let dragging: 1 | 2 | 0 = 0;

  function fromEvent(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = svg.getBoundingClientRect();
    // Guard the un-laid-out case (a popover measured before its first frame, jsdom):
    // a zero-width rect would divide every drag into Infinity.
    const sx = r.width > 0 ? SVG_W / r.width : 1;
    const sy = r.height > 0 ? SVG_H / r.height : 1;
    const ux = (e.clientX - r.left) * sx;
    const uy = (e.clientY - r.top) * sy;
    return { x: (ux - PAD_X) / PLOT_W, y: 1 - (uy - OVER_PX) / PLOT_H };
  }

  const onDown = (e: PointerEvent): void => {
    const el = (e.target as Element | null)?.closest?.('.ease-ed-handle') as SVGCircleElement | null;
    if (!el) return;
    dragging = el.getAttribute('data-handle') === '2' ? 2 : 1;
    e.preventDefault();
    try { (el as unknown as Element & { setPointerCapture(id: number): void }).setPointerCapture(e.pointerId); } catch { /* jsdom / no capture */ }
    (el as unknown as HTMLElement).focus?.();
  };
  const onMove = (e: PointerEvent): void => {
    if (!dragging) return;
    const p = fromEvent(e);
    setPoint(dragging, p.x, p.y);
  };
  const onUp = (): void => {
    if (!dragging) return;
    dragging = 0;
    commit();
  };
  svg.addEventListener('pointerdown', onDown as EventListener);
  svg.addEventListener('pointermove', onMove as EventListener);
  svg.addEventListener('pointerup', onUp as EventListener);
  svg.addEventListener('pointercancel', onUp as EventListener);
  // A drag that leaves the plot still has to end somewhere - without this, releasing
  // outside the card leaves `dragging` set and the next stray move keeps editing.
  document.addEventListener('pointerup', onUp as EventListener);

  // ── keyboard ───────────────────────────────────────────────────────────────
  // Nudge on keydown, commit on keyUP: a held arrow repeats keydown but fires exactly
  // one keyup, so a sustained nudge is one undo step rather than one per repeat.
  const STEP = 0.01, BIG = 0.1;
  const onKeyDown = (e: KeyboardEvent): void => {
    const el = (e.target as Element | null)?.closest?.('.ease-ed-handle') as SVGCircleElement | null;
    if (!el) return;
    const n: 1 | 2 = el.getAttribute('data-handle') === '2' ? 2 : 1;
    const i = n === 1 ? 0 : 2;
    const d = e.shiftKey ? BIG : STEP;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -d;
    else if (e.key === 'ArrowRight') dx = d;
    else if (e.key === 'ArrowUp') dy = d;
    else if (e.key === 'ArrowDown') dy = -d;
    else return;
    e.preventDefault();
    // Arrows are a selection gesture almost everywhere this could be mounted (the
    // timeline nudges the selected clip with them), so a curve nudge stops here rather
    // than also moving whatever is selected behind the card. Only the arrows - Escape
    // and Tab have already returned above, and they belong to the popover shell.
    e.stopPropagation();
    setPoint(n, pts[i]! + dx, pts[i + 1]! + dy);
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!(e.target as Element | null)?.closest?.('.ease-ed-handle')) return;
    commit();
  };
  svg.addEventListener('keydown', onKeyDown as EventListener);
  svg.addEventListener('keyup', onKeyUp as EventListener);

  // ── the readout as an input ────────────────────────────────────────────────
  // Paste `cubic-bezier(.17,.67,.83,.67)` from anywhere CSS is written and it lands.
  // Junk reverts rather than half-applying, and a preset NAME is accepted too, since
  // easingPoints answers for both and refusing one would be a second vocabulary.
  read.addEventListener('change', () => {
    const p = easingPoints(read.value.trim()) as Pts | null;
    if (!p) { read.value = wire(); return; }
    pts = p;
    paint();
    commit();
  });
  read.addEventListener('keydown', (e) => {
    // Enter applies without waiting for a blur. Nothing ELSE is swallowed: Escape
    // belongs to the popover shell, and Tab belongs to its focus trap - both of which
    // listen on `document`, so a blanket stopPropagation here would quietly break the
    // dismissal and the tab cycle rather than protect anything.
    if (e.key !== 'Enter') return;
    e.preventDefault();
    read.dispatchEvent(new Event('change', { bubbles: true }));
  });

  paint();
  parent.appendChild(root);

  let raf = 0;
  if (!reduced) {
    // Self-terminating: the popover shell removes its own card on Escape / an outside
    // click, and it has no close hook to call `destroy` from. A loop that outlived its
    // DOM would paint a detached node forever, once per frame, for the life of the view.
    // `landed` because the card is built into a parent that is itself not in the
    // document yet (the popover shell appends its own element after this render
    // returns) - without the latch the first frame would read "detached" and stop the
    // loop before it ever ran.
    let landed = false;
    const tick = (now: number): void => {
      landed ||= root.isConnected;
      if (landed && !root.isConnected) { raf = 0; document.removeEventListener('pointerup', onUp as EventListener); return; }
      paintPreview(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  return {
    root,
    focusTarget: read,
    points: () => [...pts] as Pts,
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      document.removeEventListener('pointerup', onUp as EventListener);
      root.remove();
    },
  };
}
