// SPDX-License-Identifier: MPL-2.0
/**
 * The licence of the saved tunes in Lolly's own catalogs (Andy, 2026-11-15): the six
 * tunes already released in Lolly Demo and Lolly Start stay CC0, because a CC0 release
 * cannot be withdrawn, and every tune added from now on is CC BY 4.0 with the credit
 * Lolly's music asks for (engine/src/tune-provenance.ts TUNE_CREDIT). Tunes go into a
 * catalog as hand-written index.json entries, with no script to set the licence, so this
 * test is what holds a new entry to the rule (docs/authoring-assets.md, "Saved tunes").
 *
 * Run directly: node --test tests/catalog-tunes-licence.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TUNE_CREDIT, TUNE_LICENCE } from '../engine/src/tune-provenance.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** The catalogs Lolly writes itself. */
const LOLLY_CATALOGS = ['brands/lolly-demo', 'brands/lolly-start'];

/** The six tunes released under CC0 on 2026-11-08. The list never grows. */
const RELEASED_CC0 = Object.freeze([
  'lolly/tunes/warm-250249288',
  'lolly/tunes/sings-4111860815',
  'lolly/tunes/sings-2971202674',
  'lolly/tunes/sings-3112281404',
  'lolly/tunes/sings-4228372535',
  'lolly/tunes/sings-2439981767',
]);

interface CatalogAsset { id: string; license?: string; attribution?: string; formats?: Array<{ format?: string }> }

function tunesIn(catalog: string): CatalogAsset[] {
  const index = JSON.parse(readFileSync(resolve(ROOT, catalog, 'catalog/assets/index.json'), 'utf8')) as { assets?: CatalogAsset[] } | CatalogAsset[];
  const assets = Array.isArray(index) ? index : index.assets ?? [];
  return assets.filter((a) => (a.formats ?? []).some((f) => f.format === 'lofi'));
}

test('the six released tunes stay CC0, and every other tune in Lolly\'s catalogs is CC BY 4.0 with the credit', () => {
  for (const catalog of LOLLY_CATALOGS) {
    const tunes = tunesIn(catalog);
    assert.ok(tunes.length > 0, `${catalog} lists its tunes`);
    for (const tune of tunes) {
      if (RELEASED_CC0.includes(tune.id)) {
        assert.equal(tune.license, 'CC0-1.0', `${catalog} ${tune.id} was released under CC0 and stays CC0`);
        continue;
      }
      assert.equal(tune.license, TUNE_LICENCE.id, `${catalog} ${tune.id}: a tune added since 2026-11-15 records "license": "${TUNE_LICENCE.id}"`);
      assert.equal(tune.attribution, TUNE_CREDIT, `${catalog} ${tune.id}: and "attribution": "${TUNE_CREDIT}"`);
    }
  }
});

test('the released CC0 list is the six tunes and nothing more', () => {
  assert.equal(RELEASED_CC0.length, 6);
  assert.equal(TUNE_LICENCE.id, 'CC-BY-4.0');
  assert.equal(TUNE_CREDIT, 'Music made with Lolly (https://lolly.tools), CC BY 4.0');
});
