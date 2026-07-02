// SPDX-License-Identifier: MPL-2.0
/**
 * host.text — text-to-path bridge primitive (HarfBuzz WASM backed).
 *
 * Replaces the opentype.js window global that lockup was reaching for.
 * One module-level HarfBuzz instance, one font-cache entry per URL.
 * The WASM loads on first call; subsequent calls are synchronous from cache.
 */

import type { TextAPI, TextPathResult } from '../../../../engine/src/bridge/host-v1.ts';
import type { Blob as HbBlob, Face as HbFace, Font as HbFont } from 'harfbuzzjs';

type HarfBuzzModule = typeof import('harfbuzzjs');

let _hb: HarfBuzzModule | null = null;

/** Load (once) and return the HarfBuzz WASM module. Exported so tests can
 *  drive the exact production shaping path without going through toPath's
 *  network fetch. */
export async function loadHarfBuzz(): Promise<HarfBuzzModule> {
  if (!_hb) _hb = await import('harfbuzzjs');
  return _hb;
}

/** One cache entry per font URL. blob + face are kept alive alongside font —
 *  the FinalizationRegistry would destroy them early otherwise. */
interface FontEntry {
  blob: HbBlob;
  face: HbFace;
  font: HbFont;
  upem: number;
}

const fontCache = new Map<string, FontEntry>();

/**
 * Build a HarfBuzz font entry from already-fetched bytes. Exported (in
 * addition to loadFont's network path below) so tests can drive the exact
 * production font-loading + shaping code with a font read straight off disk —
 * no fetch, no DOM, no test double standing in for HarfBuzz itself.
 */
export function fontEntryFromBytes(hb: HarfBuzzModule, bytes: Uint8Array<ArrayBuffer>): FontEntry {
  const blob = new hb.Blob(bytes.buffer);
  const face = new hb.Face(blob);
  const upem = face.upem;
  const font = new hb.Font(face);
  // Keep blob + face alive alongside font — FinalizationRegistry would GC them otherwise.
  return { blob, face, font, upem };
}

async function loadFont(fontUrl: string): Promise<FontEntry> {
  const cached = fontCache.get(fontUrl);
  if (cached) return cached;
  const hb = await loadHarfBuzz();

  const r = await fetch(fontUrl);
  if (!r.ok) throw new Error(`host.text: font fetch failed (${r.status}) ${fontUrl}`);

  const buf = new Uint8Array(await r.arrayBuffer());
  const entry = fontEntryFromBytes(hb, buf);
  fontCache.set(fontUrl, entry);
  return entry;
}

function fmt(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Transform a glyph path string from HarfBuzz font units (Y-up, origin at
 * glyph's pen+offset position) to SVG pixels (Y-down, baseline at y=0).
 *
 * offsetX, offsetY: glyph draw origin in font units (penX + xOffset, yOffset)
 * scale: pixels per font unit = fontSize / upem
 */
function transformPath(pathStr: string, offsetX: number, offsetY: number, scale: number): string {
  return pathStr.replace(/([MLCQZ])([^MLCQZ]*)/g, (_, cmd: string, args: string) => {
    if (cmd === 'Z') return 'Z';
    const nums = args.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
    if (!nums) return cmd;
    const out: string[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      if (x === undefined || y === undefined) break;
      out.push(`${fmt((+x + offsetX) * scale)},${fmt(-(+y + offsetY) * scale)}`);
    }
    return cmd + out.join(' ');
  });
}

/**
 * Shape `text` with an already-loaded HarfBuzz font and return an SVG path.
 * The real algorithm behind TextAPI.toPath, factored out so it can run
 * against a font loaded any way (network fetch in production, `fs.readFile`
 * in a test) — this function itself does no I/O.
 *
 * Returned `d`:
 *   - Baseline at y=0 (ascenders have negative y, descenders positive y)
 *   - X advances from 0; bbox.x1 may be slightly positive (left bearing)
 *   - SVG coordinate system (Y-down)
 *   - All glyphs concatenated into one path string
 *
 * `advanceWidth`: total pen advance in pixels.
 * `bbox`:         tight glyph bounding box in pixels, or null for blank runs.
 */
export function shapeTextToPath(
  hb: HarfBuzzModule,
  font: HbFont,
  upem: number,
  text: string,
  fontSize: number,
): TextPathResult {
  if (!text || !text.trim()) {
    return { d: '', advanceWidth: 0, bbox: null };
  }

  const scale = fontSize / upem;

  const buf = new hb.Buffer();
  buf.addText(text);
  buf.guessSegmentProperties();
  hb.shape(font, buf);

  const glyphs = buf.getGlyphInfosAndPositions();

  let penX = 0;
  let d = '';
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

  for (const g of glyphs) {
    const {
      codepoint: glyphId,
      xAdvance = 0,
      xOffset  = 0,
      yOffset  = 0,
    } = g;

    const ox = penX + xOffset;
    const oy = yOffset;

    const rawPath = font.glyphToPath(glyphId);
    if (rawPath) d += transformPath(rawPath, ox, oy, scale);

    // Bbox from glyph extents (cheaper than parsing the transformed path).
    const ext = font.glyphExtents(glyphId);
    if (ext) {
      const bx1 = (ox + ext.xBearing) * scale;
      const bx2 = (ox + ext.xBearing + ext.width) * scale;
      // HarfBuzz Y-up: yBearing > 0 above baseline; height < 0 going down.
      const by1 = -(oy + ext.yBearing) * scale;
      const by2 = -(oy + ext.yBearing + ext.height) * scale;
      if (bx1 < x1) x1 = bx1;
      if (by1 < y1) y1 = by1;
      if (bx2 > x2) x2 = bx2;
      if (by2 > y2) y2 = by2;
    }

    penX += xAdvance;
  }

  return {
    d,
    advanceWidth: penX * scale,
    bbox: x1 !== Infinity ? { x1, y1, x2, y2 } : null,
  };
}

export function createTextAPI(): TextAPI {
  return {
    /** See shapeTextToPath — this just resolves fontUrl to a loaded font first. */
    async toPath({ text, fontUrl, fontSize }) {
      const { font, upem } = await loadFont(fontUrl);
      const hb = await loadHarfBuzz(); // already resolved by loadFont; never re-imports
      return shapeTextToPath(hb, font, upem, text, fontSize);
    },

    /** Warm the font cache without doing any shaping. Call fire-and-forget. */
    async preload(fontUrl) {
      await loadFont(fontUrl);
    },
  };
}
