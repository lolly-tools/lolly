// SPDX-License-Identifier: MPL-2.0
/**
 * Design house rules (plan 291 W3): brand rule records checked layer by layer against a
 * Design document, over the synthetic Tidewater fixture so public CI sees every kind.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { brandSystemOf } from '../engine/src/brand-system.ts';
import {
  DESIGN_HOUSE_RULE_KINDS, checkDesignHouseRules, combinationPolicy, designHouseRules,
} from '../engine/src/design-house-rules.ts';
import { BRAND_RULE_KINDS } from '../engine/src/brand-rules.ts';

const doc = JSON.parse(readFileSync(new URL('./fixtures/design-brief/tokens.json', import.meta.url), 'utf8'));
const system = brandSystemOf(doc);
const rules = system?.rules ?? [];

/** One 1920x1080 white artboard, plus the given layers on that artboard. */
const board = (...layers: Record<string, unknown>[]): Record<string, unknown>[] => [
  { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
  ...layers.map((l) => ({ frame: 'a1', kind: 'text', x: 100, y: 100, w: 600, h: 80, fontSize: 28, weight: '400', align: 'left', fg: '#13294b', ...l })),
];
const run = (boxes: unknown[]) => checkDesignHouseRules(boxes, rules, doc);
const ids = (boxes: unknown[]) => run(boxes).findings.map((f) => `${f.ruleId}:${f.layerId}`).sort();

test('the fixture brand system is valid and carries every house-rule kind', () => {
  assert.ok(system, 'readBrandSystem accepts the fixture');
  for (const kind of DESIGN_HOUSE_RULE_KINDS) assert.ok(rules.some((r) => r.kind === kind), kind);
  // The layer kinds stay out of the console-shared example registry.
  for (const kind of DESIGN_HOUSE_RULE_KINDS) assert.ok(!(BRAND_RULE_KINDS as readonly string[]).includes(kind), kind);
  assert.deepEqual(designHouseRules(rules).map((r) => r.id).includes('clear-space'), false);
});

test('a clean composition has no findings, and an unknown kind is reported, never passed', () => {
  const result = run(board(
    { id: 'title', role: 'title', text: 'A calm headline', fontSize: 72, weight: '600' },
    { id: 'body', text: 'Body copy in navy on white.' },
  ));
  assert.deepEqual(result.findings, []);
  assert.deepEqual(result.unknown, ['clear-space']);
  // Eight rules apply to Design; the brand-poster one is outside this tool and not counted.
  assert.equal(result.checked, 8);
});

test('headline weight: a 700 title is reported, and absent weight is the Design default 700', () => {
  const result = run(board(
    { id: 'bold', role: 'title', text: 'Bold headline', fontSize: 72, weight: '700' },
    { id: 'unset', role: 'title', text: 'Unset headline', fontSize: 72, weight: undefined },
  ));
  const weights = result.findings.filter((f) => f.ruleId === 'headline-weight');
  assert.deepEqual(weights.map((f) => [f.layerId, f.value, f.expected]), [['bold', '700', '600'], ['unset', '700', '600']]);
  assert.match(weights[1]!.message, /Design default/);
  assert.equal(weights[0]!.requirement, 'required');
  assert.equal(weights[0]!.artboardId, 'a1');
});

test('a role-less text is a headline only when it is the one largest text and large for the artboard', () => {
  assert.deepEqual(ids(board({ id: 'big', text: 'Big words', fontSize: 80, weight: '700' }, { id: 'small', text: 'small' })),
    ['headline-weight:big']);
  // Three equal display lines are a list, not a headline: body rules apply, so 700 is still caught there.
  assert.deepEqual(ids(board(
    { id: 'q1', text: 'One?', fontSize: 60, y: 100 }, { id: 'q2', text: 'Two?', fontSize: 60, y: 200 }, { id: 'q3', text: 'Three?', fontSize: 60, y: 300 },
  )), []);
  // Below the artboard share (5% of 1080 px) nothing is a headline.
  assert.deepEqual(ids(board({ id: 'mid', text: 'Mid words', fontSize: 40, weight: '600' })), ['body-weight:mid']);
});

test('body weight reads bold runs and attribute weights inside the text', () => {
  const result = run(board(
    { id: 'strong', text: 'A **bold** word' },
    { id: 'attr', text: 'A {w500|medium} word' },
    { id: 'number', role: 'number', text: '42', weight: '700' },
  ));
  const found = result.findings.filter((f) => f.ruleId === 'body-weight');
  assert.deepEqual(found.map((f) => [f.layerId, f.field, f.value]), [['strong', 'text', '700'], ['attr', 'text', '500']]);
  assert.match(found[0]!.message, /Bold runs/);
});

test('headline case: capitals throughout are reported, mixed case is not', () => {
  assert.deepEqual(ids(board({ id: 'caps', role: 'title', text: 'LOUD HEADLINE', fontSize: 72, weight: '600' })), ['headline-case:caps']);
  assert.deepEqual(ids(board({ id: 'mixed', role: 'title', text: 'AI and the API', fontSize: 72, weight: '600' })), []);
});

test('headline case: an acronym or a brand name in capitals is not a headline set in capitals', () => {
  for (const text of ['Q&A', 'SUSE', 'SLES 16', 'AI', 'R&D: Q3']) {
    assert.deepEqual(ids(board({ id: 'acronym', role: 'title', text, fontSize: 72, weight: '600' })), [], text);
  }
  assert.deepEqual(ids(board({ id: 'shout', role: 'title', text: 'WELCOME TO SUSE', fontSize: 72, weight: '600' })), ['headline-case:shout']);
  // A brand can list words that never count, so its own name does not tip a short headline over.
  const withExempt = rules.map((r) => r.id === 'headline-case' ? { ...r, parameters: { ...r.parameters, exemptWords: ['TIDEWATER'] } } : r);
  const exempt = checkDesignHouseRules(board({ id: 'named', role: 'title', text: 'TIDEWATER NOW', fontSize: 72, weight: '600' }), withExempt, doc);
  assert.deepEqual(exempt.findings.filter((f) => f.ruleId === 'headline-case'), []);
});

test('text alignment: centred text is reported, with role, furniture, archetype and numeral exemptions', () => {
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'a2', kind: 'frame', x: 2000, y: 0, w: 1920, h: 1080, bg: '#ffffff', archetype: 'stats-3' },
    ...[
      { id: 'centred', align: 'center' },
      { id: 'right', align: 'right' },
      { id: 'default', align: undefined },
      { id: 'number', role: 'number', align: 'center' },
      { id: 'page', furniture: 'page-number-right', align: 'center', text: 'Page' },
      { id: 'year', align: 'center', text: '1960' },
    ].map((l) => ({ kind: 'text', frame: 'a1', x: 100, y: 100, w: 600, h: 80, fontSize: 28, weight: '400', fg: '#13294b', text: 'Words here', ...l })),
    { id: 'stat-label', kind: 'text', frame: 'a2', x: 2100, y: 100, w: 600, h: 80, fontSize: 28, weight: '400', fg: '#13294b', text: 'Customers', align: 'center' },
  ];
  const found = run(boxes).findings.filter((f) => f.ruleId === 'align-left');
  assert.deepEqual(found.map((f) => [f.layerId, f.value]), [['centred', 'center'], ['right', 'right'], ['default', 'center']]);
  assert.match(found[0]!.message, /centred; use left/);
});

