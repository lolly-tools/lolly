// SPDX-License-Identifier: MPL-2.0
/**
 * What Lolly Work accepts from a brand page (plan 351).
 *
 * Work's `server/src/brand-pages/manifest.ts` follows the format key by key and refuses
 * anything else, so that the digest covers everything a manifest says. It lives in another
 * repository, so a change here would otherwise reach a customer as a refused publish. It
 * happened once: `logos` and a font's licence text were added here, and Work refused both.
 *
 * When this fails because the format moved on purpose:
 *   1. Change `parseBrandPageManifest` and `LAYOUT` in lolly-work to accept the change.
 *   2. Regenerate Work's fixture: node scripts/build-brand-page-fixture.ts --out=<lolly-work>/tests/fixtures/brand-page-folder
 *   3. Merge that first, then update the lists below to match.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import { buildBrandPage } from '../engine/src/brand-page.ts';
import { brandPageFixtureInput } from '../scripts/build-brand-page-fixture.ts';

const HOW = 'Lolly Work refuses what it does not know. See the steps at the top of this file.';

/** Copied from Work's parser. */
const MANIFEST_KEYS = ['version', 'id', 'name', 'revision', 'publishedVersion', 'origin', 'generator', 'usage', 'colourways', 'files', 'logos', 'held', 'checks', 'publishedAt', 'digest'];
const LOGO_KEYS = ['id', 'name', 'path', 'surface', 'mono', 'primary', 'licence'];
const HELD_KINDS = ['policy', 'licence', 'unknown', 'content', 'limit'];

const SEGMENT = '[A-Za-z0-9_-][A-Za-z0-9._-]*';
const DIRECTORIES = `(?:${SEGMENT}/)*`;
/** Copied from `LAYOUT` in Work's parser: what each role may be called. */
const LAYOUT: Record<string, RegExp> = {
  page: /^index\.html$/,
  'page-markdown': /^index\.md$/,
  'page-style': /^assets\/page\.css$/,
  'design-md': /^DESIGN\.md$/,
  'design-md-variant': new RegExp(`^design/${SEGMENT}\\.DESIGN\\.md$`),
  agents: /^AGENTS\.md$/,
  llms: /^llms\.txt$/,
  checks: /^checks\.json$/,
  tokens: /^tokens\/tokens\.json$/,
  'tokens-resolved': new RegExp(`^tokens/${SEGMENT}\\.tokens\\.json$`),
  logo: new RegExp(`^logos/${DIRECTORIES}${SEGMENT}\\.(?:svg|png|jpe?g|webp|pdf)$`),
  font: new RegExp(`^fonts/(?:${DIRECTORIES}${SEGMENT}\\.(?:woff2?|ttf|otf)|[a-z0-9][a-z0-9-]*-licence\\.txt)$`),
  skill: new RegExp(`^skills/${SEGMENT}/${DIRECTORIES}${SEGMENT}\\.(?:md|json|txt)$`),
  example: new RegExp(`^examples/${DIRECTORIES}${SEGMENT}\\.(?:svg|png)$`),
};

/** The format as Work last learned the format. Moves only with the steps at the top. */
const SCHEMA_SHA256 = 'c9956c92c13ade48faae08b827124a3a1e3187a609a6a1c8f8ad1d3a1de975ff';

test('the format is the one Lolly Work was last taught', () => {
  const sha = createHash('sha256').update(readFileSync(new URL('../schemas/brand-page-v1.schema.json', import.meta.url))).digest('hex');
  assert.equal(sha, SCHEMA_SHA256, `schemas/brand-page-v1.schema.json changed. ${HOW}`);
});

test('a page with one of everything stays inside what Lolly Work accepts', async () => {
  const { manifest, files } = await buildBrandPage(brandPageFixtureInput());
  for (const key of Object.keys(manifest)) assert.ok(MANIFEST_KEYS.includes(key), `brand.json has a new key, ${key}. ${HOW}`);
  assert.ok(manifest.logos?.length, 'the fixture lists logos');
  for (const logo of manifest.logos ?? []) {
    for (const key of Object.keys(logo)) assert.ok(LOGO_KEYS.includes(key), `a logo row has a new key, ${key}. ${HOW}`);
  }
  for (const held of manifest.held) assert.ok(HELD_KINDS.includes(held.kind), `a held row has a new kind, ${held.kind}. ${HOW}`);
  for (const file of manifest.files) {
    const rule = LAYOUT[file.role];
    assert.ok(rule, `a file has a new role, ${file.role}. ${HOW}`);
    assert.match(file.path, rule, `${file.path} is outside what Work allows for the role ${file.role}. ${HOW}`);
  }
  assert.ok(files.length > 0);
});

test('the fixture holds one of everything Work needs to be tested against', async () => {
  const { manifest } = await buildBrandPage(brandPageFixtureInput());
  assert.deepEqual([...new Set(manifest.files.map(f => f.role))].sort(), Object.keys(LAYOUT).sort(), 'every role appears');
  assert.ok(manifest.files.some(f => f.path === 'fonts/fixture-sans-licence.txt'), 'a font carries its licence text');
  assert.equal(manifest.logos?.find(l => l.id === 'fixture/logo/primary')?.licence, 'Owner-published, not an open licence');
  assert.equal(manifest.logos?.find(l => l.id === 'fixture/logo/primary')?.primary, true);
  assert.ok(manifest.held.some(h => h.item === 'partner/logo/primary'), 'a logo held back');
});
