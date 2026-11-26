// SPDX-License-Identifier: MPL-2.0
/**
 * One number for each kind of material (counts.ts), and the Board and the rooms
 * reading the same one (plan 346, change 5). Lolly Demo used to show 99 tokens
 * and three typefaces on the Board and 101 and four in the Tokens room.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/counts.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'http://localhost/#/start', pretendToBeVisual: true });
const original = new Map<string, PropertyDescriptor | undefined>();
const setGlobal = (key: string, value: unknown): void => {
  original.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
};
for (const key of ['window', 'document', 'HTMLElement', 'Element', 'Node', 'getComputedStyle', 'location', 'localStorage', 'CustomEvent', 'Event', 'navigator', 'history', 'requestAnimationFrame', 'cancelAnimationFrame', 'MutationObserver']) {
  setGlobal(key, (dom.window as unknown as Record<string, unknown>)[key]);
}
(dom.window as unknown as { matchMedia: unknown }).matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
setGlobal('matchMedia', (dom.window as unknown as { matchMedia: unknown }).matchMedia);
after(() => {
  for (const [key, desc] of original) { if (desc) Object.defineProperty(globalThis, key, desc); else delete (globalThis as Record<string, unknown>)[key]; }
  dom.window.close();
});

const { colourCount, designFiles, fileName, tokenCount, typefaceCount } = await import('./counts.ts');
const { starterColorIds } = await import('./ownership.ts');
const { tokensRoomModel } = await import('../brand-studio-tabs.ts');
const { readOverview } = await import('./rooms/overview.ts');

const DEMO = JSON.parse(readFileSync(new URL('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8')) as Record<string, unknown>;
const STARTER = JSON.parse(readFileSync(new URL('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8')) as Record<string, unknown>;

/** The starter document with one colour of the person's own, and one gradient. */
function oneColourOver(starter: Record<string, unknown>): Record<string, unknown> {
  const doc = structuredClone(starter) as { color?: Record<string, unknown> };
  doc.color = { ...(doc.color ?? {}), custom: { mine: { $type: 'color', $value: '#2f6fde' } } };
  (doc as Record<string, unknown>).gradient = { sunrise: { $type: 'gradient', $value: [{ color: '#2f6fde', position: 0 }, { color: '#ffc914', position: 1 }] } };
  return doc as Record<string, unknown>;
}

// ── The counts themselves ────────────────────────────────────────────────────

test('tokens: every token the document defines, as the Tokens room lists them', () => {
  // 101 until Lolly Demo declared its colour roles (plans/352 R6), then 111 until a role's
  // values in each colourway counted with the role (colour-role-copies.ts).
  assert.equal(tokenCount(DEMO), 97, 'Lolly Demo: the number its Tokens room shows');
  assert.equal(tokenCount(null), 0);
  assert.equal(tokenCount('not a document'), 0);
  assert.equal(tokenCount({ color: { a: { $type: 'color', $value: '#000000' } } }), 1);
});

test('typefaces: a family serving two roles is one typeface', () => {
  const count = typefaceCount(DEMO);
  assert.equal(count.shown, 3, 'SUSE (text and emphasis), Outfit and SUSE Mono');
  assert.equal(count.own, 0, 'nothing is installed on this device');
  assert.deepEqual(typefaceCount(DEMO, ['suse', 'Outfit ']), { own: 2, rest: 1, shown: 2 }, 'installed families are matched without case or stray space');
});

test('colours: roles and gradients are not colours, and the starter is told apart', () => {
  const doc = oneColourOver(STARTER);
  const starter = starterColorIds(STARTER);
  const count = colourCount(doc, starter);
  assert.equal(count.own, 1, 'one colour of the person\'s own; the gradient and the roles add nothing');
  assert.ok(count.rest > 0, 'the starter\'s colours are the rest');
  assert.equal(count.shown, 1, 'the own count is what a room shows');
  assert.deepEqual(colourCount(STARTER, starter), { own: 0, rest: count.rest, shown: count.rest }, 'never zero over colours that are there');
  assert.equal(colourCount(DEMO).shown, 41, 'Lolly Demo\'s palette');
});

test('files: the uploads Files lists, never the system\'s own material', () => {
  const refs = [
    { id: 'user/uploads/3', type: 'raster', meta: { name: 'hero.jpg' } },
    { id: 'user/fonts/inter', type: 'font' },
    { id: 'user/logo/horizontal-primary', type: 'vector' },
    { id: 'user/uploads/2', type: 'vector' },
    { id: 'user/uploads/1', type: 'document' },
  ];
  const files = designFiles(refs);
  assert.deepEqual(files.map(f => f.id), ['user/uploads/3', 'user/uploads/2']);
  assert.equal(fileName(files[0]!), 'hero.jpg');
  assert.equal(fileName(files[1]!), '2', 'an upload with no name reads as the last part of its id');
});

// ── The Board and the rooms agree ────────────────────────────────────────────

/** A host that answers the Board's reads from one document. */
function hostFor(doc: Record<string, unknown>, starter: Record<string, unknown>, uploads: Array<{ id: string; type: string; meta?: Record<string, unknown> }> = []) {
  return {
    assets: {
      _findMetaByType: async (type: string) => (type === 'tokens' ? { id: 'user/tokens/brand' } : null),
      _exportUserAssets: async () => [],
      _listUserAssets: async () => uploads,
      _getBlob: async (id: string) => (id === 'lolly/tokens/brand' ? { text: async () => JSON.stringify(starter) } as unknown as Blob : null),
    },
    tokens: {
      colors: async () => [],
      raw: async () => doc,
      resolve: async () => '',
    },
  } as unknown as Parameters<typeof readOverview>[0];
}

for (const [name, doc] of [
  ['Lolly Demo', DEMO],
  ['the blank starter', STARTER],
  ['one colour and a gradient over the starter', oneColourOver(STARTER)],
] as const) {
  test(`the Board's counts are the Tokens room's: ${name}`, async () => {
    const starter = starterColorIds(STARTER);
    const room = tokensRoomModel(doc, starter, []);
    const board = await readOverview(hostFor(doc, STARTER));
    assert.equal(board.tokenCount, room.counts.all, 'tokens');
    assert.equal(board.colours?.shown, room.counts.color || room.starter.color, 'colours');
    assert.equal(board.typefaces?.shown, room.counts.type || room.starter.type, 'typefaces');
  });
}

test('the Board\'s file count is the Files room\'s', async () => {
  const uploads = [
    { id: 'user/uploads/2', type: 'raster', meta: { name: 'newest.png' } },
    { id: 'user/fonts/inter', type: 'font' },
    { id: 'user/uploads/1', type: 'audio' },
  ];
  const board = await readOverview(hostFor(DEMO, STARTER, uploads));
  assert.equal(board.fileCount, designFiles(uploads).length);
  assert.equal(board.newestFile, 'newest.png', 'the store lists newest first, and the card names that one');
});
