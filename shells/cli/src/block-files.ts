// SPDX-License-Identifier: MPL-2.0
/**
 * Local picture files into `blocks` rows (plan 334, decision 4).
 *
 * A blocks input that declares `dropToAdd: { field, accept }` takes a pile of files
 * in the web shell: each dropped file becomes one row, with the file in the named
 * asset field and every other field at its default. This module is the CLI twin, so
 * `lolly run logo-wall logos/*.png --output=wall.svg` builds a wall. Files arrive
 * three ways, all appended in this order:
 *
 *   1. positional arguments after the tool id (a shell glob), when the tool has
 *      exactly one dropToAdd input;
 *   2. `--<input>-file=<path>`, repeatable; `-` reads one file's bytes from stdin;
 *   3. `--<input>-files=<list>`, a file holding one path per line, or the same
 *      list on stdin with `-` (`ls logos/*.svg | lolly run logo-wall --logos-files=-`).
 *
 * Each file is read into the baked, in-memory asset ref a web upload produces (the
 * bytes ride in a data: URL), so the renderer resolves it through the same asset
 * path as any other picture. The rows go after any the run already has
 * (`--logos=…`, `--logos-data=rows.csv`), as a drop adds to a list.
 *
 * `bakeLocalBlockAssets` also reads a path written INTO a row, such as a `logo`
 * column in a CSV or `--logos='[{"logo":"./a.png"}]'`, from disk, the way a
 * top-level `--logo=./brand.png` is. Two rules keep that read to what the person
 * running the command asked for: a file is read only when its bytes are a picture
 * (a CSV someone sent cannot pull `~/.aws/credentials` into the exported SVG), and a
 * path inside a link (a pasted lolly.tools URL, a `z=` or `zx=` state) is refused,
 * because a link cannot choose files on the computer that opens the link.
 */

import { open, readFile, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, extname, join, resolve } from 'node:path';
import { refused, usageError } from './exit-codes.ts';

/** The parts of a blocks sub-field this module reads. */
interface FieldLike {
  id: string;
  type?: string;
  default?: unknown;
  min?: number;
  options?: ReadonlyArray<{ value: unknown }>;
}

/** The parts of a manifest input this module reads. */
export interface DropInputLike {
  id: string;
  type?: string;
  label?: string;
  fields?: readonly FieldLike[];
  dropToAdd?: { field: string; accept?: string };
}

/** Every blocks input that takes dropped files into a declared asset field. */
export function dropToAddInputs(manifest: { inputs?: readonly DropInputLike[] }): DropInputLike[] {
  return (manifest.inputs ?? []).filter((input) => input.type === 'blocks'
    && !!input.dropToAdd?.field
    && (input.fields ?? []).some((f) => f.id === input.dropToAdd!.field && f.type === 'asset'));
}

/** The two flags a dropToAdd input takes: one file each, and a list of paths. */
export function dropFlags(inputId: string): { one: string; list: string } {
  return { one: `${inputId}-file`, list: `${inputId}-files` };
}

const EXT_MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml', '.jxl': 'image/jxl',
  '.bmp': 'image/bmp', '.tif': 'image/tiff', '.tiff': 'image/tiff', '.heic': 'image/heic',
};

/**
 * A picture's MIME type, read from its leading bytes. The file name only tells AVIF
 * from HEIC, which share one container; a file whose bytes are not a picture is
 * `application/octet-stream` whatever it is called, so `notes.png` holding text is
 * not taken for a picture.
 */
