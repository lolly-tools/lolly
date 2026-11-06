// SPDX-License-Identifier: MPL-2.0
/**
 * The TUI's export function and a password: what it refuses before anything renders, with
 * nothing written. The real locked files are read back in
 * tests/export-password-routes.browser.test.ts.
 */
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { createTuiBridge } from './bridge.ts';
import { exportToFile, mountTool } from './engine-render.ts';

const SECRET = 'Zq7-right-password';
const dir = await mkdtemp(join(tmpdir(), 'lolly-tui-password-'));
after(() => rm(dir, { recursive: true, force: true }));

for (const [format, dims, expected] of [
  ['svg', { password: SECRET }, /"svg" file cannot carry a password/],
  ['png', { password: SECRET }, /"png" file cannot carry a password/],
  ['pdf-cmyk', { password: SECRET }, /cannot lock a "pdf-cmyk"/],
  ['pdf', { password: SECRET, bleed: '3mm' }, /bleed or print marks/],
  ['pdf', { password: 'пароль123' }, /plain ASCII/],
] as Array<[string, { password: string; bleed?: string }, RegExp]>) {
  test(`${format} with ${Object.keys(dims).join(' and ')}: refused, and no file appears`, async () => {
    const { host, dom } = await createTuiBridge();
    try {
      const { runtime, manifest } = await mountTool('qr-code', host, 'url=https%3A%2F%2Fexample.com', undefined, {});
      const out = join(dir, `never-${format}-${Object.keys(dims).length}.bin`);
      await assert.rejects(
        () => exportToFile(runtime, dom, manifest, format, out, dims),
        (error: Error) => expected.test(error.message) && !error.message.includes(dims.password),
      );
      assert.equal(existsSync(out), false);
    } finally {
      dom.window.close();
    }
  });
}

test('with no password the same export writes its file', async () => {
  const { host, dom } = await createTuiBridge();
  try {
    const { runtime, manifest } = await mountTool('qr-code', host, 'url=https%3A%2F%2Fexample.com', undefined, {});
    const out = join(dir, 'plain.svg');
    assert.ok(await exportToFile(runtime, dom, manifest, 'svg', out, {}) > 0);
    assert.equal(existsSync(out), true);
  } finally {
    dom.window.close();
  }
});
