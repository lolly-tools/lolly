// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly package` for a Design document (plan 291 W8): one call from a document to a
 * `.lolly` the app reopens as the same document, pictures and name included.
 *
 *   lolly package <design.json|-> [--asset=KEY=PATH]... [--asset-dir=<dir>]
 *                 [--source=<deck.pptx|deck.pdf|deck.psd|file.lolly>] [--label=<name>]
 *                 [--theme=<name>] [--file=<tokens.json>] [--output=<file.lolly>]
 *                 [--force] [--allow-missing-media] [--json]
 *
 * The work is `packageDesign` (@lolly-tools/node-shell/design-lolly), shared with the
 * `lolly_package` MCP tool. With `--json` the envelope's `result` is a
 * `DesignPackageReportV1` (schemas/design-package-v1.schema.json).
 *
 * `--asset=KEY=PATH` (repeatable) carries the picture at PATH for every layer whose
 * `image` is KEY: a placeholder such as `photo:title`, a relative path, or an upload
 * ref `user/media/<sha256>`, whose file must then hash to that ref. `--asset-dir` resolves
 * upload refs from the folder `lolly read --media` writes, and `--source` from the
 * deck itself; both also resolve a placeholder that ends in a hash prefix, the
 * `photo:<sha12>` keys `lolly compose --suggest` writes. `--file` and `--theme` choose the design system authoring text styles
 * resolve in, as `lolly check` chooses one.
 *
 * Only a Design document comes here. A compiled document (`lolly compile <tool>`), or
 * anything that is not a Design document read from a `.json` file, keeps the zip
 * `lolly package` has always written (document.ts), with the flags it has always had.
 *
 * Exit codes: 0 written, 2 usage (an unknown or bare flag, a missing file, an asset
 * argument with no key), 4 refused (a picture with no bytes, a file that is not a
 * picture, a hash that does not match, a path that will not decode, an authoring key
 * the expansion refuses, an output that exists without --force), 1 the file did not
 * read back as written.
 */

import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import type { DesignPackageErrorCodeV1, DesignPackageReportV1 } from '@lolly-tools/core';
import { DesignPackageError, designInputShape, packageDesign, type DesignPackageAssetV1, type DesignPackageHintsV1, type DesignPackageOptions } from '@lolly-tools/node-shell/design-lolly';
import { cleanControlChars } from '@lolly-tools/node-shell/verdict-report';
import { readLollyFile } from '@lolly-tools/node-shell/lolly-file';
import { hasDesignAuthoring } from '../../../engine/src/design-authoring.ts';
import { hasDesignColourRefs } from '../../../engine/src/token-block-bindings.ts';
import type { InputValue } from '../../../engine/src/inputs.ts';
import { PACKAGE_BOOL_FLAGS, PACKAGE_VALUE_FLAGS, refuseUnknownFlags } from './args.ts';
import { emitResult } from './envelope.ts';
import { CliError, EXIT, usageError } from './exit-codes.ts';
import { note, writeOut } from './output.ts';
import { readStdin } from './run.ts';

export interface PackageCliOptions {
  json?: boolean;
}

/** The exit code each refusal or failure carries. */
const EXIT_OF: Record<DesignPackageErrorCodeV1, number> = {
  'input.unsupported': EXIT.USAGE,
  'input.unreadable': EXIT.FAILED,
  'authoring.invalid': EXIT.REFUSED,
  'asset.invalid': EXIT.USAGE,
  'asset.not-image': EXIT.REFUSED,
  'media.mismatch': EXIT.REFUSED,
  'media.missing': EXIT.REFUSED,
  'reference.unknown': EXIT.REFUSED,
  'path.invalid': EXIT.REFUSED,
  'export.failed': EXIT.FAILED,
};

const kindOf = (code: string): string => code.toUpperCase().replace(/[.-]/g, '_');
const isOn = (v: string | undefined): boolean => v !== undefined && !/^(0|false|off|no)$/i.test(v);

function asCliError(err: unknown): unknown {
  if (err instanceof DesignPackageError) return new CliError(err.message, EXIT_OF[err.code], kindOf(err.code), err.code);
  return err;
}

