// SPDX-License-Identifier: MPL-2.0
/**
 * host.text (Node) — text-to-path bridge primitive for the CLI + TUI.
 *
 * A faithful port of the web shell's createTextAPI (shells/web/src/bridge/text.ts):
 * the SAME HarfBuzz-WASM shaping, so a tool that outlines text via host.text renders
 * byte-for-byte the same in the terminal as in the browser. HarfBuzz loads in Node
 * unchanged (its emscripten glue reads harfbuzz.wasm via fs when ENVIRONMENT_IS_NODE);
 * the ONLY difference from the web module is how a font URL becomes bytes — the browser
 * fetches it from the origin, here we read it off disk under the repo root.
 *
 * This is what makes brand-lockup (and any host.text-in-hooks tool) render in the Node
 * shells instead of silently emitting an empty SVG — see the P2 gap in the shell audit.
 *
 * Scope (deliberate first increment): sfnt fonts only (ttf/otf), which is every
 * font a headless shell can reach — brand-lockup's tool-local SUSE-*.otf, the catalog
 * SUSE-*.ttf statics, and the Outfit platform face. woff2 (browser IndexedDB / Google
 * Fonts) is unreachable headlessly and rejected with a clear error rather than silently
 * shaping .notdef.
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { TextAPI } from '@lolly-tools/core/host-v1';
import type { Blob as HbBlob, Face as HbFace, Font as HbFont, Feature as HbFeature } from 'harfbuzzjs';

type HarfBuzzModule = typeof import('harfbuzzjs');

let _hb: HarfBuzzModule | null = null;

async function loadHarfBuzz(): Promise<HarfBuzzModule> {
  // Lazy: attaching host.text costs nothing until a tool actually shapes text, so
  // shells/tools that never outline text pull no WASM.
  if (!_hb) _hb = await import('harfbuzzjs');
  return _hb;
}

// fontUrl → { blob, face, upem, unicodes }. Kept alive so the FinalizationRegistry
// doesn't destroy them early. One face per URL; a VARIABLE face then backs several
// Font instances, one per variation setting (see fontCache).
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

/**
 * Resolve a font URL to its bytes on disk (the Node analogue of the web module's
 * `fetch(fontUrl)`). Handles the forms a tool/hook actually produces:
 *   • `data:` URI            → decoded inline bytes
 *   • `http(s)://`           → global fetch (Node ≥18)
 *   • `file://`              → the pointed-at file
 *   • rooted `/tools/…`, `/catalog/…`, `/fonts/…` → disk under the repo root
 *     (`/fonts/…` also falls back to the web shell's public dir — where the Outfit
 *      platform face lives — mirroring shells/cli/src/bridge.ts's asset resolution)
 *   • bare relative          → resolved under the repo root
 */
