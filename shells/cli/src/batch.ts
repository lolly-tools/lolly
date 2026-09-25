// SPDX-License-Identifier: MPL-2.0
/**
 * CLI batch - "the CLI way" of many renders from one file. A batch is a CSV/TSV whose
 * header names a `toolId` column, optional per-row output columns
 * (format/width/height/unit/dpi/filename), and one column per tool input; each data
 * row is rendered by the SAME single-render primitive the rest of the CLI uses
 * (runToolCli → URL mode), writing a sequence-numbered file into an output DIRECTORY.
 *
 * A directory (not a zip) is deliberate: the lean node CLI has no zip dependency, and
 * a directory composes with the user's own `zip`/`tar`. (The TUI's batch packs a zip - 
 * same rows, a different idiomatic output per surface.)
 *
 * Transform tools (hooks.exportFile: file in, file out) run from a batch too. A row
 * names its input file in the tool's file-input column (`source`, say), exactly as a
 * render row names its inputs, and the path resolves against the working directory as
 * it does on `lolly run`. No export format is passed for such a row, since the output
 * container follows the file; the result is named `<seq>-<name>.<ext>`, where the name
 * comes from the `filename` column or the input file and the extension from the bytes
 * the tool produced. A `filename` with its own extension is used as written.
 */
import { readFile, mkdir, rename } from 'node:fs/promises';
import { basename, extname, join, resolve } from 'node:path';
import { parseBatchCsv, batchCsvTemplateWithNotes, loadTool } from '@lolly/engine';
import { readToolFile, runToolCli } from './run.ts';
import { checkTransformOutput, transformOutputKind } from './transform-output.ts';
import { EXIT, exitCodeFor, usageError } from './exit-codes.ts';
import { warn } from './output.ts';

// The one tool reader this shell has (run.ts), not a second path join of its own.
const fetchFile = readToolFile;
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'out';

/** Print a starter CSV grid for the given tool ids (their input columns + reserved). */
export async function batchTemplateCli(toolIds: string[], opts: { json?: boolean } = {}): Promise<void> {
  const tools: Array<{ id: string; inputs: Array<{ id: string }> }> = [];
  const transforms: string[] = [];
  for (const raw of toolIds) {
    const id = raw.trim();
    if (!id) continue;
    try {
      const t = await loadTool(id, fetchFile);
      tools.push({ id: t.manifest.id, inputs: (t.manifest.inputs ?? []).map(i => ({ id: i.id })) });
      if (t.manifest.hooks?.exportFile) transforms.push(t.manifest.id);
    } catch { warn('UNKNOWN_TOOL', `unknown tool "${id}" - skipped.`); }
  }
  if (!tools.length) {
    throw usageError('No known tools given. Usage: lolly batch --template=qr-code,chart-creator', 'UNKNOWN_TOOL');
  }
  const { csv, shadowedInputs } = batchCsvTemplateWithNotes(tools);
  if (shadowedInputs.length) {
    // A batch row has no `--input.<id>=` namespace - the header IS the namespace - so an
    // input whose id is a reserved output column simply cannot be set from a batch. Say
    // it here rather than emit two columns with the same name and let the second quietly
    // win (a grid whose two `width` cells read 600 and 300 rendered at 300).
    warn('BATCH_COLUMN_SHADOWED',
      `${shadowedInputs.map(i => `"${i}"`).join(', ')} ${shadowedInputs.length === 1 ? 'is an input' : 'are inputs'} whose name a reserved output column already owns, so ` +
      `${shadowedInputs.length === 1 ? 'it is' : 'they are'} not in this grid and cannot be set per row. Render those with \`lolly run\` and --input.<id>=<value>.`);
  }
  if (transforms.length) {
    // The grid's reserved output columns are shared by every row, and a transform row
    // refuses a format cell (its output follows the input file), so say which rows.
    warn('BATCH_TRANSFORM_ROWS',
      `Leave format, width, height, unit and dpi blank on ${transforms.map(i => `"${i}"`).join(', ')} rows: a transform writes the container of its input file.`);
  }
  if (opts.json) {
    // The CSV stays a single string rather than being re-modelled as rows: it is a
    // starter FILE, and a consumer's next move is to write it to disk unchanged.
    const { emitResult } = await import('./envelope.ts');
    await emitResult({ csv, tools: tools.map(t => ({ id: t.id, columns: t.inputs.map(i => i.id) })) });
    return;
  }
  process.stdout.write(csv);
}

