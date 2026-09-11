// SPDX-License-Identifier: MPL-2.0
/**
 * host.text - text-to-path bridge primitive (HarfBuzz WASM backed).
 *
 * Replaces the opentype.js window global that lockup was reaching for.
 * One module-level HarfBuzz instance, one font-cache entry per URL.
 * The WASM loads on first call; subsequent calls are synchronous from cache.
 */

import type { TextAPI, TextPathCluster } from '@lolly-tools/core/host-v1';
import type { Blob as HbBlob, Face as HbFace, Font as HbFont, Feature as HbFeature } from 'harfbuzzjs';

type HarfBuzzModule = typeof import('harfbuzzjs');

let _hb: HarfBuzzModule | null = null;

async function loadHarfBuzz(): Promise<HarfBuzzModule> {
  if (!_hb) _hb = await import('harfbuzzjs');
  return _hb;
}

// fontUrl → { blob, face, upem }. Kept alive so the FinalizationRegistry doesn't
// destroy them early. One face per URL; a VARIABLE face then backs several Font
// instances, one per variation setting (see fontCache).
interface FaceEntry {
  blob: HbBlob;
  face: HbFace;
  upem: number;
  /** Codepoints this face has a glyph for (its cmap), read once and cached. */
  unicodes: Set<number>;
}

interface FontEntry {
  font: HbFont;
  upem: number;
  unicodes: Set<number>;
}

const faceCache = new Map<string, FaceEntry>();
const fontCache = new Map<string, FontEntry>();

async function loadFace(fontUrl: string): Promise<FaceEntry> {
  if (faceCache.has(fontUrl)) return faceCache.get(fontUrl)!;
  const hb = await loadHarfBuzz();

  const r = await fetch(fontUrl);
  if (!r.ok) throw new Error(`host.text: font fetch failed (${r.status}) ${fontUrl}`);

  const buf = new Uint8Array(await r.arrayBuffer());
  const blob = new hb.Blob(buf as unknown as ArrayBuffer);
  const face = new hb.Face(blob);
  const entry = { blob, face, upem: face.upem, unicodes: new Set(face.collectUnicodes()) };
  faceCache.set(fontUrl, entry);
  return entry;
}

/**
 * A shaped-ready Font for `fontUrl` at the given variation instance.
 *
 * `variations` are HarfBuzz axis strings (`'wght=700'`). Each distinct setting
 * gets its own cached Font over the SHARED face - hb_font_set_variations is
 * per-font state, so a bold and a regular run must not share one Font object.
 * Unparseable axis strings are dropped rather than throwing (a caller's typo
 * degrades to the default instance, it doesn't fail the export).
 */
async function loadFont(fontUrl: string, variations?: string[]): Promise<FontEntry> {
  const vars = Array.isArray(variations) ? variations.filter(v => typeof v === 'string') : [];
  const key = vars.length ? `${fontUrl}|${vars.join(',')}` : fontUrl;
  if (fontCache.has(key)) return fontCache.get(key)!;

  const { face, upem, unicodes } = await loadFace(fontUrl);
  const hb = _hb!;
  const font = new hb.Font(face);
  if (vars.length) {
    const parsed = vars.map(v => hb.Variation.fromString(v)).filter(Boolean);
    if (parsed.length) font.setVariations(parsed as NonNullable<ReturnType<typeof hb.Variation.fromString>>[]);
  }
  const entry = { font, upem, unicodes };
  fontCache.set(key, entry);
  return entry;
}

/**
 * Split `text` into maximal runs that one face in `chain` can draw, mirroring
 * how a browser resolves font fallback: keep the current face while it covers
 * the character, else take the first face in the chain that does. A character
 * NO face covers stays with the current face - it shapes as .notdef and gets
 * counted, so the caller can prefer its own fallback over a tofu outline.
 *
 * Whitespace never forces a face change (it carries no visible glyph).
 */
