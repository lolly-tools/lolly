// SPDX-License-Identifier: MPL-2.0
/**
 * Docs-screenshot comparison — the pure logic behind scripts/build-docs-shots.ts.
 *
 * Committed screenshots are snapshots; every capture run is a comparison against
 * them. Nothing here touches the filesystem or a browser: callers decode PNGs to
 * raw RGBA and pass them in, so the classification rules are unit-testable
 * (tests/docs-shots-compare.test.ts) without Chromium or sharp.
 *
 * Failure taxonomy (what Andy actually wants to know after a run):
 *   • hard failure  — the capture itself errored (handled by the script, not here)
 *   • suspicious    — the capture "succeeded" but the pixels look wrong: tiny file,
 *                     near-uniform (blank) image, or dimensions that don't match
 *                     the declared viewport. Flags, not verdicts — a legitimately
 *                     minimal page can trip 'tiny', so flags inform, never delete.
 *   • changed       — visibly different from the committed baseline. Never
 *                     auto-promoted; --accept is the snapshot-update gesture.
 */

/** Decoded raster: tightly-packed RGBA, `data.length === width * height * 4`. */
export interface RawImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface ShotThresholds {
  /** Absolute byte floor — a viewport-sized PNG below this is almost certainly blank. */
  minBytes: number;
  /** Max per-channel stddev (0-255 scale) for an image to count as blank. */
  blankStddev: number;
  /** |new−old|/old encoded-size change beyond this raises the 'size-jump' flag. */
  sizeDeltaFrac: number;
  /** Per-channel difference a pixel must exceed before it counts as different. */
  pixelTol: number;
  /** Fraction of differing pixels beyond which the shot is 'changed'. */
  pixelDiffFrac: number;
  /** Slack (px) allowed between declared and actual dimensions (clip rounding × DPR). */
  dimSlack: number;
  /** Byte floor for a TRUE-VECTOR svg shot (far lower than a raster's — a legit
   *  vector page can be small, but near-nothing still means a failed print). */
  vectorMinBytes: number;
}

export const DEFAULT_THRESHOLDS: ShotThresholds = {
  minBytes: 8_192,
  blankStddev: 2,
  sizeDeltaFrac: 0.4,
  pixelTol: 12,
  pixelDiffFrac: 0.005,
  dimSlack: 2,
  vectorMinBytes: 2_048,
};

/** Highest per-channel standard deviation across R, G, B (alpha ignored). */
export function channelStddev(img: RawImage): number {
  const n = img.width * img.height;
  if (!n) return 0;
  let worst = 0;
  for (let c = 0; c < 3; c++) {
    let sum = 0;
    let sumSq = 0;
    for (let i = c; i < img.data.length; i += 4) {
      const v = img.data[i]!;
      sum += v;
      sumSq += v * v;
    }
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    worst = Math.max(worst, Math.sqrt(variance));
  }
  return worst;
}

/** True when the image is a near-uniform wash — the page painted nothing. */
export function isBlank(img: RawImage, t: ShotThresholds = DEFAULT_THRESHOLDS): boolean {
  return channelStddev(img) <= t.blankStddev;
}

/**
 * Fraction of pixels whose R, G, B or A differs by more than `tol`.
 * Returns null when the two images aren't the same size (not comparable).
 */
export function pixelDiffFraction(a: RawImage, b: RawImage, tol: number): number | null {
  if (a.width !== b.width || a.height !== b.height) return null;
  const n = a.width * a.height;
  if (!n) return 0;
  let diff = 0;
  for (let i = 0; i < n; i++) {
    const o = i * 4;
    if (
      Math.abs(a.data[o]! - b.data[o]!) > tol ||
      Math.abs(a.data[o + 1]! - b.data[o + 1]!) > tol ||
      Math.abs(a.data[o + 2]! - b.data[o + 2]!) > tol ||
      Math.abs(a.data[o + 3]! - b.data[o + 3]!) > tol
    ) {
      diff++;
    }
  }
  return diff / n;
}

export type ShotFlag = 'tiny' | 'blank' | 'dims-mismatch' | 'size-jump';

export interface ShotVerdict {
  kind: 'new' | 'unchanged' | 'changed';
  flags: ShotFlag[];
  /** Fraction of pixels differing from the baseline (null: no baseline / dims differ). */
  pixelDiff: number | null;
  /** Signed encoded-size change vs the baseline (null: no baseline). */
  sizeDelta: number | null;
}

