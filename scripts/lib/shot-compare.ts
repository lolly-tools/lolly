// SPDX-License-Identifier: MPL-2.0
/**
 * Docs-screenshot comparison - the pure logic behind scripts/build-docs-shots.ts.
 *
 * Committed screenshots are snapshots; every capture run is a comparison against
 * them. Nothing here touches the filesystem or a browser: callers decode PNGs to
 * raw RGBA and pass them in, so the classification rules are unit-testable
 * (tests/docs-shots-compare.test.ts) without Chromium or sharp.
 *
 * Failure taxonomy (what Andy actually wants to know after a run):
 *   • hard failure - the capture itself errored (handled by the script, not here)
 *   • suspicious - the capture "succeeded" but the pixels look wrong: tiny file,
 *                     near-uniform (blank) image, or dimensions that don't match
 *                     the declared viewport. Flags, not verdicts - a legitimately
 *                     minimal page can trip 'tiny', so flags inform, never delete.
 *   • changed - visibly different from the committed baseline. Never
 *                     auto-promoted; --accept is the snapshot-update gesture.
 */

/** Decoded raster: tightly-packed RGBA, `data.length === width * height * 4`. */
export interface RawImage {
  width: number;
  height: number;
  data: Uint8Array;
}

export interface ShotThresholds {
  /** Absolute byte floor - a viewport-sized PNG below this is almost certainly blank. */
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
  /** Byte floor for a TRUE-VECTOR svg shot (far lower than a raster's - a legit
   *  vector page can be small, but near-nothing still means a failed print). */
  vectorMinBytes: number;
  /** Device-pixel width ceiling for a raster shot - see MAX_SHOT_PX. */
  maxWidth: number;
  /** Encoded-byte ceiling for a raster shot. */
  maxBytes: number;
  /** Encoded-byte ceiling for a vector shot (no pixel width to judge). */
  vectorMaxBytes: number;
}

/**
 * The widest a docs screenshot can ever be SEEN, in device pixels.
 *
 * `docs/build.ts` renders /info in a 1180px `.docs-wrap` - a 220px nav rail plus
 * `.docs-content{padding:6rem 3.5rem}` - so a shot's box is 1180−220−112 = 848 CSS
 * px, and that is a hard cap: `max-width` means a 5K monitor shows the same 848px
 * as a laptop. At DPR 2 that is 1696 device px; the FAQ accordion's box is
 * narrower still (~801 CSS px). Rounded up for clip/rounding slack.
 *
 * Every pixel past this is bytes no reader can resolve. Historically most recipes
 * paired `width=1440` with `dpi=192` and shipped 2880 px - 2.9x the pixels of the
 * ceiling, i.e. about two thirds of the file unviewable. `clampDpr` below is what
 * stops that happening again, without hand-tuning 134 recipes.
 */
export const MAX_SHOT_PX = 1_800;

export const DEFAULT_THRESHOLDS: ShotThresholds = {
  minBytes: 8_192,
  blankStddev: 2,
  sizeDeltaFrac: 0.4,
  pixelTol: 12,
  pixelDiffFrac: 0.005,
  dimSlack: 2,
  vectorMinBytes: 2_048,
  maxWidth: MAX_SHOT_PX,
  // Deliberately loose to begin with: these are the first ceilings this pipeline
  // has ever had, and a number tight enough to be satisfying today would either
  // block legitimate shots or collect waivers. `maxWidth` is the derived rule and
  // does the real work; this is the backstop for the OTHER failure mode, where the
  // pixels are in budget but the content is incompressible - the gradient and
  // street-map canvases run ~1.5 B/px against a UI shot's ~0.36, and are the
  // heaviest files left once width is capped. A dense full-window UI shot at the
  // width ceiling measures ~0.45 B/px (1800x1125 ≈ 910 KB), so 1 MB clears those
  // and still flags continuous-tone art. Ratchet down as shots are reframed.
  maxBytes: 1_000_000,
  vectorMaxBytes: 1_048_576,
};

/**
 * The device-pixel ratio a capture should actually use: the recipe's own request,
 * reduced so the output cannot exceed `maxPx` across.
 *
 * `clipCssWidth` is the visible width AFTER cropping, which is the only width that
 * ends up in the file - so a recipe that crops to the area of focus (the house
 * rule) keeps its full 2x crispness, while a full-window shot quietly drops toward
 * 1x instead of shipping pixels past the display ceiling. Recipes therefore state
 * the density they want and this decides what is worth encoding.
 *
 * Returns a plain ratio (1 = 96dpi). Never below 1: a shot must not be downsampled
 * below CSS resolution, because then it would render soft at any size.
 */
