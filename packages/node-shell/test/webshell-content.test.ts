// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readAssetIndex } from '../src/content-roots.ts';
import { activeContentResponse } from '../src/webshell-render.ts';

test("the browser tier answers the catalog from the active profile, not the dist's", () => {
  const index = activeContentResponse('/catalog/assets/index.json');
  assert.ok(index && 'json' in index, 'the merged asset index is assembled, as the dev server does');
  assert.deepEqual(JSON.parse(index.json), JSON.parse(JSON.stringify(readAssetIndex())));
  const tool = activeContentResponse('/tools/qr-code/tool.json');
  assert.ok(tool && 'file' in tool && tool.file.endsWith('tool.json'), 'a mounted tool file resolves');
});

test('anything the profile does not hold goes back to the dist', () => {
  assert.equal(activeContentResponse('/'), null);
  assert.equal(activeContentResponse('/_app/index.js'), null);
  assert.equal(activeContentResponse('/tools/no-such-tool/tool.json'), null);
  assert.equal(activeContentResponse('/catalog/no/such/file.svg'), null);
  assert.equal(activeContentResponse('/catalog/../package.json'), null, 'no escape from the roots');
});
