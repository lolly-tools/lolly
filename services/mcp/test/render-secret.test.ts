// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { browserLaunchArgs, exposeExportPassword, exportUrl } from '../src/render.ts';

test('Chromium sandbox is on unless deployment explicitly opts out', () => {
  assert.ok(!browserLaunchArgs({}).includes('--no-sandbox'));
  assert.ok(browserLaunchArgs({ LOLLY_BROWSER_NO_SANDBOX: '1' }).includes('--no-sandbox'));
});

test('Tier-B navigation never carries a PDF password', () => {
  const url = exportUrl(
    'https://render.example.test',
    'report',
    'title=Quarterly&password=query-secret',
    'pdf',
    { password: 'option-secret' },
  );
  assert.doesNotMatch(url, /query-secret|option-secret|password=/);
  assert.match(url, /title=Quarterly/);
  assert.match(url, /export=1/);
});

test('Tier-B PDF password binding yields its secret once and can be cleared', async () => {
  let binding: ((source: unknown, kind: unknown) => unknown) | undefined;
  const context = {
    async exposeBinding(name: string, callback: (source: unknown, kind: unknown) => unknown) {
      assert.equal(name, '__lollyTakeExportSecret');
      binding = callback;
    },
  };
  const clear = await exposeExportPassword(context as never, 'one-time-secret');
  assert.equal(await binding?.({}, 'not-a-secret-kind'), null);
  assert.equal(await binding?.({}, 'pdf-password'), 'one-time-secret');
  assert.equal(await binding?.({}, 'pdf-password'), null);
  clear();

  const context2 = {
    async exposeBinding(_name: string, callback: (source: unknown, kind: unknown) => unknown) {
      binding = callback;
    },
  };
  const clear2 = await exposeExportPassword(context2 as never, 'clear-me');
  clear2();
  assert.equal(await binding?.({}, 'pdf-password'), null);
});
