// SPDX-License-Identifier: MPL-2.0
/**
 * Outline a page walk's text with the faces the captured page loaded.
 *
 * The page walk (shells/web/src/capture/page-walk.ts) lays every line out in the
 * page and leaves a stand-in path per run: the run's measured box, tagged
 * `data-lolly-text="<id>"`, positioned at its baseline. This swaps each box for the
 * run's real glyph outlines, shaped with HarfBuzz from the very font file the page
 * drew it with, so a captured heading looks like the page and needs no font to open.
 *
 * A face is chosen the way the browser chose it: the first family in the run's
 * stack with a loaded face the run's weight and slant can use (font-faces.ts
 * pickFaces, the rule Lolly's own exports use). A run with no such face (a system
 * font, a face loaded by script with no `@font-face` behind it, a missing glyph)
 * keeps the page's font stack as a `<text>` element, so it still reads.
 *
 * Shell-agnostic: bytes, stylesheet text, the shaper and the URL a shaper loads come
 * in through `PageTextDeps`. The CLI reads the tab's cache over CDP and shapes in
 * Node; the desktop app and the web app shape with their own host.text.
 */
import { sfntKind, woffToSfnt } from '../../../engine/src/font-convert.ts';
import { parseFontFamilies, parseFontFaceCss, pickFaces, normaliseWeight, type FontFaceRule } from './font-faces.ts';
import type { TextAPI } from '@lolly-tools/core/host-v1';

/** A run as the page walk recorded it (see page-walk.ts TextRun). */
export interface PageTextRun {
  id: number; text: string; family: string; weight: string; style: string; stretch: string;
  fontSize: number; letterSpacing: number; features: string[];
}

/** The page's faces as the page walk recorded them (see page-walk.ts PageFonts). */
export interface PageTextFonts {
  loaded: Array<{ family: string; weight: string; style: string; unicodeRange: string }>;
  rules: Array<{ family: string; weight: string; style: string; unicodeRange: string; urls: string[] }>;
  sheets: string[];
}

export interface PageTextDeps {
  /** A font file the page loaded, or null when it cannot be read. */
  fontBytes(url: string): Promise<Uint8Array | null>;
  /** A stylesheet the walk could not read from the page, or null. */
  sheetText(url: string): Promise<string | null>;
  /** A URL this shell's shaper loads the given sfnt from (a data: or blob: URL). */
  fontUrl(sfnt: Uint8Array): Promise<string>;
  toPath: TextAPI['toPath'];
}

export interface PageTextResult {
  svg: string;
  /** Runs drawn as outlines, and runs kept as `<text>`. */
  outlined: number;
  kept: number;
  /** Faces whose bytes could not be read or decoded, by URL. */
  unreadable: string[];
}

/**
 * The share of coarse cells a vector capture may differ from its screenshot by and
 * still be the answer, for every shell that captures with the page walk. Text that
 * kept a system font, frozen script animation and antialiasing all score a little;
 * a walk that lost a panel or painted a layer over the page scores far more.
 * Measured on sixteen public pages after the walk's fixes (2026-10-20): the median
 * was 9%, the worst 28%.
 */
export const VECTOR_SHOT_MAX_DISTANCE = 0.35;

/** The ceiling on one font file, decoded. Webfonts are tens of kilobytes. */
const MAX_FONT_BYTES = 32 << 20;

const sig = (f: { family: string; weight: string; style: string; unicodeRange: string }): string =>
  [f.family.toLowerCase(), normaliseWeight(f.weight), (f.style || 'normal').toLowerCase(), f.unicodeRange.replace(/\s+/g, '').toLowerCase()].join('|');

