// SPDX-License-Identifier: MPL-2.0
/**
 * apply-look.ts: applying a look replaces the colours and style settings of the
 * open design system and keeps the rest. Over Lolly Demo an example keeps the nine
 * shipped logos (as the same catalog references, never copied), its fonts, its
 * motion and its rules. A saved system is switched to instead (views/start/looks.test.ts).
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-system/apply-look.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deriveBrandTokens } from '@lolly/engine';
import { applyLookDoc } from './apply-look.ts';
import { prepareTokenAdoption } from './adoption-material.ts';
import { listLogos, logoTokensOf } from '../brand-logos.ts';
import { fontGroupOf } from '../../user-fonts.ts';
import { USER_TOKENS_ID } from '../../bridge/tokens.ts';

type Rec = Record<string, any>;
const demo = (): Rec => JSON.parse(readFileSync(new URL('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const orchard = (): Rec => deriveBrandTokens({ primary: '#39734D', name: 'Orchard' }) as Rec;
const ids = (doc: unknown): string[] => logoTokensOf(doc).map(ref => `${ref.variant}=${ref.id}`).sort();

test('an example applied over Lolly Demo keeps its nine logos, its fonts, motion and rules, and takes the colours', () => {
  const current = demo();
  const look = orchard();
  const applied = applyLookDoc(current, look);
  const doc = applied.doc as Rec;
  const { keptRefs } = applied;
  assert.equal(logoTokensOf(doc).length, 9, 'every logo slot is still filled');
  assert.deepEqual(ids(doc), ids(current), 'the same catalog marks, by reference');
  assert.deepEqual(fontGroupOf(doc), fontGroupOf(current), 'the fonts stay');
  assert.deepEqual(doc.base.color, look.base.color, 'the colours are the look\'s');
  assert.deepEqual(doc.$themes, look.$themes, 'and so are its themes: the colourways went with the colours');
  assert.equal(Object.keys(doc).some(k => k.startsWith('colourway/')), false);
  assert.deepEqual(doc.base.motion, current.base.motion, 'a group the look does not define carries over');
  assert.deepEqual(doc.$extensions['com.suse.lolly'].brandSystem, current.$extensions['com.suse.lolly'].brandSystem, 'the rules stay');
  assert.deepEqual(new Set(keptRefs), new Set(logoTokensOf(current).map(ref => ref.id)), 'every mark is kept as a reference');
});

test('the Board and the Logos room list all nine marks of the system a look was applied to', async () => {
  const current = demo();
  const { doc } = applyLookDoc(current, orchard());
  const store = new Map<string, any>([[USER_TOKENS_ID, { id: USER_TOKENS_ID, blob: new Blob([JSON.stringify(doc)]) }]]);
  const catalog = new Map<string, Blob>([['lolly/tokens/demo', new Blob([JSON.stringify(current)])]]);
  for (const ref of logoTokensOf(current)) catalog.set(ref.id, new Blob(['<svg/>'], { type: 'image/svg+xml' }));
  const host = {
    assets: {
      async _uploadUserAsset(record: any) { store.set(record.id, record); },
      async _deleteUserAsset(id: string) { store.delete(id); },
      async _exportUserAssets() { return [...store.values()]; },
      async _getBlob(id: string) { return store.get(id)?.blob ?? catalog.get(id) ?? null; },
      async _findMetaByType(_type: string, opts?: { catalogOnly?: boolean }) { return { id: opts?.catalogOnly ? 'lolly/tokens/demo' : USER_TOKENS_ID }; },
    },
  };
  const slots = await listLogos(host as unknown as Parameters<typeof listLogos>[0]);
  assert.equal(slots.length, 9);
  assert.ok(slots.every(s => s.shipped), 'kept from Lolly Demo, not the person\'s own files');
  for (const s of slots) URL.revokeObjectURL(s.url);
});

test('an example keeps the open system\'s fonts whatever it carries', () => {
  const current = demo();
  const withFonts = orchard();
  withFonts.base.font = { $type: 'fontFamily', brand: { $value: 'Atkinson Hyperlegible' } };
  assert.deepEqual(fontGroupOf(applyLookDoc(current, withFonts).doc), fontGroupOf(current));
});

test('a look never brings or drops a mark', () => {
  const current = demo();
  const look = orchard();
  look.base.asset = { logo: { 'horizontal-primary': { $type: 'asset', $value: 'user/ds/other/logo/horizontal-primary' } } };
  const { doc, keptRefs } = applyLookDoc(current, look);
  assert.deepEqual(ids(doc), ids(current));
  assert.equal(keptRefs.includes('user/ds/other/logo/horizontal-primary'), false);
  // With nothing open, the look is written as it is.
  assert.deepEqual(applyLookDoc(null, orchard()).doc, orchard());
});

test('the adoption keeps the kept marks as references: never fetched, copied or renamed', async () => {
  const { doc, keptRefs } = applyLookDoc(demo(), orchard());
  const fetched: string[] = [];
  let staged: unknown[] | undefined;
  let written: unknown;
  const host = {
    brandAdoption: { prepare: async (_snapshot: unknown, input: { doc: unknown; assets?: unknown[] }) => { written = input.doc; staged = input.assets; return {}; } },
    assets: {
      _getBlob: async (id: string) => { fetched.push(id); return null; },
      get: async (id: string) => { throw new Error(`fetched ${id}`); },
    },
  };
  const snapshot = { activeId: 'shipped', record: { id: 'default', ns: 'user/', headId: USER_TOKENS_ID }, isNew: true };
  await prepareTokenAdoption(host as unknown as Parameters<typeof prepareTokenAdoption>[0], snapshot as unknown as Parameters<typeof prepareTokenAdoption>[1], doc, [], { keepRefs: keptRefs });
  assert.deepEqual(fetched, [USER_TOKENS_ID], 'only the open head is read; no mark is fetched');
  assert.deepEqual(staged, [], 'no file is copied');
  assert.deepEqual(ids(written), ids(demo()), 'and every reference is written as it was');
});
