// SPDX-License-Identifier: MPL-2.0
/**
 * Variable-type demonstrator - a live showcase of the two faces IN FORCE,
 * driven by the WEIGHT axis itself:
 *   • the mono face (`--font-mono`) - a faux terminal types a command, an italic
 *     comment pops in, and the whole block animates its weight. Rendered larger.
 *   • the brand face (`--font-brand`) - a display word + an italic phrase, both
 *     animating the same weight axis.
 *
 * The faces are RESOLVED, not hardcoded: the specimens render in the live
 * `--font-brand` / `--font-mono` custom properties (platform defaults SUSE +
 * SUSE Mono; overridden inline on <html> by applyBrandFonts when the brand's
 * `font.brand` / `font.mono` tokens or a user-installed primary font are in
 * force), the labels show the first family of each computed stack, and each
 * slider spans the axis the loaded FontFace actually declares - so the
 * dashboard always demonstrates the fonts the user has set.
 *
 * Both faces animate by default; each has a slider that scrubs the weight from
 * min to max, and an Auto toggle to hand control back to the animation.
 *
 * The sample text is EDITABLE - the display word, the italic phrase and the terminal
 * command/comment are all contenteditable, so anyone can type their own words and watch
 * them animate. Focusing the terminal settles the typewriter so it can be edited.
 *
 * Motion is JS-started (so it doesn't run before the block is seen) and reduced-motion
 * rests at a mid weight with the slider still live.
 */

import './type-demo.css';
import { escapeHtml } from './html.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { perfUiOn } from '../feature-flags.ts';

const TYPED = 'lolly qr-code --url=lolly.tools';
const ITALIC = '// vector, exact, instant';
const BRAND_ROMAN = 'define once,';
const BRAND_ITALIC = 'use everywhere';

type FaceKey = 'mono' | 'brand';

const WEIGHT_NAMES: Record<number, string> = {
  100: 'Thin', 200: 'ExtraLight', 300: 'Light', 400: 'Regular', 500: 'Medium',
  600: 'SemiBold', 700: 'Bold', 800: 'ExtraBold', 900: 'Black',
};

interface Axis { min: number; max: number; hi: string }

// Faces whose real axis differs from their @font-face descriptor: the bundled
// SUSE Mono variable file tops out at ExtraBold (800) even though its
// registration declares 100–900 - stopping the slider there avoids dead travel
// against the clamped top end.
const AXIS_OVERRIDES: Record<string, { min: number; max: number }> = {
  'suse mono': { min: 100, max: 800 },
};

