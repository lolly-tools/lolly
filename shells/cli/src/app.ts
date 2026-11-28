// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly app` - Lolly as an app window in the browser this person already has.
 *
 * The web app needs WebGPU, and the Linux web view (WebKitGTK) has none, so on Linux
 * the app runs in Chrome, Chromium, Edge or Brave instead: this command serves a built
 * web app on one fixed local address and opens that address as an app window. The
 * server and the browser pieces live in @lolly-tools/node-shell; this file is the
 * order of events and the messages.
 *
 * Nothing is written to stdout. The command runs until the browser closes, or until
 * SIGINT or SIGTERM when the browser handed the window to a process that was already
 * running.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  APP_DEFAULT_PORT, AppServerError, builtVersion, probePort, startAppServer, type AppServer,
} from '@lolly-tools/node-shell/web-app-server';
import {
  SUPPORTED_BROWSERS, appLaunchArgs, defaultBrowserOpener, findBrowser, systemAppDataDir, systemBrowserProbe,
  type FoundBrowser,
} from '@lolly-tools/node-shell/installed-browser';
import { repoRoot } from '@lolly-tools/node-shell/repo-root';
import { EXIT, unavailableHere, usageError } from './exit-codes.ts';
import { note } from './output.ts';

export const APP_HELP = `lolly app - open Lolly as an app window in your installed browser.

Usage:
  lolly app [--dir=<built web app>] [--port=${APP_DEFAULT_PORT}]

Serves a built Lolly web app on http://127.0.0.1:<port>, on this machine only, and opens
that address as an app window in Google Chrome, Chromium, Microsoft Edge, Brave or
Vivaldi. The command ends when that browser closes.

  --dir=<path>   the built web app to serve (a directory that holds index.html).
                 Default: web/ beside the lolly executable, then shells/web/dist in a
                 checkout
  --port=<n>     the local port. Your projects are stored by the browser for one
                 address, so a different port starts with none of them

Environment:
  LOLLY_BROWSER  a browser to use, as a path or a command name. Tried first

When the port is taken by a Lolly that is already running, a new window opens on that
one and this command ends. When another program holds the port, the command stops and
says so: choose a free port with --port.

When no supported browser is found, the address opens in your default browser as an
ordinary tab, and the command keeps serving until you stop it (Ctrl+C).

Exit codes:
  0  the browser closed, the command was stopped, or a running Lolly took the window
  1  the browser could not be started
  2  wrong invocation: a bad --port, or a --dir with no index.html
  3  not possible here: no built web app found, or the port is held by another program
`;

/** A browser that exits this soon handed its window to a process that was already running. */
const HANDED_OFF_MS = 2500;

/** `--name=value`, or the `--name value` spelling, where the value arrives as a positional. */
function flagValue(flags: Record<string, string>, positionals: string[], name: string): string | undefined {
  const value = flags[name];
  if (value === undefined) return undefined;
  if (value !== '1' || !positionals.length) return value;
  return positionals.shift();
}

function parsePort(text: string | undefined): number {
  if (text === undefined) return APP_DEFAULT_PORT;
  const port = Number(text);
  if (!/^\d+$/.test(text) || port < 1024 || port > 65535) {
    throw usageError(`--port needs a number from 1024 to 65535, not "${text}".`, 'BAD_PORT');
  }
  return port;
}

/**
 * The directory to serve. A packaged install keeps the built web app in `web/` beside
 * the executable; a checkout has the web shell's own build output.
 */
export function resolveAppDir(explicit: string | undefined, execPath: string = process.execPath): string {
  if (explicit !== undefined) {
    const dir = resolve(explicit);
    if (!existsSync(join(dir, 'index.html'))) throw usageError(`No built web app at ${dir}: that directory has no index.html.`, 'NO_WEB_APP');
    return dir;
  }
  const candidates = [join(dirname(execPath), 'web')];
  try { candidates.push(join(repoRoot(), 'shells', 'web', 'dist')); } catch { /* not a checkout */ }
  const found = candidates.find(dir => existsSync(join(dir, 'index.html')));
  if (found) return found;
  throw unavailableHere(
    `No built web app found. Looked in:\n${candidates.map(dir => `  ${dir}`).join('\n')}\n` +
    'Give a directory with --dir=<path>. In a checkout, `pnpm run build:web` makes shells/web/dist.',
    'NO_WEB_APP',
  );
}

function start(command: string, args: string[], detached: boolean): ChildProcess {
  const child = spawn(command, args, { stdio: 'ignore', detached });
  if (detached) child.unref();
  return child;
}

