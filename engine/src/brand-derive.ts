// SPDX-License-Identifier: MPL-2.0
/**
 * Brand derivation — OKLCH-native colour math + the semantic-token generator
 * behind the lolly-start onboarding (plans/brand-token-contract.md).
 *
 * Two halves, both pure and deterministic (no Date, no Math.random, no IO):
 *
 *   1. sRGB ↔ OKLCH conversion (parseOklch / formatOklch / hexToOklch /
 *      oklchToHex) plus WCAG 2.1 contrastRatio. This is the engine's single
 *      source of truth for `oklch()` / `lch()` colour strings — tokens.ts
 *      imports it for colorToHex (never duplicates the math) and the wizard
 *      reuses it for live previews. `oklchToHex` gamut-maps by reducing chroma
 *      toward the achromatic axis (binary search, fixed iteration count) so an
 *      out-of-sRGB request degrades to the nearest same-hue, same-lightness
 *      colour instead of clipping channels.
 *
 *   2. `deriveBrandTokens(opts)` — one brand colour in, a complete layered
 *      Tokens-Studio/DTCG document out: base ramps (primary/neutral/secondary,
 *      9 steps) + a brand-tinted spectrum + light/dark semantic sets + $themes,
 *      in exactly the shape `tokens.ts#createTokenSet` consumes. Every
 *      semantic slot is contrast-enforced, so a derived brand can never ship
 *      unreadable text.
 *
 * Pipeline for the maths: sRGB ↔ linear ↔ LMS ↔ Oklab ↔ OKLCH (Björn
 * Ottosson's published matrices); `lch()` additionally walks CIELAB → XYZ(D50)
 * → Bradford → XYZ(D65) → Oklab (CSS Color 4 constants).
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** An OKLCH colour. `l` is 0–1 (not the CSS percent), `h` in degrees. */
export interface Oklch {
  l: number;
  c: number;
  h: number;
  alpha?: number;
}

// ─── Small numeric helpers ────────────────────────────────────────────────────

const clamp01 = (n: number): number => Math.min(1, Math.max(0, n));
const normHue = (h: number): number => ((h % 360) + 360) % 360;

type Mat3 = readonly [number, number, number, number, number, number, number, number, number];
const apply3 = (m: Mat3, x: number, y: number, z: number): [number, number, number] => [
  m[0] * x + m[1] * y + m[2] * z,
  m[3] * x + m[4] * y + m[5] * z,
  m[6] * x + m[7] * y + m[8] * z,
];

// ─── sRGB transfer functions ──────────────────────────────────────────────────

// sRGB electro-optical transfer: encoded [0,1] → linear light [0,1].
const srgbToLinear = (c: number): number =>
  c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
const linearToSrgb = (c: number): number =>
  c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055;

// ─── Oklab core (Ottosson's reference matrices) ───────────────────────────────

// LMS′ (cube-rooted cone response) → Oklab.
const lmsToOklab = (l: number, m: number, s: number): [number, number, number] => [
  0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
  1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
  0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
];

function linearSrgbToOklab(r: number, g: number, b: number): [number, number, number] {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return lmsToOklab(l, m, s);
}

