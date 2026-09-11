// SPDX-License-Identifier: MPL-2.0
/**
 * celebrateBurst - a one-shot confetti blast of little rounded "chips" flung out across the whole
 * screen from a point. Modelled on the /info hero's click-burst (docs/build.ts): each chip is a
 * baked offscreen sprite (rounded fill + label) that flies out with drag + gravity, then fades on
 * a squared tail so its solid fill stays crisp until it snaps out. Draws onto a transient
 * full-viewport canvas overlay (pointer-events:none, top of the z-stack) that removes itself once
 * every chip is gone - so it's fire-and-forget from wherever a control lives.
 *
 * Used to visually celebrate a moment - e.g. turning ON Neurospicy Mode - from the toggle's spot.
 * Skipped under reduced motion - the OS preference or the app's own (lib/a11y-prefs.ts):
 * a screen-filling blast is exactly the motion a calm-mode user asked NOT to have (and this
 * control's audience especially).
 */

import { hexToOklch, contrastRatio } from '@lolly/engine';
import { tokenValueToHex } from '../brand-vars.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { perfUiOn } from '../feature-flags.ts';

/** The chip palette: [box-fill, ink] pairs. Brand-derived when tokens are
 * loaded (see brandChipPairs); this SUSE set is the fallback for a tokenless
 * catalog - and the shape reference: every pair is a strong light/dark
 * contrast so the label stays legible. */
const FALLBACK_CHIP_COLORS: ReadonlyArray<readonly [string, string]> = [
  ['#0c322c', '#42d29f'], // dark Jungle → Jungle 5
  ['#30ba78', '#0c322c'], // bright Jungle → Pine ink (lighter jungle chip)
  ['#008878', '#bff1ea'], // mid Pine → Pine 7
  ['#01564a', '#90ebcd'], // deep Pine → Mint
  ['#38d5b4', '#01564a'], // light Pine → deep Pine ink
  ['#8e2810', '#ffb184'], // dark Persimmon → Persimmon 6
  ['#fe7c3f', '#47190d'], // bright Persimmon → darkest Persimmon ink
  ['#bd3314', '#ffd3bd'], // mid Persimmon → light
  ['#0c322c', '#efefef'], // Pine → Fog (contrast)
  ['#efefef', '#0c322c'], // Fog → Pine (a light chip for contrast the other way)
  ['#192072', '#81aefc'], // Midnight → light blue
  ['#2453ff', '#c8dafc'], // Waterhole → pale blue
  ['#0c322c', '#90ebcd'], // Pine → Mint
];
// Plain words only - a brand font may have no glyphs for symbols like ♪/★, which render as tofu.
const LABELS = ['JUNGLE', 'FOCUS', 'FLOW', 'CALM', 'BEAT', 'RHYTHM', 'DRUM', 'BASS', 'TEMPO', 'SPEED', 'FAST', 'QUICK', 'GENIUS'];

// The live brand face - same `--font-brand` custom property applyBrandFonts (brand-vars.ts)
// sets inline on <html> (or the tokens.css platform default when no brand font is loaded).
// Read once per burst rather than per-chip since it can't change mid-blast.
const DEFAULT_FONT_STACK = "'SUSE', ui-sans-serif, system-ui, sans-serif";
function liveBrandFontStack(): string {
  if (typeof document === 'undefined') return DEFAULT_FONT_STACK;
  const stack = getComputedStyle(document.documentElement).getPropertyValue('--font-brand').trim();
  return stack || DEFAULT_FONT_STACK;
}

const rand = (a: number, b: number): number => a + Math.random() * (b - a);

// ── Brand-derived chip palette ────────────────────────────────────────────────
// Build the [fill, ink] pairs from the LOADED brand's tokens: bucket every
// resolved colour by OKLCH lightness into lights and darks (the mid-tones are
// skipped - a mid-on-mid chip reads as mud), then keep light/dark combinations
// with real label contrast, in both orientations like the fallback set. The
// result is cached for the session; too few usable pairs (a sparse or
// monochrome brand) falls back to the SUSE set rather than a drab burst.

