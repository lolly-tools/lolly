// SPDX-License-Identifier: MPL-2.0
/**
 * Pack chrome, the model (lib/brand-chrome.ts): how a pack's `color.chrome.*`
 * group is read per theme, how the surfaces it leaves out are derived from its
 * page and which rooms are refused because a pair would not read.
 *
 * DOM-free. Token documents resolve through the engine's own createTokenSet, so a
 * theme the document does not declare answers exactly as the web bridge would.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/brand-chrome.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { hexToOklch } from '../../../../engine/src/brand-derive.ts';
import {
  CHROME_BANDS, CHROME_SLOTS, HC_BRAND_INKS, STATIC_INKS, chromeIssues, declaresUnsaved, deriveChrome, resolvePackChrome,
  type ChromeTokens,
} from './brand-chrome.ts';
import { apcaLcAbs, hslTripleToHex, tokenValueToHex } from '../brand-vars.ts';

const MEASURES = { toHex: tokenValueToHex, lc: apcaLcAbs };

/** A host over one token document, resolving per theme like bridge/tokens.ts. `asked`
 *  records every theme a resolve was made for. */
function hostFor(doc: unknown, asked: string[] = []): ChromeTokens {
  return {
    resolve: async (ref: string, opts: { theme?: string } = {}) => {
      asked.push(opts.theme ?? '');
      return createTokenSet(doc, { theme: opts.theme }).resolve(ref);
    },
    themes: async () => createTokenSet(doc).themes(),
  };
}

/** A themed document: light and dark sets (and brand, when given) over an empty base. */
function themedDoc(sets: { light?: object; dark?: object; brand?: object }): Record<string, unknown> {
  const names = Object.keys(sets) as Array<keyof typeof sets>;
  return {
    $metadata: { tokenSetOrder: ['base', ...names] },
    $themes: names.map((name) => ({ name, selectedTokenSets: { base: 'enabled', [name]: 'enabled' } })),
    base: { color: { $type: 'color', brand: { ink: { $value: '#101010' } } } },
    ...Object.fromEntries(names.map((name) => [name, { color: { $type: 'color', chrome: sets[name] } }])),
  };
}
const leaf = (value: string) => ({ $value: value });

test('a page-only pack derives the other surfaces from its page', () => {
  assert.deepEqual(deriveChrome('light', { page: '#fcfaf6' }), {
    page: '#fcfaf6', raised: '#f9f7f3', overlay: '#f9f7f3', muted: '#f1efeb', hover: '#eceae6', edge: '#d2cfc8', ink: null, mutedInk: null,
  });
  assert.deepEqual(deriveChrome('dark', { page: '#09141a' }), {
    page: '#09141a', raised: '#111c23', overlay: '#111c23', muted: '#243037', hover: '#2d3a41', edge: '#283a45', ink: null, mutedInk: null,
  });
  // The brand theme steps like dark; a declared slot is kept as it is.
  assert.deepEqual(deriveChrome('brand', { page: '#09141a', overlay: '#1c282f' }), {
    page: '#09141a', raised: '#111c23', overlay: '#1c282f', muted: '#243037', hover: '#2d3a41', edge: '#283a45', ink: null, mutedInk: null,
  });
  // The steps hold the page's hue: every derived light surface is the page's tint.
  const page = hexToOklch('#fcfaf6')!;
  for (const hex of ['#f9f7f3', '#f1efeb', '#eceae6']) assert.ok(Math.abs(hexToOklch(hex)!.h - page.h) < 8, hex);
  assert.equal(deriveChrome('light', {}), null, 'no page, no surface chrome');
  assert.equal(deriveChrome('light', { raised: '#ffffff' }), null);
});