/** Open the app window, or the default browser when no supported browser is here. */
function openWindow(url: string, detached: boolean): { child: ChildProcess; browser: FoundBrowser | null } {
  const { browser, overrideMissed } = findBrowser(systemBrowserProbe());
  if (overrideMissed) note(`LOLLY_BROWSER is set to "${overrideMissed}", which was not found. Looking for an installed browser instead.`);
  if (browser) {
    note(`Opening Lolly in ${browser.label}.`);
    return { child: start(browser.command, [...browser.prefixArgs, ...appLaunchArgs(url, systemAppDataDir())], detached), browser };
  }
  const opener = defaultBrowserOpener(process.platform);
  if (!opener) throw unavailableHere(`No supported browser found, and this system has no way to open ${url}. Open that address yourself.`, 'NO_BROWSER');
  note(
    `No supported browser found. Lolly runs as an app window in ${SUPPORTED_BROWSERS}.\n` +
    'Set LOLLY_BROWSER to the path or command of one to use that browser.\n' +
    `Opening ${url} in your default browser as an ordinary tab.`,
  );
  return { child: start(opener, [url], detached), browser: null };
}

/** Wait for the first of: the child failing to start, or the child exiting. */
const childEnd = (child: ChildProcess): Promise<{ code: number | null; error?: Error }> =>
  new Promise((done) => {
    child.once('error', error => done({ code: null, error }));
    child.once('exit', code => done({ code }));
  });

/** Serve until the browser closes or a signal arrives. Resolves with the exit code. */
async function serveUntilDone(server: AppServer): Promise<number> {
  const url = `${server.origin}/`;
  note(`Serving Lolly at ${url}`);
  const stopped = new Promise<'signal'>((done) => {
    process.once('SIGINT', () => done('signal'));
    process.once('SIGTERM', () => done('signal'));
  });
  try {
    const opened = Date.now();
    const { child, browser } = openWindow(url, false);
    const first = await Promise.race([childEnd(child), stopped]);
    if (first === 'signal') {
      // A browser that is still open must not hold this process after the server has closed.
      child.unref();
      return EXIT.OK;
    }
    if (first.error) {
      process.stderr.write(`The browser could not be started: ${first.error.message}\n`);
      return EXIT.FAILED;
    }
    const early = Date.now() - opened < HANDED_OFF_MS;
    if (browser && !early) return EXIT.OK;
    if (browser && first.code !== 0) {
      process.stderr.write(`${browser.label} stopped as soon as it started (exit ${first.code}).\n`);
      return EXIT.FAILED;
    }
    if (!browser && first.code !== 0) note(`The default browser did not open. Open ${url} yourself.`);
    // The default browser's opener always returns at once, and so does a browser that
    // passed the window to a process of its own that was already running.
    note('Lolly keeps serving while the window is open. Stop with Ctrl+C when you have closed the window.');
    await stopped;
    return EXIT.OK;
  } finally {
    await server.close();
  }
}

/** `lolly app`. Resolves with the exit code once serving has ended. */
export async function appCli(positionals: string[], flags: Record<string, string>): Promise<number> {
  const rest = [...positionals];
  const dirFlag = flagValue(flags, rest, 'dir');
  const port = parsePort(flagValue(flags, rest, 'port'));
  if (rest.length) throw usageError(`lolly app takes no arguments, but got "${rest[0]}". See lolly app --help.`, 'UNEXPECTED_ARGUMENT');
  const dir = resolveAppDir(dirFlag);

  let server: AppServer;
  try {
    server = await startAppServer({ dir, port });
  } catch (err) {
    if (!(err instanceof AppServerError) || err.code !== 'EADDRINUSE') throw err;
    const holder = await probePort(port);
    if (holder.kind === 'foreign') {
      throw unavailableHere(
        `Port ${port} on this machine is in use by another program, so Lolly cannot serve there.\n` +
        'Choose a free port with --port=<n>. Projects are stored by the browser for one address, ' +
        'so a different port starts with none of them.',
        'PORT_IN_USE',
      );
    }
    note(`Lolly is already running at http://127.0.0.1:${port}/. Opening a new window there.`);
    if (holder.version !== builtVersion(dir)) note('That Lolly is serving a different build. Close its windows and start again to use this one.');
    const { child } = openWindow(`http://127.0.0.1:${port}/`, true);
    // A missing program surfaces as an 'error' event; without a listener that would throw.
    child.once('error', (error) => { process.stderr.write(`The browser could not be started: ${error.message}\n`); process.exitCode = EXIT.FAILED; });
    return EXIT.OK;
  }
  return serveUntilDone(server);
}
