// SPDX-License-Identifier: MPL-2.0
//
// Waveform thumbnails for audio assets.
//
// An audio asset used to render as `<img src="…mp3">` in the picker (a broken-image
// icon) or a single static music-note glyph in the catalog. This module draws the
// asset's REAL overview peaks - `host.audio.analyse(...).peaks` - as an SVG tile.
//
// The one rule that governs everything here: the id hash chooses the SHAPE, never the
// DATA. A synthesised waveform from an id hash would look convincing and be a lie - 
// it would claim to be the form of a sound nothing ever measured. When no peaks
// exist yet the caller gets `audioThumbPlaceholder()`, an honest glyph.
//
// Output is a self-contained SVG string: no external stylesheet, all paint expressed
// as `currentColor` (overridable with `--audio-thumb-ink`), so a tile inherits the
// surrounding theme and works in light and dark for any brand.
//
// The shape vocabulary matches the audiogram tool (community/audiogram/template.html),
// which draws the same five forms to CANVAS from the same kind of data.

import { escapeHtml } from './html.ts';

export type AudioThumbShape = 'bars' | 'mirror' | 'wave' | 'ring' | 'blob';

const SHAPES: readonly AudioThumbShape[] = ['bars', 'mirror', 'wave', 'ring', 'blob'];

/** The square drawing box every shape works in. Tiles are laid out by CSS, not here. */
const VB = 64;

/**
 * Deterministic shape for an asset id - the same asset always gets the same form, so a
 * grid of 52 music beds does not read as 52 identical tiles.
 *
 * FNV-1a/32 rather than a cheap char-sum: catalog ids share long prefixes
 * (`suse/music/…`, `lolly/loops/…`) and differ only in the tail, and an additive hash
 * buckets those far too unevenly.
 */
export function audioThumbShape(id: string): AudioThumbShape {
  let h = 0x811c9dc5;
  const s = String(id ?? '');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    // FNV prime 16777619, via shifts so the multiply stays in 32-bit range.
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return SHAPES[h % SHAPES.length] ?? 'bars';
}

/**
 * Clamp one stored peak into 0..1. A corrupt or half-written cache can hand us NaN,
 * Infinity, or a negative - those must become 0 rather than reach the path builder,
 * where they would emit `d="M NaN NaN"` and render nothing at all.
 */
function lvl(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  const a = Math.abs(n);
  return a > 1 ? 1 : a;
}

/** Coordinate → string. Trims trailing zeros so the markup stays small in a big grid. */
function num(v: number): string {
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v * 100) / 100);
}

/**
 * Resample peaks to exactly `n` values, taking the MAX of each source range. Peaks are
 * already an envelope; averaging them a second time flattens the transients that make
 * one clip look different from another.
 */
function resample(src: ArrayLike<number>, n: number): number[] {
  const len = src.length;
  const out: number[] = new Array(n).fill(0);
  if (len === 0) return out;
  for (let i = 0; i < n; i++) {
    const a = Math.floor((i * len) / n);
    const b = Math.max(a + 1, Math.floor(((i + 1) * len) / n));
    let m = 0;
    for (let j = a; j < b && j < len; j++) {
      const v = lvl(src[j]);
      if (v > m) m = v;
    }
    out[i] = m;
  }
  return out;
}

function mean(vals: number[]): number {
  if (!vals.length) return 0;
  let s = 0;
  for (const v of vals) s += v;
  return s / vals.length;
}

function rect(x: number, y: number, w: number, h: number, r: number, opacity?: number): string {
  const op = opacity === undefined ? '' : ` opacity="${num(opacity)}"`;
  return `<rect x="${num(x)}" y="${num(y)}" width="${num(w)}" height="${num(h)}" rx="${num(r)}" fill="currentColor"${op}/>`;
}

// ── The shapes ───────────────────────────────────────────────────────────────────
// All five read the SAME peaks array; only the geometry differs.

function drawBars(p: number[]): string {
  const N = 28;
  const v = resample(p, N);
  const slot = VB / N;
  const bw = slot * 0.58;
  const parts: string[] = [];
  for (let i = 0; i < N; i++) {
    const h = Math.max(1.2, (v[i] ?? 0) * VB * 0.86);
    parts.push(rect(i * slot + (slot - bw) / 2, (VB - h) / 2, bw, h, bw / 2));
  }
  return parts.join('');
}

function drawMirror(p: number[]): string {
  const N = 28;
  const v = resample(p, N);
  const slot = VB / N;
  const bw = slot * 0.58;
  const mid = VB / 2;
  const parts: string[] = [];
  for (let i = 0; i < N; i++) {
    const h = Math.max(1.2, (v[i] ?? 0) * VB * 0.44);
    const x = i * slot + (slot - bw) / 2;
    parts.push(rect(x, mid - h, bw, h, bw / 2));
    // Faint rather than a true mirror, so the centre line reads as a baseline
    // instead of an axis of symmetry (same call the audiogram tool makes).
    parts.push(rect(x, mid, bw, h, bw / 2, 0.45));
  }
  return parts.join('');
}

function drawWave(p: number[]): string {
  const N = 64;
  const v = resample(p, N);
  const mid = VB / 2;
  const step = VB / Math.max(1, N - 1);
  const amp = VB * 0.42;
  const top: string[] = [];
  const bottom: string[] = [];
  for (let i = 0; i < N; i++) {
    const x = i * step;
    const d = Math.max(0.4, (v[i] ?? 0) * amp);
    top.push(`${num(x)} ${num(mid - d)}`);
    bottom.push(`${num(x)} ${num(mid + d)}`);
  }
  bottom.reverse();
  const d = `M${top.join('L')}L${bottom.join('L')}Z`;
  return `<path d="${d}" fill="currentColor" opacity="0.85"/>`;
}

