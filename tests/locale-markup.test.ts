// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLocaleCatalog } from '../scripts/validate-locale-markup.ts';

test('reviewed inline tags survive only with the source structure', () => {
  assert.deepEqual(validateLocaleCatalog({
    'Checked <strong>{name}</strong>': 'Vérifié <strong>{name}</strong>',
    'See <a href="https://c2pa.org" target="_blank" rel="noopener">C2PA</a>':
      'Voir <a href="https://c2pa.org" target="_blank" rel="noopener">C2PA</a>',
  }), []);
  assert.match(
    validateLocaleCatalog({ 'Checked <strong>{name}</strong>': 'Vérifié {name}' }).join('\n'),
    /changed the source markup structure/,
  );
});

test('scripts, event handlers, and unreviewed links are rejected', () => {
  for (const attack of [
    '<script>alert(1)</script>',
    '<strong onclick="alert(1)">name</strong>',
    '<a href="javascript:alert(1)">click</a>',
  ]) {
    assert.match(validateLocaleCatalog({ plain: attack }).join('\n'), /forbidden locale markup/);
  }
});
