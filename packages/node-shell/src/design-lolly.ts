// SPDX-License-Identifier: MPL-2.0
/**
 * A Design document as a reopenable `.lolly` session (plan 291 W8): the one writer
 * behind `lolly package` and the `lolly_package` MCP tool for Design input.
 *
 *   packageDesign(document, { assets, assetDir, source, label, ... })
 *     -> { bytes, report: DesignPackageReportV1 }
 *
 * The steps, each refusing with a `DesignPackageError` code rather than writing a
 * file that would open broken:
 *
 *   1. Expand the authoring keys and macros (`expandDesignAuthoringDocument`), so the
 *      file only ever holds stored rows. A document with none passes through as it is.
 *   2. Hash every keyed picture and sniff its type from the bytes (never the name);
 *      anything that is not a picture Design carries is refused.
 *   3. Rewrite each row whose `image` is a key, or an upload ref the asset folder
 *      or the source deck holds, to `{id: 'user/media/<sha256>', source: 'user'}`:
 *      the web intake rekeys only objects with a `source`. A placeholder that ends in
 *      a hash prefix (`photo:<sha12>`, as `lolly compose --suggest` writes) takes the one
 *      picture of the keyed files, the asset folder or the source deck whose hash starts so.
 *   4. Classify every other picture reference against the active profile's catalog.
 *      An unresolved upload, a placeholder such as `photo:title` and a catalog id the
 *      profile does not hold are refused unless `allowMissingMedia` is set.
 *   5. Check every path row's `path` decodes.
 *   6. Write the session markers the app reads (`__toolId`, `__toolVersion`, `__label`,
 *      `__export_filename`, and the size from the first frame), then the file through
 *      `buildDesignLolly`, with every zip entry stamped with `exportedAt` so one
 *      document always writes the same bytes.
 *   7. Read the file back with `readLollyFile` and check the tool, the row count, the
 *      label and every carried picture's hash.
 *
 * The compiled-document zip `lolly package` has always written for other tools is
 * `packageDocument` in the engine, untouched; `designInputShape` tells the two apart.
 */

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

import type {
  DesignPackageErrorCodeV1,
  DesignPackageMediaOriginV1,
  DesignPackageMediaV1,
  DesignPackageMissingV1,
  DesignPackageReportV1,
  DesignPackageWarningV1,
} from '@lolly-tools/core/design-package-v1';
import { DESIGN_PACKAGE_FORMAT, DESIGN_PACKAGE_VERSION } from '@lolly-tools/core/design-package-v1';
import type { DesignBriefCatalogV1 } from '@lolly/engine';
import { assetDependency } from '../../../engine/src/asset-version.ts';
import { parseTreatedAssetId } from '../../../engine/src/photo-treatment.ts';
import { expandDesignAuthoringDocument } from '../../../engine/src/design-authoring.ts';
import { decodeAuthoredPathsResult } from '../../../engine/src/geom/authored-url.ts';
import type { TokenSet } from '../../../engine/src/bridge/host-v1.ts';
import { sniffFormat, type SniffedFormat } from './format-sniff.ts';
import { readLollyFile } from './lolly-file.ts';
import { DESIGN_TOOL_ID, MEDIA_REF_PREFIX, buildDesignLolly, mediaRefFor, type PipelineMediaV1 } from './rebrand/pipeline.ts';

type Row = Record<string, unknown>;

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;
const MEDIA_REF_RE = /^user\/media\/([0-9a-f]{64})$/;
const HASH_KEY_RE = /^[a-z][a-z0-9+.-]*:([0-9a-f]{8,64})$/i;

/**
 * The hash prefix a placeholder key ends in, as `lolly compose --suggest` writes a deck's
 * pictures (`photo:<first 12 hex of the sha256>`), lower case; null for any other key.
 * `packageDesign` resolves such a key from the asset folder or the source deck when
 * exactly one picture there has a hash that starts so.
 */
export function mediaHashPrefixOfKey(key: string): string | null {
  if (/^(https?|data|blob):/i.test(key)) return null;
  const m = HASH_KEY_RE.exec(key);
  return m ? m[1]!.toLowerCase() : null;
}
const listOf = (items: readonly string[], max = 6): string =>
  items.slice(0, max).join(', ') + (items.length > max ? ` and ${items.length - max} more` : '');

/** A refusal or failure with a stable code a surface maps to its own exit code or error. */
export class DesignPackageError extends Error {
  readonly code: DesignPackageErrorCodeV1;
  /** What the code is about, for a caller that lists it (layer ids, refs, keys). */
  readonly detail?: Record<string, unknown>;
  constructor(code: DesignPackageErrorCodeV1, message: string, detail?: Record<string, unknown>) {
    super(message);
    this.name = 'DesignPackageError';
    this.code = code;
    if (detail) this.detail = detail;
  }
}

