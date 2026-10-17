// SPDX-License-Identifier: MPL-2.0
/** CSS decoration paint for drawn text: the strike from font-instance ascent facts, and the underline
 * with the gaps skip-ink clears, validated before drawing. HarfBuzz owns OpenType ascent lookup and
 * variation interpolation on the same instance that shapes the run.
 */
export interface StrikeMetrics { upem: number; ascent: number }
/** A strike rectangle relative to the run's baseline. */
export interface DrawStrike { y: number; height: number; width: number }

/** Missing or unusable font metrics must never become guessed decoration paint. */
export function strikeMetricsFact(upem: number, ascent: number | undefined): StrikeMetrics | null {
  if (!Number.isFinite(upem) || upem < 16 || upem > 16384 || ascent === undefined
    || !Number.isFinite(ascent) || ascent <= 0 || ascent > upem * 2) return null;
  return { upem, ascent };
}

/** Current Design HTML uses CSS auto line-through: one tenth em (at least 1px),
 * centered one third of the face ascent above the baseline. This is the pinned
 * Chromium reference policy, not the font OS/2 strike position/thickness.
 * Reference: Chromium 153.0.8010.12 text_decoration_info.cc and decoration_line_painter.cc.
 */
export function strikeGeometry(metrics: StrikeMetrics | null, size: number, width: number, baseline = 0): DrawStrike | null {
  if (!metrics || !strikeMetricsFact(metrics.upem, metrics.ascent)
    || !Number.isFinite(size) || size <= 0 || size > 16384 || !Number.isFinite(width) || width < 0 || width > 1e7 || !Number.isFinite(baseline) || Math.abs(baseline) > 1e7) return null;
  const height = Math.max(1, size / 10);
  const ascent = metrics.ascent * size / metrics.upem;
  // HTML layout uses the whole-pixel ascent; decoration paint uses FloatAscent
  // from the text top. Preserve that distinction before the solid-line snap.
  const top = baseline - Math.round(ascent) + 2 * ascent / 3 - height / 2;
  // Native HTML solid decoration snaps its local paint Y and floors thickness;
  // SVG text does not. Capture that before either emitter applies the row pose.
  return { y: Math.floor(top + .5) - baseline, height: Math.floor(height), width };
}

/** One painted piece of an underline, measured from the run's start. A piece under a hanging
 * space whose ink differs from the run's carries that `ink`. */
export interface DrawUnderlineSpan { x: number; width: number; ink?: string }
/** An underline relative to the run's baseline: the pieces left once skip-ink clears glyph ink.
 * On a line's last run the pieces may reach past the run, under the spaces that hang there. */
export interface DrawUnderline { y: number; height: number; spans: DrawUnderlineSpan[] }
/**
 * CSS auto underline before skip-ink. `y` and `height` are the painted rectangle relative
 * to the baseline. `top` and `bottom` bound the band glyph ink is measured in (y down,
 * baseline at 0), and `dilation` is how far each cleared gap reaches past the ink.
 */
export interface UnderlineBand { y: number; height: number; top: number; bottom: number; dilation: number }
/** Where one cluster's outline enters the underline band, along the run. */
export type InkGap = [left: number, right: number];

/** Current Design HTML uses CSS auto underline: one tenth em (at least 1px), its top
 * max(1, ceil(thickness / 2)) px below the alphabetic baseline. The decorating span and
 * its runs share that baseline and size, so no font metric is needed. Skip-ink measures
 * glyphs against the unsnapped line inset by half a pixel and clears min(thickness, 13)
 * px either side of their ink.
 * Reference: Chromium 153.0.8010.12 text_decoration_offset.cc, text_painter.cc and decoration_line_painter.cc.
 */
export function underlineGeometry(size: number, baseline = 0): UnderlineBand | null {
  if (!Number.isFinite(size) || size <= 0 || size > 16384 || !Number.isFinite(baseline) || Math.abs(baseline) > 1e7) return null;
  const thickness = Math.max(1, size / 10);
  const gap = Math.max(1, Math.ceil(thickness / 2));
  // The same solid-line snap as the strike: local paint Y rounded, thickness floored.
  return { y: Math.floor(baseline + gap + .5) - baseline, height: Math.floor(thickness), top: gap + .5, bottom: gap + thickness - .5, dilation: Math.min(thickness, 13) };
}

