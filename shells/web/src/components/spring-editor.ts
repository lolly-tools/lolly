// SPDX-License-Identifier: MPL-2.0
/**
 * spring-editor.ts - the spring counterpart of easing-editor.ts (plans/329): the same
 * plot, drawing the spring as it plays over the segment it eases, three parameters
 * (stiffness, damping, mass) as a slider and a number each, a line saying when the
 * spring settles, and the same motion strip.
 *
 * A spring runs in real time, so the plot needs the segment's length: the curve is the
 * spring brought exactly onto the next keyframe (kf-spring.ts), and a thin upright line marks where
 * it comes to rest when that is inside the segment. Without a length the plot spans the
 * spring's own settle time.
 *
 * The geometry, the grid and the classes are the bezier editor's, so the two read as one
 * control that changes what it edits. Commit law, the same: one commit per gesture (a
 * slider on release, a number on `change`), nothing on mount, nothing when the value
 * ends where it started.
 */
import { t } from '../i18n.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import '../styles/parts/easing-editor.css';
import { kfEaseAt, kfSpring, kfSpringSettleMs, kfSpringToken, type KfSpring } from '@lolly/engine';

const PLOT_W = 168;
const PLOT_H = 104;
const PAD_X = 14;
const Y_OVER = 0.45;
const OVER_PX = PLOT_H * Y_OVER;
const SVG_W = PLOT_W + PAD_X * 2;
const SVG_H = PLOT_H + OVER_PX * 2;
const SAMPLES = 120;

const toPx = (x: number): number => PAD_X + x * PLOT_W;
// Held inside the drawn frame: a spring stiff enough to leave it still reads as a spike.
const toPy = (y: number): number => OVER_PX + (1 - Math.max(-Y_OVER, Math.min(1 + Y_OVER, y))) * PLOT_H;
const r3 = (n: number): string => String(Math.round(n * 1000) / 1000);

const NS = 'http://www.w3.org/2000/svg';
const svgEl = <K extends keyof SVGElementTagNameMap>(name: K): SVGElementTagNameMap[K] =>
  document.createElementNS(NS, name);

export interface SpringEditorOptions {
  /** The spring to open on. */
  value: KfSpring;
  /** The segment's length in ms, or null when there is no next keyframe. */
  spanMs: number | null;
  /**
   * The ease the keyframe plays now, drawn until a parameter moves: a split half of a
   * spring (a window) plays part of the curve its three parameters describe.
   */
  playing?: string;
  /** One commit per gesture, with the canonical `esp(...)` token. */
  onCommit(token: string): void;
}

export interface SpringEditorHandle {
  root: HTMLElement;
  focusTarget: HTMLElement;
  /** The live spring, for a caller that wants to read without waiting for a commit. */
  spring(): KfSpring;
  destroy(): void;
}

/** One parameter row: its label, the slider's tasteful travel, the number's whole range. */
interface ParamSpec {
  key: keyof KfSpring;
  label: string;
  slider: readonly [number, number, number];
  range: readonly [number, number];
  step: number;
}