export async function outlinePageText(svg: string, runs: PageTextRun[], fonts: PageTextFonts, deps: PageTextDeps): Promise<PageTextResult> {
  const ids = new Set([...svg.matchAll(/\bdata-lolly-text="(\d+)"/g)].map(m => Number(m[1])));
  if (!ids.size) return { svg, outlined: 0, kept: 0, unreadable: [] };

  // Every @font-face the page declared: the ones the walk read, plus the ones in
  // stylesheets the page kept from it, read by the shell instead.
  const rules: FontFaceRule[] = fonts.rules.map(r => ({ ...r, weight: normaliseWeight(r.weight), style: (r.style || 'normal').toLowerCase() }));
  for (const url of fonts.sheets) {
    const css = await deps.sheetText(url).catch(() => null);
    if (css) rules.push(...parseFontFaceCss(css, url));
  }
  // Only faces the page actually loaded can have drawn its text. Each gets the
  // rule that declared it, by family, weight, slant and range.
  const bySig = new Map<string, FontFaceRule>();
  for (const r of rules) if (!bySig.has(sig(r))) bySig.set(sig(r), r);
  const faces: FontFaceRule[] = [];
  for (const f of fonts.loaded) {
    const rule = bySig.get(sig(f));
    if (rule) faces.push(rule);
  }

  const unreadable = new Set<string>();
  const urls = new Map<string, Promise<string | null>>();
  const faceUrl = (face: FontFaceRule): Promise<string | null> => {
    const key = face.urls.join(' ');
    let p = urls.get(key);
    if (!p) {
      p = (async () => {
        for (const url of face.urls) {
          const sfnt = await toSfnt(await deps.fontBytes(url).catch(() => null));
          if (sfnt) return deps.fontUrl(sfnt);
          unreadable.add(url);
        }
        return null;
      })();
      urls.set(key, p);
    }
    return p;
  };

  const byId = new Map(runs.map(r => [r.id, r]));
  const drawn = new Map<number, string>();
  for (const id of ids) {
    const run = byId.get(id);
    if (!run) continue;
    let chain: Array<{ face: FontFaceRule; variations?: string[] }> = [];
    for (const family of parseFontFamilies(run.family)) {
      chain = pickFaces(faces.filter(f => f.family.toLowerCase() === family.toLowerCase()), { fontStyle: run.style, fontWeight: run.weight }, run.text);
      if (chain.length) break;
    }
    const loaded: Array<{ fontUrl: string; variations?: string[] }> = [];
    for (const c of chain) {
      const fontUrl = await faceUrl(c.face);
      if (fontUrl) loaded.push({ fontUrl, ...(c.variations ? { variations: c.variations } : {}) });
    }
    if (!loaded.length) continue;
    try {
      const r = await deps.toPath({
        text: run.text, fontUrl: loaded[0]!.fontUrl, fontSize: run.fontSize,
        features: run.features, letterSpacing: run.letterSpacing,
        ...(loaded[0]!.variations ? { variations: loaded[0]!.variations } : {}),
        ...(loaded.length > 1 ? { fallbackFonts: loaded.slice(1) } : {}),
      });
      // A glyph no face has would draw as a box: keep the run as text instead.
      if (r.d && !r.notdef) drawn.set(id, r.d);
    } catch { /* kept as text below */ }
  }

  let outlined = 0, kept = 0;
  const out = svg.replace(/<path\b([^>]*?)\bdata-lolly-text="(\d+)"([^>]*?)\/>/g, (whole, a: string, idText: string, b: string) => {
    const id = Number(idText);
    const run = byId.get(id);
    if (!run) return whole;
    // The run tag is the walk's own bookkeeping and does not travel into the file.
    const attrs = `${a}${b}`.trimEnd();
    const d = drawn.get(id);
    if (d) { outlined++; return `<path${attrs.replace(/\sd="[^"]*"/, ` d="${d}"`)}/>`; }
    kept++;
    return textElement(run, attrs);
  });
  return { svg: out, outlined, kept, unreadable: [...unreadable] };
}

/** The run as live text in the page's font stack, at the box's own baseline. */
function textElement(run: PageTextRun, attrs: string): string {
  const keep = [...attrs.matchAll(/\s(transform|fill|fill-opacity|stroke|stroke-width|stroke-linejoin|paint-order|filter|opacity)="[^"]*"/g)].map(m => m[0]).join('');
  const ls = run.letterSpacing ? ` letter-spacing="${run.letterSpacing}"` : '';
  return `<text${keep} xml:space="preserve" font-family="${xml(run.family)}" font-size="${run.fontSize}" font-weight="${xml(run.weight)}" font-style="${xml(run.style)}"${ls}>${xml(run.text)}</text>`;
}

const xml = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A font file in any web container as sfnt bytes HarfBuzz reads, or null. */
async function toSfnt(bytes: Uint8Array | null): Promise<Uint8Array | null> {
  if (!bytes || bytes.length < 12 || bytes.length > MAX_FONT_BYTES) return null;
  try {
    const kind = sfntKind(bytes);
    if (kind === 'ttf' || kind === 'otf') return bytes;
    if (kind === 'woff') return woffToSfnt(bytes);
    if (kind === 'woff2') {
      const decompress = (await import('woff2-encoder/decompress')).default as (b: Uint8Array) => Promise<Uint8Array>;
      const out = await decompress(bytes);
      return out.length <= MAX_FONT_BYTES ? out : null;
    }
  } catch { /* an unreadable container is reported by the caller */ }
  return null;
}
