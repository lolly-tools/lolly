// SPDX-License-Identifier: MPL-2.0
/**
 * preview.ts: the at-a-glance read the Settings strip, the Preferences rows and
 * the Design system tab share. Pins the colour count both surfaces show, the
 * looks a cover is painted in (and that only plain hex values reach them), the
 * head-document read and the logo for each app theme.
 * Run directly:  node --test shells/web/src/lib/design-system/preview.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  colourCountOf, docPalette, logoUrlsFor, looksFromColours, looksOf, monogramOf, previewFromDoc, previewOf,
  readDesignSystemPreview, PREVIEW_DOC_BYTES, PREVIEW_HEAD_RETRY_MS, type CoverLooks, type DesignSystemPreview,
} from './preview.ts';
import { readIssue } from './issue-model.ts';
import type { DesignSystemRecord } from './registry.ts';

// The pauses before a missing head is read again; each test that needs them sets its own.
const RETRY_MS = PREVIEW_HEAD_RETRY_MS.splice(0, PREVIEW_HEAD_RETRY_MS.length);

const read = (rel: string): Record<string, unknown> => JSON.parse(readFileSync(new URL(rel, import.meta.url), 'utf8')) as Record<string, unknown>;
const DEMO = read('../../../../../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = read('../../../../../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');

const HEX = /^#[0-9a-f]{6,8}$/i;
const lookValues = (looks: CoverLooks): string[] => [looks.light, ...(looks.dark ? [looks.dark] : [])].flatMap(l => Object.values(l));

function record(over: Partial<DesignSystemRecord> & { kind?: DesignSystemRecord['source']['kind'] } = {}): DesignSystemRecord {
  const { kind = 'local', ...rest } = over;
  const source = (kind === 'shipped' ? { kind: 'shipped' } : kind === 'hosted' ? { kind: 'hosted', instance: 'https://brand.example' } : { kind: 'local' }) as DesignSystemRecord['source'];
  return { id: 'acme', label: 'Acme', ns: 'user/ds/acme/', headId: 'user/ds/acme/tokens/brand', source, locked: false, createdAt: 1, lastUsedAt: 1, ...rest };
}

/** A host whose head blob, active id and live tokens the test controls. */
function fakeHost(opts: { blob?: Blob | null; activeId?: string; raw?: unknown; urls?: Record<string, string> } = {}) {
  const blobCalls: Array<{ id: string; fetchIfMissing?: boolean }> = [];
  const gets: string[] = [];
  let rawCalls = 0;
  const host = {
    assets: {
      _getBlob: async (id: string, o: { fetchIfMissing?: boolean } = {}) => { blobCalls.push({ id, fetchIfMissing: o.fetchIfMissing }); return opts.blob ?? null; },
      get: async (id: string) => {
        gets.push(id);
        const url = opts.urls?.[id];
        if (!url) throw new Error(`No asset ${id}`);
        return { id, url } as never;
      },
    },
    designSystems: { activeId: async () => opts.activeId ?? 'other' },
    tokens: { raw: async () => { rawCalls++; return opts.raw ?? null; } },
  };
  return { host, blobCalls, gets, rawCalls: () => rawCalls };
}

const DEMO_URLS: Record<string, string> = {
  'lolly/logo/horizontal': '/catalog/h.svg',
  'lolly/logo/horizontal-reverse': '/catalog/h-rev.svg',
  'lolly/logo/horizontal-on-brand': '/catalog/h-brand.svg',
  'lolly/logo/primary': '/catalog/v.svg',
  'lolly/logo/reverse': '/catalog/v-rev.svg',
};

test('one colour count: colourCountOf matches the Design system tab, 33 for Lolly Demo and 9 for the starter', () => {
  for (const [doc, n] of [[DEMO, 33], [START, 9]] as const) {
    assert.equal(colourCountOf(doc), n);
    const issue = readIssue({ doc, palette: docPalette(doc), label: 'x', source: '', locked: false });
    assert.equal(issue.facts.colours, colourCountOf(doc), 'the strip, the Preferences row and the tab count alike');
    assert.equal(previewFromDoc(doc, 'x').colorCount, n);
  }
  assert.equal(colourCountOf(null), 0);
});

test('an excluded swatch leaves the count, as it leaves host.tokens.colors()', () => {
  const doc = {
    color: { brand: { $type: 'color', ink: { $value: '#101010' }, paper: { $value: '#fafafa' }, extra: { $value: '#ff0000' } } },
    $extensions: { 'com.suse.lolly': { excluded: ['color.brand.extra'] } },
  };
  assert.equal(colourCountOf(doc), 2);
});

