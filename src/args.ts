// SPDX-License-Identifier: MPL-2.0
/**
 * argv → flags + positionals, and the frozen vocabulary around them
 * (plans/73-cli-ga-contract.md section 1.1–section 1.3).
 *
 * The parser is deliberately tiny and deliberately FROZEN: `--k=v`; a bare `--k` is
 * "1"; `--k=0|false|off|no` is false; values may span newlines (a multiline longtext
 * input is one argv element and must survive intact, matching URL mode's %0A); no short
 * flags other than -h/-v; `--` ends option parsing; a repeated flag keeps the last
 * occurrence EXCEPT for the documented repeatable set, which accumulates.
 *
 * Two things that are new at GA and cannot be added later without breaking someone:
 *   • `--` - without it a longtext value beginning with `--` can never be passed.
 *   • the bare-value-flag refusal - `--output` (no `=`) parsed to "1" and wrote a file
 *     literally named `1`. Every value-taking flag now says so instead.
 */

import { usageError } from './exit-codes.ts';

export interface ParsedArgs {
  /** Last-wins flags, minus the repeatable ones. */
  flags: Record<string, string>;
  /** Repeatable flags, in order (currently only --trust-anchor). */
  repeated: Record<string, string[]>;
  /** Non-flag arguments, in order, including everything after `--`. */
  positionals: string[];
}

/** Flags that ACCUMULATE rather than last-wins. Frozen: adding one is additive. */
export const REPEATABLE = new Set(['trust-anchor']);

/**
 * Flags that must carry a value. A bare form is a usage error rather than "1".
 *
 * The list is the value-taking reserved/CLI flags a user can plausibly type. Tool
 * inputs are NOT here: a bare `--dark` meaning true is the documented boolean form.
 */
export const VALUE_FLAGS = new Set([
  'output', 'export', 'format', 'width', 'height', 'unit', 'dpi', 'depth',
  'bleed', 'marks', 'cuts', 'lang', 'filename', 'slot', 'z', 'zx',
  // `s` is the deck STATE ADDRESS (plan 112): `--s=2` / `--s=slide1` renders that one
  // slide. A bare `--s` parsing to "1" would silently export slide one of a deck the
  // caller never addressed - the exact class of guess this list exists to refuse.
  's',
  // `designv` takes a published version's slug or `latest`. A bare form parsing to
  // "1" would name no version, fall silently through the resolution ladder, and
  // render against a different design system under the name the author asked for.
  'designv',
  // `profile` is listed BESIDE `press-profile` because it is its frozen alias (section B1),
  // and a flag's two spellings must refuse the same things. Without it a bare
  // `--profile` parsed to "1" and handed the CMYK export a press condition literally
  // named "1", while `--press-profile` alone exited 2. Same flag, opposite answers.
  'press-profile', 'profile', 'user-profile', 'link-password', 'text', 'trust-anchor',
  // NOTE: no bare `out`. `preflight --out=` was removed before GA (section 1.4) - one shell,
  // one spelling for "where output goes" per shape: `--output` for a single file,
  // `--out-dir` for a directory of them. Leaving `out` here also made a bare `--out`
  // a usage error on EVERY command, so a tool declaring a boolean input `out` could
  // never be set with the documented bare-flag form.
  'out-dir', 'only', 'type', 'require', 'template', 'password', 'inputs',
  // The video export controls (url-mode `fps`/`seconds`/`wait`/`codec`/`vq`): a bare
  // `--fps` parsing to "1" would ask for a one-frame-per-second clip nobody meant.
  'fps', 'seconds', 'wait', 'codec', 'vq',
  // `rebuild` takes the path of the `.lolly` session to re-render. A bare form parsing
  // to "1" would report an unreadable session file literally named "1".
  'rebuild',
  // The signing identity. Both take a PATH, and a bare form must never parse to the
  // string "1" and then be reported as an unreadable file called "1". There is
  // deliberately no flag that takes the KEY or its passphrase: argv is visible in `ps`
  // to every user on the machine, kept in shell history, and echoed into CI logs.
  'sign-key', 'sign-cert', 'recipe', 'rules', 'review-file', 'choices', 'save-recipe', 'report',
]);

/** Subcommand words a tool id may never take (contract section 1.1). `completion` is reserved
 *  now so the deferred `lolly completion <shell>` can land additively later. */
export const RESERVED_SUBCOMMANDS = [
  'prepare', 'files', 'start', 'system', 'list', 'describe', 'run', 'compile', 'schema', 'inspect', 'diff', 'measure', 'optimize', 'package', 'assets', 'batch', 'smoke', 'validate', 'preflight',
  'install-browser', 'completion', 'help', 'version',
  // The on-device model surface (plans/183): `models` owns the one command that
  // downloads a model, `speak` and `transcribe` are host.speech's two directions.
  'models', 'speak', 'transcribe',
  // `mix` writes a design timeline's soundtrack with no browser (plans/183 WS3).
  'mix',
  // The on-device ML utilities (plans/183 WS2). Three are HostV1 members
  // (upscale, matte, ocr); the other three have no bridge member and exist only
  // as these commands. All six are reserved so a brand pack's tool id can never
  // shadow one.
  'upscale', 'matte', 'ocr', 'detect-ai', 'reword', 'depth',
  // Linux packaging (plans/197): `icons` builds a hicolor icon RPM, `pack`
  // builds a font (etc.) package. Reserved so a brand tool id can't shadow them.
  'icons', 'pack',
  // `tui` starts the interactive terminal shell (plans/202 WP1.4). One install, five
  // doors: nobody should have to learn that the interactive one is a second binary.
  'tui',
] as const;

