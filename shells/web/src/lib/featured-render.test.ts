// SPDX-License-Identifier: MPL-2.0
/**
 * Gallery, featured and template previews over the one preview store (plan 373):
 * a look is found by its recipe, so a hit needs no render and no build-time
 * artwork, two views asking for one look share one render, and a picture drawn
 * while the brand changed is not kept.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { renderFeaturedVariant, renderMissingLook, isManifestLook, previewSeams, lookRecipe, storedFeaturedVariant, checkLookStore } from './featured-render.ts';

const VALUES = { headline: 'demo' };
let tokenValue = '#0c322c';
const host = {
  tokens: { get: async () => ({ query: () => [{ path: 'color.brand', type: 'color', value: tokenValue }] }), active: async () => ({ id: 'demo' }), colors: async () => [] },
  profile: { get: async () => ({}) },
} as unknown as Parameters<typeof renderFeaturedVariant>[0];

function fakeStore() {
  const kept = new Map<string, string>();
  const calls = { cached: 0, renders: 0, stored: 0 };
  const real = { ...previewSeams };
  previewSeams.cached = async (key) => { calls.cached++; return kept.get(key) ?? null; };
  previewSeams.store = async (key, picture) => { calls.stored++; const src = `data:${picture.ref.type},stored`; kept.set(key, src); return src; };
  previewSeams.render = async () => {
    calls.renders++;
    await new Promise(r => setTimeout(r, 5));
    const bytes = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>');
    return { ref: { key: 'f'.repeat(32), type: 'image/svg+xml', width: 10, height: 10, route: 'export-svg' }, bytes };
  };
  return { kept, calls, restore: () => Object.assign(previewSeams, real) };
}

test('isManifestLook: a data URL cannot fail after it is set; a manifest file or an object URL can', () => {
  assert.equal(isManifestLook('/catalog/previews/covers/demo.light.webp'), true);
  assert.equal(isManifestLook('blob:http://localhost/abc'), true, 'an object URL can be revoked, so it keeps the error path');
  assert.equal(isManifestLook('data:image/svg+xml,<svg/>'), false);
});

test('a miss renders once and stores; a hit renders nothing and fetches no build-time artwork', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new Error('Unexpected build-time preview request'); });
  const store = fakeStore();
  try {
    const first = await renderFeaturedVariant(host, 'demo', ['svg'], 0, VALUES);
    assert.equal(store.calls.renders, 1);
    assert.equal(store.calls.stored, 1);
    const again = await renderFeaturedVariant(host, 'demo', ['svg'], 0, VALUES);
    assert.equal(again, first);
    assert.equal(store.calls.renders, 1, 'a hit draws nothing');
    // The same look asked for by another view (a template preview, the missing-look
    // retry) is the same recipe: one entry, no second render.
    assert.equal(await renderMissingLook(host, 'demo', ['svg'], 0, VALUES), first);
    assert.equal(await renderFeaturedVariant(host, 'demo', ['svg'], 'tpl-1', VALUES, 'template'), first);
    assert.equal(store.calls.renders, 1);
  } finally { store.restore(); }
});

test('two views asking for one look at once share one render', async () => {
  const store = fakeStore();
  try {
    const [a, b] = await Promise.all([
      renderFeaturedVariant(host, 'demo', ['svg'], 0, { headline: 'shared' }),
      renderFeaturedVariant(host, 'demo', ['svg'], 0, { headline: 'shared' }, 'gallery@1'),
    ]);
    assert.equal(a, b);
    assert.equal(store.calls.renders, 1);
  } finally { store.restore(); }
});

test('a picture drawn while the brand changed is not kept, and the recipe follows the brand', async () => {
  const store = fakeStore();
  try {
    const before = (await lookRecipe(host, 'demo', { headline: 'brand' })).key;
    previewSeams.render = async () => {
      tokenValue = '#ff0000';
      return { ref: { key: 'e'.repeat(32), type: 'image/svg+xml', width: 1, height: 1 }, bytes: new TextEncoder().encode('<svg/>') };
    };
    await assert.rejects(renderFeaturedVariant(host, 'demo', ['svg'], 0, { headline: 'brand' }), /brand changed/);
    assert.equal(store.calls.stored, 0);
    assert.notEqual((await lookRecipe(host, 'demo', { headline: 'brand' })).key, before);
  } finally { store.restore(); tokenValue = '#0c322c'; }
});

test('reading a stored look never draws: a miss is null, a hit is the picture the draw stored', async () => {
  const store = fakeStore();
  try {
    assert.equal(await storedFeaturedVariant(host, 'demo', ['svg'], { headline: 'read' }), null, 'nothing stored yet');
    assert.equal(store.calls.renders, 0, 'a read never renders, so no tool code loads for it');
    const drawn = await renderFeaturedVariant(host, 'demo', ['svg'], 0, { headline: 'read' });
    assert.equal(await storedFeaturedVariant(host, 'demo', ['svg'], { headline: 'read' }), drawn, 'same recipe as the draw');
    assert.equal(await storedFeaturedVariant(host, 'demo', ['svg'], { headline: 'read' }, 'gallery@1'), drawn, 'a plain label is not part of the recipe');
    assert.equal(await storedFeaturedVariant(host, 'demo', ['pptx'], { headline: 'read' }), null, 'no displayable format');
    assert.equal(store.calls.renders, 1);
  } finally { store.restore(); }
});

test('a store with no look at all answers a read at once, without looking anything up', async () => {
  const store = fakeStore();
  const real = previewSeams.empty;
  try {
    previewSeams.empty = async () => true;
    checkLookStore();
    assert.equal(await storedFeaturedVariant(host, 'demo', ['svg'], { headline: 'first visit' }), null);
    assert.equal(store.calls.cached, 0, 'no store lookup on a first visit');
    previewSeams.empty = async () => false;
    checkLookStore();
    await storedFeaturedVariant(host, 'demo', ['svg'], { headline: 'later visit' });
    assert.equal(store.calls.cached, 1, 'a store with looks in it is read');
  } finally { previewSeams.empty = async () => false; checkLookStore(); previewSeams.empty = real; store.restore(); }
});
