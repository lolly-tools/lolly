// SPDX-License-Identifier: MPL-2.0
/**
 * Fail-loud checkpoint (packages/node-shell/src/render-integrity.ts).
 *
 * The Node shells must never write a broken file and report success when the render
 * silently failed. assertRenderOk throws when (1) a lifecycle hook threw (hookErrors,
 * any format) or (2) an SVG is degenerate — no size AND no drawable content — while
 * staying quiet for every legitimate small output (a 1×1 icon, an empty-but-valid CSV,
 * a valid tiny PNG). It also must not phrase its error so the TUI's HTML-fallback
 * regex swallows it.
 *
 * Run with: node --test tests/render-integrity.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { assertRenderOk, isDegenerateSvg, RenderIntegrityError } from '../packages/node-shell/src/render-integrity.ts';

const enc = (s: string): Uint8Array => new TextEncoder().encode(s);

// The exact shape brand-lockup emits when host.text is missing: empty geometry + only
// the injected provenance elements, no drawable children.
const DEGENERATE_SVG =
  '<?xml version="1.0" standalone="no"?>\n' +
  '<svg xmlns="http://www.w3.org/2000/svg" width="" height="" viewBox="0 0  " id="lockup-svg">' +
  '<title>Brand Lockup</title><desc>made with Lolly</desc>' +
  '<metadata><rdf:RDF></rdf:RDF></metadata>' +
  '</svg>';

const VALID_TINY_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>';

test('hookErrors → throws for ANY format (the primary, format-agnostic signal)', () => {
  const bytes = enc('anything');
  for (const format of ['svg', 'png', 'pdf', 'json', 'html']) {
    assert.throws(
      () => assertRenderOk({ hookErrors: [{ hook: 'onInit', message: "Cannot read properties of undefined (reading 'preload')" }], format, bytes }),
      RenderIntegrityError,
      `expected throw for format ${format}`,
    );
  }
});

test('degenerate SVG (no size, no drawable child) → throws', () => {
  assert.equal(isDegenerateSvg(enc(DEGENERATE_SVG)), true);
  assert.throws(() => assertRenderOk({ hookErrors: [], format: 'svg', bytes: enc(DEGENERATE_SVG) }), RenderIntegrityError);
});

test('valid tiny SVG (real viewBox + a <path>) → passes', () => {
  assert.equal(isDegenerateSvg(enc(VALID_TINY_SVG)), false);
  assert.doesNotThrow(() => assertRenderOk({ hookErrors: [], format: 'svg', bytes: enc(VALID_TINY_SVG) }));
});

test('SVG with size but no viewBox → passes (has positive width/height)', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="1162.56" height="1066.6"><path d="M1 1"/></svg>';
  assert.equal(isDegenerateSvg(enc(svg)), false);
});

test('SVG with a real viewBox but (temporarily) only provenance children → passes (has size)', () => {
  // A tool that sized its canvas but whose content is still loading must NOT be flagged
  // just because a frame has no drawable child — size present ⇒ not degenerate.
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>x</title></svg>';
  assert.equal(isDegenerateSvg(enc(svg)), false);
});

test('non-SVG outputs with no hookErrors → never flagged (byte size is never a heuristic)', () => {
  // A valid-but-tiny PNG (8-byte signature) and an empty-but-valid CSV/JSON must pass.
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.doesNotThrow(() => assertRenderOk({ hookErrors: [], format: 'png', bytes: png }));
  assert.doesNotThrow(() => assertRenderOk({ hookErrors: [], format: 'csv', bytes: enc('') }));
  assert.doesNotThrow(() => assertRenderOk({ hookErrors: [], format: 'json', bytes: enc('{}') }));
});

test('error message avoids the TUI HTML-fallback regex (/<svg>|requires an|browser engine/i)', () => {
  const re = /<svg>|requires an|browser engine/i;
  const hookErr = new RenderIntegrityError('hook-failed', '', [{ hook: 'onInit', message: 'boom' }]);
  // Capture the actual thrown messages.
  let hookMsg = '', svgMsg = '';
  try { assertRenderOk({ hookErrors: [{ hook: 'onInit', message: 'x' }], format: 'svg', bytes: enc('x') }); }
  catch (e) { hookMsg = (e as Error).message; }
  try { assertRenderOk({ hookErrors: [], format: 'svg', bytes: enc(DEGENERATE_SVG) }); }
  catch (e) { svgMsg = (e as Error).message; }
  assert.ok(hookMsg && !re.test(hookMsg), `hook-failed message must not match TUI fallback regex: ${hookMsg}`);
  assert.ok(svgMsg && !re.test(svgMsg), `degenerate-svg message must not match TUI fallback regex: ${svgMsg}`);
  assert.equal(hookErr.reason, 'hook-failed');
});
