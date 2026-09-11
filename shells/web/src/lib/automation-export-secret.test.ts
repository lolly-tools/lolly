// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';
import { takeAutomationExportPassword } from './automation-export-secret.ts';

const originalWindow = globalThis.window;
afterEach(() => {
  if (originalWindow === undefined) delete (globalThis as { window?: Window }).window;
  else globalThis.window = originalWindow;
});

test('automation export password is consumed only for an immediate export without a URL password', async () => {
  const calls: string[] = [];
  (globalThis as { window: Window }).window = {
    __lollyTakeExportSecret: async (kind: 'pdf-password') => { calls.push(kind); return 'out-of-band secret'; },
  } as unknown as Window;
  assert.equal(await takeAutomationExportPassword(true, undefined), 'out-of-band secret');
  assert.equal(await takeAutomationExportPassword(false, undefined), undefined);
  assert.equal(await takeAutomationExportPassword(true, 'link secret'), undefined);
  assert.deepEqual(calls, ['pdf-password']);
});
