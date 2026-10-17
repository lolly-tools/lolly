// SPDX-License-Identifier: MPL-2.0
/**
 * tokens-head.test.ts - the design system an asset index offers, and the rename of
 * Lolly Demo's tokens asset from lolly/tokens/opal to lolly/tokens/demo.
 *
 * Run directly:  node --test tests/tokens-head.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tokensHeadProblems, type TokensIndexLike } from '../scripts/lib/tokens-head.ts';
import { pickHeadAssetId } from '../engine/src/design-version.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DEMO_INDEX = join(ROOT, 'brands/lolly-demo/catalog/assets/index.json');

interface Format { format: string; url: string; checksum?: string; size?: number }
interface Asset { id: string; type?: string; tags?: string[]; deprecated?: boolean; replacedBy?: string; formats?: Format[] }
const readIndex = (path: string): { brandTokens?: unknown; assets: Asset[] } => JSON.parse(readFileSync(path, 'utf8'));
const tokens = (id: string, extra: Partial<Asset> = {}): Asset => ({ id, type: 'tokens', tags: ['tokens'], ...extra });
const one = (index: TokensIndexLike, pattern: RegExp): void => {
  const problems = tokensHeadProblems(index);
  assert.equal(problems.length, 1, problems.join('\n'));
  assert.match(problems[0]!, pattern);
};

test('one tokens asset needs nothing declared, and published versions are not rival design systems', () => {
  assert.deepEqual(tokensHeadProblems({ assets: [tokens('acme/tokens/brand', { tags: ['brand'] })] }), []);
  assert.deepEqual(tokensHeadProblems({ assets: [tokens('acme/tokens/brand'), tokens('acme/tokens/brand/jupiter')] }), []);
  assert.deepEqual(tokensHeadProblems({ assets: [{ id: 'acme/logo/primary', type: 'vector' }] }), []);
});

test('a renamed design system lists its replacement first, declares it and keeps the brand tag off the alias', () => {
  const head = tokens('acme/tokens/new', { tags: ['tokens', 'brand'] });
  const alias = tokens('acme/tokens/old', { deprecated: true, replacedBy: 'acme/tokens/new' });
  assert.deepEqual(tokensHeadProblems({ brandTokens: head.id, assets: [head, alias] }), []);
  one({ brandTokens: head.id, assets: [alias, head] }, /first tokens asset in index order, "acme\/tokens\/old", is deprecated/);
  one({ brandTokens: head.id, assets: [head, { ...alias, tags: ['brand'] }] }, /still carries the "brand" tag/);
  one({ brandTokens: alias.id, assets: [head, alias] }, /brandTokens "acme\/tokens\/old" is deprecated/);
  one({ brandTokens: head.id, assets: [head, { ...alias, replacedBy: 'acme/logo/primary' }] }, /not a tokens asset/);
});

test('two live design systems need brandTokens, and every reader has to agree with it', () => {
  const a = tokens('acme/tokens/a', { tags: ['brand'] });
  const b = tokens('acme/tokens/b', { tags: ['brand'] });
  one({ assets: [a, b] }, /2 independent tokens assets .* no brandTokens/);
  const problems = tokensHeadProblems({ brandTokens: b.id, assets: [a, b] });
  assert.equal(problems.length, 2, problems.join('\n'));
  assert.match(problems[0]!, /index order is "acme\/tokens\/a", not "acme\/tokens\/b"/);
  assert.match(problems[1]!, /tagged "brand" is "acme\/tokens\/a", not "acme\/tokens\/b"/);
  // null declares a neutral catalogue, so there is nothing for order or tags to agree with.
  assert.deepEqual(tokensHeadProblems({ brandTokens: null, assets: [a, b] }), []);
});

test('brandTokens has to point at a design system this index ships', () => {
  one({ brandTokens: 'acme/tokens/gone', assets: [tokens('acme/tokens/brand')] }, /is not a tokens asset in this index/);
  one({ brandTokens: 'acme/tokens/brand/jupiter', assets: [tokens('acme/tokens/brand'), tokens('acme/tokens/brand/jupiter')] }, /is a published version/);
  one({ brandTokens: 7, assets: [tokens('acme/tokens/brand')] }, /must be a tokens asset id, or null/);
});

test('Lolly Demo ships as lolly/tokens/demo with lolly/tokens/opal kept as a deprecated alias', () => {
  const index = readIndex(DEMO_INDEX);
  assert.equal(index.brandTokens, 'lolly/tokens/demo');
  const all = index.assets.filter(asset => asset.type === 'tokens');
  assert.deepEqual(all.map(asset => asset.id), ['lolly/tokens/demo', 'lolly/tokens/opal']);
  const [demo, opal] = all as [Asset, Asset];
  assert.equal(demo.deprecated, undefined);
  assert.ok(demo.tags?.includes('brand'));
  assert.equal(opal.deprecated, true);
  assert.equal(opal.replacedBy, 'lolly/tokens/demo');
  assert.ok(!opal.tags?.includes('brand'));
  // One file answers both ids, so the alias can never drift from the design system.
  assert.deepEqual(opal.formats, demo.formats);
  const format = demo.formats![0]!;
  assert.equal(format.url, '/catalog/assets/lolly/tokens/demo.json');
  const bytes = readFileSync(join(ROOT, 'brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'));
  assert.equal(format.checksum, `sha256-${createHash('sha256').update(bytes).digest('base64')}`);
  assert.equal(existsSync(join(ROOT, 'brands/lolly-demo/catalog/assets/lolly/tokens/opal.json')), false);
  // Every reader picks the same asset: index order, the brand tag and a
  // query, which leaves deprecated assets out (host.assets.query on web and Node).
  assert.equal(pickHeadAssetId(all.map(asset => asset.id)), 'lolly/tokens/demo');
  assert.equal(all.find(asset => asset.tags?.includes('brand'))?.id, 'lolly/tokens/demo');
  assert.deepEqual(all.filter(asset => asset.deprecated !== true).map(asset => asset.id), ['lolly/tokens/demo']);
  assert.deepEqual(tokensHeadProblems(index), []);
});

test('every brand pack on disk offers one unambiguous design system', () => {
  const brands = readdirSync(join(ROOT, 'brands'), { withFileTypes: true }).filter(entry => entry.isDirectory());
  const checked: string[] = [];
  for (const brand of brands) {
    const path = join(ROOT, 'brands', brand.name, 'catalog/assets/index.json');
    if (!existsSync(path)) continue; // brands/suse is absent from a public clone
    assert.deepEqual(tokensHeadProblems(readIndex(path)), [], brand.name);
    checked.push(brand.name);
  }
  assert.ok(checked.includes('lolly-demo') && checked.includes('lolly-start'), checked.join(', '));
});
