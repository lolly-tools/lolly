// SPDX-License-Identifier: MPL-2.0
/**
 * A profile's `companions`: a second design system offered beside its own, as a filtered
 * mount of another pack's catalog. What matters is what it must never do: change what the
 * brand's rows draw, reach a profile that did not ask, or bring more than it names.
 *
 * Fixture checkouts only, so this runs on a public clone and in CI, where brands/suse is
 * absent. tests/profile-companion.test.ts holds the rules on the real packs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';

import {
  assetIndexFiles, catalogFile, companionAssetNamed, companionFiles, contentRoots, contentUrlFile,
  materializeInto, readAssetIndex, readBrandAssetIndex,
} from '../src/content-roots.ts';

function write(path: string, body: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}
const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';
const row = (id: string, url: string, extra: Record<string, unknown> = {}) => ({ id, type: 'vector', tier: 'core', formats: [{ format: 'svg', url }], ...extra });

/** Brand `x` with its own tokens and one sample; brand `y` next to `x` with the same sample id. */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'lolly-companions-'));
  write(join(root, 'profiles.json'), json({
    default: 'x',
    profiles: {
      x: { tools: ['community'], assets: ['community/emoji-packs'], catalog: 'brands/x/catalog' },
      y: { tools: ['community'], assets: ['community/emoji-packs'], catalog: 'brands/y/catalog' },
      'x-with-y': {
        tools: ['community'], assets: ['community/emoji-packs'], catalog: 'brands/x/catalog', brandTokens: 'x/tokens/brand',
        companions: [{ label: 'Y', catalog: 'brands/y/catalog', tokens: 'y/tokens/brand', assets: ['y/tokens/brand', 'y/logo/', 'y/palette/opal-', 'y/font/face', 'shared/sample', 'y/demo/own'] }],
      },
    },
  }));
  write(join(root, 'community/alpha/tool.json'), json({ id: 'alpha' }));
  write(join(root, 'community/emoji-packs/index.json'), json({ version: '1', assets: [row('community/emoji/set', '/catalog/packs/emoji-packs/set.json')] }));
  write(join(root, 'community/emoji-packs/set.json'), '{}\n');
  write(join(root, 'brands/x/catalog/tools/index.json'), json({ tools: [] }));
  write(join(root, 'brands/x/catalog/assets/index.json'), json({
    version: '1',
    defaultHiddenTools: ['alpha'],
    assets: [
      row('x/tokens/brand', '/catalog/assets/x/brand.json', { type: 'tokens', tags: ['brand'], brandLock: true }),
      row('shared/sample', '/catalog/assets/shared/sample.svg'),
    ],
  }));
  write(join(root, 'brands/x/catalog/assets/x/brand.json'), '{"brand":"x"}\n');
  write(join(root, 'brands/x/catalog/assets/shared/sample.svg'), '<svg id="x"/>\n');
  write(join(root, 'brands/y/catalog/tools/index.json'), json({ tools: [] }));
  write(join(root, 'brands/y/catalog/og/card.png'), 'og\n');
  write(join(root, 'brands/y/catalog/previews/card.svg'), 'preview\n');
  write(join(root, 'brands/y/catalog/renditions/index.json'), '{}\n');
  write(join(root, 'brands/y/catalog/assets/index.json'), json({
    version: '1',
    brandTokens: 'y/tokens/brand',
    defaultHiddenTools: ['beta'],
    companionDesignSystems: [{ tokens: 'lolly/tokens/brand', label: 'Starter' }],
    assets: [
      row('y/tokens/brand', '/catalog/assets/y/brand.json', { type: 'tokens', tags: ['brand'] }),
      row('y/tokens/old', '/catalog/assets/y/old.json', { type: 'tokens', deprecated: true }),
      row('y/logo/primary', '/catalog/assets/y/logo.svg', { license: 'LicenseRef-Y-Marks', rights: { works: [{ id: 'y/logo/primary' }] } }),
      row('y/palette/opal-icons', '/catalog/assets/y/icons.json', { type: 'palette' }),
      row('y/palette/riso', '/catalog/assets/y/riso.json', { type: 'palette' }),
      row('y/font/face', '/catalog/fonts/Face.ttf', { type: 'font', tier: 'on-demand', meta: { licenceFile: '/catalog/fonts/OFL-Face.txt' } }),
      row('y/skill/brand', '/catalog/assets/y/skill.md', { type: 'skill' }),
      row('y/loops/one', '/catalog/assets/y/one.mp3', { type: 'audio' }),
      row('y/demo/own', '/catalog/assets/y/own.svg'),
      row('shared/sample', '/catalog/assets/shared/sample.svg'),
    ],
  }));
  for (const file of ['assets/y/brand.json', 'assets/y/old.json', 'assets/y/logo.svg', 'assets/y/icons.json', 'assets/y/riso.json', 'fonts/Face.ttf', 'fonts/OFL-Face.txt', 'assets/y/skill.md', 'assets/y/one.mp3', 'assets/y/own.svg']) {
    write(join(root, 'brands/y/catalog', file), `${file}\n`);
  }
  write(join(root, 'brands/y/catalog/assets/shared/sample.svg'), '<svg id="y"/>\n');
  return root;
}