export interface DesignPackageAssetV1 {
  /** The exact `image` value rows name the picture by: a placeholder, a path, or `user/media/<sha256>`. */
  key: string;
  bytes: Uint8Array;
  /** The file name, for messages. */
  name?: string;
}

export interface DesignPackageOptions {
  /** Keyed pictures (`--asset=KEY=PATH`). */
  assets?: ReadonlyArray<DesignPackageAssetV1>;
  /** A folder of `<sha256>.<ext>` pictures, the layout `lolly read --media` writes, for `user/media/<sha256>` refs. */
  assetDir?: string;
  /** A deck (.pptx, .pdf, .psd) or `.lolly` whose pictures resolve `user/media/<sha256>` refs. */
  source?: { bytes: Uint8Array; name: string };
  /** The document's name. Defaults to the session's own `__label`, then `fileStem`, then "Design". */
  label?: string;
  /** The token theme authoring styles resolve in. */
  theme?: string;
  /** A design brief (`designBrief`), the base layer of the authoring text styles. */
  brief?: unknown;
  /** Named authoring text styles, over the brief's. */
  styles?: Record<string, unknown>;
  /**
   * The brand's tokens, in the theme the literals are cached in (plan 291 W4). Colour
   * references (`{color.role.muted-ink}`, `{@path …|text}` runs, `$tint`) are then
   * stored as the literal plus a `tokenLinks` entry. Left out, they are stored as
   * written for the runtime to lower when the document opens.
   */
  tokens?: TokenSet | null;
  /** ISO time for the manifest and every zip entry. Defaults to SOURCE_DATE_EPOCH, else now. */
  exportedAt?: string;
  /** Write unresolved pictures as references instead of refusing. */
  allowMissingMedia?: boolean;
  /** The input file's name without its extension, the label of last resort. */
  fileStem?: string;
  /** The catalog to check ids against. Left out, the active content profile's; null checks none. */
  catalog?: Pick<DesignBriefCatalogV1, 'assets'> & { profile?: string } | null;
  /** The Design tool version to record. Left out, the profile's `design` manifest's. */
  toolVersion?: string;
  /** How a refusal tells the caller to fix it, in the caller's own option names. Left out, these options' names. */
  hints?: Partial<DesignPackageHintsV1>;
}

/**
 * The remedies a `media.missing` refusal names, worded for the surface that calls:
 * the CLI gives its flags, the MCP tool its arguments. Each is a clause that follows
 * "give" or "or", such as "pass --allow-missing-media".
 */
export interface DesignPackageHintsV1 {
  /** How to give a placeholder its picture. */
  asset: string;
  /** How to give `user/media/<sha256>` refs their bytes. */
  upload: string;
  /** How to write unresolved pictures as references instead. */
  allowMissing: string;
}

/** The hints in this module's own option names, for a library caller. */
export const DESIGN_PACKAGE_HINTS: Readonly<DesignPackageHintsV1> = {
  asset: 'give each placeholder a file in assets',
  upload: 'give the folder lolly read wrote as assetDir, or the deck as source',
  allowMissing: 'set allowMissingMedia',
};

/** Edit distance, for naming the key a misspelled one was meant to be. */
function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) next[j] = Math.min(prev[j]! + 1, next[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = next;
  }
  return prev[b.length]!;
}

/** The ref a misspelled key most likely meant, when one is close. */
function closestRef(key: string, refs: readonly string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const ref of refs) {
    const d = editDistance(key, ref);
    if (d < bestDistance) [best, bestDistance] = [ref, d];
  }
  return best !== undefined && bestDistance <= Math.max(2, Math.floor(key.length / 4)) ? best : undefined;
}

/** "No layer names photo:titl (did you mean photo:title?)", for keys given that matched nothing. */
function unusedKeyNote(unused: readonly string[], refs: readonly string[]): string {
  if (!unused.length) return '';
  const named = unused.map((key) => {
    const near = closestRef(key, refs);
    return near ? `${key} (did you mean ${near}?)` : key;
  });
  return ` No layer names ${listOf(named)}, so ${unused.length === 1 ? 'that file was' : 'those files were'} not used.`;
}

/** Which writer an input belongs to. */
export type DesignInputShapeV1 = 'design' | 'compiled' | 'other';

/**
 * A Design document (a boxes array, `{boxes}`, `{values: {boxes}}`, a saved session),
 * a compiled document (`{toolId, hydrated}` or a compile result `{document}`), or neither.
 */
