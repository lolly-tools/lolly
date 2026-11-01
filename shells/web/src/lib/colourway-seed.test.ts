// SPDX-License-Identifier: MPL-2.0
/**
 * New work starts in the person's colourway (lib/colourway-seed.ts, plans/331).
 *
 * What these pin, on the public Lolly Demo design system: a valid choice becomes a
 * resolved selection in the engine's own `withColourway` shape; a colourway the
 * design system no longer offers, a design system without colourways and a tool
 * whose manifest ignores colourways all start as before (no selection); and the
 * host read never throws.
 *
 * Run directly:  node --test shells/web/src/lib/colourway-seed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colourwaySeed, newWorkTokenSelection } from './colourway-seed.ts';
import { withColourway } from '../../../../engine/src/colourway.ts';

const demo = JSON.parse(readFileSync(new URL('../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const start = JSON.parse(readFileSync(new URL('../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));

test('a colourway the design system offers becomes the resolved choice a piece stores', () => {
  assert.deepEqual(colourwaySeed(demo, 'midnight'), { colourway: 'midnight' });
  assert.deepEqual(colourwaySeed(demo, 'beach'), withColourway(undefined, { group: 'colourway', option: 'beach' }));
  assert.deepEqual(colourwaySeed(demo, 'spearmint'), { colourway: 'spearmint' }, 'a stored canonical choice is still stored, never a rule');
});

test('nothing is seeded where nothing can be', () => {
  assert.equal(colourwaySeed(demo, null), undefined);
  assert.equal(colourwaySeed(demo, 'persimmon'), undefined, 'a colourway the design system no longer offers');
  assert.equal(colourwaySeed(start, 'midnight'), undefined, 'a design system without colourways');
  assert.equal(colourwaySeed(null, 'midnight'), undefined);
  assert.equal(colourwaySeed(demo, 'midnight', { colourway: 'ignore' }), undefined, 'a tool whose colours are its content');
  assert.deepEqual(colourwaySeed(demo, 'midnight', { mode: 'ignore' }), { colourway: 'midnight' }, 'ignoring another kind leaves the colourway');
});

test('the host read takes the active design system\'s choice and its document', async () => {
  const host = (profile: object, document: unknown = demo) => ({
    profile: { get: async () => profile },
    tokens: { active: async () => ({ id: 'shipped' }), snapshot: async () => ({ document }) },
  });
  assert.deepEqual(await newWorkTokenSelection(host({ colourways: { shipped: 'midnight' } })), { colourway: 'midnight' });
  assert.equal(await newWorkTokenSelection(host({})), undefined, 'a person who chose nothing starts as before');
  assert.equal(await newWorkTokenSelection(host({ colourways: { acme: 'midnight' } })), undefined, 'a choice made in another design system');
  assert.equal(await newWorkTokenSelection(host({ colourways: { shipped: 'midnight' } }), { colourway: 'ignore' }), undefined);
  assert.equal(await newWorkTokenSelection(host({ colourways: { shipped: 'midnight' } }, start)), undefined);
  const broken = { profile: { get: async () => ({ colourways: { shipped: 'midnight' } }) }, tokens: { active: async () => ({ id: 'shipped' }), snapshot: async () => { throw new Error('no tokens'); } } };
  assert.equal(await newWorkTokenSelection(broken), undefined, 'a failed read starts the piece as before');
  assert.equal(await newWorkTokenSelection({}), undefined);
});
