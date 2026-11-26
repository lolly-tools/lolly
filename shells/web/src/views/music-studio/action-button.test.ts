// SPDX-License-Identifier: MPL-2.0
/**
 * What the music generator's Save and Download buttons say when they fail
 * (views/music-studio/action-button.ts): a private window's refusal to keep a file and
 * a full disk each get a plain sentence, a failure already in plain words passes through,
 * and anything else gets the button's own fallback rather than a raw error.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/views/music-studio/action-button.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plainFailure, PlainFailure } from './action-button.ts';

const named = (name: string, message: string): Error => Object.assign(new Error(message), { name });

test('a private window\'s refusal to store a file is said plainly', () => {
  const webkit = named('UnknownError', 'Error preparing Blob/File data to be stored in object store');
  assert.equal(plainFailure(webkit, 'fallback'), 'This browser would not store the tune. A private window cannot keep files.');
});

test('a full disk, a plain failure and anything else', () => {
  assert.equal(plainFailure(named('QuotaExceededError', 'The quota has been exceeded.'), 'fallback'), 'There is no room left on this device to store the tune.');
  assert.equal(plainFailure(new PlainFailure('This host cannot save to the library.'), 'fallback'), 'This host cannot save to the library.');
  assert.equal(plainFailure(new TypeError('x is undefined'), 'The tune could not be saved.'), 'The tune could not be saved.');
  assert.equal(plainFailure('nothing made yet', 'The file could not be made.'), 'The file could not be made.');
});
