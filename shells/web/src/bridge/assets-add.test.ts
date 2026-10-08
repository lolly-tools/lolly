// SPDX-License-Identifier: MPL-2.0
/**
 * host.assets.add: the guards that keep a tool from filling a library on its own.
 * Each refusal happens before the upload ingest is loaded, so these run in Node.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addToAssets, AssetAddError } from './assets-add.ts';

const assets: Parameters<typeof addToAssets>[0] = {
  _listUserAssets: async () => [],
  _deleteUserAsset: async () => {},
};
/** The ingest is never reached: every refusal comes first. */
const store: Parameters<typeof addToAssets>[2] = async () => { throw new Error('the ingest was reached'); };

const setActivation = (hasBeenActive: boolean): void => {
  Object.defineProperty(globalThis, 'navigator', { value: { userActivation: { hasBeenActive } }, configurable: true });
};

const refuses = (file: unknown, code: string) =>
  assert.rejects(addToAssets(assets, file as Parameters<typeof addToAssets>[1], store), (e: unknown) => {
    assert.ok(e instanceof AssetAddError, String(e));
    assert.equal(e.code, code);
    return true;
  });

test('refuses a malformed or empty file by name', async () => {
  setActivation(true);
  await refuses({ name: '', bytes: new Uint8Array(1) }, 'assets.add.invalid');
  await refuses({ name: 'x.wav', bytes: 'not bytes' }, 'assets.add.invalid');
  await refuses({ name: 'x.wav', bytes: new Uint8Array(0) }, 'assets.add.empty');
});

test('refuses a save on a page the person never touched', async () => {
  setActivation(false);
  await refuses({ name: 'x.wav', bytes: new Uint8Array(4) }, 'assets.add.no-gesture');
});

test('refuses a burst of saves past the limit', async () => {
  setActivation(true);
  // A library that fails fast: every call that passes the guards records a save
  // and then rejects, which is enough to fill the window.
  const failing: Parameters<typeof addToAssets>[0] = { _listUserAssets: async () => { throw new Error('stop'); }, _deleteUserAsset: async () => {} };
  let rate = 0;
  for (let i = 0; i < 12; i++) {
    try {
      await addToAssets(failing, { name: 'x.wav', bytes: new Uint8Array(4) }, store);
    } catch (e) {
      if (e instanceof AssetAddError && e.code === 'assets.add.rate') rate++;
    }
  }
  assert.ok(rate >= 2, `expected the limit to refuse later saves, saw ${rate}`);
});
