#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Renovate a folder of decks in bulk: the driver plan 274 section 5 names, in the
 * pattern of scripts/build-docs-shots.ts (a bounded pool, a progress line with an
 * ETA on every completion, a report per file and a summary).
 *
 * Run as: node scripts/renovate-decks.ts <dir|deck.pptx>... --out-dir=<dir>
 *           [--jobs=<n>] [--preset=<id|preset.json>] [--accept-suggestions[=all]]
 *           [--export=pptx] [--plan=<dir>] [--recursive] [--fresh] [--force]
 *           [--dry-run] [--report=<file.json>] [--json] [--quiet]
 *
 * It is a thin layer over `lolly rebrand compile`: every deck goes through
 * `runRebrand` in shells/cli/src/rebrand.ts, the module the CLI runs, so the
 * pipeline, the worker threads, the claims, the collision rule and the run
 * records (`<out-dir>/.lolly-rebrand-run.json` and `.lolly-rebrand-stages.json`)
 * are the CLI's own, and a run started here
 * resumes with `lolly rebrand compile --resume` and the other way round. The
 * outcomes are the same three: `ready`, `needs-review` and `failed` with a stable
 * code.
 *
 * Three defaults differ from the CLI, because a bulk run is long and gets
 * interrupted:
 *
 *   - `--resume` is on: a second run does only what the first left undone (a new
 *     or changed deck, an edited plan, other options such as `--export=pptx`, a
 *     pending deck, a failure that may not repeat). `--fresh` turns it off, and
 *     then an existing output is refused unless `--force`, as in the CLI.
 *   - `--keep-going` is on: one bad deck never stops the folder.
 *   - `--jobs` defaults to half the machine's cores (at least 1, at most 8).
 *
 * Output: a progress line on stderr as each deck finishes
 * (`[3/12, 40s, about 1m 20s left] deck.pptx: ready`), then on stdout one line per
 * deck with its counts and where its report went, then the summary line. `--json`
 * prints the CLI's result object instead, and `--report=<file>` also writes that
 * object to a file. The exit code is the CLI's: 0 when every deck is ready, 5 when
 * every deck compiled and some need review, and the worst failure's code
 * otherwise.
 */

import { writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';

import { parseArgs } from '../shells/cli/src/args.ts';
import { CliError, EXIT, exitCodeFor } from '../shells/cli/src/exit-codes.ts';
import { configureOutput, isQuiet } from '../shells/cli/src/output.ts';
import {
  REBRAND_MAX_JOBS,
  progressLine,
  runRebrand,
  summaryLine,
  summarySentence,
} from '../shells/cli/src/rebrand.ts';

/** Flags this script reads itself and does not hand to the CLI module. */
const OWN_FLAGS = new Set(['fresh', 'report', 'json', 'quiet', 'help']);

const USAGE = 'usage: node scripts/renovate-decks.ts <dir|deck.pptx>... --out-dir=<dir> [--jobs=<n>] [--preset=<id|file>] [--accept-suggestions[=all]] [--export=pptx] [--plan=<dir>] [--recursive] [--fresh] [--force] [--dry-run] [--report=<file.json>] [--json] [--quiet]';

const on = (value: string | undefined): boolean => value !== undefined && !/^(0|false|off|no)$/i.test(value);

async function main(argv: string[]): Promise<number> {
  const { flags, positionals } = parseArgs(argv);
  if (on(flags.help)) {
    process.stdout.write(`${USAGE}\n`);
    return EXIT.OK;
  }
  if (positionals.length === 0 || flags['out-dir'] === undefined) {
    process.stderr.write(`${USAGE}\n`);
    return EXIT.USAGE;
  }
  const asJson = on(flags.json);
  configureOutput({ quiet: on(flags.quiet) });

  const passed: Record<string, string> = {};
  for (const [key, value] of Object.entries(flags)) if (!OWN_FLAGS.has(key)) passed[key] = value;
  passed['keep-going'] = '1';
  if (!on(flags.fresh)) passed.resume = '1';
  passed.jobs ??= String(Math.max(1, Math.min(REBRAND_MAX_JOBS, Math.floor(availableParallelism() / 2))));

  const outcome = await runRebrand('compile', positionals, passed, {
    onProgress: (progress) => {
      if (!isQuiet()) process.stderr.write(`${progressLine(progress)}\n`);
    },
  });

  if (flags.report !== undefined) writeFileSync(flags.report, `${JSON.stringify(outcome.result, null, 2)}\n`);
  if (asJson) {
    process.stdout.write(`${JSON.stringify(outcome.result, null, 2)}\n`);
    return outcome.exit;
  }

  const lines: string[] = [];
  for (const file of outcome.result.files) {
    lines.push(summaryLine(file));
    if (!file.error && !file.skipped && file.outputs?.report) lines.push(`  report: ${file.outputs.report}`);
  }
  if (outcome.result.notAttempted.length) lines.push(`Not attempted: ${outcome.result.notAttempted.join(', ')}`);
  lines.push(summarySentence(outcome.result.summary));
  if (outcome.result.run.record) lines.push(`The run record is ${outcome.result.run.record}; run this again to pick up where it stopped.`);
  process.stdout.write(`${lines.join('\n')}\n`);
  return outcome.exit;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (err: unknown) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = err instanceof CliError ? err.exit : exitCodeFor(err);
  },
);