async function readPath(path: string, what: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(resolve(process.cwd(), path)));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw usageError(`No file at ${path} (${what}).`, 'FILE_NOT_FOUND');
    if (code === 'EISDIR') throw usageError(`${path} is a folder; ${what} takes a file.`, 'BAD_FLAG_VALUE');
    throw err;
  }
}

/**
 * The parsed input when it is a Design document, else null: the caller then hands
 * the run to the compiled-document path unchanged. Standard input is always read
 * here, since that path takes a file.
 */
export async function designPackageInput(path: string | undefined): Promise<{ doc: unknown; name: string } | null> {
  if (path === '-') {
    const bytes = await readStdin();
    if (!bytes.length) throw usageError('Standard input is empty.', 'EMPTY_INPUT');
    let doc: unknown;
    try {
      doc = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw usageError('Standard input is not JSON. lolly package reads a Design document (JSON) from -.', 'BAD_INPUT');
    }
    if (designInputShape(doc) !== 'design')
      throw usageError('Standard input is not a Design document. A compiled document is packaged from a file: lolly package <document.json>.', 'BAD_INPUT');
    return { doc, name: 'standard-input.json' };
  }
  if (!path || !/\.json$/i.test(path)) return null;
  // A .json that is missing or does not parse is said as such here, not blamed on a flag
  // or left to the compiled path's raw parser message.
  const text = new TextDecoder().decode(await readPath(path, 'the document'));
  let doc: unknown;
  try {
    doc = JSON.parse(text);
  } catch (err) {
    throw usageError(`${path} is not JSON (${(err as Error).message}). lolly package reads a Design document or a compiled document as JSON.`, 'BAD_INPUT');
  }
  return designInputShape(doc) === 'design' ? { doc, name: basename(path) } : null;
}

/** The refusal remedies in this surface's flag names. */
const CLI_HINTS: DesignPackageHintsV1 = {
  asset: 'give each placeholder a file with --asset=KEY=PATH',
  upload: 'give the folder lolly read wrote with --asset-dir, or the deck with --source',
  allowMissing: 'pass --allow-missing-media',
};

/** `KEY=PATH`, split at the first `=`. */
function assetArg(value: string): { key: string; path: string } {
  const at = value.indexOf('=');
  const key = at > 0 ? value.slice(0, at) : '';
  const path = at > 0 ? value.slice(at + 1) : '';
  if (!key || !path) throw usageError(`--asset takes KEY=PATH, the image value rows name and the picture file (got "${value}").`, 'BAD_FLAG_VALUE');
  return { key, path };
}

/**
 * True when the document's rows name a colour token (`{color.semantic.text}`), as a
 * composed deck's may with no authoring key: they are lowered in the design system too.
 */
function holdsColourRefs(doc: unknown): boolean {
  const rec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
  let rows: unknown = Array.isArray(doc) ? doc : rec(doc) ? (rec(doc.values) ? doc.values.boxes : doc.boxes) : undefined;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch { return false; }
  }
  return Array.isArray(rows) && hasDesignColourRefs(rows as InputValue[], ['bg', 'fg', 'stroke', 'shadowColor'], 'tokenLinks', false);
}

