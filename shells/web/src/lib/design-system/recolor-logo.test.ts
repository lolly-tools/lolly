// SPDX-License-Identifier: MPL-2.0
/**
 * recolor-logo.ts - derived mono/reverse logo variants (plan 97 section 7.3).
 *
 * Run with:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/recolor-logo.test.ts"
 *
 * The fixtures are deliberately fussy about whitespace, attribute order and
 * comments: the headline property of this module is that nothing but a paint
 * VALUE ever moves, so several cases assert the whole output string rather than
 * a substring.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hexToOklch } from '@lolly/engine';
import {
  deriveMonoSvg,
  deriveReverseSvg,
  eligibleForDerivedVariants,
} from './recolor-logo.ts';

// A wide two-colour wordmark, with a comment, an id, a `none` stroke and a
// mixture of hex and rgb() notation.
const TWO_COLOUR = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 25">',
  '  <!-- wordmark -->',
  '  <rect id="bar" x="0" y="0" width="60" height="25" fill="#d0122a" />',
  '  <path id="glyph" d="M70 0 H100 V25 H70 Z" fill="rgb(0, 40, 200)" stroke="none"/>',
  '</svg>',
].join('\n');

test('a two-colour mark monos to one ink, and nothing else moves', () => {
  const out = deriveMonoSvg(TWO_COLOUR, '#123456');
  assert.equal(out, [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 25">',
    '  <!-- wordmark -->',
    '  <rect id="bar" x="0" y="0" width="60" height="25" fill="#123456" />',
    '  <path id="glyph" d="M70 0 H100 V25 H70 Z" fill="#123456" stroke="none"/>',
    '</svg>',
  ].join('\n'));
});

test('the ink is normalised by the engine, never pasted through', () => {
  const out = deriveMonoSvg(TWO_COLOUR, 'red');
  assert.ok(out);
  assert.ok(out.includes('fill="#ff0000"'), out);
  assert.ok(!out.includes('fill="red"'), 'the raw ink string reached the document');
});

test('an ink that is not a colour derives nothing', () => {
  assert.equal(deriveMonoSvg(TWO_COLOUR, 'not-a-colour'), null);
  assert.equal(deriveMonoSvg(TWO_COLOUR, '#00000000'), null);
  // A value shaped to break out of the attribute is refused at the door, so it
  // can never be spliced into the source text.
  assert.equal(deriveMonoSvg(TWO_COLOUR, '#123456" onload="x'), null);
  assert.equal(deriveMonoSvg(TWO_COLOUR, 'red;fill:url(#x)'), null);
});

test('mono keeps a translucent paint translucent', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="rgba(0, 0, 0, 0.5)"/></svg>';
  assert.equal(
    deriveMonoSvg(svg, '#123456'),
    '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#12345680"/></svg>',
  );
});

test('mono returns null when the mark is already that one ink', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>';
  assert.equal(deriveMonoSvg(svg, '#123456'), null);
});

test('"already this one ink" is judged on the COLOUR, not on how it was written', () => {
  // The short-circuit compares the engine's normalised hex against the engine's
  // normalised hex. An uppercase, shorthand or named authorship of the same ink
  // is the same ink, so there is still no variant to offer - otherwise the room
  // offers a "Generated Mono" chip for a mark that is already exactly that.
  for (const authored of ['#0B1F3A', 'rgb(11, 31, 58)', 'rgb(11 31 58 / 100%)']) {
    const svg = `<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="${authored}"/></svg>`;
    assert.equal(deriveMonoSvg(svg, '#0b1f3a'), null, authored);
  }
  assert.equal(
    deriveMonoSvg('<svg viewBox="0 0 10 10"><rect fill="#FFF"/></svg>', 'white'),
    null,
  );
  // …and an ink that really is different still derives, uppercase or not.
  assert.equal(
    deriveMonoSvg('<svg viewBox="0 0 10 10"><rect fill="#0B1F3A"/></svg>', '#111111'),
    '<svg viewBox="0 0 10 10"><rect fill="#111111"/></svg>',
  );
});

test('reverse ignores authorship case too, and still flips a dark ink', () => {
  // White written as #FFFFFF is not dark, so it is never touched; a dark ink
  // written in uppercase is flipped exactly once.
  assert.equal(deriveReverseSvg('<svg viewBox="0 0 10 10"><rect fill="#FFFFFF"/></svg>'), null);
  assert.equal(
    deriveReverseSvg('<svg viewBox="0 0 10 10"><rect fill="#0B1F3A"/></svg>'),
    '<svg viewBox="0 0 10 10"><rect fill="#ffffff"/></svg>',
  );
});

// ── Reverse ───────────────────────────────────────────────────────────────────

const DARK_MARK = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">',
  '  <circle cx="20" cy="20" r="20" fill="#111111"/>',
  '  <path d="M10 10 H30" stroke="#cccccc" fill="none"/>',
  '</svg>',
].join('\n');

test('the fixture inks sit either side of the dark threshold', () => {
  // Guards the fixture itself: if the engine ever moved, the reverse assertions
  // below would silently stop testing what they claim to.
  assert.ok(hexToOklch('#111111')!.l < 0.35);
  assert.ok(hexToOklch('#cccccc')!.l >= 0.35);
});

test('a dark mark reverses: dark ink goes white, light ink is kept', () => {
  assert.equal(deriveReverseSvg(DARK_MARK), [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40">',
    '  <circle cx="20" cy="20" r="20" fill="#ffffff"/>',
    '  <path d="M10 10 H30" stroke="#cccccc" fill="none"/>',
    '</svg>',
  ].join('\n'));
});

test('reverse keeps the paint alpha', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="rgba(0, 0, 0, .5)"/></svg>';
  assert.equal(
    deriveReverseSvg(svg),
    '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#ffffff80"/></svg>',
  );
});

test('reverse returns null when there is no dark ink to flip', () => {
  const light = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#cccccc"/></svg>';
  assert.equal(deriveReverseSvg(light), null);
  assert.deepEqual(eligibleForDerivedVariants(light), {
    mono: true,
    reverse: false,
    reason: 'no dark ink to reverse',
  });
});

test('currentColor is recoloured by mono and left alone by reverse', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="currentColor"/></svg>';
  assert.equal(
    deriveMonoSvg(svg, '#123456'),
    '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="#123456"/></svg>',
  );
  assert.equal(deriveReverseSvg(svg), null);
});

// ── Gradients and patterns ────────────────────────────────────────────────────

const GRADIENT_MARK = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50">',
  '  <defs><linearGradient id="g"><stop offset="0" stop-color="#000000"/>',
  '  <stop offset="1" stop-color="#ff0000"/></linearGradient></defs>',
  '  <rect width="50" height="50" fill="url(#g)"/>',
  '</svg>',
].join('\n');

test('a gradient mark derives nothing, and eligibility says why', () => {
  assert.equal(deriveMonoSvg(GRADIENT_MARK, '#123456'), null);
  assert.equal(deriveReverseSvg(GRADIENT_MARK), null);
  assert.deepEqual(eligibleForDerivedVariants(GRADIENT_MARK), {
    mono: false,
    reverse: false,
    reason: 'painted with a gradient or pattern',
  });
});

test('a pattern reference blocks it the same way', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" style="fill: url(#dots)"/></svg>';
  assert.equal(deriveMonoSvg(svg, '#123456'), null);
  assert.equal(eligibleForDerivedVariants(svg).reason, 'painted with a gradient or pattern');
});

// ── Style declarations ────────────────────────────────────────────────────────

const STYLED_MARK = [
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">',
  '  <style>.a { fill: #000000; stroke: navy !important }</style>',
  '  <rect class="a" width="20" height="20" style="fill: red; stroke-width: 2"/>',
  '</svg>',
].join('\n');

test('style-attribute and <style>-block paints are covered, !important survives', () => {
  assert.equal(deriveMonoSvg(STYLED_MARK, '#123456'), [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">',
    '  <style>.a { fill: #123456; stroke: #123456 !important }</style>',
    '  <rect class="a" width="20" height="20" style="fill: #123456; stroke-width: 2"/>',
    '</svg>',
  ].join('\n'));
});

test('reverse reads style declarations too', () => {
  const out = deriveReverseSvg(STYLED_MARK);
  assert.ok(out);
  assert.ok(out.includes('fill: #ffffff;'), out);     // #000000 was dark
  assert.ok(out.includes('stroke: #ffffff !important'), out); // navy is dark
  assert.ok(out.includes('style="fill: red;'), 'red is not dark ink');
});

// ── Fidelity: only paint values move ──────────────────────────────────────────

test('text content that reads like a declaration is not markup and is not edited', () => {
  const svg = [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 60 20">',
    '  <text x="0" y="10">fill: red</text>',
    '  <rect width="10" height="10" fill="#000080"/>',
    '</svg>',
  ].join('\n');
  const out = deriveMonoSvg(svg, '#123456');
  assert.ok(out);
  assert.ok(out.includes('>fill: red<'), out);
  assert.ok(out.includes('fill="#123456"'), out);
});

test('commented-out markup is not edited', () => {
  const svg = [
    '<svg viewBox="0 0 10 10">',
    '  <!-- <rect width="10" height="10" fill="#000000"/> -->',
    '  <rect width="10" height="10" fill="#000080"/>',
    '</svg>',
  ].join('\n');
  const out = deriveMonoSvg(svg, '#123456');
  assert.ok(out);
  assert.ok(out.includes('<!-- <rect width="10" height="10" fill="#000000"/> -->'), out);
  assert.equal(out.match(/#123456/g)?.length, 1);
});

test('a paint that is not readable as a colour keeps the text the author wrote', () => {
  const svg = [
    '<svg viewBox="0 0 10 10">',
    `  <rect width="10" height="10" fill='"><script>alert(1)</script>'/>`,
    '  <rect width="10" height="10" fill="var(--brand)"/>',
    '  <rect width="10" height="10" fill="#000080"/>',
    '</svg>',
  ].join('\n');
  const out = deriveMonoSvg(svg, '#123456');
  assert.ok(out);
  assert.ok(out.includes(`fill='"><script>alert(1)</script>'`), out);
  assert.ok(out.includes('fill="var(--brand)"'), out);
  assert.equal(out.match(/#123456/g)?.length, 1);
});

// ── Hostile and degenerate input ──────────────────────────────────────────────

test('hostile and malformed input is tolerated, never thrown on', () => {
  const cases: unknown[] = [
    '',
    '   ',
    'not svg at all',
    '<svg',
    '<svg viewBox="0 0 1 1"><rect fill=',
    '<svg><rect fill="#"/><circle stroke=""/><path fill="   "/></svg>',
    '<svg><style>.a{fill:</style><rect style="fill"/></svg>',
    `<svg><rect fill="#000" onclick="alert('x')"/></svg>`,
    '<svg>'.padEnd(5000, ' ') + '<rect fill="#000000"/></svg>',
    null,
    undefined,
    42,
    { toString: () => '<svg><rect fill="#000"/></svg>' },
  ];
  for (const input of cases) {
    const text = input as string;
    assert.doesNotThrow(() => deriveMonoSvg(text, '#123456'), `mono threw on ${String(input)}`);
    assert.doesNotThrow(() => deriveReverseSvg(text), `reverse threw on ${String(input)}`);
    assert.doesNotThrow(
      () => eligibleForDerivedVariants(text),
      `eligibility threw on ${String(input)}`,
    );
  }
});

test('non-SVG input is ineligible, with a reason', () => {
  assert.deepEqual(eligibleForDerivedVariants('hello'), {
    mono: false,
    reverse: false,
    reason: 'not readable as an SVG',
  });
  assert.equal(deriveMonoSvg('hello', '#123456'), null);
  assert.equal(deriveReverseSvg('hello'), null);
});

test('an SVG with nothing to recolour is ineligible, with a reason', () => {
  const svg = '<svg viewBox="0 0 10 10"><rect width="10" height="10" fill="none"/></svg>';
  assert.deepEqual(eligibleForDerivedVariants(svg), {
    mono: false,
    reverse: false,
    reason: 'no paints found',
  });
  assert.equal(deriveMonoSvg(svg, '#123456'), null);
});

test('a mark with dark ink is eligible for both, with no reason to report', () => {
  assert.deepEqual(eligibleForDerivedVariants(DARK_MARK), { mono: true, reverse: true });
});

test('a mid-tone colour mark monos but does not reverse', () => {
  // Neither the crimson nor the blue is below the dark threshold, so there is
  // no near-black ink to flip and the room should not offer a reverse variant.
  assert.deepEqual(eligibleForDerivedVariants(TWO_COLOUR), {
    mono: true,
    reverse: false,
    reason: 'no dark ink to reverse',
  });
  assert.equal(deriveReverseSvg(TWO_COLOUR), null);
});

test('reasons are chip-sized plain English', () => {
  const reasons = [
    eligibleForDerivedVariants('hello').reason,
    eligibleForDerivedVariants(GRADIENT_MARK).reason,
    eligibleForDerivedVariants('<svg><rect fill="none"/></svg>').reason,
    eligibleForDerivedVariants('<svg><rect fill="#cccccc"/></svg>').reason,
  ];
  for (const reason of reasons) {
    assert.ok(reason && reason.length > 0 && reason.length <= 60, `not chip-sized: ${reason}`);
    assert.ok(!reason.includes('-'), `em-dash in reason: ${reason}`);
    assert.ok(!/'s\b/.test(reason), `possessive in reason: ${reason}`);
    assert.ok(!/\bbrand\b/i.test(reason), `says brand: ${reason}`);
  }
});

test('a large document stays bounded and correct', () => {
  const body = Array.from({ length: 2000 }, (_, i) => `<rect x="${i}" fill="#000080"/>`).join('');
  const svg = `<svg viewBox="0 0 2000 10">${body}</svg>`;
  const out = deriveMonoSvg(svg, '#123456');
  assert.ok(out);
  assert.equal(out.match(/#123456/g)?.length, 2000);
});
