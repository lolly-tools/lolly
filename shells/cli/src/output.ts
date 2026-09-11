// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's output discipline (plans/73-cli-ga-contract.md section 5.3 and section 1.2).
 *
 * TWO rules, both frozen at GA:
 *
 *   1. stdout carries the PAYLOAD and nothing else - rendered bytes, the JSON
 *      envelope, or the human report for a report-shaped command. Every diagnostic
 *      goes to stderr, without exception. `note()`/`warn()` are how the rest of the
 *      shell says anything, so the rule is enforceable in one place.
 *   2. A write to stdout must be FLUSHED before the process exits. `process.exit()`
 *      after a large `write()` on a pipe discards the unflushed remainder - that is
 *      how `lolly … | wc -c` reported 65536 bytes for a 638897-byte PNG. `writeOut`
 *      awaits the write callback and NOTHING in this shell calls `exit()` after it.
 *
 * `--quiet` silences non-error stderr; `--strict` turns warnings into failures. Both
 * are process-wide settings rather than threaded parameters because every warning site
 * in this shell is a leaf (a stderr line beside real work) and threading a config
 * object through them all would be churn with no reader.
 */

let quiet = false;
let strict = false;

/** Warnings recorded this run, in order. `kind` decides the --strict exit code. */
export interface RecordedWarning {
  code: string;
  message: string;
  /** 'usage' → exit 2 under --strict; 'gate' → exit 4 (a protective check softened). */
  kind: 'usage' | 'gate';
}

const warnings: RecordedWarning[] = [];

export function configureOutput(opts: { quiet?: boolean; strict?: boolean } = {}): void {
  if (opts.quiet !== undefined) quiet = opts.quiet;
  if (opts.strict !== undefined) strict = opts.strict;
}

/** Test seam: forget the flags and the recorded warnings. */
export function resetOutput(): void {
  quiet = false;
  strict = false;
  warnings.length = 0;
}

export const isQuiet = (): boolean => quiet;
export const isStrict = (): boolean => strict;
export const recordedWarnings = (): readonly RecordedWarning[] => warnings;

/** A progress/diagnostic line. Suppressed by --quiet. Never a warning. */
export function note(message: string): void {
  if (!quiet) process.stderr.write(message.endsWith('\n') ? message : message + '\n');
}

/**
 * A warning: something the caller probably did not intend, which did not stop the run.
 *
 * Printed to stderr (unless --quiet) AND recorded, so `--strict` can turn the whole run
 * into a failure afterwards - the message is still shown first, because a strict run
 * that only prints an exit code teaches nobody anything.
 */
export function warn(code: string, message: string, kind: 'usage' | 'gate' = 'usage'): void {
  warnings.push({ code, message, kind });
  if (!quiet) process.stderr.write(`Warning: ${message}\n`);
}

/**
 * The exit code --strict owes for the warnings recorded this run, or null when there
 * is nothing to promote. A gate-class warning (a protective check that softened its
 * answer) outranks a usage-class one.
 */
export function strictExitCode(): number | null {
  if (!strict || !warnings.length) return null;
  return warnings.some(w => w.kind === 'gate') ? 4 : 2;
}

/**
 * Write payload bytes to stdout and WAIT for them to reach the pipe.
 *
 * This is rule 2 above. Node's `write` is asynchronous on a pipe; the callback fires
 * once the chunk is handed to the OS. Awaiting it (and never calling `process.exit()`
 * afterwards) is what makes `lolly screencap --export=png | wc -c` report the whole file.
 */
export function writeOut(data: string | Uint8Array): Promise<void> {
  return new Promise((resolve, reject) => {
    process.stdout.write(data as string, (err) => {
      // EPIPE is the reader closing early (`lolly … | head -1`), not a failed run: the
      // payload was produced, nobody is listening any more. Resolving keeps the exit
      // code the work earned instead of promoting an ordinary `| head` to FAILED.
      if (err && (err as NodeJS.ErrnoException).code !== 'EPIPE') reject(err);
      else resolve();
    });
  });
}

/**
 * Send `console.log`/`info`/`debug`/`warn` to stderr for the rest of the process.
 *
 * `host.log` already writes to stderr at every level, but a tool's `hooks.js` runs in
 * the Node realm (the runtime injects the host bridge into a closure; it is not a
 * sandbox), so a hook that calls `console.log` directly writes to the real stdout - 
 * which, on `lolly … --export=png > out.png`, lands INSIDE the PNG. No shipped tool
 * does it today; tools ship as data from another repository, so "no shipped tool does
 * it" is not a property this shell can rely on.
 *
 * `console.error` is left alone: it is already stderr.
 */
export function keepConsoleOffStdout(): void {
  const toErr = (...args: unknown[]): void => {
    process.stderr.write(args.map(a => (typeof a === 'string' ? a : inspectish(a))).join(' ') + '\n');
  };
  console.log = toErr;
  console.info = toErr;
  console.debug = toErr;
  console.warn = toErr;
}

function inspectish(v: unknown): string {
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}

/** True when ANSI should be used: a TTY, and NO_COLOR unset (contract section 1.5). */
export function useColor(stream: { isTTY?: boolean } = process.stdout): boolean {
  return Boolean(stream.isTTY) && !process.env.NO_COLOR;
}
