// SPDX-License-Identifier: MPL-2.0
/**
 * Regression guard for the SVG upload sanitiser (picker.ts `sanitizeSvgFile`).
 *
 * An SVG is XML, but DOMPurify defaults to the HTML parser. Two failure modes this
 * pins, both seen with real HLC Colour Atlas exports:
 *
 *  1. DOMPurify's STRING output serialises a literal U+00A0 (non-breaking space, common
 *     in a tool's licence/caption text) as the HTML named entity `&nbsp;`, which is
 *     undefined in XML. normalizeSvg's strict `image/svg+xml` re-parse then fails with
 *     "Entity 'nbsp' not defined" and the SVG stores blank.
 *  2. Switching DOMPurify's parser to `application/xhtml+xml` avoids the entity but its
 *     strict XML parse silently DROPS content from some real SVGs (a clip-path-heavy
 *     atlas rendered blank) - a worse, harder-to-see regression.
 *
 * The fix is to sanitise to a DOM node (RETURN_DOM) and serialise with XMLSerializer:
 * U+00A0 stays a literal character (well-formed XML) AND nothing is dropped. This test
 * proves both properties against the real DOMPurify, and a source guard pins the
 * approach at the call site.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

async function dom() {
  const { JSDOM } = await import('jsdom');
  const createDOMPurify = (await import('dompurify')).default;
  const win = new JSDOM('').window;
  return { win, DOMPurify: createDOMPurify(win as unknown as Window & typeof globalThis) };
}

// A literal non-breaking space (U+00A0,  ) inside SVG text, beside real geometry.
const NBSP = '\u00a0';
const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40">`
  + `<rect x="0" y="0" width="100" height="40" fill="tomato"/>`
  + `<circle cx="50" cy="20" r="8" fill="white"/>`
  + `<text x="4" y="36">CC${NBSP}BY-ND</text></svg>`;

const geomCount = (s: string) => (s.match(/<(path|rect|circle|ellipse|polygon|polyline|line|text)\b/gi) || []).length;

test('OLD html-mode STRING output breaks a U+00A0 SVG (documents bug #1)', async () => {
  const { win, DOMPurify } = await dom();
  const clean = DOMPurify.sanitize(SVG, { USE_PROFILES: { svg: true, svgFilters: true } });
  const doc = new win.DOMParser().parseFromString(clean, 'image/svg+xml');
  assert.match(clean, /&nbsp;/, 'HTML-mode string serialises U+00A0 as the &nbsp; entity');
  assert.equal(!!doc.querySelector('parsererror'), true, 'the &nbsp; entity fails the strict XML re-parse');
});

test('RETURN_DOM + XMLSerializer is well-formed XML AND preserves all geometry (the fix)', async () => {
  const { win, DOMPurify } = await dom();
  const node = DOMPurify.sanitize(SVG, { USE_PROFILES: { svg: true, svgFilters: true }, RETURN_DOM: true }) as unknown as Element;
  const svgEl = node.querySelector('svg');
  assert.ok(svgEl, 'the sanitised DOM still has an <svg> root');
  const clean = new win.XMLSerializer().serializeToString(svgEl!);
  assert.doesNotMatch(clean, /&nbsp;/, 'XMLSerializer keeps U+00A0 literal, never the &nbsp; entity');
  const doc = new win.DOMParser().parseFromString(clean, 'image/svg+xml');
  assert.equal(!!doc.querySelector('parsererror'), false, 'the serialised SVG re-parses as valid XML');
  assert.equal(geomCount(clean), geomCount(SVG), 'no geometry is dropped (guards the xhtml-mode regression, bug #2)');
});

test('sanitizeSvgFile uses RETURN_DOM + XMLSerializer, not the content-dropping xhtml parser', () => {
  const src = readFileSync(resolve(HERE, 'picker.ts'), 'utf8');
  // Match the whole sanitize(...) call up to the statement's semicolon - `[^;]` spans
  // the nested config braces safely (no semicolon inside the call).
  const call = /DOMPurify\.sanitize\(text,[^;]*RETURN_DOM: true[^;]*\)/.exec(src);
  assert.ok(call, 'sanitizeSvgFile must sanitise to a DOM node (RETURN_DOM: true)');
  assert.doesNotMatch(
    call[0],
    /PARSER_MEDIA_TYPE/,
    'must NOT use PARSER_MEDIA_TYPE xhtml - its strict parse drops content from real SVGs',
  );
  assert.match(src, /new XMLSerializer\(\)\.serializeToString\(svgEl\)/, 'must serialise the node with XMLSerializer');
});
