// SPDX-License-Identifier: MPL-2.0
/**
 * Plate scenes: the pure parts. A scene is a Design document plus the ink each named region of each plate must
 * carry once the CMYK Print PDF is separated. This module holds everything that needs no external program: the scene
 * schema check, a reader for the uncompressed 8-bit plate TIFFs that Ghostscript's `tiffsep` device writes, region
 * statistics, and the PDF structure facts a scene may assert. `scripts/plate-oracle.test.ts` runs the scenes, and
 * `tests/plate-scenes.test.ts` keeps this module and the scene files honest in hosted CI.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { join } from 'node:path';

export type Plate = string;
export const PROCESS_PLATES = ['C', 'M', 'Y', 'K'] as const;
const GS_PLATE_NAME: Record<string, string> = { C: 'Cyan', M: 'Magenta', Y: 'Yellow', K: 'Black' };
export type Stat = 'mean' | 'min' | 'max';

/** One plate's expectation: a bare number is the region's expected mean ink in percent. */
export type PlateExpect = number | {
  value?: number; min?: number; max?: number; tol?: number; stat?: Stat;
  /** Take `value` from the press separation of this sRGB hex rather than a stated number. */
  from?: string;
};

export interface SceneRegion {
  name: string;
  /** x, y, width, height in CSS pixels of the page, which is also the plate's pixel grid at 96 dpi. */
  rect: [number, number, number, number];
  stat?: Stat;
  tol?: number;
  expect?: Record<Plate, PlateExpect>;
  /** Shorthand for all four process plates: the press separation of one colour, or a blend of two. */
  expectFrom?: { rgb: string } | { lerp: [string, string, number] };
  /** Per-pixel total ink (C+M+Y+K, percent) must not exceed `max`. */
  tac?: { max: number };
}

export interface ScenePass {
  name: string;
  /** Extra Ghostscript arguments for this pass, such as `-dMaxSpots=0` to flatten spots to their alternate. */
  rip?: string[];
  tol?: number;
  regions: SceneRegion[];
}

export interface SceneStructure {
  noDeviceRgbOps?: boolean;
  separations?: string[];
  overprintStates?: string[];
  pageSizePt?: [number, number];
}

export interface Scene {
  id: string;
  title: string;
  covers: string;
  /** The content profile that supplies the brand palette (LOLLY_PROFILE). */
  profile: string;
  pressProfile?: string;
  page: { width: number; height: number };
  boxes: Array<Record<string, unknown>>;
  structure?: SceneStructure;
  passes: ScenePass[];
  knownFailing?: { reason: string };
}

export const DEFAULT_TOL = 2;

/** Every scene in a directory, in file-name order. Each file is validated; a malformed one throws with its name. */
export function loadScenes(dir: string): Scene[] {
  return readdirSync(dir).filter(f => f.endsWith('.json') && f !== 'scene.schema.json').sort().map(file => {
    const scene = JSON.parse(readFileSync(join(dir, file), 'utf8')) as Scene;
    const problems = sceneProblems(scene, file);
    if (problems.length) throw new Error(`plate scene ${file}: ${problems.join('; ')}`);
    return scene;
  });
}

const HEX = /^#[0-9a-f]{6}$/i;

