// SPDX-License-Identifier: MPL-2.0
/**
 * The pre-paint chrome mirror in index.html, run for real.
 *
 * brand-vars.ts's applyChromeAccent writes the exact text of the chrome sheet it
 * paints to localStorage['brand-chrome']; index.html's theme script restores that
 * text before the first paint, after checking every line of the text. This suite takes
 * the theme script out of index.html (from the "Apply saved theme" comment to its
 * closing tag), runs it in node:vm against a small fake document and storage, and
 * holds three things:
 *
 *   1. every sheet chromeBrandCss emits for the fixtures below is restored exactly,
 *      which shows the script's selector list is complete, and the list carries no
 *      selector chromeBrandCss cannot emit;
 *   2. a tampered mirror (url(), an @rule, an unknown selector, a value carrying `;`
 *      or `}`, a value that is not a colour, an oversized text) restores nothing,
 *      and neither does a mirror while "Interface follows the design system" is off;
 *   3. the restores before and after it (fonts, radius, spacing, the a11y attributes)
 *      still run when the chrome mirror is corrupt, and the address bar colour takes
 *      the pack's page for the active theme.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/chrome-prepaint-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createTokenSet } from '../../../../engine/src/tokens.ts';
import { CHROME_SEL, CHROME_CACHE_KEY, CHROME_CACHE_MAX, apcaLcAbs, chromeBrandCss, hexToHslTriple, tokenValueToHex } from '../brand-vars.ts';
import { deriveChrome, resolvePackChrome, type PackChrome } from './brand-chrome.ts';

const HTML = readFileSync(new URL('../../index.html', import.meta.url), 'utf8');
const THEME_SCRIPT = (() => {
  const at = HTML.indexOf('Apply saved theme');
  assert.ok(at > 0, 'index.html still carries the theme flash guard');
  const open = HTML.indexOf('<script>', at);
  return HTML.slice(open + '<script>'.length, HTML.indexOf('</script>', open));
})();

interface FakeEl { tagName: string; id: string; textContent: string }
interface Run {
  inserted: Array<{ el: FakeEl; ref: unknown }>;
  props: Map<string, string>;
  dataset: Record<string, string>;
  meta: { content: string };
}

/** Run the theme script with `storage` as localStorage. */
function run(storage: Record<string, string | undefined>): Run {
  const store = new Map(Object.entries(storage).filter((e): e is [string, string] => e[1] !== undefined));
  const props = new Map<string, string>();
  const dataset: Record<string, string> = { theme: 'light' }; // index.html ships data-theme="light"
  const inserted: Run['inserted'] = [];
  const html = {
    dataset,
    lang: 'en',
    dir: 'ltr',
    style: { setProperty: (name: string, value: string) => { props.set(name, value); } },
    setAttribute: () => { /* data-jelly-motion, data-perf-ui: not under test */ },
    insertBefore: (el: FakeEl, ref: unknown) => { inserted.push({ el, ref }); return el; },
  };
  const head = { parentNode: html, nextSibling: null };
  const meta = { content: '#033633' };
  const document = {
    documentElement: html,
    head,
    getElementById: () => null,
    createElement: (tag: string): FakeEl => ({ tagName: tag.toUpperCase(), id: '', textContent: '' }),
    querySelector: (sel: string) => (sel === 'meta[name="theme-color"]' ? meta : null),
  };
  const localStorage = { getItem: (key: string) => store.get(key) ?? null };
  runInNewContext(THEME_SCRIPT, {
    document, localStorage, matchMedia: () => ({ matches: false }), location: { hash: '', search: '' }, URLSearchParams,
  });
  return { inserted, props, dataset, meta };
}

/** The restored sheet's text, or null when nothing was restored. */
function restored(r: Run): string | null {
  assert.ok(r.inserted.length <= 1, 'at most one chrome sheet');
  const one = r.inserted[0];
  if (!one) return null;
  assert.equal(one.el.tagName, 'STYLE');
  assert.equal(one.el.id, 'brand-chrome-vars', 'the runtime finds and reuses the same element');
  assert.equal(one.ref, null, 'inserted straight after <head>, before anything the parser adds later');
  return one.el.textContent;
}

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SUSE = [{ primary: '#0c322c', onPrimary: '#f7f7f5' }, { primary: '#30ba78', onPrimary: '#08211d' }] as const;
const START = [{ primary: '#1d1d1d', onPrimary: '#ffffff' }, { primary: '#ffffff', onPrimary: '#1d1d1d' }] as const;
const VIOLET = [{ primary: '#6d28d9', onPrimary: '#ffffff' }, { primary: '#a678ff', onPrimary: '#000000' }] as const;