export interface ShotComparison {
  newBytes: number;
  newImg: RawImage;
  /** Dimensions the manifest declares (post-crop, post-DPR). */
  expected: { width: number; height: number };
  oldBytes?: number;
  oldImg?: RawImage;
}

/** Classify one capture against its committed baseline (if any). */
export function classifyShot(c: ShotComparison, t: ShotThresholds = DEFAULT_THRESHOLDS): ShotVerdict {
  const flags: ShotFlag[] = [];
  if (c.newBytes < t.minBytes) flags.push('tiny');
  if (isBlank(c.newImg, t)) flags.push('blank');
  if (
    Math.abs(c.newImg.width - c.expected.width) > t.dimSlack ||
    Math.abs(c.newImg.height - c.expected.height) > t.dimSlack
  ) {
    flags.push('dims-mismatch');
  }

  if (!c.oldImg || c.oldBytes === undefined) {
    return { kind: 'new', flags, pixelDiff: null, sizeDelta: null };
  }

  const sizeDelta = c.oldBytes > 0 ? (c.newBytes - c.oldBytes) / c.oldBytes : null;
  if (sizeDelta !== null && Math.abs(sizeDelta) > t.sizeDeltaFrac) flags.push('size-jump');

  const pixelDiff = pixelDiffFraction(c.oldImg, c.newImg, t.pixelTol);
  // Same-size + few differing pixels = unchanged, and the baseline bytes are kept
  // verbatim (a re-encode of identical pixels must not churn git history).
  const unchanged = pixelDiff !== null && pixelDiff <= t.pixelDiffFrac;
  return { kind: unchanged ? 'unchanged' : 'changed', flags, pixelDiff, sizeDelta };
}

// ── True-vector (svg) shots ───────────────────────────────────────────────────
//
// A vector shot is compared as a DOCUMENT, not as pixels: the conversion is
// deterministic, so "unchanged" is string equality after stripping the C2PA
// block (whose signature carries a timestamp) from the committed baseline.
// Pixel-percentage metrics don't apply — size delta and dims carry the report.

/** Remove the C2PA <metadata><c2pa:manifest>…</> block + xmlns (engine placeSvg shape). */
export function stripSvgC2pa(svg: string): string {
  return svg
    .replace(/<metadata><c2pa:manifest>[^<]*<\/c2pa:manifest><\/metadata>/, '')
    .replace(/<c2pa:manifest>[^<]*<\/c2pa:manifest>/, '')
    .replace(/ xmlns:c2pa="[^"]*"/, '');
}

/** width/height attributes of the root <svg> element, if numeric. */
export function svgRootSize(svg: string): { width: number; height: number } | null {
  const root = svg.match(/<svg[^>]*>/);
  if (!root) return null;
  const w = root[0].match(/ width="([\d.]+)"/);
  const h = root[0].match(/ height="([\d.]+)"/);
  if (!w || !h) return null;
  return { width: Number(w[1]), height: Number(h[1]) };
}

export interface VectorShotComparison {
  newText: string;
  newBytes: number;
  /** Declared output size in CSS px (windowPdfSvg's outWidth/outHeight). */
  expected: { width: number; height: number };
  oldText?: string;
  oldBytes?: number;
}

/** Classify one true-vector capture against its committed baseline (if any). */
export function classifyVectorShot(c: VectorShotComparison, t: ShotThresholds = DEFAULT_THRESHOLDS): ShotVerdict {
  const flags: ShotFlag[] = [];
  if (c.newBytes < t.vectorMinBytes) flags.push('tiny');
  const size = svgRootSize(c.newText);
  if (!size ||
    Math.abs(size.width - c.expected.width) > t.dimSlack ||
    Math.abs(size.height - c.expected.height) > t.dimSlack
  ) {
    flags.push('dims-mismatch');
  }

  if (c.oldText === undefined || c.oldBytes === undefined) {
    return { kind: 'new', flags, pixelDiff: null, sizeDelta: null };
  }
  const sizeDelta = c.oldBytes > 0 ? (c.newBytes - c.oldBytes) / c.oldBytes : null;
  const unchanged = stripSvgC2pa(c.oldText) === stripSvgC2pa(c.newText);
  if (!unchanged && sizeDelta !== null && Math.abs(sizeDelta) > t.sizeDeltaFrac) flags.push('size-jump');
  return { kind: unchanged ? 'unchanged' : 'changed', flags, pixelDiff: null, sizeDelta };
}