// Characters an auto underline draws through: Chromium's CanTextDecorationSkipInk, which
// excludes the generated IsCjkIdeographOrSymbol values and ranges, Hangul and Linear B.
const NO_SKIP = new Set([0x2F, 0x5C, 0x5F, 0x2C7, 0x2CA, 0x2CB, 0x2D9, 0x2020, 0x2021, 0x2030, 0x203B, 0x203C, 0x2042, 0x2047,
  0x2048, 0x2049, 0x2051, 0x20DD, 0x20DE, 0x2100, 0x2103, 0x2105, 0x2109, 0x210A, 0x2113, 0x2116, 0x2121, 0x212B, 0x213B, 0x2150,
  0x2151, 0x2152, 0x217F, 0x2189, 0x2307, 0x2312, 0x23CE, 0x2423, 0x25A0, 0x25A1, 0x25A2, 0x25AA, 0x25AB, 0x25B1, 0x25B2, 0x25B3,
  0x25B6, 0x25B7, 0x25BC, 0x25BD, 0x25C0, 0x25C1, 0x25C6, 0x25C7, 0x25C9, 0x25CB, 0x25CC, 0x25EF, 0x2605, 0x2606, 0x260E, 0x2616,
  0x2617, 0x26A0, 0x2713, 0x271A, 0x273F, 0x2740, 0x2756, 0x2763, 0x2B1A, 0xFE10, 0xFE11, 0xFE12, 0xFE19, 0xFF1D, 0x1F100, 0x1F200,
  0x1F237, 0x1F32C, 0x1F336, 0x1F37D, 0x1F43F, 0x1F54F, 0x1F93B, 0x1F946]);
const NO_SKIP_RANGES = [0x1100, 0x11FF, 0x2156, 0x215A, 0x2160, 0x216B, 0x2170, 0x217B, 0x23BE, 0x23CC, 0x2460, 0x2492, 0x249C,
  0x24FF, 0x25CE, 0x25D3, 0x25E2, 0x25E6, 0x2600, 0x2603, 0x2660, 0x266F, 0x2672, 0x267D, 0x2776, 0x277F, 0x2E80, 0x2FDF, 0x2FF0,
  0x302D, 0x3031, 0x312F, 0x3130, 0x318F, 0x3190, 0x31BF, 0x31C0, 0x31EF, 0x3200, 0x33FF, 0x3400, 0x4DBF, 0x4DC0, 0x4DFF, 0x4E00,
  0x9FFF, 0xA960, 0xA97F, 0xAC00, 0xD7AF, 0xD7B0, 0xD7FF, 0xF860, 0xF862, 0xF900, 0xFAFF, 0xFE30, 0xFE6F, 0xFF00, 0xFF0C, 0xFF0E,
  0xFF1A, 0xFF1F, 0xFFEF, 0x10080, 0x100FF, 0x16FE0, 0x16FFF, 0x17000, 0x187FF, 0x18800, 0x18AFF, 0x1B000, 0x1B0FF, 0x1B100,
  0x1B12F, 0x1B170, 0x1B2FF, 0x1F110, 0x1F129, 0x1F130, 0x1F149, 0x1F150, 0x1F169, 0x1F170, 0x1F189, 0x1F202, 0x1F219, 0x1F21B,
  0x1F22E, 0x1F230, 0x1F231, 0x1F23B, 0x1F24F, 0x1F252, 0x1F2FF, 0x1F321, 0x1F32A, 0x1F394, 0x1F39F, 0x1F3CD, 0x1F3CE, 0x1F3D4,
  0x1F3DF, 0x1F3F1, 0x1F3F2, 0x1F3F5, 0x1F3F7, 0x1F4FD, 0x1F4FE, 0x1F53E, 0x1F54A, 0x1F568, 0x1F573, 0x1F576, 0x1F579, 0x1F57B,
  0x1F58F, 0x1F591, 0x1F594, 0x1F597, 0x1F5A3, 0x1F5A5, 0x1F5E7, 0x1F5E9, 0x1F5FA, 0x1F650, 0x1F67F, 0x1F6C6, 0x1F6CB, 0x1F6CD,
  0x1F6CF, 0x1F6D3, 0x1F6D4, 0x1F6D9, 0x1F6DB, 0x1F6E0, 0x1F6EA, 0x1F6ED, 0x1F6F3, 0x1F6FD, 0x1F6FF, 0x1F900, 0x1F90B, 0x1FAC9,
  0x1FACC, 0x20000, 0x2FFFF];