export function designInputShape(value: unknown): DesignInputShapeV1 {
  if (Array.isArray(value)) return 'design';
  if (!record(value)) return 'other';
  if ((typeof value.toolId === 'string' && value.hydrated !== undefined) || (record(value.document) && typeof value.document.toolId === 'string')) return 'compiled';
  if (Array.isArray(value.boxes)) return 'design';
  if (record(value.values) && Array.isArray(value.values.boxes)) return 'design';
  return 'other';
}

/** The Design tool version on this profile, the one place the writers read it from. */
export async function designToolVersion(): Promise<string | undefined> {
  try {
    const { readToolManifest } = await import('./content-roots.ts');
    const manifest = readToolManifest(DESIGN_TOOL_ID) as { version?: unknown };
    return typeof manifest.version === 'string' ? manifest.version : undefined;
  } catch {
    return undefined;
  }
}

/** When a package is written: SOURCE_DATE_EPOCH (whole seconds) when set, else now. */
export function packageTime(env: Record<string, string | undefined> = process.env): string {
  const epoch = env.SOURCE_DATE_EPOCH;
  if (epoch && /^\d+$/.test(epoch)) return new Date(Number(epoch) * 1000).toISOString();
  return new Date().toISOString();
}

/** An ISO time held inside the 1980 to 2099 range a zip entry stores, in UTC. */
function zipInstantOf(exportedAt: string): Date {
  const at = new Date(exportedAt).getTime();
  const floor = Date.UTC(1980, 0, 2);
  const ceiling = Date.UTC(2099, 11, 30);
  return new Date(Number.isNaN(at) || at < floor ? floor : Math.min(at, ceiling));
}

/**
 * The zip entry time to hand the writer: a local Date whose wall clock reads the UTC
 * time, since fflate packs the DOS fields with local-time getters. `stampZipTimes`
 * then writes the exact UTC fields, which also covers an hour a local clock skips.
 */
function zipTimeOf(exportedAt: string): Date {
  const at = zipInstantOf(exportedAt);
  return new Date(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate(), at.getUTCHours(), at.getUTCMinutes(), at.getUTCSeconds());
}

/**
 * Stamp every entry of a zip this module wrote with the UTC wall time of `exportedAt`,
 * in both the local headers and the central directory, so one SOURCE_DATE_EPOCH writes
 * the same bytes whatever time zone the machine is in. Returns a stamped copy.
 */
export function stampZipTimes(bytes: Uint8Array, exportedAt: string): Uint8Array {
  const at = zipInstantOf(exportedAt);
  const time = (at.getUTCHours() << 11) | (at.getUTCMinutes() << 5) | (at.getUTCSeconds() >> 1);
  const date = ((at.getUTCFullYear() - 1980) << 9) | ((at.getUTCMonth() + 1) << 5) | at.getUTCDate();
  const out = new Uint8Array(bytes);
  const view = new DataView(out.buffer, out.byteOffset, out.byteLength);
  const fail = (why: string): never => {
    throw new DesignPackageError('export.failed', `The .lolly zip could not be stamped: ${why}.`);
  };
  const end = out.byteLength - 22; // the writer adds no archive comment
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) fail('no end of central directory');
  const count = view.getUint16(end + 10, true);
  let entry = view.getUint32(end + 16, true);
  for (let i = 0; i < count; i += 1) {
    if (entry + 46 > out.byteLength || view.getUint32(entry, true) !== 0x02014b50) fail(`central entry ${i} is not where the directory says`);
    view.setUint16(entry + 12, time, true);
    view.setUint16(entry + 14, date, true);
    const local = view.getUint32(entry + 42, true);
    if (local + 30 > out.byteLength || view.getUint32(local, true) !== 0x04034b50) fail(`local header ${i} is not where the directory says`);
    view.setUint16(local + 10, time, true);
    view.setUint16(local + 12, date, true);
    entry += 46 + view.getUint16(entry + 28, true) + view.getUint16(entry + 30, true) + view.getUint16(entry + 32, true);
  }
  return out;
}

/** Sniffed format to the MIME type the writer files it under. Formats Design does not carry are absent. */
const IMAGE_MIME: Partial<Record<SniffedFormat, string>> = {
  png: 'image/png',
  apng: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  tiff: 'image/tiff',
  emf: 'image/x-emf',
};

interface Held extends PipelineMediaV1 {
  sha256: string;
  origin: DesignPackageMediaOriginV1;
}

