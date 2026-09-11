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
 */
import { readFile, mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { parseBatchCsv, batchCsvTemplateWithNotes, loadTool } from '@lolly/engine';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
import { runToolCli } from './run.ts';
import { EXIT, exitCodeFor, usageError } from './exit-codes.ts';
import { warn } from './output.ts';

const REPO_ROOT = repoRoot();
const fetchFile = (p: string): Promise<string> => readFile(join(REPO_ROOT, 'tools', p), 'utf8');
const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'out';

/** Print a starter CSV grid for the given tool ids (their input columns + reserved). */
export async function batchTemplateCli(toolIds: string[], opts: { json?: boolean } = {}): Promise<void> {
  const tools: Array<{ id: string; inputs: Array<{ id: string }> }> = [];
  for (const raw of toolIds) {
    const id = raw.trim();
    if (!id) continue;
    try {
      const t = await loadTool(id, fetchFile);
      tools.push({ id: t.manifest.id, inputs: (t.manifest.inputs ?? []).map(i => ({ id: i.id })) });
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
  const formatCache = new Map<string, string>();
  const defaultFormat = async (id: string): Promise<string> => {
    const hit = formatCache.get(id);
    if (hit) return hit;
    let f = 'svg';
    try { const t = await loadTool(id, fetchFile); f = t.manifest.render.formats[0] ?? 'svg'; } catch { /* runToolCli reports */ }
    formatCache.set(id, f);
    return f;
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
    const fmt = row.format ?? await defaultFormat(row.toolId);
    const seq = String(i + 1).padStart(pad, '0');
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
