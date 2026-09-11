// SPDX-License-Identifier: MPL-2.0
/**
 * The Projects spotlight provider (plans/99 section 2b) over a fake state.list +
 * folder store: folder hits (name → #/p/<id>), session hits (shared haystack,
 * tool-name + folder-path subtitle, the projects tile's open href), the
 * 'batch' keyword, ranking + limit, and the short-lived load cache (one
 * profile/state read per burst).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/search/providers/projects.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

// jsdom globals BEFORE the dynamic import (the co-located suite convention).
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.sessionStorage = dom.window.sessionStorage;

// Tool display names come off the synced index.
(window as unknown as { __toolIndex?: unknown }).__toolIndex = {
  tools: [{ id: 'qr-code', name: 'QR Code' }],
};

const { createProjectsProvider } = await import('./projects.ts');
const { tokenize } = await import('../match.ts');

const folders = [
  { id: 'f1', name: 'Événement', parentId: null, items: [{ type: 'session' as const, ref: 's1' }], createdAt: '2026-01-01', updatedAt: '2026-01-02' },
  { id: 'f2', name: 'Posters', parentId: 'f1', items: [], createdAt: '2026-01-01', updatedAt: '2026-01-02' },
];
let profileReads = 0;
let stateReads = 0;
const host = {
  profile: {
    get: async () => { profileReads++; return { folders }; },
    set: async () => ({}),
  },
  assets: { _listUserAssets: async () => [] },
  state: {
    list: async () => {
      stateReads++;
      return [
        { slot: 's1', toolId: 'qr-code', label: 'Badge run' },
        { slot: 's2', toolId: 'qr-code', label: null, filename: 'poster-a1' },
        { slot: '__batch__:Q3 assets', toolId: '', label: '' },
      ];
    },
  },
};

const provider = createProjectsProvider(host);

test('folder hits: folded name match, #/p/<id> href, Project subtitle', async () => {
  const hits = await provider.search(tokenize('evenement'), 8);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.href, '#/p/f1');
  assert.equal(hits[0]!.title, 'Événement');
  assert.equal(hits[0]!.subtitle, 'Project');
  assert.ok(hits[0]!.icon.includes('<svg'));
});

test('session hits: shared open href, tool-name + folder-path subtitle', async () => {
  const hits = await provider.search(tokenize('badge'), 8);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.href, '#/tool/qr-code?slot=s1');
  assert.equal(hits[0]!.title, 'Badge run');
  assert.equal(hits[0]!.subtitle, 'QR Code · Événement');
});

test('a loose session (no folder) subtitles with the tool name alone; filename titles a label-less row', async () => {
  const hits = await provider.search(tokenize('poster-a1'), 8);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.title, 'poster-a1');
  assert.equal(hits[0]!.subtitle, 'QR Code');
});

test("the 'batch' keyword surfaces batch sessions, opening in /pro", async () => {
  const hits = await provider.search(tokenize('batch'), 8);
  assert.equal(hits.length, 1);
  assert.ok(hits[0]!.href.startsWith('#/batch?session=__batch__%3A'));
  assert.equal(hits[0]!.title, 'Saved session'); // no label/filename, no tool id
});

test('token-AND spans fields; ranking is best-first; limit slices', async () => {
  // 'qr badge' - both tokens must hit (tool name + label) on s1 only.
  const both = await provider.search(tokenize('qr badge'), 8);
  assert.deepEqual(both.map((h) => h.href), ['#/tool/qr-code?slot=s1']);
  // A broad single-letter query matches several; the cap holds.
  const capped = await provider.search(tokenize('e'), 1);
  assert.equal(capped.length, 1);
});

test('the load cache holds for a burst: one profile + state read across calls', async () => {
  const p = profileReads;
  const s = stateReads;
  await provider.search(tokenize('badge'), 8);
  await provider.search(tokenize('poster'), 8);
  assert.equal(profileReads, p); // still cached from the earlier tests' first load
  assert.equal(stateReads, s);
});

test('a failing host yields empty, never a throw', async () => {
  const broken = createProjectsProvider({
    profile: { get: async () => { throw new Error('down'); }, set: async () => ({}) },
    assets: { _listUserAssets: async () => [] },
    state: { list: async () => { throw new Error('down'); } },
  });
  assert.deepEqual(await broken.search(tokenize('badge'), 8), []);
});