export function imageMime(name: string, bytes: Uint8Array): string {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return EXT_MIME[extname(name).toLowerCase()] === 'image/heic' ? 'image/heic' : 'image/avif';
  if ((b[0] === 0xff && b[1] === 0x0a) || (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0x0c && b[4] === 0x4a && b[5] === 0x58)) return 'image/jxl';
  if (b[0] === 0x42 && b[1] === 0x4d && b.length >= 26) return 'image/bmp';
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return 'image/tiff';
  const head = Buffer.from(b.subarray(0, 512)).toString('utf8');
  if (/<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return 'application/octet-stream';
}

/** The leading bytes of a file, enough for `imageMime` to sniff. */
async function headBytes(path: string): Promise<Uint8Array> {
  const fh = await open(path, 'r');
  try {
    const buf = new Uint8Array(512);
    const { bytesRead } = await fh.read(buf, 0, buf.length, 0);
    return buf.subarray(0, bytesRead);
  } finally {
    await fh.close();
  }
}

/** Whether a MIME type passes a dropToAdd `accept` filter, the web shell's rule. */
export function acceptsMime(accept: string | undefined, mime: string): boolean {
  const filter = (accept || 'image/*').trim().toLowerCase();
  if (!filter || filter === '*' || filter === '*/*') return true;
  const t = mime.toLowerCase();
  return filter.split(',').some((a) => {
    const want = a.trim();
    return want.endsWith('/*') ? t.startsWith(want.slice(0, -1)) : t === want;
  });
}

/** One picture's bytes as the baked asset ref a web upload produces. */
export async function bakedImageRef(name: string, bytes: Uint8Array, mime: string): Promise<Record<string, unknown>> {
  const isVec = mime === 'image/svg+xml';
  const { prepareJxlAsset } = await import('@lolly-tools/node-shell/jxl-asset');
  return await prepareJxlAsset({
    source: 'user',
    id: name,
    type: isVec ? 'vector' : 'raster',
    format: isVec ? 'svg' : (mime.split('/')[1] || 'png'),
    url: `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`,
    meta: { baked: true, name },
  } as Parameters<typeof prepareJxlAsset>[0], bytes) as unknown as Record<string, unknown>;
}

/** A fresh row: every declared field at its default (the web's newBlockRow rule). */
function newRow(fields: readonly FieldLike[]): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.default !== undefined) row[f.id] = f.default;
    else if (f.type === 'number') row[f.id] = f.min ?? 0;
    else if (f.type === 'select') row[f.id] = f.options?.[0]?.value ?? '';
    else if (f.type === 'boolean') row[f.id] = false;
    else if (f.type === 'asset') row[f.id] = null;
    else row[f.id] = '';
  }
  return row;
}

/** A source the rows are built from: a path on disk, or bytes already read. */
interface DropSource { label: string; path?: string; bytes?: Uint8Array }

/** Split a path list: one path per line, blank lines and `#` comments skipped. */
export function parsePathList(text: string): string[] {
  return text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#'));
}

/**
 * Append one row per file to every dropToAdd input that was given files, mutating
 * `values`. Returns how many rows each input gained, for the run's note line.
 *
 * Refuses (exit 2) a file that cannot be read, a file the input's `accept` filter
 * would not take in the web shell, positional files for a tool with no dropToAdd
 * input or with more than one, and an empty stdin list.
 */
export async function appendDroppedFiles(opts: {
  manifest: { id: string; inputs?: readonly DropInputLike[] };
  params: Record<string, string>;
  repeated?: Record<string, string[]>;
  positionals?: readonly string[];
  values: Record<string, unknown>;
  readStdin: () => Promise<Buffer>;
  cwd?: string;
}): Promise<Array<{ inputId: string; added: number }>> {
  const { manifest, params, repeated = {}, positionals = [], values, readStdin } = opts;
  const cwd = opts.cwd ?? process.cwd();
  const inputs = dropToAddInputs(manifest);
  if (positionals.length && inputs.length !== 1) {
    if (!inputs.length) {
      throw usageError(
        `"${manifest.id}" has no input that takes files as arguments, so it cannot use ${positionals.map((p) => `"${p}"`).join(', ')}. Nothing was rendered.`,
        'UNEXPECTED_ARGUMENT',
      );
    }
    throw usageError(
      `"${manifest.id}" has ${inputs.length} inputs that take files (${inputs.map((i) => i.id).join(', ')}), so files given as arguments have no single home. ` +
      `Use ${inputs.map((i) => `--${dropFlags(i.id).one}=<path>`).join(' or ')}.`,
      'AMBIGUOUS_ARGUMENT',
    );
  }
  const all = (key: string): string[] => repeated[key] ?? (params[key] !== undefined ? [params[key]!] : []);
  const out: Array<{ inputId: string; added: number }> = [];
  for (const input of inputs) {
    const { one, list } = dropFlags(input.id);
    const sources: DropSource[] = [];
    if (inputs.length === 1) for (const p of positionals) sources.push({ label: p, path: p });
    for (const p of all(one)) {
      if (p === '-') {
        const buf = await readStdin();
        if (!buf.length) throw usageError(`--${one}=- reads one picture from stdin, but stdin was empty.`, 'EMPTY_STDIN');
        sources.push({ label: 'stdin', bytes: new Uint8Array(buf) });
      } else if (!p || p === '1') {
        throw usageError(`--${one} needs a path: write --${one}=<picture>.`, 'MISSING_FLAG_VALUE');
      } else sources.push({ label: p, path: p });
    }
    for (const p of all(list)) {
      if (!p || p === '1') throw usageError(`--${list} needs a value: a file with one path per line, or - for stdin.`, 'MISSING_FLAG_VALUE');
      let text: string;
      if (p === '-') {
        text = (await readStdin()).toString('utf8');
        if (!text.trim()) throw usageError(`--${list}=- reads one path per line from stdin, but stdin was empty.`, 'EMPTY_STDIN');
      } else {
        try { text = await readFile(resolve(cwd, p), 'utf8'); }
        catch (e) { throw usageError(`--${list}: cannot read the path list "${p}" (${(e as Error).message}).`, 'INPUT_UNREADABLE'); }
      }
      for (const path of parsePathList(text)) sources.push({ label: path, path });
    }
    if (!sources.length) continue;

    const fields = input.fields ?? [];
    const field = input.dropToAdd!.field;
    const rows: Record<string, unknown>[] = [];
    for (const src of sources) {
      let bytes = src.bytes;
      let name = 'stdin';
      if (src.path !== undefined) {
        const abs = resolve(cwd, src.path);
        try { bytes = new Uint8Array(await readFile(abs)); }
        catch (e) { throw usageError(`${input.id}: cannot read "${src.label}" (${(e as Error).message}). Nothing was rendered.`, 'INPUT_UNREADABLE'); }
        name = basename(abs);
      }
      const mime = imageMime(name, bytes!);
      if (!acceptsMime(input.dropToAdd!.accept, mime)) {
        throw usageError(
          `${input.id}: "${src.label}" is ${mime === 'application/octet-stream' ? 'not a picture this shell recognises' : mime}, and ${input.id} takes ${input.dropToAdd!.accept || 'image/*'}. Nothing was rendered.`,
          'BAD_FLAG_VALUE',
        );
      }
      const row = newRow(fields);
      row[field] = await bakedImageRef(name, bytes!, mime);
      rows.push(row);
    }
    const base = Array.isArray(values[input.id]) ? values[input.id] as unknown[] : [];
    values[input.id] = [...base, ...rows];
    out.push({ inputId: input.id, added: rows.length });
  }
  return out;
}