function segmentByFace(text: string, chain: FontEntry[]): Array<{ text: string; face: number }> {
  const segs: Array<{ text: string; face: number }> = [];
  let cur = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (!/\s/.test(ch) && !chain[cur]!.unicodes.has(cp)) {
      const next = chain.findIndex(f => f.unicodes.has(cp));
      if (next !== -1) cur = next;
    }
    const last = segs[segs.length - 1];
    if (last && last.face === cur) last.text += ch;
    else segs.push({ text: ch, face: cur });
  }
  return segs;
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
  return pathStr.replace(/([MLCQZ])([^MLCQZ]*)/g, (_: string, cmd: string, args: string) => {
    if (cmd === 'Z') return 'Z';
    const nums = args.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
    if (!nums) return cmd;
    const out: string[] = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      out.push(
        `${fmt((+nums[i]! + offsetX) * scale)},${fmt(-(+nums[i + 1]! + offsetY) * scale)}`,
      );
    }
    return cmd + out.join(' ');
  });
}

/**
 * Order the accumulated per-cluster pieces into the `TextPathCluster[]` contract
 * (plans/175 WP-D): logical order by start offset, each piece's `end` being the
 * next piece's start (so a ligature that swallowed its neighbours spans them) and
 * the last running to the text's end. Shared verbatim by the Node-shell port.
 */
export function clustersFrom(
  pieces: Map<number, { d: string; x: number; advance: number }>, textLength: number,
): TextPathCluster[] {
  const starts = [...pieces.keys()].sort((a, b) => a - b);
  return starts.map((start, i) => {
    const p = pieces.get(start)!;
    return { start, end: i + 1 < starts.length ? starts[i + 1]! : textLength, d: p.d, x: fmt(p.x), advance: fmt(p.advance) };
  });
}