function treeHash(dir: string): string {
  const hash = createHash('sha256');
  const walk = (at: string): void => {
    for (const name of readdirSync(at).sort()) {
      const path = join(at, name);
      if (statSync(path).isDirectory()) { walk(path); continue; }
      hash.update(relative(dir, path)).update('\0').update(readFileSync(path)).update('\0');
    }
  };
  walk(dir);
  return hash.digest('hex');
}

test('a name in the list matches exactly, a name ending in / or - as a family', () => {
  const assets = ['y/tokens/brand', 'y/logo/', 'y/palette/opal-'];
  assert.ok(companionAssetNamed(assets, 'y/tokens/brand'));
  assert.ok(!companionAssetNamed(assets, 'y/tokens/brand/v2'), 'a version of a token is not the token');
  assert.ok(companionAssetNamed(assets, 'y/logo/primary'));
  assert.ok(companionAssetNamed(assets, 'y/palette/opal-icons'));
  assert.ok(!companionAssetNamed(assets, 'y/palette/riso'));
});

test('the merged index keeps the brand first, states its head and lists what the companion owns', () => {
  const root = fixture();
  try {
    const roots = contentRoots({ root, profile: 'x-with-y' });
    const index = readAssetIndex(roots);
    assert.equal(index.brandTokens, 'x/tokens/brand');
    assert.deepEqual(index.companionDesignSystems, [{ tokens: 'y/tokens/brand', label: 'Y', assets: ['y/tokens/brand', 'y/logo/', 'y/palette/opal-', 'y/font/face', 'shared/sample', 'y/demo/own'] }]);
    assert.deepEqual(index.defaultHiddenTools, ['alpha'], "the brand's own settings, not the companion's");
    assert.deepEqual(index.assets.map(a => a.id), [
      'x/tokens/brand', 'shared/sample',
      'y/tokens/brand', 'y/logo/primary', 'y/palette/opal-icons', 'y/font/face', 'y/demo/own',
      'community/emoji/set',
    ]);
    assert.deepEqual(assetIndexFiles(roots), [
      join(root, 'brands/x/catalog/assets/index.json'),
      join(root, 'brands/y/catalog/assets/index.json'),
      join(root, 'community/emoji-packs/index.json'),
    ]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test("a row the brand has stays the brand's, with the brand's bytes", () => {
  const root = fixture();
  try {
    const roots = contentRoots({ root, profile: 'x-with-y' });
    const sample = readAssetIndex(roots).assets.filter(a => a.id === 'shared/sample');
    assert.equal(sample.length, 1, 'one row, not two');
    assert.equal(catalogFile('assets/shared/sample.svg', roots), join(root, 'brands/x/catalog/assets/shared/sample.svg'));
    assert.equal(readFileSync(contentUrlFile('/catalog/assets/shared/sample.svg', roots)!, 'utf8'), '<svg id="x"/>\n');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a mounted row travels with its recorded terms and drops to on-demand', () => {
  const root = fixture();
  try {
    const roots = contentRoots({ root, profile: 'x-with-y' });
    const logo = readAssetIndex(roots).assets.find(a => a.id === 'y/logo/primary') as unknown as { license: string; rights: unknown; tier: string };
    assert.equal(logo.license, 'LicenseRef-Y-Marks');
    assert.deepEqual(logo.rights, { works: [{ id: 'y/logo/primary' }] });
    assert.equal(logo.tier, 'on-demand', "a first load on the brand's own system does not fetch a system it may never open");
    const brand = readAssetIndex(roots).assets.find(a => a.id === 'x/tokens/brand') as unknown as { tier: string };
    assert.equal(brand.tier, 'core', "the brand's own rows keep their tier");
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('only the named rows and their files come across, and the packs are not rewritten', () => {
  const root = fixture();
  const dest = mkdtempSync(join(tmpdir(), 'lolly-companions-out-'));
  try {
    const roots = contentRoots({ root, profile: 'x-with-y' });
    const brandBefore = readFileSync(join(root, 'brands/x/catalog/assets/index.json'), 'utf8');
    const companionBefore = readFileSync(join(root, 'brands/y/catalog/assets/index.json'), 'utf8');
    materializeInto(dest, roots);
    const has = (rel: string): boolean => existsSync(join(dest, 'catalog', rel));
    for (const rel of ['assets/x/brand.json', 'assets/y/brand.json', 'assets/y/logo.svg', 'assets/y/icons.json', 'fonts/Face.ttf', 'fonts/OFL-Face.txt', 'assets/y/own.svg', 'packs/emoji-packs/set.json']) {
      assert.ok(has(rel), `${rel} is in the mount`);
    }
    for (const rel of ['assets/y/old.json', 'assets/y/riso.json', 'assets/y/skill.md', 'assets/y/one.mp3', 'og/card.png', 'previews/card.svg', 'renditions/index.json']) {
      assert.ok(!has(rel), `${rel} stays behind`);
    }
    assert.equal(readFileSync(join(dest, 'catalog/assets/shared/sample.svg'), 'utf8'), '<svg id="x"/>\n');
    const served = JSON.parse(readFileSync(join(dest, 'catalog/assets/index.json'), 'utf8')) as { brandTokens: string; assets: { id: string }[] };
    assert.equal(served.brandTokens, 'x/tokens/brand');
    assert.ok(served.assets.some(a => a.id === 'y/logo/primary'));
    assert.equal(readFileSync(join(root, 'brands/x/catalog/assets/index.json'), 'utf8'), brandBefore);
    assert.equal(readFileSync(join(root, 'brands/y/catalog/assets/index.json'), 'utf8'), companionBefore);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(dest, { recursive: true, force: true });
  }
});

test('a profile without companions reads and builds exactly as it did', () => {
  const root = fixture();
  const a = mkdtempSync(join(tmpdir(), 'lolly-companions-a-'));
  const b = mkdtempSync(join(tmpdir(), 'lolly-companions-b-'));
  try {
    const plain = contentRoots({ root, profile: 'x' });
    assert.equal(plain.companions, undefined);
    assert.equal(plain.brandTokens, undefined);
    assert.equal(companionFiles(plain).size, 0);
    assert.deepEqual(readBrandAssetIndex(plain), JSON.parse(readFileSync(join(root, 'brands/x/catalog/assets/index.json'), 'utf8')));
    assert.equal('companionDesignSystems' in readAssetIndex(plain), false);
    assert.equal(catalogFile('assets/y/logo.svg', plain), join(root, 'brands/x/catalog/assets/y/logo.svg'), 'no fall through to another pack');
    materializeInto(a, plain);
    // Taking the companion profile out of profiles.json changes nothing for this one.
    const profiles = JSON.parse(readFileSync(join(root, 'profiles.json'), 'utf8')) as { profiles: Record<string, unknown> };
    delete profiles.profiles['x-with-y'];
    write(join(root, 'profiles.json'), json(profiles));
    materializeInto(b, contentRoots({ root, profile: 'x' }));
    assert.equal(treeHash(b), treeHash(a));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(a, { recursive: true, force: true });
    rmSync(b, { recursive: true, force: true });
  }
});

test('nothing crosses the other way: the companion pack gains nothing from the profile that mounts it', () => {
  const root = fixture();
  try {
    const companionSide = readAssetIndex(contentRoots({ root, profile: 'y' }));
    assert.ok(companionSide.assets.every(a => !a.id.startsWith('x/')));
    assert.equal(companionSide.brandTokens, 'y/tokens/brand');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('one url never serves two files: a path the brand holds with other bytes is refused', () => {
  const root = fixture();
  try {
    write(join(root, 'brands/x/catalog/assets/y/logo.svg'), '<svg id="clash"/>\n');
    const roots = contentRoots({ root, profile: 'x-with-y' });
    assert.throws(() => companionFiles(roots), /one url cannot serve both/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('the same bytes at the same path is no clash', () => {
  const root = fixture();
  try {
    write(join(root, 'brands/x/catalog/assets/y/logo.svg'), 'assets/y/logo.svg\n');
    assert.ok(companionFiles(contentRoots({ root, profile: 'x-with-y' })).has('assets/y/logo.svg'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('a profile whose companion pack is not on disk is incomplete, like any other missing pack', () => {
  const root = fixture();
  try {
    rmSync(join(root, 'brands/y'), { recursive: true, force: true });
    assert.throws(() => contentRoots({ root, profile: 'x-with-y' }), /missing: brands\/y\/catalog/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
