// SPDX-License-Identifier: MPL-2.0
/**
 * A design system from one colour (lib/design-system/one-colour.ts): the document
 * the greeting's colour row installs.
 *
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/one-colour.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { colorToHex, createTokenSet, deriveBrandTokens } from '@lolly/engine';
import { designSystemFromColour } from './one-colour.ts';

type Rec = Record<string, unknown>;
const starter = (): Rec => JSON.parse(readFileSync(new URL('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8')) as Rec;
const baseOf = (doc: Rec): Rec => (doc.base ?? doc) as Rec;

test('the colour becomes the primary, as a first colour does in Design System Setup', () => {
  const doc = designSystemFromColour(starter(), '#8551C8');
  const fresh = deriveBrandTokens({ primary: '#8551C8', name: 'My brand' }) as Rec;
  assert.deepEqual(baseOf(doc).color, baseOf(fresh).color, 'the colour groups are the derive\'s own');
  const primary = createTokenSet(doc, { theme: 'light' }).get('color.semantic.primary');
  assert.equal((colorToHex(primary?.value ?? '') ?? '').toLowerCase(), '#8551c8');
});

test('the faces, the logo slots and the shape come across from the starter', () => {
  const from = baseOf(starter());
  const to = baseOf(designSystemFromColour(starter(), '#39734D'));
  for (const group of ['font', 'asset', 'shape']) {
    if (from[group] === undefined) continue;
    assert.deepEqual(to[group], from[group], `${group} is carried`);
    assert.notEqual(to[group], from[group], `${group} is a copy, so the starter's own document is untouched`);
  }
  assert.ok(to.font, 'the starter names its faces, and the new system keeps them');
});

test('a document that cannot be read still gives a whole design system', () => {
  for (const current of [null, undefined, 'nope', []]) {
    const doc = designSystemFromColour(current, '#2F62C9');
    assert.ok(baseOf(doc).color, 'colour from the derive alone');
  }
});
