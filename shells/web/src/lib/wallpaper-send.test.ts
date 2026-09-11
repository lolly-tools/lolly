// SPDX-License-Identifier: MPL-2.0
/**
 * The wallpaper send target (plans/174 #6) - shape, gating and the
 * "unsupported" surfacing. The Tauri invoke rides the __TAURI_INTERNALS__
 * global (nearby-boot's tauriInvoke), so tests install/remove a fake there.
 *
 * Run with: node --test shells/web/src/lib/wallpaper-send.test.ts
 */
import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';

// isTauriShell reads window.__TAURI_INTERNALS__; node has no window, so alias
// it to globalThis BEFORE the module graph loads (same trick the jsdom-less
// neighbours use for window-reading modules).
(globalThis as { window?: unknown }).window ??= globalThis;

import { wallpaperSendTarget, KIND } from './wallpaper-send.ts';

type G = { __TAURI_INTERNALS__?: { invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown> } };

afterEach(() => { delete (globalThis as G).__TAURI_INTERNALS__; });

test('target shape: kind/formats/labels line up with the send-target contract', () => {
  const t = wallpaperSendTarget();
  assert.equal(t.kind, KIND);
  assert.deepEqual(t.formats, ['png', 'jpg', 'jpeg', 'webp']);
  assert.equal(typeof t.send, 'function');
  assert.ok(t.hint && t.hint.length > 0);
});

test('available() is the Tauri-shell gate - false on plain web', () => {
  const t = wallpaperSendTarget();
  assert.equal(t.available(), false, 'no __TAURI_INTERNALS__ here');
  (globalThis as G).__TAURI_INTERNALS__ = { invoke: async () => undefined };
  assert.equal(wallpaperSendTarget().available(), true);
});

test('send forwards bytes + ext to desktop_set_wallpaper_bytes', async () => {
  const calls: Array<{ cmd: string; args?: Record<string, unknown> }> = [];
  (globalThis as G).__TAURI_INTERNALS__ = {
    invoke: async (cmd, args) => { calls.push({ cmd, args }); return undefined; },
  };
  const out = await wallpaperSendTarget().send({
    bytes: new Uint8Array([9, 8, 7]), name: 'mesh.png', format: 'png', mime: 'image/png',
  });
  assert.equal(calls[0]!.cmd, 'desktop_set_wallpaper_bytes');
  assert.deepEqual(calls[0]!.args, { bytes: [9, 8, 7], ext: 'png', target: 'background' });
  assert.ok(out.label.length > 0);
});

test('the portal-absent answer surfaces as a friendly message, not a raw error', async () => {
  (globalThis as G).__TAURI_INTERNALS__ = {
    invoke: async () => { throw new Error('unsupported'); },
  };
  await assert.rejects(
    wallpaperSendTarget().send({ bytes: new Uint8Array([1]), name: 'x.png', format: 'png', mime: 'image/png' }),
    (e: Error) => !/^unsupported$/.test(e.message) && e.message.length > 10,
  );
});