/** The first of `dirs` holding `rel` as a file, as an absolute path, or null. */
async function existingFile(dirs: ReadonlyArray<string | undefined>, rel: string): Promise<string | null> {
  for (const dir of dirs) {
    if (!dir) continue;
    const abs = resolve(dir, rel);
    try { if ((await stat(abs)).isFile()) return abs; } catch { /* try the next folder */ }
  }
  return null;
}

/** A URL or a scheme-qualified id (`https:`, `data:`, `lolly:`) is never a local path.
 *  Two letters at least, so a Windows drive (`C:`) still reads as a path. */
const SCHEME = /^[a-z][a-z0-9+.-]+:/i;

/** The `file:` URL an asset value points at (as a string, its id, its url or its
 *  original's url), which the Node bridge reads straight from disk; null otherwise. */
export function fileUrlIn(v: unknown): string | null {
  const ref = v && typeof v === 'object' ? v as { id?: unknown; url?: unknown; original?: { url?: unknown } } : null;
  for (const s of ref ? [ref.id, ref.url, ref.original?.url] : [v]) {
    if (typeof s === 'string' && /^\s*file:/i.test(s)) return s.trim();
  }
  return null;
}

/** A local file that a set of input values points at. */
export interface LinkLocalFile { inputId: string; fieldId: string | null; value: string }

/**
 * The first file on this computer that input values point at, for values that
 * came inside a link: a `file:` URL in an asset input or a blocks row's asset
 * field, an existing file such an asset gives by path (`~/` is the home folder,
 * anything else relative to `cwd`), or a file input with a path. Null when the
 * values point at no local file. The TUI refuses a pasted link that does this, as
 * `bakeLocalBlockAssets` and the CLI's input reads refuse one.
 */
