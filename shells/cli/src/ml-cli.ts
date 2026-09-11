// SPDX-License-Identifier: MPL-2.0
/**
 * The discovery surface for the on-device ML utilities (plans/183 WS2):
 * `lolly upscale`, `lolly matte`, `lolly ocr`, `lolly detect-ai`,
 * `lolly reword` and `lolly depth`.
 *
 * These are THIN. Every one of them decodes a file to RGBA (or reads text),
 * hands it to the same API a tool's hook would reach through `host.*`, and
 * writes the result. There is no second implementation of anything here: the
 * models, the geometry and the gates all live in packages/node-shell/src/ml/,
 * which is the module the web shell imports too.
 *
 * WHY THEY EXIST AS SUBCOMMANDS. A capability nothing surfaces is a capability
 * nobody finds. `host.upscale` in a hook is the real integration; these six
 * commands are how a person discovers that the model is there, checks it runs on
 * their machine, and scripts it without writing a tool.
 *
 * REFUSALS NAME THE MODEL. Nothing here downloads anything. A family whose
 * weights are absent refuses with the model's name, the download size and the
 * `lolly models fetch <family>` command, and exits UNAVAILABLE_HERE (3) - "may
 * succeed elsewhere", which is the honest code for a machine that has not been
 * given the bytes yet.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { basename } from 'node:path';
import {
  createNodeAiDetectAPI, createNodeDepthAPI, createNodeMatteAPI, createNodeOcrAPI,
  createNodeRewordAPI, createNodeUpscaleAPI, decodeRgba, depthMapToRgba, encodeRgbaPng,
  formatBytes, MATTE_DEFAULT_MODEL, ModelNotInstalledError, modelsDirNote, resolveMatteModel,
  UPSCALE_DEFAULT_MODEL,
} from '../../../packages/node-shell/src/ml/index.ts';
import { REWORD_STYLES } from '../../../packages/node-shell/src/ml/reword.ts';
import { EXIT, CliError, unavailableHere, usageError } from './exit-codes.ts';
import { note, writeOut } from './output.ts';

/** How the entry point hands over piped stdin (it reads bytes, this reads text). */
export type StdinReader = () => Promise<string | Buffer>;

/** A missing runtime and a missing model are both "not here, maybe elsewhere". */
function notHere(message: string, kind: string): CliError {
  return unavailableHere(message, kind);
}

/** Turn the shared refusal into a CLI error that exits 3 and keeps its words. */
function asCliError(err: unknown): unknown {
  if (err instanceof ModelNotInstalledError) return notHere(err.message, 'MODEL_NOT_INSTALLED');
  return err;
}

async function readFrame(path: string): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch {
    throw usageError(`Cannot read ${path}`, 'MISSING_FILE');
  }
  try {
    return await decodeRgba(bytes);
  } catch {
    throw usageError(`${basename(path)} is not an image this shell can decode.`, 'BAD_INPUT');
  }
}

/** Write a PNG to `--out`, or to stdout when it is `-`. */
async function writePng(frame: { width: number; height: number; data: Uint8ClampedArray }, out: string | undefined): Promise<void> {
  const png = await encodeRgbaPng(frame);
  if (!out || out === '-') { await writeOut(png); return; }
  await writeFile(out, png);
  note(`wrote ${out} (${frame.width}×${frame.height})`);
}

function positiveInt(value: string | undefined, name: string): number | undefined {
  if (value === undefined) return undefined;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw usageError(`--${name} takes a positive number`, 'BAD_FLAG');
  return n;
}

// ── lolly upscale ────────────────────────────────────────────────────────────

export async function upscaleCli(positionals: string[], flags: Record<string, string>): Promise<number> {
  const api = createNodeUpscaleAPI();
  if (!api) throw notHere('Upscaling needs onnxruntime-node and sharp, and neither resolves in this install.', 'CAPABILITY_UNAVAILABLE');
  // `--models` is a question about the install, not about an image, so it is
  // answered before an input is demanded.
  if (flags.models !== undefined) return listModels(api.models(), (m) => `${m.id}  ${m.name}  x${m.scale}  ${formatBytes(m.approxBytes)}  ${m.license}${m.warning ? `  [${m.warning}]` : ''}`);
  const input = positionals[0];
  if (!input) throw usageError('usage: lolly upscale <image> [--scale=2|4] [--model=<id>] [--out=<file.png>] [--models]', 'MISSING_ARGUMENT');

  const model = flags.model as Parameters<typeof api.modelBytes>[0] | undefined;
  const scaleRaw = flags.scale ? Number(flags.scale) : undefined;
  if (scaleRaw !== undefined && scaleRaw !== 2 && scaleRaw !== 4) {
    throw usageError('--scale takes 2 or 4 (the models are native x4; 2 trims the result).', 'BAD_FLAG');
  }
  const frame = await readFrame(input);
  const feas = await api.canRun(frame, { ...(model ? { model } : {}) });
  if (!feas.ok) throw new CliError(feas.message ?? 'This image cannot be upscaled here.', EXIT.REFUSED, 'NOT_FEASIBLE');

  // Only announce the work when the weights are actually here: otherwise run()
  // refuses in the next breath and the note reads like a run that was attempted.
  if (await api.cached(model ?? UPSCALE_DEFAULT_MODEL)) note(`upscaling ${frame.width}×${frame.height}…`);
  try {
    const out = await api.run(frame, {
      ...(model ? { model } : {}),
      ...(scaleRaw ? { scale: scaleRaw as 2 | 4 } : {}),
      ...(positiveInt(flags['max-edge'], 'max-edge') ? { targetMaxEdge: positiveInt(flags['max-edge'], 'max-edge')! } : {}),
      onProgress: (p) => { if (p.tiles) note(`  tile ${p.tile}/${p.tiles}`); },
    });
    await writePng(out, flags.out);
    return EXIT.OK;
  } catch (err) { throw asCliError(err); }
}

