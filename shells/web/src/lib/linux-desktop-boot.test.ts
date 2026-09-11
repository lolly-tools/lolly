// SPDX-License-Identifier: MPL-2.0
/**
 * linux-desktop-boot - the poll-loop router between the Tauri desktop queue and
 * the web app (plans/174). Headless: every seam is injected via LinuxDesktopEnv,
 * exactly the nearby-boot testing shape this module mirrors.
 *
 * Run with: node --test shells/web/src/lib/linux-desktop-boot.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { deepLinkToHash, routeEvents, type LinuxDesktopEnv } from './linux-desktop-boot.ts';

function env(overrides: Partial<LinuxDesktopEnv> = {}): {
  env: LinuxDesktopEnv;
  navigated: string[];
  opened: File[][];
  utilities: Array<{ target: string; file: File }>;
  invoked: Array<{ cmd: string; args?: Record<string, unknown> }>;
} {
  const navigated: string[] = [];
  const opened: File[][] = [];
  const utilities: Array<{ target: string; file: File }> = [];
  const invoked: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  const e: LinuxDesktopEnv = {
    invoke: async (cmd, args) => {
      invoked.push({ cmd, args });
      if (cmd === 'desktop_read_file') return [1, 2, 3];
      return [];
    },
    navigate: (h) => navigated.push(h),
    openFiles: async (f) => { opened.push(f); },
    openUtilityFile: async (target, file) => { utilities.push({ target, file }); },
    ...overrides,
  };
  return { env: e, navigated, opened, utilities, invoked };
}

test('deepLinkToHash: lolly:// URLs become the app hash, junk becomes null', () => {
  assert.equal(deepLinkToHash('lolly://tool/qr-code?url=x'), '#/tool/qr-code?url=x');
  assert.equal(deepLinkToHash('lolly:///lab'), '#/lab');
  assert.equal(deepLinkToHash('https://lolly.tools/t/qr-code'), null, 'only the scheme is a deep link');
  assert.equal(deepLinkToHash('lolly://'), null, 'an empty route navigates nowhere');
  assert.equal(deepLinkToHash('lolly://a b'), null, 'whitespace never reaches the hash');
  assert.equal(deepLinkToHash('lolly://x"y'), null, 'quote characters never reach the hash');
});

test('navigate events set the hash - but only app-shaped routes', async () => {
  const { env: e, navigated } = env();
  await routeEvents([
    { kind: 'navigate', value: '#/tool/qr-code' },
    { kind: 'navigate', value: 'https://evil.example/' },
    { kind: 'navigate', value: 'javascript:alert(1)' },
  ], e);
  assert.deepEqual(navigated, ['#/tool/qr-code']);
});

test('openFile reads bytes through the gated command and lands in the drop path', async () => {
  const { env: e, opened, invoked } = env();
  await routeEvents([{ kind: 'openFile', value: '/home/x/share.lolly' }], e);
  assert.deepEqual(invoked[0], { cmd: 'desktop_read_file', args: { path: '/home/x/share.lolly' } });
  assert.equal(opened.length, 1);
  const f = opened[0]![0]!;
  assert.equal(f.name, 'share.lolly');
  // The type is what drop-router's lolly sniff accepts alongside the extension.
  assert.equal(f.type, 'application/vnd.lolly+zip');
});

test('hotfolderFile takes the same path as openFile; non-lolly files get no invented MIME', async () => {
  const { env: e, opened } = env();
  await routeEvents([{ kind: 'hotfolderFile', value: '/inbox/photo.jpg' }], e);
  assert.equal(opened[0]![0]!.name, 'photo.jpg');
  assert.equal(opened[0]![0]!.type, '');
});

test('a file-manager utility event preserves its chosen safe verb and selected file', async () => {
  const { env: e, opened, utilities, invoked } = env();
  await routeEvents([
    { kind: 'openUtilityFile', value: '/home/x/photo.png', target: 'strip-data' },
    { kind: 'openUtilityFile', value: '/home/x/private.pdf', target: 'redact' },
    { kind: 'openUtilityFile', value: '/home/x/unsafe.png', target: '../tool/evil' },
  ], e);
  assert.deepEqual(utilities.map((u) => [u.target, u.file.name]), [
    ['strip-data', 'photo.png'],
    ['redact', 'private.pdf'],
  ]);
  assert.equal(opened.length, 0, 'direct verbs do not reopen the generic chooser');
  assert.equal(invoked.length, 3, 'every path is still checked by desktop_read_file');
});

test('a failed read routes nothing and never throws the loop down', async () => {
  const { env: e, opened } = env({
    invoke: async (cmd) => {
      if (cmd === 'desktop_read_file') throw new Error('path was not delivered by the desktop');
      return [];
    },
  });
  await routeEvents([{ kind: 'openFile', value: '/etc/passwd' }], e);
  assert.equal(opened.length, 0);
});

test('malformed queue entries are skipped, and a poll is capped', async () => {
  const { env: e, navigated } = env();
  const flood = Array.from({ length: 40 }, () => ({ kind: 'navigate', value: '#/x' }));
  await routeEvents([{ kind: 42, value: '#/no' }, { value: '#/no' }, ...flood], e);
  assert.ok(navigated.length <= 16, `poll cap holds (${navigated.length})`);
  assert.ok(navigated.every((h) => h === '#/x'));
});