/** What is wrong with a scene's shape, as readable sentences. An empty list is a valid scene. */
export function sceneProblems(scene: Scene, file = scene?.id ?? 'scene'): string[] {
  const out: string[] = [];
  const need = (ok: unknown, why: string): void => { if (!ok) out.push(why); };
  need(scene && typeof scene === 'object', 'not an object');
  if (!scene || typeof scene !== 'object') return out;
  need(typeof scene.id === 'string' && file.startsWith(scene.id), 'id must be the file name stem');
  need(scene.title && scene.covers, 'title and covers are required');
  need(typeof scene.profile === 'string' && scene.profile, 'profile is required');
  need(scene.page && scene.page.width > 0 && scene.page.height > 0, 'page needs a width and a height');
  need(Array.isArray(scene.boxes) && scene.boxes.length > 0, 'boxes must be a Design row list');
  need(Array.isArray(scene.passes) && scene.passes.length > 0, 'at least one pass is required');
  if (scene.knownFailing) need(scene.knownFailing.reason?.length > 20, 'knownFailing needs a reason that says why');
  const names = new Set<string>();
  for (const pass of scene.passes ?? []) {
    need(pass.name && !names.has(pass.name), `pass name "${pass.name}" is missing or repeated`);
    names.add(pass.name);
    need(pass.regions?.length > 0, `pass "${pass.name}" has no regions`);
    for (const region of pass.regions ?? []) {
      const where = `${pass.name}/${region.name}`;
      const [x, y, w, h] = region.rect ?? [-1, -1, 0, 0];
      need(x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= scene.page?.width && y + h <= scene.page?.height, `${where}: rect leaves the page`);
      need(region.expect || region.expectFrom || region.tac, `${where}: asserts nothing`);
      const from = region.expectFrom;
      if (from) {
        const hexes = 'rgb' in from ? [from.rgb] : from.lerp.slice(0, 2) as string[];
        need(hexes.every(h2 => HEX.test(h2)), `${where}: expectFrom needs #rrggbb colours`);
      }
      for (const [plate, e] of Object.entries(region.expect ?? {})) {
        if (typeof e === 'number') continue;
        need(e.value !== undefined || e.min !== undefined || e.max !== undefined || (e.from && HEX.test(e.from)), `${where}/${plate}: states no bound`);
      }
    }
  }
  return out;
}


export interface PlateImage { width: number; height: number; data: Uint8Array }

/**
 * Reads one separation written by `gs -sDEVICE=tiffsep -sCompression=none`: a single-sample 8-bit grey TIFF in which
 * 255 is no ink and 0 is full ink. Anything else (compression, other depths) is refused rather than guessed at.
 */
export function readPlateTiff(bytes: Uint8Array): PlateImage {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const order = String.fromCharCode(bytes[0]!, bytes[1]!);
  if (order !== 'II' && order !== 'MM') throw new Error('not a TIFF');
  const le = order === 'II';
  if (v.getUint16(2, le) !== 42) throw new Error('not a classic TIFF');
  const ifd = v.getUint32(4, le);
  const count = v.getUint16(ifd, le);
  const tags = new Map<number, number[]>();
  for (let i = 0; i < count; i++) {
    const at = ifd + 2 + i * 12;
    const tag = v.getUint16(at, le), type = v.getUint16(at + 2, le), n = v.getUint32(at + 4, le);
    const size = type === 3 ? 2 : type === 4 ? 4 : 1;
    const base = n * size <= 4 ? at + 8 : v.getUint32(at + 8, le);
    const values: number[] = [];
    for (let k = 0; k < n; k++) values.push(size === 2 ? v.getUint16(base + k * 2, le) : size === 4 ? v.getUint32(base + k * 4, le) : v.getUint8(base + k));
    tags.set(tag, values);
  }
  const one = (tag: number, fallback?: number): number => {
    const got = tags.get(tag)?.[0] ?? fallback;
    if (got === undefined) throw new Error(`TIFF tag ${tag} is missing`);
    return got;
  };
  const width = one(256), height = one(257);
  if (one(259, 1) !== 1) throw new Error('compressed plate TIFF; run gs with -sCompression=none');
  if (one(258, 1) !== 8 || one(277, 1) !== 1) throw new Error('plate TIFF is not one 8-bit sample');
  const offsets = tags.get(273) ?? [], counts = tags.get(279) ?? [];
  const data = new Uint8Array(width * height);
  let at = 0;
  offsets.forEach((offset, i) => {
    const take = Math.min(counts[i] ?? data.length, data.length - at);
    data.set(bytes.subarray(offset, offset + take), at);
    at += take;
  });
  if (at < data.length) throw new Error('plate TIFF strips are short');
  return { width, height, data };
}

