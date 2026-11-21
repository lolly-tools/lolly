// SPDX-License-Identifier: MPL-2.0
/**
 * Find a Chromium-family browser the person already has, and build the command that
 * opens Lolly in an app window of that browser (`lolly app`).
 *
 * This is NOT the headless render tier (browsers.ts, browser-tier.ts): that one drives
 * a scoped Chromium through Playwright. Here the person's own browser is the app
 * window, because the Linux web view (WebKitGTK) has no WebGPU and their browser does.
 *
 * Discovery and the argument list are pure functions over an injected probe, so every
 * platform and install layout is testable on any machine. No flag here forces a
 * browser feature on: a browser without WebGPU gets the app's own explanation.
 */
import { spawnSync } from 'node:child_process';
import { accessSync, constants } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';

/** The Linux window class, so the desktop pairs the window with Lolly's launcher entry. */
export const APP_WINDOW_CLASS = 'tools.lolly.Desktop';

/** The facts discovery reads. Injected so tests drive every case. */
export interface BrowserProbe {
  platform: NodeJS.Platform;
  env: NodeJS.ProcessEnv;
  /** The full path of a command on PATH, or null. */
  which: (command: string) => string | null;
  /** Is this path an executable file? */
  exists: (path: string) => boolean;
  /** Is this Flatpak application installed? False when there is no `flatpak`. */
  flatpakHas: (id: string) => boolean;
}

export interface FoundBrowser {
  /** The program to start. */
  command: string;
  /** Arguments that come before the launch arguments (`run <id>` for Flatpak). */
  prefixArgs: string[];
  /** What to call the browser in a message. */
  label: string;
  source: 'env' | 'path' | 'flatpak' | 'application';
}

/** Commands tried on PATH on Linux, in order. */
export const LINUX_BROWSER_COMMANDS: ReadonlyArray<readonly [command: string, label: string]> = [
  ['google-chrome-stable', 'Google Chrome'], ['google-chrome', 'Google Chrome'],
  ['chromium', 'Chromium'], ['chromium-browser', 'Chromium'],
  ['microsoft-edge-stable', 'Microsoft Edge'], ['microsoft-edge', 'Microsoft Edge'],
  ['brave-browser', 'Brave'], ['vivaldi-stable', 'Vivaldi'],
];

/** Flatpak applications tried on Linux, in order, after PATH. */
export const FLATPAK_BROWSERS: ReadonlyArray<readonly [id: string, label: string]> = [
  ['com.google.Chrome', 'Google Chrome'], ['org.chromium.Chromium', 'Chromium'],
  ['com.microsoft.Edge', 'Microsoft Edge'], ['com.brave.Browser', 'Brave'],
];

/** macOS application binaries. For development and testing; Lolly ships its own Mac app. */
export const MAC_BROWSER_PATHS: ReadonlyArray<readonly [path: string, label: string]> = [
  ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', 'Google Chrome'],
  ['/Applications/Chromium.app/Contents/MacOS/Chromium', 'Chromium'],
  ['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'Microsoft Edge'],
  ['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', 'Brave'],
];

/** The browsers that work, as one phrase for messages. */
export const SUPPORTED_BROWSERS = 'Google Chrome, Chromium, Microsoft Edge, Brave or Vivaldi';

/**
 * The first browser found: `LOLLY_BROWSER` (a path or a command), then the platform's
 * own list. A `LOLLY_BROWSER` that resolves to nothing falls through to the list, and
 * `overrideMissed` says so for the caller to report.
 */
export function findBrowser(probe: BrowserProbe): { browser: FoundBrowser | null; overrideMissed: string | null } {
  const override = probe.env.LOLLY_BROWSER?.trim() || null;
  if (override) {
    const resolved = override.includes('/') ? (probe.exists(override) ? override : null) : probe.which(override);
    if (resolved) return { browser: { command: resolved, prefixArgs: [], label: override, source: 'env' }, overrideMissed: null };
  }
  const found = (browser: FoundBrowser | null) => ({ browser, overrideMissed: override });
  if (probe.platform === 'linux') {
    for (const [command, label] of LINUX_BROWSER_COMMANDS) {
      const path = probe.which(command);
      if (path) return found({ command: path, prefixArgs: [], label, source: 'path' });
    }
    const flatpak = probe.which('flatpak');
    if (flatpak) {
      for (const [id, label] of FLATPAK_BROWSERS) {
        if (probe.flatpakHas(id)) return found({ command: flatpak, prefixArgs: ['run', id], label: `${label} (Flatpak)`, source: 'flatpak' });
      }
    }
  } else if (probe.platform === 'darwin') {
    for (const [path, label] of MAC_BROWSER_PATHS) {
      if (probe.exists(path)) return found({ command: path, prefixArgs: [], label, source: 'application' });
    }
  }
  return found(null);
}

/**
 * Where the launcher keeps its own files. The browser profile lives in `browser/`
 * inside, apart from the person's everyday profile.
 */
export function appDataDir(env: NodeJS.ProcessEnv, platform: NodeJS.Platform, home: string): string {
  if (platform === 'darwin') return join(home, 'Library', 'Application Support', 'lolly-browser-app');
  const xdg = env.XDG_DATA_HOME;
  return join(xdg && isAbsolute(xdg) ? xdg : join(home, '.local', 'share'), 'lolly');
}

/** The arguments that open `url` as an app window on the launcher's own profile. */
export function appLaunchArgs(url: string, dataDir: string): string[] {
  return [
    `--app=${url}`,
    `--class=${APP_WINDOW_CLASS}`,
    `--user-data-dir=${join(dataDir, 'browser')}`,
    '--no-first-run',
    '--no-default-browser-check',
  ];
}

/** The command that opens a URL in the default browser, or null on other systems. */
export function defaultBrowserOpener(platform: NodeJS.Platform): string | null {
  return platform === 'linux' ? 'xdg-open' : platform === 'darwin' ? 'open' : null;
}

function isExecutable(path: string): boolean {
  try { accessSync(path, constants.X_OK); return true; } catch { return false; }
}

/** The probe for this machine. */
export function systemBrowserProbe(env: NodeJS.ProcessEnv = process.env, platform: NodeJS.Platform = process.platform): BrowserProbe {
  const which = (command: string): string | null => {
    for (const dir of (env.PATH ?? '').split(delimiter)) {
      if (dir && isExecutable(join(dir, command))) return join(dir, command);
    }
    return null;
  };
  return {
    platform, env, which, exists: isExecutable,
    flatpakHas: (id) => {
      const flatpak = which('flatpak');
      return flatpak !== null && spawnSync(flatpak, ['info', id], { stdio: 'ignore', timeout: 5000 }).status === 0;
    },
  };
}

/** The data directory for this machine. */
export const systemAppDataDir = (): string => appDataDir(process.env, process.platform, homedir());