export function clampDpr(requestedDpi: number, clipCssWidth: number, maxPx = MAX_SHOT_PX): number {
  const requested = requestedDpi > 96 ? requestedDpi / 96 : 1;
  if (!(clipCssWidth > 0)) return requested;
  return Math.max(1, Math.min(requested, maxPx / clipCssWidth));
}

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

/** True when the image is a near-uniform wash - the page painted nothing. */
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

export type ShotFlag = 'tiny' | 'blank' | 'dims-mismatch' | 'size-jump' | 'over-scale' | 'heavy';

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
  // Ceilings, checked BEFORE the no-baseline return so a brand-new shot is judged
  // too - an over-weight baseline is easiest to stop on the run that creates it.
  if (c.newImg.width > t.maxWidth) flags.push('over-scale');
  if (c.newBytes > t.maxBytes) flags.push('heavy');

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
// Pixel-percentage metrics don't apply - size delta and dims carry the report.

/** Remove the C2PA <metadata><c2pa:manifest>…</> block + xmlns (engine placeSvg shape). */
export function stripSvgC2pa(svg: string): string {
  // GLOBAL, all three. A shot is not limited to one manifest: the walker inlines catalog
  // preview SVGs as real nested vector, and those previews are themselves credentialed - 
  // the gallery shot carries EIGHT. Stripping only the first removed the shot's own
  // manifest from a stamped baseline but the first inlined preview's from a fresh
  // unstamped capture, so the two could never compare equal and the shot reported
  // `changed` on every run no matter how deterministic the capture was.
  return svg
    .replace(/<metadata><c2pa:manifest>[^<]*<\/c2pa:manifest><\/metadata>/g, '')
    .replace(/<c2pa:manifest>[^<]*<\/c2pa:manifest>/g, '')
    .replace(/ xmlns:c2pa="[^"]*"/g, '');
}

/** width/height attributes of the root <svg> element, if numeric. */
/**
 * The published frame for a walker shot, in the walked node's OWN coordinate space.
 *
 * `nat`   the walker's native root box (it frames getBoundingClientRect, so this is
 *         the element's border box - NOT its scroll height).
 * `frame` the recipe's declared width x height.
 * `off`   how far the node extends above/left of the viewport, i.e.
 *         max(0, -rect.left) and max(0, -rect.top).
 *
 * WHY THE OFFSET EXISTS. renderSvgFromHtml emits every node relative to the walked
 * node's top-left, so root (0,0) is that corner - which for an element TALLER than
 * the viewport and centred in it (the tool stage is `place-items:center`) sits above
 * the fold. Anchoring the window at 0,0 then publishes the off-screen band and cuts
 * the visible one: measured on a 944x2009 centred element at top=-554.5, the reader
 * sees local y 554.5-1454.5 while a top-anchored 900px window emitted 0-900.
 *
 * SIZE IS min(), NOT the frame. An element smaller than the recipe frame keeps its
 * own box rather than being padded out to it - padding would add a transparent ring
 * the subtree-scoped walk has no ink for, and the /info column never upscales
 * (docs/build.ts, `max-width: min(100%, 40em)`), so it would just publish smaller
 * content inside a bigger canvas.
 */
export function walkerWindow(
  nat: { w: number; h: number },
  frame: { w: number; h: number },
  off: { x: number; y: number },
): { x: number; y: number; w: number; h: number } {
  const w = Math.min(frame.w, nat.w);
  const h = Math.min(frame.h, nat.h);
  // Slide to the visible band, then clamp inside the box so the window is always a
  // sub-rect of what was actually walked - which is why no backdrop ring is needed.
  return {
    x: Math.min(Math.max(0, off.x), Math.max(0, nat.w - w)),
    y: Math.min(Math.max(0, off.y), Math.max(0, nat.h - h)),
    w,
    h,
  };
}

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
  /**
   * Declared output size in CSS px (windowPdfSvg's outWidth/outHeight), or null
   * when the frame is not derivable from the recipe. The print path windows a
   * full-page render, so its size IS viewport-minus-crop and a mismatch means the
   * window went wrong. A `walker=1` capture instead walks the cropSelector element
   * at its native size, so there is nothing to compare against - see the note at
   * the call site in build-docs-shots.ts.
   */
  expected: { width: number; height: number } | null;
  oldText?: string;
  oldBytes?: number;
}

