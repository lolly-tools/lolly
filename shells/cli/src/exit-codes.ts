// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's exit-code taxonomy - frozen at GA (plans/73-cli-ga-contract.md section 5.1).
 *
 * Eight codes, not a boolean. The distinctions that earn their place:
 *   • 2 vs 1 - "you used it wrong" is not "it ran and failed"; a CI loop must be
 *                  able to tell a typo'd path from a broken file.
 *   • 3 vs 1 - "impossible in THIS installation" is the retry-on-another-runner
 *                  code. No Chromium here may well mean Chromium over there.
 *   • 4 vs 1 - a protective check said no. Nothing is wrong with the machine;
 *                  something is wrong with the artefact or the request.
 *   • 5 vs 1 - `validate` finding no credential is a legitimate negative answer,
 *                  not a failure.
 *   • 70 vs 1 - an unclassified exception is a bug in Lolly (sysexits.h
 *                  EX_SOFTWARE). Distinct so an agent stops retrying it.
 *
 * These meanings cannot change without a major version. Adding a NEW code is
 * additive; re-pointing an existing one is not.
 */

export const EXIT = {
  /** The requested thing was produced. */
  OK: 0,
  /** It was possible, it ran, it failed. */
  FAILED: 1,
  /** You used it wrong: unknown tool/flag/format, missing argument, unreadable path. */
  USAGE: 2,
  /** Impossible in this installation; may succeed elsewhere. */
  UNAVAILABLE_HERE: 3,
  /** A protective check ran and said no. */
  REFUSED: 4,
  /** A legitimate negative answer (validate: no credential present). */
  NOT_FOUND: 5,
  /** Missing or wrong password. */
  AUTH: 6,
  /** Unclassified exception: a bug in Lolly. */
  INTERNAL: 70,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

/** Reverse map, for `--help` and the JSON envelope's `error.code`. */
export const EXIT_NAME: Record<number, string> = Object.fromEntries(
  Object.entries(EXIT).map(([k, v]) => [v, k]),
);

/**
 * An error that already knows its exit code.
 *
 * `kind` is the STABLE machine handle (contract section 10: `error.code`/`error.kind` are
 * promised, `error.message` is not), so a pipeline branches on `CAPABILITY_UNAVAILABLE`
 * rather than on a sentence we reserve the right to reword.
 */
export class CliError extends Error {
  readonly exit: number;
  readonly kind: string;
  readonly detail?: string;
  constructor(message: string, exit: number, kind: string, detail?: string) {
    super(message);
    this.name = 'CliError';
    this.exit = exit;
    this.kind = kind;
    if (detail !== undefined) this.detail = detail;
  }
}

/** "You used it wrong." */
export const usageError = (message: string, kind = 'USAGE'): CliError =>
  new CliError(message, EXIT.USAGE, kind);

/** "Not possible in this installation." */
export const unavailableHere = (message: string, kind = 'UNAVAILABLE_HERE'): CliError =>
  new CliError(message, EXIT.UNAVAILABLE_HERE, kind);

/** "A protective check said no." */
export const refused = (message: string, kind = 'REFUSED'): CliError =>
  new CliError(message, EXIT.REFUSED, kind);

/** "Missing or wrong password." */
export const authError = (message: string, kind = 'AUTH'): CliError =>
  new CliError(message, EXIT.AUTH, kind);

/**
 * Programmer-error exception types. A TypeError reaching the top level is a bug in
 * Lolly, not a user-visible failure mode, so it earns 70 (EX_SOFTWARE) rather than the
 * generic 1 an agent would happily retry forever.
 */
const BUG_TYPES = new Set(['TypeError', 'RangeError', 'ReferenceError', 'SyntaxError']);

/**
 * Classify any thrown value into an exit code.
 *
 * Order matters: an explicit `exit` wins, then the typed sentinels the render path
 * already sets (`FORMAT_UNAVAILABLE`, `NEEDS_BROWSER`, `RenderIntegrityError`,
 * `FormatMismatchError`, `DeepSourceError`, `BrowserError`), then the programmer-error
 * types, and only then the generic 1. Nothing here reads prose - every branch keys on
 * a name or a code, the lesson needsBrowserTier already learned.
 */
export function exitCodeFor(err: unknown): number {
  if (err === null || typeof err !== 'object') return EXIT.INTERNAL;
  const e = err as { exit?: unknown; code?: unknown; name?: unknown; needsBrowser?: unknown; modelMissing?: unknown };
  if (typeof e.exit === 'number') return e.exit;
  const code = typeof e.code === 'string' ? e.code : '';
  const name = typeof e.name === 'string' ? e.name : '';
  // `modelMissing` carries the family name of an on-device model this machine has
  // not staged (packages/node-shell/src/speech.ts). Same class as a missing
  // browser: the request was fine, this installation cannot serve it yet, and the
  // refusal already names the `lolly models fetch <family>` command that fixes it.
  if (code === 'FORMAT_UNAVAILABLE' || code === 'NEEDS_BROWSER' || code === 'CAPABILITY_UNAVAILABLE'
      || e.needsBrowser === true || typeof e.modelMissing === 'string' || name === 'BrowserError') {
    return EXIT.UNAVAILABLE_HERE;
  }
  if (name === 'RenderIntegrityError') return EXIT.FAILED;
  if (name === 'FormatMismatchError' || name === 'DeepSourceError') return EXIT.REFUSED;
  if (code === 'ENOENT' || code === 'EACCES' || code === 'EISDIR') return EXIT.USAGE;
  if (BUG_TYPES.has(name)) return EXIT.INTERNAL;
  return EXIT.FAILED;
}

/** The stable machine handle for a thrown value (`error.kind` in the JSON envelope). */
export function errorKind(err: unknown): string {
  if (err === null || typeof err !== 'object') return 'INTERNAL';
  const e = err as { kind?: unknown; code?: unknown; name?: unknown };
  if (typeof e.kind === 'string') return e.kind;
  if (typeof e.code === 'string') return e.code;
  if (typeof e.name === 'string' && e.name !== 'Error') return e.name;
  return EXIT_NAME[exitCodeFor(err)] ?? 'FAILED';
}
