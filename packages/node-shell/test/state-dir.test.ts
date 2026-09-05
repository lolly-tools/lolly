// SPDX-License-Identifier: MPL-2.0
/**
 * The state-directory rungs (plans/202 WP3.1).
 *
 * Order is the whole contract: `LOLLY_STATE_DIR` › `LOLLY_TUI_DIR` (deprecated) › the
 * desktop app's data directory when the app is installed here › `~/.lolly`. Every rung is
 * driven through injected environment, platform, home and an injected exists probe, so no
 * case depends on what this machine happens to have installed.
 *
 * The identifier the app-data path is built from is checked against the desktop shell's
 * own tauri.conf.json: change it there and this fails, rather than the terminal shells
 * quietly writing beside the app instead of into it.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import {
  DESKTOP_APP_IDENTIFIER, desktopAppDataDir, resetStateDirWarning, resolveStateDir,
} from '../src/state-dir.ts';

const REPO_ROOT = new URL('../../../', import.meta.url).pathname;
const HOME = '/home/tester';
const never = (): boolean => false;
const always = (): boolean => true;
const quiet = (): void => { /* the deprecation note is asserted in its own case */ };

test('the identifier matches the desktop shell tauri.conf.json', async () => {
  const conf = JSON.parse(
    await readFile(join(REPO_ROOT, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), 'utf8'),
  ) as { identifier?: string };
  assert.equal(
    DESKTOP_APP_IDENTIFIER, conf.identifier,
    'the app data directory is derived from this identifier - keep the two in step',
  );
});

test('the app data path follows the platform, the way Tauri derives it', () => {
  assert.equal(
    desktopAppDataDir({}, { platform: 'darwin', home: HOME }),
    `${HOME}/Library/Application Support/${DESKTOP_APP_IDENTIFIER}`,
  );
  assert.equal(
    desktopAppDataDir({ APPDATA: 'C:\\Users\\t\\AppData\\Roaming' } as NodeJS.ProcessEnv, { platform: 'win32', home: HOME }),
    join('C:\\Users\\t\\AppData\\Roaming', DESKTOP_APP_IDENTIFIER),
  );
  assert.equal(
    desktopAppDataDir({}, { platform: 'win32', home: HOME }), null,
    'Windows with no %APPDATA% has no app data directory to offer',
  );
  assert.equal(
    desktopAppDataDir({}, { platform: 'linux', home: HOME }),
    `${HOME}/.local/share/${DESKTOP_APP_IDENTIFIER}`,
  );
  assert.equal(
    desktopAppDataDir({ XDG_DATA_HOME: '/xdg' } as NodeJS.ProcessEnv, { platform: 'linux', home: HOME }),
    `/xdg/${DESKTOP_APP_IDENTIFIER}`,
  );
});

test('the rungs answer in order: env, deprecated env, the desktop app, then ~/.lolly', () => {
  resetStateDirWarning();
  const probe = { platform: 'darwin' as NodeJS.Platform, home: HOME, exists: always };

  // 1. The current variable wins outright, and never consults the app.
  const fresh = resolveStateDir({ LOLLY_STATE_DIR: '/a', LOLLY_TUI_DIR: '/b' } as NodeJS.ProcessEnv, quiet, probe);
  assert.deepEqual(fresh, { dir: '/a', explicit: true, deprecated: false, source: 'env', shared: false });

  // 2. The deprecated variable still answers, ahead of the app.
  const old = resolveStateDir({ LOLLY_TUI_DIR: '/b' } as NodeJS.ProcessEnv, quiet, probe);
  assert.equal(old.dir, '/b');
  assert.equal(old.source, 'env-deprecated');
  assert.equal(old.deprecated, true);

  // 3. No variable + the app is installed here → the app's own directory.
  const app = resolveStateDir({}, quiet, probe);
  assert.deepEqual(app, {
    dir: `${HOME}/Library/Application Support/${DESKTOP_APP_IDENTIFIER}`,
    explicit: false,
    deprecated: false,
    source: 'app',
    shared: true,
  });

  // 4. No variable + no app → ~/.lolly, as before.
  const fallback = resolveStateDir({}, quiet, { ...probe, exists: never });
  assert.deepEqual(fallback, {
    dir: `${HOME}/.lolly`, explicit: false, deprecated: false, source: 'default', shared: false,
  });
  resetStateDirWarning();
});

test('the app rung never reads as explicit, so the CLI keeps writing only where it is told', () => {
  const app = resolveStateDir({}, quiet, { platform: 'darwin', home: HOME, exists: always });
  assert.equal(app.source, 'app');
  assert.equal(app.explicit, false, 'a headless render must not write into the app store unasked');
  assert.equal(app.shared, true, 'but reads point at it, which is how a saved session is found');
});

test('the deprecation note fires once, and only for the old variable', () => {
  resetStateDirWarning();
  const notes: string[] = [];
  const push = (m: string): number => notes.push(m);
  const probe = { platform: 'linux' as NodeJS.Platform, home: HOME, exists: never };

  resolveStateDir({ LOLLY_STATE_DIR: '/a' } as NodeJS.ProcessEnv, push, probe);
  resolveStateDir({}, push, probe);
  assert.deepEqual(notes, [], 'neither the current name nor the default says anything');

  resolveStateDir({ LOLLY_TUI_DIR: '/b' } as NodeJS.ProcessEnv, push, probe);
  resolveStateDir({ LOLLY_TUI_DIR: '/b' } as NodeJS.ProcessEnv, push, probe);
  assert.equal(notes.length, 1, 'once per process, not once per read');
  assert.match(notes.join(''), /LOLLY_TUI_DIR is deprecated - use LOLLY_STATE_DIR/);
  resetStateDirWarning();
});