function heldAsset(asset: DesignPackageAssetV1): Held {
  const what = asset.name ? `${asset.name} (for ${asset.key})` : `The file for ${asset.key}`;
  if (!asset.bytes.length) throw new DesignPackageError('asset.invalid', `${what} is empty.`, { key: asset.key });
  const format = sniffFormat(asset.bytes);
  const mime = format ? IMAGE_MIME[format] : undefined;
  if (!mime)
    throw new DesignPackageError(
      'asset.not-image',
      `${what} is ${format ? `a ${format} file` : 'not a file type Lolly recognises'}; Design carries PNG, JPEG, GIF, WebP, SVG, BMP, TIFF or EMF pictures.`,
      { key: asset.key, format },
    );
  return { bytes: asset.bytes, mime, sha256: sha256Hex(asset.bytes), origin: 'asset' };
}

/** The pictures a source deck or `.lolly` holds, by upload ref. */
async function sourceMedia(source: { bytes: Uint8Array; name: string }): Promise<Map<string, PipelineMediaV1>> {
  if (/\.lolly$/i.test(source.name)) {
    let contents: ReturnType<typeof readLollyFile>;
    try {
      contents = readLollyFile(source.bytes);
    } catch (err) {
      throw new DesignPackageError('input.unreadable', `The source ${source.name} could not be read: ${(err as Error).message}`);
    }
    const out = new Map<string, PipelineMediaV1>();
    const assets = (contents.manifest as { assets?: Array<{ id?: unknown; path?: unknown; mime?: unknown }> }).assets ?? [];
    for (const asset of assets) {
      if (typeof asset.id !== 'string' || typeof asset.path !== 'string') continue;
      const part = contents.files.get(asset.path);
      if (part) out.set(asset.id, { bytes: part, mime: typeof asset.mime === 'string' ? asset.mime : '' });
    }
    return out;
  }
  // Read through the content inventory, not the bare deck reader: the inventory adds
  // each drawing's own SVG part (a pptx svgBlip) to the media, and `lolly compose
  // --suggest` keys those pictures by that SVG's hash. Reading the deck any other way
  // would leave its own suggested keys without bytes here.
  const { readContentInventory } = await import('./content-inventory.ts');
  try {
    const read = await readContentInventory({ bytes: source.bytes, name: source.name });
    return read.media;
  } catch (err) {
    throw new DesignPackageError('input.unreadable', `The source ${source.name} could not be read: ${(err as Error).message}`);
  }
}

/** `<hex>.<ext>` files in the folder, by hex. */
async function folderIndex(dir: string): Promise<Map<string, string>> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch (err) {
    throw new DesignPackageError('asset.invalid', `The asset folder ${dir} could not be read: ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}.`);
  }
  const out = new Map<string, string>();
  for (const name of names.sort()) {
    const m = /^([0-9a-f]{64})\.[A-Za-z0-9]+$/.exec(name);
    if (m && !out.has(m[1]!)) out.set(m[1]!, join(dir, name));
  }
  return out;
}

/** What one row's `image` value is. */
type ImageClass =
  | { kind: 'none' }
  | { kind: 'key'; key: string }
  | { kind: 'upload'; ref: string; hex: string }
  | { kind: 'external' }
  | { kind: 'catalog'; id: string }
  | { kind: 'unresolved'; ref: string };

function imageId(value: unknown): string {
  if (typeof value === 'string') return value;
  if (record(value) && typeof value.id === 'string') return value.id;
  return '';
}

function classify(id: string, keys: ReadonlyMap<string, Held>): ImageClass {
  if (!id) return { kind: 'none' };
  if (keys.has(id)) return { kind: 'key', key: id };
  const upload = MEDIA_REF_RE.exec(id);
  if (upload) return { kind: 'upload', ref: id, hex: upload[1]! };
  if (/^(https?:|data:)/i.test(id)) return { kind: 'external' };
  // Another device's upload id, a blob: URL or a scheme-like placeholder (photo:title):
  // nothing here can resolve such a reference.
  if (id.startsWith('user/') || /^[a-z][a-z0-9+.-]*:/i.test(id)) return { kind: 'unresolved', ref: id };
  return { kind: 'catalog', id };
}

const layerIdOf = (row: Row, index: number): string => (typeof row.id === 'string' && row.id ? row.id : `#${index}`);

function pushLayer(map: Map<string, string[]>, key: string, layer: string): void {
  const list = map.get(key);
  if (list) {
    if (!list.includes(layer)) list.push(layer);
  } else map.set(key, [layer]);
}

/** The active profile's catalog, or null when none resolves. */
async function profileCatalog(): Promise<(Pick<DesignBriefCatalogV1, 'assets'> & { profile?: string }) | null> {
  try {
    const { readProfileBriefCatalog } = await import('./design-brief.ts');
    return readProfileBriefCatalog();
  } catch {
    return null;
  }
}

/**
 * Write a Design document as a `.lolly` session, read it back, and report. Throws a
 * `DesignPackageError` for every refusal; never writes a partial file.
 */