/**
 * Recipes whose `tolerance=` cannot do anything, returned as slugs.
 *
 * `tolerance` sets ShotThresholds.pixelDiffFrac, and only classifyShot (raster)
 * reads it - a vector shot is compared as a DOCUMENT, by exact string equality
 * after stripping C2PA, so there is no fuzzy channel for it to widen. An author
 * who writes it on a `format=svg` recipe gets silence, not an effect.
 *
 * This is not hypothetical: the walker migration moved several shots to
 * `format=svg&walker=1` and carried their `tolerance=0.03` across unchanged - 
 * a tolerance they had *because* they frame wall-clock content (animated gallery
 * previews, a running timeline). Those now compare exactly and will report
 * `changed` on any run where the animation lands differently, with no way to say
 * so in the recipe. The remedy is a `css=` that freezes or hides the moving part;
 * this exists so the pipeline says that out loud instead of quietly ignoring the
 * parameter.
 */
export function ineffectiveTolerance(shots: ShotDef[]): string[] {
  return shots.filter((s) => s.format === 'svg' && s.pixelDiffFrac !== undefined).map((s) => s.slug);
}

/** Classify one true-vector capture against its committed baseline (if any). */
export function classifyVectorShot(c: VectorShotComparison, t: ShotThresholds = DEFAULT_THRESHOLDS): ShotVerdict {
  const flags: ShotFlag[] = [];
  if (c.newBytes < t.vectorMinBytes) flags.push('tiny');
  if (c.newBytes > t.vectorMaxBytes) flags.push('heavy');
  if (c.expected) {
    const size = svgRootSize(c.newText);
    if (!size ||
      Math.abs(size.width - c.expected.width) > t.dimSlack ||
      Math.abs(size.height - c.expected.height) > t.dimSlack
    ) {
      flags.push('dims-mismatch');
    }
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
  /** Output format of the committed baseline (svg default - a scalable wrapper). */
  format: 'svg' | 'png' | 'jpg';
  width?: number;
  height?: number;
  dpi?: number;
  /**
   * Walker-SVG only: DPI ceiling for INLINED raster assets (`<img>` bitmaps), decoupled
   * from `dpi` (the vector/own-paint resolution). Opt-in - when set, each embedded photo
   * is downscaled to its display box at this DPI (1x floor), replacing the full-resolution
   * source so a continuous-tone asset stops blowing the vector byte budget while the page
   * chrome stays crisp vector. `rasterDpi=96` = embed at exactly the rendered box.
   * Forwarded to renderSvgFromHtml via ExportOpts.rasterDpi; ignored on raster/print paths.
   */
  rasterDpi?: number;
  waitMs?: number;
  /**
   * Block the capture until this selector matches (after waitMs, before scroll or
   * serialisation). The deterministic settle for pages that signal readiness in the
   * DOM - e.g. the ?neuro demo stamps `data-demo-settled` when its fixed frame
   * sequence has rendered - where any waitMs is a guess about machine speed.
   */
  waitSelector?: string;
  css?: string;
  scrollDepth?: number;
  zoom?: number;
  cropLeft?: number;
  cropRight?: number;
  cropTop?: number;
  cropBottom?: number;
  /**
   * Crop to a single element by CSS selector - the capture measures its
   * bounding box (after css/scroll/wait) and derives the crop insets, so a
   * recipe can frame "just the Share dialog" without hand-computing fractions.
   * Overrides any explicit crop* values. Pipeline-only (resolved at capture).
   */
  /**
   * Pipeline-only: offer a link to the app route this shot was taken from, under
   * the picture. Opt-in per recipe, because "you can go and do this yourself" is
   * only true of some shots - a cropped control or an anatomy diagram is an
   * illustration, and a link on every one of 150 shots is furniture, not an offer.
   */
  tryIt?: boolean;
  cropSelector?: string;
  /**
   * Per-shot changed-vs-unchanged tolerance (fraction of differing pixels),
   * overriding ShotThresholds.pixelDiffFrac. For pages hosting wall-clock media
   * (APNG/SMIL/video card previews) whose animation phase CSS freezing can't pin - 
   * raise it just enough to absorb the flutter, never to paper over real change.
   */
  pixelDiffFrac?: number;
  /**
   * Capture this SVG shot with the web shell's OWN html->SVG walker
   * (`__lollyWalkerShot`, main.ts) instead of Chromium's printToPDF.
   *
   * WHY IT IS A CHOICE AND NOT THE DEFAULT. print is a black box: it flattens
   * anything it has no PDF primitive for, and PDF has no conic/angular shading
   * type at all, so a `repeating-conic-gradient` - the transparency checkerboard
   * on every tool stage - comes back as a full-canvas PNG (measured: 49 KB inside
   * a 518 KB shot, and 3.08 MB across the committed baselines). The walker emits
   * a real <pattern> instead, and plans/69-svg-snapshot-without-print.md measures it
   * 4-30x faster and 2-4x smaller with raster coverage on the tool fixtures cut
   * 86% -> 5%. What print still does better is anything the walker has not
   * implemented, so this stays opt-in per recipe until the corpus is migrated.
   * Ignored for raster formats - there is nothing to keep vector.
   */
  walker?: boolean;
  /**
   * Recipe opted into per-locale capture (`localize=1`): the pipeline also renders
   * it once per `--lang` locale with `?lang=<loc>` injected into the app route,
   * writing `<slug>.<loc>.<format>`. Only mark recipes whose app UI actually
   * localizes (chrome, labels) - tool-output shots don't change by language.
   */
  localize?: boolean;
  /**
   * Set on a per-locale capture VARIANT (never parsed from a recipe): the locale
   * whose `?lang=` is injected into `route` and whose code suffixes the output
   * filename. Absent on the canonical English shot.
   */
  lang?: string;
  /**
   * Recipe opted into a DARK twin (`dark=1`): the pipeline captures it a second
   * time with the app's theme and the OS preference both pinned dark, writing
   * `<slug>[.<loc>].dark.<format>`, and /info swaps the two as the reader toggles
   * the site theme. Worth it where the CHROME is the subject (a panel, the
   * sidebar, the timeline); pointless on a bare tool canvas, whose CSS is scoped
   * away from the theme tokens and renders identically either way.
   */
  dark?: boolean;
  /**
   * Set on a per-theme capture VARIANT (never parsed from a recipe), exactly like
   * `lang`: the theme pinned for this capture, and the suffix on its filename.
   * Absent on the canonical light shot.
   */
  theme?: 'dark';
  /**
   * Interactions to perform after the page settles and before the shot is taken
   * (`drive=` - see parseDriveSteps for the grammar). The states worth documenting
   * in an editor are mostly states a user CREATES: an open menu, a popover, a
   * dialog, a drag in flight. None of them exist in a freshly loaded page and none
   * of them can be faked with `css=`, because the app builds them on demand.
   */
  drive?: DriveStep[];
  /** The verbatim recipe URL as written in the markdown (identity for dedup). */
  raw: string;
}

/** One interaction - the same shape `packages/node-shell/src/url-capture.ts` runs. */
export type DriveStep =
  | { kind: 'click'; selector: string; button?: 'left' | 'right'; count?: number; at?: [number, number] }
  | { kind: 'hover'; selector: string; at?: [number, number] }
  | { kind: 'press'; keys: string; selector?: string }
  | { kind: 'drag'; selector: string; dx: number; dy: number; at?: [number, number]; hold?: boolean }
  | { kind: 'wait'; ms: number };

/** `at=0.42,0.5` - a point inside the target's box as fractions of its width/height. */
function parseAt(v: string): [number, number] | null {
  const [fx, fy] = v.split(',').map(Number);
  if (!Number.isFinite(fx) || !Number.isFinite(fy)) return null;
  return [Math.min(1, Math.max(0, fx!)), Math.min(1, Math.max(0, fy!))];
}

/**
 * Parse a recipe's `drive=` value: `;`-separated steps, each `kind:target` with
 * `|`-separated options after it.
 *
 *   click:.tl-onion                     left-click the first match
 *   click:.tl-ruler|at=0.42,0.5         click a POINT inside it (place a playhead)
 *   click:.tl-clip|right                context menu
 *   click:.tl-chip|double               double click
 *   hover:.tl-split                     pointer over it (reveals a data-tip bubble)
 *   press:Shift+O                       key to whatever has focus
 *   press:S|on=.tl-panel                focus that element first, then the key
 *   drag:.tl-clip|dx=90|at=0.99,0.15    press, move, release
 *   drag:.tl-clip|dx=90|hold            …and stay DOWN, for a mid-drag state
 *   wait:400                            extra settle
 *
 * `at=` exists because an element's CENTRE is often the wrong place to press: a
 * clip bar's middle is covered by its seam chip, and a ruler has to be clicked at
 * a time, not in the middle. It is fractions of the target's own box, so a recipe
 * never hardcodes viewport pixels.
 *
 * Deliberately small: a recipe should read as a description of what the reader is
 * being shown, not as a program. Anything it cannot express is a sign the app needs
 * a reachable state, not that the grammar needs a loop.
 */
export function parseDriveSteps(raw: string): { steps: DriveStep[]; problems: string[] } {
  const steps: DriveStep[] = [];
  const problems: string[] = [];
  for (const chunk of raw.split(';').map((s) => s.trim()).filter(Boolean)) {
    const colon = chunk.indexOf(':');
    if (colon < 1) { problems.push(`drive step "${chunk}": expected kind:target`); continue; }
    const kind = chunk.slice(0, colon).trim();
    const parts = chunk.slice(colon + 1).split('|').map((s) => s.trim());
    const target = parts[0] ?? '';
    const opts = new Map<string, string>();
    const flags = new Set<string>();
    for (const part of parts.slice(1)) {
      const eq = part.indexOf('=');
      if (eq > 0) opts.set(part.slice(0, eq).trim(), part.slice(eq + 1).trim());
      else if (part) flags.add(part);
    }
    let at: [number, number] | undefined;
    if (opts.has('at')) {
      const parsed = parseAt(opts.get('at')!);
      if (!parsed) { problems.push(`drive step "${chunk}": at= wants two fractions, e.g. at=0.4,0.5`); continue; }
      at = parsed;
    }
    switch (kind) {
      case 'click':
        if (!target) { problems.push(`drive step "${chunk}": needs a selector`); break; }
        steps.push({
          kind: 'click', selector: target,
          ...(flags.has('right') ? { button: 'right' as const } : {}),
          ...(flags.has('double') ? { count: 2 } : {}),
          ...(at ? { at } : {}),
        });
        break;
      case 'hover':
        if (!target) { problems.push(`drive step "${chunk}": needs a selector`); break; }
        steps.push({ kind: 'hover', selector: target, ...(at ? { at } : {}) });
        break;
      case 'press':
        if (!target) { problems.push(`drive step "${chunk}": needs a key`); break; }
        steps.push({ kind: 'press', keys: target, ...(opts.has('on') ? { selector: opts.get('on')! } : {}) });
        break;
      case 'drag': {
        const dx = Number(opts.get('dx') ?? 0), dy = Number(opts.get('dy') ?? 0);
        if (!target || !Number.isFinite(dx) || !Number.isFinite(dy) || (!dx && !dy)) {
          problems.push(`drive step "${chunk}": expected drag:<selector>|dx=<n>[|dy=<n>][|at=fx,fy][|hold]`);
          break;
        }
        steps.push({ kind: 'drag', selector: target, dx, dy, ...(at ? { at } : {}), ...(flags.has('hold') ? { hold: true } : {}) });
        break;
      }
      case 'wait': {
        const ms = Number(target);
        if (!Number.isFinite(ms) || ms < 0) { problems.push(`drive step "${chunk}": wait needs milliseconds`); break; }
        steps.push({ kind: 'wait', ms });
        break;
      }
      default:
        problems.push(`drive step "${chunk}": unknown kind "${kind}"`);
    }
  }
  return { steps, problems };
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
      continue; // identical duplicate - same shot referenced again
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
    const driveRaw = q.get('drive');
    let drive: DriveStep[] | undefined;
    if (driveRaw) {
      const parsed = parseDriveSteps(driveRaw);
      for (const p of parsed.problems) problems.push(`${at}: ${p}`);
      if (parsed.steps.length) drive = parsed.steps;
    }

    recipes.push({
      slug, route, raw,
      format: format as ShotDef['format'],
      width: num('width'), height: num('height'), dpi: num('dpi'), rasterDpi: num('rasterDpi'),
      waitMs: num('waitMs'), scrollDepth: num('scrollDepth'), zoom: num('zoom'),
      cropLeft: num('cropLeft'), cropRight: num('cropRight'),
      cropTop: num('cropTop'), cropBottom: num('cropBottom'),
      tryIt: q.get('try') === '1' || q.get('try') === 'true',
      cropSelector: q.get('cropSelector') ?? undefined,
      waitSelector: q.get('waitSelector') ?? undefined,
      css: q.get('css') ?? undefined,
      drive,
      pixelDiffFrac: tolerance,
      localize: q.get('localize') === '1' || q.get('localize') === 'true',
      dark: q.get('dark') === '1' || q.get('dark') === 'true',
      walker: q.get('walker') === '1' || q.get('walker') === 'true',
    });
  }
  return { recipes, problems };
}