export function createTextAPI(): TextAPI {
  return {
    /**
     * Shape `text` using the given font at `fontSize` px and return an SVG path.
     *
     * Returned `d`:
     *   - Baseline at y=0 (ascenders have negative y, descenders positive y)
     *   - X advances from 0; bbox.x1 may be slightly positive (left bearing)
     *   - SVG coordinate system (Y-down)
     *   - All glyphs concatenated into one path string
     *
     * `advanceWidth`: total pen advance in pixels.
     * `bbox`:         tight glyph bounding box in pixels, or null for blank runs.
     * `notdef`:       glyphs no face in the chain covered (see TextPathResult).
     *
     * With `fallbackFonts`, the run is split into maximal single-face segments
     * (see segmentByFace) and each is shaped by its own face, the pen carried
     * across in PIXELS - faces may differ in units-per-em, so nothing else is
     * comparable between them. Shaping per segment means no kerning across a
     * face boundary, exactly as in a browser.
     */
    async toPath({ text, fontUrl, fontSize, features, letterSpacing = 0, variations, fallbackFonts, clusters: wantClusters }) {
      if (!text || !text.trim()) {
        return { d: '', advanceWidth: 0, bbox: null, notdef: 0, ...(wantClusters ? { clusters: [] } : {}) };
      }

      const chain = [
        await loadFont(fontUrl, variations),
        ...await Promise.all((fallbackFonts ?? []).map(f => loadFont(f.fontUrl, f.variations))),
      ];
      const hb = _hb!;

      // OpenType feature toggles (e.g. 'liga=0', 'salt=1') let a caller disable
      // ligatures or enable stylistic alternates; HarfBuzz applies kern + standard
      // ligatures by default, so the common case passes nothing.
      const feats = Array.isArray(features)
        ? features.map((f) => hb.Feature.fromString(f)).filter(Boolean)
        : [];

      let penPx = 0;
      let d = '';
      let notdef = 0;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      // Per-cluster accumulation (plans/175 WP-D), keyed by the cluster's ABSOLUTE
      // UTF-16 start in `text` (HarfBuzz cluster values are segment-relative).
      const pieces = wantClusters ? new Map<number, { d: string; x: number; advance: number }>() : null;
      let segStart = 0;

      for (const seg of segmentByFace(text, chain)) {
        const { font, upem } = chain[seg.face]!;
        const scale = fontSize / upem;
        // letter-spacing is given in px; convert to font units to add to the pen advance.
        const lsUnits = Number.isFinite(letterSpacing) && letterSpacing ? letterSpacing / scale : 0;
        // Where this segment starts, expressed in THIS face's units.
        const originUnits = penPx / scale;

        const buf = new hb.Buffer();
        buf.addText(seg.text);
        buf.guessSegmentProperties();
        hb.shape(font, buf, feats.length ? (feats as HbFeature[]) : undefined);

        let penX = 0;
        for (const g of buf.getGlyphInfosAndPositions()) {
          const {
            codepoint: glyphId,
            cluster = 0,
            xAdvance = 0,
            xOffset  = 0,
            yOffset  = 0,
          } = g;

          // Glyph 0 is .notdef by OpenType definition - no face in the chain has
          // the character. Counted, not thrown: the caller decides whether a tofu
          // outline is worse than its <text> fallback.
          if (glyphId === 0) notdef++;

          const ox = originUnits + penX + xOffset;
          const oy = yOffset;

          const rawPath = font.glyphToPath(glyphId);
          const glyphD = rawPath ? transformPath(rawPath, ox, oy, scale) : '';
          if (glyphD) d += glyphD;
          if (pieces) {
            const key = segStart + cluster;
            const piece = pieces.get(key);
            const penPxHere = (originUnits + penX) * scale;
            const advPx = (xAdvance + lsUnits) * scale;
            if (piece) { piece.d += glyphD; piece.advance += advPx; if (penPxHere < piece.x) piece.x = penPxHere; }
            else pieces.set(key, { d: glyphD, x: penPxHere, advance: advPx });
          }

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

          penX += xAdvance + lsUnits;   // uniform tracking after every glyph (CSS-style)
        }
        penPx += penX * scale;
        segStart += seg.text.length;
      }

      return {
        d,
        advanceWidth: penPx,
        bbox: x1 !== Infinity ? { x1, y1, x2, y2 } : null,
        notdef,
        ...(pieces ? { clusters: clustersFrom(pieces, text.length) } : {}),
      };
    },

    /** Warm the font cache without doing any shaping. Call fire-and-forget. */
    async preload(fontUrl) {
      await loadFace(fontUrl);
    },

    /** The font's variable-axis defaults (tag → value), `{}` for a static font.
     *  Lets a caller embedding the raw file elsewhere (jsPDF, which has no axis
     *  control) know which instance it will actually get. */
    async axisDefaults(fontUrl) {
      const { face } = await loadFace(fontUrl);
      const out: Record<string, number> = {};
      const infos = face.getAxisInfos();
      for (const [tag, info] of Object.entries(infos)) out[tag] = info.default;
      return out;
    },

    /**
     * Resolve a font FAMILY to a fetchable sfnt via the shell's registry - 
     * brand-catalog statics, user-uploaded/Google faces, then the platform SUSE face
     * (v1.60). There is no run text at resolve time, so faces are ranked
     * against a basic-latin sample; the chain's primary face is returned and
     * sibling unicode subsets are dropped (the contract is one file - a caller
     * shaping non-latin keeps its own fallback via toPath's `notdef`). Lazily
     * imported so hosts that only ever shape explicit fontUrls never pull the
     * registry (and its IndexedDB dependency) into their path.
     */
    async fontUrl(family, opts) {
      if (typeof family !== 'string' || !family.trim()) return null;
      const { resolveVectorFont } = await import('./font-registry.ts');
      const vf = await resolveVectorFont({
        fontFamily: family,
        fontWeight: String(opts?.weight ?? 400),
        fontStyle: opts?.italic ? 'italic' : 'normal',
      }, 'AaBb0123');
      if (!vf) return null;
      return { url: vf.url, ...(vf.variations ? { variations: vf.variations } : {}) };
    },
  };
}