export async function packageDesign(input: unknown, opts: DesignPackageOptions = {}): Promise<{ bytes: Uint8Array; report: DesignPackageReportV1 }> {
  const shape = designInputShape(input);
  if (shape !== 'design')
    throw new DesignPackageError(
      'input.unsupported',
      shape === 'compiled'
        ? 'This is a compiled document; packageDesign writes Design documents (a boxes array, {boxes} or {values: {boxes}}).'
        : 'Supply a Design document: a boxes array, an object with boxes, or Design input values.',
    );

  // 1. Authoring keys and macros become stored rows.
  let expanded: ReturnType<typeof expandDesignAuthoringDocument>;
  try {
    expanded = expandDesignAuthoringDocument(input, {
      ...(opts.brief !== undefined ? { brief: opts.brief } : {}),
      ...(opts.styles ? { styles: opts.styles as never } : {}),
      ...(opts.theme ? { theme: opts.theme } : {}),
      ...(opts.tokens ? { tokens: opts.tokens } : {}),
    });
  } catch (err) {
    throw new DesignPackageError('authoring.invalid', (err as Error).message);
  }
  const warnings: DesignPackageWarningV1[] = expanded.notes.map((n) => ({ code: 'authoring.note', message: `${n.code}: ${n.message}`, ...(n.path ? { path: n.path } : {}) }));

  // 2. Keyed pictures, hashed and sniffed.
  const keys = new Map<string, Held>();
  for (const asset of opts.assets ?? []) {
    if (!asset.key) throw new DesignPackageError('asset.invalid', 'An asset needs a key: the image value the rows name it by (KEY=PATH).');
    const held = heldAsset(asset);
    const prior = keys.get(asset.key);
    if (prior && prior.sha256 !== held.sha256)
      throw new DesignPackageError('asset.invalid', `Two different files are given for ${asset.key}.`, { key: asset.key });
    const shaped = MEDIA_REF_RE.exec(asset.key);
    if (shaped && shaped[1] !== held.sha256)
      throw new DesignPackageError('media.mismatch', `${asset.key} names a picture by its hash, and ${asset.name ?? 'the file given'} hashes to ${held.sha256}.`, { key: asset.key, sha256: held.sha256 });
    keys.set(asset.key, held);
  }

  // 3 and 4. Rewrite and classify every row's picture.
  const rows = expanded.rows.map((row) => ({ ...row }));
  const catalog = opts.catalog === undefined ? await profileCatalog() : opts.catalog;
  const catalogIds = catalog ? new Set((catalog.assets ?? []).map((a) => a.id)) : null;
  const usedKeys = new Set<string>();
  const neededUploads = new Map<string, string[]>(); // hex -> layers
  const unresolved = new Map<string, string[]>();
  const unknown = new Map<string, string[]>();
  const keyLayers = new Map<string, string[]>(); // ref -> layers
  const unresolvedRows = new Map<string, Row[]>(); // placeholder -> the rows that name it
  const refKeys = new Map<string, string[]>(); // ref -> keys
  let catalogCount = 0;
  let unchecked = 0;
  let external = 0;
  const pathProblems: string[] = [];
  rows.forEach((row, index) => {
    const layer = layerIdOf(row, index);
    if (row.kind === 'path') {
      const path = typeof row.path === 'string' ? row.path.trim() : '';
      if (!path) warnings.push({ code: 'path.empty', message: `Path layer ${layer} has no path and draws nothing.`, path: `/boxes/${index}/path` });
      else {
        const decoded = decodeAuthoredPathsResult(path);
        if (typeof decoded === 'string') pathProblems.push(`${layer} (${decoded}, /boxes/${index}/path)`);
      }
    }
    if (!('image' in row)) return;
    // A photo look rides on the picture's id (`photo:title?treatment=brand-grade`, plan
    // 291 W7): the picture is classified and carried by its base id, and the look is
    // kept on the row's ref, so the bytes travel once whatever looks the rows give them.
    const raw = imageId(row.image);
    const looked = parseTreatedAssetId(raw);
    const modifier = looked.treatment ? raw.slice(looked.baseId.length) : '';
    const id = looked.treatment ? looked.baseId : raw;
    const kind = classify(id, keys);
    if (kind.kind === 'key') {
      const held = keys.get(kind.key)!;
      const ref = mediaRefFor(held.sha256);
      usedKeys.add(kind.key);
      row.image = { id: ref + modifier, source: 'user' };
      pushLayer(keyLayers, ref, layer);
      const named = refKeys.get(ref) ?? [];
      if (!named.includes(kind.key)) named.push(kind.key);
      refKeys.set(ref, named);
    } else if (kind.kind === 'upload') {
      row.image = { id: kind.ref + modifier, source: 'user' };
      pushLayer(neededUploads, kind.hex, layer);
    } else if (kind.kind === 'external') external += 1;
    else if (kind.kind === 'unresolved') {
      pushLayer(unresolved, kind.ref, layer);
      unresolvedRows.set(kind.ref, [...(unresolvedRows.get(kind.ref) ?? []), row]);
    }
    else if (kind.kind === 'catalog') {
      if (!catalogIds) unchecked += 1;
      else if (catalogIds.has(assetDependency({ id: kind.id }).id)) catalogCount += 1;
      else pushLayer(unknown, kind.id, layer);
    }
  });
  if (pathProblems.length)
    throw new DesignPackageError('path.invalid', `${plural(pathProblems.length, 'path layer')} will not decode: ${listOf(pathProblems)}.`, { layers: pathProblems });

  // Upload refs: a keyed file with that hash, then the folder, then the source.
  const media = new Map<string, Held>();
  for (const [ref] of keyLayers) {
    const held = [...keys.values()].find((h) => mediaRefFor(h.sha256) === ref)!;
    media.set(ref, held);
  }
  const byHash = new Map([...keys].map(([key, h]) => [h.sha256, { key, held: h }]));
  const hashKeyed = [...unresolved.keys()].filter((ref) => mediaHashPrefixOfKey(ref) !== null);
  const folder = opts.assetDir && (neededUploads.size || hashKeyed.length) ? await folderIndex(opts.assetDir) : null;
  let fromSource: Map<string, PipelineMediaV1> | null = null;
  const missingUploads = new Map<string, string[]>();
  for (const [hex, layers] of neededUploads) {
    const ref = `${MEDIA_REF_PREFIX}${hex}`;
    if (media.has(ref)) {
      for (const l of layers) pushLayer(keyLayers, ref, l);
      continue;
    }
    const keyed = byHash.get(hex);
    if (keyed) {
      media.set(ref, keyed.held);
      usedKeys.add(keyed.key);
      refKeys.set(ref, [keyed.key]);
      for (const l of layers) pushLayer(keyLayers, ref, l);
      continue;
    }
    let found: Held | null = null;
    const file = folder?.get(hex);
    if (file) {
      const bytes = new Uint8Array(await readFile(file));
      const held = heldAsset({ key: ref, bytes, name: file });
      if (held.sha256 !== hex)
        throw new DesignPackageError('media.mismatch', `${file} is named for ${hex} and hashes to ${held.sha256}.`, { file, sha256: held.sha256 });
      found = { ...held, origin: 'asset-dir' };
    }
    if (!found && opts.source) {
      fromSource ??= await sourceMedia(opts.source);
      const part = fromSource.get(ref);
      if (part && sha256Hex(part.bytes) === hex) {
        const held = heldAsset({ key: ref, bytes: part.bytes, name: opts.source.name });
        found = { ...held, origin: 'source' };
      }
    }
    if (found) {
      media.set(ref, found);
      for (const l of layers) pushLayer(keyLayers, ref, l);
    } else missingUploads.set(ref, layers);
  }

  // Placeholders that end in a picture's hash (photo:<sha12>): the keyed files, the folder
  // and the source deck each offer their pictures, and a key takes the one whose hash
  // starts with its tail. Two pictures sharing the prefix leave the key unresolved.
  if (hashKeyed.length && opts.source) fromSource ??= await sourceMedia(opts.source);
  for (const ref of hashKeyed) {
    const prefix = mediaHashPrefixOfKey(ref)!;
    const hexes = new Set<string>();
    for (const hex of byHash.keys()) if (hex.startsWith(prefix)) hexes.add(hex);
    for (const hex of folder?.keys() ?? []) if (hex.startsWith(prefix)) hexes.add(hex);
    for (const upload of fromSource?.keys() ?? []) {
      const hex = MEDIA_REF_RE.exec(upload)?.[1];
      if (hex?.startsWith(prefix)) hexes.add(hex);
    }
    if (hexes.size !== 1) continue;
    const hex = [...hexes][0]!;
    const mediaRef = `${MEDIA_REF_PREFIX}${hex}`;
    let found: Held | null = media.get(mediaRef) ?? byHash.get(hex)?.held ?? null;
    const file = found ? undefined : folder?.get(hex);
    if (file) {
      const held = heldAsset({ key: ref, bytes: new Uint8Array(await readFile(file)), name: file });
      if (held.sha256 !== hex)
        throw new DesignPackageError('media.mismatch', `${file} is named for ${hex} and hashes to ${held.sha256}.`, { file, sha256: held.sha256 });
      found = { ...held, origin: 'asset-dir' };
    }
    const part = found ? undefined : fromSource?.get(mediaRef);
    if (part && sha256Hex(part.bytes) === hex) found = { ...heldAsset({ key: ref, bytes: part.bytes, name: opts.source?.name }), origin: 'source' };
    if (!found) continue;
    if (!media.has(mediaRef)) media.set(mediaRef, found);
    const keyed = byHash.get(hex);
    if (keyed) usedKeys.add(keyed.key);
    for (const row of unresolvedRows.get(ref) ?? []) {
      const prior = imageId(row.image);
      const looked = parseTreatedAssetId(prior);
      row.image = { id: mediaRef + (looked.treatment ? prior.slice(looked.baseId.length) : ''), source: 'user' };
    }
    for (const l of unresolved.get(ref) ?? []) pushLayer(keyLayers, mediaRef, l);
    const named = refKeys.get(mediaRef) ?? [];
    if (!named.includes(ref)) named.push(ref);
    refKeys.set(mediaRef, named);
    unresolved.delete(ref);
  }

  const missing: DesignPackageMissingV1[] = [...missingUploads, ...unresolved].map(([ref, layers]) => ({ ref, layers }));
  const unknownList: DesignPackageMissingV1[] = [...unknown].map(([ref, layers]) => ({ ref, layers }));
  const unusedAssets = [...keys.keys()].filter((k) => !usedKeys.has(k));
  if (!opts.allowMissingMedia) {
    const hints = { ...DESIGN_PACKAGE_HINTS, ...opts.hints };
    // A key that matched no layer is the likely cause of a refusal, so the refusal says so.
    const unusedNote = (refs: readonly string[]): string => unusedKeyNote(unusedAssets, refs);
    if (missing.length) {
      const hashed = [...unresolved.keys()].some((ref) => mediaHashPrefixOfKey(ref) !== null);
      const hint = [unresolved.size ? hints.asset : '', missingUploads.size || hashed ? hints.upload : ''].filter(Boolean).join('; ');
      throw new DesignPackageError(
        'media.missing',
        `${plural(missing.length, 'picture')} ${missing.length === 1 ? 'has' : 'have'} no bytes: ${listOf(missing.map((m) => `${m.ref} (${listOf(m.layers, 3)})`))}.${unusedNote(missing.map((m) => m.ref))} ${hint[0]!.toUpperCase()}${hint.slice(1)}, or ${hints.allowMissing} to write them as references.`,
        { missing, ...(unusedAssets.length ? { unusedAssets } : {}) },
      );
    }
    if (unknownList.length)
      throw new DesignPackageError(
        'reference.unknown',
        `${plural(unknownList.length, 'catalog id')} ${unknownList.length === 1 ? 'is' : 'are'} not in the ${catalog?.profile ?? 'active'} profile: ${listOf(unknownList.map((m) => `${m.ref} (${listOf(m.layers, 3)})`))}.${unusedNote(unknownList.map((m) => m.ref))}`,
        { unknown: unknownList, ...(unusedAssets.length ? { unusedAssets } : {}) },
      );
  } else {
    for (const m of missing) warnings.push({ code: 'media.missing', message: `${m.ref} is written as a reference with no bytes (${listOf(m.layers, 3)}).` });
    for (const m of unknownList) warnings.push({ code: 'reference.unknown', message: `${m.ref} is not in the ${catalog?.profile ?? 'active'} profile (${listOf(m.layers, 3)}).` });
  }
  if (unchecked) warnings.push({ code: 'reference.unchecked', message: `No content profile resolved, so ${plural(unchecked, 'catalog reference')} could not be checked.` });
  if (external) warnings.push({ code: 'reference.external', message: `${plural(external, 'layer')} draw${external === 1 ? 's' : ''} a picture from a URL, left as written.` });
  for (const key of unusedAssets) warnings.push({ code: 'asset.unused', message: `No layer names ${key}; its file was not carried.` });

  // 6. The session markers, then the file.
  const values: Row = { ...expanded.values, boxes: rows };
  const first = rows.find((r) => r.kind === 'frame');
  const width = Number(first?.w);
  const height = Number(first?.h);
  const ownLabel = typeof values.__label === 'string' && values.__label.trim() ? values.__label.trim() : '';
  const label = opts.label?.trim() || ownLabel || opts.fileStem?.trim() || 'Design';
  const ownFilename = typeof values.__export_filename === 'string' && values.__export_filename ? values.__export_filename : '';
  // The editor shows `__export_filename` as the document name in its name field and
  // top bar, so it holds the label as typed, the way the app's own rename writes the name. A
  // download makes it file-safe at save time (plan 291 W8).
  const filename = opts.label?.trim() || !ownFilename ? label : ownFilename;
  const toolVersion = opts.toolVersion ?? (await designToolVersion());
  values.__toolId = DESIGN_TOOL_ID;
  if (toolVersion) values.__toolVersion = toolVersion;
  else delete values.__toolVersion;
  values.__label = label;
  values.__export_filename = filename;
  const sized = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0;
  if (sized && values.__export_width === undefined && values.__export_height === undefined) {
    values.__export_width = String(width);
    values.__export_height = String(height);
    values.__export_unit = 'px';
  }

  const mediaRefs = [...new Set([...media.keys(), ...(opts.allowMissingMedia ? [...missingUploads.keys()] : [])])];
  const exportedAt = opts.exportedAt ?? packageTime();
  if (Number.isNaN(new Date(exportedAt).getTime())) throw new DesignPackageError('input.unreadable', `exportedAt is not a time: ${exportedAt}.`);
  const written = await buildDesignLolly({
    session: { values, mediaRefs },
    media,
    name: label,
    ...(toolVersion ? { toolVersion } : {}),
    exportedAt,
    zipTime: zipTimeOf(exportedAt),
  });
  const bytes = stampZipTimes(written.bytes, exportedAt);

  // 7. Readback.
  const readback = verifyReadback(bytes, { rows: rows.length, label, filename, media: [...media.keys()] });

  const exportWidth = Number(values.__export_width);
  const exportHeight = Number(values.__export_height);
  const report: DesignPackageReportV1 = {
    format: DESIGN_PACKAGE_FORMAT,
    version: DESIGN_PACKAGE_VERSION,
    bytes: bytes.byteLength,
    sha256: sha256Hex(bytes),
    exportedAt,
    tool: { id: 'design', ...(toolVersion ? { version: toolVersion } : {}) },
    label,
    filename,
    size: exportWidth > 0 && exportHeight > 0 ? { width: exportWidth, height: exportHeight, unit: 'px' } : null,
    artboards: rows.filter((r) => r.kind === 'frame').length,
    layers: rows.length,
    expanded: expanded.expanded,
    media: [...media].map(([ref, held]): DesignPackageMediaV1 => ({
      ref,
      sha256: held.sha256,
      mime: held.mime,
      bytes: held.bytes.byteLength,
      origin: held.origin,
      keys: refKeys.get(ref) ?? [ref],
      layers: keyLayers.get(ref) ?? [],
    })),
    references: {
      ...(catalog?.profile ? { profile: catalog.profile } : {}),
      catalog: catalogCount,
      unchecked,
      external,
      unknown: opts.allowMissingMedia ? unknownList : [],
    },
    missingMedia: opts.allowMissingMedia ? missing : [],
    unusedAssets,
    warnings,
    readback,
    next: ['lolly check <file.lolly>', 'lolly run <file.lolly> --export=pptx'],
  };
  return { bytes, report };
}