const NEWSPRINT: PackChrome = {
  light: deriveChrome('light', { page: '#fcfaf6', raised: '#fefdfa', overlay: '#ffffff', muted: '#f3f0e9', hover: '#eeebe4', edge: '#dbd7cf', ink: '#171612', 'muted-ink': '#5e5b53' })!,
  dark: deriveChrome('dark', { page: '#171612', raised: '#201e1a', overlay: '#201e1a', muted: '#282621', hover: '#32302b', edge: '#403d36', ink: '#eae8e2', 'muted-ink': '#c1bdb5' })!,
  unsaved: {},
  issues: [],
};
const VIOLET_CHROME: PackChrome = {
  brand: deriveChrome('brand', { page: '#241c38', raised: '#2e2545', overlay: '#2e2545', muted: '#3a3052', hover: '#433a5c' })!,
  unsaved: { brand: '#f0b23e' },
  issues: [],
};

const OPAL = await (async () => {
  const doc = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/pack-chrome/opal.json', import.meta.url), 'utf8'));
  const tokens = {
    resolve: async (ref: string, opts: { theme?: string } = {}) => createTokenSet(doc, { theme: opts.theme }).resolve(ref),
    themes: async () => createTokenSet(doc).themes(),
  };
  const pair = async (theme: string) => ({
    primary: tokenValueToHex(await tokens.resolve('{color.semantic.primary}', { theme })),
    onPrimary: tokenValueToHex(await tokens.resolve('{color.semantic.on-primary}', { theme })),
  });
  return { light: await pair('light'), dark: await pair('dark'), chrome: await resolvePackChrome(tokens, { toHex: tokenValueToHex, lc: apcaLcAbs }) };
})();

const SHEETS: Record<string, string> = {
  suse: chromeBrandCss(SUSE[0], SUSE[1]),
  'lolly-start': chromeBrandCss(START[0], START[1]),
  'lolly-start with newsprint': chromeBrandCss(START[0], START[1], NEWSPRINT),
  opal: chromeBrandCss(OPAL.light, OPAL.dark, OPAL.chrome),
  'opal with its own danger red': chromeBrandCss(OPAL.light, OPAL.dark, OPAL.chrome, '#a43427'),
  'violet with brand chrome': chromeBrandCss(VIOLET[0], VIOLET[1], VIOLET_CHROME),
  'amber, whose light accent needs repair': chromeBrandCss({ primary: '#eab308', onPrimary: null }, { primary: '#eab308', onPrimary: null }),
};