/** The six on-device ML subcommands, named here rather than in src/ml-cli.ts so
 *  the entry point can dispatch on them without importing that module (and the
 *  six model runners behind it) on every invocation. */
export const ML_SUBCOMMANDS = ['upscale', 'matte', 'ocr', 'detect-ai', 'reword', 'depth'] as const;
export type MlSubcommand = (typeof ML_SUBCOMMANDS)[number];

export function isMlSubcommand(cmd: string | undefined): cmd is MlSubcommand {
  return (ML_SUBCOMMANDS as readonly string[]).includes(cmd ?? '');
}

/** Global flags valid on every command (contract section 1.2). */
export interface GlobalFlags {
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  strict: boolean;
}

/** A bare `--flag` parses to '1'; `--flag=false|0|off|no` turns it back off. */
export function isOn(v: string | undefined): boolean {
  return v !== undefined && !/^(0|false|off|no)$/i.test(v);
}

/**
 * Parse an argv slice.
 *
 * `strictValues` gates the bare-value-flag refusal; the URL-merge path passes false,
 * because there the flags have already been through this parser once.
 */
export function parseArgs(argv: readonly string[], opts: { strictValues?: boolean } = {}): ParsedArgs {
  const flags: Record<string, string> = {};
  const repeated: Record<string, string[]> = {};
  const positionals: string[] = [];
  let optionsEnded = false;

  for (const a of argv) {
    if (optionsEnded) { positionals.push(a); continue; }
    if (a === '--') { optionsEnded = true; continue; }
    // [\s\S] (not .) so a value may span newlines.
    const m = /^--([^=]+)(?:=([\s\S]*))?$/.exec(a);
    if (!m) { positionals.push(a); continue; }
    const key = m[1]!;
    const value = m[2];
    if (opts.strictValues !== false && value === undefined && VALUE_FLAGS.has(key)) {
      throw usageError(
        `--${key} needs a value: write --${key}=<value>. A bare --${key} used to parse as the string "1" ` +
        `(which is how --output alone wrote a file called "1").`,
        'MISSING_FLAG_VALUE',
      );
    }
    if (REPEATABLE.has(key)) {
      (repeated[key] ??= []).push(value ?? '1');
      continue;
    }
    // Any OTHER flag that appears 2+ times also accumulates its full list in
    // `repeated` (seeded with the first occurrence), so a `multiple` tool input
    // (--files=a --files=b) keeps every value. `flags` still holds the last, so
    // single-valued callers are unaffected.
    if (key in flags) (repeated[key] ??= [flags[key]!]).push(value ?? '1');
    flags[key] = value ?? '1';
  }
  return { flags, repeated, positionals };
}

/** Read the global flags out of a parsed set (they are also left in `flags`, so a
 *  programmatic caller sees exactly what was typed). */
export function globalFlags(flags: Record<string, string>): GlobalFlags {
  return {
    json: isOn(flags.json),
    quiet: isOn(flags.quiet),
    verbose: isOn(flags.verbose) || Boolean(process.env.DEBUG),
    strict: isOn(flags.strict),
  };
}

/**
 * `--text=outline|live` (contract section 1.3/section 6a). Anything else is a usage error rather than
 * a silent "outline", because the whole point of the flag is knowing which you got.
 */
export function textMode(v: string | undefined): 'outline' | 'live' | undefined {
  if (v === undefined) return undefined;
  const s = v.trim().toLowerCase();
  if (s === 'outline' || s === '1') return 'outline';
  if (s === 'live') return 'live';
  throw usageError(`--text must be "outline" or "live" (got "${v}").`, 'BAD_FLAG_VALUE');
}

/**
 * `--password-stdin` (Docker's convention, contract B15): read the password from stdin
 * so it never appears in `ps` output or a shell history file. `--password=` stays and is
 * frozen; the two together are a usage error, because guessing which one you meant is
 * exactly the class of guess this CLI does not make.
 */
export async function resolvePassword(
  flags: Record<string, string>,
  readStdin: () => Promise<Buffer>,
): Promise<string | undefined> {
  const fromStdin = isOn(flags['password-stdin']);
  if (!fromStdin) return flags.password;
  if (flags.password !== undefined) {
    throw usageError('--password and --password-stdin cannot both be given.', 'CONFLICTING_FLAGS');
  }
  const buf = await readStdin();
  const pw = buf.toString('utf8').replace(/\r?\n$/, '');
  if (!pw) throw usageError('--password-stdin was given but stdin was empty.', 'EMPTY_STDIN');
  return pw;
}
