// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { captureTuiConsole, createTuiBridge } from './bridge.ts';

test('content-free setup has an empty asset catalog and local file services', async () => {
  const { host, dom } = await createTuiBridge({}, { catalogAvailable: false });
  try {
    assert.deepEqual(await host.assets.query({}), []);
    assert.ok(host.pdf);
    assert.ok(host.state);
  } finally {
    dom.window.close();
  }
});

test('console diagnostics are bounded, inspectable and restored after the terminal closes', () => {
  const previous = console.warn;
  const logs: string[] = [];
  const restore = captureTuiConsole(logs);
  try {
    for (let n = 0; n < 220; n++) console.warn('fixture %d', n);
    assert.equal(logs.length, 200);
    assert.equal(logs[0], '[warn] fixture 20');
    assert.equal(logs.at(-1), '[warn] fixture 219');
    console.warn('\x1b[31mred\x1b[0m\nnext');
    assert.equal(logs.at(-2), '[warn] red');
    assert.equal(logs.at(-1), 'next');
  } finally {
    restore();
  }
  assert.equal(console.warn, previous);
});
