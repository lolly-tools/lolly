// SPDX-License-Identifier: MPL-2.0
/**
 * A text shaper for the Design measure built on the host's HarfBuzz (plan 295, P3d).
 *
 * `measureDesignText` takes a `TextShaperV1`. This builds one from what every shell
 * already has, `HostV1.text.toPath` with clusters, plus two lookups each shell answers
 * its own way: which face file draws a family at a weight and slant, and that file's
 * vertical metrics. The Node shell answers from the content roots, the web shell from
 * its font registry, and the shaping, the advances and the coverage check are this
 * one module on both, so the two measure a page the same way.
 *
 * Pure: no DOM, no clock, no network, no filesystem, no randomness.
 */
import { TextMeasureError, type TextFontMetricsV1, type TextShaperV1 } from './design-text-measure.ts';

/** A face file for one run, with the variable axes to shape it at. */
export interface HostShaperFace { url: string; variations?: string[] }

export interface HostShaperDeps {
  /** `HostV1.text.toPath`, which must honour `clusters` and `preserveWhitespaceAdvance`. */
  toPath: (opts: {
    text: string; fontUrl: string; fontSize: number; variations?: string[]; features?: string[];
    letterSpacing?: number; clusters?: boolean; preserveWhitespaceAdvance?: boolean;
  }) => Promise<{ advanceWidth: number; notdef?: number; clusters?: Array<{ start: number; advance: number }> }>;
  /** `HostV1.text.characters`: the face's character map, to name what it cannot draw. */
  characters?: (fontUrl: string) => Promise<number[]>;
  /** The face that draws `family` at `weight` and slant, or null when this host has none. */
  face: (family: string, weight: number, italic: boolean, text: string) => Promise<HostShaperFace | null>;
  /** The face file's vertical metrics, read from its bytes (`sfntVerticalMetrics`). */
  metrics: (url: string) => Promise<TextFontMetricsV1 | undefined>;
  /** Hears each assumption once, such as an italic run measured upright. */
  onNote?: (note: string) => void;
}

/**
 * Vertical metrics from an sfnt's head, hhea and OS/2 tables, as Chromium reads
 * them: typo metrics when fsSelection bit 7 (USE_TYPO_METRICS) is set, else hhea,
 * else typo, else the Windows metrics. Null when the file is not an sfnt.
 */
export function sfntVerticalMetrics(bytes: Uint8Array): TextFontMetricsV1 | null {
  if (bytes.length < 12) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = dv.getUint32(0);
  if (tag !== 0x00010000 && tag !== 0x4f54544f && tag !== 0x74727565) return null;
  const count = dv.getUint16(4);
  const tables = new Map<string, number>();
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    if (at + 16 > bytes.length) return null;
    const name = String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
    tables.set(name, dv.getUint32(at + 8));
  }
  const head = tables.get('head');
  const hhea = tables.get('hhea');
  if (head === undefined || hhea === undefined || head + 20 > bytes.length || hhea + 10 > bytes.length) return null;
  const upem = dv.getUint16(head + 18);
  const hAscent = dv.getInt16(hhea + 4);
  const hDescent = dv.getInt16(hhea + 6);
  const os2 = tables.get('OS/2');
  if (os2 !== undefined && os2 + 78 <= bytes.length) {
    const useTypo = (dv.getUint16(os2 + 62) & 0x80) !== 0;
    const typoAscent = dv.getInt16(os2 + 68);
    const typoDescent = dv.getInt16(os2 + 70);
    if (useTypo || (hAscent === 0 && hDescent === 0)) {
      if (typoAscent || typoDescent) return { upem, ascent: typoAscent, descent: Math.abs(typoDescent) };
      return { upem, ascent: dv.getUint16(os2 + 74), descent: dv.getUint16(os2 + 76) };
    }
  }
  return { upem, ascent: hAscent, descent: Math.abs(hDescent) };
}