// ── lolly matte ──────────────────────────────────────────────────────────────

export async function matteCli(positionals: string[], flags: Record<string, string>): Promise<number> {
  const api = createNodeMatteAPI();
  if (!api) throw notHere('Background removal needs onnxruntime-node and sharp, and neither resolves in this install.', 'CAPABILITY_UNAVAILABLE');
  if (flags.models !== undefined) return listModels(api.models(), (m) => `${m.id}  ${m.name}  ${m.tier}  ${formatBytes(m.approxBytes)}  ${m.license}`);
  const input = positionals[0];
  if (!input) throw usageError('usage: lolly matte <image> [--model=u2netp|modnet] [--max-edge=N] [--out=<file.png>] [--models]', 'MISSING_ARGUMENT');

  const model = flags.model as Parameters<typeof api.modelBytes>[0] | undefined;
  const frame = await readFrame(input);
  if (await api.cached(resolveMatteModel(model ?? MATTE_DEFAULT_MODEL))) note(`cutting out ${frame.width}×${frame.height}…`);
  try {
    const out = await api.run(frame, {
      ...(model ? { model } : {}),
      ...(positiveInt(flags['max-edge'], 'max-edge') ? { maxEdge: positiveInt(flags['max-edge'], 'max-edge')! } : {}),
    });
    await writePng(out, flags.out);
    return EXIT.OK;
  } catch (err) { throw asCliError(err); }
}

// ── lolly ocr ────────────────────────────────────────────────────────────────

export async function ocrCli(positionals: string[], flags: Record<string, string>, json: boolean): Promise<number> {
  const api = createNodeOcrAPI();
  if (!api) throw notHere('Text recognition needs onnxruntime-node and sharp, and neither resolves in this install.', 'CAPABILITY_UNAVAILABLE');
  if (flags.models !== undefined) return listModels(api.models(), (m) => `${m.id}  ${m.name}  ${m.tier}  ${formatBytes(m.approxBytes)}  ${m.languages.join(',')}`);
  const input = positionals[0];
  if (!input) throw usageError('usage: lolly ocr <image> [--json] [--single-line] [--min-confidence=0.5] [--models]', 'MISSING_ARGUMENT');

  const frame = await readFrame(input);
  try {
    const result = await api.run(frame, {
      ...(flags['single-line'] !== undefined ? { singleLine: true } : {}),
      ...(flags['min-confidence'] ? { minConfidence: Number(flags['min-confidence']) } : {}),
    });
    if (json) {
      await writeOut(`${JSON.stringify({ ok: true, command: 'ocr', result }, null, 2)}\n`);
    } else {
      // The text IS the payload: stdout carries it and nothing else, so
      // `lolly ocr shot.png > shot.txt` is a whole workflow.
      await writeOut(result.text ? `${result.text}\n` : '');
      note(`${result.lines.length} line(s), ${result.lang}`);
    }
    return result.lines.length ? EXIT.OK : EXIT.NOT_FOUND;
  } catch (err) { throw asCliError(err); }
}

// ── lolly detect-ai ──────────────────────────────────────────────────────────

export async function detectAiCli(positionals: string[], flags: Record<string, string>, json: boolean, readStdin: StdinReader): Promise<number> {
  const api = createNodeAiDetectAPI();
  if (!api) throw notHere('The AI-text detector needs @huggingface/transformers, which does not resolve in this install.', 'CAPABILITY_UNAVAILABLE');
  const text = await textFrom(positionals, flags, readStdin,
    'usage: lolly detect-ai "<text>"   (or --in=<file.txt>, or pipe it in)');

  if (!api.eligible(text)) {
    // Absence of a check is NEVER a verdict. Say which gate refused and stop.
    const message = 'Not checked: the detector is trained on English and over-scores non-native-English prose, '
      + 'so it is only asked about texts of 50+ words that are mostly Latin script. This one is not.';
    if (json) { await writeOut(`${JSON.stringify({ ok: true, command: 'detect-ai', checked: false, reason: 'ineligible' }, null, 2)}\n`); }
    else note(message);
    return EXIT.NOT_FOUND;
  }
  try {
    const est = await api.score(text);
    if (!est) { note('Not checked: no detector model is staged in this build.'); return EXIT.NOT_FOUND; }
    if (json) {
      await writeOut(`${JSON.stringify({ ok: true, command: 'detect-ai', estimate: est }, null, 2)}\n`);
    } else {
      // An ESTIMATE, never a verdict: the number, the operating point, and the
      // model that produced it, with no word like "detected" anywhere near it.
      await writeOut(`${est.probAi.toFixed(4)} (operating point ${est.threshold}, ${est.modelName})\n`);
    }
    return EXIT.OK;
  } catch (err) { throw asCliError(err); }
}

