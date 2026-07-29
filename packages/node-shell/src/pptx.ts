// SPDX-License-Identifier: MPL-2.0
/**
 * PPTX capability (host.pptx) — on-device deck inspect + surgical rebrand.
 *
 * The real work is engine code: pptx-read parses an unzipped part map into a
 * read-model, pptx-patch rewrites only the brand-bearing values (every other
 * byte passes through verbatim), and brand-map supplies the nearest-swatch /
 * font-class suggestions. The engine is zip- and DOM-free by contract, so this
 * bridge owns exactly the two host-side pieces: zip inflation/re-zip (fflate,
 * dynamic import — only the first deck a user opens pulls it in) and the XML
 * parser injection (the web shell's native DOMParser; the CLI passes a jsdom one
 * via `opts.parseXml`).
 *
 * This lives in the shared node-shell package, not in shells/web, because BOTH
 * the web bridge and the CLI bridge build host.pptx from it and those are two
 * separately versioned submodules. shells/web/src/bridge/pptx.ts re-exports it,
 * so web import sites are unchanged.
 *
 * inspect() NEVER throws — a picker feeds arbitrary files here, so "not a deck"
 * resolves as { ok:false }. rebrand() throws instead: by the time it runs the
 * tool has committed to the file, so failure is exceptional.
 */
// Deep engine imports, NOT the `@lolly/engine` barrel: this module is on the
// boot path, and engine/src/index.ts is one shared facade whose retained export
// set is the UNION over every importer — touching it here drags createRuntime
// (Handlebars) + loadTool/validate (Ajv) + c2pa onto first paint. See
// scripts/check-bundle-budget.ts.
// The engine's deck reader/patcher/brand-mapper are LAZY, like the fflate zip
// codec below. bridge/index.ts constructs host.pptx at boot, so a static import
// here puts pptx-read + pptx-patch + brand-map (~16 KB gz) in front of first
// paint for every visitor, when only someone who actually opens a deck needs
// them. Both entry points (inspect/rebrand) are already async. Memoised, so the
// second call is free. See scripts/check-bundle-budget.ts.
type PptxEngine = {
  isPptx: typeof import('../../../engine/src/pptx-read.ts')['isPptx'];
  readPptx: typeof import('../../../engine/src/pptx-read.ts')['readPptx'];
  rebrandPptxParts: typeof import('../../../engine/src/pptx-patch.ts')['rebrandPptxParts'];
  nearestBrandColor: typeof import('../../../engine/src/brand-map.ts')['nearestBrandColor'];
  mapFontsToBrand: typeof import('../../../engine/src/brand-map.ts')['mapFontsToBrand'];
  suggestRebrandTheme: typeof import('../../../engine/src/brand-map.ts')['suggestRebrandTheme'];
};
let PPTX_ENGINE: Promise<PptxEngine> | null = null;
function loadPptxEngine(): Promise<PptxEngine> {
  PPTX_ENGINE ??= Promise.all([
    import('../../../engine/src/pptx-read.ts'),
    import('../../../engine/src/pptx-patch.ts'),
    import('../../../engine/src/brand-map.ts'),
  ]).then(([read, patch, map]) => ({
    isPptx: read.isPptx,
    readPptx: read.readPptx,
    rebrandPptxParts: patch.rebrandPptxParts,
    nearestBrandColor: map.nearestBrandColor,
    mapFontsToBrand: map.mapFontsToBrand,
    suggestRebrandTheme: map.suggestRebrandTheme,
  }));
  return PPTX_ENGINE;
}
import type { XmlParser, PptxReadColor } from '../../../engine/src/pptx-read.ts';
import type { RebrandPlan, RebrandTheme } from '../../../engine/src/pptx-patch.ts';
import type {
  PptxAPI, PptxInspectOpts, PptxInspectResult, PptxInspectColor, PptxInspectFont,
  PptxRebrandPlan, PptxRebrandTheme, PptxRebrandResult,
} from '@lolly-tools/core/host-v1';
import type { UnzipFileInfo } from 'fflate';

/** The OOXML presentation MIME (same string as export-pptx.ts's private const). */
export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';

export function looksLikePptxFile(file: { name?: string; type?: string }): boolean {
  return /\.pptx$/i.test(file.name ?? '') || (file.type ?? '') === PPTX_MIME;
}

// Zip-bomb caps (same regime as design-import.ts): the filter sees each entry's
// DECLARED size before it inflates, so an absurd entry — or a set summing past
// the total cap — rejects the file instead of inflating into memory.
const MAX_PPTX_BYTES = 100 * 1024 * 1024;
const MAX_ZIP_ENTRY_BYTES = 128 * 1024 * 1024;
const MAX_ZIP_TOTAL_BYTES = 512 * 1024 * 1024;