/** Ink percent of one plate byte. */
export const inkPercent = (byte: number): number => (255 - byte) * 100 / 255;

export interface RegionStats { mean: number; min: number; max: number }

/** Mean, minimum and maximum ink percent of a rectangle of a plate. A missing plate (no spot ink used) is blank. */
export function regionStats(plate: PlateImage | null, rect: [number, number, number, number], size: { width: number; height: number }): RegionStats {
  const [x, y, w, h] = rect;
  const width = plate?.width ?? size.width;
  let sum = 0, min = 100, max = 0, n = 0;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      const ink = plate ? inkPercent(plate.data[row * width + col]!) : 0;
      sum += ink; n++;
      if (ink < min) min = ink;
      if (ink > max) max = ink;
    }
  }
  return { mean: sum / n, min, max };
}

/** The largest per-pixel total ink (percent) across the four process plates in a rectangle. */
export function maxTotalInk(plates: Record<string, PlateImage | null>, rect: [number, number, number, number], size: { width: number; height: number }): number {
  const [x, y, w, h] = rect;
  const width = plates.C?.width ?? size.width;
  let peak = 0;
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      let total = 0;
      for (const p of PROCESS_PLATES) { const img = plates[p]; if (img) total += inkPercent(img.data[row * width + col]!); }
      if (total > peak) peak = total;
    }
  }
  return peak;
}

/** The file Ghostscript's tiffsep writes for a plate: `<base>(Cyan).tif` for process inks, `<base>(<spot name>).tif` for a spot. */
export const plateFile = (base: string, plate: Plate): string => `${base}(${GS_PLATE_NAME[plate] ?? plate}).tif`;


export type Separate = (r: number, g: number, b: number) => [number, number, number, number];

/** sRGB hex as 0 to 1 channels, which is what a press separation takes. */
const rgbOf = (hex: string): [number, number, number] => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number];
const inksOf = (sep: Separate, hex: string): number[] => sep(...rgbOf(hex)).map(v => v * 100);

export interface Bound { plate: Plate; stat: Stat; lo: number; hi: number; tol: number }

/** One region's expectations resolved to numeric bounds. `sep` turns an sRGB hex into the inks of the press condition. */
export function boundsFor(region: SceneRegion, passTol: number | undefined, sep: Separate): Bound[] {
  const baseTol = region.tol ?? passTol ?? DEFAULT_TOL;
  const baseStat = region.stat ?? 'mean';
  const bounds: Bound[] = [];
  const stated = new Set(Object.keys(region.expect ?? {}));
  const from = region.expectFrom;
  if (from) {
    const inks = 'rgb' in from
      ? inksOf(sep, from.rgb)
      : inksOf(sep, from.lerp[0]).map((a, i) => a + (inksOf(sep, from.lerp[1])[i]! - a) * from.lerp[2]);
    PROCESS_PLATES.forEach((plate, i) => {
      if (!stated.has(plate)) bounds.push({ plate, stat: baseStat, lo: inks[i]! - baseTol, hi: inks[i]! + baseTol, tol: baseTol });
    });
  }
  for (const [plate, e] of Object.entries(region.expect ?? {})) {
    if (typeof e === 'number') { bounds.push({ plate, stat: baseStat, lo: e - baseTol, hi: e + baseTol, tol: baseTol }); continue; }
    const tol = e.tol ?? baseTol;
    const stat = e.stat ?? baseStat;
    const value = e.from ? inksOf(sep, e.from)[PROCESS_PLATES.indexOf(plate as 'C')] : e.value;
    if (value !== undefined) bounds.push({ plate, stat, lo: value - tol, hi: value + tol, tol });
    else bounds.push({ plate, stat, lo: (e.min ?? 0) - 0.5, hi: (e.max ?? 100) + 0.5, tol: 0.5 });
  }
  return bounds;
}