/** Characters a missing glyph is not a fault for: controls, spaces and default ignorables, which shaping hides. */
const IGNORABLE = /^[\p{Cc}\p{Zs}\p{Zl}\p{Zp}\p{Default_Ignorable_Code_Point}]$/u;

/** UTF-16 indices of the characters in `text` the face's cmap does not map. */
function uncoveredIndices(text: string, unicodes: ReadonlySet<number>): number[] {
  const out: number[] = [];
  for (let i = 0; i < text.length;) {
    const cp = text.codePointAt(i)!;
    const ch = String.fromCodePoint(cp);
    if (!unicodes.has(cp) && !IGNORABLE.test(ch)) out.push(i);
    i += ch.length;
  }
  return out;
}

const variationsRecord = (list: readonly string[] | undefined): Record<string, number> | undefined => {
  if (!list?.length) return undefined;
  const out: Record<string, number> = {};
  for (const item of list) {
    const [tag, value] = item.split('=');
    if (tag && Number.isFinite(Number(value))) out[tag] = Number(value);
  }
  return out;
};

/**
 * A `TextShaperV1` over the host's HarfBuzz. A face the host cannot find is a
 * `font.unavailable` error, never a silent substitute; an italic run with no italic
 * face is measured upright, as a browser slants it, and noted.
 */
export function createHostTextShaper(deps: HostShaperDeps): TextShaperV1 {
  const resolved = new Map<string, Promise<HostShaperFace>>();
  const coverage = new Map<string, Promise<ReadonlySet<number>>>();
  const noted = new Set<string>();
  const note = (text: string): void => {
    if (noted.has(text)) return;
    noted.add(text);
    deps.onNote?.(text);
  };
  const resolve = (family: string, weight: number, italic: boolean, text: string): Promise<HostShaperFace> => {
    const key = `${family}\u0000${weight}\u0000${italic ? 1 : 0}`;
    let hit = resolved.get(key);
    if (!hit) {
      hit = (async () => {
        const found = await deps.face(family, weight, italic, text);
        if (found) return found;
        if (italic) {
          const upright = await deps.face(family, weight, false, text);
          if (upright) {
            note(`${family} has no italic face here, so italic text was measured in the upright face, as a browser slants it.`);
            return upright;
          }
        }
        throw new TextMeasureError('font.unavailable', `No font file for "${family}" (weight ${weight}${italic ? ', italic' : ''}) was found under this content root; add the family's ttf or otf faces, or measure with another font.`);
      })();
      resolved.set(key, hit);
      hit.catch(() => resolved.delete(key));
    }
    return hit;
  };
  return async (run) => {
    const face = await resolve(run.family, run.weight, run.italic, run.text);
    const shaped = await deps.toPath({
      text: run.text,
      fontUrl: face.url,
      fontSize: run.size,
      ...(face.variations ? { variations: face.variations } : {}),
      ...(run.features.length ? { features: run.features } : {}),
      letterSpacing: run.tracking,
      clusters: true,
      preserveWhitespaceAdvance: true,
    });
    const advances = new Array<number>(run.text.length).fill(0);
    for (const c of shaped.clusters ?? []) if (c.start >= 0 && c.start < advances.length) advances[c.start]! += c.advance;
    const variations = variationsRecord(face.variations);
    const metrics = await deps.metrics(face.url);
    // Shaping drew a missing-glyph box: name the characters the face does not map.
    let missing: number[] | undefined;
    if ((shaped.notdef ?? 0) > 0 && deps.characters) {
      let cover = coverage.get(face.url);
      if (!cover) {
        cover = deps.characters(face.url).then((list) => new Set(list));
        coverage.set(face.url, cover);
        cover.catch(() => coverage.delete(face.url));
      }
      const found = uncoveredIndices(run.text, await cover);
      if (found.length) missing = found;
    }
    return {
      advances,
      total: shaped.advanceWidth,
      ...(missing ? { missing } : {}),
      font: { file: face.url, ...(variations ? { variations } : {}), ...(metrics ? { metrics } : {}) },
    };
  };
}
