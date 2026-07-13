// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for engine/src/svg-colors.ts — extractSvgColors(), the pure,
 * DOM-free scan that pulls the distinct colours out of raw SVG source text.
 *
 * Run with: node --test tests/svg-colors.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { extractSvgColors } from '../engine/src/svg-colors.ts';

// ── presentation attributes ──────────────────────────────────────────────────

test('hex / rgb / hsl / named colours via fill=/stroke=/stop-color= attributes', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg">
    <rect fill="#123456"/>
    <line stroke="rgb(255, 0, 0)"/>
    <stop stop-color="hsl(240, 100%, 50%)"/>
    <path fill="rebeccapurple"/>
  </svg>`;
  const colors = extractSvgColors(svg);
  assert.ok(colors.includes('#123456'), 'hex fill');
  assert.ok(colors.includes('#ff0000'), 'rgb() stroke → hex');
  assert.ok(colors.includes('#0000ff'), 'hsl() stop-color → hex');
  assert.ok(colors.includes('rebeccapurple'), 'named colour passes through verbatim');
});

test('#fff shorthand is expanded to #ffffff', () => {
  assert.deepEqual(extractSvgColors('<rect fill="#fff"/>'), ['#ffffff']);
});

test('flood-color / lighting-color / color attributes are scanned', () => {
  const svg = `<feFlood flood-color="#111111"/>
    <feDiffuseLighting lighting-color="#222222"/>
    <g color="#333333"/>`;
  const colors = extractSvgColors(svg);
  assert.ok(colors.includes('#111111'));
  assert.ok(colors.includes('#222222'));
  assert.ok(colors.includes('#333333'));
});

test('single-quoted attribute values are handled', () => {
  assert.deepEqual(extractSvgColors(`<rect fill='#abcdef'/>`), ['#abcdef']);
});

// ── CSS declarations: style="…" and <style> blocks ───────────────────────────

test('the same colours found via style="…" CSS declarations', () => {
  const svg = `<svg>
    <rect style="fill:#123456;stroke:rgb(255, 0, 0)"/>
    <stop style="stop-color: hsl(240, 100%, 50%)"/>
    <path style="fill: rebeccapurple"/>
  </svg>`;
  const colors = extractSvgColors(svg);
  assert.ok(colors.includes('#123456'));
  assert.ok(colors.includes('#ff0000'));
  assert.ok(colors.includes('#0000ff'));
  assert.ok(colors.includes('rebeccapurple'));
});

test('the same colours found inside a <style> block', () => {
  const svg = `<svg>
    <style>
      .a { fill: #00ff00; }
      .b { stroke: navy; }
      #c { stop-color: rgb(10, 20, 30); }
    </style>
    <rect class="a"/>
  </svg>`;
  const colors = extractSvgColors(svg);
  assert.ok(colors.includes('#00ff00'));
  assert.ok(colors.includes('navy'));
  assert.ok(colors.includes('#0a141e'));
});

test('a trailing !important is stripped before normalising', () => {
  assert.deepEqual(
    extractSvgColors(`<rect style="fill: #ff0000 !important;"/>`),
    ['#ff0000'],
  );
});

// ── exclusions ────────────────────────────────────────────────────────────────

test('none / transparent / currentColor / inherit are excluded', () => {
  const svg = `<svg>
    <rect fill="none" stroke="transparent"/>
    <path color="currentColor" style="fill:inherit;stroke:initial"/>
    <g fill="unset"/>
  </svg>`;
  assert.deepEqual(extractSvgColors(svg), []);
});

test('url(#gradient) paint references are excluded, but the gradient\'s own stop-color IS picked up', () => {
  const svg = `<svg>
    <defs>
      <linearGradient id="g">
        <stop offset="0" stop-color="#abcdef"/>
        <stop offset="1" stop-color="#fedcba"/>
      </linearGradient>
    </defs>
    <rect fill="url(#g)" stroke="url('#g')"/>
  </svg>`;
  const colors = extractSvgColors(svg);
  assert.deepEqual(colors, ['#abcdef', '#fedcba']);
});

// ── dedupe + ordering ─────────────────────────────────────────────────────────

test('duplicate colours across multiple elements collapse to one entry', () => {
  const svg = `<svg>
    <rect fill="#ff0000"/>
    <rect fill="#ff0000"/>
    <circle style="fill:#ff0000"/>
    <line stroke="#ff0000"/>
  </svg>`;
  assert.deepEqual(extractSvgColors(svg), ['#ff0000']);
});

test('a named colour dedupes case-insensitively, keeping the first-seen casing', () => {
  // colorToHex normalises hex/rgb()/hsl() to lowercase, but passes a bare
  // named colour through verbatim — "RED" and "red" must still collapse to
  // one entry rather than surviving as two "different" colours.
  assert.deepEqual(extractSvgColors('<rect fill="RED"/><rect fill="red"/>'), ['RED']);
  assert.deepEqual(extractSvgColors('<rect fill="red"/><rect fill="RED"/>'), ['red']);
});

test('order is first-seen', () => {
  const svg = `<rect fill="#111111"/><rect fill="#222222"/><rect fill="#333333"/>`;
  assert.deepEqual(extractSvgColors(svg), ['#111111', '#222222', '#333333']);
});

// ── rejection of stray non-colour words ───────────────────────────────────────

test('a non-colour bare word (e.g. "bold") is rejected', () => {
  const svg = `<text fill="bold" stroke="banana" style="fill: sans-serif">x</text>`;
  assert.deepEqual(extractSvgColors(svg), []);
});

test('a real named colour is accepted while a look-alike word is rejected', () => {
  const svg = `<rect fill="orange"/><rect fill="orangey"/>`;
  const colors = extractSvgColors(svg);
  assert.ok(colors.includes('orange'), 'orange is a real CSS colour');
  assert.ok(!colors.includes('orangey'), 'orangey is not');
});

test('a non-target property that ends in a colour keyword is not matched', () => {
  // `background-color` / `text-color` are not SVG presentation colours; the
  // (?<![-\\w]) guard must keep the trailing `color` from matching.
  const svg = `<rect style="background-color:#ff0000;border-color:navy"/>`;
  assert.deepEqual(extractSvgColors(svg), []);
});

// ── robustness ─────────────────────────────────────────────────────────────────

test('malformed / incomplete / non-SVG input does not throw', () => {
  assert.deepEqual(extractSvgColors(''), []);
  assert.doesNotThrow(() => extractSvgColors('<svg><rect fill="#fff"'));
  assert.doesNotThrow(() => extractSvgColors('not xml at all <<< >>> fill=:; {}'));
  assert.doesNotThrow(() => extractSvgColors('<rect style="fill:'));
  // A non-string argument is tolerated (returns []).
  assert.deepEqual(extractSvgColors(undefined as unknown as string), []);
  assert.deepEqual(extractSvgColors(null as unknown as string), []);
});

test('an unclosed but well-formed-enough tag still yields its colour', () => {
  assert.deepEqual(extractSvgColors('<svg><rect fill="#0a0b0c"'), ['#0a0b0c']);
});