export async function linkLocalFile(
  manifest: { inputs?: readonly DropInputLike[] },
  values: Record<string, unknown>,
  opts: { cwd?: string } = {},
): Promise<LinkLocalFile | null> {
  const cwd = opts.cwd ?? process.cwd();
  const local = async (v: unknown): Promise<string | null> => {
    const fileUrl = fileUrlIn(v);
    if (fileUrl) return fileUrl;
    let id: string | null = null;
    if (typeof v === 'string') id = v.trim();
    else if (v && typeof v === 'object') {
      const ref = v as { id?: unknown; source?: unknown; meta?: { baked?: unknown } };
      if (typeof ref.id === 'string' && ref.source !== 'remote' && !ref.meta?.baked) id = ref.id.trim();
    }
    if (!id || SCHEME.test(id)) return null;
    const path = id === '~' || id.startsWith('~/') ? join(homedir(), id.slice(1)) : id;
    return (await existingFile([cwd], path)) ? id : null;
  };
  for (const input of manifest.inputs ?? []) {
    const v = values[input.id];
    if (v == null) continue;
    if (input.type === 'file') {
      for (const ref of Array.isArray(v) ? v : [v]) {
        const path = ref && typeof ref === 'object' ? (ref as { path?: unknown }).path : null;
        if (typeof path === 'string' && path) return { inputId: input.id, fieldId: null, value: path };
      }
    } else if (input.type === 'asset') {
      const hit = await local(v);
      if (hit) return { inputId: input.id, fieldId: null, value: hit };
    } else if (input.type === 'blocks' && Array.isArray(v)) {
      const assetFields = (input.fields ?? []).filter((f) => f.type === 'asset');
      for (const row of v) {
        if (!row || typeof row !== 'object') continue;
        for (const f of assetFields) {
          const hit = await local((row as Record<string, unknown>)[f.id]);
          if (hit) return { inputId: input.id, fieldId: f.id, value: hit };
        }
      }
    }
  }
  return null;
}

/** The refusal for a file on this computer that a link chose. */
export function linkLocalFileRefusal(inputId: string, fieldId: string | null, value: string): Error {
  return refused(
    `${inputId}: the link sets ${fieldId ? `a ${fieldId} of ` : ''}"${value}", a file on this computer. A link cannot choose files for the CLI to read, so nothing was rendered. ` +
    `To use that picture, add it yourself: --${dropFlags(inputId).one}=<path>, or a path in --${inputId}= typed on the command line.`,
    'LINK_LOCAL_PATH',
  );
}

/**
 * Read a path written into a row's asset field from disk, for every blocks input.
 * A string or an unresolved `{ id }` ref whose id is an existing file becomes a
 * baked ref; anything else (a catalog id, a URL, a baked ref) is left for the
 * runtime to resolve. A relative path is looked up from the working directory,
 * then from the folder of the data file the rows came from (`dataDirs`, keyed by
 * input id), so a CSV can name the pictures in its own folder. Returns how many
 * fields were read.
 *
 * Refuses, before reading the whole file, a file whose leading bytes are not a
 * picture (exit 2), and any existing file in an input whose rows came inside a
 * link (`fromLink`, exit 4): the rows of a pasted link were written by whoever
 * made the link, not by the person running the command.
 */
export async function bakeLocalBlockAssets(
  manifest: { inputs?: readonly DropInputLike[] },
  values: Record<string, unknown>,
  opts: { cwd?: string; dataDirs?: Record<string, string>; fromLink?: (inputId: string) => boolean } = {},
): Promise<number> {
  const cwd = opts.cwd ?? process.cwd();
  let read = 0;
  for (const input of manifest.inputs ?? []) {
    if (input.type !== 'blocks') continue;
    const rows = values[input.id];
    if (!Array.isArray(rows)) continue;
    const assetFields = (input.fields ?? []).filter((f) => f.type === 'asset');
    if (!assetFields.length) continue;
    for (const row of rows) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      for (const f of assetFields) {
        const v = r[f.id];
        const fileUrl = fileUrlIn(v);
        if (fileUrl && opts.fromLink?.(input.id)) throw linkLocalFileRefusal(input.id, f.id, fileUrl);
        let id: string | null = null;
        if (typeof v === 'string') id = v.trim();
        else if (v && typeof v === 'object') {
          const ref = v as { id?: unknown; source?: unknown; meta?: { baked?: unknown } };
          if (typeof ref.id === 'string' && ref.source !== 'remote' && !ref.meta?.baked) id = ref.id;
        }
        if (!id || SCHEME.test(id)) continue;
        const abs = await existingFile([cwd, opts.dataDirs?.[input.id]], id);
        if (!abs) continue;
        if (opts.fromLink?.(input.id)) throw linkLocalFileRefusal(input.id, f.id, id);
        const mime = imageMime(basename(abs), await headBytes(abs));
        if (mime === 'application/octet-stream') {
          throw usageError(`${input.id}: "${id}" is a file on this computer but not a picture this shell recognises, so it was not read. Nothing was rendered.`, 'BAD_FLAG_VALUE');
        }
        const bytes = new Uint8Array(await readFile(abs));
        r[f.id] = await bakedImageRef(basename(abs), bytes, mime);
        read++;
      }
    }
  }
  return read;
}