/**
 * Capped unzip of a whole .pptx — EVERY entry, because rebrand re-zips every
 * part. The third copy of this fflate shape (data-transfer.js, design-import.ts
 * unzipAsync), exported here so the pptx bridge + deck editor share one: async
 * offloads to a Worker in a real browser; sync fallback where no Worker exists
 * (CLI/tests).
 */
export async function inflatePptx(bytes: Uint8Array | ArrayBuffer): Promise<Record<string, Uint8Array>> {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (u8.length > MAX_PPTX_BYTES) {
    throw new Error(`This file is too large to open (over ${Math.round(MAX_PPTX_BYTES / 1024 / 1024)} MB).`);
  }
  const { unzip, unzipSync } = await import('fflate');
  let total = 0;
  let bomb: string | null = null;
  const filter = (f: UnzipFileInfo): boolean => {
    total += f.originalSize || 0;
    if ((f.originalSize || 0) > MAX_ZIP_ENTRY_BYTES || total > MAX_ZIP_TOTAL_BYTES) {
      bomb = f.name;
      return false;
    }
    return true;
  };
  const guard = <T>(data: T): T => {
    if (bomb) throw new Error(`This file expands too large to open (${bomb}).`);
    return data;
  };
  if (typeof Worker === 'undefined') return Promise.resolve().then(() => guard(unzipSync(u8, { filter })));
  return new Promise((resolve, reject) => {
    unzip(u8, { filter }, (err, data) => {
      if (err) return reject(err);
      try { resolve(guard(data)); } catch (e) { reject(e); }
    });
  });
}

// ─── inspect ──────────────────────────────────────────────────────────────────

const MAX_INSPECT_COLORS = 256;
const MAX_INSPECT_FONTS = 64;

// A scheme-linked colour follows the theme, so the theme swap rebrands it for
// free — only literals are the residue a colorMap must handle.
function literalHex(c: PptxReadColor | undefined): string | null {
  if (!c || 'scheme' in c || !c.hex) return null;
  return `#${c.hex.toUpperCase()}`;
}

const emptyInspect = (): PptxInspectResult => ({ ok: false, slideCount: 0, theme: { colors: {} }, colors: [], fonts: [] });

// suggestRebrandTheme emits pptx-patch's theme-write form (hash-less uppercase);
// the contract's colour form is #RRGGBB everywhere, so hash the colour slots
// here (fonts pass through). rebrand() accepts either form — the engine's
// hexNorm strips the hash on write.
function hashThemeSuggestion(theme: RebrandTheme): PptxRebrandTheme {
  const out: PptxRebrandTheme = {};
  for (const [slot, v] of Object.entries(theme)) {
    if (typeof v !== 'string' || !v) continue;
    (out as Record<string, string>)[slot] =
      slot === 'majorFont' || slot === 'minorFont' ? v : `#${v.replace(/^#/, '').toUpperCase()}`;
  }
  return out;
}

async function inspectPptx(bytes: Uint8Array, opts: PptxInspectOpts | undefined, parseXml: XmlParser): Promise<PptxInspectResult> {
  try {
    const { isPptx, readPptx, nearestBrandColor, mapFontsToBrand, suggestRebrandTheme } = await loadPptxEngine();
    const parts = await inflatePptx(bytes);
    if (!isPptx(parts)) return emptyInspect();
    const deck = readPptx(parts, parseXml);

    const colors: PptxInspectColor[] = [];
    const seenColor = new Set<string>();
    const addColor = (c: PptxReadColor | undefined): void => {
      const hex = literalHex(c);
      if (!hex || seenColor.has(hex) || colors.length >= MAX_INSPECT_COLORS) return;
      seenColor.add(hex);
      colors.push({ hex });
    };
    const fonts: PptxInspectFont[] = [];
    const seenFont = new Set<string>();
    const addFont = (family: string | undefined): void => {
      if (!family) return;
      const key = family.toLowerCase();
      if (seenFont.has(key) || fonts.length >= MAX_INSPECT_FONTS) return;
      seenFont.add(key);
      fonts.push({ family });
    };

    for (const slide of deck.slides) {
      for (const node of slide.nodes) {
        if (node.type === 'text') {
          addColor(node.fill);
          for (const para of node.paras) {
            for (const run of para.runs) {
              addColor(run.color);
              addFont(run.font);
            }
          }
        } else if (node.type === 'shape') {
          addColor(node.fill);
          addColor(node.line);
        }
      }
    }
    addFont(deck.theme.majorFont);
    addFont(deck.theme.minorFont);

    const themeColors: Record<string, string> = {};
    for (const [slot, hex] of Object.entries(deck.theme.colors)) themeColors[slot] = `#${hex.toUpperCase()}`;
    const theme: PptxInspectResult['theme'] = { colors: themeColors };
    if (deck.theme.majorFont) theme.majorFont = deck.theme.majorFont;
    if (deck.theme.minorFont) theme.minorFont = deck.theme.minorFont;

    const result: PptxInspectResult = { ok: true, slideCount: deck.slides.length, theme, colors, fonts };

    // PptxBrandSwatch/PptxBrandFonts are structurally the engine's BrandSwatch/
    // BrandFonts, so brand-map takes them as-is.
    const swatches = opts?.swatches;
    if (Array.isArray(swatches) && swatches.length > 0) {
      for (const c of colors) {
        const near = nearestBrandColor(c.hex, swatches);
        if (near) {
          c.suggested = `#${near.hex.slice(1, 7).toUpperCase()}`;
          c.review = near.review;
        }
      }
      result.themeSuggestion = hashThemeSuggestion(suggestRebrandTheme(swatches, opts?.fonts));
    }
    if (opts?.fonts) {
      const byFamily = mapFontsToBrand(fonts.map((f) => f.family), opts.fonts);
      for (const f of fonts) {
        const to = byFamily.get(f.family);
        if (to) f.suggested = to;
      }
    }
    return result;
  } catch {
    return emptyInspect();
  }
}

