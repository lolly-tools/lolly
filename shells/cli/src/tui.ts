// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly tui` - the interactive terminal shell, started from the one-shot one
 * (plans/202 WP1.4).
 *
 * One install, five doors: a person who has `lolly` should not have to learn that the
 * interactive surface is a second binary called `lolly-tui`. The verb is additive, which
 * plans/73 section 1.1 allows, and `tui` joins RESERVED_SUBCOMMANDS in args.ts so no
 * brand pack's tool id can ever shadow it.
 *
 * It runs the TUI in a CHILD process with stdio inherited, so the terminal, its size,
 * its signals and its exit code all pass straight through, and this process keeps the
 * one rule it exists to enforce (nothing here writes to stdout).
 *
 * Two entries, because the TUI ships two ways:
 *   • package - shells/tui compiled to dist/tui.js beside this bundle (scripts/pack-cli.ts).
 *   • repo    - shells/tui/bin/lolly-tui.tsx, run through tsx, since the source is .tsx
 *               and Node's type-stripping does not do JSX.
 * The compiled entry is tried first: where both exist, the built one is the shipped one.
 */

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { constants } from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unavailableHere } from './exit-codes.ts';

/** How this installation starts the TUI: the program to run and its leading arguments. */
export interface TuiLaunch {
  kind: 'package' | 'repo';
  /** The node executable's argv (after the executable itself). */
  args: string[];
}

/** Absolute path of a candidate entry, or null when it is not on this disk. */
function fileIfPresent(relative: string): string | null {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  return existsSync(path) ? path : null;
}

/**
 * Resolve the TUI entry for this installation.
 *
 * In the published package this module is bundled into `dist/`, so the compiled TUI is
 * its sibling `./tui.js`. In the repo this file is `shells/cli/src/tui.ts`, so the
 * source entry is `../../tui/bin/lolly-tui.tsx` and tsx loads it.
 */
export function resolveTuiLaunch(): TuiLaunch {
  const compiled = fileIfPresent('./tui.js');
  if (compiled) return { kind: 'package', args: [compiled] };

  const source = fileIfPresent('../../tui/bin/lolly-tui.tsx');
  if (!source) {
    throw unavailableHere(
      'The TUI is not installed beside this CLI. Install @lolly-tools/cli (it ships both), or run `pnpm run tui` from a Lolly checkout.',
      'TUI_NOT_INSTALLED',
    );
  }
  // Resolve tsx from THIS module rather than from the working directory: `node --import
  // tsx` resolves its specifier against the cwd, so `lolly tui` from anywhere else on
  // the disk would fail to find a loader that is sitting right beside us.
  let loader: string;
  try {
    loader = createRequire(import.meta.url).resolve('tsx');
  } catch {
    throw unavailableHere(
      'The TUI source needs the tsx loader (it is .tsx, which Node does not strip). Run `pnpm install` in the checkout, or install the @lolly-tools/cli package, which ships the TUI compiled.',
      'TSX_MISSING',
    );
  }
  return { kind: 'repo', args: ['--import', pathToFileURL(loader).href, source] };
}

/** POSIX shells report a signalled child as 128 + the signal number; match them. */
function exitCodeFrom(code: number | null, signal: NodeJS.Signals | null): number {
  if (code !== null) return code;
  const number = signal ? (constants.signals as Record<string, number>)[signal] : undefined;
  return number === undefined ? 1 : 128 + number;
}

/**
 * Start the TUI. Resolves with the child's exit code once it has left.
 *
 * The TTY check stays in the TUI itself (shells/tui/src/main.tsx), so both doors give
 * the same sentence for the same situation and there is one place that decides.
 */
export async function tuiCli(rest: readonly string[] = []): Promise<number> {
  const launch = resolveTuiLaunch();
  const child = spawn(process.execPath, [...launch.args, ...rest], { stdio: 'inherit' });
  return new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', (code, signal) => resolve(exitCodeFrom(code, signal)));
  });
}
