// SPDX-License-Identifier: MPL-2.0
/**
 * tone-curve.ts - the plot beside a `display: "curve"` text input: a photo tone
 * curve (Photoshop's and Lightroom's point curve) you can shape by hand.
 *
 * The text input stays the control. It holds the curve in its wire form
 * (`in-out_in-out`, engine/src/tone-curve.ts), it is what the sidebar wires to the
 * runtime, and it is what the CLI, TUI and MCP see. This plot only EDITS it: a
 * commit writes the canonical text into the field and dispatches `input` on it,
 * the same event a keystroke fires, so undo, the URL, the session save and the
 * panel's in-sync check (inputs-sync.ts) all treat a drag exactly like typing.
 * Typing into the field redraws the plot.
 *
 * All curve maths comes from engine/src/tone-curve.ts, the definition the Darkroom
 * tool's copy is checked against (tests/tone-curve-drift.test.ts), so the line
 * drawn here is the curve the photo gets.
 *
 * Gestures, in the easing editor's commit law (components/easing-editor.ts): one
 * commit per gesture - a drag on pointerup, a keyboard nudge on keyup - and
 * nothing written on mount.
 * - Click in the square to add a point there; the same press keeps dragging the
 *   new point.
 * - Drag a point to move the point. A point cannot pass its neighbours.
 * - Drag a point well outside the square, or focus the point and press Delete,
 *   to remove the point. The last two points always stay.
 * - Arrow keys move the focused point one level (Shift: ten).
 * - Reset returns to the straight line.
 */
import { t } from '../i18n.ts';
import {
  TONE_CURVE_MAX_POINTS,
  formatToneCurve,
  isIdentityToneCurve,
  parseToneCurve,
  toneCurveEvaluator,
  type ToneCurvePoint,
} from '../../../../engine/src/tone-curve.ts';
import '../styles/parts/tone-curve.css';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);

/* Plot geometry in SVG user units: the 0..255 square with a margin, so a point on
   the edge keeps its whole hit circle inside the drawing. */
const PAD = 10;
const SIZE = 255;
const VIEW = SIZE + PAD * 2;
/** How far outside the square (in levels) a dragged point must go to be removed. */
const REMOVE_BEYOND = 24;
const toX = (level: number): number => PAD + level;
const toY = (level: number): number => PAD + (SIZE - level);

export interface ToneCurveHandle {
  root: HTMLElement;
  /** The points as drawn now. */
  points(): ToneCurvePoint[];
  /** Redraw from the field's current text (after the field changed from outside). */
  sync(): void;
}

/**
 * Mount a curve plot into `host`, editing `field`. `label` is the curve's
 * accessible name ("RGB curve", "Red curve").
 */