// ── In-markdown recipes ───────────────────────────────────────────────────────
//
// A docs screenshot is DECLARED where it's used: the markdown image URL is a real
// url-shot tool link (domain-relative), e.g.
//   ![The gallery](/t/url-shot?url=%2F%23%2F&width=1440&height=900&waitMs=1600&format=svg&filename=gallery)
// The query is url-shot's own input vocabulary (url, waitMs, css, scrollDepth,
// zoom, crop*) plus the reserved params width/height/dpi/format/filename and the
// pipeline-only `tolerance`. Today scripts/build-docs-shots.ts captures the link
// at build time and docs/build.ts rewrites the src to the committed baseline at
// /info/shots/<filename>.<format>; the day a GET renderer ships, the same link
// can resolve live. Content and screenshot recipe travel together in the .md.

/** One parsed screenshot recipe: an app route + url-shot capture params. */
export interface ShotDef {
  slug: string;
  route: string;
  /** Output format of the committed baseline (svg default — a scalable wrapper). */
  format: 'svg' | 'png' | 'jpg';
  width?: number;
  height?: number;
  dpi?: number;
  waitMs?: number;
  css?: string;
  scrollDepth?: number;
  zoom?: number;
  cropLeft?: number;
  cropRight?: number;
  cropTop?: number;
  cropBottom?: number;
  /**
   * Crop to a single element by CSS selector — the capture measures its
   * bounding box (after css/scroll/wait) and derives the crop insets, so a
   * recipe can frame "just the Share dialog" without hand-computing fractions.
   * Overrides any explicit crop* values. Pipeline-only (resolved at capture).
   */
  cropSelector?: string;
  /**
   * Per-shot changed-vs-unchanged tolerance (fraction of differing pixels),
   * overriding ShotThresholds.pixelDiffFrac. For pages hosting wall-clock media
   * (APNG/SMIL/video card previews) whose animation phase CSS freezing can't pin —
   * raise it just enough to absorb the flutter, never to paper over real change.
   */
  pixelDiffFrac?: number;
  /** The verbatim recipe URL as written in the markdown (identity for dedup). */
  raw: string;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const RECIPE_RE = /!\[[^\]]*\]\((\/t\/url-shot\?[^)\s]+)\)/g;
const FORMATS = new Set(['svg', 'png', 'jpg']);

/**
 * Extract every url-shot recipe image from one markdown source. The same recipe
 * may appear in several documents; a filename reused with a DIFFERENT query is a
 * conflict (two shots can't share a baseline), reported as a problem.
 */
export function parseShotRecipes(md: string): { recipes: ShotDef[]; problems: string[] } {
  const recipes: ShotDef[] = [];
  const problems: string[] = [];
  const byName = new Map<string, string>();
  for (const m of md.matchAll(RECIPE_RE)) {
    const raw = m[1]!;
    const q = new URLSearchParams(raw.slice(raw.indexOf('?') + 1));
    const slug = q.get('filename') ?? '';
    const at = `recipe "${slug || raw.slice(0, 60)}"`;
    if (!SLUG_RE.test(slug)) { problems.push(`${at}: needs a kebab-case filename= param`); continue; }
    const prior = byName.get(slug);
    if (prior !== undefined) {
      if (prior !== raw) problems.push(`${at}: filename reused with a different recipe`);
      continue; // identical duplicate — same shot referenced again
    }
    byName.set(slug, raw);

    const route = q.get('url') ?? '';
    if (!route.startsWith('/')) problems.push(`${at}: url= must be a domain-relative app route ("/#/…")`);
    const format = (q.get('format') ?? 'svg').toLowerCase();
    if (!FORMATS.has(format)) problems.push(`${at}: format must be svg, png or jpg`);
    const num = (k: string): number | undefined => {
      const v = q.get(k);
      if (v === null) return undefined;
      const n = Number(v);
      if (!Number.isFinite(n)) { problems.push(`${at}: ${k}= must be a number`); return undefined; }
      return n;
    };
    const tolerance = num('tolerance');
    if (tolerance !== undefined && !(tolerance >= 0 && tolerance <= 1)) problems.push(`${at}: tolerance must be within 0..1`);

    recipes.push({
      slug, route, raw,
      format: format as ShotDef['format'],
      width: num('width'), height: num('height'), dpi: num('dpi'),
      waitMs: num('waitMs'), scrollDepth: num('scrollDepth'), zoom: num('zoom'),
      cropLeft: num('cropLeft'), cropRight: num('cropRight'),
      cropTop: num('cropTop'), cropBottom: num('cropBottom'),
      cropSelector: q.get('cropSelector') ?? undefined,
      css: q.get('css') ?? undefined,
      pixelDiffFrac: tolerance,
    });
  }
  return { recipes, problems };
}
