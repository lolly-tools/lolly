// SPDX-License-Identifier: MPL-2.0
/**
 * Where on-device model weights live, and what a family's files are.
 *
 * Every Node caller that reads or writes a model file resolves the directory
 * through this one module: `speech.ts` (Kokoro + Whisper), `ml/session.ts` (the
 * upscale/matte/ocr/ai-detect/reword/depth runners) and `lolly models`. It was
 * written twice in parallel during plans/183 and the two copies already differed
 * in a way nobody would have noticed until a fetch wrote to the wrong place, so
 * the rungs and both policies are declared together here, where the difference
 * between them is visible.
 *
 * THE RUNGS, in order:
 *   1. an explicit directory a caller passed in
 *   2. $LOLLY_MODELS_DIR
 *   3. `<repoRoot>/shells/web/public/models` - a dev checkout shares the one copy
 *      the web shell already serves rather than downloading a second
 *   4. `~/.cache/lolly/models`
 *
 * THE TWO POLICIES. They differ on one question: what happens when a rung names
 * a directory that is not on disk?
 *   - `resolveModelsDir` takes $LOLLY_MODELS_DIR AS GIVEN. This is the WRITE
 *     policy, and the one `lolly models fetch` and `host.speech` use: a person
 *     who names a directory means that directory, and a fetch into a fresh empty
 *     path must not quietly write somewhere else.
 *   - `resolveExistingModelsDir` passes over a rung that is not a directory and
 *     falls back to the repo staging path. This is the READ policy the ML
 *     runners use, where the question is "which of these places actually has
 *     weights in it".
 * Neither ever creates a directory: resolution is a read, and the download that
 * would fill it is a separate, consented step.
 */
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { repoRoot } from './repo-root.ts';

/** One staged model file: its path under `<modelsDir>/<family>/`, how big it is,
 *  and the hash a download must match before it is written. */
export interface ModelFilePin {
  path: string;
  bytes: number;
  sha256: string;
}

/** How a caller can steer resolution. Every field past `modelsDir` is a test
 *  seam; production callers pass at most `modelsDir`. */
export interface ModelsDirOptions {
  /** An explicit directory, used as given. */
  modelsDir?: string;
  /** Defaults to `process.env`. */
  env?: Record<string, string | undefined>;
  /** Defaults to the shared repo-root resolver. */
  repoRoot?: string;
  /** Defaults to `existsSync`. */
  exists?: (path: string) => boolean;
}

/** The models tree the web shell serves out of this checkout. */
export function stagedModelsDir(root?: string): string {
  return join(root ?? repoRoot(), 'shells', 'web', 'public', 'models');
}

/** Where a fetch writes on a machine with no repo staging. */
export function userCacheModelsDir(): string {
  return join(homedir(), '.cache', 'lolly', 'models');
}

/** Every candidate root, in precedence order. Exported so a refusal can print
 *  what was looked at when nothing was found. */
export function modelsDirCandidates(env: Record<string, string | undefined> = process.env): string[] {
  const out: string[] = [];
  const explicit = env.LOLLY_MODELS_DIR?.trim();
  if (explicit) out.push(explicit);
  out.push(stagedModelsDir());
  out.push(userCacheModelsDir());
  return out;
}

/**
 * The WRITE policy (see the header): the first rung that answers wins, and
 * $LOLLY_MODELS_DIR answers whether or not it exists yet. Only the repo staging
 * rung is probed, and only when the two rungs above it stayed quiet.
 */
export function resolveModelsDir(opts: ModelsDirOptions = {}): string {
  if (opts.modelsDir) return opts.modelsDir;
  const env = opts.env ?? process.env;
  const fromEnv = env.LOLLY_MODELS_DIR;
  if (fromEnv) return fromEnv;
  const exists = opts.exists ?? existsSync;
  const staged = stagedModelsDir(opts.repoRoot);
  if (exists(staged)) return staged;
  return userCacheModelsDir();
}

function isDir(path: string): boolean {
  try { return statSync(path).isDirectory(); } catch { return false; }
}

/**
 * The READ policy (see the header): the first candidate that is a directory,
 * else the repo staging path, so a refusal can still name a real place.
 */
export function resolveExistingModelsDir(env: Record<string, string | undefined> = process.env): string {
  for (const candidate of modelsDirCandidates(env)) if (isDir(candidate)) return candidate;
  return stagedModelsDir();
}

/**
 * Which of a pinned file list is not on disk under `familyDir`. A file whose
 * size does not match its pin counts as missing too: a truncated 40 MB ONNX is
 * not a model, and reporting it as present would turn a clear refusal into a
 * crash deep inside a session loader.
 */
export function missingPinnedFiles(
  familyDir: string,
  pins: readonly ModelFilePin[],
  only?: (pin: ModelFilePin) => boolean,
): string[] {
  const out: string[] = [];
  for (const pin of pins) {
    if (only && !only(pin)) continue;
    const path = join(familyDir, ...pin.path.split('/'));
    let size = -1;
    try { size = statSync(path).size; } catch { size = -1; }
    if (size !== pin.bytes) out.push(pin.path);
  }
  return out;
}

/** Every byte a full fetch of these files would download. */
export function pinnedBytes(pins: readonly ModelFilePin[]): number {
  return pins.reduce((n, pin) => n + pin.bytes, 0);
}