// The reference also draws through emoji, and through the pictographs that appear in
// emoji sequences: a set built from ICU's sequence data that is not reproduced here.
const EMOJI = /\p{Emoji_Presentation}/u;
const PICTOGRAPH = /\p{Extended_Pictographic}/u;

/** Whether an auto underline clears this character's ink: false where CSS draws through it,
 * undefined for a pictograph whose place in the reference's set cannot be reproduced. */
export function skipsInk(codePoint: number): boolean | undefined {
  if (NO_SKIP.has(codePoint)) return false;
  for (let i = 0; i < NO_SKIP_RANGES.length; i += 2) if (codePoint >= NO_SKIP_RANGES[i]! && codePoint <= NO_SKIP_RANGES[i + 1]!) return false;
  const ch = String.fromCodePoint(codePoint);
  if (EMOJI.test(ch)) return false;
  return PICTOGRAPH.test(ch) ? undefined : true;
}

type Point = { x: number; y: number };
function bezierAt(p: readonly Point[], t: number, axis: 'x' | 'y'): number {
  const s = 1 - t;
  return p.length === 3
    ? s * s * p[0]![axis] + 2 * s * t * p[1]![axis] + t * t * p[2]![axis]
    : s * s * s * p[0]![axis] + 3 * s * s * t * p[1]![axis] + 3 * s * t * t * p[2]![axis] + t * t * t * p[3]![axis];
}

/** The x of every point where a quadratic or cubic Bezier crosses height `y`. Each monotone
 * piece is bisected, so every engine reaches the same answer from arithmetic and square roots. */
function curveCrossings(p: readonly Point[], y: number): number[] {
  const turns: number[] = [];
  if (p.length === 3) {
    const den = p[0]!.y - 2 * p[1]!.y + p[2]!.y;
    if (den !== 0) turns.push((p[0]!.y - p[1]!.y) / den);
  } else {
    const a = -p[0]!.y + 3 * p[1]!.y - 3 * p[2]!.y + p[3]!.y, b = 2 * (p[0]!.y - 2 * p[1]!.y + p[2]!.y), c = p[1]!.y - p[0]!.y;
    if (a === 0) { if (b !== 0) turns.push(-c / b); }
    else {
      const disc = b * b - 4 * a * c;
      if (disc >= 0) { const r = Math.sqrt(disc); turns.push((-b - r) / (2 * a), (-b + r) / (2 * a)); }
    }
  }
  const bounds = [0, ...turns.filter((t) => t > 0 && t < 1).sort((u, v) => u - v), 1];
  const ts: number[] = [];
  const add = (t: number) => { if (ts[ts.length - 1] !== t) ts.push(t); };
  for (let i = 0; i + 1 < bounds.length; i++) {
    let lo = bounds[i]!, hi = bounds[i + 1]!;
    let flo = bezierAt(p, lo, 'y') - y;
    const fhi = bezierAt(p, hi, 'y') - y;
    if (flo === 0) add(lo);
    if (fhi === 0) { add(hi); continue; }
    if (flo === 0 || (flo < 0) === (fhi < 0)) continue;
    for (let k = 0; k < 60; k++) {
      const mid = (lo + hi) / 2, fm = bezierAt(p, mid, 'y') - y;
      if ((fm < 0) === (flo < 0)) { lo = mid; flo = fm; } else hi = mid;
    }
    add((lo + hi) / 2);
  }
  return ts.map((t) => bezierAt(p, t, 'x'));
}

/**
 * Skia's glyph intercept for one outline: the left and right of every crossing of the
 * band's two edges, widened by any point (control points included) strictly inside the band.
 * `d` is the absolute M/L/H/V/Q/C/Z path `text.toPath` returns. Null when the outline
 * stays clear of the band, or touches it at one x only; undefined when the path cannot be read.
 */
