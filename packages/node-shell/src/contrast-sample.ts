// SPDX-License-Identifier: MPL-2.0
/**
 * Text over a picture, measured (plan 291 M4 fix). The mounted audit cannot reduce an
 * image or gradient background to one colour, so it asks for a visual check. In the
 * render family the page is real, so the pixels under the text can be read: the text
 * is hidden, the rendered area under its lines is captured, and each text colour is
 * compared with every sampled pixel. When nearly all of the area fails the minimum,
 * the finding becomes `design.text.contrast-low` with the measured ratio. A background
 * that is partly light and partly dark keeps the visual-check note.
 *
 * `judgeSampledContrast` and `applySampledContrast` are pure; `sampleContrastReviews`
 * drives the page.
 */
import type { Page } from 'playwright-core';

/** One colour as 0-255 channels and alpha 0-1. */
export interface SampleRgba { r: number; g: number; b: number; a: number }

/** Share of the sampled area that must fail before the text is reported as low. */
export const SAMPLED_FAILING_SHARE = 0.85;

/** Fewer sampled pixels than this is not a measurement. */
export const SAMPLED_MIN_PIXELS = 24;

/** At most this many text layers are measured in one check. */
export const SAMPLED_MAX_LAYERS = 80;

/** The measuring stops after this long, in ms; the layers left keep their visual check. */
export const SAMPLED_BUDGET_MS = 90_000;

function channel(n: number): number {
  const s = n / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(r: number, g: number, b: number): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export interface SampledContrastVerdictV1 {
  /** True when at least SAMPLED_FAILING_SHARE of the sampled area fails for some text colour. */
  low: boolean;
  /** The median ratio for the worst text colour, rounded to one decimal. */
  ratio: number;
  /** Share of the sampled pixels under the minimum, for the worst text colour. */
  failing: number;
  /** Pixels compared. */
  pixels: number;
}

/**
 * Compare text colours with the pixels under them. `pixels` is RGBA, four bytes a
 * pixel, as `getImageData` gives it; pixels with alpha under 128 are skipped. A
 * translucent text colour is painted over each pixel before the ratio is taken.
 * Null when there are too few pixels or no colour to judge.
 */
export function judgeSampledContrast(
  pixels: ArrayLike<number>,
  colours: readonly SampleRgba[],
  minimum: number,
): SampledContrastVerdictV1 | null {
  const lums: number[] = [];
  const rgb: number[] = [];
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    if ((pixels[i + 3] ?? 0) < 128) continue;
    const r = pixels[i]!;
    const g = pixels[i + 1]!;
    const b = pixels[i + 2]!;
    rgb.push(r, g, b);
    lums.push(luminance(r, g, b));
  }
  if (lums.length < SAMPLED_MIN_PIXELS || !colours.length) return null;
  let worst: SampledContrastVerdictV1 | null = null;
  for (const colour of colours) {
    if (!(colour.a > 0)) continue;
    const ratios: number[] = [];
    let failing = 0;
    for (let p = 0; p < lums.length; p++) {
      const a = Math.min(1, colour.a);
      const fl = a >= 1
        ? luminance(colour.r, colour.g, colour.b)
        : luminance(colour.r * a + rgb[p * 3]! * (1 - a), colour.g * a + rgb[p * 3 + 1]! * (1 - a), colour.b * a + rgb[p * 3 + 2]! * (1 - a));
      const bl = lums[p]!;
      const ratio = (Math.max(fl, bl) + 0.05) / (Math.min(fl, bl) + 0.05);
      ratios.push(ratio);
      if (ratio + 0.005 < minimum) failing++;
    }
    ratios.sort((x, y) => x - y);
    const verdict: SampledContrastVerdictV1 = {
      low: failing / ratios.length >= SAMPLED_FAILING_SHARE,
      ratio: Math.round(ratios[Math.floor(ratios.length / 2)]! * 10) / 10,
      failing: failing / ratios.length,
      pixels: ratios.length,
    };
    if (!worst || verdict.failing > worst.failing) worst = verdict;
  }
  return worst;
}