test('each failing pair drops only its own theme and reports one issue for the pair', async () => {
  const lightOk = { page: leaf('#fcfaf6') };
  const darkOk = { page: leaf('#09141a') };
  const cases: Array<[string, Parameters<typeof themedDoc>[0], 'light' | 'dark' | 'brand', RegExp]> = [
    ['a light page in the dark set', { light: lightOk, dark: { page: leaf('#fcfaf6') } }, 'dark', /^dark: page #fcfaf6 has OKLCH lightness 0\.986, outside 0 to 0\.4$/],
    ['an ink under 4.5:1', { light: { page: leaf('#fcfaf6'), ink: leaf('#8a8a8a') }, dark: darkOk }, 'light', /^light: ink #8a8a8a on page #fcfaf6 reads 3\.31:1, under 4\.50:1$/],
    ['a muted ink under 4.5:1 on the overlay',
      { light: { page: leaf('#ffffff'), raised: leaf('#ffffff'), overlay: leaf('#e4e4e4'), 'muted-ink': leaf('#6b6b6b') }, dark: darkOk },
      'light', /^light: muted ink #6b6b6b on overlay #e4e4e4 reads 4\.19:1, under 4\.50:1$/],
    ['a brand page lighter than L .42', { light: lightOk, dark: darkOk, brand: { page: leaf('#7a6a8a') } }, 'brand', /^brand: page #7a6a8a has OKLCH lightness 0\.551, outside 0\.2 to 0\.42$/],
  ];
  for (const [name, sets, dropped, issue] of cases) {
    const chrome = await resolvePackChrome(hostFor(themedDoc(sets)), MEASURES);
    assert.equal(chrome.issues.length, 1, `${name}: ${chrome.issues.join('; ')}`);
    assert.match(chrome.issues[0]!, issue, name);
    assert.equal(chrome[dropped], undefined, `${name}: ${dropped} keeps Lolly's room`);
    for (const kept of ['light', 'dark'] as const) if (kept !== dropped) assert.ok(chrome[kept], `${name}: ${kept} still applies`);
  }
});

test('a themeless document that declares a page applies to light only, because dark fails the band', async () => {
  const doc = { color: { $type: 'color', chrome: { page: leaf('#fcfaf6') } } };
  const chrome = await resolvePackChrome(hostFor(doc), MEASURES);
  assert.equal(chrome.light?.page, '#fcfaf6');
  assert.equal(chrome.dark, undefined);
  assert.equal(chrome.brand, undefined);
  assert.deepEqual(chrome.issues, ['dark: page #fcfaf6 has OKLCH lightness 0.986, outside 0 to 0.4']);
});

test('brand chrome is read only from a document that declares a theme called brand', async () => {
  // Opal declares light and dark only. Asked for `brand`, the engine answers with its
  // default sets, the light values, so the brand set must never be asked for at all.
  const opal = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/pack-chrome/opal.json', import.meta.url), 'utf8'));
  const asked: string[] = [];
  assert.equal(createTokenSet(opal, { theme: 'brand' }).resolve('{color.chrome.page}'), '#edf6e0', 'the engine would answer brand with light');
  const chrome = await resolvePackChrome(hostFor(opal, asked), MEASURES);
  assert.equal(chrome.brand, undefined);
  assert.equal(chrome.unsaved.brand, undefined);
  assert.ok(!asked.includes('brand'), `asked for ${[...new Set(asked)].join(', ')}`);
  assert.ok(chrome.light && chrome.dark, 'light and dark still apply');
  // A document that does declare a brand theme gets brand chrome from that set.
  const violet = themedDoc({
    light: { page: leaf('#fcfaf6') },
    dark: { page: leaf('#09141a') },
    brand: { page: leaf('#241c38'), raised: leaf('#2e2545'), overlay: leaf('#2e2545'), muted: leaf('#3a3052'), hover: leaf('#433a5c'), unsaved: leaf('#f0b23e') },
  });
  const withBrand = await resolvePackChrome(hostFor(violet), MEASURES);
  assert.deepEqual(withBrand.issues, []);
  assert.equal(withBrand.brand?.page, '#241c38');
  assert.equal(withBrand.unsaved.brand, '#f0b23e');
});

test('the Opal fixture resolves to its declared chrome, with Honey deep in light and Honey in dark', async () => {
  const opal = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/pack-chrome/opal.json', import.meta.url), 'utf8'));
  const chrome = await resolvePackChrome(hostFor(opal), MEASURES);
  assert.deepEqual(chrome.issues, []);
  assert.deepEqual(chrome.light, {
    page: '#edf6e0', raised: '#ffffff', overlay: '#ffffff', muted: '#e2ebd6', hover: '#dde6d0', edge: '#ace1ad', ink: '#09141a', mutedInk: '#373e44',
  });
  assert.deepEqual(chrome.dark, {
    page: '#09141a', raised: '#121d24', overlay: '#1c282f', muted: '#1c282f', hover: '#2d3a41', edge: '#373e44', ink: '#ffffff', mutedInk: '#99a0a4',
  });
  assert.deepEqual(chrome.unsaved, { light: '#b57c0a', dark: '#fac044' });
  assert.equal(declaresUnsaved(chrome), true);
  assert.equal(declaresUnsaved({ unsaved: {}, issues: [] }), false);
});

test('a missing or broken tokens surface resolves to no chrome and never throws', async () => {
  assert.deepEqual(await resolvePackChrome(undefined, MEASURES), { unsaved: {}, issues: [] });
  const broken: ChromeTokens = {
    resolve: async () => { throw new Error('no document'); },
    themes: async () => { throw new Error('no document'); },
  };
  assert.deepEqual(await resolvePackChrome(broken, MEASURES), { unsaved: {}, issues: [] });
  // A slot that is not a colour is absent, not an error.
  const odd = themedDoc({ light: { page: leaf('not a colour') }, dark: { page: leaf('#09141a'), ink: { $value: 12 } } });
  const chrome = await resolvePackChrome(hostFor(odd), MEASURES);
  assert.equal(chrome.light, undefined);
  assert.equal(chrome.dark?.ink, null);
  assert.deepEqual(chrome.issues, []);
});

test('under the brand theme the High contrast inks and edge must still read', () => {
  // A grey at OKLCH L .413 sits inside the brand band, and the brand's own inks read on
  // it, yet the High contrast muted ink falls just under Lc 75 there.
  const flat = (hex: string) => deriveChrome('brand', { page: hex, raised: hex, overlay: hex, muted: hex, hover: hex })!;
  assert.ok(hexToOklch('#4b4b4b')!.l <= CHROME_BANDS.brand[1]);
  const issues = chromeIssues('brand', flat('#4b4b4b'), apcaLcAbs);
  assert.ok(issues.length > 0 && issues.every((i) => i.startsWith('brand: High contrast muted ink #e0e0e0 on ')), issues.join('\n'));
  // A step darker clears every bar.
  assert.deepEqual(chromeIssues('brand', flat('#484848'), apcaLcAbs), []);
  // Light and dark chrome steps aside under High contrast, so neither is measured
  // against the High contrast inks.
  assert.ok(!chromeIssues('dark', { ...flat('#3a3a3a') }, apcaLcAbs).some((i) => i.includes('High contrast')));
});

// ── Held to styles/tokens.css ────────────────────────────────────────────────

const TOKENS_CSS = readFileSync(new URL('../styles/tokens.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** The declarations of the block whose selector is exactly `head` and which declares `marker`. */
function block(head: string, marker: string): Map<string, string> {
  for (const m of TOKENS_CSS.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    if (m[1]!.trim() !== head || !m[2]!.includes(marker)) continue;
    return new Map([...m[2]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((d) => [d[1]!, d[2]!.trim()]));
  }
  assert.fail(`tokens.css has no ${head} block with ${marker}`);
}

test("STATIC_INKS are tokens.css's own inks", () => {
  const heads = { light: ':root,\n[data-theme="light"]', dark: '[data-theme="dark"]', brand: '[data-theme="brand"]' } as const;
  for (const theme of ['light', 'dark', 'brand'] as const) {
    const decls = block(heads[theme], '--background');
    assert.equal(STATIC_INKS[theme].ink, hslTripleToHex(decls.get('--foreground')!), `${theme} ink`);
    assert.equal(STATIC_INKS[theme].mutedInk, hslTripleToHex(decls.get('--muted-foreground')!), `${theme} muted ink`);
  }
});

test("HC_BRAND_INKS are the High contrast brand block's inks and edge", () => {
  const decls = block('html[data-a11y-contrast="high"][data-theme="brand"]', '--foreground');
  assert.equal(HC_BRAND_INKS.ink, hslTripleToHex(decls.get('--foreground')!));
  assert.equal(HC_BRAND_INKS.mutedInk, hslTripleToHex(decls.get('--muted-foreground')!));
  assert.equal(HC_BRAND_INKS.edge, hslTripleToHex(decls.get('--border')!));
});

test('every static name a slot sets is a token the light block declares, and the canvas ink is not one', () => {
  const light = block(':root,\n[data-theme="light"]', '--background');
  const names = CHROME_SLOTS.filter((s) => s.key).flatMap((s) => s.names);
  for (const name of names) assert.ok(light.has(name), `${name} is a tokens.css token`);
  for (const never of ['--foreground-canvas', '--primary', '--primary-foreground', '--ring', '--destructive', '--radius', '--space']) {
    assert.ok(!CHROME_SLOTS.some((s) => s.names.includes(never)), `${never} is never a chrome slot`);
  }
});