/**
 * Render every row of a CSV/TSV into `outDir`. Returns a process exit code.
 *
 * The code is the WORST row's code, not a flat 1 (contract B13): a batch where one row
 * asked for a format this installation cannot produce (3) is a different operational
 * fact from a batch where a hook threw (1), and a pipeline that retries on another
 * runner needs to be able to tell them apart.
 */
export interface BatchRowRecord {
  row: number;
  toolId: string;
  ok: boolean;
  /** Where the file was written (present only when the row succeeded). */
  output?: string;
  format: string;
  /** The row's own exit code, so a consumer can retry just the exit-3 rows elsewhere. */
  exit: number;
  error?: string;
}

export async function runBatchCli(csvPath: string, opts: { outDir: string; keepGoing?: boolean; json?: boolean }): Promise<number> {
  let text: string;
  try {
    text = await readFile(resolve(process.cwd(), csvPath), 'utf8');
  } catch (e) {
    throw usageError(`Cannot read the batch file "${csvPath}" (${(e as Error).message}).`, 'INPUT_UNREADABLE');
  }
  const rows = parseBatchCsv(text);
  if (!rows.length) {
    const message = 'No batch rows found. Expected a header row with a `toolId` column, then one row per render.';
    process.stderr.write(message + '\n');
    if (opts.json) {
      const { emitError } = await import('./envelope.ts');
      await emitError(Object.assign(new Error(message), { exit: EXIT.USAGE, kind: 'EMPTY_BATCH' }));
    }
    return EXIT.USAGE;
  }
  const outDir = resolve(process.cwd(), opts.outDir);
  await mkdir(outDir, { recursive: true });
  const pad = Math.max(2, String(rows.length).length);
  /** What a row needs to know about its tool: the default render format, and for a
   *  transform the id of its file input (null when it has none) and the selects that
   *  choose its output container. */
  interface RowTool { format: string; formats: string[]; transform: boolean; fileInput: string | null; containerChoices: ContainerChoice[] }
  const toolCache = new Map<string, RowTool>();
  const rowTool = async (id: string): Promise<RowTool> => {
    const hit = toolCache.get(id);
    if (hit) return hit;
    let info: RowTool = { format: 'svg', formats: [], transform: false, fileInput: null, containerChoices: [] };
    try {
      const t = await loadTool(id, fetchFile);
      const files = (t.manifest.inputs ?? []).filter(i => i.type === 'file');
      info = {
        format: t.manifest.render.formats[0] ?? 'svg',
        formats: t.manifest.render.formats,
        transform: !!t.manifest.hooks?.exportFile,
        // The input a default run reads: one with no showIf before a conditional one.
        fileInput: (files.find(i => !i.showIf) ?? files[0])?.id ?? null,
        containerChoices: containerChoices(t.manifest),
      };
    } catch { /* runToolCli reports */ }
    toolCache.set(id, info);
    return info;
  };

  let ok = 0, failed = 0;
  const records: BatchRowRecord[] = [];
  /** Emit the envelope for however far the batch got (used on abort AND on completion). */
  const finish = async (worstCode: number): Promise<number> => {
    if (opts.json) {
      const { emitResult } = await import('./envelope.ts');
      await emitResult({
        rows: records,
        summary: { total: rows.length, ok, failed, rendered: ok, aborted: records.length < rows.length },
        outDir,
      }, worstCode);
    }
    return worstCode;
  };
  // Severity order for "the worst row wins": a refusal outranks an unavailable tier,
  // which outranks a plain failure, which outranks a usage error.
  const SEVERITY: number[] = [EXIT.OK, EXIT.USAGE, EXIT.FAILED, EXIT.UNAVAILABLE_HERE, EXIT.REFUSED, EXIT.AUTH, EXIT.INTERNAL];
  let worst: number = EXIT.OK;
  const record = (e: unknown): void => {
    const code = exitCodeFor(e);
    if (SEVERITY.indexOf(code) > SEVERITY.indexOf(worst)) worst = code;
  };
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    // Per-row output settings ride in `params` as reserved keys - parseUrlState reads
    // them exactly as it would from a URL (`?width=…`), so there's one contract.
    const params = { ...row.params };
    if (row.width) params.width = String(row.width);
    if (row.height) params.height = String(row.height);
    if (row.unit) params.unit = row.unit;
    if (row.dpi) params.dpi = String(row.dpi);
    // PROVENANCE OFF unless the row asks for it (contract section 12 O2). A single `lolly run`
    // is somebody making an asset, so it carries Content Credentials and the Imprint
    // like the app does; a batch is a build step, and both marks embed a fresh
    // timestamp, so signing 500 rows by default would make a regenerated folder differ
    // from its predecessor in every file. A row opts back in with a `c2pa` (or
    // `imprint`/`durable`) column, which parseUrlState reads exactly as `?c2pa=` does.
    if (params.c2pa === undefined && params.imprint === undefined && params.durable === undefined) {
      params['no-provenance'] = '1';
    }
    const tool = await rowTool(row.toolId);
    const seq = String(i + 1).padStart(pad, '0');
    if (tool.transform) {
      const done = await runTransformRow(row, params, tool, { outDir, seq, index: i + 1 });
      records.push(done.record);
      if (done.record.ok) { ok++; continue; }
      failed++;
      record(done.error);
      process.stderr.write(`✗ row ${i + 1} (${row.toolId}): ${done.record.error}\n`);
      if (!opts.keepGoing) {
        process.stderr.write('Aborting - use --keep-going to render the rest.\n');
        return finish(worst);
      }
      continue;
    }
    const fmt = row.format ?? tool.format;
    const base = row.filename ? slug(row.filename.replace(/\.[^.]+$/, '')) : slug(row.toolId);
    const outputPath = join(outDir, `${seq}-${base}.${fmt}`);
    try {
      await runToolCli({ toolId: row.toolId, params, outputPath, format: row.format ?? fmt });
      ok++;
      records.push({ row: i + 1, toolId: row.toolId, ok: true, output: outputPath, format: fmt, exit: EXIT.OK });
    } catch (e) {
      failed++;
      record(e);
      records.push({
        row: i + 1, toolId: row.toolId, ok: false, format: fmt,
        exit: exitCodeFor(e), error: (e as Error).message,
      });
      process.stderr.write(`✗ row ${i + 1} (${row.toolId}): ${(e as Error).message}\n`);
      if (!opts.keepGoing) {
        process.stderr.write('Aborting - use --keep-going to render the rest.\n');
        return finish(worst);
      }
    }
  }
  process.stderr.write(`\nBatch done - ${ok} rendered${failed ? `, ${failed} failed` : ''} → ${outDir}\n`);
  return finish(worst);
}


