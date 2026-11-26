// SPDX-License-Identifier: MPL-2.0
/**
 * The ruler dial: how `.custom-slider` (components/custom-slider.ts) draws itself in
 * the phone layout, for the tools trying it (RULER_DIAL_TOOLS). It is a presentation
 * of the same control, not a new one: the element keeps role="slider", its value, its
 * ARIA and its keyboard, and only the track is swapped for a ruler.
 *
 * You drag the ruler under a fixed centre mark, so the finger rests on the ruler and
 * the value above the ruler stays in view. A throw keeps the ruler moving, and the
 * ruler comes to rest exactly on a step: Detent's release() (lib/detent-physics.ts,
 * MIT, shared with Cover Flow) projects where the glide would stop, picks the nearest
 * step and retunes the glide to end there. Past either end the ruler stretches and
 * springs back. The glide runs as a Web Animation, so the compositor keeps drawing it
 * while the main thread redraws the tool.
 *
 * Accessibility. The ruler is aria-hidden; the host element is the slider, so arrow
 * keys, Page Up/Down, Home and End and the spoken value all work as before, and a key
 * step glides the ruler to the new value. The row's readout becomes a button that
 * opens a number field, so a typed value is always one tap away. Reduced motion (the
 * OS setting or the app's own pref) drops the glide and the stretch: the ruler moves
 * in whole steps under the finger and stops on the step under the mark at release.
 * Sizes follow the large text multiplier and colours come from tokens, so light and
 * dark both work.
 *
 * Vertical swipes still scroll the sheet the slider sits in (touch-action: pan-y in
 * parts/fields.css); only a horizontal drag turns the dial.
 */
import { ios, release, rubberClamp, spring, velocityTracker, type Motion } from '../lib/detent-physics.ts';
import { prefersReducedMotion } from '../lib/a11y-prefs.ts';
import { isPhoneLayout, onLayoutChange } from '../lib/layout-posture.ts';
import { t } from '../i18n.ts';

/** The tools trying the dial on phones. One for now, so it can be judged before it spreads. */
export const RULER_DIAL_TOOLS: ReadonlySet<string> = new Set(['darkroom']);

/** Does this tool's sidebar draw its sliders as ruler dials on a phone? */
export function rulerDialFor(toolId: string | undefined): boolean {
  return !!toolId && RULER_DIAL_TOOLS.has(toolId);
}

/** What the dial needs from the slider it presents. */
export interface RulerControl {
  min: number;
  max: number;
  step: number;
  label: string;
  /** The slider's value now (already on a step). */
  value(): number;
  /** A value the finger passes on the way. */
  input(v: number): void;
  /** A value a glide passes on its way to rest: show it, and leave the redraw to the commit. */
  preview(v: number): void;
  /** The value the dial came to rest on, or one typed in. */
  commit(v: number): void;
  dragStart(): void;
  dragEnd(): void;
  /** The row's live readout. While the dial shows, it opens a number field. */
  readout?: HTMLElement | null;
}

export interface RulerDial {
  /** Is the ruler the presentation right now? */
  readonly active: boolean;
  /** The value changed elsewhere (a key, a typed number, the tool): move the ruler to the new value. */
  show(v: number, animate: boolean): void;
}

/** The ruler's layout for one range. Pure, so it can be tested without a page. */
export interface RulerGeometry {
  /** Steps from min to max. */
  stops: number;
  /** CSS px between neighbouring steps. */
  px: number;
  /** Steps between labelled ticks. */
  major: number;
  /** Index of the first labelled tick (the first multiple of a major interval). */
  firstMajor: number;
  /** Index the highlight runs from: zero when the range crosses it, else min. */
  origin: number;
  /** Decimal places a label needs. */
  decimals: number;
}

const MAJOR = 10;
/** The finger travel, in px, past which a press becomes a drag. */
const SLOP = 4;
/** iOS's rubber band constant, scaled by Detent's `rubberBand` setting. */
const RUBBER = 0.55 * ios.rubberBand;
/** A key step's glide is short: the value has already changed. */
const KEY_GLIDE_MS = 260;

const mod = (i: number, n: number): number => ((i % n) + n) % n;

export function rulerGeometry(min: number, max: number, step: number): RulerGeometry {
  const stops = Math.max(1, Math.round((max - min) / step));
  // Wide enough to read a single step, narrow enough that a whole range fits in a
  // few throws: 12px for the common 0-100 and -100 to 100 ranges, 6px at the finest.
  const px = Math.max(6, Math.min(12, Math.round(2400 / stops)));
  const first = Math.round(min / step);
  const firstMajor = mod(MAJOR - mod(first, MAJOR), MAJOR);
  const origin = min < 0 && max > 0 ? Math.round(-min / step) : 0;
  const decimals = (String(step).split('.')[1] ?? '').length;
  return { stops, px, major: MAJOR, firstMajor, origin, decimals };
}