test('the looks: Lolly Demo reads each mode from its semantic slots', () => {
  const looks = looksOf(DEMO);
  assert.deepEqual(looks.light, { surface: '#ffffff', ink: '#09141a', primary: '#033633', onPrimary: '#ffffff', secondary: '#008657' });
  assert.deepEqual(looks.dark, { surface: '#09141a', ink: '#ffffff', primary: '#50c369', onPrimary: '#09141a', secondary: '#008657' });
  assert.equal(looksOf(START).light.primary, '#1d1d1d');
  assert.equal(looksOf(START).dark?.primary, '#ffffff');
});

test('a doc with no semantic slots falls back to its own colours, with no dark look', () => {
  const doc = { color: { brand: { $type: 'color', pine: { $value: '#0c322c' }, jungle: { $value: '#30ba78' }, fog: { $value: '#efefef' } } } };
  const looks = looksOf(doc);
  assert.equal(looks.dark, undefined, 'no dark mode, no dark look');
  assert.equal(looks.light.surface, '#efefef', 'the lightest colour is the surface');
  assert.equal(looks.light.ink, '#000000', 'the swatch ink on that surface');
  assert.equal(looks.light.primary, '#0c322c', 'the first colour');
  assert.equal(looks.light.onPrimary, '#ffffff');
  assert.equal(looks.light.secondary, '#30ba78', 'the second colour');
  assert.deepEqual(looksFromColours(['#0c322c', 'not a colour']).light.primary, '#0c322c');
  assert.ok(lookValues(looksOf(null)).every(v => HEX.test(v)), 'an empty doc still paints in plain hex');
});

test('only plain hex reaches a look: a smuggled declaration never survives', () => {
  const evil = 'red;background:url(x)';
  const doc = {
    $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }, { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } }],
    base: { color: { $type: 'color', brand: { ink: { $value: evil }, mint: { $value: '#90ebcd' } } } },
    light: { color: { $type: 'color', semantic: { primary: { $value: evil }, surface: { $value: 'url(x)' }, text: { $value: '{color.brand.ink}' } } } },
    dark: { color: { $type: 'color', semantic: { primary: { $value: `#000;${evil}` } } } },
  };
  const preview = previewFromDoc(doc, 'Evil');
  for (const value of [...lookValues(preview.looks), ...preview.colors]) {
    assert.match(value, HEX);
    assert.equal(value.includes('url('), false);
  }
});

test('the head document is fetched when missing only for the shipped record', async () => {
  for (const [kind, expected] of [['shipped', true], ['local', false], ['hosted', false]] as const) {
    const fake = fakeHost();
    await readDesignSystemPreview(fake.host, record({ kind }));
    assert.deepEqual(fake.blobCalls.map(c => c.fetchIfMissing), [expected], kind);
  }
});

test('the active record with no stored blob reads the live tokens; an inactive one does not', async () => {
  const active = fakeHost({ activeId: 'acme', raw: DEMO });
  const p = await readDesignSystemPreview(active.host, record());
  assert.equal(active.rawCalls(), 1);
  assert.equal(p.colorCount, 33);
  const inactive = fakeHost({ activeId: 'other', raw: DEMO });
  const q = await readDesignSystemPreview(inactive.host, record());
  assert.equal(inactive.rawCalls(), 0);
  assert.equal(q.unread, true, 'nothing was read, and the preview says so');
  assert.equal(p.unread, undefined);
});

test('a head that is not there yet is read again after each pause, and a miss leaves the cache', async () => {
  assert.deepEqual(RETRY_MS, [200, 600], 'the shell waits 200 ms, then 600 ms more');
  PREVIEW_HEAD_RETRY_MS.push(1, 1);
  try {
    // Written between the first read and the second (manage.ts puts the record before the head).
    let misses = 1;
    const late = fakeHost();
    late.host.assets._getBlob = async (id: string, o: { fetchIfMissing?: boolean } = {}) => {
      late.blobCalls.push({ id, fetchIfMissing: o.fetchIfMissing });
      return misses-- > 0 ? null : new Blob([JSON.stringify(START)]);
    };
    const cache = new Map<string, Promise<DesignSystemPreview>>();
    const p = await readDesignSystemPreview(late.host, record(), cache);
    assert.equal(late.blobCalls.length, 2);
    assert.equal(p.unread, undefined);
    assert.equal(p.colorCount, 9);
    assert.equal(cache.size, 1, 'a preview that was read stays cached');

    // Never written: three reads, then an unread preview that leaves the cache.
    const never = fakeHost();
    const misses2 = new Map<string, Promise<DesignSystemPreview>>();
    const q = await readDesignSystemPreview(never.host, record(), misses2);
    assert.equal(never.blobCalls.length, 3);
    assert.equal(q.unread, true);
    assert.equal(misses2.size, 0, 'so the next draw reads it again');

    // A head with no id has nothing to wait for.
    const none = fakeHost();
    await readDesignSystemPreview(none.host, record({ headId: '' }));
    assert.equal(none.blobCalls.length, 0);
  } finally { PREVIEW_HEAD_RETRY_MS.length = 0; }
});

