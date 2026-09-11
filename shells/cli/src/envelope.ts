// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's ONE machine surface (plans/73-cli-ga-contract.md section 5.2).
 *
 * Every `--json` emission from every command is the same envelope, so an agent writes
 * one parser and one failure branch rather than one per subcommand:
 *
 * ```json
 * { "schemaVersion": 1, "command": "validate", "ok": true, "engine": "1.92.0",
 *   "cli": "0.1.0", "result": {…}, "warnings": [], "error": null }
 * ```
 *
 * Three rules, frozen at GA:
 *
 *  1. **The envelope covers the failure path.** Before this, `lolly validate /nope.png
 *     --json` wrote ZERO bytes to stdout and a prose `Error:` line to stderr, so a
 *     consumer doing `lolly … --json > r.json` was left with an unparseable empty file
 *     and an agent reading stdout got EOF. Now, if `--json` was asked for, stdout
 *     carries exactly one complete document on every path, including usage errors and
 *     crashes.
 *  2. **One document, nothing human mixed in.** The envelope is the only thing on
 *     stdout for a `--json` run; the prose that a human run would print goes to stderr
 *     or is not printed at all.
 *  3. **`ok` mirrors the exit code, `error` describes a run that produced no result.**
 *     `validate` answering "no credential here" exits 5 with `ok:false` and a full
 *     `result`, because that is an answer, not a breakage. `error` is non-null only
 *     when there is nothing to report but the failure. Consumers branch on
 *     `error.kind` (stable, section 10) or the process exit code, never on `error.message`.
 *
 * Additive-change policy, also frozen: keys may appear inside `result`/`error`/
 * `warnings` at any time and consumers MUST ignore unknown ones; enum values may be
 * added and consumers MUST have a default branch. `schemaVersion` increments only when
 * a key is REMOVED, retyped, or changes meaning.
 */

import { readFile } from 'node:fs/promises';
import { EXIT_NAME, exitCodeFor, errorKind } from './exit-codes.ts';
import { recordedWarnings, writeOut } from './output.ts';

/** The integer the whole machine contract hangs off. Not semver - see the header. */
export const SCHEMA_VERSION = 1;

export interface EnvelopeError {
  /** The exit code's NAME, e.g. `UNAVAILABLE_HERE`. */
  code: string;
  /** The exit code itself, so a saved document carries it too. */
  exit: number;
  /** The stable machine handle, e.g. `FORMAT_UNAVAILABLE`. Branch on this. */
  kind: string;
  /** Human wording. Explicitly NOT stable - never branch on it. */
  message: string;
  detail?: string;
}

export interface Envelope<T = unknown> {
  schemaVersion: number;
  command: string;
  ok: boolean;
  engine: string;
  cli: string;
  result: T | null;
  warnings: Array<{ code: string; message: string; kind: string }>;
  error: EnvelopeError | null;
}

/**
 * Which command is running, and whether `--json` was asked for.
 *
 * Module state rather than a threaded parameter because the ONE place that needs both
 * and cannot be handed them is the top-level catch in `bin/lolly.ts`: by the time an
 * exception arrives there, the call that knew the command has unwound.
 */
let command = 'lolly';
let json = false;
/** Set once a command has emitted its own envelope, so the catch can't emit a second. */
let emitted = false;

export function beginCommand(name: string, wantsJson: boolean): void {
  command = name;
  json = wantsJson;
  emitted = false;
}

export const jsonRequested = (): boolean => json;
export const envelopeEmitted = (): boolean => emitted;

/** Test seam. */
export function resetEnvelope(): void {
  command = 'lolly';
  json = false;
  emitted = false;
}

let versions: { engine: string; cli: string } | null = null;

/** Engine + CLI versions, read once. The CLI version comes from its own package.json. */
export async function toolVersions(): Promise<{ engine: string; cli: string }> {
  if (versions) return versions;
  const { ENGINE_VERSION } = await import('@lolly/engine');
  let cli = '0.0.0';
  try {
    const pkg = JSON.parse(
      await readFile(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version?: string };
    cli = pkg.version ?? cli;
  } catch { /* a shell without its own package.json still reports the engine */ }
  versions = { engine: ENGINE_VERSION, cli };
  return versions;
}

/** Build the envelope for a successful (or answered) run. */
export async function envelope<T>(result: T, ok: boolean, error: EnvelopeError | null = null): Promise<Envelope<T>> {
  const { engine, cli } = await toolVersions();
  return {
    schemaVersion: SCHEMA_VERSION,
    command,
    ok,
    engine,
    cli,
    result,
    warnings: recordedWarnings().map(w => ({ code: w.code, message: w.message, kind: w.kind })),
    error,
  };
}

/**
 * Write the envelope for a produced result. `exit` is the code the command is about to
 * return, so `ok` and the document agree with what the shell tells the OS.
 */
export async function emitResult<T>(result: T, exit = 0): Promise<void> {
  const env = await envelope(result, exit === 0);
  emitted = true;
  await writeOut(JSON.stringify(env, null, 2) + '\n');
}

/** Turn any thrown value into the envelope's `error` object. */
export function errorObject(err: unknown): EnvelopeError {
  const exit = exitCodeFor(err);
  const e = (err ?? {}) as { message?: unknown; detail?: unknown };
  return {
    code: EXIT_NAME[exit] ?? 'FAILED',
    exit,
    kind: errorKind(err),
    message: typeof e.message === 'string' ? e.message : String(err),
    ...(typeof e.detail === 'string' ? { detail: e.detail } : {}),
  };
}

/**
 * Write the envelope for a run that produced nothing. Called from the top-level catch,
 * and only when `--json` was requested and no command emitted its own document.
 */
export async function emitError(err: unknown): Promise<void> {
  const env = await envelope(null, false, errorObject(err));
  emitted = true;
  await writeOut(JSON.stringify(env, null, 2) + '\n');
}