test('colour pairing: a graphics-only colour as text is reported against the surface it sits on', () => {
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'panel', kind: 'box', frame: 'a1', x: 1000, y: 0, w: 920, h: 1080, bg: '#13294b' },
    { id: 'reef-on-white', kind: 'text', frame: 'a1', x: 100, y: 100, w: 600, h: 80, text: 'Reef words', fontSize: 28, weight: '400', align: 'left', fg: '#2fb8ac' },
    { id: 'sand-on-navy', kind: 'text', frame: 'a1', x: 1100, y: 100, w: 600, h: 80, text: 'Sand words', fontSize: 28, weight: '400', align: 'left', fg: '#f3e9d2' },
    { id: 'alias-on-navy', kind: 'text', frame: 'a1', x: 1100, y: 300, w: 600, h: 80, text: 'Ink words', fontSize: 28, weight: '400', align: 'left', fg: '{color.brand.ink}' },
    { id: 'run-on-white', kind: 'text', frame: 'a1', x: 100, y: 300, w: 600, h: 80, text: 'Navy and {#2fb8ac|reef}', fontSize: 28, weight: '400', align: 'left', fg: '#13294b' },
    { id: 'shade', kind: 'text', frame: 'a1', x: 100, y: 500, w: 600, h: 80, text: 'A shade', fontSize: 28, weight: '400', align: 'left', fg: '#777777' },
    { id: 'own-fill', kind: 'text', frame: 'a1', x: 100, y: 700, w: 600, h: 80, text: 'On its own navy fill', fontSize: 28, weight: '400', align: 'left', fg: '#ffffff', bg: '#13294b' },
  ];
  const found = run(boxes).findings.filter((f) => f.ruleId === 'pairings');
  assert.deepEqual(found.map((f) => [f.layerId, f.value]), [['reef-on-white', '#2fb8ac'], ['alias-on-navy', '{color.brand.ink}'], ['run-on-white', '#2fb8ac']]);
  assert.match(found[0]!.message, /Reef text on White is not an approved pairing \(approved for graphics only\)\. Text colours approved on White: Navy, Ink\./);
  assert.doesNotMatch(found[1]!.message, /graphics only/);
});