/** The step index a ruler position rests on. */
export function indexAt(pos: number, g: RulerGeometry): number {
  return Math.min(g.stops, Math.max(0, Math.round(pos / g.px)));
}

const valueAt = (i: number, min: number, max: number, step: number): number =>
  +Math.min(max, Math.max(min, min + i * step)).toFixed(10);

const label = (v: number, decimals: number): string => String(+v.toFixed(decimals));

// One layout listener for every dial on the page. It looks the dials up when the
// layout changes rather than holding them, so a sidebar that rebuilds its rows
// leaves nothing behind.
const toggles = new WeakMap<HTMLElement, () => void>();
let listening = false;
function listen(doc: Document): void {
  if (listening) return;
  listening = true;
  onLayoutChange(() => {
    for (const el of doc.querySelectorAll<HTMLElement>('.custom-slider[data-cs-dial]')) toggles.get(el)?.();
  });
}

/**
 * Give `el` (a mounted `.custom-slider`) its ruler presentation. The ruler shows
 * while the shell is in its phone layout and steps aside for the track otherwise.
 */
export function attachRuler(el: HTMLElement, ctl: RulerControl): RulerDial {
  const doc = el.ownerDocument;
  const { min, max, step } = ctl;
  const g = rulerGeometry(min, max, step);
  const span = g.stops * g.px;
  const tracker = velocityTracker();

  let active = false;
  let built = false;
  let width = 0;
  let pos = 0;                      // ruler position in px: step index × px
  let shownIndex = 0;               // the index last reported (input or preview)
  let drag: { id: number; x0: number; pos0: number; moved: boolean } | null = null;
  let holding = false;              // between dragStart and dragEnd
  let heldFrom = NaN;               // the value when the finger came down
  let passed = false;               // a step went by since then (as an input or a preview)
  let raf = 0;
  // A glide in progress. Its frames run as a Web Animation, so they keep coming from
  // the compositor while the main thread is busy redrawing the tool for each step;
  // the main thread only reads where the glide is, to report the step under the mark.
  let glide: { m: Motion; anims: Animation[]; quiet: boolean; t0: number } | null = null;
  let unarmEntry: (() => void) | null = null;

  const dial = doc.createElement('div');
  dial.className = 'cs-dial';
  dial.setAttribute('aria-hidden', 'true');
  let strip: HTMLElement;
  let band: HTMLElement;

  function build(): void {
    built = true;
    const part = (cls: string, parent: HTMLElement): HTMLElement => {
      const n = doc.createElement('div');
      n.className = cls;
      parent.append(n);
      return n;
    };
    const win = part('cs-dial-window', dial);
    band = part('cs-dial-band', win);
    strip = part('cs-dial-strip', win);
    part('cs-dial-mark', dial);
    for (let i = g.firstMajor; i <= g.stops; i += g.major) {
      const num = doc.createElement('span');
      num.className = i === g.origin ? 'cs-dial-num is-origin' : 'cs-dial-num';
      num.style.left = `${i * g.px}px`;
      num.textContent = label(valueAt(i, min, max, step), g.decimals);
      strip.append(num);
    }
    const majorPx = g.major * g.px;
    strip.style.width = `${span + 1}px`;
    strip.style.setProperty('--cs-dial-px', `${g.px}px`);
    strip.style.setProperty('--cs-dial-major', `${majorPx}px`);
    strip.style.setProperty('--cs-dial-major-at', `${g.firstMajor * g.px}px`);
    strip.style.setProperty('--cs-dial-mid', `${majorPx / 2}px`);
    strip.style.setProperty('--cs-dial-mid-at', `${mod(g.firstMajor * g.px, majorPx / 2)}px`);
    el.appendChild(dial);
    new ResizeObserver(() => {
      width = dial.clientWidth;
      if (active) paint(pos);
    }).observe(dial);
  }

  // Snap a translation to the device pixel grid, so labels stay crisp at rest.
  const crisp = (x: number): number => {
    const dpr = (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1;
    return Math.round(x * dpr) / dpr;
  };

  const stripAt = (p: number): string => `translate3d(${crisp(width / 2 - p - 0.5)}px,0,0)`;
  // The highlight runs from the origin's tick to the centre mark, whichever side.
  const bandAt = (p: number): string => {
    const cx = width / 2;
    const o = cx - p + g.origin * g.px;
    const a = Math.max(0, Math.min(o, cx));
    const b = Math.min(width, Math.max(o, cx));
    return `translate3d(${a}px,0,0) scaleX(${Math.max(0, b - a)})`;
  };

  function paint(p: number): void {
    pos = p;
    if (!built) return;
    strip.style.transform = stripAt(p);
    band.style.transform = bandAt(p);
  }

  /**
   * Report the step under the mark, once per step crossed. A step under the finger is
   * an input, and the tool redraws for each one, as on the track. A step a glide passes
   * is a preview: the readout and the spoken value move, and the tool redraws once,
   * where the glide comes to rest. A redraw can take longer than a frame (Darkroom
   * redraws its photo), and one per step held the main thread near 3 fps at 4x.
   */
  function pass(p: number, gliding = false): void {
    const i = indexAt(p, g);
    if (i === shownIndex) return;
    shownIndex = i;
    passed = true;
    const v = valueAt(i, min, max, step);
    if (gliding) ctl.preview(v);
    else ctl.input(v);
  }

  const layerHint = (on: boolean): void => {
    if (!built) return;
    strip.style.willChange = on ? 'transform' : '';
    band.style.willChange = on ? 'transform' : '';
  };

  const glideTime = (gl: NonNullable<typeof glide>): number => {
    const ct = gl.anims[0]?.currentTime;
    return typeof ct === 'number' ? ct : performance.now() - gl.t0;
  };

  /** Stop any glide where it is, holding that position. */
  function stop(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    const gl = glide;
    if (!gl) return;
    glide = null;
    paint(gl.m.at(Math.min(glideTime(gl), gl.m.duration)).x);
    for (const a of gl.anims) a.cancel();
  }

  function hold(): void {
    if (holding) return;
    holding = true;
    heldFrom = ctl.value();
    passed = false;
    el.classList.add('dragging');
    layerHint(true);
    ctl.dragStart();
  }

  /** The dial has come to rest on index `i`: hand the value over. */
  function land(i: number): void {
    stop();
    paint(i * g.px);
    pass(i * g.px);
    layerHint(false);
    el.classList.remove('dragging');
    const wasHolding = holding;
    holding = false;
    if (wasHolding) ctl.dragEnd();
    // A touch that passed no step (the start of a scroll down the sheet, or a tap)
    // is not an edit. Any step passed is: the tool may hold a value the finger sent
    // that differs from where the dial rests, even when that rest is the start value.
    const v = valueAt(i, min, max, step);
    if (!wasHolding || passed || v !== heldFrom) ctl.commit(v);
  }

  /** Run `m`, reporting steps as they pass (`quiet` for a key step, already reported). */
  function run(m: Motion, quiet: boolean): void {
    stop();
    // Sampled at 60 per second into keyframes; between samples the motion is close
    // enough to a line that linear easing cannot be told apart from the curve.
    const n = Math.max(2, Math.ceil(m.duration / 16));
    const sf: Keyframe[] = [];
    const bf: Keyframe[] = [];
    for (let k = 0; k <= n; k++) {
      const x = k === n ? m.to : m.at((m.duration * k) / n).x;
      sf.push({ transform: stripAt(x) });
      bf.push({ transform: bandAt(x) });
    }
    const timing: KeyframeAnimationOptions = { duration: m.duration, easing: 'linear', fill: 'forwards' };
    const anims = typeof strip.animate === 'function' ? [strip.animate(sf, timing), band.animate(bf, timing)] : [];
    const gl = { m, anims, quiet, t0: performance.now() };
    glide = gl;
    const frame = (): void => {
      if (glide !== gl) return;
      const t = glideTime(gl);
      if (t >= m.duration) {
        raf = 0;
        glide = null;
        paint(m.to);
        for (const a of anims) a.cancel();
        if (quiet) layerHint(false);
        else land(indexAt(m.to, g));
        return;
      }
      const x = m.at(t).x;
      if (!anims.length) paint(x);
      else pos = x;
      if (!quiet) pass(x, true);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }

  /** Let go at `p` moving at `v` px/ms: glide to a step, or, calmly, land on the nearest. */
  function letGo(p: number, v: number): void {
    if (prefersReducedMotion()) { land(indexAt(p, g)); return; }
    const restDelta = 0.5 / ((typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    const m = release(p, v, g.px, { min: 0, max: g.stops, loop: false, count: g.stops + 1 }, {
      decay: ios.decay,
      spring: ios.spring,
      maxVelocity: ios.maxVelocity,
      snapDuration: ios.snapDuration,
      handoff: ios.handoff,
      magnet: ios.magnet,
      restDelta,
    });
    run(m, false);
  }

  dial.addEventListener('pointerdown', (e) => {
    if (!active || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    // A mouse press readies the keys, as the track does. A finger has no keys, and
    // focusing here would draw the keyboard focus ring around the dial on every touch.
    if (e.pointerType !== 'touch') el.focus({ preventScroll: true });
    stop(); // a touch catches a gliding ruler where it is
    try { dial.setPointerCapture(e.pointerId); } catch { /* a synthetic pointer has nothing to capture */ }
    drag = { id: e.pointerId, x0: e.clientX, pos0: pos, moved: false };
    tracker.reset();
    tracker.push(e.timeStamp, pos);
    hold();
  });

  dial.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0;
    if (!drag.moved && Math.abs(dx) < SLOP) return;
    drag.moved = true;
    const raw = drag.pos0 - dx;
    tracker.push(e.timeStamp, raw);
    // Reduced motion: whole steps, no stretch past the ends.
    const p = prefersReducedMotion()
      ? indexAt(raw, g) * g.px
      : rubberClamp(raw, 0, span, Math.max(1, width), RUBBER);
    paint(p);
    pass(p);
  });

  const end = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.id) return;
    const moved = drag.moved;
    drag = null;
    // A cancel is the page taking the gesture to scroll: no throw, just rest.
    const v = moved && e.type === 'pointerup' ? tracker.get(e.timeStamp) : 0;
    letGo(pos, v);
  };
  dial.addEventListener('pointerup', end);
  dial.addEventListener('pointercancel', end);

  // ── Typed entry ──────────────────────────────────────────────────────────
  function armEntry(): void {
    const readout = ctl.readout;
    if (!readout || unarmEntry || !readout.isConnected) return;
    const btn = doc.createElement('button');
    btn.type = 'button';
    btn.className = 'field-input field-input--sm field-input--auto cs-entry';
    btn.setAttribute('aria-label', t('Type a value for {label}', { label: ctl.label }));
    readout.replaceWith(btn);
    btn.append(readout);
    const onClick = (e: MouseEvent): void => {
      // Inside the row's <label>: keep the caption from moving focus to the slider.
      e.preventDefault();
      e.stopPropagation();
      openEntry(btn);
    };
    btn.addEventListener('click', onClick);
    unarmEntry = () => {
      btn.removeEventListener('click', onClick);
      if (btn.isConnected) btn.replaceWith(readout);
      unarmEntry = null;
    };
  }

  function openEntry(btn: HTMLButtonElement): void {
    const input = doc.createElement('input');
    input.type = 'number';
    input.className = 'field-input field-input--sm cs-entry-input';
    input.min = String(min);
    input.max = String(max);
    input.step = String(step);
    input.value = String(ctl.value());
    // iOS's decimal keypad has no minus sign; a plain number field brings the
    // keyboard that does, which a range below zero needs.
    if (min >= 0) input.inputMode = 'decimal';
    input.setAttribute('aria-label', ctl.label);
    input.setAttribute('enterkeyhint', 'done');
    btn.hidden = true;
    btn.after(input);
    input.focus();
    input.select();
    let open = true;
    const close = (keep: boolean, refocus: boolean): void => {
      if (!open) return;
      open = false;
      const n = parseFloat(input.value);
      input.remove();
      btn.hidden = false;
      if (refocus) btn.focus({ preventScroll: true });
      if (!keep || !Number.isFinite(n)) return;
      const i = Math.round((Math.min(max, Math.max(min, n)) - min) / step);
      const v = valueAt(i, min, max, step);
      if (v !== ctl.value()) ctl.commit(v);
      show(v, true);
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); close(true, true); }
      else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(false, true); }
    });
    input.addEventListener('blur', () => close(true, false));
    // Clicks inside the field stay in it, not with the caption that focuses the slider.
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  // ── Presentation ─────────────────────────────────────────────────────────
  function show(v: number, animate: boolean): void {
    const i = Math.round((Math.min(max, Math.max(min, v)) - min) / step);
    shownIndex = i;
    if (!active || drag || holding) return;
    if (!animate || prefersReducedMotion() || !width) { stop(); paint(i * g.px); return; }
    layerHint(true);
    run(spring(pos, i * g.px, 0, ios.spring, KEY_GLIDE_MS), true);
  }

  function setActive(on: boolean): void {
    if (on === active) return;
    active = on;
    el.classList.toggle('cs-ruler', on);
    if (on) {
      if (!built) build();
      width = dial.clientWidth;
      show(ctl.value(), false);
      armEntry();
    } else {
      stop();
      drag = null;
      if (holding) { holding = false; el.classList.remove('dragging'); layerHint(false); ctl.dragEnd(); }
      unarmEntry?.();
    }
  }

  el.dataset.csDial = '';
  toggles.set(el, () => setActive(el.isConnected && isPhoneLayout()));
  listen(doc);
  setActive(isPhoneLayout());

  return {
    get active() { return active; },
    show,
  };
}
