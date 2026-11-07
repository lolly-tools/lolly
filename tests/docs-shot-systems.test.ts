// SPDX-License-Identifier: MPL-2.0
/**
 * Fixture design systems for docs screenshots (scripts/lib/shot-systems.ts).
 *
 * A recipe with `system=<name>` installs a fixture before its route loads, so the shot
 * shows that system instead of the pinned lolly-demo brand. Every shot is published, so
 * each fixture must be public material that a plain clone has, and every recipe must
 * name a fixture that exists.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { omitTokenPaths, readShotSystems, shotSystem } from '../scripts/lib/shot-systems.ts';
import { parseShotRecipes } from '../scripts/lib/shot-compare.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const systems = readShotSystems(ROOT);

test('every fixture is a public token file a plain clone has, with a label', () => {
  assert.ok(Object.keys(systems).length > 0);
  for (const [name, entry] of Object.entries(systems)) {
    assert.match(name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, name);
    assert.ok(!entry.file.startsWith('brands/suse'), `${name}: the SUSE pack is private and absent from a public clone`);
    assert.ok(existsSync(join(ROOT, entry.file)), `${name}: ${entry.file} is missing`);
    assert.ok(entry.label.trim(), `${name}: needs a label for the studio's bar`);
    const { doc, label } = shotSystem(ROOT, name);
    assert.equal(label, entry.label);
    // A fixture that pointed a slot at a brand pack's asset would publish that asset.
    assert.ok(!/"suse\//.test(JSON.stringify(doc)), `${name}: refers to a SUSE asset`);
    for (const path of entry.omit ?? []) {
      let node: unknown = doc;
      for (const key of path.split('.')) node = node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined;
      assert.equal(node, undefined, `${name}: ${path} was meant to be left out`);
    }
  }
});

test('the new design system fixture is the starter with no logos', () => {
  const { doc } = shotSystem(ROOT, 'new-design-system');
  const starter = JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json'), 'utf-8'));
  assert.ok(starter.base.asset.logo, 'the starter carries logo slots, which this fixture drops');
  assert.deepEqual(doc, omitTokenPaths(starter, ['base.asset']));
});

test('an unknown fixture, a path outside the repository and the private pack are refused', () => {
  assert.throws(() => shotSystem(ROOT, 'no-such-system'), /not a fixture design system/);
  assert.throws(() => shotSystem(ROOT, 'constructor'), /not a fixture design system/, 'an inherited key is not a fixture');
  const root = mkdtempSync(join(tmpdir(), 'shot-systems-'));
  try {
    mkdirSync(join(root, 'scripts', 'data'), { recursive: true });
    writeFileSync(join(root, 'scripts', 'data', 'shot-systems.json'), JSON.stringify({ systems: {
      outside: { file: '../elsewhere.tokens.json', label: 'Outside' },
      private: { file: 'brands/suse/catalog/assets/suse/tokens/brand.json', label: 'Private' },
    } }));
    assert.throws(() => shotSystem(root, 'outside'), /public file inside this repository/);
    assert.throws(() => shotSystem(root, 'private'), /public file inside this repository/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('omitTokenPaths drops a group and leaves the rest and the input alone', () => {
  const doc = { base: { asset: { logo: { a: 1 } }, color: { x: 1 } }, light: {} };
  const out = omitTokenPaths(doc, ['base.asset', 'missing.path']);
  assert.deepEqual(out, { base: { color: { x: 1 } }, light: {} });
  assert.ok(doc.base.asset, 'the input is not changed');
});

test('every system= in the English docs is a listed fixture', () => {
  const used = new Set<string>();
  for (const f of readdirSync(join(ROOT, 'docs')).filter((n) => n.endsWith('.md'))) {
    for (const r of parseShotRecipes(readFileSync(join(ROOT, 'docs', f), 'utf-8')).recipes) {
      if (!r.system) continue;
      used.add(r.system);
      assert.ok(Object.hasOwn(systems, r.system), `${f}: ${r.slug} names system=${r.system}`);
    }
  }
  assert.ok(used.size > 0, 'no recipe uses a fixture, so this registry has no reader');
});
