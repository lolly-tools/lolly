// SPDX-License-Identifier: MPL-2.0
/**
 * The Lolly Demo pages in Start (docs/lolly-demo.md, docs/lolly-demo-in-use.md) and
 * their banked figures. The figures copy Lolly Demo's colours by hand, so these tests
 * hold them to brands/lolly-demo/catalog/assets/lolly/tokens/demo.json, the way
 * tests/brand-page.test.ts holds /brand: every Opal swatch paints its token value and
 * none is missing, the chart strip keeps the spectrum order, every colourway card
 * states the lead, the colour on the lead and the partner of its set, and every Try
 * link asks for a colourway the design system has. The pages are meant to be mostly
 * pictures, so their prose outside figures, headings and links stays short.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');
const TOKENS = JSON.parse(read('brands/lolly-demo/catalog/assets/lolly/tokens/demo.json'));
const BRAND: Record<string, { $value: string }> = TOKENS.base.color.brand;
/** Interface shades of Liquorice for raised and panel surfaces, not palette colours. */
const INTERFACE_SHADES = new Set(['liquorice-raised', 'liquorice-panel']);
const hexOf = (token: string): string => {
  const value = BRAND[token]?.$value;
  assert.ok(value, `color.brand.${token} exists in Lolly Demo`);
  return value.toLowerCase();
};
const refToken = (ref: string): string => {
  const m = /^\{color\.brand\.([a-z-]+)\}$/.exec(ref);
  assert.ok(m, `${ref} points at an Opal colour`);
  return m[1]!;
};

const PAGES = ['docs/lolly-demo.md', 'docs/lolly-demo-in-use.md'];

test('every figure the Lolly Demo pages show is banked with its provenance', () => {
  for (const page of PAGES) {
    const ids = [...read(page).matchAll(/^::: figure ([a-z0-9-]+)$/gm)].map(m => m[1]!);
    assert.ok(ids.length >= 4, `${page} is mostly figures`);
    for (const id of ids) {
      assert.ok(existsSync(resolve(ROOT, `docs/figures/${id}.html`)), `docs/figures/${id}.html is banked`);
      assert.ok(existsSync(resolve(ROOT, `docs/figures/${id}.meta.json`)), `docs/figures/${id}.meta.json gives its provenance`);
    }
  }
});

test('the Lolly Demo pages keep their prose short', () => {
  for (const page of PAGES) {
    const prose = read(page)
      .replace(/^::: figure[\s\S]*?^:::$/gm, '')
      .split('\n')
      .filter(line => !/^\s*(#|!\[|\||:::)/.test(line))
      .join(' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
      .replace(/`[^`]*`/g, ' ');
    const words = prose.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
    assert.ok(words.length <= 160, `${page} has ${words.length} words of prose outside figures, headings and links (160 at most)`);
  }
});

test('every Opal swatch in the figure paints its design-system value, and none is missing', () => {
  const fig = read('docs/figures/lolly-demo-opal.html');
  const swatches = [...fig.matchAll(/<li class="ldo-sw" data-token="([a-z-]+)"><i(?: class="ldo-hdr")? style="--c:(#[0-9a-f]{6})"><\/i><b>([^<]+)<\/b><span>([^<]+)<\/span><\/li>/g)];
  assert.ok(swatches.length > 20, 'the figure lists its swatches');
  const seen = new Set<string>();
  for (const [, token = '', hex = '', , code = ''] of swatches) {
    assert.equal(hex, hexOf(token), `${token} is painted with its token value`);
    if (token !== 'daylight') assert.equal(code, hex, `${token} prints the value it paints`);
    seen.add(token);
  }
  const missing = Object.keys(BRAND).filter(name => !name.startsWith('$') && !INTERFACE_SHADES.has(name) && !seen.has(name));
  assert.deepEqual(missing, [], 'every Opal colour appears in the figure');
});

test('the chart strip keeps the spectrum order', () => {
  const fig = read('docs/figures/lolly-demo-opal.html');
  const bars = /<div class="ldo-bars"[^>]*>([\s\S]*?)<\/div>/.exec(fig)?.[1] ?? '';
  const painted = [...bars.matchAll(/--c:(#[0-9a-f]{6})/g)].map(m => m[1]);
  const spectrum = Object.entries(TOKENS.base.color.spectrum as Record<string, { $value: string }>)
    .filter(([k]) => !k.startsWith('$')).map(([, v]) => hexOf(refToken(v.$value)));
  assert.deepEqual(painted, spectrum);
});

test('every colourway card states the lead, the colour on the lead and the partner of its set', () => {
  const fig = read('docs/figures/lolly-demo-in-use-colourways.html');
  const ids = (TOKENS.$themes as Array<{ id?: string; group?: string }>).filter(t => t.group === 'colourway').map(t => t.id);
  const cards = [...fig.matchAll(/<li class="ldc-way" data-colourway-card="([a-z-]+)"[\s\S]*?<\/li>/g)];
  assert.deepEqual(cards.map(c => c[1]), ids, 'one card per colourway, in the design system order');
  for (const [html, id = ''] of cards) {
    for (const mode of ['light', 'dark'] as const) {
      const look = new RegExp(`<div class="ldc-look ldc-${mode}">[\\s\\S]*?<span class="ldc-btn" style="--l:(#[0-9a-f]{6});--o:(#[0-9a-f]{6})">([\\s\\S]*?)</dl></div>`).exec(html);
      assert.ok(look, `${id} shows a ${mode} look`);
      const set = TOKENS[`colourway/${id}`].color.colourway[mode];
      for (const role of ['primary', 'on-primary', 'secondary']) {
        const token = refToken(set[role].$value);
        const dd = new RegExp(`<dd data-role="${role}" data-token="([a-z-]+)"><i style="--c:(#[0-9a-f]{6})"></i>`).exec(look[3]!);
        assert.ok(dd, `${id} ${mode} states its ${role}`);
        assert.equal(dd[1], token, `${id} ${mode} ${role} is ${token}`);
        assert.equal(dd[2], hexOf(token), `${id} ${mode} ${role} is painted ${token}`);
      }
      assert.equal(look[1], hexOf(refToken(set.primary.$value)), `${id} ${mode}: the button fills with the lead`);
      assert.equal(look[2], hexOf(refToken(set['on-primary'].$value)), `${id} ${mode}: the button's words use the colour on the lead`);
    }
    const href = /<a class="ldc-try" href="([^"]+)"/.exec(html)?.[1];
    assert.ok(href, `${id} has a Try link`);
    const asked = new URL(href, 'https://lolly.tools').searchParams.get('_themes');
    const wanted = asked ? JSON.parse(asked).colourway : 'spearmint';
    assert.equal(wanted, id, `${id}'s Try link asks for ${id}`);
    assert.ok(ids.includes(wanted), `${wanted} is a colourway of Lolly Demo`);
  }
});