// ── lolly reword ─────────────────────────────────────────────────────────────

export async function rewordCli(positionals: string[], flags: Record<string, string>, json: boolean, readStdin: StdinReader): Promise<number> {
  const api = createNodeRewordAPI();
  if (!api) throw notHere('Rewording needs @huggingface/transformers, which does not resolve in this install.', 'CAPABILITY_UNAVAILABLE');
  const style = flags.style ?? 'plain';
  if (!(REWORD_STYLES as readonly string[]).includes(style)) {
    // The prompt is engine data (REWORD_SYSTEM_PROMPT) and asks for exactly one
    // thing. Accepting a style name that changes nothing would be the silent
    // class this shell exists to remove.
    throw usageError(
      `--style=${style} is not available: the on-device model is prompted for one rewrite, shorter and plainer. `
      + `The only accepted value is ${REWORD_STYLES.join(', ')}.`,
      'BAD_FLAG',
    );
  }
  const sentence = await textFrom(positionals, flags, readStdin,
    'usage: lolly reword "<sentence>" [--style=plain] [--samples=3]   (or --in=<file.txt>, or pipe it in)');
  const count = positiveInt(flags.samples, 'samples');
  try {
    const candidates = await api.reword(sentence, count);
    if (json) {
      await writeOut(`${JSON.stringify({ ok: true, command: 'reword', original: sentence, candidates }, null, 2)}\n`);
    } else if (!candidates.length) {
      // The engine gate refused every sample. That is a real answer, not a bug:
      // a candidate that is longer, off-topic or changes a number is not offered.
      note('No rewrite passed the gate (each sample was longer, off-topic, or changed a fact).');
      return EXIT.NOT_FOUND;
    } else {
      for (const c of candidates) await writeOut(`${c.text}\n`);
    }
    return candidates.length ? EXIT.OK : EXIT.NOT_FOUND;
  } catch (err) { throw asCliError(err); }
}

// ── lolly depth ──────────────────────────────────────────────────────────────

export async function depthCli(positionals: string[], flags: Record<string, string>): Promise<number> {
  const input = positionals[0];
  if (!input) throw usageError('usage: lolly depth <image> [--max-edge=N] [--out=<file.png>]', 'MISSING_ARGUMENT');
  const api = createNodeDepthAPI();
  if (!api) throw notHere('Depth needs onnxruntime-node, which does not resolve in this install.', 'CAPABILITY_UNAVAILABLE');
  if (!api.models().length) {
    throw notHere(
      'No depth model is published yet, so there is nothing to download or run (the weights are a human publishing step). '
      + `Models directory: ${modelsDirNote()}.`,
      'MODEL_NOT_STAGED',
    );
  }
  const frame = await readFrame(input);
  note(`reading depth from ${frame.width}×${frame.height}…`);
  try {
    const map = await api.run(frame, {
      ...(positiveInt(flags['max-edge'], 'max-edge') ? { maxEdge: positiveInt(flags['max-edge'], 'max-edge')! } : {}),
    });
    // Greyscale, white nearest - the same sign the displacement render wants.
    await writePng(depthMapToRgba(map), flags.out);
    return EXIT.OK;
  } catch (err) { throw asCliError(err); }
}

// ── shared bits ──────────────────────────────────────────────────────────────

/** The text argument: a positional, `--in=<file>`, or stdin. */
async function textFrom(
  positionals: string[], flags: Record<string, string>, readStdin: StdinReader, usage: string,
): Promise<string> {
  if (flags.in) {
    try { return await readFile(flags.in, 'utf8'); }
    catch { throw usageError(`Cannot read ${flags.in}`, 'MISSING_FILE'); }
  }
  const joined = positionals.join(' ').trim();
  if (joined) return joined;
  if (!process.stdin.isTTY) {
    const piped = String(await readStdin()).trim();
    if (piped) return piped;
  }
  throw usageError(usage, 'MISSING_ARGUMENT');
}

/** `--models` on any of the image commands: the roster this shell offers, which
 *  is the roster the app offers (one catalogue module, both shells). */
async function listModels<T>(models: T[], line: (m: T) => string): Promise<number> {
  if (!models.length) {
    note('No model is staged for this family in this build.');
    return EXIT.NOT_FOUND;
  }
  for (const m of models) await writeOut(`${line(m)}\n`);
  return EXIT.OK;
}
