// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet, deriveBrandTokens } from '@lolly/engine';
import { addDraftShades, draftShades } from './palette-draft.ts';
import { paletteGroups } from './palette-groups.ts';

test('adding draft shades preserves every existing token in both themes and is idempotent', () => {
  const doc = deriveBrandTokens({ primary: '#19765b', steps: 9 });
  const before = structuredClone(doc);
  const draft = deriveBrandTokens({ primary: '#9c318e', steps: 5 });
  const shades = draftShades(draft, 'primary');
  assert.equal(shades.length, 5);
  assert.equal(addDraftShades(doc, shades.slice(0, 2), 'Orchid shades'), 2);
  for (const theme of ['light', 'dark']) {
    const oldSet = createTokenSet(before, { theme });
    const nextSet = createTokenSet(doc, { theme });
    for (const token of oldSet.query({})) assert.deepEqual(nextSet.resolve(token.path), oldSet.resolve(token.path), `${theme}: ${token.path}`);
  }
  const once = structuredClone(doc);
  assert.equal(addDraftShades(doc, shades.slice(0, 2), 'Orchid shades'), 0);
  assert.deepEqual(doc, once);
  assert.deepEqual(paletteGroups(doc), ['Orchid shades']);
  assert.deepEqual(draftShades(draft, 'missing'), []);
});

test('a shade addition leaves a hand-authored brand document intact', () => {
  const doc = {
    color: { custom: { navy: { $type: 'color', $value: '#10283c' } }, semantic: { primary: { $type: 'color', $value: '{color.custom.navy}' } } },
    font: { brand: { $type: 'fontFamily', $value: 'Brand Sans' } },
    asset: { logo: { $type: 'string', $value: 'user/logo' } },
    $description: 'Our brand',
  };
  const before = structuredClone(doc);
  const shade = { key: 'color.ramp.primary.1', hex: '#542184', step: 1 };
  assert.equal(addDraftShades(doc, [shade], 'Purple shades'), 1);
  assert.deepEqual(doc.font, before.font);
  assert.deepEqual(doc.asset, before.asset);
  assert.deepEqual(doc.color.semantic, before.color.semantic);
  assert.deepEqual(doc.color.custom.navy, before.color.custom.navy);
  assert.equal(doc.$description, before.$description);
});