async function loadFontBytes(fontUrl: string, repoRoot: string): Promise<Uint8Array> {
  if (fontUrl.startsWith('data:')) {
    const comma = fontUrl.indexOf(',');
    if (comma === -1) throw new Error(`host.text (node): malformed data: font URL`);
    const meta = fontUrl.slice(5, comma);
    const data = fontUrl.slice(comma + 1);
    const buf = /;base64/i.test(meta) ? Buffer.from(data, 'base64') : Buffer.from(decodeURIComponent(data), 'binary');
    return new Uint8Array(buf);
  }
  if (/^https?:\/\//i.test(fontUrl)) {
    const r = await fetch(fontUrl);
    if (!r.ok) throw new Error(`host.text (node): font fetch failed (${r.status}) ${fontUrl}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  let filePath: string;
  if (fontUrl.startsWith('file://')) {
    filePath = fileURLToPath(fontUrl);
  } else if (fontUrl.startsWith('/')) {
    filePath = join(repoRoot, fontUrl.slice(1));
    if (!existsSync(filePath) && fontUrl.startsWith('/fonts/')) {
      filePath = join(repoRoot, 'shells', 'web', 'public', fontUrl.slice(1));
    }
  } else {
    filePath = join(repoRoot, fontUrl);
  }
  return new Uint8Array(await readFile(filePath));
}

async function loadFace(fontUrl: string, repoRoot: string): Promise<FaceEntry> {
  if (faceCache.has(fontUrl)) return faceCache.get(fontUrl)!;
  const hb = await loadHarfBuzz();

  const buf = await loadFontBytes(fontUrl, repoRoot);
  // woff2 is not sfnt — HarfBuzz reads it as .notdef for every glyph (a silently blank
  // export). No headless-reachable font is woff2, so fail loud rather than blank out.
  if (buf.length >= 4 && buf[0] === 0x77 && buf[1] === 0x4f && buf[2] === 0x46 && buf[3] === 0x32) {
    throw new Error(`host.text (node): ${fontUrl} is woff2, which the terminal shells can't decode — provide an sfnt (ttf/otf) font.`);
  }
  const blob = new hb.Blob(buf as unknown as ArrayBuffer);
  const face = new hb.Face(blob);
  const entry = { blob, face, upem: face.upem, unicodes: new Set(face.collectUnicodes()) };
  faceCache.set(fontUrl, entry);
  return entry;
}

/**
 * A shaped-ready Font for `fontUrl` at the given variation instance. Distinct variation
 * settings get their own cached Font over the SHARED face (hb_font_set_variations is
 * per-font state). Unparseable axis strings are dropped, not thrown.
 */
async function loadFont(fontUrl: string, repoRoot: string, variations?: string[]): Promise<FontEntry> {
  const vars = Array.isArray(variations) ? variations.filter(v => typeof v === 'string') : [];
  const key = vars.length ? `${fontUrl}|${vars.join(',')}` : fontUrl;
  if (fontCache.has(key)) return fontCache.get(key)!;

  const { face, upem, unicodes } = await loadFace(fontUrl, repoRoot);
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
 * Split `text` into maximal runs one face in `chain` can draw (browser-style fallback):
 * keep the current face while it covers the character, else the first face that does.
 * A character no face covers stays with the current face — shaping .notdef, counted so
 * a caller can prefer its own fallback. Whitespace never forces a face change.
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
 * Transform a glyph path string from HarfBuzz font units (Y-up, origin at the glyph's
 * pen+offset position) to SVG pixels (Y-down, baseline at y=0).
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
 * Build a Node host.text bound to `repoRoot` (used to resolve rooted font paths on
 * disk). The shaping is identical to the web module; the caches are module-level so a
 * long-lived TUI process reuses shaped faces across renders.
 */
export function createNodeTextAPI({ repoRoot }: { repoRoot: string }): TextAPI {
  return {
    async toPath({ text, fontUrl, fontSize, features, letterSpacing = 0, variations, fallbackFonts }) {
      if (!text || !text.trim()) {
        return { d: '', advanceWidth: 0, bbox: null, notdef: 0 };
      }

      const chain = [
        await loadFont(fontUrl, repoRoot, variations),
        ...await Promise.all((fallbackFonts ?? []).map(f => loadFont(f.fontUrl, repoRoot, f.variations))),
      ];
      const hb = _hb!;

      const feats = Array.isArray(features)
        ? features.map((f) => hb.Feature.fromString(f)).filter(Boolean)
        : [];

      let penPx = 0;
      let d = '';
      let notdef = 0;
      let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;

      for (const seg of segmentByFace(text, chain)) {
        const { font, upem } = chain[seg.face]!;
        const scale = fontSize / upem;
        const lsUnits = Number.isFinite(letterSpacing) && letterSpacing ? letterSpacing / scale : 0;
        const originUnits = penPx / scale;

        const buf = new hb.Buffer();
        buf.addText(seg.text);
        buf.guessSegmentProperties();
        hb.shape(font, buf, feats.length ? (feats as HbFeature[]) : undefined);

        let penX = 0;
        for (const g of buf.getGlyphInfosAndPositions()) {
          const {
            codepoint: glyphId,
            xAdvance = 0,
            xOffset  = 0,
            yOffset  = 0,
          } = g;

          if (glyphId === 0) notdef++;

          const ox = originUnits + penX + xOffset;
          const oy = yOffset;

          const rawPath = font.glyphToPath(glyphId);
          if (rawPath) d += transformPath(rawPath, ox, oy, scale);

          const ext = font.glyphExtents(glyphId);
          if (ext) {
            const bx1 = (ox + ext.xBearing) * scale;
            const bx2 = (ox + ext.xBearing + ext.width) * scale;
            const by1 = -(oy + ext.yBearing) * scale;
            const by2 = -(oy + ext.yBearing + ext.height) * scale;
            if (bx1 < x1) x1 = bx1;
            if (by1 < y1) y1 = by1;
            if (bx2 > x2) x2 = bx2;
            if (by2 > y2) y2 = by2;
          }

          penX += xAdvance + lsUnits;
        }
        penPx += penX * scale;
      }

      return {
        d,
        advanceWidth: penPx,
        bbox: x1 !== Infinity ? { x1, y1, x2, y2 } : null,
        notdef,
      };
    },

    /** Warm the font cache without shaping. Call fire-and-forget. */
    async preload(fontUrl) {
      await loadFace(fontUrl, repoRoot);
    },

    /** The font's variable-axis defaults (tag → value), `{}` for a static font. */
    async axisDefaults(fontUrl) {
      const { face } = await loadFace(fontUrl, repoRoot);
      const out: Record<string, number> = {};
      const infos = face.getAxisInfos();
      for (const [tag, info] of Object.entries(infos)) out[tag] = info.default;
      return out;
    },
  };
}