/** The host slice this needs - the same optional tokens resolver the brand-var
 * modules use; swatch values may be hex OR raw oklch() ramp strings. */
export interface ChipPairsHost {
  tokens?: { colors(): Promise<Array<{ value: string }>> };
}

const MIN_PAIRS = 6;   // fewer than this and the burst loses its confetti variety
const MAX_PAIRS = 18;  // enough variety; keeps the pair-building bounded

let chipPairsPromise: Promise<ReadonlyArray<readonly [string, string]>> | null = null;

/** Drop the session's chip pairs so the next burst reads the current design
 *  system's colours (plans/186 section 3.4). */
export function bustChipPairs(): void { chipPairsPromise = null; }

/** Fisher–Yates, in place. */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j]!, arr[i]!];
  }
  return arr;
}

async function buildBrandChipPairs(host: ChipPairsHost): Promise<ReadonlyArray<readonly [string, string]>> {
  let swatches: Array<{ value: string }> = [];
  try { swatches = (await host.tokens?.colors()) ?? []; } catch { /* tokenless - fallback below */ }
  const seen = new Set<string>();
  const lights: string[] = [];
  const darks: string[] = [];
  for (const s of swatches) {
    const hex = tokenValueToHex(s.value);
    if (!hex || seen.has(hex)) continue;
    seen.add(hex);
    const l = hexToOklch(hex)?.l;
    if (l === undefined) continue;
    if (l >= 0.66) lights.push(hex);
    else if (l <= 0.5) darks.push(hex);
  }
  const pairs: Array<readonly [string, string]> = [];
  for (const d of shuffle(darks)) {
    for (const l of shuffle([...lights])) {
      if (contrastRatio(d, l) < 4) continue;   // label must stay legible on the fill
      pairs.push([d, l], [l, d]);              // dark chip/light ink AND the reverse
      break;                                    // one partner per dark keeps hue variety over repeats
    }
    if (pairs.length >= MAX_PAIRS) break;
  }
  // A second pass pairs leftover lights so light-heavy palettes still mix both ways.
  if (pairs.length < MAX_PAIRS) {
    for (const l of shuffle([...lights])) {
      const d = shuffle([...darks]).find(dk => contrastRatio(dk, l) >= 4);
      if (d) pairs.push([l, d]);
      if (pairs.length >= MAX_PAIRS) break;
    }
  }
  return pairs.length >= MIN_PAIRS ? pairs : FALLBACK_CHIP_COLORS;
}

/** The session's chip palette - brand pairs once tokens resolve, cached. */
function chipPairs(host?: ChipPairsHost): Promise<ReadonlyArray<readonly [string, string]>> {
  if (!host?.tokens) return Promise.resolve(FALLBACK_CHIP_COLORS);
  if (!chipPairsPromise) {
    chipPairsPromise = buildBrandChipPairs(host).catch(() => FALLBACK_CHIP_COLORS);
  }
  return chipPairsPromise;
}

let measureCanvas: CanvasRenderingContext2D | null = null;
function measurer(): CanvasRenderingContext2D | null {
  if (!measureCanvas) measureCanvas = document.createElement('canvas').getContext('2d');
  return measureCanvas;
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.arcTo(x + w, y, x + w, y + r, r);
  c.lineTo(x + w, y + h - r); c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h); c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r); c.arcTo(x, y, x + r, y, r); c.closePath();
}

interface Chip {
  spr: HTMLCanvasElement; w: number; h: number;
  x: number; y: number; vx: number; vy: number;
  rot: number; vrot: number; alpha: number; life: number;
}

