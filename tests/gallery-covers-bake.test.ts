// SPDX-License-Identifier: MPL-2.0
/**
 * A profile's baked gallery covers were drawn from the tokens that profile ships.
 *
 * The gallery uses a baked cover only for a visitor whose context hash matches the
 * bake, and that hash takes in every resolved token. So one edit to a token document
 * retires every baked file at once. Nothing showed that: the files stayed in the
 * catalog, the gallery fell back to live renders, and a first visit to lolly.tools
 * waited more than fifteen seconds for its first cover, for nine days. The bake now
 * records a fingerprint of the token documents it was drawn from, and this test (with
 * the same check in scripts/validate-catalog.ts) fails when the two part.
 *
 *   node --test tests/gallery-covers-bake.test.ts
 */
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { catalogFile, contentRoots, readBrandAssetIndex } from '../packages/node-shell/src/content-roots.ts';
import { coverSourceFingerprint } from '../scripts/lib/cover-source.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

test('the fingerprint covers every token document and nothing else', () => {
  const tokens = { id: 'lolly/tokens/brand', type: 'tokens', formats: [{ checksum: 'sha256-aaa' }] };
  const logo = { id: 'lolly/logo/primary', type: 'logo', formats: [{ checksum: 'sha256-logo' }] };
  const base = coverSourceFingerprint([tokens, logo]);
  assert.match(base, /^[0-9a-f]{32}$/);
  assert.equal(coverSourceFingerprint([logo, tokens]), base, 'the order of the index does not matter');
  assert.equal(coverSourceFingerprint([tokens, { ...logo, formats: [{ checksum: 'sha256-other' }] }]), base, 'a logo is not part of a cover context');
  assert.notEqual(coverSourceFingerprint([{ ...tokens, formats: [{ checksum: 'sha256-bbb' }] }, logo]), base, 'an edited token document changes the fingerprint');
  assert.notEqual(coverSourceFingerprint([tokens, { id: 'lolly/tokens/second', type: 'tokens', formats: [{ checksum: 'sha256-ccc' }] }]), base, 'a second token document changes the fingerprint');
});

interface Baked { v?: number; source?: { fingerprint?: string }; contexts?: Record<string, string>; covers?: Record<string, Record<string, unknown>> }
const profiles = (JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as { profiles: Record<string, { tools: string[]; catalog: string }> }).profiles;

for (const [name, profile] of Object.entries(profiles)) {
  // A private pack that is not checked out has nothing to read. The public profiles are always here.
  if (![...profile.tools, profile.catalog].every((r) => existsSync(join(ROOT, r)))) continue;
  const roots = contentRoots({ profile: name });
  const manifestPath = catalogFile('previews/covers.json', roots);
  if (!existsSync(manifestPath)) continue;
  const baked = JSON.parse(readFileSync(manifestPath, 'utf8')) as Baked;

  test(`${name}: the covers were baked from the tokens the profile ships`, (t) => {
    if (baked.source?.fingerprint === undefined) {
      t.diagnostic(`${name} was baked before bakes recorded their source; run pnpm run build:gallery-covers --profile=${name}`);
      return;
    }
    assert.equal(
      baked.source.fingerprint, coverSourceFingerprint(readBrandAssetIndex(roots).assets),
      `the design system's tokens changed after the bake, so no visitor is shown these covers. Run: pnpm run build:gallery-covers --profile=${name}`,
    );
  });

  test(`${name}: every baked cover names a file that is in the catalog`, () => {
    assert.equal(baked.v, 1);
    const themes = new Set(Object.values(baked.contexts ?? {}));
    assert.deepEqual([...themes].sort(), ['dark', 'light'], 'one context for each theme');
    let files = 0;
    for (const [tool, entry] of Object.entries(baked.covers ?? {})) {
      assert.equal(typeof entry.version, 'string', `${tool} records the version it was drawn at`);
      for (const theme of themes) {
        const cover = entry[theme] as { file?: string } | undefined;
        if (!cover) continue;
        assert.match(String(cover.file), /^\/catalog\/previews\/covers\/[a-z0-9-]+\.(light|dark)\.(svg|webp)$/);
        assert.ok(existsSync(catalogFile(String(cover.file).replace(/^\/catalog\//, ''), roots)), `${cover.file} is missing`);
        files += 1;
      }
    }
    assert.ok(files > 0, 'a manifest with no cover in it should be removed instead');
  });
}
