// SPDX-License-Identifier: MPL-2.0
/**
 * Text measurement in Node (plan 291, W5): the HarfBuzz shaper and the font files
 * behind `measureDesignText`, shared by `lolly measure --text`, the
 * `lolly_measure_text` MCP tool and the `text-measure` checker of `lolly check`.
 *
 * Faces are the ones the Design canvas draws with. The web shell loads variable
 * faces (`/fonts/SUSE[wght].woff2` and its italic) for the brand's families, so a
 * family is resolved first to the variable sfnt sibling under
 * shells/web/public/fonts (`SUSE[wght].ttf` with `wght` set to the run's weight),
 * and only then through `host.text.fontUrl`, which prefers a catalog's static
 * faces (those are what PowerPoint uses, and they differ from the variable face by
 * about 1% at italic and extreme weights). The file used is named in the result.
 *
 * A family with no face here is `font.unavailable`, naming the family; an italic
 * run with no italic face is measured in the upright face, which is what the
 * browser's synthesised oblique advances by, and the result says so. A character
 * the face has no glyph for is reported to the measure (`missing`), which flags its
 * lines and lists it in `uncovered`, since the browser draws it in a fallback font.
 *
 * Vertical metrics come from the font file: the OS/2 typo metrics when the face
 * sets USE_TYPO_METRICS, else hhea, as Chromium reads them.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTokenSet, measureDesignText, TextMeasureError, TEXT_MEASURE_DEFAULT_FONTS } from '@lolly/engine';
import type { TextFontMetricsV1, TextShaperV1 } from '@lolly/engine';
import type { TextMeasureFontsV1, TextMeasureSpecV1, TextMeasureV1 } from '@lolly-tools/core/text-measure-v1';
import { contentRoots, contentUrlFile } from './content-roots.ts';
import { repoRoot as defaultRepoRoot } from './repo-root.ts';
import { createNodeTextAPI } from './text.ts';

export { TextMeasureError };

export interface TextMeasureNodeOptions {
  /** The content root the fonts are read under. Default: the resolved repo root. */
  repoRoot?: string;
  /** A design brief (`designBrief`), whose `type.families` name the brand's faces. */
  brief?: unknown;
}

const normFamily = (s: string): string => s.toLowerCase().replace(/[\s_-]+/g, '');
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** The first family of a CSS font stack, without quotes. */
function firstFamily(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const first = value.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '').trim();
  return first || undefined;
}

/**
 * The brand's families by slot from a design brief's `type.families`
 * (`font.brand`, `font.mono`, `font.display`, `font.italic`), over the platform
 * faces for any slot the brief leaves out.
 */
export function measureFontsFromBrief(brief: unknown): TextMeasureFontsV1 {
  const fonts: TextMeasureFontsV1 = { ...TEXT_MEASURE_DEFAULT_FONTS };
  const families = record(brief) && record(brief.type) && Array.isArray(brief.type.families) ? brief.type.families : [];
  for (const entry of families) {
    if (!record(entry) || typeof entry.path !== 'string') continue;
    const family = firstFamily(entry.value);
    if (!family) continue;
    const slot = entry.path.replace(/^font\./, '');
    if (slot === 'brand' || slot === 'mono' || slot === 'display' || slot === 'italic') fonts[slot] = family;
  }
  return fonts;
}

/**
 * The brand's families by slot from a DTCG token document (`font.brand`,
 * `font.mono`, `font.display`, `font.italic`), over the platform faces for any
 * slot the document leaves out or cannot resolve.
 */
export function measureFontsFromTokens(doc: unknown, theme?: string): TextMeasureFontsV1 {
  const fonts: TextMeasureFontsV1 = { ...TEXT_MEASURE_DEFAULT_FONTS };
  let tokens: ReturnType<typeof createTokenSet>;
  try {
    tokens = createTokenSet(doc, theme ? { theme } : {});
  } catch {
    return fonts;
  }
  for (const slot of ['brand', 'mono', 'display', 'italic'] as const) {
    let value: unknown;
    try {
      value = tokens.resolve(`font.${slot}`);
    } catch {
      continue;
    }
    const family = typeof value === 'string' && !value.startsWith('{') ? firstFamily(value) : undefined;
    if (family) fonts[slot] = family;
  }
  return fonts;
}

interface VariableFace { url: string; family: string; italic: boolean }

const variableCache = new Map<string, VariableFace[]>();