export function mountSpringEditor(parent: HTMLElement, opts: SpringEditorOptions): SpringEditorHandle {
  let sp: KfSpring = kfSpring(opts.value.stiffness, opts.value.damping, opts.value.mass);
  let committed = kfSpringToken(sp);
  let edited = false;
  const span = opts.spanMs !== null && opts.spanMs > 0 ? opts.spanMs : null;

  const root = document.createElement('div');
  root.className = 'ease-ed spring-ed';

  // ── the plot ───────────────────────────────────────────────────────────────
  const svg = svgEl('svg');
  svg.setAttribute('class', 'ease-ed-plot');
  svg.setAttribute('viewBox', `0 0 ${r3(SVG_W)} ${r3(SVG_H)}`);
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', t('Easing curve'));
  for (let i = 0; i <= 4; i++) {
    const f = i / 4;
    const v = svgEl('line');
    v.setAttribute('class', 'ease-ed-grid');
    v.setAttribute('x1', r3(toPx(f))); v.setAttribute('x2', r3(toPx(f)));
    v.setAttribute('y1', r3(toPy(1))); v.setAttribute('y2', r3(toPy(0)));
    svg.appendChild(v);
    const hz = svgEl('line');
    hz.setAttribute('class', 'ease-ed-grid');
    hz.setAttribute('x1', r3(toPx(0))); hz.setAttribute('x2', r3(toPx(1)));
    hz.setAttribute('y1', r3(toPy(f))); hz.setAttribute('y2', r3(toPy(f)));
    svg.appendChild(hz);
  }
  const frame = svgEl('rect');
  frame.setAttribute('class', 'ease-ed-box');
  frame.setAttribute('x', r3(toPx(0))); frame.setAttribute('y', r3(toPy(1)));
  frame.setAttribute('width', String(PLOT_W)); frame.setAttribute('height', String(PLOT_H));
  svg.appendChild(frame);
  const rest = svgEl('line');
  rest.setAttribute('class', 'spring-ed-rest');
  svg.appendChild(rest);
  const curve = svgEl('path');
  curve.setAttribute('class', 'ease-ed-curve');
  svg.appendChild(curve);
  root.appendChild(svg);

  const settle = document.createElement('p');
  settle.className = 'spring-ed-settle';
  root.appendChild(settle);
  // Only when the next keyframe arrives before the spring rests: the curve then bends onto
  // the key, and the plot alone would not say why.
  const early = document.createElement('p');
  early.className = 'spring-ed-settle';
  early.textContent = t('The next keyframe comes before the spring settles. The rest of the move is spread across the segment.');
  root.appendChild(early);

  // ── the parameters ─────────────────────────────────────────────────────────
  const PARAMS: readonly ParamSpec[] = [
    { key: 'stiffness', label: t('Stiffness'), slider: [10, 1000, 1], range: [1, 5000], step: 1 },
    { key: 'damping', label: t('Damping'), slider: [0, 60, 0.5], range: [0, 500], step: 0.5 },
    { key: 'mass', label: t('Mass'), slider: [0.1, 5, 0.1], range: [0.1, 100], step: 0.1 },
  ];
  const fields = new Map<keyof KfSpring, { num: HTMLInputElement; range: HTMLInputElement }>();
  const commit = (): void => {
    const tok = kfSpringToken(sp);
    if (tok === committed) return;
    committed = tok;
    opts.onCommit(tok);
  };
  const setParam = (key: keyof KfSpring, v: number): void => {
    const next = { ...sp, [key]: v };
    sp = kfSpring(next.stiffness, next.damping, next.mass);
    edited = true;
    paint();
  };
  for (const p of PARAMS) {
    const row = document.createElement('label');
    row.className = 'field-row field-row--inline spring-ed-row';
    const lab = document.createElement('span');
    lab.className = 'field-label';
    lab.textContent = p.label;
    const range = document.createElement('input');
    range.type = 'range';
    range.className = 'spring-ed-slider';
    range.min = String(p.slider[0]);
    range.max = String(p.slider[1]);
    range.step = String(p.slider[2]);
    range.setAttribute('aria-label', p.label);
    const num = document.createElement('input');
    num.type = 'number';
    num.className = 'field-input spring-ed-num';
    num.min = String(p.range[0]);
    num.max = String(p.range[1]);
    num.step = String(p.step);
    num.setAttribute('aria-label', p.label);
    // `input` paints, `change` commits: a drag is one undo step, as on the curve plot.
    range.addEventListener('input', () => setParam(p.key, Number(range.value)));
    range.addEventListener('change', () => { setParam(p.key, Number(range.value)); commit(); });
    num.addEventListener('change', () => {
      const v = Number(num.value);
      if (num.value.trim() === '' || !Number.isFinite(v)) { paint(); return; }
      setParam(p.key, v);
      commit();
    });
    row.append(lab, range, num);
    root.appendChild(row);
    fields.set(p.key, { num, range });
  }

  // ── the motion strip (easing-editor.ts's, driven by the spring over its segment) ──────
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
  const reduced = prefersReducedMotion();
  const DOTS = 13;
  const dots: SVGCircleElement[] = [];
  for (let i = 0; i < (reduced ? DOTS : 1); i++) {
    const d = svgEl('circle');
    d.setAttribute('class', reduced ? 'ease-ed-dot ease-ed-dot--ghost' : 'ease-ed-dot');
    d.setAttribute('r', reduced ? '3' : '5');
    d.setAttribute('cy', String(PREV_H / 2));
    if (reduced) d.setAttribute('opacity', r3(0.25 + 0.75 * (i / (DOTS - 1))));
    strip.appendChild(d);
    dots.push(d);
  }
  root.appendChild(strip);

  const tok = (): string => (!edited && opts.playing ? opts.playing : kfSpringToken(sp));
  const spanOf = (): number => span ?? kfSpringSettleMs(sp);
  // The strip travels the overshoot too, so its track spans a little past both ends.
  const dotX = (u: number): number => {
    const y = kfEaseAt(tok(), u, spanOf());
    const c = Math.max(-0.2, Math.min(1.2, y));
    return PREV_PAD + ((c + 0.2) / 1.4) * (PREV_W - PREV_PAD * 2);
  };
  function paintPreview(now: number): void {
    if (reduced) {
      for (let i = 0; i < dots.length; i++) dots[i]!.setAttribute('cx', r3(dotX(i / (DOTS - 1))));
      return;
    }
    // The segment's own length, so the strip moves at the speed the keyframe will; held
    // between a third of a second and two and a half so it stays legible.
    const run = Math.max(320, Math.min(2500, spanOf()));
    const cycle = run + 500;
    dots[0]!.setAttribute('cx', r3(dotX(Math.min(1, (now % cycle) / run))));
  }

  function paint(): void {
    const T = spanOf();
    const e = tok();
    let d = '';
    for (let i = 0; i <= SAMPLES; i++) {
      const u = i / SAMPLES;
      d += `${i ? 'L' : 'M'}${r3(toPx(u))},${r3(toPy(kfEaseAt(e, u, T)))}`;
    }
    curve.setAttribute('d', d);
    const settleMs = kfSpringSettleMs(sp);
    const inside = settleMs < T;
    rest.setAttribute('visibility', inside ? 'visible' : 'hidden');
    const rx = toPx(Math.min(1, settleMs / T));
    rest.setAttribute('x1', r3(rx)); rest.setAttribute('x2', r3(rx));
    rest.setAttribute('y1', r3(toPy(1 + Y_OVER))); rest.setAttribute('y2', r3(toPy(-Y_OVER)));
    settle.textContent = t('Settles in {t} s', { t: (settleMs / 1000).toFixed(1) });
    early.hidden = span === null || inside;
    for (const [key, f] of fields) {
      const v = String(sp[key]);
      if (document.activeElement !== f.num && f.num.value !== v) f.num.value = v;
      if (document.activeElement !== f.range && f.range.value !== v) f.range.value = v;
    }
    if (reduced) paintPreview(0);
  }

  paint();
  parent.appendChild(root);

  let raf = 0;
  if (!reduced) {
    // Self-terminating on detach, as easing-editor.ts explains.
    let landed = false;
    const tick = (now: number): void => {
      landed ||= root.isConnected;
      if (landed && !root.isConnected) { raf = 0; return; }
      paintPreview(now);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  }

  return {
    root,
    focusTarget: fields.get('stiffness')!.range,
    spring: () => ({ ...sp }),
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      root.remove();
    },
  };
}