export function mountToneCurve(host: HTMLElement, field: HTMLInputElement, label: string): ToneCurveHandle {
  let pts: ToneCurvePoint[] = parseToneCurve(field.value);
  /** The canonical text last written, so a gesture that ends where it began is not an edit. */
  let committed = formatToneCurve(pts);

  const root = document.createElement('div');
  root.className = 'tone-curve';

  const svg = svgEl('svg');
  svg.setAttribute('class', 'tone-curve-plot');
  svg.setAttribute('viewBox', `0 0 ${VIEW} ${VIEW}`);
  svg.setAttribute('role', 'group');
  svg.setAttribute('aria-label', label);
  root.appendChild(svg);

  const box = svgEl('rect');
  box.setAttribute('class', 'tone-curve-box');
  box.setAttribute('x', String(PAD)); box.setAttribute('y', String(PAD));
  box.setAttribute('width', String(SIZE)); box.setAttribute('height', String(SIZE));
  svg.appendChild(box);
  // Quarter grid, solid: dashed lines mean "drop here" in this app.
  for (const q of [64, 128, 191]) {
    for (const vertical of [true, false]) {
      const l = svgEl('line');
      l.setAttribute('class', 'tone-curve-grid');
      if (vertical) { l.setAttribute('x1', String(toX(q))); l.setAttribute('x2', String(toX(q))); l.setAttribute('y1', String(toY(0))); l.setAttribute('y2', String(toY(255))); }
      else { l.setAttribute('y1', String(toY(q))); l.setAttribute('y2', String(toY(q))); l.setAttribute('x1', String(toX(0))); l.setAttribute('x2', String(toX(255))); }
      svg.appendChild(l);
    }
  }
  const ref = svgEl('line');
  ref.setAttribute('class', 'tone-curve-ref');
  ref.setAttribute('x1', String(toX(0))); ref.setAttribute('y1', String(toY(0)));
  ref.setAttribute('x2', String(toX(255))); ref.setAttribute('y2', String(toY(255)));
  svg.appendChild(ref);
  const curve = svgEl('path');
  curve.setAttribute('class', 'tone-curve-line');
  svg.appendChild(curve);
  const dots = svgEl('g');
  svg.appendChild(dots);

  const foot = document.createElement('div');
  foot.className = 'tone-curve-foot';
  const hint = document.createElement('span');
  hint.className = 'tone-curve-hint';
  hint.textContent = t('Click to add a point. Drag a point off the square to remove that point.');
  const reset = document.createElement('button');
  reset.type = 'button';
  reset.className = 'tone-curve-reset';
  reset.textContent = t('Reset');
  reset.setAttribute('aria-label', t('Reset the curve to a straight line'));
  foot.append(hint, reset);
  root.appendChild(foot);

  // ── painting ───────────────────────────────────────────────────────────────
  let removing = -1; // index of a point dragged far enough out to be removed on release

  function paint(): void {
    const f = toneCurveEvaluator(pts);
    let d = '';
    for (let x = 0; x <= 255; x++) d += `${x ? 'L' : 'M'}${toX(x)},${Math.round(toY(f(x)) * 100) / 100}`;
    curve.setAttribute('d', d);
    while (dots.childNodes.length > pts.length) dots.lastChild!.remove();
    while (dots.childNodes.length < pts.length) {
      const c = svgEl('circle');
      c.setAttribute('class', 'tone-curve-point');
      c.setAttribute('r', '7');
      c.setAttribute('tabindex', '0');
      c.setAttribute('role', 'button');
      dots.appendChild(c);
    }
    pts.forEach(([x, y], i) => {
      const c = dots.childNodes[i] as SVGCircleElement;
      c.setAttribute('data-index', String(i));
      c.setAttribute('cx', String(toX(x)));
      c.setAttribute('cy', String(toY(y)));
      c.classList.toggle('is-removing', i === removing);
      c.setAttribute('aria-label', t('Curve point {n} of {total}: input {x}, output {y}. Arrow keys move the point; Delete removes the point.',
        { n: i + 1, total: pts.length, x, y }));
    });
    reset.hidden = isIdentityToneCurve(pts) && pts.length === 2;
  }

  /** Write the canonical text into the field, once, and only when it changed. */
  let writing = false;
  function write(text: string): void {
    field.value = text;
    writing = true;
    try { field.dispatchEvent(new Event('input', { bubbles: true })); } finally { writing = false; }
  }
  function commit(): void {
    const text = formatToneCurve(pts);
    if (text === committed) return;
    committed = text;
    write(text);
  }

  /** Move point i, keeping it between its neighbours and inside 0..255. */
  function place(i: number, x: number, y: number): void {
    const lo = i > 0 ? pts[i - 1]![0] + 1 : 0;
    const hi = i < pts.length - 1 ? pts[i + 1]![0] - 1 : 255;
    pts[i] = [Math.max(lo, Math.min(hi, Math.round(x))), Math.max(0, Math.min(255, Math.round(y)))];
  }

  // ── pointer ────────────────────────────────────────────────────────────────
  function levelsAt(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const r = svg.getBoundingClientRect();
    // An un-laid-out plot (jsdom, a collapsed section) measures zero: fall back to
    // one unit per pixel rather than dividing by zero.
    const sx = r.width > 0 ? VIEW / r.width : 1;
    const sy = r.height > 0 ? VIEW / r.height : 1;
    return { x: (e.clientX - r.left) * sx - PAD, y: SIZE - ((e.clientY - r.top) * sy - PAD) };
  }

  let dragging = -1;
  const onDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    const hit = (e.target as Element | null)?.closest?.('.tone-curve-point');
    const at = levelsAt(e);
    if (hit) {
      dragging = Number(hit.getAttribute('data-index'));
    } else {
      if (at.x < 0 || at.x > 255 || at.y < 0 || at.y > 255) return;
      const x = Math.round(at.x);
      const same = pts.findIndex(p => p[0] === x);
      if (same >= 0) dragging = same;
      else {
        if (pts.length >= TONE_CURVE_MAX_POINTS) return;
        pts.push([x, Math.max(0, Math.min(255, Math.round(at.y)))]);
        pts.sort((a, b) => a[0] - b[0]);
        dragging = pts.findIndex(p => p[0] === x);
        paint();
      }
    }
    e.preventDefault();
    try { svg.setPointerCapture(e.pointerId); } catch { /* jsdom, or the pointer is gone */ }
    (dots.children[dragging] as SVGElement | undefined)?.focus?.();
  };
  const onMove = (e: PointerEvent): void => {
    if (dragging < 0) return;
    const at = levelsAt(e);
    const outside = at.x < -REMOVE_BEYOND || at.x > 255 + REMOVE_BEYOND || at.y < -REMOVE_BEYOND || at.y > 255 + REMOVE_BEYOND;
    removing = outside && pts.length > 2 ? dragging : -1;
    if (!outside) place(dragging, at.x, at.y);
    paint();
  };
  const onUp = (): void => {
    if (dragging < 0) return;
    if (removing === dragging) pts.splice(dragging, 1);
    dragging = -1;
    removing = -1;
    paint();
    commit();
  };
  svg.addEventListener('pointerdown', onDown as EventListener);
  svg.addEventListener('pointermove', onMove as EventListener);
  svg.addEventListener('pointerup', onUp as EventListener);
  svg.addEventListener('pointercancel', onUp as EventListener);
  // Pointer capture routes the release here even outside the plot; this catches
  // the capture being taken away (a rebuild, a system gesture).
  svg.addEventListener('lostpointercapture', onUp as EventListener);

  // ── keyboard ───────────────────────────────────────────────────────────────
  // Move on keydown, commit on keyup: a held arrow is one undo step.
  const onKeyDown = (e: KeyboardEvent): void => {
    const hit = (e.target as Element | null)?.closest?.('.tone-curve-point');
    if (!hit) return;
    const i = Number(hit.getAttribute('data-index'));
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      if (pts.length <= 2) return;
      pts.splice(i, 1);
      paint();
      commit();
      (dots.children[Math.min(i, pts.length - 1)] as SVGElement | undefined)?.focus?.();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    let dx = 0, dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = step;
    else if (e.key === 'ArrowDown') dy = -step;
    else return;
    e.preventDefault();
    e.stopPropagation();
    place(i, pts[i]![0] + dx, pts[i]![1] + dy);
    paint();
  };
  const onKeyUp = (e: KeyboardEvent): void => {
    if (!(e.target as Element | null)?.closest?.('.tone-curve-point')) return;
    if (e.key.startsWith('Arrow')) commit();
  };
  svg.addEventListener('keydown', onKeyDown as EventListener);
  svg.addEventListener('keyup', onKeyUp as EventListener);

  reset.addEventListener('click', () => {
    pts = parseToneCurve('');
    paint();
    commit();
  });

  // Typing in the field redraws the plot; the field's own listener carries the
  // text to the runtime. On change (blur, Enter) the text is rewritten in its
  // canonical form, as one more ordinary edit, so what is stored is always clean.
  function sync(): void {
    pts = parseToneCurve(field.value);
    committed = formatToneCurve(pts);
    paint();
  }
  field.addEventListener('input', () => { if (!writing) sync(); });
  field.addEventListener('change', () => {
    sync();
    if (field.value !== committed) write(committed);
  });

  paint();
  host.appendChild(root);
  return { root, points: () => pts.map(p => [p[0], p[1]] as ToneCurvePoint), sync };
}
