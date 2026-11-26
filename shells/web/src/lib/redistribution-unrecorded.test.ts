// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packRights, UNREADABLE_RECORD } from './redistribution.ts';
import { noticeUnrecorded, unrecordedWarning } from './unrecorded-notice.ts';
import { lollyLibraryResolver } from '../views/tool-lolly-vehicle.ts';

test('only a work with nothing recorded travels with a warning; anything recorded, even partly, still holds', () => {
  for (const meta of [{}, { name: 'Pattern' }, { rights: null }]) {
    const answer = packRights(meta as Record<string, unknown>);
    assert.equal(answer.licensed, undefined, `${JSON.stringify(meta)} travels`);
    assert.equal(answer.unrecorded, 'licence not recorded', `${JSON.stringify(meta)} carries the warning`);
  }
  const held: Array<[Record<string, unknown>, string]> = [
    [{ attribution: 'Orbit Inc' }, 'an attribution names a rights holder'],
    [{ rights: { rights: [{ declaration: 'LicenseRef-private', status: 'unparsed' }] } }, 'a rights record that cannot be read'],
    [{ license: 'LicenseRef-acme-house' }, 'a recorded licence not yet interpreted'],
    [{ brandLock: true }, 'a brand lock'],
  ];
  for (const [meta, why] of held) {
    const answer = packRights(meta);
    assert.equal(answer.licensed, true, `${why} holds`);
    assert.equal(answer.unrecorded, undefined, `${why} carries no unrecorded warning`);
  }
  assert.equal(UNREADABLE_RECORD.licensed, true);
});

test('a work whose catalog record could not be read is held back, not treated as unrecorded', async () => {
  const resolve = lollyLibraryResolver({
    _getBlob: async () => new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }),
    get: async () => { throw new Error('record store unavailable'); },
  } as never);
  const lib = await resolve('lolly-start/pattern/locked');
  assert.ok(lib, 'the bytes are found');
  assert.equal(lib!.licensed, true, 'but held back');
  assert.equal(lib!.holdReason, 'its catalog record could not be read');
  assert.equal(lib!.unrecorded, undefined);
});

test('the sender is told which works travel without a recorded licence', async () => {
  assert.equal(unrecordedWarning([]), '');
  assert.equal(unrecordedWarning(undefined), '');
  assert.match(unrecordedWarning(['Pattern']), /^"Pattern" travels in this file, but its licence is not on record\. CREDITS\.txt asks/);
  const many = unrecordedWarning(['A', 'B', 'C', 'D', 'E']);
  assert.match(many, /^5 catalog works travel in this file without a recorded licence: "A", "B", "C" and 2 more\./);
  await noticeUnrecorded(['A']); // no page here: nothing to show, and nothing thrown
});
