// SPDX-License-Identifier: MPL-2.0
/**
 * Print-PDF → self-contained true-vector SVG, for the docs-screenshot pipeline
 * (scripts/build-docs-shots.ts drives this via the loopback-only window hook in
 * main.ts). Mirrors the desktop bridge's capture.vector(): a Chromium print of an
 * app page runs through the SAME interpreter a .ai/.pdf upload takes
 * (views/pdf-import.ts → engine pdfNodesToSvg), so boxes, fills, paths and images
 * come back as real vectors - not a screenshot in a scalable box.
 *
 * Text is OUTLINED to real <path>s by default (the same HarfBuzz path the SVG
 * export uses - resolveVectorFont + host.text.toPath), so a shot is pixel-faithful
 * and needs no fonts at render time: an <img>-embedded SVG runs in secure static
 * mode and can't fetch webfonts, so un-outlined <text> would fall back to
 * sans-serif. Any run we can't outline (a font we can't resolve, an uncovered
 * glyph) stays <text>, and embedFonts still inlines the app's own @font-face for
 * those as a safety net - so nothing is ever lost, it just isn't scalable text.
 */
import { openPdfFile } from '../views/pdf-import.ts';
import { resolveVectorFont, type VectorFont } from '../bridge/font-registry.ts';
import type { CullWindow } from '../../../../engine/src/pdf-svg.ts';

/** The slice of the host this module needs: the HarfBuzz text shaper. */
/* Method shorthand on purpose: it checks bivariantly, so the host bridge's real
   TextAPI (whose toPath takes TextToPathOpts, not unknown) is assignable. */
interface TextApi { toPath(o: unknown): Promise<{ d: string; notdef?: number }> }
interface OutlineHost { text?: TextApi }

export interface VectorShotResult {
  svg: string;
  /** Page size in the SVG's own units (PDF points). */
  width: number;
  height: number;
  /** Drawable nodes the interpreter found - 0 means the print was blank. NOT
   *  reduced by `cropCssPx`; see PdfPageSvg.elementCount. */
  elementCount: number;
  warnings: string[];
  /** Crop-cull telemetry when `cropCssPx` was given and the interpreter reported it. */
  culled?: { total: number; dropped: number; unbounded: number };
}

export interface VectorShotOpts {
  /**
   * The region the caller is actually going to keep, in CSS pixels of the printed
   * page (x/y measured from the top-left of the FULL printed page, i.e. scroll
   * offset already folded in). Nodes that provably cannot paint inside it are
   * dropped straight after interpretation - before raster decode, shading-tile
   * rasterisation and text outlining, which is where a cropped capture spends its
   * bytes and its seconds.
   *
   * A pure size/time optimisation: it does NOT set the viewBox (windowPdfSvg does,
   * and it stays the exact, authoritative re-framing), and any node whose extent
   * can't be bounded is kept. Callers derive this rect and the windowPdfSvg rect
   * from ONE crop so they cannot disagree.
   */
  cropCssPx?: { x: number; y: number; width: number; height: number };
}

/** Subset-tagged PDF font names ("ABCDEF+Outfit-Bold") → base name. */
function baseFontName(pdfFamily: string): string {
  return pdfFamily.replace(/^[A-Z]{6}\+/, '').trim();
}

/**
 * Candidate CSS family names for a PDF BaseFont: the name as-is, then with the
 * style suffix split off ("Outfit-SemiBold" → "Outfit"). PDFs flatten a family's
 * styles into the font name; CSS keeps family + weight separate.
 */
function familyCandidates(pdfFamily: string): string[] {
  const base = baseFontName(pdfFamily);
  const out = [base];
  const m = base.match(/^(.+?)[-_ ](?:Thin|ExtraLight|Light|Regular|Book|Medium|SemiBold|DemiBold|Bold|ExtraBold|Black|Heavy|Italic|Oblique)+$/i);
  if (m?.[1]) out.push(m[1]);
  return out;
}

/** Every same-origin @font-face rule for a family (case-insensitive match). */
function fontFaceRulesFor(family: string): CSSFontFaceRule[] {
  const want = family.toLowerCase();
  const rules: CSSFontFaceRule[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try { list = sheet.cssRules; } catch { continue; } // cross-origin sheet
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSFontFaceRule) {
        const fam = rule.style.getPropertyValue('font-family').replace(/^["']|["']$/g, '').trim().toLowerCase();
        if (fam === want) rules.push(rule);
      }
    }
  }
  return rules;
}