/** The variable sfnt faces under shells/web/public/fonts: the faces the canvas draws with. */
function variableFaces(root: string): VariableFace[] {
  const hit = variableCache.get(root);
  if (hit) return hit;
  const dir = join(root, 'shells', 'web', 'public', 'fonts');
  const faces: VariableFace[] = [];
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      const m = /^(.+?)(-Italic)?\[[^\]]+\]\.(ttf|otf)$/i.exec(name);
      if (m) faces.push({ url: `/fonts/${name}`, family: normFamily(m[1]!), italic: Boolean(m[2]) });
    }
  }
  variableCache.set(root, faces);
  return faces;
}

/** A font URL in host.text's form, to its file on disk. */
function fontFile(url: string, root: string): string | null {
  if (url.startsWith('/fonts/')) return join(root, 'shells', 'web', 'public', url.slice(1));
  if (url.startsWith('/catalog/')) {
    try {
      return contentUrlFile(url, contentRoots({ root }));
    } catch {
      return null;
    }
  }
  return null;
}

const metricsCache = new Map<string, TextFontMetricsV1 | null>();

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

function metricsOf(url: string, root: string): TextFontMetricsV1 | undefined {
  const key = `${root}\u0000${url}`;
  if (!metricsCache.has(key)) {
    const file = fontFile(url, root);
    let metrics: TextFontMetricsV1 | null = null;
    try {
      if (file) metrics = sfntVerticalMetrics(new Uint8Array(readFileSync(file)));
    } catch {
      metrics = null;
    }
    metricsCache.set(key, metrics);
  }
  return metricsCache.get(key) ?? undefined;
}

const coverageCache = new Map<string, Promise<ReadonlySet<number>>>();

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
 * A `TextShaperV1` over HarfBuzz (`createNodeTextAPI`) and the canvas's faces.
 * `onNote` hears each assumption once (an italic run measured upright).
 */