/**
 * One transform row: run the tool over the file its row names, without an export
 * format, and name the result after the bytes it produced. An explicit `format` cell is
 * passed through so the row gets the transform refusal that explains it, rather than
 * having the cell ignored.
 */
async function runTransformRow(
  row: { toolId: string; format?: string; filename?: string },
  params: Record<string, string>,
  tool: { formats: string[]; fileInput: string | null; containerChoices: ContainerChoice[] },
  at: { outDir: string; seq: string; index: number },
): Promise<{ record: BatchRowRecord; error?: unknown }> {
  const source = tool.fileInput ? params[tool.fileInput] : undefined;
  const named = row.filename ? extname(row.filename).slice(1).toLowerCase() : '';
  const base = row.filename
    ? slug(row.filename.replace(/\.[^.]+$/, ''))
    : source ? slug(basename(source).replace(/\.[^.]+$/, '')) : slug(row.toolId);
  // The value of the select that chose the container (clean `audioFormat`, convert-image
  // `target`), from the row or the manifest default, when it names a declared format.
  const chosen = tool.containerChoices
    .map(c => (params[c.id] ?? c.fallback ?? '').toLowerCase())
    .find(v => tool.formats.some(f => f.toLowerCase() === v));
  // A filename with an extension is the caller's choice (and asks the font path for
  // that container). A font converter's chosen container goes in the name too, since
  // run.ts swaps the font container to match the name (font-convert hands back its
  // source bytes). Otherwise the file is written under a neutral `.out` name, which
  // run.ts neither warns about nor converts, and is renamed after its bytes.
  const firstExt = named || (chosen && FONT_CONTAINERS.has(chosen) ? chosen : 'out');
  const firstPath = join(at.outDir, `${at.seq}-${base}.${firstExt}`);
  try {
    await runToolCli({ toolId: row.toolId, params, outputPath: firstPath, ...(row.format ? { format: row.format } : {}) });
    if (named) return { record: { row: at.index, toolId: row.toolId, ok: true, output: firstPath, format: named, exit: EXIT.OK } };
    const bytes = new Uint8Array(await readFile(firstPath));
    const checked = checkTransformOutput(bytes, tool.formats);
    let ext: string;
    if ('kind' in checked) {
      // Bytes with no signature to read take the converter's chosen container first.
      ext = checked.checked ? checked.kind : chosen ?? checked.kind;
    } else {
      const kind = transformOutputKind(bytes);
      ext = kind ?? chosen ?? 'bin';
      warn('TRANSFORM_OUTPUT_UNDECLARED',
        `row ${at.index} (${row.toolId}): ${kind ? `the output is ${kind}` : 'the output bytes have no known signature'}, and the tool declares ${tool.formats.join(', ')}. The file is saved as .${ext === 'jpeg' ? 'jpg' : ext}.`);
    }
    if (ext === 'jpeg') ext = 'jpg';
    const output = join(at.outDir, `${at.seq}-${base}.${ext}`);
    if (output !== firstPath) {
      await rename(firstPath, output);
      process.stderr.write(`  row ${at.index}: saved as ${basename(output)}\n`);
    }
    return { record: { row: at.index, toolId: row.toolId, ok: true, output, format: ext, exit: EXIT.OK } };
  } catch (e) {
    return {
      record: { row: at.index, toolId: row.toolId, ok: false, format: named || '-', exit: exitCodeFor(e), error: (e as Error).message },
      error: e,
    };
  }
}

/** The font containers run.ts converts a transform's output to, from the file name. */
const FONT_CONTAINERS = new Set(['ttf', 'otf', 'woff']);

/** A select input whose options name a declared format, and its manifest default. */
interface ContainerChoice { id: string; fallback?: string }

/**
 * The selects that choose a transform's output container: those whose options name one
 * of the formats it declares (convert-image `target`, clean `audioFormat`, trim
 * `container` and `audioOnly`).
 */
function containerChoices(manifest: {
  render: { formats: string[] };
  inputs?: Array<{ id: string; type: string; options?: unknown; default?: unknown }>;
}): ContainerChoice[] {
  const norm = (f: string): string => (f.toLowerCase() === 'jpeg' ? 'jpg' : f.toLowerCase());
  const declared = new Set(manifest.render.formats.map(norm));
  return (manifest.inputs ?? [])
    .filter(i => i.type === 'select' && Array.isArray(i.options) && i.options.some(o => {
      const value = o && typeof o === 'object' ? (o as { value?: unknown }).value : o;
      return typeof value === 'string' && declared.has(norm(value));
    }))
    .map(i => ({ id: i.id, ...(typeof i.default === 'string' ? { fallback: i.default } : {}) }));
}
