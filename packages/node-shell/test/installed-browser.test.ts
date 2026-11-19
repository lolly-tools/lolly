// SPDX-License-Identifier: MPL-2.0
/**
 * Browser discovery and the launch arguments for `lolly app`.
 *
 * Every case runs through an injected probe, so the Linux order, the Flatpak rung and
 * the macOS paths are all checked on whatever machine runs the suite.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  APP_WINDOW_CLASS, FLATPAK_BROWSERS, LINUX_BROWSER_COMMANDS, MAC_BROWSER_PATHS, appDataDir, appLaunchArgs,
  defaultBrowserOpener, findBrowser, type BrowserProbe,
} from '../src/installed-browser.ts';
import { DESKTOP_APP_IDENTIFIER } from '../src/state-dir.ts';

interface Machine { platform?: NodeJS.Platform; env?: NodeJS.ProcessEnv; onPath?: string[]; files?: string[]; flatpaks?: string[] }

function probe(machine: Machine): BrowserProbe & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    platform: machine.platform ?? 'linux',
    env: machine.env ?? {},
    which: (command) => { asked.push(command); return machine.onPath?.includes(command) ? `/usr/bin/${command}` : null; },
    exists: path => machine.files?.includes(path) ?? false,
    flatpakHas: (id) => { asked.push(`flatpak:${id}`); return machine.flatpaks?.includes(id) ?? false; },
  };
}

test('Linux tries the PATH commands in the stated order', () => {
  assert.deepEqual(LINUX_BROWSER_COMMANDS.map(([command]) => command), [
    'google-chrome-stable', 'google-chrome', 'chromium', 'chromium-browser',
    'microsoft-edge-stable', 'microsoft-edge', 'brave-browser', 'vivaldi-stable',
  ]);
  const commands = LINUX_BROWSER_COMMANDS.map(([command]) => command);
  // With every later command present too, each one wins only once the earlier ones are gone.
  for (let i = 0; i < commands.length; i++) {
    const found = findBrowser(probe({ onPath: commands.slice(i) })).browser;
    assert.equal(found?.command, `/usr/bin/${commands[i]}`);
    assert.equal(found?.source, 'path');
    assert.deepEqual(found?.prefixArgs, []);
  }
});

test('Flatpak browsers come after PATH, in the stated order, through flatpak run', () => {
  assert.deepEqual(FLATPAK_BROWSERS.map(([id]) => id), ['com.google.Chrome', 'org.chromium.Chromium', 'com.microsoft.Edge', 'com.brave.Browser']);
  const both = findBrowser(probe({ onPath: ['flatpak', 'brave-browser'], flatpaks: ['com.google.Chrome'] })).browser;
  assert.equal(both?.command, '/usr/bin/brave-browser', 'a PATH browser wins over a Flatpak one');

  const flat = findBrowser(probe({ onPath: ['flatpak'], flatpaks: ['com.brave.Browser', 'org.chromium.Chromium'] })).browser;
  assert.equal(flat?.command, '/usr/bin/flatpak');
  assert.deepEqual(flat?.prefixArgs, ['run', 'org.chromium.Chromium']);
  assert.equal(flat?.source, 'flatpak');

  const without = probe({ flatpaks: ['com.google.Chrome'] });
  assert.equal(findBrowser(without).browser, null, 'no flatpak command means no Flatpak rung');
  assert.equal(without.asked.some(entry => entry.startsWith('flatpak:')), false);
});

test('LOLLY_BROWSER is tried first, as a path or as a command', () => {
  const asPath = findBrowser(probe({ env: { LOLLY_BROWSER: '/opt/thorium/thorium' }, files: ['/opt/thorium/thorium'], onPath: ['google-chrome'] }));
  assert.equal(asPath.browser?.command, '/opt/thorium/thorium');
  assert.equal(asPath.browser?.source, 'env');
  assert.equal(asPath.overrideMissed, null);

  const asCommand = findBrowser(probe({ env: { LOLLY_BROWSER: 'ungoogled-chromium' }, onPath: ['ungoogled-chromium', 'google-chrome'] }));
  assert.equal(asCommand.browser?.command, '/usr/bin/ungoogled-chromium');

  const missed = findBrowser(probe({ env: { LOLLY_BROWSER: '/nope/browser' }, onPath: ['chromium'] }));
  assert.equal(missed.browser?.command, '/usr/bin/chromium', 'a LOLLY_BROWSER that is not there falls through to the list');
  assert.equal(missed.overrideMissed, '/nope/browser');
});

test('macOS looks in /Applications, in order', () => {
  const paths = MAC_BROWSER_PATHS.map(([path]) => path);
  assert.deepEqual(paths, [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
  ]);
  for (let i = 0; i < paths.length; i++) {
    const found = findBrowser(probe({ platform: 'darwin', files: paths.slice(i) })).browser;
    assert.equal(found?.command, paths[i]);
  }
  const mac = probe({ platform: 'darwin', onPath: ['google-chrome', 'flatpak'], flatpaks: ['com.google.Chrome'] });
  assert.equal(findBrowser(mac).browser, null, 'the Linux rungs are not read on macOS');
});

test('nothing found is null, on every platform', () => {
  for (const platform of ['linux', 'darwin', 'win32'] as const) {
    assert.deepEqual(findBrowser(probe({ platform })), { browser: null, overrideMissed: null });
  }
});

test('the launch arguments are exactly the five agreed, with nothing forced on', () => {
  const args = appLaunchArgs('http://127.0.0.1:47474/', '/home/t/.local/share/lolly');
  assert.deepEqual(args, [
    '--app=http://127.0.0.1:47474/',
    '--class=tools.lolly.Desktop',
    '--user-data-dir=/home/t/.local/share/lolly/browser',
    '--no-first-run',
    '--no-default-browser-check',
  ]);
  assert.equal(args.some(arg => /unsafe|enable-features|ignore-gpu|disable-web-security|no-sandbox/i.test(arg)), false);
  assert.equal(APP_WINDOW_CLASS, DESKTOP_APP_IDENTIFIER, 'the window class is the desktop app identifier');
});

test('the data directory follows the platform', () => {
  assert.equal(appDataDir({}, 'linux', '/home/t'), '/home/t/.local/share/lolly');
  assert.equal(appDataDir({ XDG_DATA_HOME: '/data/xdg' }, 'linux', '/home/t'), '/data/xdg/lolly');
  assert.equal(appDataDir({ XDG_DATA_HOME: 'relative/path' }, 'linux', '/home/t'), '/home/t/.local/share/lolly', 'a relative XDG_DATA_HOME is ignored, as the XDG rules say');
  assert.equal(appDataDir({ XDG_DATA_HOME: '/data/xdg' }, 'darwin', '/Users/t'), '/Users/t/Library/Application Support/lolly-browser-app');
});

test('the default browser opener is xdg-open on Linux and open on macOS', () => {
  assert.equal(defaultBrowserOpener('linux'), 'xdg-open');
  assert.equal(defaultBrowserOpener('darwin'), 'open');
  assert.equal(defaultBrowserOpener('win32'), null);
});