/** Open the written file again and hold it to what was written. */
function verifyReadback(
  bytes: Uint8Array,
  want: { rows: number; label: string; filename: string; media: string[] },
): DesignPackageReportV1['readback'] {
  const fail = (why: string): never => {
    throw new DesignPackageError('export.failed', `The .lolly did not read back as written: ${why}.`);
  };
  let contents: ReturnType<typeof readLollyFile>;
  try {
    contents = readLollyFile(bytes);
  } catch (err) {
    return fail((err as Error).message);
  }
  if (contents.manifest.kind !== 'session') fail(`its kind is ${String(contents.manifest.kind)}`);
  if (contents.manifest.tool?.id !== DESIGN_TOOL_ID) fail(`its tool is ${String(contents.manifest.tool?.id)}`);
  const boxes = contents.session.boxes;
  if (!Array.isArray(boxes) || boxes.length !== want.rows) fail(`it holds ${Array.isArray(boxes) ? boxes.length : 'no'} rows of ${want.rows}`);
  if (contents.session.__label !== want.label) fail('its label differs');
  if (contents.session.__export_filename !== want.filename) fail('its export name differs');
  const assets = contents.manifest.assets ?? [];
  let carried = 0;
  for (const ref of want.media) {
    const asset = assets.find((a) => a.id === ref);
    const part = typeof asset?.path === 'string' ? contents.files.get(asset.path) : undefined;
    if (!part) fail(`${ref} is not carried`);
    else if (`${MEDIA_REF_PREFIX}${sha256Hex(part)}` !== ref) fail(`${ref} does not hash to its ref`);
    carried += 1;
  }
  return { ok: true, layers: want.rows, media: carried, label: want.label, filename: want.filename };
}
