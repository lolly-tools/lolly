// SPDX-License-Identifier: MPL-2.0
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { packEncrypted } from '../../../engine/src/url-pack.ts';

const dir = await mkdtemp(join(tmpdir(), 'lolly-terminal-roundtrip-'));
process.env.LOLLY_STATE_DIR = dir;
process.env.LOLLY_PROFILE = 'lolly-demo';
const { createTuiBridge } = await import('./bridge.ts');
const { mountTool, currentQuery, modelValues, openLinkQuery, LinkPasswordError } = await import(
  './engine-render.ts'
);
after(() => rm(dir, { recursive: true, force: true }));

test('encrypted links require successful decryption before mounting', async () => {
  const token = await packEncrypted(
    'url=https%3A%2F%2Fexample.org%2Fprotected',
    'fixture-password'
  );
  assert.ok(token);
  await assert.rejects(openLinkQuery(`zx=${token}`), LinkPasswordError);
  await assert.rejects(openLinkQuery(`zx=${token}`, 'wrong'), LinkPasswordError);
  const { host, dom } = await createTuiBridge();
  try {
    const { runtime, reserved } = await mountTool(
      'qr-code',
      host,
      `zx=${token}&width=812`,
      undefined,
      { fromLink: true, linkPassword: 'fixture-password' }
    );
    assert.equal(
      runtime.getModel().find((input) => input.id === 'url')?.value,
      'https://example.org/protected'
    );
    assert.equal(reserved.width, 812);
  } finally {
    dom.window.close();
  }
});

test('saved document markers and non-secret export settings survive a reopen', async () => {
  const { host, dom } = await createTuiBridge();
  try {
    const { runtime } = await mountTool('qr-code', host, '', {
      __tokenSelection: { colourway: 'midnight' },
    });
    const values = modelValues(runtime);
    assert.deepEqual(values.__tokenSelection, runtime.tokenSelection);
    assert.ok(Object.hasOwn(values, '__tokenLinks'));
    assert.ok(Object.hasOwn(values, '__emoji'));
    const query = currentQuery(runtime, {
      width: 812,
      height: 550,
      format: 'png',
      unit: 'px',
      c2pa: true,
      c2paDays: 30,
    });
    assert.ok(query.includes('_themes='));
    const reopened = await mountTool('qr-code', host, query, values);
    assert.deepEqual(reopened.runtime.tokenSelection, runtime.tokenSelection);
    assert.equal(reopened.reserved.width, 812);
    assert.equal(reopened.reserved.format, 'png');
    assert.equal(reopened.reserved.c2pa?.days, 30);
  } finally {
    dom.window.close();
  }
});