function oklabToLinearSrgb(L: number, a: number, b: number): [number, number, number] {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

function oklabToOklch(L: number, a: number, b: number): Oklch {
  const c = Math.hypot(a, b);
  return { l: L, c, h: c < 1e-7 ? 0 : normHue((Math.atan2(b, a) * 180) / Math.PI) };
}

// ─── lch() support: CIELAB (D50) → Oklab ──────────────────────────────────────

// CSS Color 4 constants: D50 reference white and the Bradford D50→D65 adaptation.
const D50_WHITE = [0.9642956764295677, 1, 0.8251046025104602] as const;
const D50_TO_D65: Mat3 = [
  0.9554734527042182, -0.023098536874261423, 0.0632593086610217,
  -0.028369706963208136, 1.0099954580058226, 0.021041398966943008,
  0.012314001688319899, -0.020507696433477912, 1.3303659366080753,
];
// XYZ (D65) → LMS cone response (Ottosson's M1).
const XYZ_TO_LMS: Mat3 = [
  0.8189330101, 0.3618667424, -0.1288597137,
  0.0329845436, 0.9293118715, 0.0361456387,
  0.0482003018, 0.2643662691, 0.633851707,
];

function labToOklch(L: number, a: number, b: number): Oklch {
  // CIELAB → XYZ (D50).
  const k = 24389 / 27;
  const e = 216 / 24389;
  const fy = (L + 16) / 116;
  const fx = fy + a / 500;
  const fz = fy - b / 200;
  const xr = fx ** 3 > e ? fx ** 3 : (116 * fx - 16) / k;
  const yr = L > k * e ? fy ** 3 : L / k;
  const zr = fz ** 3 > e ? fz ** 3 : (116 * fz - 16) / k;
  // D50 XYZ → D65 XYZ → LMS → Oklab.
  const [X, Y, Z] = apply3(D50_TO_D65, xr * D50_WHITE[0], yr * D50_WHITE[1], zr * D50_WHITE[2]);
  const [l, m, s] = apply3(XYZ_TO_LMS, X, Y, Z);
  return oklabToOklch(...lmsToOklab(Math.cbrt(l), Math.cbrt(m), Math.cbrt(s)));
}

// ─── Hex parsing / encoding ───────────────────────────────────────────────────

// #rgb/#rgba/#rrggbb/#rrggbbaa → [r, g, b, alpha 0–1], or null.
function parseHex(s: string): [number, number, number, number] | null {
  let h = String(s).trim().toLowerCase();
  if (!h.startsWith('#')) return null;
  h = h.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('');
  if ((h.length !== 6 && h.length !== 8) || /[^0-9a-f]/.test(h)) return null;
  const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
  return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1];
}

// ─── CSS string parsing ───────────────────────────────────────────────────────

// A number-or-percent component; `none` reads as 0 (the CSS missing-component rule).
function parseComponent(tok: string): { n: number; pct: boolean } | null {
  if (tok.toLowerCase() === 'none') return { n: 0, pct: false };
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%)?$/i.exec(tok);
  return m ? { n: parseFloat(m[1]!), pct: m[2] != null } : null;
}

// A hue component in deg/rad/grad/turn (bare number = degrees), normalised to [0,360).
function parseHueComponent(tok: string): number | null {
  if (tok.toLowerCase() === 'none') return 0;
  const m = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(deg|rad|grad|turn)?$/i.exec(tok);
  if (!m) return null;
  const n = parseFloat(m[1]!);
  const unit = (m[2] ?? 'deg').toLowerCase();
  const deg =
    unit === 'rad' ? (n * 180) / Math.PI :
    unit === 'grad' ? n * 0.9 :
    unit === 'turn' ? n * 360 : n;
  return normHue(deg);
}

function parseAlphaComponent(tok: string): number | null {
  const c = parseComponent(tok);
  return c ? clamp01(c.pct ? c.n / 100 : c.n) : null;
}

/**
 * Parse an `oklch()` or `lch()` CSS colour string.
 *
 * `oklch()`: L as a percent (`62%` → 0.62) or bare 0–1 number; C as a number or
 * percent of 0.4; H in degrees (deg/rad/grad/turn accepted); optional `/ alpha`.
 * `lch()` (CIELAB, D50): L 0–100 (percent or bare — same scale), C as a number
 * or percent of 150 — converted to OKLCH via Lab → XYZ → Oklab. Returns null
 * for anything else; `alpha` is only set when specified and < 1.
 */
