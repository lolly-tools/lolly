// SPDX-License-Identifier: MPL-2.0
/**
 * extract-site.test.ts - the website source's parser, against a realistic page
 * and against a hostile one.
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/extract-site.test.ts"
 *
 * The realistic fixture is asserted as ONE exact object rather than field by
 * field: ordering (weight-descending, first-seen tie-break), the kind a colour
 * inherits from where it was first seen, and the logo ranking are all contract,
 * and a per-field assertion would let any of them drift unnoticed.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractSite } from './extract-site.ts';
import type { SiteExtract } from './extract-site.ts';

// ── A page that looks like a real small site ────────────────────────────────────

const SITE_HTML = `<!doctype html>
<html lang="en">
<head>
  <title>Northwind Coffee &amp; Roasters</title>
  <meta charset="utf-8">
  <meta property="og:site_name" content="Northwind Coffee">
  <meta property="og:image" content="/img/og-card.png">
  <meta name="theme-color" content="#0b3d2e">
  <link rel="icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png">
  <link rel="shortcut icon" href="/favicon-16.png">
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700&amp;family=Space+Grotesk:wght@500&amp;display=swap">
  <style>
    :root { --brand-primary: #0b3d2e; --brand-accent: rgb(214, 122, 42); }
    body { color: #21262b; background-color: #ffffff; font-family: Inter, system-ui, sans-serif; }
    h1, h2 { color: #0b3d2e; font-family: "Space Grotesk", Inter, sans-serif; }
    code { font-family: "IBM Plex Mono", ui-monospace, monospace; }
    .cta { background: linear-gradient(90deg, #0b3d2e, #d67a2a); border: 1px solid #0b3d2e; }
    .ghost { background: transparent; color: currentColor; }
    .hero { background-image: url(/img/hero-red.jpg); }
  </style>
  <script>var theme = { color: "#123456" };</script>
</head>
<body>
  <img src="/img/northwind-logo.svg" alt="Northwind logo" class="site-logo">
  <img src="/img/hero.jpg" alt="A cafe counter">
  <p style="color:#6b7280">Since 1998.</p>
</body>
</html>`;

const SITE_CSS = `.footer { background: #0b3d2e; color: #ffffff; }
.footer a { color: #d67a2a; }
.card { font-family: Inter, sans-serif; }`;

const EXPECTED: SiteExtract = {
  census: {
    colors: [
      { hex: '#0b3d2e', weight: 6, kind: 'fill' },
      { hex: '#d67a2a', weight: 3, kind: 'text' },
      { hex: '#ffffff', weight: 2, kind: 'text' },
      { hex: '#21262b', weight: 1, kind: 'text' },
      { hex: '#6b7280', weight: 1, kind: 'text' },
    ],
    gradients: [{ stops: ['#0b3d2e', '#d67a2a'], angle: 90, weight: 1 }],
    fonts: [
      { family: 'Inter', usage: 'body', count: 2 },
      { family: 'Space Grotesk', usage: 'heading', count: 1 },
      { family: 'IBM Plex Mono', usage: 'mono', count: 1 },
    ],
    name: 'Northwind Coffee',
    source: { kind: 'site', label: 'northwind.example' },
  },
  logoUrls: [
    'https://northwind.example/img/og-card.png',
    'https://northwind.example/apple-touch-icon.png',
    'https://northwind.example/favicon.ico',
    'https://northwind.example/favicon-16.png',
    'https://northwind.example/img/northwind-logo.svg',
  ],
  siteName: 'Northwind Coffee',
  googleFamilies: ['Inter', 'Space Grotesk'],
};

test('a realistic page reads out as one exact census', () => {
  const got = extractSite({
    html: SITE_HTML,
    cssTexts: [SITE_CSS],
    baseUrl: 'https://northwind.example/shop?ref=nav',
  });
  assert.deepStrictEqual(got, EXPECTED);
});

test('the page’s own paint is read, and nothing else is', () => {
  const { census } = extractSite({ html: SITE_HTML, cssTexts: [SITE_CSS], baseUrl: 'https://northwind.example/' });
  const hexes = census.colors.map(c => c.hex);
  // `background-image: url(/img/hero-red.jpg)` - "red" is a named colour, but it
  // is a filename here; url() is stripped before the value is tokenised.
  assert.ok(!hexes.includes('#ff0000'), 'a colour word inside url() is not paint');
  // The <script> body is skipped wholesale, so a JS literal is not a declaration.
  assert.ok(!hexes.includes('#123456'), 'script text is not stylesheet text');
  // `transparent` / `currentColor` name no paint.
  assert.equal(hexes.length, 5);
  assert.ok(!census.fonts.some(f => /^(?:system-ui|sans-serif|ui-monospace|monospace)$/i.test(f.family)));
});

test('meta beats title, and og:site_name beats og:title', () => {
  const title = '<html><head><title>Just The Title</title></head></html>';
  assert.equal(extractSite({ html: title }).siteName, 'Just The Title');

  const withOgTitle = `<head><title>Tab Title</title><meta property="og:title" content="Card Title"></head>`;
  assert.equal(extractSite({ html: withOgTitle }).siteName, 'Card Title');

  const withBoth = `<head><title>Tab Title</title>
    <meta property="og:title" content="Card Title">
    <meta property="og:site_name" content="The Site"></head>`;
  assert.equal(extractSite({ html: withBoth }).siteName, 'The Site');
});

test('google font links yield families from css2 and the legacy syntax', () => {
  const html = `<head>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400&amp;family=IBM+Plex+Mono&amp;display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Roboto:400,700|Open+Sans">
    <link rel="stylesheet" href="/local.css">
  </head>`;
  assert.deepStrictEqual(
    extractSite({ html }).googleFamilies,
    ['Fraunces', 'IBM Plex Mono', 'Roboto', 'Open Sans'],
  );
});

test('the heading heuristic reads whole selector tokens only', () => {
  const css = `.hero-h1 { font-family: Alpha, sans-serif; }
    h3 > span { font-family: Beta, sans-serif; }
    #h1x { font-family: Gamma, sans-serif; }`;
  const fonts = extractSite({ html: '', cssTexts: [css] }).census.fonts;
  assert.deepStrictEqual(fonts, [
    { family: 'Alpha', usage: 'body', count: 1 },
    { family: 'Beta', usage: 'heading', count: 1 },
    { family: 'Gamma', usage: 'body', count: 1 },
  ]);
});

test('a style attribute takes its usage hint from its own tag', () => {
  const html = `<h2 style="font-family:Zeta, serif">Hi</h2><p style="font-family:Zeta, serif">Hi</p>`;
  assert.deepStrictEqual(
    extractSite({ html }).census.fonts,
    [{ family: 'Zeta', usage: 'heading', count: 2 }],
  );
});

// ── Empty and hostile input ────────────────────────────────────────────────────

test('empty input returns an empty census and never throws', () => {
  assert.deepStrictEqual(extractSite({ html: '' }), {
    census: { colors: [], gradients: [], fonts: [], source: { kind: 'site', label: 'site' } },
    logoUrls: [],
    googleFamilies: [],
  });
  // An unparseable baseUrl degrades the label rather than failing the parse.
  assert.deepStrictEqual(extractSite({ html: '', cssTexts: [], baseUrl: 'not an address' }), {
    census: { colors: [], gradients: [], fonts: [], source: { kind: 'site', label: 'site' } },
    logoUrls: [],
    googleFamilies: [],
  });
});

test('broken markup is skipped, not thrown on', () => {
  const html = `<html><head
    <title>Half A Title
    <meta content="#0b3d2e" name=theme-color>
    <link rel=icon href=/x.png>
    <img src="unterminated.png alt=logo>
    <style>.a { color: #ff6600
    <p style=color:#123456>text
  </head>`;
  const got = extractSite({ html, baseUrl: 'https://ex.test/a/b' });
  assert.equal(got.census.source.label, 'ex.test');
  assert.deepStrictEqual(got.logoUrls, ['https://ex.test/x.png']);
  assert.ok(got.census.colors.some(c => c.hex === '#0b3d2e'), 'an unquoted meta still reads');
  // The unterminated <style> reads to the end of the document; the unterminated
  // attribute quote drops exactly one tag and nothing else.
  assert.ok(got.census.colors.some(c => c.hex === '#ff6600'));
});

test('the match cap holds on a pathological stylesheet, and type survives it', () => {
  const noise = new Array(120_000).fill('.x{color:#ff0000}').join('\n');
  const css = `.head { font-family: Fraunces, serif; }\nh1 { font-family: Fraunces, serif; }\n${noise}`;
  const started = Date.now();
  const got = extractSite({ html: '<title>Loud</title>', cssTexts: [css], baseUrl: 'https://loud.test/' });
  const elapsed = Date.now() - started;

  assert.ok(elapsed < 5_000, `parsing took ${elapsed}ms`);
  assert.equal(got.census.colors.length, 1);
  const weight = got.census.colors[0]!.weight;
  assert.ok(weight > 1_000, `expected real work before the cap, got ${weight}`);
  assert.ok(weight < 120_000, `the cap did not hold: ${weight}`);
  // Type is scanned before colour precisely so a wall of declarations cannot
  // starve the rarer, more valuable signal.
  assert.deepStrictEqual(got.census.fonts, [{ family: 'Fraunces', usage: 'heading', count: 2 }]);
});

test('a repeated logo candidate is counted once and the list is capped', () => {
  const links = new Array(40).fill(0)
    .map((_, i) => `<link rel="icon" href="/icon-${i % 3}.png">`)
    .join('');
  const imgs = new Array(40).fill(0)
    .map((_, i) => `<img src="/logo-${i}.svg" alt="logo">`)
    .join('');
  const got = extractSite({ html: `<head>${links}</head><body>${imgs}</body>`, baseUrl: 'https://c.test/' });
  assert.equal(got.logoUrls.length, 10);
  assert.deepStrictEqual(got.logoUrls.slice(0, 3), [
    'https://c.test/icon-0.png', 'https://c.test/icon-1.png', 'https://c.test/icon-2.png',
  ]);
  assert.equal(new Set(got.logoUrls).size, 10, 'no duplicates');
});
