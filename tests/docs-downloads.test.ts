// SPDX-License-Identifier: MPL-2.0
/**
 * The "Get the app" rail on the /info landing (docs/site/downloads.json, rendered
 * by downloadsRail in docs/build.ts).
 *
 * Checked against the SOURCE, like tests/docs-claims.test.ts, because the built
 * HTML is gitignored and only as fresh as the last local build. The rail links
 * out of the page in two ways, and both fail silently:
 *
 *  - a tile with `file` points at a lolli.li alias. A typo there is a 404 that
 *    nothing in the build notices, so the alias shape is pinned here.
 *  - a tile without one points at a section of a docs page. Renaming that
 *    heading leaves the tile landing at the top of the page, so every anchor is
 *    checked against the headings of the page it names.
 *
 * A mark key that docs/logos.ts does not know renders as an empty slot (docLogo
 * warns and emits nothing), so every `logo` is checked too.
 *
 * Run directly: node --test tests/docs-downloads.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DOC_LOGOS } from '../docs/logos.ts';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p: string) => readFileSync(resolve(repoRoot, p), 'utf-8');

type Tile = {
  id: string; logo?: string; icon?: string;
  os: string; name: string; ext: string; note: string;
  file?: string; slug?: string; hash?: string;
};
type Downloads = { label: string; lead: string; rows: { id: string; label: string; items: Tile[] }[]; more: { label: string; slug: string } };

const downloads = JSON.parse(read('docs/site/downloads.json')) as Downloads;
const tiles = downloads.rows.flatMap((r) => r.items);

/** The heading ids a docs page carries, slugged the way the built pages are. */
function headingIds(slug: string): Set<string> {
  const src = read(`docs/${slug}.md`);
  return new Set([...src.matchAll(/^#{2,4} (.+)$/gm)].map((m) =>
    m[1]!.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')));
}

test('the rail is two labelled rows of six tiles', () => {
  assert.deepEqual(downloads.rows.map((r) => r.id), ['apps', 'linux']);
  for (const row of downloads.rows) {
    assert.ok(row.label.trim(), `row ${row.id} has no label`);
    assert.equal(row.items.length, 6, `row ${row.id} should hold six tiles (the grid steps are 6, 3 and 2 columns)`);
  }
  const ids = tiles.map((t) => t.id);
  assert.equal(new Set(ids).size, ids.length, 'tile ids must be unique: links are looked up by id');
});

test('every tile has a mark the build can draw', () => {
  for (const t of tiles) {
    if (t.logo) assert.ok(t.logo in DOC_LOGOS, `${t.id}: unknown mark "${t.logo}" in docs/logos.ts`);
    else assert.ok(t.icon, `${t.id}: needs a logo or an icon`);
    for (const k of ['os', 'name', 'ext', 'note'] as const) assert.ok(t[k]?.trim(), `${t.id}: empty ${k}`);
  }
});

test('a file tile points at a stable lolli.li alias, a guide tile at a real heading', () => {
  for (const t of tiles) {
    if (t.file) {
      assert.match(t.file, /^lolly-latest(-[a-z0-9]+)?\.[A-Za-z]+$/, `${t.id}: "${t.file}" is not a lolly-latest alias`);
      assert.ok(!t.hash, `${t.id}: has both a file and an anchor`);
      continue;
    }
    const slug = t.slug ?? 'install';
    assert.ok(t.hash, `${t.id}: has neither a file nor an anchor`);
    assert.ok(existsSync(resolve(repoRoot, `docs/${slug}.md`)), `${t.id}: docs/${slug}.md does not exist`);
    assert.ok(headingIds(slug).has(t.hash!), `${t.id}: docs/${slug}.md has no heading with id "${t.hash}"`);
  }
});

test('the iPhone and iPad tile offers no download', () => {
  // No signed iOS build is published (docs/install.md, "iPhone and iPad"), so
  // the tile opens that section and claims no file and no store listing.
  const ios = tiles.find((t) => t.id === 'ios');
  assert.ok(ios, 'the apps row has an iPhone and iPad tile');
  assert.equal(ios.file, undefined);
  assert.equal(ios.hash, 'iphone-and-ipad');
  assert.ok(!/app store/i.test(JSON.stringify(downloads)), 'the rail must not mention an App Store listing');
});
