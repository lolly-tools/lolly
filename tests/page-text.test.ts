// SPDX-License-Identifier: MPL-2.0
/**
 * url-shot's vector capture outlines a captured page's text in the shell, from the
 * faces the page loaded (packages/node-shell/src/page-text.ts). These cases pin how a
 * run finds its face and what happens when none fits, with a fake shaper so no font
 * file is needed. The browser half lives in url-shot-vector.browser.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFontFaceCss, normaliseWeight, pickFaces } from '../packages/node-shell/src/font-faces.ts';
import { outlinePageText, type PageTextDeps, type PageTextRun } from '../packages/node-shell/src/page-text.ts';

const OUTFIT = readFileSync(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url));

test('@font-face rules are read wherever they sit, with urls made absolute', () => {
  const css = `/* latin */
    @media screen { @font-face { font-family: "Brand Sans"; src: local("Brand"), url(fonts/brand.woff2) format("woff2"), url('/x/brand.woff') format('woff');
      font-weight: 300 700; font-style: normal; unicode-range: U+0000-00FF, U+0131; } }
    @font-face{font-family:Mono;src:url(https://cdn.example/mono.ttf);font-weight:bold;font-style:italic}
    @font-face { font-family: NoSource; src: local("Only") }`;
  const rules = parseFontFaceCss(css, 'https://site.example/css/main.css');
  assert.deepEqual(rules, [
    { family: 'Brand Sans', urls: ['https://site.example/css/fonts/brand.woff2', 'https://site.example/x/brand.woff'], weight: '300 700', style: 'normal', unicodeRange: 'U+0000-00FF, U+0131' },
    { family: 'Mono', urls: ['https://cdn.example/mono.ttf'], weight: '700', style: 'italic', unicodeRange: '' },
  ], 'a rule with only local() sources has no bytes in the page and is left out');
  assert.equal(normaliseWeight('normal'), '400');
  assert.equal(normaliseWeight('400 400'), '400');
  assert.equal(normaliseWeight('bold 900'), '700 900');
});

test('pickFaces takes the variable face at the run weight and keeps italic strict', () => {
  const faces = [
    { weight: '100 900', style: 'normal', unicodeRange: 'U+0000-00FF' },
    { weight: '100 900', style: 'normal', unicodeRange: 'U+0100-024F' },
  ];
  assert.deepEqual(pickFaces(faces, { fontStyle: 'normal', fontWeight: '650' }, 'Łódź Lodz'), [
    { face: faces[0], variations: ['wght=650'] },
    { face: faces[1], variations: ['wght=650'] },
  ], 'the subset carrying most of the run leads, its sibling covers the rest');
  assert.deepEqual(pickFaces(faces, { fontStyle: 'italic', fontWeight: '400' }, 'abc'), [], 'no italic face, no outline');
});

const run = (id: number, over: Partial<PageTextRun> = {}): PageTextRun => ({
  id, text: 'Hello', family: '"Brand Sans", Arial, sans-serif', weight: '700', style: 'normal', stretch: '100%',
  fontSize: 20, letterSpacing: 0, features: [], ...over,
});
const box = (id: number) => `<path d="M0 -16H50V4H0ZM0 0.${String(id).padStart(6, '0')}" transform="translate(10,30)" fill="rgb(1,2,3)" data-lolly-text="${id}"/>`;

function fakeDeps(over: Partial<PageTextDeps> = {}): PageTextDeps & { asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    fontBytes: async (url) => { asked.push(url); return url.endsWith('brand.ttf') ? new Uint8Array(OUTFIT) : null; },
    sheetText: async () => '@font-face{font-family:"Brand Sans";src:url(brand.ttf);font-weight:100 900}',
    fontUrl: async () => 'data:font/ttf;base64,AA==',
    toPath: async (o) => ({ d: `M0 0L${o.text.length} 0`, advanceWidth: 0, bbox: null, notdef: o.text.includes('?') ? 1 : 0 }),
    ...over,
  } as PageTextDeps & { asked: string[] };
}

test('a run is outlined from the face the page loaded for its family, found in a sheet the page withheld', async () => {
  const deps = fakeDeps();
  const svg = `<svg>${box(0)}${box(1)}${box(2)}</svg>`;
  const runs = [run(0), run(1, { family: 'Georgia, serif' }), run(2, { text: 'He?lo' })];
  const fonts = {
    loaded: [{ family: 'Brand Sans', weight: '100 900', style: 'normal', unicodeRange: '' }],
    rules: [],
    sheets: ['https://site.example/css/main.css'],
  };
  const out = await outlinePageText(svg, runs, fonts, deps);
  assert.equal(out.outlined, 1);
  assert.equal(out.kept, 2);
  assert.deepEqual(deps.asked, ['https://site.example/css/brand.ttf'], 'one fetch for the one face, shared by every run');
  assert.match(out.svg, /<path d="M0 0L5 0" transform="translate\(10,30\)" fill="rgb\(1,2,3\)"\/>/,
    'the outline replaces the box and keeps where the walk put the line');
  assert.doesNotMatch(out.svg, /data-lolly-text/, 'the run tag does not travel into the file');
  // A system font has no file in the page; a glyph the face lacks would draw tofu.
  assert.match(out.svg, /<text transform="translate\(10,30\)" fill="rgb\(1,2,3\)" xml:space="preserve" font-family="Georgia, serif" font-size="20" font-weight="700" font-style="normal">Hello<\/text>/);
  assert.match(out.svg, />He\?lo<\/text>/);
});

test('a face the page declared but never loaded is not used', async () => {
  const out = await outlinePageText(`<svg>${box(0)}</svg>`, [run(0)], { loaded: [], rules: [{ family: 'Brand Sans', weight: '700', style: 'normal', unicodeRange: '', urls: ['https://site.example/brand.ttf'] }], sheets: [] }, fakeDeps());
  assert.equal(out.outlined, 0);
  assert.equal(out.kept, 1);
});

test('an unreadable font file is reported and its runs stay text', async () => {
  const deps = fakeDeps({ fontBytes: async () => new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]) });
  const out = await outlinePageText(`<svg>${box(0)}</svg>`, [run(0)], { loaded: [{ family: 'Brand Sans', weight: '100 900', style: 'normal', unicodeRange: '' }], rules: [], sheets: ['https://site.example/css/main.css'] }, deps);
  assert.deepEqual(out.unreadable, ['https://site.example/css/brand.ttf']);
  assert.equal(out.kept, 1);
});
