// SPDX-License-Identifier: MPL-2.0
/**
 * What a cached preview is keyed by (plan 373, lib/preview-recipe.ts): equal
 * recipes give equal keys whatever their key order, any fact that changes the
 * render changes the key, and the design-system context is the baked covers' own
 * hash, computed once per token set rather than once per tile.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/preview-recipe.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const recipe = await import('./preview-recipe.ts');
const { coverContextHash } = await import('./gallery-covers.ts');

function host(tokens: Array<{ path: string; type: string; value: unknown }>) {
  const set = { query: () => tokens.map(t => ({ ...t })) };
  let profile: Record<string, unknown> = {};
  return {
    tokens: { get: async () => set, active: async () => ({ id: 'demo' }), colors: async () => ['#0c322c'] },
    profile: { get: async () => profile, set: (p: Record<string, unknown>) => { profile = p; } },
  } as unknown as Parameters<typeof recipe.previewContextDigest>[0] & { profile: { set(p: Record<string, unknown>): void } };
}

test('the recipe key is canonical: key order does not matter, every fact that changes the render does', async () => {
  const base = { tool: 'poster', version: '2.1.0', values: { title: 'Hi', size: 3 }, context: 'a'.repeat(32) };
  const key = await recipe.previewRecipeKey(base);
  assert.match(key, /^[0-9a-f]{32}$/);
  assert.equal(await recipe.previewRecipeKey({ context: base.context, values: { size: 3, title: 'Hi' }, version: '2.1.0', tool: 'poster' }), key);
  for (const changed of [{ ...base, version: '2.2.0' }, { ...base, values: { title: 'Ho', size: 3 } }, { ...base, context: 'b'.repeat(32) },
    { ...base, colourway: { brand: 'night' } }, { ...base, frame: 1200 }, { ...base, size: { width: 300, height: 600 } }]) {
    assert.notEqual(await recipe.previewRecipeKey(changed), key, JSON.stringify(changed).slice(0, 60));
  }
  assert.equal(recipe.RECIPE_VERSION, 4);
});

test("the context digest is the baked covers' hash, and is computed once per token set", async () => {
  const h = host([{ path: 'color.brand', type: 'color', value: '#0c322c' }]);
  const signature = await recipe.previewContextSignature(h);
  const digest = await recipe.previewContextDigest(h);
  assert.equal(digest, await coverContextHash(signature), 'one function, so the baked manifest and the store agree');
  const before = recipe.contextDigestComputations();
  for (let i = 0; i < 70; i++) await recipe.previewContextDigest(h);
  assert.equal(recipe.contextDigestComputations(), before, 'a gallery paint of 70 tiles computes it no more times');
  h.profile.set({ useDetails: true, firstname: 'Ada' });
  assert.notEqual(await recipe.previewContextDigest(h), digest, 'opted-in details change it');
});

test('profileSignature is empty until the person opts in', () => {
  assert.equal(recipe.profileSignature(null), '');
  assert.equal(recipe.profileSignature({ firstname: 'Ada' } as never), '');
  assert.equal(recipe.profileSignature({ useDetails: true, firstname: 'Ada' } as never), JSON.stringify(['Ada', '', '', '', '', '']));
});