/** A mounted finding as the page hook answers it (design-mounted-audit.ts). */
interface MountedFindingShape {
  id: string;
  severity: string;
  path: string;
  evidence: { name: string; reason?: string; ratio?: string; minimum?: string };
  message: string;
  layerId: string;
}

/** One text layer's measurement: the verdict and the minimum it was held to. */
export interface SampledLayerV1 { verdict: SampledContrastVerdictV1; minimum: number }

/** Is `finding` a visual-check note over an image or gradient background. */
export function isComplexContrastReview(finding: unknown): finding is MountedFindingShape {
  if (!finding || typeof finding !== 'object') return false;
  const f = finding as Partial<MountedFindingShape>;
  return f.id === 'design.text.contrast-review' && f.evidence?.reason === 'complex-background' && typeof f.layerId === 'string';
}

/**
 * The page hook's answer with each measured, clearly failing visual-check note turned
 * into `design.text.contrast-low` (evidence `reason: 'sampled-background'`). The
 * `checked.contrast` and `manualContrastReview` counts move with each raised note. Returns the
 * answer unchanged when nothing was measured low.
 */
export function applySampledContrast(value: unknown, sampled: ReadonlyMap<string, SampledLayerV1>): unknown {
  if (!value || typeof value !== 'object') return value;
  const answer = value as { mounted?: { findings?: unknown[]; checked?: Record<string, unknown>; manualContrastReview?: unknown } };
  const mounted = answer.mounted;
  if (!mounted || !Array.isArray(mounted.findings)) return value;
  let moved = 0;
  let measured = 0;
  const findings = mounted.findings.map((finding) => {
    if (!isComplexContrastReview(finding)) return finding;
    const sample = sampled.get(finding.layerId);
    if (!sample) return finding;
    measured++;
    if (!sample.verdict.low) return finding;
    moved++;
    const ratio = sample.verdict.ratio.toFixed(1);
    const minimum = sample.minimum.toFixed(1);
    return {
      id: 'design.text.contrast-low',
      severity: 'warn',
      path: finding.path,
      evidence: { name: finding.evidence.name, reason: 'sampled-background', ratio, minimum },
      message: `“${finding.evidence.name}” has about ${ratio}:1 contrast with the picture under it; this text needs at least ${minimum}:1.`,
      layerId: finding.layerId,
    };
  });
  if (!moved && !measured) return value;
  const checked = mounted.checked && typeof mounted.checked === 'object' ? { ...mounted.checked } : undefined;
  if (checked && moved) checked.contrast = (Number(checked.contrast) || 0) + moved;
  const review = typeof mounted.manualContrastReview === 'number' ? Math.max(0, mounted.manualContrastReview - moved) : mounted.manualContrastReview;
  return {
    ...answer,
    mounted: { ...mounted, findings, ...(checked ? { checked } : {}), ...(review !== undefined ? { manualContrastReview: review } : {}) },
    sampledContrast: { measured, low: moved },
  };
}

/** What the page reports about one text layer before its area is captured. */
interface LayerGeometry {
  clip: { x: number; y: number; width: number; height: number };
  colours: SampleRgba[];
  minimum: number;
}

const HIDE_STYLE_ID = 'lolly-check-contrast-sample';

/**
 * Measure every visual-check note over an image or gradient on the open Design canvas
 * and return the answer with the clearly failing ones raised (see `applySampledContrast`).
 * Any step that fails leaves that layer as a visual check; the page is left as found.
 */
