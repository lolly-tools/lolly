// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly intent` (plan 350 W4): state what a piece has to do, and Lolly chooses the tool for
 * each surface, says why and shows what it could not fill.
 *
 *   lolly intent <intent.json|-> [--json] [--render] [--out-dir=<dir>]
 *
 * The work is the engine's `resolveIntent`, which the `lolly_resolve_intent` MCP tool also
 * runs, so both hand back the same `IntentResolutionV1` for the same request. No model is in
 * this path: the file says what to make, and an intent's prompt is carried and never read.
 *
 * `--render` runs each `ready` surface through the normal render path and writes the
 * resolution beside the files as `intent-resolution.json`. Nothing is written into the
 * files by this verb. `renderResolvedSurface` is the one place a resolution reaches a render,
 * so anything a render takes from a resolution belongs there and nowhere else.
 *
 * Exit codes: 0 every surface is ready (and rendered, with --render); 2 usage (an unknown or
 * bare flag, a missing file, a file that is not JSON); 4 refused (a request the parser
 * refuses, or a surface that is not ready, with the full answer on stdout); 1 a render failed.
 */
import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { IntentInvalidError, loadIntentTools, resolveIntent } from '@lolly/engine';
import { TOOL_INTENTS_FILE, type IntentResolutionV1, type IntentSurfaceResultV1, type IntentToolFactsV1 } from '@lolly-tools/core/intent-v1';
import { readToolManifest, toolDirs, toolFile } from '@lolly-tools/node-shell/content-roots';
import { emitResult } from './envelope.ts';
import { CliError, EXIT, usageError } from './exit-codes.ts';
import { note, warn, writeOut } from './output.ts';
import { readStdin, runToolCli } from './run.ts';

export interface IntentCliFlags {
  render?: boolean;
  outDir?: string;
  json?: boolean;
}

/** One surface's file, or why it has none. */
export interface IntentRenderedV1 {
  surface: string;
  toolId: string;
  format: string;
  path?: string;
  error?: { kind: string; message: string };
}

async function readRequest(path: string): Promise<unknown> {
  let text: string;
  if (path === '-') text = (await readStdin()).toString('utf8');
  else {
    try {
      text = await readFile(path, 'utf8');
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') throw usageError(`No file at ${path} (the intent).`, 'FILE_NOT_FOUND');
      if (code === 'EISDIR') throw usageError(`${path} is a folder; lolly intent takes a file.`, 'BAD_FLAG_VALUE');
      throw err;
    }
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw usageError(`The intent is not JSON (${(err as Error).message}).`, 'BAD_INPUT');
  }
}

/** Every tool in the content profile with an intents.json, through the resolver, so a brand overlay's file wins by the usual rule. */
function intentTools(): Promise<IntentToolFactsV1[]> {
  return loadIntentTools({
    ids: [...toolDirs().keys()],
    sidecar: (id) => {
      const path = toolFile(id, TOOL_INTENTS_FILE);
      return path ? readFileSync(path, 'utf8') : null;
    },
    manifest: (id) => readToolManifest(id),
    onInvalid: (id, errors) => warn('INTENTS_INVALID', `${id}/${TOOL_INTENTS_FILE} left out: ${errors.map((e) => e.message).join(' ')}`),
  });
}

/** A file extension for an export format: `pdf-cmyk` and `cmyk-tiff` are still a .pdf and a .tiff. */
function extensionOf(format: string): string {
  if (format.startsWith('cmyk-')) return format.slice('cmyk-'.length);
  const dash = format.indexOf('-');
  return dash > 0 ? format.slice(0, dash) : format;
}

/**
 * The one seam between a resolution and a render. Every surface `--render` makes comes through
 * here, with the whole resolution in hand, so a later step that reads the resolution at render
 * time changes this function and no other.
 */
export async function renderResolvedSurface(
  resolution: IntentResolutionV1,
  result: IntentSurfaceResultV1,
  outDir: string,
): Promise<IntentRenderedV1> {
  const choice = result.chosen;
  if (result.status !== 'ready' || !choice) throw new Error(`renderResolvedSurface takes a ready surface, not ${result.status}.`);
  const name = `${resolution.closed.purpose}-${result.surface.id}-${choice.toolId}.${extensionOf(choice.format)}`;
  const path = join(outDir, name);
  const base = { surface: result.surface.id, toolId: choice.toolId, format: choice.format };
  try {
    await runToolCli({
      toolId: choice.toolId,
      inputValues: choice.inputs,
      params: choice.sizeSetBy === 'export'
        ? { width: String(choice.exportDims.width), height: String(choice.exportDims.height), unit: choice.exportDims.unit }
        : {},
      outputPath: path,
      format: choice.format,
      rejectUnknown: true,
    });
    return { ...base, path };
  } catch (err) {
    return { ...base, error: { kind: (err as CliError).kind ?? 'FAILED', message: err instanceof Error ? err.message : String(err) } };
  }
}