export function createNodeTextShaper(opts: { repoRoot?: string; onNote?: (note: string) => void } = {}): TextShaperV1 {
  const root = opts.repoRoot ?? defaultRepoRoot();
  const host = createNodeTextAPI({ repoRoot: root });
  const resolved = new Map<string, Promise<{ url: string; variations?: string[] }>>();
  const noted = new Set<string>();
  const note = (text: string): void => {
    if (noted.has(text)) return;
    noted.add(text);
    opts.onNote?.(text);
  };
  const resolve = (family: string, weight: number, italic: boolean): Promise<{ url: string; variations?: string[] }> => {
    const key = `${family}\u0000${weight}\u0000${italic ? 1 : 0}`;
    let hit = resolved.get(key);
    if (!hit) {
      hit = (async () => {
        const want = normFamily(family);
        const variable = variableFaces(root).find((f) => f.family === want && f.italic === italic);
        if (variable) return { url: variable.url, variations: [`wght=${weight}`] };
        const found = await host.fontUrl?.(family, { weight, italic });
        if (found) return found;
        if (italic) {
          const upright = variableFaces(root).find((f) => f.family === want && !f.italic);
          const fallback = upright ? { url: upright.url, variations: [`wght=${weight}`] } : await host.fontUrl?.(family, { weight, italic: false });
          if (fallback) {
            note(`${family} has no italic face here, so italic text was measured in the upright face, as a browser slants it.`);
            return fallback;
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
    const face = await resolve(run.family, run.weight, run.italic);
    const shaped = await host.toPath({
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
    const metrics = metricsOf(face.url, root);
    // Shaping drew a missing-glyph box: name the characters the face does not map.
    let missing: number[] | undefined;
    if ((shaped.notdef ?? 0) > 0 && host.characters) {
      const key = `${root}\u0000${face.url}`;
      let cover = coverageCache.get(key);
      if (!cover) {
        cover = host.characters(face.url).then((list) => new Set(list));
        coverageCache.set(key, cover);
        cover.catch(() => coverageCache.delete(key));
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

/**
 * Measure one text spec in Node. Without `spec.fonts`, the families come from
 * `opts.brief` and then the platform faces.
 */
export async function measureTextNode(spec: TextMeasureSpecV1, opts: TextMeasureNodeOptions = {}): Promise<TextMeasureV1> {
  const root = opts.repoRoot ?? defaultRepoRoot();
  const notes: string[] = [];
  const shaper = createNodeTextShaper({ repoRoot: root, onNote: (n) => notes.push(n) });
  const fonts = spec?.fonts ?? measureFontsFromBrief(opts.brief);
  const result = await measureDesignText({ ...spec, fonts }, shaper);
  if (notes.length) result.notes.push(...notes);
  return result;
}

// ─── Design rows ─────────────────────────────────────────────────────────────

type Row = Record<string, unknown>;

/** The values `boolVal` in the renderer reads as on and off. */
function boolVal(v: unknown, dflt: boolean): boolean {
  if (v === true || v === false) return v;
  if (v === null || v === undefined || v === '') return dflt;
  const s = String(v).toLowerCase();
  if (s === 'true' || s === '1' || s === 'yes' || s === 'on') return true;
  if (s === 'false' || s === '0' || s === 'no' || s === 'off') return false;
  return dflt;
}

/** A stroke colour the renderer would paint (`safeColor`), so the border counts. */
function paintsStroke(v: unknown): boolean {
  const s = String(v ?? '').trim();
  if (!s) return false;
  return /^#[0-9a-fA-F]{3,8}$/.test(s)
    || /^(rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)$/i.test(s)
    || (s.length <= 256 && /^(?:(?:ok)?(?:lab|lch)\([-+0-9.eE%\s/]+\)|color\((?:srgb|srgb-linear|display-p3|rec2020)\s+[-+0-9.eE%\s/]+\))$/i.test(s))
    || /^[a-zA-Z]+$/.test(s)
    || /^var\(\s*--[a-zA-Z0-9-]+\s*(,\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+|(?:rgb|rgba|hsl|hsla)\([0-9.,%\s/]+\)))?\s*\)$/.test(s);
}

/** A number field read the way the renderer's `num` reads it: `parseFloat`, so `'60px'` is 60. */
const rowNum = (v: unknown): number => (typeof v === 'number' ? v : parseFloat(String(v)));
const given = (v: unknown): boolean => v !== undefined && v !== null && v !== '';

/**
 * A Design text row as a measure spec: the row's own fields, read as the renderer
 * reads them, and the renderer's defaults for the rest. A field the renderer cannot
 * read as a number is left out, so the default applies, as on the canvas.
 */
export function textMeasureSpecOfRow(row: Row, fonts?: TextMeasureFontsV1): TextMeasureSpecV1 {
  const spec: TextMeasureSpecV1 = { text: String(row.text ?? ''), width: rowNum(row.w) };
  const numeric = (key: 'height' | 'size' | 'lineHeight' | 'pad' | 'tracking', v: unknown): void => {
    if (!given(v)) return;
    const n = rowNum(v);
    if (Number.isFinite(n)) spec[key] = n;
  };
  numeric('height', row.h);
  if (given(row.font)) spec.font = String(row.font);
  if (given(row.weight)) spec.weight = row.weight as string | number;
  numeric('size', row.fontSize);
  numeric('lineHeight', row.lineHeight);
  numeric('pad', row.pad);
  numeric('tracking', row.tracking);
  if (!boolVal(row.ligatures, true)) spec.ligatures = false;
  if (boolVal(row.alternates, false)) spec.alternates = true;
  if (boolVal(row.plainText, false)) spec.plain = true;
  if (paintsStroke(row.stroke) && rowNum(row.strokeW) > 0) spec.strokeW = rowNum(row.strokeW);
  spec.valign = row.valign === 'top' || row.valign === 'bottom' || row.valign === 'middle' ? row.valign : 'middle';
  if (fonts) spec.fonts = fonts;
  return spec;
}

export interface MeasureDesignRowsOptions {
  /** Measure only these layers; an id that is not a plain text layer is refused. */
  layerIds?: string[];
  /** A design brief whose `type.families` name the brand's faces. */
  brief?: unknown;
  /** The brand's faces by slot, in place of the brief's. */
  fonts?: TextMeasureFontsV1;
  repoRoot?: string;
  /** Stops between layers. */
  signal?: AbortSignal;
  /**
   * Text units (UTF-16) this call measures at most, summed over the layers. A layer
   * that would take the total past the budget is skipped with the reason, and so is
   * every later layer. Default: no budget.
   */
  maxUnits?: number;
}

export interface MeasureDesignRowsReport {
  measured: Array<{ layerId: string; index: number; measure: TextMeasureV1 }>;
  /** Text layers not measured, and why: a text story, a hidden layer, a face that is not here. */
  skipped: Array<{ layerId: string; index: number; reason: string }>;
}

const isPlainText = (row: Row): boolean => row.kind === 'text' && !row.textStory;

/**
 * The plain text layers a `measureDesignRowsReport` call would measure, counted before
 * any is measured, with their total text units: what a caller with a time budget (a
 * hosted function) checks first, so it refuses rather than runs out of time.
 */
export function countMeasurableTextLayers(rows: readonly unknown[], layerIds?: readonly string[]): { layers: number; units: number } {
  const want = layerIds?.length ? new Set(layerIds) : null;
  let layers = 0;
  let units = 0;
  if (!Array.isArray(rows)) return { layers, units };
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!record(row) || !isPlainText(row)) continue;
    const layerId = typeof row.id === 'string' ? row.id : String(index);
    if (want ? !want.has(layerId) : boolVal(row.hidden, false)) continue;
    layers++;
    units += String(row.text ?? '').length;
  }
  return { layers, units };
}

/**
 * Measure the plain text layers of a Design document's rows. Text story layers are
 * composed by the engine and are skipped with a note (refused when asked for by
 * id); hidden layers are skipped; a layer whose face is not here is skipped with
 * the reason. Rows that are not objects are passed over, and every `index` is the
 * row's place in `rows` as given, so a `/boxes/<index>` pointer points at the right row.
 */
export async function measureDesignRowsReport(rows: readonly unknown[], opts: MeasureDesignRowsOptions = {}): Promise<MeasureDesignRowsReport> {
  if (!Array.isArray(rows)) throw new TextMeasureError('input.invalid', 'Supply the document\'s boxes as an array of rows.');
  const fonts = opts.fonts ?? measureFontsFromBrief(opts.brief);
  const want = opts.layerIds?.length ? new Set(opts.layerIds) : null;
  if (want) {
    for (const id of want) {
      const row = rows.find((r): r is Row => record(r) && r.id === id);
      if (!row) throw new TextMeasureError('input.invalid', `No layer "${id}" in this document.`);
      if (row.kind !== 'text') throw new TextMeasureError('input.invalid', `Layer "${id}" is a ${String(row.kind ?? 'box')} layer, not text.`);
      if (row.textStory) throw new TextMeasureError('input.invalid', `Layer "${id}" is a text story, which the engine composes; measure it through its text document.`);
    }
  }
  const report: MeasureDesignRowsReport = { measured: [], skipped: [] };
  const root = opts.repoRoot ?? defaultRepoRoot();
  const budget = Number.isFinite(opts.maxUnits) && opts.maxUnits! >= 0 ? opts.maxUnits! : Infinity;
  let spent = 0;
  let overBudget = false;
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (!record(row) || row.kind !== 'text') continue;
    opts.signal?.throwIfAborted();
    const layerId = typeof row.id === 'string' ? row.id : String(index);
    if (want && !want.has(layerId)) continue;
    if (!isPlainText(row)) {
      report.skipped.push({ layerId, index, reason: 'A text story is composed by the engine, not laid out as a plain text layer.' });
      continue;
    }
    if (!want && boolVal(row.hidden, false)) {
      report.skipped.push({ layerId, index, reason: 'The layer is hidden.' });
      continue;
    }
    const units = String(row.text ?? '').length;
    if (overBudget || spent + units > budget) {
      overBudget = true;
      report.skipped.push({ layerId, index, reason: `Over this run's measuring budget of ${budget} characters; measure it with lolly measure --text-layers --layer=${layerId}.` });
      continue;
    }
    spent += units;
    try {
      const measure = await measureTextNode(textMeasureSpecOfRow(row, fonts), { repoRoot: root });
      if (boolVal(row.fitText, false)) measure.notes.push('The layer shrinks its text to fit (fitText), so the canvas draws it smaller than measured here.');
      report.measured.push({ layerId, index, measure });
    } catch (err) {
      if (err instanceof TextMeasureError && !want) {
        report.skipped.push({ layerId, index, reason: err.message });
        continue;
      }
      throw err;
    }
  }
  return report;
}

/** The measured plain text layers of a document, in row order. */
export async function measureDesignRows(rows: readonly Row[], opts: MeasureDesignRowsOptions = {}): Promise<Array<{ layerId: string; measure: TextMeasureV1 }>> {
  return (await measureDesignRowsReport(rows, opts)).measured.map(({ layerId, measure }) => ({ layerId, measure }));
}

/** Drop the cached face lists and metrics (for tests that swap content roots). */
export function clearTextMeasureCaches(): void {
  variableCache.clear();
  metricsCache.clear();
  coverageCache.clear();
}