test('colour pairing makes no claim over a picture, a gradient or a translucent fill', () => {
  const text = { kind: 'text', frame: 'a1', x: 100, y: 100, w: 600, h: 80, text: 'Reef words', fontSize: 28, weight: '400', align: 'left', fg: '#2fb8ac' };
  for (const under of [
    { id: 'photo', kind: 'image', image: 'tidewater/photos/sea', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'grad', kind: 'box', grad: 'linear', bg: '#ffffff', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'veil', kind: 'box', bg: '#ffffff', opacity: 0.5, x: 0, y: 0, w: 1920, h: 1080 },
  ]) {
    const boxes = [{ id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' }, { frame: 'a1', ...under }, { id: 't', ...text }];
    assert.deepEqual(run(boxes).findings.filter((f) => f.ruleId === 'pairings'), [], under.id);
  }
});

test('stroke on rounded: an accent outline or edge strip is reported, a neutral hairline is not', () => {
  const card = { kind: 'box', frame: 'a1', x: 100, y: 100, w: 400, h: 300, shape: 'rounded', radius: 16, bg: '#ffffff' };
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#f3e9d2' },
    { id: 'accent', ...card, stroke: '#2fb8ac', strokeW: 2 },
    { id: 'hairline', ...card, x: 600, stroke: '{color.ramp.grey.7}', strokeW: 1 },
    { id: 'zero', ...card, x: 1100, stroke: '#2fb8ac', strokeW: 0 },
    { id: 'square', ...card, y: 500, radius: 0, stroke: '#2fb8ac', strokeW: 2 },
    { id: 'pill', ...card, x: 600, y: 500, shape: 'pill', stroke: '#2fb8ac', strokeW: 2 },
    { id: 'host', ...card, x: 1100, y: 500 },
    { id: 'strip', kind: 'box', frame: 'a1', x: 1100, y: 500, w: 400, h: 8, bg: '#2fb8ac' },
    { id: 'grey-strip', kind: 'box', frame: 'a1', x: 1100, y: 792, w: 400, h: 8, bg: '#d9d9d9' },
  ];
  assert.deepEqual(run(boxes).findings.filter((f) => f.ruleId === 'rounded-edges').map((f) => [f.layerId, f.field]),
    [['accent', 'stroke'], ['pill', 'stroke'], ['strip', 'bg']]);
});

test('dash reserved: a dashed border is reported, a solid or path dash is not', () => {
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'dashed', kind: 'box', frame: 'a1', x: 0, y: 0, w: 100, h: 100, stroke: '#13294b', strokeW: 2, strokeDash: 'dashed' },
    { id: 'array', kind: 'box', frame: 'a1', x: 0, y: 0, w: 100, h: 100, stroke: '#13294b', strokeW: 2, strokeDashArray: '4 4' },
    { id: 'solid', kind: 'box', frame: 'a1', x: 0, y: 0, w: 100, h: 100, stroke: '#13294b', strokeW: 2 },
    { id: 'line', kind: 'path', frame: 'a1', x: 0, y: 0, w: 100, h: 1, stroke: '#13294b', strokeW: 2, strokeDash: 'dashed' },
  ];
  const found = run(boxes).findings.filter((f) => f.ruleId === 'dashes');
  assert.deepEqual(found.map((f) => f.layerId), ['dashed', 'array']);
  assert.match(found[0]!.message, /reserved for drop target/);
});