function dimsText(dims: { width: number; height: number; unit: string }): string {
  return `${dims.width} x ${dims.height} ${dims.unit}`;
}

/** The answer for a person reading a terminal. `--json` carries everything this leaves out. */
function humanText(resolution: IntentResolutionV1, rendered: readonly IntentRenderedV1[] | null): string {
  const lines: string[] = [];
  const { closed, purposeNeeded } = resolution;
  lines.push(`Intent: ${resolution.outcome}${closed.purpose ? ` (${closed.purpose})` : ''}`);
  lines.push(`Rules ${closed.rulesVersion}, ${resolution.intentDigest}`);
  if (purposeNeeded) {
    lines.push('', `${purposeNeeded.code}: ${purposeNeeded.message}`, '', 'Purposes:');
    for (const p of purposeNeeded.purposes) {
      lines.push(`  ${p.purpose.padEnd(12)} ${p.meaning}${p.tools.length ? ` [${p.tools.join(', ')}]` : ''}`);
    }
    lines.push('', `Surfaces: ${purposeNeeded.surfaces.join(', ')}`, `Roles: ${purposeNeeded.roles.join(', ')}`);
    return `${lines.join('\n')}\n`;
  }
  for (const result of resolution.surfaces) {
    lines.push('');
    const choice = result.chosen;
    if (!choice) {
      lines.push(`${result.surface.id}: refused. ${result.refusal?.message ?? ''}`);
    } else {
      lines.push(`${result.surface.id}: ${result.status}. ${choice.toolId} ${choice.toolVersion ?? ''} as ${choice.format}, ${dimsText(choice.exportDims)}`.replace('  ', ' '));
      const why = result.candidates.find((c) => c.toolId === choice.toolId)?.reasons.map((r) => r.message).join(' ');
      if (why) lines.push(`  Why: ${why}`);
      for (const gap of choice.gaps) lines.push(`  Needs ${gap.role ?? gap.input}: ${gap.message}`);
      for (const item of choice.unused) lines.push(`  Not used, ${item.role}: ${item.message}`);
      if (choice.defaultsInUse.length) lines.push(`  The tool's own wording stays in: ${choice.defaultsInUse.join(', ')}`);
      for (const n of choice.notes) lines.push(`  Note: ${n.message}`);
      const others = result.candidates.filter((c) => c.toolId !== choice.toolId).map((c) => c.toolId);
      if (others.length) lines.push(`  Also fits: ${others.join(', ')}`);
    }
    const refused = result.refusals.filter((r) => r.code !== 'purpose-other');
    for (const r of refused) lines.push(`  Left out, ${r.toolId}: ${r.message}`);
    const file = rendered?.find((r) => r.surface === result.surface.id);
    if (file?.path) lines.push(`  Wrote ${file.path}`);
    if (file?.error) lines.push(`  Failed: ${file.error.message}`);
  }
  return `${lines.join('\n')}\n`;
}

/** `lolly intent`. Returns the exit code; the verb never calls process.exit. */
export async function intentCli(positionals: readonly string[], flags: IntentCliFlags): Promise<number> {
  const path = positionals[0];
  if (!path) throw usageError('usage: lolly intent <intent.json|-> [--json] [--render] [--out-dir=<dir>]', 'MISSING_ARGUMENT');
  if (flags.outDir !== undefined && !flags.render) throw usageError('--out-dir only applies with --render.', 'BAD_FLAG_VALUE');
  const request = await readRequest(path);
  let resolution: IntentResolutionV1;
  try {
    resolution = await resolveIntent(request, await intentTools());
  } catch (err) {
    if (err instanceof IntentInvalidError) {
      throw new CliError(err.message, EXIT.REFUSED, 'INTENT_INVALID', JSON.stringify(err.errors));
    }
    throw err;
  }

  let rendered: IntentRenderedV1[] | null = null;
  if (flags.render) {
    const outDir = flags.outDir || './out';
    await mkdir(outDir, { recursive: true });
    rendered = [];
    for (const result of resolution.surfaces) {
      if (result.status !== 'ready') continue;
      const file = await renderResolvedSurface(resolution, result, outDir);
      rendered.push(file);
      if (file.error) note(`${result.surface.id}: ${file.error.message}`);
    }
    await writeFile(join(outDir, 'intent-resolution.json'), `${JSON.stringify(resolution, null, 2)}\n`);
  }

  const failedRender = rendered?.some((file) => file.error) === true;
  const exit = resolution.outcome !== 'ready' ? EXIT.REFUSED : failedRender ? EXIT.FAILED : EXIT.OK;
  if (flags.json) await emitResult({ resolution, ...(rendered ? { rendered } : {}) }, exit);
  else await writeOut(humanText(resolution, rendered));
  return exit;
}

