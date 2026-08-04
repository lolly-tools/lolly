// SPDX-License-Identifier: MPL-2.0
/**
 * Where the terminal shells keep on-device state (plans/73-cli-ga-contract.md §1.5, B14).
 *
 * ONE variable for both shells: `LOLLY_STATE_DIR`. It was `LOLLY_TUI_DIR`, which said
 * the wrong thing the moment the CLI grew persistent `host.state` — the directory is a
 * property of the machine, not of the shell that happens to be reading it.
 *
 * The old name still works and prints a one-line deprecation note naming the
 * replacement (contract §10: a deprecation warns for at least two minors before the
 * name is removed). The note is printed ONCE per process, on stderr, and never when the
 * new name is set.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

let deprecationNoted = false;

/** Test seam: allow the deprecation note to fire again. */
export function resetStateDirWarning(): void {
  deprecationNoted = false;
}

export interface StateDirResult {
  /** The resolved directory. */
  dir: string;
  /** Was it named explicitly by the environment, or is this the default location? */
  explicit: boolean;
  /** True when it came from the deprecated `LOLLY_TUI_DIR`. */
  deprecated: boolean;
}

/**
 * Resolve the state directory: `LOLLY_STATE_DIR` › `LOLLY_TUI_DIR` (deprecated) ›
 * `~/.lolly`. Flag beats environment beats default is the contract's uniform
 * precedence rule; neither shell offers a flag for this one, so it starts at env.
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  onNote: (msg: string) => void = (m) => process.stderr.write(m),
): StateDirResult {
  const fresh = env.LOLLY_STATE_DIR?.trim();
  if (fresh) return { dir: fresh, explicit: true, deprecated: false };
  const old = env.LOLLY_TUI_DIR?.trim();
  if (old) {
    if (!deprecationNoted) {
      deprecationNoted = true;
      onNote('Note: LOLLY_TUI_DIR is deprecated — use LOLLY_STATE_DIR (both shells read it). LOLLY_TUI_DIR keeps working until the next major.\n');
    }
    return { dir: old, explicit: true, deprecated: true };
  }
  return { dir: join(homedir(), '.lolly'), explicit: false, deprecated: false };
}

/** Just the path, for callers that do not care how it was chosen. */
export const stateDir = (env?: NodeJS.ProcessEnv): string => resolveStateDir(env).dir;