// ─── rebrand ──────────────────────────────────────────────────────────────────

/** A colorMap key in the engine's hexNorm form (uppercase, hash-less, 6-hex).
 *  `#RGB`/`#RGBA` expand and `#RRGGBBAA` slices — the alpha pair drops (srgbClr
 *  carries none); anything else that isn't 6-hex is no key at all — the
 *  engine's own hexNorm would zero-pad garbage into a real colour. */
function hexKey(v: string): string | null {
  let s = v.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3,4}$/.test(s)) s = s.replace(/[0-9a-fA-F]/g, (ch) => ch + ch);
  if (/^[0-9a-fA-F]{8}$/.test(s)) s = s.slice(0, 6);
  return /^[0-9a-fA-F]{6}$/.test(s) ? s.toUpperCase() : null;
}

async function rebrandPptx(bytes: Uint8Array, plan: PptxRebrandPlan | undefined): Promise<PptxRebrandResult> {
  const { isPptx, rebrandPptxParts } = await loadPptxEngine();
  const parts = await inflatePptx(bytes);
  if (!isPptx(parts)) throw new Error('Not a PowerPoint (.pptx) file.');

  const enginePlan: RebrandPlan = {};
  if (plan?.theme) {
    const theme: RebrandTheme = {};
    for (const [slot, v] of Object.entries(plan.theme)) {
      if (typeof v === 'string' && v) (theme as Record<string, string>)[slot] = v;
    }
    if (Object.keys(theme).length > 0) enginePlan.theme = theme;
  }
  if (plan?.colorMap) {
    const colorMap = new Map<string, string>();
    for (const [from, to] of Object.entries(plan.colorMap)) {
      const key = hexKey(from);
      // Values pass through as given — the engine normalises them on write.
      if (key && typeof to === 'string' && to) colorMap.set(key, to);
    }
    if (colorMap.size > 0) enginePlan.colorMap = colorMap;
  }
  if (plan?.fontMap) {
    const fontMap = new Map<string, string>();
    for (const [from, to] of Object.entries(plan.fontMap)) {
      if (from && typeof to === 'string' && to) fontMap.set(from, to);
    }
    if (fontMap.size > 0) enginePlan.fontMap = fontMap;
  }
  if (plan?.dropEmbeddedFonts === true) enginePlan.dropEmbeddedFonts = true;

  const { parts: outParts, report } = rebrandPptxParts(parts, enginePlan);

  // Re-zip (mirrors export-pptx.ts's zipPptxParts, but hands back raw bytes —
  // the caller decides Blob vs file).
  const { zipSync } = await import('fflate');
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(outParts)) {
    files[path] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return { bytes: zipSync(files), report };
}

export function createPptxAPI(opts: { parseXml?: (xml: string) => Document } = {}): PptxAPI {
  // Constructed per call, lazily — node shells have no DOMParser global, they
  // inject jsdom's instead, so this module must never touch the native one at
  // load time.
  const parseXml: XmlParser = opts.parseXml ?? ((xml) => new DOMParser().parseFromString(xml, 'application/xml'));
  return {
    inspect: (bytes, o) => inspectPptx(bytes, o, parseXml),
    rebrand: (bytes, plan) => rebrandPptx(bytes, plan),
  };
}