export function parseOklch(s: string): Oklch | null {
  const m = /^(oklch|lch)\(([^()]*)\)$/i.exec(String(s).trim());
  if (!m) return null;
  const isOklch = m[1]!.toLowerCase() === 'oklch';
  const slash = m[2]!.split('/');
  if (slash.length > 2) return null;
  const parts = slash[0]!.trim().split(/\s+/);
  if (parts.length !== 3) return null;
  const L = parseComponent(parts[0]!);
  const C = parseComponent(parts[1]!);
  const h = parseHueComponent(parts[2]!);
  if (!L || !C || h == null) return null;
  let alpha: number | null = null;
  if (slash.length === 2) {
    alpha = parseAlphaComponent(slash[1]!.trim());
    if (alpha == null) return null;
  }
  const out = isOklch
    ? {
        l: clamp01(L.pct ? L.n / 100 : L.n),
        c: Math.max(0, C.pct ? (C.n / 100) * 0.4 : C.n), // CSS: chroma 100% = 0.4
        h,
      }
    : (() => {
        const labL = Math.min(100, Math.max(0, L.n)); // % and bare share the 0–100 scale
        const chroma = Math.max(0, C.pct ? (C.n / 100) * 150 : C.n); // CSS: chroma 100% = 150
        const hr = (h * Math.PI) / 180;
        return labToOklch(labL, chroma * Math.cos(hr), chroma * Math.sin(hr));
      })();
  if (alpha != null && alpha < 1) out.alpha = alpha;
  return out;
}

// toFixed then strip trailing zeros: 62.00 → "62", 0.1100 → "0.11".
const fmtNum = (n: number, dp: number): string =>
  n.toFixed(dp).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');

/** Format as a CSS string: `"oklch(62% 0.11 250)"` (deterministic, round-trip safe). */
export function formatOklch(c: Oklch): string {
  const l = fmtNum(clamp01(c.l) * 100, 2);
  const cc = fmtNum(Math.max(0, c.c), 4);
  const h = fmtNum(normHue(c.h), 2);
  const a = c.alpha != null && c.alpha < 1 ? ` / ${fmtNum(clamp01(c.alpha), 3)}` : '';
  return `oklch(${l}% ${cc} ${h}${a})`;
}

/** Hex (#rgb/#rgba/#rrggbb/#rrggbbaa) → OKLCH, or null. `alpha` set only when < 1. */
export function hexToOklch(hex: string): Oklch | null {
  const rgba = parseHex(hex);
  if (!rgba) return null;
  const [r, g, b, a] = rgba;
  const out = oklabToOklch(
    ...linearSrgbToOklab(srgbToLinear(r / 255), srgbToLinear(g / 255), srgbToLinear(b / 255)),
  );
  if (a < 1) out.alpha = a;
  return out;
}

// Tolerance is deliberately loose (1e-3 in LINEAR light): near the sRGB blue
// and yellow corners the constant-hue chroma ray grazes a cube face, dipping
// out of gamut by ~7e-4 before re-entering at the corner itself. A tight
// epsilon makes the chroma binary search below stop at that false boundary
// (#0000ff would emit as #0031e5); the loose one sails over the dip, and
// byte()'s clamp01 absorbs the residue at encode time (< 1/255 per channel).
const inSrgbGamut = (rgb: [number, number, number]): boolean =>
  rgb.every(v => v >= -1e-3 && v <= 1 + 1e-3);

/**
 * OKLCH → hex, gamut-mapped: when the requested chroma leaves sRGB, reduce it
 * toward the achromatic axis (hue + lightness preserved) with a fixed-count
 * binary search — deterministic, no channel clipping artefacts. Alpha < 1
 * appends an 8-digit hex.
 */
export function oklchToHex(c: Oklch): string {
  const L = clamp01(c.l);
  const h = normHue(c.h);
  const hr = (h * Math.PI) / 180;
  const toLinear = (chroma: number) =>
    oklabToLinearSrgb(L, chroma * Math.cos(hr), chroma * Math.sin(hr));
  let rgb = toLinear(Math.max(0, c.c));
  if (!inSrgbGamut(rgb)) {
    // The grey axis (chroma 0) is always inside sRGB for L∈[0,1], so this converges.
    let lo = 0;
    let hi = Math.max(0, c.c);
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (inSrgbGamut(toLinear(mid))) lo = mid;
      else hi = mid;
    }
    rgb = toLinear(lo);
  }
  const byte = (v: number) =>
    Math.round(linearToSrgb(clamp01(v)) * 255).toString(16).padStart(2, '0');
  const base = `#${byte(rgb[0])}${byte(rgb[1])}${byte(rgb[2])}`;
  return c.alpha != null && c.alpha < 1
    ? base + Math.round(clamp01(c.alpha) * 255).toString(16).padStart(2, '0')
    : base;
}

