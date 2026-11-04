// SPDX-License-Identifier: MPL-2.0
/**
 * The palette pane's markup and its at-rest chrome (plan 346 changes 7, 8 and 18).
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test "shells/web/src/lib/design-system/palette-view.test.ts"
 *
 * Three things a first visit sees:
 *  - the blank state. "Starter colours 9" used to sit folded over an empty
 *    space, which read as an empty group. With nothing of the
 *    person's own yet the group is open, says what it is, and shows the nine.
 *  - a role's tile says the role in words ("Primary"), not a letter.
 *  - at rest a swatch is colour, name and hex; the checkbox and the drag handle
 *    come with Select. That last one is CSS, so it is pinned against the sheet.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { paletteHtml } from './palette-view.ts';
import { colorIdentity } from './ownership.ts';
import type { BrandSwatch } from '../brand-doc.ts';

const swatch = (key: string, name: string, hex: string, group = 'Neutral', kind: BrandSwatch['kind'] = 'ramp'): BrandSwatch => ({
  path: key.split('.'), key, group, name, raw: hex, hex, isAlias: false, kind, set: null, deletable: kind === 'custom', lock: null,
});

const NEUTRALS = ['#1d1d1d', '#3e3e3e', '#525252', '#6f6f6f', '#999999', '#bababa', '#dcdbdc', '#efefef', '#ffffff']
  .map((hex, i) => swatch(`color.ramp.neutral.${i + 1}`, `Grey ${i + 1}`, hex));
const STARTER = new Set(NEUTRALS.map(s => colorIdentity(s.key, s.raw)));
const OPTS = { roles: new Map<string, string>(), groups: [], hidden: 0, starterGroup: null };

const parse = (html: string): Document => new JSDOM(`<!doctype html><body>${html}</body>`).window.document;

test('blank state: the starter group is open, says what it is, and shows all nine', () => {
  const doc = parse(paletteHtml(NEUTRALS, STARTER, OPTS));
  const group = doc.querySelector<HTMLDetailsElement>('.be-pal-group--starter');
  assert.ok(group, 'the starter group renders');
  assert.equal(group.hasAttribute('open'), true, 'open while nothing of the person\'s own exists');
  assert.equal(group.querySelectorAll('[data-be-tile]').length, 9, 'every starter colour is a tile');
  assert.match(group.querySelector('.be-pal-group-note')?.textContent ?? '', /came with the starter/);
  assert.equal(doc.querySelector('.be-pal-count')?.textContent, '9 starter colours');
});

test('once there is a colour of the person\'s own, the starter group folds by default', () => {
  const own = swatch('color.custom.berry', 'Berry', '#a3195b', 'Colours', 'custom');
  const doc = parse(paletteHtml([own, ...NEUTRALS], STARTER, OPTS));
  assert.equal(doc.querySelector('.be-pal-group--starter')!.hasAttribute('open'), false);
  // ...unless the Tokens room asked for it by name.
  const asked = parse(paletteHtml([own, ...NEUTRALS], STARTER, { ...OPTS, starterGroup: 'neutral' }));
  assert.equal(asked.querySelector('.be-pal-group--starter')!.hasAttribute('open'), true);
});

test('a role\'s tile says the role in words, not a letter', () => {
  const roles = new Map([[NEUTRALS[0]!.key, 'Primary'], [NEUTRALS[8]!.key, 'Surface']]);
  const doc = parse(paletteHtml(NEUTRALS, STARTER, { ...OPTS, roles }));
  const marks = [...doc.querySelectorAll('.be-swatch-role')].map(el => el.textContent);
  assert.deepEqual(marks, ['Primary', 'Surface']);
  assert.equal(doc.querySelector('.be-swatch-role')!.getAttribute('aria-hidden'), 'true', 'decorative: the chips name roles accessibly');
});

test('every card still carries its checkbox and handle, for Select to reveal', () => {
  const doc = parse(paletteHtml(NEUTRALS, STARTER, OPTS));
  const cards = doc.querySelectorAll('.be-pal-card');
  assert.equal(cards.length, 9);
  for (const card of cards) {
    assert.ok(card.querySelector('.be-pal-check input[type="checkbox"]'));
    assert.ok(card.querySelector('[data-reorder-handle]'));
    assert.ok(card.querySelector('.be-pal-name') && card.querySelector('.be-pal-hex'), 'colour, name and hex');
  }
});

// The sheet is read once; rules are matched as written, outside any media block.
const CSS = readFileSync(new URL('../../styles/parts/brand-studio.css', import.meta.url), 'utf8');
/** The sheet with every @media block removed, so a rule found here applies at every width. */
const atEveryWidth = (() => {
  let out = '', depth = 0, inMedia = false, mediaDepth = 0;
  for (let i = 0; i < CSS.length; i++) {
    if (CSS.startsWith('@media', i) && !inMedia) { inMedia = true; mediaDepth = depth; }
    const c = CSS[i];
    if (c === '{') depth++;
    if (c === '}') { depth--; if (inMedia && depth === mediaDepth) { inMedia = false; continue; } }
    if (!inMedia) out += c;
  }
  return out;
})();

test('at rest, desk and phone alike, a swatch shows no checkbox and no handle', () => {
  assert.match(atEveryWidth, /\.be-pal-check,\s*\.be-pal-reorder\s*\{\s*display:\s*none;\s*\}/,
    'both are hidden at rest, outside any media query');
  assert.match(atEveryWidth, /\[data-pal-selecting\]\s*\.be-pal-check\s*\{\s*display:\s*grid;\s*\}/, 'Select reveals the checkbox');
  assert.match(atEveryWidth, /\[data-pal-selecting\]\s*\.be-pal-reorder,\s*\.be-pal-card:has\(:focus-visible\)\s*\.be-pal-reorder\s*\{\s*display:\s*grid;\s*\}/,
    'Select, or keyboard focus on the tile, reveals the handle');
  // The resting rule must win: no later unconditional rule gives either one a display.
  const handle = /\n\.be-pal-reorder\s*\{([^}]*)\}/.exec(atEveryWidth)?.[1] ?? '';
  assert.equal(/display\s*:/.test(handle), false, 'the handle\'s own rule leaves display to the Select rules');
  assert.match(handle, /min-width:\s*max\(44px,\s*var\(--ui-size-target\)\)/, 'a 44px target when shown');
  assert.match(handle, /min-height:\s*max\(44px,\s*var\(--ui-size-target\)\)/);
});

test('the add area is a drop area: dashed, neutral at rest', () => {
  const rule = /\n\.be-addcolor\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.match(rule, /border:\s*1\.5px dashed hsl\(var\(--border\)\)/, 'dashed in the neutral hairline (C4)');
  assert.equal(/--primary/.test(rule), false, 'no accent at rest');
});