test('logo surface: the mark is judged by what paints under it, modifiers stripped, tokens resolved', () => {
  const logo = { kind: 'image', frame: 'a1', x: 100, y: 100, w: 200, h: 60, fit: 'contain' };
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#13294b' },
    { id: 'wrong-on-dark', ...logo, image: 'tidewater/logo/positive' },
    { id: 'token-on-dark', ...logo, image: '{asset.logo.reverse}' },
    { id: 'photo', kind: 'image', frame: 'a1', image: 'tidewater/photos/sea', x: 1000, y: 0, w: 920, h: 1080 },
    { id: 'wrong-on-photo', ...logo, x: 1100, image: 'tidewater/logo/positive?theme=x' },
    { id: 'not-a-logo', ...logo, image: 'tidewater/icons/anchor' },
  ];
  const found = run(boxes).findings.filter((f) => f.ruleId === 'logo-surface');
  assert.deepEqual(found.map((f) => [f.layerId, f.value, f.expected]), [
    ['wrong-on-dark', 'tidewater/logo/positive', 'tidewater/logo/reverse'],
    ['wrong-on-photo', 'tidewater/logo/positive', 'tidewater/logo/reverse'],
  ]);
  assert.match(found[1]!.message, /photograph/);
});

test('logo surface falls back to the catalog logos when the rule lists none', () => {
  const rule = { ...rules.find((r) => r.id === 'logo-surface')!, parameters: {} };
  const boxes = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'l', kind: 'image', frame: 'a1', x: 0, y: 0, w: 200, h: 60, image: 'pack/logo/reverse' },
  ];
  const none = checkDesignHouseRules(boxes, [rule], doc);
  assert.deepEqual(none.unknown, ['logo-surface']);
  const result = checkDesignHouseRules(boxes, [rule], doc, { catalog: { logos: { onLight: 'pack/logo/positive', onDark: 'pack/logo/reverse' } } });
  assert.deepEqual(result.findings.map((f) => [f.layerId, f.expected]), [['l', 'pack/logo/positive']]);
});

test('hidden layers, unreadable input and rules with unreadable parameters never throw', () => {
  assert.deepEqual(run(board({ id: 'hidden', role: 'title', text: 'Hidden', fontSize: 72, weight: '900', hidden: true })).findings, []);
  for (const input of [null, undefined, 'boxes', 42, [null, 'x', 3]]) assert.deepEqual(run(input as unknown as unknown[]).findings, []);
  const broken = rules.map((r) => ({ ...r, parameters: { weights: 'heavy', align: 'diagonal', forbid: 'lower', source: 'elsewhere' } }));
  const result = checkDesignHouseRules(board({ id: 't', text: 'Words' }), broken, doc);
  assert.ok(result.unknown.includes('headline-weight') && result.unknown.includes('align-left') && result.unknown.includes('pairings'));
  assert.deepEqual(checkDesignHouseRules(board({ id: 't', text: 'Words' }), rules, null).unknown.includes('pairings'), true);
});

test('the combination policy names colours relative to the background token group', () => {
  const policy = combinationPolicy(doc);
  assert.deepEqual(policy.byBackground.get('#ffffff'), { name: 'white', text: ['navy', 'ink'], graphic: ['navy', 'ink', 'reef'] });
  assert.deepEqual(policy.names.get('#2fb8ac'), ['reef']);
  // The ramp shade is outside the named group, so it carries no name.
  assert.equal(policy.names.get('#d9d9d9'), undefined);
});