export function inkIntercept(d: string, top: number, bottom: number): InkGap | null | undefined {
  let left = Infinity, right = -Infinity;
  const expand = (x: number) => { if (x < left) left = x; if (x > right) right = x; };
  const segment = (p: Point[]) => {
    const ys = p.map((q) => q.y);
    // A segment wholly above or below the band contributes nothing.
    if (top > Math.max(...ys) || Math.min(...ys) > bottom) return;
    for (const edge of [top, bottom]) {
      if (p.length === 2) {
        const t = (edge - p[0]!.y) / (p[1]!.y - p[0]!.y);
        if (t >= 0 && t < 1) expand(p[0]!.x + t * (p[1]!.x - p[0]!.x));
      } else for (const x of curveCrossings(p, edge)) expand(x);
    }
    for (const q of p) if (top < q.y && q.y < bottom) expand(q.x);
  };
  const tokens = d.match(/[A-Za-z]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g) ?? [];
  let at: Point = { x: 0, y: 0 }, start: Point = at, i = 0, command = '';
  const num = () => { const v = Number(tokens[i++]); if (!Number.isFinite(v)) throw new Error('number'); return v; };
  const point = (): Point => { const x = num(); return { x, y: num() }; };
  try {
    while (i < tokens.length) {
      if (/[A-Za-z]/.test(tokens[i]!)) command = tokens[i++]!;
      else if (!command || command === 'Z') return undefined;
      if (command === 'M') { at = start = point(); command = 'L'; continue; }
      if (command === 'Z') { if (at.x !== start.x || at.y !== start.y) segment([at, start]); at = start; continue; }
      let next: Point[];
      if (command === 'L') next = [point()];
      else if (command === 'H') next = [{ x: num(), y: at.y }];
      else if (command === 'V') next = [{ x: at.x, y: num() }];
      else if (command === 'Q') next = [point(), point()];
      else if (command === 'C') next = [point(), point(), point()];
      else return undefined;
      segment([at, ...next]);
      at = next[next.length - 1]!;
    }
  } catch { return undefined; }
  return left < right ? [left, right] : null;
}

/**
 * The ink gaps skip-ink clears for one run, from `text.toPath` clusters. A cluster stands
 * for its glyphs, judged by the character it starts at as the reference judges each glyph.
 * Null when there are no clusters, an outline cannot be read, or a cluster whose ink
 * reaches the band is a character the reference's rule cannot be reproduced for.
 */
export function underlineInkGaps(text: string, clusters: ReadonlyArray<{ start: number; d: string }> | undefined, band: UnderlineBand): InkGap[] | null {
  if (!clusters) return null;
  const gaps: InkGap[] = [];
  for (const cluster of clusters) {
    const codePoint = text.codePointAt(cluster.start);
    const skip = codePoint === undefined ? undefined : skipsInk(codePoint);
    if (skip === false) continue;
    const hit = inkIntercept(cluster.d, band.top, band.bottom);
    if (hit === undefined) return null;
    if (!hit) continue;
    if (skip === undefined) return null;
    gaps.push(hit);
  }
  return gaps;
}

/**
 * The underline pieces left along a run of `width` starting at page x `origin`, once each
 * gap is widened by the dilation. The reference clips the gaps out without anti-aliasing,
 * so each cleared edge sits on a whole pixel of the page.
 */
export function underlineSpans(origin: number, width: number, gaps: readonly InkGap[], dilation: number): DrawUnderlineSpan[] {
  const cuts = gaps.map(([l, r]) => [Math.floor(origin + l - dilation + .5) - origin, Math.floor(origin + r + dilation + .5) - origin] as const)
    .sort((a, b) => a[0] - b[0]);
  const spans: DrawUnderlineSpan[] = [];
  let x = 0;
  for (const [l, r] of cuts) {
    const end = Math.min(l, width);
    if (end > x) spans.push({ x, width: end - x });
    if (r > x) x = r;
  }
  if (width > x) spans.push({ x, width: width - x });
  return spans;
}
