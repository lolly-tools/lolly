// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly Demo beside SUSE: the `suse-with-demo` profile on the real packs.
 *
 * The public half runs everywhere, including a public clone: no profile a public clone can
 * build mounts anything private, and the direction is one way. The SUSE half needs the
 * private pack and skips by name where it is absent, so a green run on a public clone says
 * nothing about it (run it with brands/suse checked out).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';

import {
  companionFiles, contentRoots, materializeInto, readAssetIndex, readBrandAssetIndex,
} from '../packages/node-shell/src/content-roots.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { assetPathProblems } from '../scripts/lib/catalog-asset-paths.ts';
import { tokensHeadProblems } from '../scripts/lib/tokens-head.ts';

const ROOT = repoRoot();
const PROFILES = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as {
  default: string; profiles: Record<string, { catalog: string; tools: string[]; companions?: { catalog: string; tokens: string; assets: string[] }[] }>;
};
const PUBLIC = ['lolly-start', 'lolly-demo'];
const HAS_SUSE = existsSync(join(ROOT, 'brands/suse/catalog/assets/index.json'));

function walk(dir: string, out: string[] = [], base = dir): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out, base);
    else out.push(relative(base, path));
  }
  return out;
}

test('SUSE stays the default, and only one profile mounts a companion', () => {
  assert.equal(PROFILES.default, 'suse');
  const withCompanions = Object.entries(PROFILES.profiles).filter(([, p]) => p.companions?.length).map(([name]) => name);
  assert.deepEqual(withCompanions, ['suse-with-demo']);
});

test('no profile a public clone can build reads the private pack', () => {
  for (const name of PUBLIC) {
    const profile = PROFILES.profiles[name]!;
    const declared = [profile.catalog, ...profile.tools, ...(profile.companions ?? []).map(c => c.catalog)];
    assert.ok(declared.every(path => !path.startsWith('brands/suse')), `${name} has no path under brands/suse`);
    assert.equal(profile.companions, undefined, `${name} mounts nothing beside itself`);
  }
});

test('no SUSE asset reaches a public profile, by row or by file', () => {
  for (const name of PUBLIC) {
    const roots = contentRoots({ root: ROOT, profile: name });
    const index = readAssetIndex(roots);
    assert.deepEqual(index.assets.filter(a => a.id.startsWith('suse/')).map(a => a.id), [], `${name} index`);
    assert.equal(companionFiles(roots).size, 0, `${name} mounts no companion file`);
    const out = mkdtempSync(join(tmpdir(), `public-${name}-`));
    try {
      materializeInto(out, roots);
      assert.deepEqual(walk(join(out, 'catalog')).filter(path => /(^|\/)suse\//.test(path)), [], `${name} materialized catalog`);
    } finally { rmSync(out, { recursive: true, force: true }); }
  }
});

test('the public indexes stay as committed, with no companion rows merged in', () => {
  for (const name of PUBLIC) {
    const roots = contentRoots({ root: ROOT, profile: name });
    const committed = JSON.parse(readFileSync(join(ROOT, PROFILES.profiles[name]!.catalog, 'assets/index.json'), 'utf8'));
    assert.deepEqual(readBrandAssetIndex(roots), committed);
  }
});

test('what the profile asks for reads as the named families, nothing Plan 353 left out', () => {
  const assets = PROFILES.profiles['suse-with-demo']!.companions![0]!.assets;
  for (const left of ['lolly/tokens/opal', 'lolly/loops/', 'lolly/songs/', 'lolly/modules/', 'lolly/skill/', 'lolly/slides/', 'lolly/3d/', 'lolly/luts/']) {
    assert.ok(!assets.some(name => left.startsWith(name) || name.startsWith(left)), `${left} stays out`);
  }
  // The six sample rows SUSE also holds are not named at all, which is what keeps SUSE's.
  for (const sample of ['lolly-spin', 'sample-photo', 'sample-portrait', 'sample-character', 'sample-wide', 'sample-landscape']) {
    assert.ok(!assets.some(name => `lolly/demo/${sample}`.startsWith(name)), `lolly/demo/${sample} is not named`);
  }
});

test('the merged index holds both design systems and every reader agrees on the head', { skip: HAS_SUSE ? false : 'brands/suse is not checked out' }, () => {
  const roots = contentRoots({ root: ROOT, profile: 'suse-with-demo' });
  const index = readAssetIndex(roots) as unknown as Parameters<typeof tokensHeadProblems>[0] & { assets: { id: string; type?: string; license?: string; tier?: string; rights?: unknown; formats: { url: string }[] }[]; brandTokens: string };
  assert.equal(index.brandTokens, 'suse/tokens/brand');
  assert.deepEqual(index.assets.filter(a => a.type === 'tokens').map(a => a.id), ['suse/tokens/brand', 'lolly/tokens/demo']);
  assert.deepEqual(tokensHeadProblems(index), []);
  assert.deepEqual(assetPathProblems(index as never), []);
});

test("SUSE's rows win the six samples, and every SUSE row comes through unchanged", { skip: HAS_SUSE ? false : 'brands/suse is not checked out' }, () => {
  const suse = readAssetIndex(contentRoots({ root: ROOT, profile: 'suse' }));
  const merged = readAssetIndex(contentRoots({ root: ROOT, profile: 'suse-with-demo' }));
  const byId = new Map(merged.assets.map(a => [a.id, a]));
  for (const row of suse.assets) assert.deepEqual(byId.get(row.id), row, `${row.id} is SUSE's row, untouched`);
  assert.equal(new Set(merged.assets.map(a => a.id)).size, merged.assets.length, 'no id twice');
  const added = merged.assets.filter(a => !suse.assets.some(s => s.id === a.id));
  assert.ok(added.every(a => a.id.startsWith('lolly/')), 'only Lolly rows are added');
  assert.equal(added.filter(a => a.id.startsWith('lolly/icons/')).length, 89);
});

test("Lolly's marks travel with their recorded terms", { skip: HAS_SUSE ? false : 'brands/suse is not checked out' }, () => {
  const merged = readAssetIndex(contentRoots({ root: ROOT, profile: 'suse-with-demo' })) as unknown as { assets: { id: string; license?: string; rights?: { works?: { creators?: { name: string; role: string }[]; grants?: { scope: string }[] }[] } }[] };
  const marks = merged.assets.filter(a => a.id.startsWith('lolly/logo/'));
  assert.equal(marks.length, 7);
  for (const mark of marks) {
    assert.equal(mark.license, 'LicenseRef-Lolly-Marks', mark.id);
    assert.deepEqual(mark.rights?.works?.[0]?.creators, [{ name: 'Andy Fitzsimon', role: 'owner' }], mark.id);
    assert.match(mark.rights?.works?.[0]?.grants?.[0]?.scope ?? '', /belong to Andy Fitzsimon/, mark.id);
  }
});

test('the mount copies a named file set, no audio, skills, slides, renditions, cards or previews', { skip: HAS_SUSE ? false : 'brands/suse is not checked out' }, () => {
  const roots = contentRoots({ root: ROOT, profile: 'suse-with-demo' });
  const files = [...companionFiles(roots).keys()];
  assert.ok(files.includes('assets/lolly/logo/primary.svg'));
  assert.ok(files.includes('assets/lolly/tokens/demo.json'));
  assert.ok(files.includes('fonts/OFL-Outfit.txt'), 'a licence file travels with its font');
  assert.deepEqual(files.filter(path => /^(og|previews|renditions)\//.test(path) || /\/(loops|songs|modules|slides|skills|luts|3d)\//.test(path)), []);
});
