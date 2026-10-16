// SPDX-License-Identifier: MPL-2.0
/**
 * Pack chrome across the packs on disk (shells/web/src/lib/brand-chrome.ts).
 *
 * A brand pack may state the app's own room as a `color.chrome.*` group in each
 * theme set. The shell paints a theme's room only when every pair in it reads, so
 * a pack that shipped a room that fails would keep Lolly's own without a word.
 * These tests read the token file each pack ships, through the engine's
 * createTokenSet as the web bridge does, and check every theme the pack declares:
 *
 *  - lolly-start always ships. It states Lolly's newsprint room in its light and
 *    dark sets, has no `brand` theme (so its noir brand theme stays constructed)
 *    and no unsaved colour (the blank brand has no warm colour).
 *  - Any other pack whose token file is on disk (lolly-demo once Opal is merged) is
 *    checked the same way, with nothing to register when it is absent.
 *  - SUSE is checked where the private pack is mounted and skipped by name where
 *    it is not (tests/expected-skips.json lists that skip).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test tests/pack-chrome.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createTokenSet } from '../engine/src/tokens.ts';
import { resolvePackChrome, type ChromeTheme, type ChromeThemeName, type ChromeTokens } from '../shells/web/src/lib/brand-chrome.ts';
import { apcaLcAbs, tokenValueToHex } from '../shells/web/src/brand-vars.ts';

const ROOT = join(import.meta.dirname, '..');
const BRANDS = join(ROOT, 'brands');
const SUSE_ABSENT = 'brands/suse is not checked out, so the suse profile cannot be resolved here';

/** The token documents a pack ships: the `tokens` assets its catalog index lists, read from disk. Empty when the pack is not mounted. */
function tokenDocsOf(brand: string): Array<{ file: string; doc: unknown }> {
  const index = join(BRANDS, brand, 'catalog', 'assets', 'index.json');
  if (!existsSync(index)) return [];
  const listed = (JSON.parse(readFileSync(index, 'utf8')) as { assets?: Array<{ type?: string; formats?: Array<{ format?: string; url?: string }> }> }).assets ?? [];
  return listed
    .filter((asset) => asset.type === 'tokens')
    .flatMap((asset) => (asset.formats ?? []).filter((format) => format.format === 'json' && format.url).map((format) => join(BRANDS, brand, format.url!)))
    .filter((file) => existsSync(file))
    .map((file) => ({ file, doc: JSON.parse(readFileSync(file, 'utf8')) as unknown }));
}

/** A host over one token document, resolving per theme like bridge/tokens.ts. */
function hostFor(doc: unknown): ChromeTokens {
  return {
    resolve: async (ref: string, opts: { theme?: string } = {}) => createTokenSet(doc, { theme: opts.theme }).resolve(ref),
    themes: async () => createTokenSet(doc).themes(),
  };
}

const chromeOf = (doc: unknown) => resolvePackChrome(hostFor(doc), { toHex: tokenValueToHex, lc: apcaLcAbs });

/** The shell themes whose set in `doc` states a chrome page. */
function themesStatingChrome(doc: unknown): ChromeThemeName[] {
  return createTokenSet(doc).themes()
    .map((theme) => theme.name)
    .filter((name): name is ChromeThemeName => name === 'light' || name === 'dark' || name === 'brand')
    .filter((name) => createTokenSet(doc, { theme: name }).get('color.chrome.page') !== undefined);
}

/** Every theme a pack's token files declare chrome for applies, and nothing is refused. */
async function assertChromeReads(brand: string): Promise<void> {
  for (const { file, doc } of tokenDocsOf(brand)) {
    const chrome = await chromeOf(doc);
    assert.deepEqual(chrome.issues, [], `${brand} (${file}): every pair reads`);
    for (const theme of themesStatingChrome(doc)) assert.ok(chrome[theme], `${brand}: the ${theme} theme's room applies`);
  }
}

const mounted = readdirSync(BRANDS).filter((name) => tokenDocsOf(name).length > 0).sort();

test('lolly-start ships its token file, and the check below reads it', () => {
  assert.ok(mounted.includes('lolly-start'), `packs on disk: ${mounted.join(', ')}`);
  assert.equal(tokenDocsOf('lolly-start').length, 1);
});

// ── Lolly's newsprint room, as lolly-start states it ────────────────────────

const NEWSPRINT: Record<'light' | 'dark', ChromeTheme> = {
  light: { page: '#fcfaf6', raised: '#fefdfa', overlay: '#ffffff', muted: '#f3f0e9', hover: '#eeebe4', edge: '#dbd7cf', ink: '#171612', mutedInk: '#5e5b53' },
  dark: { page: '#171612', raised: '#201e1a', overlay: '#201e1a', muted: '#282621', hover: '#32302b', edge: '#403d36', ink: '#eae8e2', mutedInk: '#c1bdb5' },
};

test('lolly-start states the newsprint room in its light and dark sets, with no brand theme and no unsaved colour', async () => {
  const doc = tokenDocsOf('lolly-start')[0]!.doc;
  assert.deepEqual(createTokenSet(doc).themes().map((theme) => theme.name), ['light', 'dark'], 'no brand theme, so the noir brand theme stays constructed');
  assert.deepEqual(themesStatingChrome(doc), ['light', 'dark']);

  const chrome = await chromeOf(doc);
  assert.deepEqual(chrome.issues, []);
  assert.deepEqual(chrome.light, NEWSPRINT.light);
  assert.deepEqual(chrome.dark, NEWSPRINT.dark);
  assert.equal(chrome.brand, undefined);
  assert.deepEqual(chrome.unsaved, {}, 'the blank brand has no warm colour, so the Save pill keeps its own gold');
});

test('lolly-start states every chrome slot as a literal colour with a description, and no unsaved slot', () => {
  const doc = tokenDocsOf('lolly-start')[0]!.doc as Record<string, Record<string, Record<string, unknown>>>;
  for (const theme of ['light', 'dark'] as const) {
    const group = doc[theme]!.color!.chrome as Record<string, { $value?: unknown; $description?: unknown } | string>;
    const slots = Object.keys(group).filter((key) => !key.startsWith('$')).sort();
    assert.deepEqual(slots, ['edge', 'hover', 'ink', 'muted', 'muted-ink', 'overlay', 'page', 'raised'], `${theme}: eight slots, no unsaved`);
    for (const slot of slots) {
      const leaf = group[slot] as { $value?: unknown; $description?: unknown };
      assert.match(String(leaf.$value), /^#[0-9a-f]{6}$/, `${theme}.${slot} is a literal hex`);
      assert.ok(typeof leaf.$description === 'string' && leaf.$description.length > 0, `${theme}.${slot} has a description`);
    }
  }
});

// ── Every pack on disk ──────────────────────────────────────────────────────

for (const brand of mounted.filter((name) => name !== 'suse')) {
  test(`${brand}: every theme that states color.chrome.* passes the chrome checks`, async () => {
    await assertChromeReads(brand);
  });
}

test('suse: every theme that states color.chrome.* passes the chrome checks', { skip: mounted.includes('suse') ? false : SUSE_ABSENT }, async () => {
  await assertChromeReads('suse');
});