// ─── WCAG 2.1 contrast ────────────────────────────────────────────────────────

function wcagLuminance(hex: string): number | null {
  const rgba = parseHex(hex);
  if (!rgba) return null;
  // WCAG 2.1's published linearisation (0.03928 knee, not the sRGB spec's
  // 0.04045 — indistinguishable for 8-bit values, kept as the standard writes it).
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(rgba[0]) + 0.7152 * lin(rgba[1]) + 0.0722 * lin(rgba[2]);
}

/**
 * WCAG 2.1 contrast ratio between two hex colours (order-independent, 1–21).
 * Unparseable input → NaN, so every `>= floor` check honestly fails.
 */
export function contrastRatio(aHex: string, bHex: string): number {
  const la = wcagLuminance(aHex);
  const lb = wcagLuminance(bHex);
  if (la == null || lb == null) return NaN;
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ─── Any-CSS-colour → OKLCH (derive input only) ───────────────────────────────

// Minimal hsl → rgb (0–1 channels). tokens.ts has its own private copy for the
// legacy colorToHex path; this one exists so brand-derive stays import-free of
// tokens.ts (which imports US — a back-import would cycle).
function hslToRgb01(h: number, s: number, l: number): [number, number, number] {
  const hh = normHue(h) / 360;
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const chan = (t: number): number => {
    t = ((t % 1) + 1) % 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [chan(hh + 1 / 3), chan(hh), chan(hh - 1 / 3)];
}

// The forms BrandDeriveOptions.primary accepts: hex, oklch()/lch(), rgb(), hsl().
function parseCssColor(input: string): Oklch | null {
  const s = String(input).trim();
  if (s.startsWith('#')) return hexToOklch(s);
  if (/^(?:ok)?lch\(/i.test(s)) return parseOklch(s);
  let m;
  if ((m = /^rgba?\(([^)]+)\)$/i.exec(s))) {
    const p = m[1]!.split(/[,\s/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const chan = (t: string) => (t.endsWith('%') ? (parseFloat(t) / 100) * 255 : parseFloat(t));
    const rgb = [chan(p[0]!), chan(p[1]!), chan(p[2]!)];
    if (rgb.some(Number.isNaN)) return null;
    return oklabToOklch(...linearSrgbToOklab(
      srgbToLinear(clamp01(rgb[0]! / 255)),
      srgbToLinear(clamp01(rgb[1]! / 255)),
      srgbToLinear(clamp01(rgb[2]! / 255)),
    ));
  }
  if ((m = /^hsla?\(([^)]+)\)$/i.exec(s))) {
    const p = m[1]!.split(/[,\s/]+/).filter(Boolean);
    if (p.length < 3) return null;
    const h = parseHueComponent(p[0]!);
    const sat = parseFloat(p[1]!) / 100;
    const li = parseFloat(p[2]!) / 100;
    if (h == null || Number.isNaN(sat) || Number.isNaN(li)) return null;
    const [r, g, b] = hslToRgb01(h, clamp01(sat), clamp01(li));
    return oklabToOklch(...linearSrgbToOklab(srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)));
  }
  return null;
}

// ─── deriveBrandTokens ────────────────────────────────────────────────────────

export interface BrandDeriveOptions {
  /** The brand colour — any CSS colour string: hex, rgb(), hsl(), oklch(), lch(). */
  primary: string;
  /** Secondary-hue relationship. Default 'mono' (same hue, quiet chroma). */
  scheme?: 'mono' | 'complement' | 'analogous' | 'triad';
  /** Which look leads `$themes` (= the default theme). 'primary' = the dark-mid-primary look. */
  surface?: 'light' | 'dark' | 'primary';
  /** Contrast floors: 'comfort' (default) or 'high'. */
  contrast?: 'comfort' | 'high';
  /** How many steps each ramp carries (primary/neutral/secondary). Default 9;
   *  clamped to [3, 20]. The perceptual RAMP_L curve is resampled to this count
   *  and every semantic role's preferred step scales proportionally, so the
   *  contrast floors hold at any division count. */
  steps?: number;
  /** Provenance label baked into `$description`. */
  name?: string;
}

/** Ramp division bounds — the shade-count slider's range. */
export const RAMP_STEPS_MIN = 3;
export const RAMP_STEPS_MAX = 20;
export const RAMP_STEPS_DEFAULT = 9;

// Mirrors TOKEN_EXT in tokens.ts — kept as a local literal because tokens.ts
// imports this module's conversion math; importing the constant back would cycle.
const VENDOR_EXT = 'com.suse.lolly';

// Contrast floors per slot (vs its background) — the section-4 table of the spec.
const FLOORS = {
  comfort: { text: 7.0, muted: 3.0, onPrimary: 4.5, edge: 1.3 },
  high: { text: 10.0, muted: 4.5, onPrimary: 7.0, edge: 1.6 },
} as const;

// Perceptually spaced ramp lightness targets, step 1 (darkest) → 9 (lightest).
const RAMP_L = [0.18, 0.28, 0.38, 0.5, 0.62, 0.74, 0.84, 0.92, 0.97] as const;

// The six fixed spectrum hues, in the section-2 order.
const SPECTRUM: ReadonlyArray<readonly [string, number]> = [
  ['blue', 250], ['teal', 190], ['violet', 300], ['amber', 75], ['rose', 355], ['green', 145],
];

const SCHEME_ROTATION = { mono: 0, complement: 180, analogous: 30, triad: 120 } as const;

const WHITE: Oklch = { l: 1, c: 0, h: 0 };
const BLACK: Oklch = { l: 0, c: 0, h: 0 };

// `n` ramp L targets: the 9-point perceptual RAMP_L curve resampled to n points
// (endpoints fixed), with the MIDDLE step pulled to the primary's exact L when
// it's mid-range (0.45–0.75) — neighbours re-spaced so the ramp stays monotonic.
// n = 9 reproduces the original RAMP_L (and its step-5 anchor pull) verbatim.
function rampLightnesses(primaryL: number, n: number): number[] {
  const src = RAMP_L;
  const Ls: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : i / (n - 1);
    const x = t * (src.length - 1);
    const lo = Math.floor(x), hi = Math.min(src.length - 1, lo + 1);
    Ls.push(src[lo]! + (src[hi]! - src[lo]!) * (x - lo));
  }
  if (primaryL >= 0.45 && primaryL <= 0.75 && n >= 3) {
    const mid = Math.round((n - 1) / 2);
    Ls[mid] = primaryL;
    for (let i = 1; i < mid; i++) Ls[i] = Ls[0]! + (Ls[mid]! - Ls[0]!) * (i / mid);
    for (let i = mid + 1; i < n - 1; i++) Ls[i] = Ls[mid]! + (Ls[n - 1]! - Ls[mid]!) * ((i - mid) / (n - 1 - mid));
  }
  return Ls;
}

// Chroma bell over L: exactly 1 at the peak (so the anchor step keeps the
// input chroma verbatim), tapering toward both lightness extremes.
function chromaBell(L: number, peak: number): number {
  const lo = 0.02;
  const hi = 1.0;
  const t = L <= peak ? (L - lo) / Math.max(peak - lo, 1e-9) : (hi - L) / Math.max(hi - peak, 1e-9);
  return clamp01(t) ** 0.7;
}

// Rotate `from` toward `toward` by at most `maxDeg`, along the shorter arc.
function nudgeHue(from: number, toward: number, maxDeg: number): number {
  const d = ((toward - from) % 360 + 540) % 360 - 180;
  return normHue(from + Math.max(-maxDeg, Math.min(maxDeg, d)));
}

// Contrast checks and emitted values must agree, so every check runs on the
// QUANTISED colour — exactly what a consumer reads back from the stored
// `oklch()` string — never the full-precision intermediate.
function emitHex(v: Oklch): string {
  return oklchToHex(parseOklch(formatOklch(v)) ?? v);
}

// Ramp steps ordered by distance from `preferred`; ties break toward `tie`
// (-1 = darker side first, +1 = lighter side first). `n` = ramp length.
function stepsByDistance(preferred: number, tie: 1 | -1, n = 9): number[] {
  const out = [preferred];
  for (let d = 1; d < n; d++) {
    for (const s of [preferred + tie * d, preferred - tie * d]) {
      if (s >= 1 && s <= n && !out.includes(s)) out.push(s);
    }
  }
  return out;
}

// A chosen slot value: `step` present → alias into a ramp; absent → literal.
interface Slot {
  step?: number;
  value: Oklch;
}

// Chroma-preserving lightness nudge — the last-resort path when no ramp step
// meets a floor. Walks L toward the contrast-increasing extreme; black/white
// is the ceiling (no floor in the table exceeds what they deliver).
function nudged(from: Oklch, surfaceHex: string, floor: number): Oklch {
  const surfLum = wcagLuminance(surfaceHex) ?? 0;
  const dir = surfLum > 0.18 ? -1 : 1; // darker on a light surface, lighter on dark
  for (let i = 0; i <= 50; i++) {
    const l = clamp01(from.l + dir * 0.02 * i);
    const v = { l, c: from.c, h: from.h };
    if (contrastRatio(emitHex(v), surfaceHex) >= floor) return v;
    if (l === 0 || l === 1) break;
  }
  return dir < 0 ? BLACK : WHITE;
}

// Nearest ramp step meeting the floor vs the surface, else a nudged literal.
function pickByContrast(
  ramp: Oklch[], preferred: number, surfaceHex: string, floor: number, tie: 1 | -1,
): Slot {
  for (const s of stepsByDistance(preferred, tie, ramp.length)) {
    const v = ramp[s - 1]!;
    if (contrastRatio(emitHex(v), surfaceHex) >= floor) return { step: s, value: v };
  }
  return { value: nudged(ramp[preferred - 1]!, surfaceHex, floor) };
}

// on-primary candidates in spec order: white / black / the primary ramp ends.
function pickOnPrimary(primaryHex: string, primaryRamp: Oklch[], floor: number): Slot | null {
  const N = primaryRamp.length;
  const candidates: Slot[] = [
    { value: WHITE },
    { value: BLACK },
    { step: N, value: primaryRamp[N - 1]! },
    { step: 1, value: primaryRamp[0]! },
  ];
  for (const cand of candidates) {
    if (contrastRatio(emitHex(cand.value), primaryHex) >= floor) return cand;
  }
  return null;
}

type Tok = { $value: string; $extensions: Record<string, unknown> };
const withGroup = (group: string): Record<string, unknown> => ({ [VENDOR_EXT]: { group } });
const literalTok = (v: Oklch, group: string): Tok =>
  ({ $value: formatOklch(v), $extensions: withGroup(group) });
const aliasTok = (path: string, group: string): Tok =>
  ({ $value: `{${path}}`, $extensions: withGroup(group) });
const slotTok = (s: Slot, ramp: string, group: string): Tok =>
  s.step ? aliasTok(`color.ramp.${ramp}.${s.step}`, group) : literalTok(s.value, group);

// One theme's seven semantic slots, every floor enforced on the emitted values.
function buildSemantic(
  spec: { dark: boolean; primarySurface: boolean },
  ramps: { primary: Oklch[]; neutral: Oklch[] },
  p: Oklch,
  F: (typeof FLOORS)[keyof typeof FLOORS],
  high: boolean,
): Record<string, Tok> {
  const { primary: pRamp, neutral } = ramps;
  const tie: 1 | -1 = spec.dark ? 1 : -1; // ties break toward the higher-contrast side
  // Role preferred-steps are FRACTIONS of the ramp (0 = darkest step 1, 1 =
  // lightest step N), so the perceptual placement holds at any division count.
  // `at(frac)` maps to a 1-based step; at n = 9 these reproduce the original
  // fixed indices (9/1, 6/4, 3/7, 8/9 & 2/1, anchor 5, primary-surface 6…9).
  const N = neutral.length;
  const at = (frac: number): number => Math.min(N, Math.max(1, Math.round(frac * (N - 1)) + 1));
  const anchor = at(0.5); // the mid ramp step (was 5) — the brand-colour anchor

  let surface: Slot;
  if (spec.primarySurface) {
    // The "dark mid primary" look: a deep, chroma-rich primary surface.
    surface = { value: { l: 0.26, c: Math.max(0.06, p.c * 0.6), h: p.h } };
  } else {
    const step = spec.dark ? (high ? at(0.125) : at(0)) : (high ? at(0.875) : at(1));
    surface = { step, value: neutral[step - 1]! };
  }
  const surfaceHex = emitHex(surface.value);

  const text = pickByContrast(neutral, spec.dark ? at(1) : at(0), surfaceHex, F.text, tie);
  const muted = pickByContrast(neutral, spec.dark ? at(0.625) : at(0.375), surfaceHex, F.muted, tie);
  const edge = pickByContrast(neutral, spec.dark ? at(0.25) : at(0.75), surfaceHex, F.edge, tie);

  // primary + on-primary are enforced as a PAIR: when no on-primary candidate
  // reads on the anchor step, the primary slot itself shifts along its ramp
  // (nearest step first) until a passing pair exists.
  let primary: Slot | null = null;
  let onPrimary: Slot | null = null;
  if (spec.primarySurface) {
    // Lift primary to a lighter step until it reads on the primary surface
    // (the muted floor doubles as its readability target) AND carries a
    // passing on-primary.
    for (let s = at(0.625); s <= N && !primary; s++) {
      const v = pRamp[s - 1]!;
      if (contrastRatio(emitHex(v), surfaceHex) < F.muted) continue;
      const on = pickOnPrimary(emitHex(v), pRamp, F.onPrimary);
      if (on) {
        primary = { step: s, value: v };
        onPrimary = on;
      }
    }
  } else {
    for (const s of stepsByDistance(anchor, tie, N)) {
      const v = pRamp[s - 1]!;
      const on = pickOnPrimary(emitHex(v), pRamp, F.onPrimary);
      if (on) {
        primary = { step: s, value: v };
        onPrimary = on;
        break;
      }
    }
  }
  if (!primary || !onPrimary) {
    // Unreachable in practice (a ramp end always carries a passing white or
    // black at these floors) — but never emit a slot below its floor.
    const step = spec.primarySurface ? N : 1;
    primary = { step, value: pRamp[step - 1]! };
    onPrimary = { value: nudged(step === N ? BLACK : WHITE, emitHex(primary.value), F.onPrimary) };
  }

  return {
    'primary': slotTok(primary, 'primary', 'Semantic'),
    'on-primary': slotTok(onPrimary, 'primary', 'Semantic'),
    'secondary': aliasTok(`color.ramp.secondary.${anchor}`, 'Semantic'),
    'surface': slotTok(surface, 'neutral', 'Semantic'),
    'text': slotTok(text, 'neutral', 'Semantic'),
    'muted': slotTok(muted, 'neutral', 'Semantic'),
    'edge': slotTok(edge, 'neutral', 'Semantic'),
  };
}

/**
 * Derive a complete brand-token document from one colour.
 *
 * Output is the layered Tokens-Studio/DTCG shape `createTokenSet` consumes:
 * a `base` set (color.ramp.{primary,neutral,secondary}.1–9 + color.spectrum.*)
 * plus `light`/`dark` sets carrying the seven `color.semantic.*` slots, and
 * `$themes` ordered so the chosen `surface` look is the default theme. Fully
 * deterministic — same options, byte-identical document.
 *
 * Throws on an unparseable `primary` (the only invalid input; other options
 * fall back to their defaults).
 */
export function deriveBrandTokens(opts: BrandDeriveOptions): Record<string, unknown> {
  const p = parseCssColor(opts.primary);
  if (!p) throw new Error(`deriveBrandTokens: unparseable primary colour ${JSON.stringify(opts.primary)}`);
  const scheme = opts.scheme && Object.hasOwn(SCHEME_ROTATION, opts.scheme) ? opts.scheme : 'mono';
  const surfaceOpt = opts.surface === 'dark' || opts.surface === 'primary' ? opts.surface : 'light';
  const contrast = opts.contrast === 'high' ? 'high' : 'comfort';
  const high = contrast === 'high';
  const F = FLOORS[contrast];
  const steps = Math.round(Math.min(RAMP_STEPS_MAX, Math.max(RAMP_STEPS_MIN, opts.steps ?? RAMP_STEPS_DEFAULT)));

  // Ramps: hue held constant per ramp; chroma bells over L, peaking where the
  // primary sits (clamped mid-range) so the anchor keeps the input chroma.
  const peak = Math.min(0.75, Math.max(0.45, p.l));
  const Ls = rampLightnesses(p.l, steps);
  const mkRamp = (hue: number, chromaScale: number): Oklch[] =>
    Ls.map(L => ({ l: L, c: p.c * chromaScale * chromaBell(L, peak), h: normHue(hue) }));

  const primaryRamp = mkRamp(p.h, 1);
  // Mono derives a LOW-CHROMA SIBLING (quiet, but a distinct ramp — never a re-alias).
  const secondaryRamp = mkRamp(p.h + SCHEME_ROTATION[scheme], scheme === 'mono' ? 0.35 : 1);
  // Neutrals carry the primary hue at C ≤ 0.02.
  const neutralC = Math.min(0.02, Math.max(0.004, p.c * 0.25));
  const neutralRamp = Ls.map(L => ({ l: L, c: neutralC * chromaBell(L, peak), h: p.h }));

  const rampGroup = (r: Oklch[], group: string): Record<string, Tok> =>
    Object.fromEntries(r.map((v, i) => [String(i + 1), literalTok(v, group)]));

  // Six fixed hues at moderate chroma, each nudged ≤8° toward the brand hue.
  const spectrum = Object.fromEntries(SPECTRUM.map(([name, hue]) =>
    [name, literalTok({ l: 0.65, c: 0.12, h: nudgeHue(hue, p.h, 8) }, 'Spectrum')]));

  const ramps = { primary: primaryRamp, neutral: neutralRamp };
  const lightSem = buildSemantic({ dark: false, primarySurface: false }, ramps, p, F, high);
  const darkSem = buildSemantic({ dark: true, primarySurface: surfaceOpt === 'primary' }, ramps, p, F, high);

  const themes = [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ];
  if (surfaceOpt !== 'light') themes.reverse(); // chosen look first = the default theme

  return {
    $description:
      `Derived brand tokens${opts.name ? ` for ${opts.name}` : ''} — ` +
      `primary ${formatOklch(p)}, scheme ${scheme}, surface ${surfaceOpt}, contrast ${contrast}.`,
    $metadata: { tokenSetOrder: ['base', 'light', 'dark'] },
    $themes: themes,
    base: {
      color: {
        $type: 'color',
        ramp: {
          primary: rampGroup(primaryRamp, 'Primary'),
          neutral: rampGroup(neutralRamp, 'Neutral'),
          secondary: rampGroup(secondaryRamp, 'Secondary'),
        },
        spectrum,
      },
    },
    light: { color: { $type: 'color', semantic: lightSem } },
    dark: { color: { $type: 'color', semantic: darkSem } },
  };
}