/** First same-origin URL in a @font-face src list (skips local()). */
function srcUrl(rule: CSSFontFaceRule): string | null {
  const src = rule.style.getPropertyValue('src');
  const m = src.match(/url\((["']?)([^)"']+)\1\)/);
  return m?.[2] ?? null;
}

async function toDataUri(url: string): Promise<string | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = new Uint8Array(await resp.arrayBuffer());
    let bin = '';
    for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    const ext = url.split('?')[0]!.split('.').pop()!.toLowerCase();
    const mime = ext === 'woff2' ? 'font/woff2' : ext === 'woff' ? 'font/woff' : ext === 'otf' ? 'font/otf' : 'font/ttf';
    return `data:${mime};base64,${btoa(bin)}`;
  } catch {
    return null;
  }
}

/**
 * Inline every font family the SVG's <text> nodes reference. Families that
 * resolve to a loaded @font-face get their file embedded and the svg's
 * font-family attributes rewritten to the CSS family name (stabilising any
 * per-print subset naming); families with no match are left on their
 * sans-serif fallback and reported as warnings.
 */
export async function embedFonts(svg: string, warnings: string[]): Promise<string> {
  const families = new Set<string>();
  for (const m of svg.matchAll(/font-family="([^",]+)/g)) families.add(m[1]!.trim());

  const faces: string[] = [];
  const seenSrc = new Set<string>();
  const rewrites = new Map<string, string>();
  for (const pdfFamily of families) {
    const rules = familyCandidates(pdfFamily)
      .map((c) => ({ c, rules: fontFaceRulesFor(c) }))
      .find((r) => r.rules.length);
    if (!rules) {
      if (!/^(sans-serif|serif|monospace|system-ui)$/i.test(pdfFamily)) {
        warnings.push(`no loaded @font-face for "${pdfFamily}" - falls back to sans-serif`);
      }
      continue;
    }
    if (rules.c !== pdfFamily) rewrites.set(pdfFamily, rules.c);
    for (const rule of rules.rules) {
      const url = srcUrl(rule);
      if (!url || seenSrc.has(url)) continue;
      seenSrc.add(url);
      const data = await toDataUri(url);
      if (!data) { warnings.push(`couldn't inline ${url}`); continue; }
      const weight = rule.style.getPropertyValue('font-weight') || 'normal';
      const style = rule.style.getPropertyValue('font-style') || 'normal';
      faces.push(`@font-face{font-family:'${rules.c}';src:url(${data});font-weight:${weight};font-style:${style};}`);
    }
  }

  let out = svg;
  for (const [from, to] of rewrites) {
    out = out.replaceAll(`font-family="${from}`, `font-family="${to}`);
  }
  if (faces.length) {
    out = out.replace(/(<svg[^>]*>)/, `$1<defs><style>${faces.join('')}</style></defs>`);
  }
  return out;
}

// ── Raster re-sourcing ────────────────────────────────────────────────────────
//
// The print → PDF → interpret round-trip re-encodes every raster on the page,
// and some encodings don't survive (webp previews, patterns). But the ORIGINALS
// are right here in the live DOM. So: inventory every visible <img> and <canvas>
// (document-space rect + original bytes - webp stays webp; a canvas gives its
// live pixels), then let the interpreter substitute each image node whose
// geometry matches, keeping z-order and losing nothing to transcoding.

/** Chromium prints CSS pixels at exactly 72/96 pt. */
const PT_PER_PX = 0.75;

interface DomRaster { x: number; y: number; w: number; h: number; uri: string }