export async function sampleContrastReviews(page: Page, value: unknown): Promise<unknown> {
  const findings = (value as { mounted?: { findings?: unknown[] } } | null)?.mounted?.findings;
  if (!Array.isArray(findings)) return value;
  const ids = [...new Set(findings.filter(isComplexContrastReview).map((f) => f.layerId))].slice(0, SAMPLED_MAX_LAYERS);
  if (!ids.length) return value;
  const sampled = new Map<string, SampledLayerV1>();
  try {
    // Hide every text run so neighbouring captions do not count as background.
    await page.evaluate((id) => {
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = '.lolly-box-text, .lolly-box-text * { visibility: hidden !important; caret-color: transparent !important; }';
      document.head.appendChild(style);
    }, HIDE_STYLE_ID);
    const deadline = Date.now() + SAMPLED_BUDGET_MS;
    for (const id of ids) {
      if (Date.now() > deadline) break;
      try {
        const box = page.locator(`.lolly-box[data-box-id="${id.replace(/["\\]/g, '\\$&')}"]`).first();
        if (!(await box.count())) continue;
        await box.scrollIntoViewIfNeeded({ timeout: 2_000 }).catch(() => {});
        const geometry = await box.evaluate((el): LayerGeometry | null => {
          const text = el.querySelector<HTMLElement>('.lolly-box-text');
          if (!text) return null;
          const range = document.createRange();
          range.selectNodeContents(text);
          const lines = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0);
          const outer = el.getBoundingClientRect();
          let x0 = Number.POSITIVE_INFINITY, y0 = Number.POSITIVE_INFINITY, x1 = Number.NEGATIVE_INFINITY, y1 = Number.NEGATIVE_INFINITY;
          for (const r of lines.length ? lines : [outer]) {
            x0 = Math.min(x0, r.left); y0 = Math.min(y0, r.top); x1 = Math.max(x1, r.right); y1 = Math.max(y1, r.bottom);
          }
          // The lines, kept inside the box and the viewport.
          x0 = Math.max(x0, outer.left, 0); y0 = Math.max(y0, outer.top, 0);
          x1 = Math.min(x1, outer.right, innerWidth); y1 = Math.min(y1, outer.bottom, innerHeight);
          if (!(x1 - x0 >= 2 && y1 - y0 >= 2)) return null;
          const parse = (value: string): { r: number; g: number; b: number; a: number } | null => {
            const m = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+)(%)?)?\s*\)$/.exec(value.trim());
            if (!m) return null;
            const raw = m[4] === undefined ? 1 : Number(m[4]);
            return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]), a: m[5] ? raw / 100 : raw };
          };
          const seen = new Map<string, { r: number; g: number; b: number; a: number }>();
          const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            if (!node.textContent?.trim() || !node.parentElement) continue;
            const colour = getComputedStyle(node.parentElement).color;
            const parsed = parse(colour);
            if (parsed) seen.set(colour, parsed);
          }
          const computed = getComputedStyle(text);
          const size = Number.parseFloat(computed.fontSize) || 16;
          const weight = Number.parseInt(computed.fontWeight, 10) || 400;
          const large = size >= 24 || (size >= 18.66 && weight >= 700);
          return { clip: { x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, colours: [...seen.values()], minimum: large ? 3 : 4.5 };
        });
        if (!geometry?.colours.length) continue;
        const png = await page.screenshot({ clip: geometry.clip, animations: 'disabled', caret: 'hide', scale: 'css', timeout: 30_000 });
        const pixels = await page.evaluate(async (b64: string) => {
          const bin = atob(b64);
          const bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          // At most about 4096 pixels travel back.
          const step = Math.max(1, Math.ceil(Math.sqrt((bitmap.width * bitmap.height) / 4096)));
          const w = Math.max(1, Math.floor(bitmap.width / step));
          const h = Math.max(1, Math.floor(bitmap.height / step));
          const canvas = new OffscreenCanvas(w, h);
          const ctx = canvas.getContext('2d');
          if (!ctx) return [];
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(bitmap, 0, 0, w, h);
          bitmap.close();
          return Array.from(ctx.getImageData(0, 0, w, h).data);
        }, Buffer.from(png).toString('base64'));
        const verdict = judgeSampledContrast(pixels, geometry.colours, geometry.minimum);
        if (verdict) sampled.set(id, { verdict, minimum: geometry.minimum });
      } catch {
        // This layer stays a visual check.
      }
    }
  } finally {
    await page.evaluate((id) => document.getElementById(id)?.remove(), HIDE_STYLE_ID).catch(() => {});
  }
  return applySampledContrast(value, sampled);
}
