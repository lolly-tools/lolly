/**
 * host.text — text-to-path bridge primitive (HarfBuzz WASM backed).
 *
 * Replaces the opentype.js window global that lockup was reaching for.
 * One module-level HarfBuzz instance, one font-cache entry per URL.
 * The WASM loads on first call; subsequent calls are synchronous from cache.
 */

let _hb = null;

async function loadHarfBuzz() {
  if (!_hb) _hb = await import('harfbuzzjs');
  return _hb;
}

// fontUrl → { blob, face, font, upem }
// Kept alive so the FinalizationRegistry doesn't destroy them early.
const fontCache = new Map();

async function loadFont(fontUrl) {
  if (fontCache.has(fontUrl)) return fontCache.get(fontUrl);
  const hb = await loadHarfBuzz();

  const r = await fetch(fontUrl);
  if (!r.ok) throw new Error(`host.text: font fetch failed (${r.status}) ${fontUrl}`);

  const buf = new Uint8Array(await r.arrayBuffer());
  const blob = new hb.Blob(buf);
  const face = new hb.Face(blob);
  const upem = face.upem;
  const font = new hb.Font(face);
  // Keep blob + face alive alongside font — FinalizationRegistry would GC them otherwise.
  const entry = { blob, face, font, upem };
  fontCache.set(fontUrl, entry);
  return entry;
}

function fmt(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Transform a glyph path string from HarfBuzz font units (Y-up, origin at
 * glyph's pen+offset position) to SVG pixels (Y-down, baseline at y=0).
 *
 * offsetX, offsetY: glyph draw origin in font units (penX + xOffset, yOffset)
 * scale: pixels per font unit = fontSize / upem
 */
function transformPath(pathStr, offsetX, offsetY, scale) {
  return pathStr.replace(/([MLCQZ])([^MLCQZ]*)/g, (_, cmd, args) => {
    if (cmd === 'Z') return 'Z';
    const nums = args.match(/-?\d*\.?\d+(?:[eE][+-]?\d+)?/g);
    if (!nums) return cmd;
    const out = [];
    for (let i = 0; i + 1 < nums.length; i += 2) {
      out.push(
        `${fmt((+nums[i] + offsetX) * scale)},${fmt(-(+nums[i + 1] + offsetY) * scale)}`,
      );
    }
    return cmd + out.join(' ');
  });
}

export function createTextAPI() {
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
     */
    async toPath({ text, fontUrl, fontSize }) {
      if (!text || !text.trim()) {
        return { d: '', advanceWidth: 0, bbox: null };
      }

      const { font, upem } = await loadFont(fontUrl);
      const hb = _hb;
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
    },

    /** Warm the font cache without doing any shaping. Call fire-and-forget. */
    async preload(fontUrl) {
      await loadFont(fontUrl);
    },
  };
}