export interface PdfFacts {
  pageSizePt: [number, number];
  /** Count of DeviceRGB `rg` and `RG` colour operators left in page content and form XObjects. */
  deviceRgbOps: number;
  separations: string[];
  /** Overprint graphics states a content stream selects, with whether the page resources define them with op and OPM 1. */
  overprint: Record<string, { used: boolean; defined: boolean }>;
}

/** Reads the facts a scene may assert out of a PDF, through pdf-lib. */
export async function pdfFacts(bytes: Uint8Array, wantStates: string[]): Promise<PdfFacts> {
  const { PDFDocument, PDFName, PDFArray, PDFDict, PDFBool, PDFNumber } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const size = doc.getPage(0).getSize();
  let deviceRgbOps = 0;
  const used = new Set<string>();
  const separations = new Set<string>();
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFArray) {
      if (obj.size() >= 2 && String(obj.get(0)) === '/Separation') separations.add(decodeName(String(obj.get(1))));
      continue;
    }
    const contents = (obj as { contents?: Uint8Array }).contents;
    const dict = (obj as { dict?: { get(name: unknown): unknown } }).dict;
    if (!(contents instanceof Uint8Array) || !dict) continue;
    const subtype = String(dict.get(PDFName.of('Subtype')) ?? '');
    if (subtype.includes('Image')) continue;
    const filter = String(dict.get(PDFName.of('Filter')) ?? '');
    let raw: Uint8Array = contents;
    if (filter.includes('FlateDecode')) { try { raw = inflateSync(contents); } catch { continue; } } else if (filter) continue;
    const text = new TextDecoder('latin1').decode(raw);
    if (!/\bBT\b|\b[fSsB]\*?\b/.test(text) || text.startsWith('<?xpacket')) continue;
    deviceRgbOps += (text.match(/(?:[+-]?[\d.]+\s+){3}(?:rg|RG)\b/g) ?? []).length;
    for (const m of text.matchAll(/\/(GS[a-z]{2})\s+gs\b/g)) used.add(m[1]!);
  }
  const overprint: PdfFacts['overprint'] = {};
  const resources = doc.getPage(0).node.Resources();
  const states = resources?.lookupMaybe(PDFName.of('ExtGState'), PDFDict);
  for (const name of wantStates) {
    const gs = states?.lookupMaybe(PDFName.of(name), PDFDict);
    const flag = gs?.lookupMaybe(PDFName.of(name.endsWith('o') ? 'op' : 'OP'), PDFBool)?.asBoolean();
    const opm = gs?.lookupMaybe(PDFName.of('OPM'), PDFNumber)?.asNumber();
    overprint[name] = { used: used.has(name), defined: flag === true && opm === 1 };
  }
  return { pageSizePt: [size.width, size.height], deviceRgbOps, separations: [...separations].sort(), overprint };
}

const decodeName = (name: string): string => name.replace(/^\//, '').replace(/#([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)));

/** Failures of a PDF against a scene's structure block. */
export function structureFailures(facts: PdfFacts, want: SceneStructure): string[] {
  const out: string[] = [];
  if (want.noDeviceRgbOps && facts.deviceRgbOps > 0) out.push(`${facts.deviceRgbOps} DeviceRGB colour operators remain in the page content`);
  if (want.pageSizePt) {
    const [w, h] = want.pageSizePt;
    if (Math.abs(facts.pageSizePt[0] - w) > 0.5 || Math.abs(facts.pageSizePt[1] - h) > 0.5) out.push(`page is ${facts.pageSizePt.join(' x ')} pt, expected ${w} x ${h}`);
  }
  for (const name of want.separations ?? []) if (!facts.separations.includes(name)) out.push(`no /Separation colour space named ${name} (found: ${facts.separations.join(', ') || 'none'})`);
  for (const name of want.overprintStates ?? []) {
    const s = facts.overprint[name];
    if (!s?.used) out.push(`no content stream selects the overprint state /${name}`);
    else if (!s.defined) out.push(`/${name} is selected but the page does not define it with overprint on and OPM 1`);
  }
  return out;
}
