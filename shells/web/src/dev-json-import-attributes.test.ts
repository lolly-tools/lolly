// SPDX-License-Identifier: MPL-2.0
/**
 * The dev server strips the import attribute from a dynamic JSON import.
 *
 * engine/src/text-hyphenation.ts loads its pattern files with
 * `import('./x.json', { with: { type: 'json' } })`. The dev server serves the rewritten
 * `…json?import` URL as JavaScript, so a kept attribute makes the browser refuse it and
 * the Design view fails to mount for any hyphenated story. This runs the real plugin's
 * transform over the real engine source.
 *
 * Run: node --test shells/web/src/dev-json-import-attributes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { devJsonImportAttributes } from '../vite.config.js';

const plugin = devJsonImportAttributes();
const transform = (code: string) => (plugin.transform as (code: string) => { code: string } | null)(code);

test('the hyphenation loaders lose their attribute and keep their specifiers', () => {
  const source = readFileSync(new URL('../../../engine/src/text-hyphenation.ts', import.meta.url), 'utf8');
  const out = transform(source);
  assert.ok(out, 'the engine source is rewritten');
  assert.doesNotMatch(out.code, /type: 'json'/);
  for (const lang of ['en-us', 'en-gb', 'fr', 'es', 'de-1996']) {
    assert.ok(out.code.includes(`import('./text-hyphen-data/${lang}.json')`), `${lang} still loads`);
  }
});

test('static JSON imports and other code are left alone, and only the dev server applies it', () => {
  assert.equal(transform("import data from './x.json' with { type: 'json' };\n"), null);
  assert.equal(transform("const m = import('./x.js');\n"), null);
  assert.equal(plugin.apply, 'serve');
});