function drawRing(p: number[]): string {
  const N = 48;
  const v = resample(p, N);
  const c = VB / 2;
  const R = VB * 0.24;
  const w = ((2 * Math.PI * R) / N) * 0.5;
  const parts: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    const len = VB * (0.035 + (v[i] ?? 0) * 0.2);
    const cos = Math.cos(a);
    const sin = Math.sin(a);
    parts.push(
      `<line x1="${num(c + cos * R)}" y1="${num(c + sin * R)}" x2="${num(c + cos * (R + len))}" y2="${num(c + sin * (R + len))}" stroke="currentColor" stroke-width="${num(w)}" stroke-linecap="round"/>`
    );
  }
  // A centre that is doing something even through a quiet passage.
  parts.push(
    `<circle cx="${num(c)}" cy="${num(c)}" r="${num(R * (0.78 + mean(v) * 0.1))}" fill="none" stroke="currentColor" stroke-width="0.6" opacity="0.35"/>`
  );
  return parts.join('');
}

// Harmonic number, amplitude, phase. Fixed phases so the lobes are not all aligned
// into a star; deterministic, so a still thumbnail is stable.
const BLOB_HARMONICS: readonly [number, number, number][] = [
  [2, 0.13, 0.0],
  [3, 0.1, 1.1],
  [5, 0.07, 2.3],
  [7, 0.05, 0.6],
  [11, 0.03, 1.9],
];

function drawBlob(p: number[]): string {
  const w = resample(p, BLOB_HARMONICS.length);
  const c = VB / 2;
  const R = VB * (0.26 + mean(w) * 0.1);
  const N = 96;
  const pts: string[] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * 2 * Math.PI - Math.PI / 2;
    let r = 1;
    // Built from SINUSOIDS, not by sampling the data per angle. The audiogram tool
    // learned this the hard way: per-angle sampling snaps to discrete indices, giving
    // flat runs joined by vertical walls - a cog, not a blob. Every term here is
    // 2π-periodic, so the curve is smooth and closes exactly with no seam.
    for (let k = 0; k < BLOB_HARMONICS.length; k++) {
      const harm = BLOB_HARMONICS[k];
      if (!harm) continue;
      r += (w[k] ?? 0) * harm[1] * Math.sin(harm[0] * a + harm[2]);
    }
    pts.push(`${num(c + Math.cos(a) * R * r)} ${num(c + Math.sin(a) * R * r)}`);
  }
  return `<path d="M${pts.join('L')}Z" fill="currentColor" opacity="0.85"/>`;
}

const DRAW: Record<AudioThumbShape, (p: number[]) => string> = {
  bars: drawBars,
  mirror: drawMirror,
  wave: drawWave,
  ring: drawRing,
  blob: drawBlob,
};

/**
 * Wrap body markup in the shared root `<svg>`.
 *
 * Decorative by default (`aria-hidden`) because these sit inside an already-labelled
 * card button - matching `videoThumb`/`lottieThumb` in views/picker.ts, which do the
 * same. A caller that uses the tile on its own passes `label` and gets `role="img"`
 * plus a `<title>`.
 */
function svgRoot(
  body: string,
  opts: { className?: string; id?: string; label?: string; shape: AudioThumbShape | 'none' }
): string {
  const cls = opts.className ? ` class="${escapeHtml(opts.className)}"` : '';
  const idAttr = opts.id ? ` data-audio-id="${escapeHtml(opts.id)}"` : '';
  const label = opts.label
    ? ` role="img" aria-label="${escapeHtml(opts.label)}"`
    : ' aria-hidden="true"';
  const title = opts.label ? `<title>${escapeHtml(opts.label)}</title>` : '';
  // `color:` on the root lets a host theme repaint every child via one custom property
  // while the children keep plain `currentColor` presentation attributes.
  return (
    `<svg${cls} viewBox="0 0 ${VB} ${VB}" preserveAspectRatio="xMidYMid meet" focusable="false"` +
    ` data-audio-shape="${opts.shape}"${idAttr}${label}` +
    ` style="color:var(--audio-thumb-ink, currentColor)">${title}${body}</svg>`
  );
}

/** An `<svg>` string drawn from REAL peaks (0..1). `className` goes on the root element. */
export function audioThumbSvg(
  peaks: Float32Array | number[],
  opts: { shape?: AudioThumbShape; className?: string; id?: string; label?: string } = {}
): string {
  const src: ArrayLike<number> = peaks ?? [];
  // No data is not "a flat waveform" - a flat line would assert silence we never
  // measured. Fall back to the honest glyph.
  if (!src.length) return audioThumbPlaceholder({ className: opts.className, label: opts.label });
  const shape: AudioThumbShape =
    opts.shape && SHAPES.includes(opts.shape)
      ? opts.shape
      : opts.id
        ? audioThumbShape(opts.id)
        : 'bars';
  const vals: number[] = [];
  for (let i = 0; i < src.length; i++) vals.push(lvl(src[i]));
  return svgRoot(DRAW[shape](vals), { ...opts, shape });
}

/**
 * The honest stand-in when no peaks exist yet: a music-note glyph, never a fabricated
 * waveform. Same drawing as the catalog view's AUDIO_GLYPH so the two surfaces agree.
 */
export function audioThumbPlaceholder(opts: { className?: string; label?: string } = {}): string {
  const body =
    '<g fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.75">' +
    '<path d="M26 46V16l24-4v26"/><circle cx="20" cy="46" r="6"/><circle cx="44" cy="42" r="6"/>' +
    '</g>';
  return svgRoot(body, { ...opts, shape: 'none' });
}