/** The first family name of a computed font stack ("'SUSE', ui-sans-serif, …"). */
export function firstFamily(stack: string, fallback: string): string {
  const first = stack.split(',')[0]?.trim().replace(/^['"]+|['"]+$/g, '').trim();
  return first || fallback;
}

/** The usable weight axis for `family`, read from the FontFaces the document
 *  actually has (CSS @font-face and user fonts registered via the FontFace API
 *  both appear in document.fonts, with `weight` descriptors like "100 900").
 *  Unknown/system faces get the full range - sweeping an axis a static face
 *  doesn't have is a visual no-op, never an error. */
export function axisFor(family: string): Axis {
  const key = family.trim().toLowerCase();
  const named = (min: number, max: number): Axis => ({ min, max, hi: WEIGHT_NAMES[max] ?? String(max) });
  const ov = AXIS_OVERRIDES[key];
  if (ov) return named(ov.min, ov.max);
  let min = Infinity, max = -Infinity;
  try {
    document.fonts.forEach((face) => {
      if (face.family.replace(/^['"]+|['"]+$/g, '').trim().toLowerCase() !== key) return;
      const m = /^(\d+)(?:\s+(\d+))?$/.exec(face.weight.trim());
      if (!m) return;
      const lo = Number(m[1]), hi = m[2] ? Number(m[2]) : lo;
      min = Math.min(min, lo); max = Math.max(max, hi);
    });
  } catch { /* document.fonts unavailable - fall through to the default */ }
  if (Number.isFinite(min) && max > min) return named(min, max);
  return named(100, 900); // static/system/unknown face: a full sweep is a harmless no-op
}

/** One live face: its display label and weight axis, resolved at call time. */
export interface LiveFace { key: FaceKey; label: string; axis: Axis }

/** Resolve the two faces in force from the live custom properties. */
export function activeFaces(): { brand: LiveFace; mono: LiveFace } {
  const rootStyle = getComputedStyle(document.documentElement);
  const face = (key: FaceKey, cssVar: string, fallback: string): LiveFace => {
    const label = firstFamily(rootStyle.getPropertyValue(cssVar), fallback);
    return { key, label, axis: axisFor(label) };
  };
  return {
    brand: face('brand', '--font-brand', 'SUSE'),
    mono: face('mono', '--font-mono', 'SUSE Mono'),
  };
}

/** Families with at least one FontFace registered in the document - CSS
 *  @font-face rules AND user fonts added via the FontFace API both land in
 *  `document.fonts`. Lowercased + unquoted for comparison. Empty when
 *  `document.fonts` is unavailable (e.g. the jsdom CLI shell). */
function loadedFamilies(): Set<string> {
  const set = new Set<string>();
  try {
    document.fonts.forEach((f) => {
      const fam = f.family.replace(/^['"]+|['"]+$/g, '').trim().toLowerCase();
      if (fam) set.add(fam);
    });
  } catch { /* document.fonts unavailable - leave empty (callers treat as "unknown") */ }
  return set;
}

/** The faces in force that are GENUINELY LOADED, deduped by family. A brand/mono
 *  var that resolved to an unloaded system fallback is dropped, and when brand and
 *  mono are the same loaded family only the brand keeps its specimen (no duplicate).
 *  So an install with one loaded font shows one specimen; the platform default
 *  (SUSE + SUSE Mono, both bundled) shows two. When `document.fonts` is empty
 *  (unknown) both are kept, so we never blank the demo on a shell that can't probe. */
export function loadedFaces(): { brand: LiveFace | null; mono: LiveFace | null } {
  const { brand, mono } = activeFaces();
  const loaded = loadedFamilies();
  const isLoaded = (f: LiveFace): boolean => loaded.size === 0 || loaded.has(f.label.trim().toLowerCase());
  const brandOn = isLoaded(brand);
  const monoOn = isLoaded(mono) && mono.label.trim().toLowerCase() !== brand.label.trim().toLowerCase();
  return { brand: brandOn ? brand : null, mono: monoOn ? mono : null };
}

const WSTART = 440; // resting / reduced-motion weight (within every axis)

// Shared attributes for an editable sample field - plaintext-only so pasted markup can't
// break the specimen; the CSS gives it a quiet "click to edit" affordance.
const EDIT_ATTRS = 'contenteditable="plaintext-only" spellcheck="false" data-td-edit role="textbox" title="Click to edit"';

// One weight control: an Auto toggle + a min↔max range slider, sharing one id `key`.
// The slider's min/max carry the resolved axis - wireTypeDemo reads them back from
// the DOM, so render and wiring can't disagree.
function control(face: LiveFace): string {
  const ax = face.axis;
  const lo = WEIGHT_NAMES[ax.min] ?? String(ax.min);
  return `
    <div class="td-ctl" data-td-ctl="${face.key}">
      <button type="button" class="td-auto is-on" data-td-auto="${face.key}" aria-pressed="true" aria-label="Animate weight">
        <span class="td-auto-dot" aria-hidden="true"></span>Auto
      </button>
      <span class="td-range-wrap">
        <input type="range" class="field-range td-range" data-td-range="${face.key}" min="${ax.min}" max="${ax.max}" step="1" value="${WSTART}"
               aria-label="Weight, ${ax.min} to ${ax.max}">
        <span class="td-scale" aria-hidden="true"><i>${escapeHtml(lo)}</i><i>${escapeHtml(ax.hi)}</i></span>
      </span>
    </div>`;
}

/** Markup for the demonstrator - one animated specimen per face that is
 *  actually LOADED (see {@link loadedFaces}), rendered in the LIVE `--font-mono`
 *  / `--font-brand` stacks (see type-demo.css). Labels + axes resolve at call
 *  time from the same vars. A face whose var fell back to an unloaded system
 *  font is omitted, so an install with a single loaded font shows a single
 *  half; the platform default shows both. `wireTypeDemo` starts the motion. */
export function renderTypeDemo(): string {
  const { brand, mono } = loadedFaces();

  const monoHalf = mono ? `
      <div class="td-half td-half--mono">
        <div class="td-head">
          <span class="td-dots" aria-hidden="true"><i></i><i></i><i></i></span>
          <span class="td-face">${escapeHtml(mono.label)}</span>
          <span class="td-axis">wght&nbsp;<b data-td-val="mono">${WSTART}</b></span>
        </div>
        <div class="td-term" data-td-face="mono" style="--td-w-mono:${WSTART}">
          <code class="td-line"><span class="td-prompt">$</span> <span class="td-typed" data-td-typed ${EDIT_ATTRS} aria-label="Terminal command"></span><span class="td-caret" data-td-caret aria-hidden="true"></span></code>
          <code class="td-italic" data-td-italic ${EDIT_ATTRS} aria-label="Terminal comment">${escapeHtml(ITALIC)}</code>
        </div>
        ${control(mono)}
      </div>` : '';

  const brandHalf = brand ? `
      <div class="td-half td-half--brand">
        <div class="td-head">
          <span class="td-face">${escapeHtml(brand.label)}</span>
          <span class="td-axis">wght&nbsp;<b data-td-val="brand">${WSTART}</b></span>
        </div>
        <div class="td-sample" data-td-face="brand" style="--td-w-brand:${WSTART}">
          <span class="td-roman" ${EDIT_ATTRS} aria-label="Display word">${escapeHtml(BRAND_ROMAN)}</span>
          <span class="td-ital" ${EDIT_ATTRS} aria-label="Italic phrase">${escapeHtml(BRAND_ITALIC)}</span>
        </div>
        ${control(brand)}
      </div>` : '';

  // Both loaded → the divided two-up. One loaded → a single, full-width specimen.
  // None (only when a probe-less shell also reports no vars) → a quiet note.
  if (!monoHalf && !brandHalf) {
    return `<div class="type-demo type-demo--empty" data-type-demo><p class="td-empty">No fonts are loaded on this device yet.</p></div>`;
  }
  const divider = monoHalf && brandHalf ? `<div class="td-divider" aria-hidden="true"></div>` : '';
  const single = monoHalf && brandHalf ? '' : ' type-demo--single';
  return `<div class="type-demo${single}" data-type-demo>${monoHalf}${divider}${brandHalf}</div>`;
}

interface FaceCtl {
  key: FaceKey;
  el: HTMLElement;          // the sample block whose --td-w-<key> we set
  prop: string;            // the CSS var name
  min: number;             // this face's axis floor
  max: number;             // this face's axis ceiling
  range: HTMLInputElement | null;
  val: HTMLElement | null;
  auto: HTMLButtonElement | null;
  animating: boolean;
  phase: number;           // radians, so the two faces don't move in lockstep
}

/** Start the demonstrator's animations inside `root`. Safe to call once per mount. */
export function wireTypeDemo(root: HTMLElement): () => void {
  const demo = root.querySelector<HTMLElement>('[data-type-demo]');
  if (!demo) return () => {};
  const reduce = prefersReducedMotion() || perfUiOn();

  // ── Weight controls (both faces) ──────────────────────────────────────────
  const faces: FaceCtl[] = [];
  (['mono', 'brand'] as const).forEach((key, i) => {
    const el = demo.querySelector<HTMLElement>(`[data-td-face="${key}"]`);
    if (!el) return;
    // The axis rides the slider's min/max attributes (stamped by control() from
    // the resolved face) - read it back so render and sweep can't disagree.
    const range = demo.querySelector<HTMLInputElement>(`[data-td-range="${key}"]`);
    faces.push({
      key,
      el,
      prop: `--td-w-${key}`,
      min: range ? Number(range.min) || 100 : 100,
      max: range ? Number(range.max) || 900 : 900,
      range,
      val: demo.querySelector<HTMLElement>(`[data-td-val="${key}"]`),
      auto: demo.querySelector<HTMLButtonElement>(`[data-td-auto="${key}"]`),
      animating: !reduce,          // animated by default; reduced-motion starts manual
      phase: i * Math.PI,          // opposite phase → the faces counter-breathe
    });
  });

  const setWeight = (f: FaceCtl, w: number): void => {
    const v = Math.round(w);
    f.el.style.setProperty(f.prop, String(v));
    if (f.range && !f.range.matches(':active')) f.range.value = String(v);
    if (f.val) f.val.textContent = String(v);
  };

  const setAuto = (f: FaceCtl, on: boolean): void => {
    f.animating = on && !reduce;
    f.auto?.classList.toggle('is-on', f.animating);
    f.auto?.setAttribute('aria-pressed', String(f.animating));
  };

  for (const f of faces) {
    // Grabbing the slider hands control to the user (pauses that face's animation).
    f.range?.addEventListener('input', () => {
      if (f.animating) setAuto(f, false);
      setWeight(f, Number(f.range!.value));
    });
    // The Auto pill toggles the animation back on (or pauses it, freezing the weight).
    f.auto?.addEventListener('click', () => setAuto(f, !f.animating));
    if (reduce) setAuto(f, false); // no toggle affordance under reduced motion
  }

  // One rAF loop drives every face still in Auto. Weight sweeps its own min↔max on a slow
  // cosine (starts near the resting weight); the slider + readout track it live.
  const PERIOD = 5200; // ms for a full min→max→min sweep
  let raf = 0;
  let onScreen = true;                 // flipped false by the IntersectionObserver when scrolled away
  const tick = (t: number): void => {
    // Park fully when scrolled out of view - the observer re-pumps us on re-entry - so an
    // off-screen dashboard doesn't keep forcing a style recalc every frame by writing
    // font-variation-settings. When the tab is hidden the browser pauses rAF for us, so we
    // stay scheduled and just skip the work.
    if (!onScreen) { raf = 0; return; }
    raf = requestAnimationFrame(tick);
    if (document.hidden) return;
    for (const f of faces) {
      if (!f.animating) continue;
      const a = (t / PERIOD) * Math.PI * 2 + f.phase;
      const w = f.min + (f.max - f.min) * (0.5 - 0.5 * Math.cos(a));
      setWeight(f, w);
    }
  };
  const startRaf = (): void => { if (!raf && !reduce) raf = requestAnimationFrame(tick); };
  if (!reduce) raf = requestAnimationFrame(tick);

  // Pause the sweep while the specimen is off-screen and resume on re-entry - matches the
  // gallery / featured-row tickers. rootMargin keeps it running through small scroll jitters.
  let vizObserver: IntersectionObserver | undefined;
  if (!reduce && typeof IntersectionObserver === 'function') {
    vizObserver = new IntersectionObserver((entries) => {
      const nowOn = entries[entries.length - 1]!.isIntersecting;
      if (nowOn === onScreen) return;
      onScreen = nowOn;
      if (nowOn) startRaf();
    }, { rootMargin: '200px' });
    vizObserver.observe(demo);
  }

  // ── SUSE Mono terminal: faux typing → italic comment pops → loop ───────────
  const typed = demo.querySelector<HTMLElement>('[data-td-typed]');
  const caret = demo.querySelector<HTMLElement>('[data-td-caret]');
  const italic = demo.querySelector<HTMLElement>('[data-td-italic]');
  const term = demo.querySelector<HTMLElement>('.td-term');
  let typeTimer = 0;
  let frozen = false;   // the user has taken over the terminal to edit it

  // Settle the terminal to its finished state and stop the typewriter - called the moment
  // the user focuses the command or comment to edit it, so their caret isn't overwritten.
  const freezeTerminal = (): void => {
    if (frozen) return;
    frozen = true;
    window.clearTimeout(typeTimer);
    if (typed && typed.textContent !== TYPED && !typed.dataset.edited) typed.textContent = TYPED;
    if (caret) caret.style.display = 'none';
    demo.classList.add('is-typed');
    italic?.classList.add('is-shown');
  };
  // Mark a field edited so a later re-focus won't reset it to the default command.
  term?.addEventListener('focusin', freezeTerminal);
  [typed, italic].forEach((el) => el?.addEventListener('input', () => { el.dataset.edited = '1'; }));

  if (reduce) {
    if (typed) typed.textContent = TYPED;
    if (caret) caret.style.display = 'none';
    italic?.classList.add('is-shown');
  } else {
    const run = (): void => {
      if (!typed || frozen) return;
      typed.textContent = '';
      italic?.classList.remove('is-shown');
      demo.classList.remove('is-typed');
      let i = 0;
      const step = (): void => {
        if (frozen) return;
        typed.textContent = TYPED.slice(0, i);
        i += 1;
        if (i <= TYPED.length) {
          typeTimer = window.setTimeout(step, 34 + Math.random() * 46); // human-ish cadence
        } else {
          demo.classList.add('is-typed');
          window.setTimeout(() => { if (!frozen) italic?.classList.add('is-shown'); }, 260);
          typeTimer = window.setTimeout(run, 4200);                     // hold, then retype
        }
      };
      step();
    };
    run();
  }

  // Teardown is driven by the dashboard's `view._cleanup` chain (mountDashboard calls it
  // before the next view's innerHTML swap). This replaces an app-wide MutationObserver on
  // document.body whose callback fired on EVERY DOM mutation just to notice this node's
  // own removal.
  return (): void => {
    onScreen = false;
    cancelAnimationFrame(raf);
    raf = 0;
    window.clearTimeout(typeTimer);
    vizObserver?.disconnect();
  };
}
