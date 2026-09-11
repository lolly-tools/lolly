// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the css2 parser + subset filter (pure, no network).
 * Run directly:  node --test shells/web/src/lib/google-fonts.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseGoogleFontCss, keepFaces, GOOGLE_FAMILY_RE, encodeFamily, variableSpec, staticSpecs } from './google-fonts.ts';

// A trimmed, structurally-faithful css2 response: variable font, three subsets.
const CSS_VARIABLE = `
/* cyrillic */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v13/cyr.woff2) format('woff2');
  unicode-range: U+0301, U+0400-045F;
}
/* latin-ext */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v13/ext.woff2) format('woff2');
  unicode-range: U+0100-02BA;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v13/lat.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
/* latin */
@font-face {
  font-family: 'Inter';
  font-style: italic;
  font-weight: 100 900;
  font-display: swap;
  src: url(https://fonts.gstatic.com/s/inter/v13/lat-italic.woff2) format('woff2');
  unicode-range: U+0000-00FF;
}
`;

test('parses css2 blocks: family, weight range, subset, unicode-range, url', () => {
  const faces = parseGoogleFontCss(CSS_VARIABLE);
  assert.equal(faces.length, 4);
  const latin = faces.find(f => f.subset === 'latin' && f.style === 'normal')!;
  assert.equal(latin.family, 'Inter');
  assert.equal(latin.style, 'normal');
  assert.equal(latin.weight, '100 900');
  assert.equal(latin.url, 'https://fonts.gstatic.com/s/inter/v13/lat.woff2');
  assert.equal(latin.unicodeRange, 'U+0000-00FF');
});

test('parses the italic block with font-style: italic', () => {
  const italic = parseGoogleFontCss(CSS_VARIABLE).find(f => f.style === 'italic')!;
  assert.ok(italic);
  assert.equal(italic.subset, 'latin');
  assert.equal(italic.weight, '100 900');
  assert.equal(italic.url, 'https://fonts.gstatic.com/s/inter/v13/lat-italic.woff2');
});

test('keepFaces keeps latin + latin-ext + cyrillic (both slants), drops other subsets', () => {
  const kept = keepFaces(parseGoogleFontCss(CSS_VARIABLE));
  assert.deepEqual(kept.map(f => f.subset).sort(), ['cyrillic', 'latin', 'latin', 'latin-ext']);
  assert.equal(kept.filter(f => f.style === 'italic').length, 1);
});

test('keepFaces keeps everything when css names no subsets', () => {
  const css = `@font-face { font-family: 'Solo'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/s/solo/a.woff2) format('woff2'); }`;
  const kept = keepFaces(parseGoogleFontCss(css));
  assert.equal(kept.length, 1);
  assert.equal(kept[0]!.weight, '400');
});

test('legacy ttf responses are accepted (format:"truetype" recorded) - css2 serves this whenever it doesn\'t recognise the request as a modern browser, and discarding the whole family would make it undownloadable for no reason', () => {
  const css = `@font-face { font-family: 'Old'; src: url(https://fonts.gstatic.com/s/old/a.ttf) format('truetype'); }`;
  const faces = parseGoogleFontCss(css);
  assert.equal(faces.length, 1);
  assert.equal(faces[0]!.format, 'truetype');
  assert.equal(faces[0]!.url, 'https://fonts.gstatic.com/s/old/a.ttf');
});

test('otf responses are accepted too (format:"opentype")', () => {
  const css = `@font-face { font-family: 'Old'; src: url(https://fonts.gstatic.com/s/old/a.otf) format('opentype'); }`;
  const faces = parseGoogleFontCss(css);
  assert.equal(faces.length, 1);
  assert.equal(faces[0]!.format, 'opentype');
});

test('woff2 responses record format:"woff2"', () => {
  const kept = keepFaces(parseGoogleFontCss(CSS_VARIABLE));
  assert.ok(kept.every(f => f.format === 'woff2'));
});

test('an unrecognised extension (e.g. eot) is skipped - we truly can\'t use it', () => {
  const css = `@font-face { font-family: 'Old'; src: url(https://fonts.gstatic.com/s/old/a.eot) format('embedded-opentype'); }`;
  assert.equal(parseGoogleFontCss(css).length, 0);
});

test('family-name gate: plain names pass, injection shapes fail', () => {
  for (const ok of ['Inter', 'Source Sans 3', 'M PLUS Rounded 1c']) assert.ok(GOOGLE_FAMILY_RE.test(ok), ok);
  for (const bad of ['', ' Inter', "x'; url(", 'a{b}', 'font:family', 'x'.repeat(70)]) {
    assert.ok(!GOOGLE_FAMILY_RE.test(bad), JSON.stringify(bad));
  }
});

// ── spec builders (pure) ──────────────────────────────────────────────────────

test('encodeFamily turns spaces into +', () => {
  assert.equal(encodeFamily('Space Grotesk'), 'Space+Grotesk');
  assert.equal(encodeFamily('  Inter  '), 'Inter');
});

test('variableSpec asks for both slants across the weight range, upright first', () => {
  assert.equal(variableSpec('Inter', 100, 900), 'Inter:ital,wght@0,100..900;1,100..900');
  assert.equal(variableSpec('Figtree', 300, 900), 'Figtree:ital,wght@0,300..900;1,300..900');
});

test('staticSpecs ladder covers regular+bold, single weight, both slants, then bare', () => {
  const specs = staticSpecs('Anton');
  assert.deepEqual(specs, [
    'Anton:ital,wght@0,400;0,700;1,400;1,700',
    'Anton:ital,wght@0,400;1,400',
    'Anton:ital@0;1',
    'Anton',
  ]);
});