test('a head document over 2 MB is not parsed', async () => {
  const big = new Blob([JSON.stringify(DEMO), ' '.repeat(PREVIEW_DOC_BYTES)]);
  const fake = fakeHost({ blob: big, activeId: 'acme', raw: DEMO });
  const p = await readDesignSystemPreview(fake.host, record());
  assert.equal(p.unread, true, 'an oversize head is not read, and the preview says so');
  assert.equal(fake.rawCalls(), 0, 'a stored blob, even an oversize one, is the answer');
  const fits = fakeHost({ blob: new Blob([JSON.stringify(DEMO)]) });
  assert.equal((await readDesignSystemPreview(fits.host, record())).colorCount, 33);
});

test('previewOf keeps the old shape: font, at most six colours, the count and one logo URL', async () => {
  const fake = fakeHost({ blob: new Blob([JSON.stringify(DEMO)]), urls: DEMO_URLS });
  const p = await previewOf(fake.host, record({ label: 'Lolly Demo' }));
  assert.match(p.font, /^'SUSE'/);
  assert.ok(p.colors.length > 0 && p.colors.length <= 6);
  assert.equal(p.colorCount, 33);
  assert.equal(p.logoUrl, '/catalog/h.svg');
  assert.equal(p.label, 'Lolly Demo');
  assert.equal(p.monogram, 'L');
  assert.match(p.display, /^'Outfit', 'SUSE'/);
  assert.deepEqual(p.families, ['Outfit', 'SUSE', 'SUSE Mono']);
  assert.equal(p.colourways, 6);
  assert.equal(p.logoCount, 7);
});

test('a preview never rejects: an unreadable head gives a plain one', async () => {
  const fake = fakeHost({ blob: new Blob(['{not json']) });
  const cache = new Map<string, Promise<DesignSystemPreview>>();
  const p = await readDesignSystemPreview(fake.host, record(), cache);
  assert.equal(p.unread, true, 'a surface prints no count for it');
  assert.equal(cache.size, 1, 'a head that is there but unreadable is not read again');
  assert.deepEqual(p.logos, {});
  assert.ok(lookValues(p.looks).every(v => HEX.test(v)));
});

test('logos per app theme: horizontal first, the reverse in dark, the on-brand form in brand', async () => {
  const fake = fakeHost({ urls: DEMO_URLS });
  assert.deepEqual(await logoUrlsFor(fake.host as never, DEMO), { light: '/catalog/h.svg', dark: '/catalog/h-rev.svg', brand: '/catalog/h-brand.svg' });

  const noBrand = fakeHost({ urls: { 'lolly/logo/horizontal': '/catalog/h.svg', 'lolly/logo/horizontal-reverse': '/catalog/h-rev.svg' } });
  assert.equal((await logoUrlsFor(noBrand.host as never, DEMO)).brand, '/catalog/h-rev.svg', 'no on-brand file: brand takes the reverse');

  const vertical = { asset: { logo: {
    'vertical-primary': { $type: 'asset', $value: 'v/primary' },
    'vertical-primary-reverse': { $type: 'asset', $value: 'v/reverse' },
  } } };
  const v = fakeHost({ urls: { 'v/primary': '/v.svg', 'v/reverse': '/v-rev.svg' } });
  assert.deepEqual(await logoUrlsFor(v.host as never, vertical), { light: '/v.svg', dark: '/v-rev.svg', brand: '/v-rev.svg' });
  assert.equal(v.gets.filter(id => id === 'v/reverse').length, 1, 'each asset is asked for once');

  const none = fakeHost();
  assert.deepEqual(await logoUrlsFor(none.host as never, { color: {} }), {});
  assert.equal(none.gets.length, 0);
});

test('a mount-owned cache answers a repeat read with the same promise, keyed by id and head', async () => {
  const fake = fakeHost({ blob: new Blob([JSON.stringify(START)]) });
  const cache = new Map<string, Promise<DesignSystemPreview>>();
  const a = readDesignSystemPreview(fake.host, record(), cache);
  const b = readDesignSystemPreview(fake.host, record(), cache);
  assert.equal(a, b);
  await readDesignSystemPreview(fake.host, record({ headId: 'user/ds/acme/tokens/brand/v2' }), cache);
  assert.equal(fake.blobCalls.length, 2);
  assert.deepEqual([...cache.keys()], ['acme|user/ds/acme/tokens/brand', 'acme|user/ds/acme/tokens/brand/v2']);
});

test('the monogram is the first grapheme of the label', () => {
  assert.equal(monogramOf('Lolly Demo'), 'L');
  assert.equal(monogramOf('  acme'), 'A');
  assert.equal(monogramOf('\u{1F469}\u200D\u{1F3A8} Studio'), '\u{1F469}\u200D\u{1F3A8}', 'a joined emoji is one grapheme');
  assert.equal(monogramOf(''), '');
});