/** A path as one shell word: quoted when it holds a space or a shell character. */
function shellWord(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * The note for a document whose colour links were cached in a design system the `.lolly`
 * does not carry (plan 291 section 6): a `--file` system, or this terminal's active one.
 * A `.lolly` carries no design system, and the app opens it in its own active system, so a
 * reopen there repaints every linked colour in that system's values. Null when the system
 * is the content profile's, or when no layer links a colour.
 */
export function systemNotCarried(bytes: Uint8Array, origin: string | undefined, file: string | undefined): DesignPackageReportV1['warnings'][number] | null {
  if (origin !== 'file' && origin !== 'terminal') return null;
  let boxes: unknown;
  try {
    boxes = readLollyFile(bytes).session.boxes;
  } catch {
    return null;
  }
  if (typeof boxes === 'string') {
    try { boxes = JSON.parse(boxes); } catch { return null; }
  }
  const linked = Array.isArray(boxes)
    ? boxes.filter((row) => {
        const links = row && typeof row === 'object' ? (row as Record<string, unknown>).tokenLinks : undefined;
        return typeof links === 'string' ? links.trim() !== '' && links.trim() !== '{}' : !!links && typeof links === 'object' && Object.keys(links).length > 0;
      }).length
    : 0;
  if (!linked) return null;
  const system = origin === 'file' && file ? file : "this terminal's active design system";
  const tail = origin === 'file' && file
    ? `add ${file} as a design system in the app and switch to it before you open the file to see it as authored, and pass --file=${shellWord(file)} to lolly check and lolly run.`
    : 'add the same design system in the app and switch to it before you open the file to see it as authored.';
  return {
    code: 'design-system.not-carried',
    message: `${count(linked, 'layer links its colours', 'layers link their colours')} to ${system}, and the .lolly does not carry a design system. The app opens the file in its active design system, so those colours repaint in that system's values: ${tail}`,
  };
}

/** "1 layer", "2 layers". */
const count = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

/** The human summary: the file, the pictures carried, and the notes. */
export function packageOutline(report: DesignPackageReportV1): string {
  const clean = cleanControlChars;
  const lines = [
    `${clean(report.output ?? 'package')}: "${clean(report.label)}", ${count(report.artboards, 'artboard', 'artboards')}, ${count(report.layers, 'layer', 'layers')}, ${count(report.media.length, 'picture', 'pictures')} carried, ${count(report.bytes, 'byte', 'bytes')}.`,
  ];
  for (const m of report.media) lines.push(`  ${m.ref.slice(11, 23)} ${m.mime} ${count(m.bytes, 'byte', 'bytes')}  ${clean(m.keys.join(', '))}  (${count(m.layers.length, 'layer', 'layers')})`);
  const refs = report.references;
  lines.push(`Catalog references: ${refs.catalog} checked${refs.profile ? ` against ${clean(refs.profile)}` : ''}${refs.unchecked ? `, ${refs.unchecked} unchecked` : ''}${refs.external ? `, ${count(refs.external, 'URL', 'URLs')}` : ''}.`);
  lines.push(`Read back: ${count(report.readback.layers, 'layer', 'layers')}, ${count(report.readback.media, 'picture', 'pictures')}. Next: ${report.next.join('; ')}.`);
  return `${lines.join('\n')}\n`;
}

/**
 * Package a Design document. Returns the exit code, or null when the input is not a
 * Design document and the compiled-document path should run instead.
 */
export async function packageCli(
  positionals: string[],
  flags: Record<string, string>,
  repeated: Record<string, string[]>,
  argv: readonly string[],
  opts: PackageCliOptions = {},
): Promise<number | null> {
  const input = await designPackageInput(positionals[0]);
  const ownFlags = [...PACKAGE_VALUE_FLAGS, ...PACKAGE_BOOL_FLAGS] as readonly string[];
  if (!input) {
    // The compiled-document path keeps the flags it always took, and has always let
    // --force through; the Design flags mean nothing there, so naming one is a mistake
    // worth saying.
    const designOnly = ownFlags.find((f) => f !== 'output' && f !== 'force' && flags[f] !== undefined);
    if (designOnly) throw usageError(`--${designOnly} applies to a Design document; ${positionals[0] ?? 'this input'} is packaged as a compiled document.`, 'UNKNOWN_FLAG');
    return null;
  }
  const valueFlags = new Set<string>(PACKAGE_VALUE_FLAGS.map((f) => `--${f}`));
  const bare = argv.find((a) => valueFlags.has(a));
  if (bare) throw usageError(`${bare} needs a value: write ${bare}=<value>.`, 'MISSING_FLAG_VALUE');
  const empty = PACKAGE_VALUE_FLAGS.find((f) => flags[f] === '' || (repeated[f] ?? []).includes(''));
  if (empty) throw usageError(`--${empty} needs a value: write --${empty}=<value>.`, 'MISSING_FLAG_VALUE');
  refuseUnknownFlags('package', flags, ownFlags);
  if (positionals.length > 1) throw usageError(`lolly package takes one document; got ${positionals.length}.`, 'TOO_MANY_ARGUMENTS');

  const output = flags.output && flags.output !== '-' ? resolve(process.cwd(), flags.output) : undefined;
  if (!output && opts.json) throw usageError('With --json the report goes to standard output, so name the file: --output=<file.lolly>.', 'MISSING_ARGUMENT');
  if (output && !isOn(flags.force)) {
    const there = await stat(output).catch(() => null);
    if (there) throw new CliError(`${flags.output} already exists; pass --force to replace it.`, EXIT.REFUSED, 'OUTPUT_EXISTS');
  }

  const assets: DesignPackageAssetV1[] = [];
  for (const value of repeated.asset ?? (flags.asset !== undefined ? [flags.asset] : [])) {
    const { key, path } = assetArg(value);
    assets.push({ key, bytes: await readPath(path, `--asset ${key}`), name: basename(path) });
  }
  if (flags['asset-dir'] !== undefined) {
    const dir = resolve(process.cwd(), flags['asset-dir']);
    const info = await stat(dir).catch(() => null);
    if (!info?.isDirectory()) throw usageError(`--asset-dir must be a folder (${flags['asset-dir']}).`, 'BAD_FLAG_VALUE');
  }

  const options: DesignPackageOptions = {
    assets,
    ...(flags['asset-dir'] !== undefined ? { assetDir: resolve(process.cwd(), flags['asset-dir']) } : {}),
    ...(flags.label !== undefined ? { label: flags.label } : {}),
    ...(flags.theme !== undefined ? { theme: flags.theme } : {}),
    allowMissingMedia: isOn(flags['allow-missing-media']),
    hints: CLI_HINTS,
    fileStem: input.name.replace(/\.json$/i, '').replace(/(\.(boxes|lolly|design|author))+$/i, '') || 'Design',
  };
  if (flags.source !== undefined) options.source = { bytes: await readPath(flags.source, '--source'), name: basename(flags.source) };
  // Where the design system came from: a --file or terminal system is not the one the app has.
  let systemOrigin: string | undefined;
  // Authoring text styles resolve in a design system: the same ladder `lolly check` uses.
  if (hasDesignAuthoring(input.doc) || holdsColourRefs(input.doc) || flags.file !== undefined) {
    const { briefSource } = await import('./system.ts');
    const { readBriefCatalogFor } = await import('@lolly-tools/node-shell/design-brief');
    const { designBrief, createTokenSet } = await import('@lolly/engine');
    const { doc, origin } = await briefSource(flags);
    systemOrigin = origin?.kind;
    if (doc) {
      try {
        options.brief = designBrief(doc, readBriefCatalogFor(origin?.kind, doc), flags.theme ? { theme: flags.theme } : {});
        // The same system's tokens store colour references as literals plus links (plan 291 W4).
        options.tokens = createTokenSet(doc, flags.theme ? { theme: flags.theme } : {});
      } catch (err) {
        throw usageError(`The design system could not be read for text styles: ${(err as Error).message}`, 'BAD_FLAG_VALUE');
      }
    }
  }

  let packed: Awaited<ReturnType<typeof packageDesign>>;
  try {
    packed = await packageDesign(input.doc, options);
  } catch (err) {
    throw asCliError(err);
  }
  const report: DesignPackageReportV1 = { ...packed.report, ...(output ? { output } : {}) };
  const notCarried = systemNotCarried(packed.bytes, systemOrigin, flags.file);
  if (notCarried) report.warnings = [...report.warnings, notCarried];
  if (output) {
    // A --file system is the one the links were cached in, so the next commands name it too.
    const fileFlag = systemOrigin === 'file' && flags.file ? ` --file=${shellWord(flags.file)}` : '';
    report.next = [`lolly check ${flags.output}${fileFlag}`, `lolly run ${flags.output} --export=pptx${fileFlag}`];
    await writeFile(output, packed.bytes);
  }
  if (opts.json) {
    await emitResult(report, EXIT.OK);
    return EXIT.OK;
  }
  for (const w of report.warnings) note(`Note (${w.code}): ${cleanControlChars(w.message)}`);
  if (output) await writeOut(packageOutline(report));
  else await writeOut(packed.bytes);
  return EXIT.OK;
}
