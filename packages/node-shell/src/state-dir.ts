// SPDX-License-Identifier: MPL-2.0
/**
 * Where the terminal shells keep on-device state (plans/73-cli-ga-contract.md section 1.5, B14).
 *
 * ONE variable for both shells: `LOLLY_STATE_DIR`. It was `LOLLY_TUI_DIR`, which said
 * the wrong thing the moment the CLI grew persistent `host.state`. The directory is a
 * property of the machine, not of the shell that happens to be reading it.
 *
 * The old name still works and prints a one-line deprecation note naming the
 * replacement (contract section 10: a deprecation warns for at least two minors before the
 * name is removed). The note is printed ONCE per process, on stderr, and never when the
 * new name is set.
 *
 * Between the environment and `~/.lolly` sits one more rung: the desktop app's own data
 * directory, when the app is installed on this machine (plans/202 WP3.1). The desktop app
 * keeps saved sessions there, so the terminal shells read and write the same files instead
 * of a second, invisible set. The path is derived the way Tauri derives it, from the
 * identifier in shells/tauri-desktop/src-tauri/tauri.conf.json.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

let deprecationNoted = false;

/**
 * The desktop app's bundle identifier - the literal `identifier` field of
 * shells/tauri-desktop/src-tauri/tauri.conf.json. Changing it there changes where the
 * app keeps its data, so change it here too. packages/node-shell/test/state-dir.test.ts
 * reads the config file and fails when the two disagree.
 */
export const DESKTOP_APP_IDENTIFIER = 'tools.lolly.Desktop';

/** Test seam: allow the deprecation note to fire again. */
export function resetStateDirWarning(): void {
  deprecationNoted = false;
}

/** Which rung answered. `app` is the desktop app's data directory. */
export type StateDirSource = 'env' | 'env-deprecated' | 'app' | 'default';

export interface StateDirResult {
  /** The resolved directory. */
  dir: string;
  /** Was it named explicitly by the environment, or is this the default location? */
  explicit: boolean;
  /** True when it came from the deprecated `LOLLY_TUI_DIR`. */
  deprecated: boolean;
  /** Which rung answered - `env` › `env-deprecated` › `app` › `default`. */
  source: StateDirSource;
  /** True when this directory is the desktop app's, so the shells share its files. */
  shared: boolean;
}

/** The machine facts the rungs read. Injected so tests can drive every platform. */
export interface StateDirProbe {
  /** Does this path exist? Defaults to `existsSync`. */
  exists?: (path: string) => boolean;
  /** Defaults to `process.platform`. */
  platform?: NodeJS.Platform;
  /** Defaults to `homedir()`. */
  home?: string;
}

/**
 * Where the desktop app keeps its data on this platform, derived the way Tauri derives
 * `app_data_dir`: `~/Library/Application Support/<id>` on macOS, `%APPDATA%/<id>` on
 * Windows, `$XDG_DATA_HOME/<id>` (or `~/.local/share/<id>`) everywhere else. Null only
 * when Windows names no `%APPDATA%`.
 */
export function desktopAppDataDir(
  env: NodeJS.ProcessEnv = process.env,
  probe: StateDirProbe = {},
): string | null {
  const platform = probe.platform ?? process.platform;
  const home = probe.home ?? homedir();
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', DESKTOP_APP_IDENTIFIER);
  if (platform === 'win32') {
    const appdata = env.APPDATA?.trim();
    return appdata ? join(appdata, DESKTOP_APP_IDENTIFIER) : null;
  }
  const xdg = env.XDG_DATA_HOME?.trim();
  return join(xdg || join(home, '.local', 'share'), DESKTOP_APP_IDENTIFIER);
}

/**
 * Resolve the state directory: `LOLLY_STATE_DIR` › `LOLLY_TUI_DIR` (deprecated) › the
 * desktop app's data directory when the app is installed here › `~/.lolly`. Flag beats
 * environment beats default is the contract's uniform precedence rule; neither shell
 * offers a flag for this one, so it starts at env.
 *
 * `explicit` stays env-only. The CLI reads it to decide whether to write state to disk at
 * all, and a headless render must not drop files into the desktop app's store nobody asked
 * for (contract non-goal 8.7). Callers that want the shared home for reading use `dir`.
 */
export function resolveStateDir(
  env: NodeJS.ProcessEnv = process.env,
  onNote: (msg: string) => void = (m) => process.stderr.write(m),
  probe: StateDirProbe = {},
): StateDirResult {
  const fresh = env.LOLLY_STATE_DIR?.trim();
  if (fresh) return { dir: fresh, explicit: true, deprecated: false, source: 'env', shared: false };
  const old = env.LOLLY_TUI_DIR?.trim();
  if (old) {
    if (!deprecationNoted) {
      deprecationNoted = true;
      onNote('Note: LOLLY_TUI_DIR is deprecated - use LOLLY_STATE_DIR (both shells read it). LOLLY_TUI_DIR keeps working until the next major.\n');
    }
    return { dir: old, explicit: true, deprecated: true, source: 'env-deprecated', shared: false };
  }
  const exists = probe.exists ?? existsSync;
  const app = desktopAppDataDir(env, probe);
  if (app && exists(app)) return { dir: app, explicit: false, deprecated: false, source: 'app', shared: true };
  const home = probe.home ?? homedir();
  return { dir: join(home, '.lolly'), explicit: false, deprecated: false, source: 'default', shared: false };
}

/** Just the path, for callers that do not care how it was chosen. */
export const stateDir = (env?: NodeJS.ProcessEnv): string => resolveStateDir(env).dir;
