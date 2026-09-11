// SPDX-License-Identifier: MPL-2.0
/** Content-free, device-only preparation. Private review files require an explicit path. */
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { basename, resolve, join } from 'node:path';
import { inspectPreparation, applyPreparation, readPreparationRecipe, preparationRecipe, applyPreparationMetadata } from '@lolly/engine';
import type { PreparationSource, PreparationRule, PreparationInspection, PreparationChoice, PreparationResult } from '@lolly-tools/core/host-v1';
import { usageError, CliError, EXIT } from './exit-codes.ts';
import { emitResult } from './envelope.ts';
import { isOn } from './args.ts';
import { writeOut } from './output.ts';
export async function readPreparationSources(paths: string[], signal?: AbortSignal): Promise<PreparationSource[]> {
  if (!paths.length || paths.length > 100) throw usageError('Choose between 1 and 100 input files.');
  const sources: PreparationSource[] = []; let total = 0;
  for (const [i, path] of paths.entries()) {
    signal?.throwIfAborted();
    const info = await stat(path);
    total += info.size;
    if (!info.isFile() || info.size > 32 * 1024 * 1024 || total > 64 * 1024 * 1024) throw usageError('Preparation supports regular files up to 32 MiB each and 64 MiB total.');
    sources.push({ id: `file${i}`, name: basename(path), bytes: new Uint8Array(await readFile(path)) });
  }
  return sources;
}
async function readJson(path: string): Promise<unknown> {
  if ((await stat(path)).size > 4 * 1024 * 1024) throw usageError('The settings or review file is too large.');
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { throw usageError('Could not read the JSON settings or review file.'); }
}
export async function savePreparationCopies(result: PreparationResult, directory: string): Promise<{ id: string; saved: boolean }[]> {
  await mkdir(directory, { recursive: true });
  const delivery: { id: string; saved: boolean }[] = [];
  // Prefix makes names unique, neutralizes traversal, and never replaces an original.
  for (const output of result.outputs) {
    const name = `${output.id}-${[...basename(output.name)].map(c => c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 || c === '\\' || c === '/' ? '_' : c).join('')}`;
    try { await writeFile(join(directory, name), output.bytes, { flag: 'wx', mode: 0o600 }); delivery.push({ id: output.id, saved: true }); }
    catch { delivery.push({ id: output.id, saved: false }); }
  }
  return delivery;
}
const HELP = `lolly prepare <file…> [--replace-all] [--recipe=recipe.json] [--output=copy|--out-dir=directory]
  With no transformation flag: inspect and print a value-free JSON report. Findings do not fail the command.
  --replace-all       Apply suggested replacements (or recipe-selected categories).
  --strip-hidden-data Remove metadata from supported PDF/JPEG/PNG/SVG copies; failures retain files and are reported.
  --rules=file        Local JSON array of {id,label,kind:"literal"|"field",value} rules.
  --review-file=file  Explicitly save a PRIVATE review envelope with values, choices and source hashes.
  --choices=file      Apply an edited review envelope; stale source bytes are rejected.
  --save-recipe=file  Save category/field settings only, without private literals or mappings.
  --report=file       Write the value-free report (stdout remains the default).
  Files are created exclusively with owner-only permissions. Existing files are never overwritten.
  --output=- writes one result's bytes to stdout and sends the report to stderr.
  ZIP inspection has member/depth/expansion bounds; unsupported and encrypted content is retained.
  PDF/image metadata and visible redaction use the existing Strip Hidden Data/Redact utilities.
`;
export async function prepareCli(paths: string[], flags: Record<string, string>): Promise<void> {
  if (flags.help || !paths.length) { await writeOut(HELP); if (!flags.help) throw usageError('Choose an input file.'); return; }
  if (isOn(flags.json) && flags.output === '-') throw usageError('Use a file output path with --json, or omit --json to write result bytes to stdout.');
  if (flags.output && flags['out-dir']) throw usageError('Choose --output or --out-dir.');
  if (flags.output && paths.length !== 1) throw usageError('Use --out-dir for multiple files.');
  if ((isOn(flags['replace-all']) || isOn(flags['strip-hidden-data']) || flags.choices) && !flags.output && !flags['out-dir'] && !flags['review-file']) throw usageError('Choose --output or --out-dir to keep transformed copies, or --review-file to review first.');
  const sources = await readPreparationSources(paths);
  let rules: PreparationRule[] = flags.rules ? await readJson(flags.rules) as PreparationRule[] : [];
  const recipe = flags.recipe ? readPreparationRecipe(await readJson(flags.recipe)) : undefined;
  if (recipe) rules = [...rules, ...recipe.fields.map((value, i) => ({ id: `recipe-${i}`, kind: 'field' as const, label: 'Custom field', value }))];
  const controller = new AbortController(); const cancel = (): void => controller.abort(); process.once('SIGINT', cancel);
  try {
    const options = { signal: controller.signal, progress: (p: { completed: number; total: number }) => { if (process.stderr.isTTY && flags.quiet !== '1') process.stderr.write(`Inspecting ${p.completed}/${p.total}\n`); } };
    let inspection = await inspectPreparation(sources, rules, options);
    let choices: PreparationChoice[] = isOn(flags['replace-all']) ? inspection.groups.filter(g => !recipe || recipe.categories.includes(g.category)).map(g => ({ groupId: g.id, replacement: g.replacement })) : [];
    let removeScopes: string[] = [];
    if (flags.choices) {
      const review = await readJson(flags.choices) as { inspection: PreparationInspection; choices: PreparationChoice[]; removeScopes?: string[] };
      if (!review?.inspection || !Array.isArray(review.choices)) throw usageError('Use a private review envelope produced with --review-file.');
      inspection = review.inspection; choices = review.choices; removeScopes = review.removeScopes ?? [];
    }
    if (flags['review-file']) await writeFile(flags['review-file'], JSON.stringify({ inspection, choices: inspection.groups.map(g => ({ groupId: g.id, replacement: g.replacement })), removeScopes: [] }, null, 2), { flag: 'wx', mode: 0o600 });
    if (flags['save-recipe']) await writeFile(flags['save-recipe'], JSON.stringify(preparationRecipe(recipe?.categories ?? [...new Set(inspection.groups.map(g => g.category))], rules), null, 2), { flag: 'wx', mode: 0o600 });
    let result = await applyPreparation(sources, inspection, choices, removeScopes, options);
    if (isOn(flags['strip-hidden-data'])) {
      const { createPdfAPI } = await import('@lolly-tools/node-shell/pdf');
      result = await applyPreparationMetadata(result, sources.filter(s => /\.(pdf|png|jpe?g|svg)$/i.test(s.name)).map(s => s.id), createPdfAPI(), options);
    }
    let delivery: { id: string; saved: boolean }[] = [];
    if (flags['out-dir']) delivery = await savePreparationCopies(result, flags['out-dir']);
    else if (flags.output === '-') await writeOut(result.outputs[0]!.bytes);
    else if (flags.output) {
      if (paths.some(p => resolve(p) === resolve(flags.output!))) throw usageError('Choose a new output path; your original is retained.');
      await writeFile(flags.output, result.outputs[0]!.bytes, { flag: 'wx', mode: 0o600 }); delivery = [{ id: result.outputs[0]!.id, saved: true }];
    }
    const summary = { ...result.report, delivery };
    const failure = result.report.stages?.some(s => s.status === 'failed') || delivery.some(d => !d.saved);
    const report = JSON.stringify(summary, null, 2) + '\n';
    if (flags.report) await writeFile(flags.report, report, { flag: 'wx', mode: 0o600 });
    if (isOn(flags.json)) await emitResult(summary, failure ? EXIT.FAILED : EXIT.OK);
    else if (!flags.report) { if (flags.output === '-') process.stderr.write(report); else await writeOut(report); }
    if (result.report.stages?.some(s => s.status === 'failed')) throw new CliError('Some selected changes failed. Retained files and successful results are described in the report.', EXIT.FAILED, 'PREPARATION_TRANSFORM');
    if (delivery.some(d => !d.saved)) throw new CliError('Some output files could not be written. Successful copies were kept. Choose a new output directory to retry.', EXIT.FAILED, 'PREPARATION_DELIVERY');
  } catch (error) {
    if (error instanceof CliError) throw error;
    if (controller.signal.aborted) throw new CliError('Preparation cancelled. Originals are unchanged.', EXIT.FAILED, 'PREPARATION_CANCELLED');
    // Do not echo syntax-error snippets or imported private rule values.
    throw new CliError('Preparation could not finish. Check inputs, choices and output paths; originals are unchanged.', EXIT.FAILED, 'PREPARATION_FAILED');
  } finally { process.removeListener('SIGINT', cancel); }
}
