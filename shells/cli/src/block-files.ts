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
 * top-level `--logo=./brand.png` is.
 */

import { readFile, stat } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { usageError } from './exit-codes.ts';

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

/** A picture's MIME type: the leading bytes first, then the file name. */
export function imageMime(name: string, bytes: Uint8Array): string {
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57 && b[9] === 0x45) return 'image/webp';
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) return EXT_MIME[extname(name).toLowerCase()] === 'image/heic' ? 'image/heic' : 'image/avif';
  if ((b[0] === 0xff && b[1] === 0x0a) || (b[0] === 0 && b[1] === 0 && b[2] === 0 && b[3] === 0x0c && b[4] === 0x4a && b[5] === 0x58)) return 'image/jxl';
  const head = Buffer.from(b.subarray(0, 512)).toString('utf8');
  if (/<svg[\s>]/i.test(head)) return 'image/svg+xml';
  return EXT_MIME[extname(name).toLowerCase()] ?? 'application/octet-stream';
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

/**
 * Read a path written into a row's asset field from disk, for every blocks input.
 * A string or an unresolved `{ id }` ref whose id is an existing file becomes a
 * baked ref; anything else (a catalog id, a URL, a baked ref) is left for the
 * runtime to resolve. A relative path is looked up from the working directory,
 * then from the folder of the data file the rows came from (`dataDirs`, keyed by
 * input id), so a CSV can name the pictures in its own folder. Returns how many
 * fields were read.
 */
export async function bakeLocalBlockAssets(
  manifest: { inputs?: readonly DropInputLike[] },
  values: Record<string, unknown>,
  opts: { cwd?: string; dataDirs?: Record<string, string> } = {},
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
        let id: string | null = null;
        if (typeof v === 'string') id = v.trim();
        else if (v && typeof v === 'object') {
          const ref = v as { id?: unknown; source?: unknown; meta?: { baked?: unknown } };
          if (typeof ref.id === 'string' && ref.source !== 'remote' && !ref.meta?.baked) id = ref.id;
        }
        if (!id || SCHEME.test(id)) continue;
        const abs = await existingFile([cwd, opts.dataDirs?.[input.id]], id);
        if (!abs) continue;
        const bytes = new Uint8Array(await readFile(abs));
        r[f.id] = await bakedImageRef(basename(abs), bytes, imageMime(basename(abs), bytes));
        read++;
      }
    }
  }
  return read;
}