/** Bake one chip (filled rounded box + label) into an offscreen sprite at `dpr`, like /info. */
function makeChipSprite(dpr: number, palette: ReadonlyArray<readonly [string, string]>, fontStack: string): { spr: HTMLCanvasElement; w: number; h: number } | null {
  const m = measurer();
  if (!m) return null;
  const [fill, ink] = palette[Math.floor(Math.random() * palette.length)]!;
  const label = LABELS[Math.floor(Math.random() * LABELS.length)]!;
  const fs = rand(11, 20);
  m.font = `700 ${fs}px ${fontStack}`;
  const tw = m.measureText(label).width;
  const px = fs * 0.7, py = fs * 0.62;
  const w = tw + px * 2, h = fs + py * 2, r = Math.round(fs * 0.42);
  const spr = document.createElement('canvas');
  spr.width = Math.ceil(w * dpr); spr.height = Math.ceil(h * dpr);
  const sx = spr.getContext('2d');
  if (!sx) return null;
  sx.scale(dpr, dpr);
  sx.lineJoin = 'round';
  roundRect(sx, 0, 0, w, h, r);
  sx.fillStyle = fill; sx.fill();
  sx.fillStyle = ink;
  sx.font = `700 ${fs}px ${fontStack}`;
  sx.textAlign = 'center'; sx.textBaseline = 'alphabetic';
  const tm = sx.measureText(label);
  const asc = tm.actualBoundingBoxAscent || fs * 0.7, desc = tm.actualBoundingBoxDescent || 0;
  sx.fillText(label, w / 2, h / 2 + (asc - desc) / 2);
  return { spr, w, h };
}

/**
 * Blast a one-shot confetti burst out from (`x`, `y`) - viewport coordinates - across the whole
 * screen. Fire-and-forget: it paints a transient overlay canvas that cleans itself up.
 * Pass the host and the chips take the LOADED brand's light/dark pairs (cached after the
 * first resolve); without one they use the fallback set.
 */
export function celebrateBurst(x: number, y: number, host?: ChipPairsHost): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  if (prefersReducedMotion() || perfUiOn()) return; // calm/perf mode - no blast
  void chipPairs(host).then(palette => burstWith(x, y, palette));
}

function burstWith(x: number, y: number, palette: ReadonlyArray<readonly [string, string]>): void {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647';
  canvas.width = Math.round(window.innerWidth * dpr);
  canvas.height = Math.round(window.innerHeight * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const fontStack = liveBrandFontStack();
  const count = Math.floor(rand(52, 72));
  const chips: Chip[] = [];
  for (let i = 0; i < count; i++) {
    const s = makeChipSprite(dpr, palette, fontStack);
    if (!s) continue;
    const angle = (i / count) * Math.PI * 2 + rand(-0.35, 0.35);
    const spd = rand(9, 26);
    chips.push({
      spr: s.spr, w: s.w, h: s.h, x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd - rand(2, 7), // a little upward bias so it launches like fireworks
      rot: rand(-0.5, 0.5), vrot: rand(-0.03, 0.03),
      alpha: rand(0.85, 1), life: 1,
    });
  }
  if (!chips.length) return;
  document.body.appendChild(canvas);

  let raf = 0;
  const tick = (): void => {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    for (let i = chips.length - 1; i >= 0; i--) {
      const c = chips[i]!;
      c.vx *= 0.985; c.vy = c.vy * 0.985 + 0.14; // drag + gravity
      c.x += c.vx; c.y += c.vy; c.rot += c.vrot;
      c.life -= 0.006;
      if (c.life <= 0) { chips.splice(i, 1); continue; }
      // Hold full opacity, then snap out over the last ~22% (squared) so the solid fill
      // never goes muddy-translucent while chips overlap.
      const t = c.life / 0.22, fade = t >= 1 ? 1 : t * t;
      ctx.save();
      ctx.translate(c.x, c.y); ctx.rotate(c.rot); ctx.globalAlpha = c.alpha * fade;
      ctx.drawImage(c.spr, -c.w / 2, -c.h / 2, c.w, c.h);
      ctx.restore();
    }
    if (chips.length) { raf = requestAnimationFrame(tick); }
    else { cancelAnimationFrame(raf); canvas.remove(); }
  };
  raf = requestAnimationFrame(tick);
}
