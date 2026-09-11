// SPDX-License-Identifier: MPL-2.0
/** Personal Dashboard shelf: only live favourites appear, with a stable readable label. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { favouriteShelfTools, shelfToolLabel } from './dashboard.ts';

test('Yours shelf only includes favourited tools that remain in the catalogue', () => {
  const tools = [{ id: 'qr-code', name: 'QR Code' }, { id: 'street-map' }, { id: 'gone' }];
  assert.deepEqual(
    favouriteShelfTools(tools, new Set(['qr-code', 'street-map', 'missing'])).map((tool) => tool.id),
    ['qr-code', 'street-map'],
  );
});

test('Yours shelf prefers a catalogue name and makes legacy ids readable', () => {
  assert.equal(shelfToolLabel({ id: 'qr-code', name: 'QR Code' }), 'QR Code');
  assert.equal(shelfToolLabel({ id: 'street-map' }), 'Street Map');
});
