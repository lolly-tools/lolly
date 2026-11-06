// SPDX-License-Identifier: MPL-2.0
/**
 * One catalog file, one owning asset id (scripts/lib/catalog-asset-paths.ts).
 *
 * Lolly Work refuses an asset index where two ids claim one path and answers 503 for
 * the catalog's files, so these rules have to agree with its `buildPathMap` and hold
 * for every shape a catalog takes on the way to a Work instance: as authored, with the
 * signed renditions applied, and with every file content addressed.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  assetPathProblems, ownedPath, renditionRelPath, renditionSourceProblems, withRenditionFormats,
} from '../scripts/lib/catalog-asset-paths.ts';
import type { AssetPathEntry, RenditionManifest } from '../scripts/lib/catalog-asset-paths.ts';
import { applyRenditions } from '../scripts/build-catalog-renditions.ts';
import { materializeCatalogDelivery } from '../scripts/materialize-catalog-delivery.ts';
import { pemToDer } from '../engine/src/x509.ts';
import { CA_ROOT_PEM } from '../shells/web/src/ca-root.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATOR = join(ROOT, 'scripts/validate-catalog.ts');
const sri = (bytes: Uint8Array | string): string => `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
const hex16 = (bytes: Uint8Array | string): string => createHash('sha256').update(bytes).digest('hex').slice(0, 16);
const readJson = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
const brandsOnDisk = (): string[] => readdirSync(join(ROOT, 'brands'))
  .filter(name => existsSync(join(ROOT, 'brands', name, 'catalog/assets/index.json')));

const index = (...assets: AssetPathEntry[]) => ({ assets });
const asset = (id: string, ...urls: string[]): AssetPathEntry => ({ id, formats: urls.map(url => ({ format: 'x', url })) });

// ─── The rules, on the cases buildPathMap has to agree with ───────────────────

test('a catalog where each id has its own file has no problems', () => {
  assert.deepEqual(assetPathProblems(index(asset('a/one', '/catalog/assets/a.svg'), asset('a/two', '/catalog/assets/b.svg'))), []);
});

test('two ids naming one url are refused, and the message says which and what to do', () => {
  const [problem, ...rest] = assetPathProblems(index(asset('a/one', '/catalog/assets/a.svg'), asset('a/two', '/catalog/assets/a.svg')));
  assert.deepEqual(rest, []);
  assert.match(problem!, /a\/one and a\/two both own "assets\/a\.svg"/);
  assert.match(problem!, /503/);
  assert.match(problem!, /file of its own/);
  assert.match(problem!, /asset ids never change/);
});

test('a leading slash and the catalog/ prefix are not part of a path', () => {
  assert.equal(ownedPath('/catalog/assets/a.svg'), 'assets/a.svg');
  for (const other of ['catalog/assets/a.svg', 'assets/a.svg', '/assets/a.svg', '//catalog/assets/a.svg']) {
    assert.equal(assetPathProblems(index(asset('a/one', '/catalog/assets/a.svg'), asset('a/two', other))).length, 1, other);
  }
});

test('a locale format claims its file like any other format', () => {
  const localised = { id: 'a/two', formats: [{ format: 'x', url: '/catalog/assets/b.svg' }], locales: { de: [{ format: 'x', url: '/catalog/assets/a.svg' }] } };
  assert.equal(assetPathProblems(index(asset('a/one', '/catalog/assets/a.svg'), localised)).length, 1);
});

test('one id may claim a file twice, and rows with no usable url or id are passed over', () => {
  const twice = { id: 'a/one', formats: [{ format: 'x', url: '/catalog/assets/a.svg' }], locales: { de: [{ format: 'x', url: 'assets/a.svg' }] } };
  assert.deepEqual(assetPathProblems(index(twice, { id: 'a/two', formats: [{ format: 'x' }, { format: 'y', url: '' }, { format: 'z', url: '/catalog/' }] }, { formats: [{ url: '/catalog/assets/a.svg' }] })), []);
  assert.deepEqual(assetPathProblems({}), []);
});

test('a content address also claims its legacy name', () => {
  const bytes = 'one', address = hex16(bytes);
  const addressed = { id: 'a/one', formats: [{ format: 'x', url: `/catalog/assets/a.${address}.svg`, checksum: sri(bytes) }] };
  assert.deepEqual(assetPathProblems(index(addressed)), []);
  const [problem] = assetPathProblems(index(addressed, asset('a/two', '/catalog/assets/a.svg')));
  assert.match(problem!, /a\/one and a\/two both own "assets\/a\.svg"/);
});

test('two addresses that share a stem collide on their legacy name, with no file in common', () => {
  const row = (id: string, bytes: string) => ({ id, formats: [{ format: 'webp', url: `/catalog/renditions/out.${hex16(bytes)}.webp`, checksum: sri(bytes) }] });
  const [problem] = assetPathProblems(index(row('a/one', 'one'), row('a/two', 'two')));
  assert.match(problem!, /both own "renditions\/out\.webp"/);
  // The same id owning several renditions in one folder is the shape a release uses.
  assert.deepEqual(assetPathProblems(index({ id: 'a/one', formats: [...row('a/one', 'one').formats, ...row('a/one', 'two').formats] })), []);
});

test('an address that disagrees with its checksum, or is unsafe, is refused as Work refuses it', () => {
  const url = `/catalog/assets/a.${hex16('one')}.svg`;
  for (const checksum of [undefined, 'sha256-invalid', sri('two')]) {
    const [problem, ...rest] = assetPathProblems(index({ id: 'a/one', formats: [{ format: 'x', url, checksum }] }));
    assert.match(problem!, /does not match its checksum/);
    assert.deepEqual(rest, []);
  }
  const unsafe = `/catalog/assets/../a.${hex16('one')}.svg`;
  assert.match(assetPathProblems(index({ id: 'a/one', formats: [{ format: 'x', url: unsafe, checksum: sri('one') }] }))[0]!, /not a safe path/);
});

// ─── Renditions: what a release adds to the index ─────────────────────────────

const PRODUCT = { file: `out.${'a'.repeat(16)}.webp`, sha256: 'a'.repeat(64) };

test('rendition rows are folded in under a folder per id, so two ids never meet', () => {
  const manifest: RenditionManifest = { assets: [{ id: 'a/one', products: [PRODUCT] }, { id: 'a/two', products: [PRODUCT] }, { id: 'gone/asset', products: [PRODUCT] }] };
  const authored = index(asset('a/one', '/catalog/assets/a.jpg'), asset('a/two', '/catalog/assets/b.jpg'));
  const release = withRenditionFormats(authored, manifest) as { assets: Array<{ id: string; formats: Array<{ url: string; checksum: string }> }> };
  assert.equal(release.assets.length, 2);
  assert.equal(release.assets[1]!.formats[1]!.url, `/catalog/renditions/${renditionRelPath('a/two', PRODUCT.file)}`);
  assert.equal(release.assets[1]!.formats[1]!.url, `/catalog/renditions/a/two/${PRODUCT.file}`);
  assert.equal(release.assets[1]!.formats[1]!.checksum, `sha256-${Buffer.from(PRODUCT.sha256, 'hex').toString('base64')}`);
  assert.equal(withRenditionFormats(authored, null), authored);
  assert.equal(withRenditionFormats(authored, { assets: [] }), authored);
});

test('a rendition entry whose source is not one of its asset\'s formats is reported', () => {
  const authored = index(asset('a/one', '/catalog/assets/a.jpg'));
  assert.deepEqual(renditionSourceProblems(authored, { assets: [{ id: 'a/one', source: '/catalog/assets/a.jpg' }, { id: 'gone/asset', source: 'x' }] }), []);
  assert.match(renditionSourceProblems(authored, { assets: [{ id: 'a/one', source: '/catalog/assets/old.jpg' }] })[0]!, /"a\/one" points at source "\/catalog\/assets\/old\.jpg"/);
  assert.deepEqual(renditionSourceProblems(authored, null), []);
});

// ─── The packs in this repository ─────────────────────────────────────────────

const mountedIndex = (brand: string): { assets: AssetPathEntry[] } => {
  const own = readJson(join(ROOT, 'brands', brand, 'catalog/assets/index.json'));
  const shared = readJson(join(ROOT, 'community/emoji-packs/index.json'));
  return { assets: [...own.assets, ...shared.assets] };
};
const renditionsOf = (brand: string): RenditionManifest | null => {
  const path = join(ROOT, 'brands', brand, 'catalog/renditions/index.json');
  return existsSync(path) ? readJson(path) : null;
};

for (const brand of brandsOnDisk()) {
  test(`${brand}: no two ids claim one file, as authored or with its renditions`, () => {
    const mounted = mountedIndex(brand), renditions = renditionsOf(brand);
    assert.deepEqual(assetPathProblems(mounted), []);
    assert.deepEqual(assetPathProblems(withRenditionFormats(mounted, renditions)), []);
    assert.deepEqual(renditionSourceProblems(mounted, renditions), []);
  });
}

for (const brand of ['lolly-start', 'lolly-demo']) {
  test(`${brand}: the sample photograph keeps its id and its bytes, in a file of its own`, () => {
    const catalog = join(ROOT, 'brands', brand, 'catalog');
    const { assets } = readJson(join(catalog, 'assets/index.json')) as { assets: Array<{ id: string; formats: Array<{ url: string; checksum: string }> }> };
    const format = (id: string) => assets.find(entry => entry.id === id)!.formats[0]!;
    const sample = format('lolly/demo/sample-photo'), lorikeet = format('lolly/demo/lorikeet-lollipop');
    assert.equal(sample.url, '/catalog/assets/lolly/demo/sample-photo.jpg');
    assert.equal(lorikeet.url, '/catalog/assets/lolly/demo/lorikeet-lollipop.jpg');
    assert.equal(sample.checksum, lorikeet.checksum);
    assert.deepEqual(readFileSync(join(catalog, 'assets/lolly/demo/sample-photo.jpg')), readFileSync(join(catalog, 'assets/lolly/demo/lorikeet-lollipop.jpg')));
    assert.equal(renditionsOf(brand)!.assets!.find(entry => entry.id === 'lolly/demo/sample-photo')!.source, sample.url);
  });

  // A trimmed real release: every asset with signed renditions plus the design system,
  // through the same two steps a release build runs. The pinned root is the one the
  // release uses, so this also shows the products need no new signature.
  test(`${brand}: the signed renditions still apply, and the addressed release has one owner per path`, async () => {
    const dir = mkdtempSync(join(tmpdir(), 'catalog-asset-paths-'));
    try {
      const catalog = join(ROOT, 'brands', brand, 'catalog');
      const manifest = renditionsOf(brand)!;
      const wanted = new Set(manifest.assets!.map(entry => entry.id));
      const { assets } = readJson(join(catalog, 'assets/index.json')) as { assets: Array<{ id: string; type: string; formats: Array<{ url: string }> }> };
      const kept = assets.filter(entry => wanted.has(entry.id) || entry.type === 'tokens');
      for (const entry of kept) {
        for (const { url } of entry.formats) {
          const to = join(dir, url.slice(1));
          mkdirSync(dirname(to), { recursive: true });
          cpSync(join(catalog, url.slice('/catalog/'.length)), to);
        }
      }
      writeFileSync(join(dir, 'catalog/assets/index.json'), JSON.stringify({ assets: kept }));
      cpSync(join(catalog, 'renditions'), join(dir, 'catalog/renditions'), { recursive: true });
      mkdirSync(join(dir, 'tools'));

      const applied = await applyRenditions(dir, undefined, [pemToDer(CA_ROOT_PEM)]);
      assert.equal(applied, manifest.assets!.reduce((sum, entry) => sum + entry.products!.length, 0));
      for (const entry of manifest.assets!) {
        for (const product of entry.products!) {
          const owned = join(dir, 'catalog/renditions', renditionRelPath(entry.id, product.file));
          assert.equal(createHash('sha256').update(readFileSync(owned)).digest('hex'), product.sha256, 'a signed product must keep its exact bytes');
        }
      }
      assert.deepEqual(assetPathProblems(readJson(join(dir, 'catalog/assets/index.json'))), []);

      await materializeCatalogDelivery(dir);
      const delivered = readJson(join(dir, 'catalog/assets/index.json')) as { assets: Array<{ id: string; formats: Array<{ url: string }> }> };
      assert.deepEqual(assetPathProblems(delivered), []);
      const sample = delivered.assets.find(entry => entry.id === 'lolly/demo/sample-photo')!;
      assert.ok(sample.formats.some(format => /^\/catalog\/assets\/lolly\/demo\/sample-photo\.[0-9a-f]{16}\.jpg$/.test(format.url)));
      assert.ok(sample.formats.some(format => /^\/catalog\/renditions\/lolly\/demo\/sample-photo\/out\.[0-9a-f]{16}\.webp$/.test(format.url)));
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
}

test('lolly-demo: the former design system id keeps its own copy of the document', () => {
  const tokens = join(ROOT, 'brands/lolly-demo/catalog/assets/lolly/tokens');
  assert.deepEqual(readFileSync(join(tokens, 'opal.json')), readFileSync(join(tokens, 'demo.json')));
});

// ─── The validator itself ─────────────────────────────────────────────────────

/** A one-profile content root holding only the asset index under test. */
function fixtureRoot(assets: unknown[], renditions?: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), 'catalog-asset-paths-validate-'));
  writeFileSync(join(dir, 'profiles.json'), JSON.stringify({ default: 'fixture', profiles: { fixture: { label: 'Fixture', tools: ['community'], catalog: 'catalog' } } }));
  mkdirSync(join(dir, 'community/_empty'), { recursive: true });
  mkdirSync(join(dir, 'catalog/assets'), { recursive: true });
  mkdirSync(join(dir, 'catalog/tools'), { recursive: true });
  writeFileSync(join(dir, 'catalog/assets/index.json'), JSON.stringify({ version: 1, assets }));
  writeFileSync(join(dir, 'catalog/assets/a.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  writeFileSync(join(dir, 'catalog/tools/index.json'), JSON.stringify({ version: 1, generatedAt: 'x', tools: [] }));
  writeFileSync(join(dir, 'catalog/tools/index.slim.json'), JSON.stringify({ version: 1, generatedAt: 'x', tools: [] }));
  if (renditions) {
    mkdirSync(join(dir, 'catalog/renditions'));
    writeFileSync(join(dir, 'catalog/renditions/index.json'), JSON.stringify(renditions));
  }
  return dir;
}
function validate(root: string): { status: number | null; output: string } {
  const run = spawnSync(process.execPath, [VALIDATOR], { encoding: 'utf8', cwd: root, env: { ...process.env, LOLLY_ROOT: root, LOLLY_PROFILE: 'fixture' } });
  return { status: run.status, output: `${run.stdout}${run.stderr}` };
}
const svgAsset = (id: string) => ({ id, type: 'logo', version: '1.0.0', tier: 'core', formats: [{ format: 'svg', url: '/catalog/assets/a.svg', checksum: sri('<svg xmlns="http://www.w3.org/2000/svg"/>') }] });

test('validate-catalog reports two ids on one file and exits 1', () => {
  const root = fixtureRoot([svgAsset('fixture/one'), svgAsset('fixture/two')]);
  try {
    const { status, output } = validate(root);
    assert.equal(status, 1);
    assert.match(output, /two asset ids claim one catalog file: fixture\/one and fixture\/two both own "assets\/a\.svg"/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('validate-catalog reads a rendition manifest and reports a stale source', () => {
  const root = fixtureRoot([svgAsset('fixture/one')], { v: 1, assets: [{ id: 'fixture/one', source: '/catalog/assets/old.svg', products: [] }] });
  try {
    const { status, output } = validate(root);
    assert.equal(status, 1);
    assert.match(output, /"fixture\/one" points at source "\/catalog\/assets\/old\.svg"/);
    assert.doesNotMatch(output, /two asset ids claim one catalog file/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