async function srcToDataUri(src: string): Promise<string | null> {
  if (src.startsWith('data:')) return src;
  try {
    const resp = await fetch(src);
    if (!resp.ok) return null;
    const blob = await resp.blob();
    return await new Promise<string | null>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = () => res(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

async function collectDomRasters(warnings: string[]): Promise<DomRaster[]> {
  const out: DomRaster[] = [];
  const sx = window.scrollX, sy = window.scrollY;
  const push = (rect: DOMRect, uri: string | null): void => {
    if (uri && rect.width >= 4 && rect.height >= 4) {
      out.push({ x: rect.left + sx, y: rect.top + sy, w: rect.width, h: rect.height, uri });
    }
  };
  for (const img of Array.from(document.images)) {
    if (!img.currentSrc || !img.complete) continue;
    const rect = img.getBoundingClientRect();
    if (rect.width) push(rect, await srcToDataUri(img.currentSrc));
  }
  for (const canvas of Array.from(document.querySelectorAll('canvas'))) {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) continue;
    try { push(rect, canvas.toDataURL('image/png')); } catch { warnings.push('a tainted canvas keeps its PDF-decoded pixels'); }
  }
  return out;
}

/** Best inventory hit for an image node's CSS-px rect - centre and size must
 *  both agree within a few px, so unrelated rasters can never swap in. */
function matchRaster(rasters: DomRaster[], rect: { x: number; y: number; w: number; h: number }): string | null {
  let best: DomRaster | null = null;
  let bestScore = Infinity;
  const tolW = Math.max(3, rect.w * 0.04), tolH = Math.max(3, rect.h * 0.04);
  for (const r of rasters) {
    const dx = Math.abs(r.x + r.w / 2 - (rect.x + rect.w / 2));
    const dy = Math.abs(r.y + r.h / 2 - (rect.y + rect.h / 2));
    const dw = Math.abs(r.w - rect.w), dh = Math.abs(r.h - rect.h);
    if (dx > tolW || dy > tolH || dw > tolW || dh > tolH) continue;
    const score = dx + dy + dw + dh;
    if (score < bestScore) { bestScore = score; best = r; }
  }
  return best?.uri ?? null;
}

/**
 * A text-run outliner backed by the app's own shaper (host.text.toPath) and font
 * resolver (resolveVectorFont, decompressing woff2→sfnt as HarfBuzz needs). One
 * VectorFont per (family, weight) is cached - a page has few distinct faces but
 * hundreds of runs. Returns per-line path `d`, or null to keep the <text>
 * fallback (font unresolved, or any glyph uncovered by the whole fallback chain).
 */
export function makeTextOutliner(warnings: string[], textApi?: TextApi): (run: { text: string; fontFamily: string; fontWeight: string | number; fontSize: number }) => Promise<string[] | null> {
  if (!textApi?.toPath) { warnings.push('no text shaper - text kept as <text>'); return async () => null; }

  const fontCache = new Map<string, VectorFont | null>();
  const resolveFont = async (family: string, weight: string | number, text: string): Promise<VectorFont | null> => {
    const key = `${family}|${weight}`;
    if (fontCache.has(key)) return fontCache.get(key)!;
    let vf: VectorFont | null = null;
    try {
      vf = await resolveVectorFont({ fontFamily: `${family}, sans-serif`, fontWeight: String(weight), fontStyle: 'normal' }, text);
    } catch { vf = null; }
    fontCache.set(key, vf);
    return vf;
  };

  return async ({ text, fontFamily, fontWeight, fontSize }) => {
    const vf = await resolveFont(fontFamily, fontWeight, text);
    if (!vf?.url) return null;
    const lines: string[] = [];
    for (const line of text.split('\n')) {
      if (!line.trim()) { lines.push(''); continue; }   // blank line keeps the line index
      try {
        const r = await textApi.toPath({ text: line, fontUrl: vf.url, fontSize, variations: vf.variations, fallbackFonts: vf.fallbacks });
        if (!r.d || r.notdef) return null;               // uncovered glyph → keep <text> for the whole run
        lines.push(r.d);
      } catch { return null; }
    }
    return lines;
  };
}

/** A CSS-px crop → the same rect in the printed page's own point space. Chromium
 *  prints CSS pixels at exactly 72/96 pt, so this is exact, not a calibration. */
function cullWindowFor(crop: VectorShotOpts['cropCssPx']): CullWindow | undefined {
  if (!crop) return undefined;
  const { x, y, width, height } = crop;
  if (![x, y, width, height].every((v) => typeof v === 'number' && isFinite(v))) return undefined;
  if (!(width > 0) || !(height > 0)) return undefined;
  return { x: x * PT_PER_PX, y: y * PT_PER_PX, width: width * PT_PER_PX, height: height * PT_PER_PX };
}

/** Convert one printed page (base64 PDF) to a standalone vector SVG. `host` (the
 *  app's live bridge) supplies the text shaper used to outline text to <path>. */
export async function pdfToVectorSvg(b64: string, host?: OutlineHost, opts: VectorShotOpts = {}): Promise<VectorShotResult> {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const warnings: string[] = [];
  const rasters = await collectDomRasters(warnings);
  const outlineText = makeTextOutliner(warnings, host?.text);
  const handle = await openPdfFile(new Blob([bytes], { type: 'application/pdf' }));
  const cull = cullWindowFor(opts.cropCssPx);
  const page = await handle.pageToSvg(0, {
    warn: (msg) => warnings.push(msg),
    outlineText,
    // A docs shot is TERMINAL output - it is written to a file and shown in an
    // <img>, never re-exported - so it can hoist repeated path data into
    // <defs>/<use>. That matters here because Chromium prints a dashed border as
    // four separately-clipped copies of the whole dash ring: 37% of a brand-studio
    // capture, 50% of a logo-grid one. Asset ingest must NOT set this (svg-ir's
    // EMF/EPS/DXF path skips <use>) - see PdfPageSvgOpts.dedupePaths.
    dedupePaths: true,
    resolveImage: (rect) => matchRaster(rasters, {
      x: rect.x / PT_PER_PX, y: rect.y / PT_PER_PX, w: rect.w / PT_PER_PX, h: rect.h / PT_PER_PX,
    }),
    // Only passed when there IS a crop: pdf-import applies it right after
    // interpretation, i.e. before raster inlining, tile rasterisation and text
    // outlining - which is where a cropped capture spends its bytes and seconds.
    // See the crop-culling notes in engine/src/pdf-svg.ts for why this is a
    // separate, conservative rect and not windowPdfSvg's authoritative one.
    ...(cull ? { cull } : {}),
  });
  // embedFonts is now a safety net: it only matters for runs that stayed <text>
  // (outlineText returned null). Fully-outlined pages carry no <text> and no fonts.
  const svg = await embedFonts(page.svg, warnings);
  const culled = page.culled;
  return {
    svg, width: page.width, height: page.height, elementCount: page.elementCount, warnings,
    ...(culled ? { culled } : {}),
  };
}