const selectorsOf = (css: string): string[] => [...css.matchAll(/^([^\s{}][^{}\n]*) \{$/gm)].map((m) => m[1]!);

// ── 1. Every emitted sheet is restored exactly ───────────────────────────────

test('every sheet chromeBrandCss emits for the fixtures is restored exactly', () => {
  for (const [name, css] of Object.entries(SHEETS)) {
    assert.ok(css.length > 0 && css.length <= CHROME_CACHE_MAX, `${name}: ${css.length} characters`);
    assert.equal(restored(run({ [CHROME_CACHE_KEY]: css })), css, name);
  }
});

test("the script's selector list is exactly the selectors chromeBrandCss emits", () => {
  const block = THEME_SCRIPT.slice(THEME_SCRIPT.indexOf('var CL ='), THEME_SCRIPT.indexOf('var DECL ='));
  const listed = new Set([...block.matchAll(/'([^']+)'/g)].map((m) => m[1]!));
  const emitted = new Set(Object.values(SHEETS).flatMap(selectorsOf));
  assert.deepEqual([...listed].sort(), [...emitted].sort());
  // The pack chrome selectors are brand-vars.ts's own constants.
  for (const [name, sel] of [['CL', CHROME_SEL.light], ['CD', CHROME_SEL.dark], ['CB', CHROME_SEL.brand]] as const) {
    assert.ok(block.includes(`var ${name} = '${sel}';`), `${name} is CHROME_SEL`);
  }
});

// ── 2. Anything else restores nothing ────────────────────────────────────────

test('a tampered mirror restores nothing', () => {
  const good = SHEETS.opal!;
  const page = `  --background: ${hexToHslTriple('#edf6e0')};`;
  assert.ok(good.includes(page));
  const tampered: Record<string, string> = {
    'url()': good.replace(page, '  --background: url(https://example.com/x.png);'),
    '@import': `@import url(https://example.com/x.css);\n${good}`,
    'an @rule wrapping a block': `@media all {\n${good}\n}`,
    'an unknown selector': `${good}\nbody {\n  --background: 0 0% 0%;\n}`,
    'a value carrying ;': good.replace(page, `${page} color: red;`),
    'a value carrying }': good.replace(page, '  --background: 0 0% 100%}'),
    'a value that is not a triple or a hex': good.replace(page, '  --background: red;'),
    'markup in a value': good.replace(page, '  --background: </style><script>alert(1)</script>;'),
    'a property that is not custom': good.replace(page, '  background: #ffffff;'),
    'an unclosed block': good.slice(0, good.lastIndexOf('\n}')),
    'an empty block': `${good}\n[data-theme="dark"] {\n}`,
    'over 16 KB': `${good}\n${good}\n${good}\n${good}\n${good}\n${good}`,
  };
  assert.ok(tampered['over 16 KB']!.length > CHROME_CACHE_MAX);
  for (const [name, css] of Object.entries(tampered)) {
    const r = run({ [CHROME_CACHE_KEY]: css, theme: 'dark' });
    assert.equal(restored(r), null, name);
    assert.equal(r.meta.content, '#033633', `${name}: the address bar is untouched`);
  }
});

test('with "Interface follows the design system" off the mirror is not restored', () => {
  assert.equal(restored(run({ [CHROME_CACHE_KEY]: SHEETS.opal, 'lolly-follow-ds': '0' })), null);
  assert.equal(restored(run({ [CHROME_CACHE_KEY]: SHEETS.opal, 'lolly-follow-ds': '1' })), SHEETS.opal, 'any other value follows');
  assert.equal(restored(run({})), null, 'no mirror, nothing restored');
});

// ── 3. The neighbours still run, and the address bar follows ─────────────────

test('the font, radius, spacing and a11y restores still run when the chrome mirror is corrupt', () => {
  const r = run({
    'brand-fonts': JSON.stringify({ '--font-brand': "'Inter', ui-sans-serif" }),
    'brand-radius': '0.75rem',
    'brand-space': '6px',
    'lolly-a11y': JSON.stringify({ highContrast: true, largeText: true }),
    [CHROME_CACHE_KEY]: '@import url(x);',
    theme: 'dark',
  });
  assert.equal(restored(r), null);
  assert.equal(r.props.get('--font-brand'), "'Inter', ui-sans-serif");
  assert.equal(r.props.get('--radius'), '0.75rem');
  assert.equal(r.props.get('--space'), '6px');
  assert.equal(r.dataset.a11yContrast, 'high');
  assert.equal(r.dataset.a11yText, 'large');
  assert.equal(r.dataset.theme, 'dark');
});

test("the address bar takes the pack's page for the active theme, and only brand under High contrast", () => {
  const hsl = (hex: string): string => `hsl(${hexToHslTriple(hex)})`;
  const hc = JSON.stringify({ highContrast: true });
  const news = SHEETS['lolly-start with newsprint']!;
  assert.equal(run({ [CHROME_CACHE_KEY]: news }).meta.content, hsl('#fcfaf6'), 'light');
  assert.equal(run({ [CHROME_CACHE_KEY]: news, theme: 'dark' }).meta.content, hsl('#171612'), 'dark');
  assert.equal(run({ [CHROME_CACHE_KEY]: news, theme: 'brand' }).meta.content, 'hsl(348 5.6% 17.5%)', 'brand: the noir construction');
  assert.equal(run({ [CHROME_CACHE_KEY]: news, 'lolly-a11y': hc }).meta.content, '#033633', 'High contrast light keeps Lolly\'s room');
  assert.equal(run({ [CHROME_CACHE_KEY]: news, 'lolly-a11y': hc, theme: 'dark' }).meta.content, '#033633');
  assert.equal(run({ [CHROME_CACHE_KEY]: news, 'lolly-a11y': hc, theme: 'brand' }).meta.content, 'hsl(348 5.6% 17.5%)');
  // Brand chrome comes after the construction, so its page wins, as in the cascade.
  const violet = SHEETS['violet with brand chrome']!;
  assert.equal(run({ [CHROME_CACHE_KEY]: violet, theme: 'brand' }).meta.content, hsl('#241c38'));
  // A sheet with no chrome for the active theme leaves the static colour alone.
  assert.equal(run({ [CHROME_CACHE_KEY]: SHEETS.suse }).meta.content, '#033633');
});
