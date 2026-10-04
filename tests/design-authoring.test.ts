// SPDX-License-Identifier: MPL-2.0
/**
 * Design authoring (plan 291 W5): the `$` keys and layout macros an agent writes,
 * lowered by engine/src/design-authoring.ts to stored rows, and the named text styles
 * of engine/src/design-text-style.ts.
 *
 * The public fixture (tests/fixtures/author/) carries the traps a hand-built deck
 * showed: a stack with dividers before every item but the first, a column-major
 * matrix with an omitted slot, a table with dividers before its rows and a label per
 * row, a grid with a rule per cell and one moved item, cubic connectors to one node
 * (one of them flat), artboards off the origin and an artboard listed after its
 * layers. The private Sleepwalking test at the end is gated on LOLLY_CHECK_DELIVERED.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-authoring.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  applyAuthoredLayerOperations, applyAuthoredLayerPatches, expandDesignAuthoring, expandDesignAuthoringDocument,
  hasDesignAuthoring,
} from '../engine/src/design-authoring.ts';
import { DESIGN_TEXT_LINE_HEIGHTS, resolveTextStyle, textStylesFromBrief } from '../engine/src/design-text-style.ts';
import { decodeAuthoredPaths } from '../engine/src/geom/authored-url.ts';
import { assertDesignRowsEqual, designRowsProblems } from './helpers/design-rows-equal.ts';

type Row = Record<string, unknown>;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const readJson = <T>(rel: string): T => JSON.parse(readFileSync(join(ROOT, rel), 'utf8')) as T;
const byId = (rows: Row[], id: string): Row => {
  const row = rows.find((r) => r.id === id);
  assert.ok(row, `row ${id} exists`);
  return row;
};
const frame = (id: string, x: number, y: number, extra: Row = {}): Row =>
  ({ id, kind: 'frame', name: id, x, y, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff', order: 0, clipChildren: true, ...extra });
const throwsAt = (fn: () => unknown, pointer: string, words?: RegExp): void => {
  assert.throws(fn, (err: Error) => {
    assert.ok(err.message.startsWith(`${pointer}: `), `expected the error at ${pointer}, got: ${err.message}`);
    if (words) assert.match(err.message, words);
    return true;
  });
};
/** A path row's nodes in canvas px. */
const nodesOf = (row: Row): number[][] => decodeAuthoredPaths(String(row.path))!.flatMap((p) =>
  p.nodes.map((n) => [Number(row.x) + n.x * Number(row.w), Number(row.y) + n.y * Number(row.h)]));
const near = (actual: number, expected: number, label: string): void =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: ${actual} vs ${expected}`);

// ─── identity ────────────────────────────────────────────────────────────────

test('stored rows pass through untouched: the same objects, nothing added', () => {
  const rows: unknown[] = [
    frame('s1', 2080.4, 0),
    { id: 's1-t', kind: 'text', frame: 's1', x: '2200', y: 96, text: 'Hi' },
    { id: 'loose', kind: 'box' },
    'not a row',
    null,
  ];
  const out = expandDesignAuthoring(rows);
  assert.equal(out.expanded, false);
  assert.deepEqual(out.notes, []);
  assert.equal(out.rows.length, rows.length);
  out.rows.forEach((row, i) => {
    assert.equal(row, rows[i], `row ${i} is the same object`);
  });

  // Mixed with an authored row, the stored rows are still the same objects.
  const mixed = expandDesignAuthoring([...rows.slice(0, 3), { id: 'new', $in: 's1', kind: 'box', x: 10, y: 10, w: 5, h: 5 }]);
  assert.equal(mixed.expanded, true);
  for (let i = 0; i < 3; i++) assert.equal(mixed.rows[i], rows[i]);
  assert.deepEqual(rows[1], { id: 's1-t', kind: 'text', frame: 's1', x: '2200', y: 96, text: 'Hi' }, 'the input was not changed');
});

// ─── the public fixture ──────────────────────────────────────────────────────

test('the fixture expands to its expected rows', () => {
  const input = readJson<Row>('tests/fixtures/author/input.json');
  const expected = readJson<Row[]>('tests/fixtures/author/expected.json');
  const out = expandDesignAuthoringDocument(input);
  assert.deepEqual(out.rows, expected);
  assertDesignRowsEqual(expected, out.rows);
  assert.deepEqual(Object.keys(out.values), ['boxes'], '$styles is stripped from the values');
  assert.equal(out.expanded, true);
  assert.deepEqual(out.notes.map((n) => [n.code, n.path]), [['authoring.fg.derived', '/boxes/7/$grid/items/0/d']]);
  for (const row of out.rows) {
    for (const key of Object.keys(row)) assert.ok(!key.startsWith('$'), `${String(row.id)} keeps no authoring key (${key})`);
    for (const key of ['z', 'group', 'role']) assert.ok(!(key in row), `${String(row.id)} carries no ${key}`);
  }
});

test('the fixture: artboard-local positions become canvas positions', () => {
  const rows = expandDesignAuthoringDocument(readJson<Row>('tests/fixtures/author/input.json')).rows;
  // a1 sits at (2160, 1240). The stack starts at local (120, 220) with a pitch of 120,
  // and each text sits 8 px into its item.
  assert.deepEqual([byId(rows, 'a1-li0').x, byId(rows, 'a1-li0').y], [2160 + 120, 1240 + 220 + 8]);
  assert.deepEqual([byId(rows, 'a1-li2').x, byId(rows, 'a1-li2').y], [2280, 1240 + 220 + 2 * 120 + 8]);
  assert.equal(byId(rows, 'a1-li0').w, 760, 'a text slot without w takes the stack width');
  // Dividers come before every item but the first, named after the item they precede.
  const a1 = rows.filter((r) => r.frame === 'a1').map((r) => r.id);
  assert.deepEqual(a1.slice(1, 6), ['a1-li0', 'a1-rule1', 'a1-li1', 'a1-rule2', 'a1-li2']);
  for (const [id, y] of [['a1-rule1', 1240 + 340], ['a1-rule2', 1240 + 460]] as const) {
    const [start, end] = nodesOf(byId(rows, id));
    near(start![0]!, 2280, `${id} start x`);
    near(start![1]!, y, `${id} start y`);
    near(end![0]!, 2280 + 760, `${id} end x`);
    near(end![1]!, y, `${id} end y`);
  }
  // Column-major: (r, c) runs down each column first; the third item leaves out its s slot.
  assert.deepEqual(a1.slice(6, 17), [
    'a1-cell00', 'a1-ct00', 'a1-cs00', 'a1-cell10', 'a1-ct10', 'a1-cs10',
    'a1-cell01', 'a1-ct01', 'a1-cell11', 'a1-ct11', 'a1-cs11',
  ]);
  assert.deepEqual([byId(rows, 'a1-cell01').x, byId(rows, 'a1-cell01').y], [2160 + 960 + 440, 1240 + 220]);
  assert.equal(byId(rows, 'a1-ct01').valign, 'middle', 'the override restyles the slot');
  // Table: divider, label, then the cells, row by row; an empty cell is left out.
  assert.deepEqual(a1.slice(17, 28), [
    'a1-tl0', 'a1-tc00', 'a1-td01', 'a1-tr1', 'a1-tl1', 'a1-tc10', 'a1-tr2', 'a1-tl2', 'a1-tc20', 'a1-td21', 'a1-foot',
  ]);
  const rule = byId(rows, 'a1-tr2');
  near(nodesOf(rule)[0]![1]!, 1240 + 620 + 2 * 90, 'the table divider sits at the top of its row');
  assert.equal(rule.w, 860, 'the divider spans the label and the columns');
  assert.equal(byId(rows, 'a1-foot').text, '*Figures are illustrative*', 'an italic style sets the text in emphasis');
  // Grid with a rule per cell and one moved item.
  assert.equal(byId(rows, 'a2-rd2').y, 200 + 200 + 90);
  assert.equal(byId(rows, 'a2-rd3').y, 200 + 200 + 64);
  // Connectors: artboard coordinates, all ending on the hub; the flat one keeps a 1 px box.
  for (const id of ['a2-cl0', 'a2-cl1', 'a2-cl2']) {
    const end = nodesOf(byId(rows, id))[1]!;
    near(end[0]!, 4320 + 1000, `${id} end x`);
    near(end[1]!, 760, `${id} end y`);
  }
  assert.equal(byId(rows, 'a2-cl1').h, 1);
  // The artboard listed after its layers, and string numbers.
  assert.deepEqual([byId(rows, 'a2-hub').x, byId(rows, 'a2-hub').y], [4320 + 1000, 744]);
  assert.equal(rows.at(-1)!.id, 'a2');
  assert.deepEqual(byId(rows, 'free'), { id: 'free', kind: 'box', x: 10, y: 10, w: 50, h: 50, bg: '#999999' });
});

test('the agent defaults fill what a row leaves out, and a colour by contrast without a brief', () => {
  const rows = expandDesignAuthoringDocument(readJson<Row>('tests/fixtures/author/input.json')).rows;
  const { id: _id, kind: _kind, frame: _frame, x: _x, y: _y, w: _w, h: _h, text: _text, ...fields } = byId(rows, 'a2-rd0');
  const built = textStylesFromBrief(null, { width: 1920, height: 1080 }).body!;
  assert.deepEqual(fields, {
    rot: 0, shape: 'rect', fontSize: built.fontSize, weight: '400', lineHeight: DESIGN_TEXT_LINE_HEIGHTS.body,
    font: 'sans', align: 'left', valign: 'top', pad: 0, fg: '#ffffff',
  }, 'an unstyled text takes the body style and white on the dark artboard');
  assert.deepEqual(
    Object.fromEntries(['rot', 'fit', 'imgpos', 'shape'].map((k) => [k, byId(rows, 'a1-mark')[k]])),
    { rot: 0, fit: 'contain', imgpos: 'center', shape: 'rect' },
  );
  assert.deepEqual([byId(rows, 'a2-rr0').rot, byId(rows, 'a2-rr0').bg], [0, '']);
  assert.deepEqual(
    Object.fromEntries(['kind', 'rot', 'shape', 'clipChildren'].map((k) => [k, byId(rows, 'a1')[k]])),
    { kind: 'frame', rot: 0, shape: 'rect', clipChildren: true },
  );
});

// ─── coordinates and frames ──────────────────────────────────────────────────

test('$in adds the artboard origin as the renderer rounds it, and accepts numbers as strings', () => {
  const rows = expandDesignAuthoring([
    frame('f', '2080.6' as unknown as number, 99.4),
    { id: 't', $in: 'f', kind: 'box', x: '10.5', y: 4 },
  ]).rows;
  assert.deepEqual([rows[1]!.x, rows[1]!.y, rows[1]!.frame], [2091.5, 103, 'f']);
});

test('$in resolves an artboard listed later, or one already in the document', () => {
  const later = expandDesignAuthoring([{ id: 't', $in: 'f', kind: 'box', x: 1, y: 2 }, frame('f', 100, 200)]).rows;
  assert.deepEqual([later[0]!.x, later[0]!.y], [101, 202]);
  const existing = expandDesignAuthoring([{ id: 't', $in: 'g', kind: 'box', x: 1, y: 2 }], { existing: [frame('g', 10, 20)] }).rows;
  assert.deepEqual([existing[0]!.x, existing[0]!.y], [11, 22]);
  throwsAt(() => expandDesignAuthoring([{ id: 't', $in: 'nope', kind: 'box' }]), '/0/$in', /does not exist/);
  throwsAt(() => expandDesignAuthoring([frame('f', 0, 0), { id: 't', $in: 'f', frame: 'other', kind: 'box' }]), '/1/frame', /does not match/);
  throwsAt(() => expandDesignAuthoring([{ id: 'a', $artboard: true, $in: 'f', w: 10, h: 10 }]), '/0/$in');
  throwsAt(() => expandDesignAuthoring([{ id: 'a', $artboard: true, w: 10 }]), '/0/h', /needs w and h/);
});

test('without $in a row keeps global coordinates', () => {
  const rows = expandDesignAuthoring([frame('f', 500, 500), { id: 't', frame: 'f', $style: { fontSize: 30 }, x: 600, y: 610, text: 'x' }]).rows;
  assert.deepEqual([rows[1]!.x, rows[1]!.y, rows[1]!.fontSize], [600, 610, 30]);
});

// ─── styles ──────────────────────────────────────────────────────────────────

test('a style fills only the fields the row leaves out', () => {
  const rows = expandDesignAuthoring([
    frame('f', 0, 0),
    { id: 't', $in: 'f', $style: 'head', fontSize: 99, weight: 700, text: 'x' },
  ], { styles: { head: { fontSize: 50, weight: 500, lineHeight: 1.05, valign: 'middle', fg: '#123456' } } }).rows;
  const t = rows[1]!;
  assert.deepEqual([t.fontSize, t.weight, t.lineHeight, t.valign, t.fg], [99, '700', 1.05, 'middle', '#123456']);
});

test('basedOn chains resolve parent first; cycles and unknown ids are refused with the pointer', () => {
  const table = { a: { fontSize: 10, weight: '400' as const }, b: { basedOn: 'a', fontSize: 20 }, c: { basedOn: 'b', valign: 'bottom' as const } };
  assert.deepEqual(resolveTextStyle('c', table, '/x'), { fontSize: 20, weight: '400', valign: 'bottom' });
  assert.deepEqual(resolveTextStyle({ basedOn: 'c', pad: 4 }, table, '/x'), { fontSize: 20, weight: '400', valign: 'bottom', pad: 4 });
  throwsAt(() => resolveTextStyle('d', table, '/x'), '/x', /"d" does not exist/);
  throwsAt(() => resolveTextStyle('p', { p: { basedOn: 'q' }, q: { basedOn: 'p' } }, '/y'), '/y', /based on itself \(p -> q -> p\)/);
  throwsAt(() => resolveTextStyle('p', { p: { basedOn: 'zz' } }, '/y'), '/y', /based on "zz"/);
  throwsAt(() => expandDesignAuthoring([{ id: 't', $style: 'nope', text: 'x' }]), '/0/$style', /"nope" does not exist/);
  throwsAt(() => expandDesignAuthoring([{ id: 't', kind: 'box', $style: 'body' }]), '/0/$style', /only text rows/);
  throwsAt(() => expandDesignAuthoringDocument({ $styles: { x: { size: 3 } }, boxes: [] }), '/$styles/x/size', /unknown text style field/);
  throwsAt(() => expandDesignAuthoring([{ id: 't', $style: { weight: 450 }, text: 'x' }]), '/0/$style/weight');
});

const BRIEF = {
  theme: 'day',
  themes: [
    { name: 'day', semantic: { text: '#202124', muted: '#5F6368', surface: '#ffffff' } },
    { name: 'night', semantic: { text: '#F1F3F4', muted: '#9aa0a6', surface: '#202124' } },
  ],
  type: {
    size: { width: 1280, height: 720 },
    scale: { title: 40, subtitle: 28, body: 22, caption: 18, number: 11, label: 11 },
    roles: {
      title: { sizes: [{ value: 37, count: 9 }, { value: 60, count: 1 }], weights: [{ value: '700', count: 10 }], aligns: [{ value: 'left', count: 10 }] },
      body: { sizes: [{ value: 18, count: 5 }], weights: [{ value: 'unset', count: 3 }, { value: '300', count: 2 }], aligns: [{ value: 'center', count: 5 }] },
      quote: { sizes: [{ value: 40, count: 1 }], weights: [{ value: '400', count: 1 }], aligns: [{ value: 'center', count: 1 }] },
    },
    rules: [
      { ruleId: 'h', kind: 'text-weight', parameters: { target: 'headline', weights: ['500'] } },
      { ruleId: 'b', kind: 'text-weight', parameters: { target: 'body', weights: ['400', '500'] } },
      { ruleId: 'a', kind: 'text-align', parameters: { align: 'left', exemptRoles: ['quote'] } },
    ],
  },
};

test('textStylesFromBrief scales sizes to the artboard, follows the house rules and takes the theme colours', () => {
  const styles = textStylesFromBrief(BRIEF, { width: 1920, height: 1080 });
  assert.deepEqual(Object.keys(styles), ['title', 'subtitle', 'body', 'caption', 'label', 'quote', 'number', 'attribution']);
  assert.deepEqual(styles.title, { fontSize: 56, weight: '500', lineHeight: 1.1, align: 'left', fg: '#202124' }, '37 px at 1280 is 55.5, rounded; 700 clamps to the headline rule');
  assert.deepEqual(styles.body, { fontSize: 27, weight: '400', lineHeight: 1.35, align: 'left', fg: '#202124' }, 'unset is skipped, 300 clamps to 400, the align rule wins');
  assert.equal(styles.subtitle!.fontSize, 42, 'no tally: the scale step');
  assert.equal(styles.subtitle!.fg, '#5f6368', 'subtitles take the muted slot');
  assert.equal(styles.label!.fontSize, 33, 'the label falls back to 22 px, never the 11 px furniture step');
  assert.equal(styles.quote!.align, 'center', 'an exempt role keeps its tallied alignment');
  assert.equal(textStylesFromBrief(BRIEF, { width: 1920, theme: 'night' }).title!.fg, '#f1f3f4');
  assert.throws(() => textStylesFromBrief(BRIEF, { width: 1920, theme: 'dusk' }), /"dusk" is not one of the brief's themes \(day, night\)/);
  const builtIn = textStylesFromBrief(null, { width: 1280 });
  assert.deepEqual(builtIn.title, { fontSize: 37, weight: '700', lineHeight: 1.1, align: 'left' }, 'the built-in styles carry no colour');
  for (const style of Object.values(textStylesFromBrief(BRIEF, { width: 1000 }))) assert.ok(Number.isInteger(style.fontSize));
});

test('a brief theme colours unstyled text; an unknown $theme is refused; a $theme without a brief is noted', () => {
  const doc = { $theme: 'night', boxes: [frame('f', 0, 0, { bg: '#202124' }), { id: 't', $in: 'f', $style: { fontSize: 20 }, text: 'x' }] };
  const night = expandDesignAuthoringDocument(doc, { brief: BRIEF });
  assert.equal(night.rows[1]!.fg, '#f1f3f4');
  assert.deepEqual(night.notes, []);
  assert.ok(!('$theme' in night.values));
  const day = expandDesignAuthoringDocument(doc, { brief: BRIEF, theme: 'day' });
  assert.equal(day.rows[1]!.fg, '#202124', 'an explicit theme option wins over the document');
  assert.deepEqual(day.notes.map((n) => n.code), ['authoring.fg.contrast'], 'dark text on a dark artboard is noted');
  throwsAt(() => expandDesignAuthoringDocument({ ...doc, $theme: 'dusk' }, { brief: BRIEF }), '/$theme', /dusk/);
  const none = expandDesignAuthoringDocument(doc);
  assert.equal(none.rows[1]!.fg, '#ffffff');
  assert.deepEqual(none.notes.map((n) => n.code).sort(), ['authoring.fg.derived', 'authoring.theme.unused']);
});

test('an italic style refuses text that already carries emphasis', () => {
  const rows = expandDesignAuthoring([{ id: 't', $style: { italic: true }, text: '- one\n\n2. two' }]).rows;
  assert.equal(rows[0]!.text, '- *one*\n\n2. *two*');
  throwsAt(() => expandDesignAuthoring([{ id: 't', $style: { italic: true }, text: 'a *b*' }]), '/0/$style', /already carries/);
});

// ─── macros ──────────────────────────────────────────────────────────────────

const stackOf = (extra: Row = {}, stack: Row = {}): Row[] => [frame('f', 1000, 0), {
  id: 'm', $in: 'f', ...extra,
  $stack: { x: 0, y: 0, w: 100, pitch: 50, item: [{ slot: 'text', id: 'm-t{i}', $style: { fontSize: 10 } }], items: ['a', 'b'], ...stack },
}];

test('macro ids are deterministic, and default to <macro id>-<slot>{i}', () => {
  const once = expandDesignAuthoring(stackOf()).rows;
  assert.deepEqual(expandDesignAuthoring(stackOf()).rows, once);
  assert.deepEqual(once.map((r) => r.id), ['f', 'm-t0', 'm-t1']);
  const unnamed = expandDesignAuthoring(stackOf({}, { item: [{ slot: 'label', kind: 'text' }] })).rows;
  assert.deepEqual(unnamed.map((r) => r.id), ['f', 'm-label0', 'm-label1']);
  const supplied = expandDesignAuthoring(stackOf({}, { items: ['a', { text: { id: 'chosen', text: 'b' } }] })).rows;
  assert.deepEqual(supplied.map((r) => r.id), ['f', 'm-t0', 'chosen']);
  throwsAt(() => expandDesignAuthoring([frame('f', 0, 0), { $in: 'f', $stack: { pitch: 1, item: [{ slot: 'x', kind: 'box' }], items: [{}] } }]), '/1/$stack/item/0/id');
});

test('id collisions are refused with the pointer of the row that collides', () => {
  // A template id with no {i} repeats for every item: the error points at the template id and gives the fix.
  throwsAt(() => expandDesignAuthoring(stackOf({}, { item: [{ slot: 'text', id: 'same', kind: 'text' }] })), '/1/$stack/item/0/id', /every item gets the id "same"; put \{i\}/);
  // Two items that state the same id: the error at the second points at the first.
  throwsAt(() => expandDesignAuthoring(stackOf({}, { items: [{ text: { id: 'x', text: 'a' } }, { text: { id: 'x', text: 'b' } }] })), '/1/$stack/items/1/text/id', /"x" is also written by \/1\/\$stack\/items\/0\/text/);
  throwsAt(() => expandDesignAuthoring([...stackOf(), { id: 'm-t1', kind: 'box' }]), '/1/$stack/items/1/id', /already exists/);
  throwsAt(() => expandDesignAuthoring(stackOf(), { existing: [{ id: 'm-t0' }] }), '/1/$stack/items/0/id', /already exists/);
});

test('unknown authoring keys and malformed macros are refused at their JSON pointer', () => {
  throwsAt(() => expandDesignAuthoring([{ id: 'x', $foo: 1 }]), '/0/$foo', /unknown authoring key/);
  throwsAt(() => expandDesignAuthoring([{ id: 'x', $stack: {}, $grid: {} }]), '/0/$grid', /exactly one/);
  throwsAt(() => expandDesignAuthoring([{ id: 'x', kind: 'box', $stack: {} }]), '/0/kind', /holds only id, \$in/);
  throwsAt(() => expandDesignAuthoring(stackOf({}, { pitch: 'far' })), '/1/$stack/pitch', /number/);
  throwsAt(() => expandDesignAuthoring(stackOf({}, { items: [{ nope: 'x' }] })), '/1/$stack/items/0/nope', /no template has slot "nope"/);
  throwsAt(() => expandDesignAuthoring(stackOf({}, { item: [{ slot: 's', kind: 'text', $in: 'f' }] })), '/1/$stack/item/0/$in');
  throwsAt(() => expandDesignAuthoring(stackOf({}, { item: [{ slot: 's', kind: 'box' }], items: ['x'] })), '/1/$stack/items/0', /needs a text template/);
  throwsAt(() => expandDesignAuthoring(stackOf({ $in: 'gone' })), '/1/$in', /does not exist/);
  throwsAt(() => expandDesignAuthoring([{ $grid: { columns: 2, rows: 1, colWidth: 1, rowPitch: 1, order: 'column', cell: [{ id: 'c{i}', kind: 'box' }], items: [{}, {}, {}] } }]), '/0/$grid/items', /3 items do not fit 1 rows of 2 columns/);
  throwsAt(() => expandDesignAuthoring([{ $table: { pitch: 1, columns: [{ id: 'c{i}', kind: 'text' }], rows: [['a', 'b']] } }]), '/0/$table/rows/0/1', /2 cells for 1 columns/);
  throwsAt(() => expandDesignAuthoring(stackOf({}, { divider: { id: 'd{i}', $d: 'M0 0' } })), '/1/$stack/divider/$d');
});

test('macros never write z, group or role, and refuse templates that try', () => {
  const rows = expandDesignAuthoringDocument(readJson<Row>('tests/fixtures/author/input.json')).rows;
  for (const row of rows) for (const key of ['z', 'group', 'role']) assert.ok(!(key in row));
  throwsAt(() => expandDesignAuthoring(stackOf({}, { item: [{ slot: 't', id: 't{i}', kind: 'text', z: 3 }] })), '/1/$stack/item/0/z', /depth/);
  throwsAt(() => expandDesignAuthoring(stackOf({}, { item: [{ slot: 't', id: 't{i}', kind: 'text', role: 'title' }] })), '/1/$stack/item/0/role');
  throwsAt(() => expandDesignAuthoring(stackOf({}, { items: ['a', { text: { group: 'narration:intro' } }] })), '/1/$stack/items/1/text/group', /narration/);
  const grouped = expandDesignAuthoring(stackOf({}, { item: [{ slot: 'text', id: 'g{i}', kind: 'text', group: 'cards' }] })).rows;
  assert.equal(grouped[1]!.group, 'cards', 'a group the template states is kept');
});

test('an x stack advances across and draws vertical dividers', () => {
  const rows = expandDesignAuthoring([frame('f', 0, 0), { id: 'r', $in: 'f', $stack: {
    axis: 'x', x: 100, y: 50, h: 200, pitch: 300, divider: { id: 'r-d{i}', dx: -20, stroke: '#000000' },
    item: [{ slot: 'b', id: 'r-b{i}', kind: 'box', w: 260, h: 200 }], items: [{}, {}],
  } }]).rows;
  assert.deepEqual(rows.map((r) => r.id), ['f', 'r-b0', 'r-d1', 'r-b1']);
  assert.deepEqual([rows[3]!.x, rows[3]!.y], [400, 50]);
  const [a, b] = nodesOf(rows[2]!);
  assert.deepEqual([a, b], [[380, 50], [380, 250]]);
});

test('the expansion is capped after macros run', () => {
  const items = Array.from({ length: 30 }, (_, i) => `item ${i}`);
  throwsAt(() => expandDesignAuthoring(stackOf({}, { items }), { maxRows: 20 }), '/1', /cap of 20/);
  assert.equal(expandDesignAuthoring(stackOf({}, { items }), { maxRows: 31 }).rows.length, 31);
});

// ─── paths ───────────────────────────────────────────────────────────────────

test('$points and $d are artboard-local and set the box and path; a stated box is refused', () => {
  const rows = expandDesignAuthoring([frame('f', 1000.4, 500), { id: 'p', $in: 'f', $points: [[10, 20], [110, 70]], stroke: '#000000', strokeW: 2 }]).rows;
  const p = rows[1]!;
  assert.equal(p.kind, 'path');
  const nodes = nodesOf(p);
  near(nodes[0]![0]!, 1010, 'start x');
  near(nodes[0]![1]!, 520, 'start y');
  near(nodes[1]![0]!, 1110, 'end x');
  near(nodes[1]![1]!, 570, 'end y');
  throwsAt(() => expandDesignAuthoring([{ id: 'p', kind: 'path', $points: [[0, 0], [1, 1]], w: 9 }]), '/0/w', /takes its box from the geometry/);
  throwsAt(() => expandDesignAuthoring([{ id: 'p', kind: 'box', $points: [[0, 0], [1, 1]] }]), '/0/$points', /kind path/);
  throwsAt(() => expandDesignAuthoring([{ id: 'p', $d: 'M0 0 Q' }]), '/0/$d', /: "Q" has no arguments/);
  // A geometry error points at the key at fault, without the geometry module's prefix.
  const curve = (): unknown => expandDesignAuthoring([{ id: 'p', $points: [[0, 0], [10, 10]], $curve: 'smooth' }]);
  throwsAt(curve, '/0/$curve', /curve must be one of line, cubic,/);
  assert.throws(curve, (err: Error) => !/geom:/.test(err.message), 'no geom: prefix');
  throwsAt(() => expandDesignAuthoring([{ id: 'p', $points: [[0, 0], [10, 10]], $tension: 7 }]), '/0/$tension', /tension must be/);
});

// ─── layer operations and patches ────────────────────────────────────────────

const defaults = (_field: string, fallback?: unknown): unknown => fallback;

test('authored adds expand one operation at a time, and see an artboard an earlier one added', () => {
  const { rows, notes } = applyAuthoredLayerOperations([], [
    { op: 'add', layer: { id: 'f', $artboard: true, x: 3000, y: 0, w: 1920, h: 1080, bg: '#ffffff' } },
    { op: 'add', layer: { id: 'list', $in: 'f', $stack: { x: 100, y: 100, w: 500, pitch: 60, item: [{ slot: 't', id: 'li{i}', $style: { fontSize: 20, fg: '#000000' } }], items: ['a', 'b'] } } },
    { op: 'add', layer: { id: 'plain', kind: 'box', x: 1, y: 2 } },
  ], defaults);
  assert.deepEqual(rows.map((r) => r.id), ['f', 'li0', 'li1', 'plain']);
  assert.deepEqual([rows[2]!.x, rows[2]!.y], [3100, 160]);
  assert.deepEqual(rows[3], { kind: 'box', x: 1, y: 2, w: 320, h: 200, id: 'plain' }, 'a plain add is unchanged');
  assert.ok(!rows.some((r) => 'z' in r));
  assert.deepEqual(notes, []);
});

test('an authored add that expands to several rows may not carry an anchor; a single-row one keeps it', () => {
  const base = [frame('f', 0, 0), { id: 'a', kind: 'box', frame: 'f' }, { id: 'b', kind: 'box', frame: 'f' }];
  throwsAt(() => applyAuthoredLayerOperations(base, [
    { op: 'remove', id: 'b' },
    { op: 'add', afterId: 'a', layer: { id: 'm', $in: 'f', $stack: { pitch: 10, item: [{ slot: 't', id: 't{i}', kind: 'text' }], items: ['x', 'y'] } } },
  ], defaults), '/layerOperations/1/afterId', /expands to 2 rows/);
  const single = applyAuthoredLayerOperations(base, [{ op: 'add', beforeId: 'b', layer: { id: 'n', $in: 'f', kind: 'box', x: 5, y: 5 } }], defaults).rows;
  assert.deepEqual(single.map((r) => r.id), ['f', 'a', 'n', 'b'], 'the anchor places the row as a plain add does');
});

test('the row cap holds for the whole operations call, not for each add on its own', () => {
  const stack = (id: string, n: number): Row => ({
    op: 'add', layer: { id, $in: 'f', $stack: { x: 0, y: 0, w: 100, pitch: 1, item: [{ id: `${id}{i}`, kind: 'box', w: 1, h: 1 }], items: Array.from({ length: n }, () => ({})) } },
  });
  // Two adds of 3000 rows each stay under the default cap one at a time and pass it together.
  throwsAt(() => applyAuthoredLayerOperations([frame('f', 0, 0)], [stack('a', 3000), stack('b', 3000)], defaults), '/layerOperations/1/layer', /past the cap of 5000 rows/);
  // The rows the document already holds count as well.
  const base = [frame('f', 0, 0), { id: 'x', kind: 'box', frame: 'f' }, { id: 'y', kind: 'box', frame: 'f' }];
  throwsAt(() => applyAuthoredLayerOperations(base, [stack('a', 3)], defaults, { maxRows: 5 }), '/layerOperations/0/layer', /already holds 3/);
  assert.equal(applyAuthoredLayerOperations(base, [stack('a', 2)], defaults, { maxRows: 5 }).rows.length, 5, 'exactly at the cap is accepted');
  throwsAt(() => applyAuthoredLayerOperations(base, [stack('a', 1), stack('b', 1), stack('c', 1)], defaults, { maxRows: 5 }), '/layerOperations/2/layer', /past the cap of 5 rows/);
});

test('operation errors name the caller index and the key at fault', () => {
  const base = [frame('f', 0, 0)];
  throwsAt(() => applyAuthoredLayerOperations(base, [
    { op: 'add', layer: { id: 'a', kind: 'box' } },
    { op: 'add', layer: { id: 'b', kind: 'box' } },
    { op: 'add', layer: { id: 'a', $in: 'f', kind: 'box' } },
  ], defaults), '/layerOperations/2/layer/id', /already exists/);
  throwsAt(() => applyAuthoredLayerOperations(base, [{ op: 'add', layer: { id: 'b', kind: 'box' } }, { op: 'remove', id: 'zz' }], defaults), '/layerOperations/1/id', /does not exist/);
  throwsAt(() => applyAuthoredLayerOperations(base, [{ op: 'nope' }], defaults, { pointer: '/arguments/layerOperations' }), '/arguments/layerOperations/0/op');
  throwsAt(() => applyAuthoredLayerOperations(base, [{}, { op: 'add', layer: { id: 'q', $in: 'f', $style: 'gone', text: 'x' } }].slice(1), defaults), '/layerOperations/0/layer/$style');
  assert.throws(() => applyAuthoredLayerOperations(base, 'x', defaults), /^Error: layerOperations must be an array\.$/);
});

test('patches take $in, $style and path keys, refuse the rest, and keep their own fields', () => {
  const base: Row[] = [
    frame('f', 2000, 1000),
    { id: 't', kind: 'text', frame: 'f', x: 2100, y: 1100, w: 200, h: 50, text: 'x', fontSize: 30, fg: '#111111' },
    { id: 'p', kind: 'path', frame: 'f', x: 2000, y: 1000, w: 1, h: 1, path: '1!line!0_0!0_1!1', stroke: '#000000' },
  ];
  const { rows } = applyAuthoredLayerPatches(base, [
    { id: 't', set: { $in: 'f', x: 50, $style: { fontSize: 44, valign: 'bottom' }, weight: 600 } },
    { id: 'p', set: { $in: 'f', $points: [[0, 0], [100, 0]] } },
  ]);
  const t = byId(rows, 't');
  assert.deepEqual([t.x, t.y, t.fontSize, t.valign, t.weight, t.align, t.pad], [2050, 1100, 44, 'bottom', '600', 'left', 0]);
  assert.equal(t.fg, '#000000', 'the style restates the colour, by contrast without a brief');
  const p = byId(rows, 'p');
  near(nodesOf(p)[1]![0]!, 2100, 'path end x');
  throwsAt(() => applyAuthoredLayerPatches(base, [{ id: 't', set: { $stack: {} } }]), '/layerPatches/0/set/$stack', /only the authoring keys/);
  throwsAt(() => applyAuthoredLayerPatches(base, [{ id: 'p', set: { x: 1 } }, { id: 't', set: { $in: 'g', x: 1 } }]), '/layerPatches/1/set/$in', /reparent/);
  throwsAt(() => applyAuthoredLayerPatches(base, [{ id: 't', set: { fg: '#000000' } }, { id: 'zz', set: { x: 1 } }]), '/layerPatches/1/id', /does not exist/);
  throwsAt(() => applyAuthoredLayerPatches(base, [{ id: 't', set: { $points: [[0, 0], [1, 1]] } }]), '/layerPatches/0/set/$points', /kind path/);
});

test('moving an artboard by patch notes that its layers stay', () => {
  const base: Row[] = [frame('f', 0, 0), { id: 'a', kind: 'box', frame: 'f', x: 10, y: 10 }];
  const { rows, notes } = applyAuthoredLayerPatches(base, [{ id: 'f', set: { x: 500 } }]);
  assert.equal(byId(rows, 'a').x, 10);
  assert.deepEqual(notes.map((n) => [n.code, n.path]), [['authoring.frame.children', '/layerPatches/0/set']]);
});

// ─── documents ───────────────────────────────────────────────────────────────

test('every document shape expands, other inputs are kept and the authoring inputs stripped', () => {
  const boxes = [frame('f', 100, 0), { id: 't', $in: 'f', kind: 'box', x: 1, y: 1 }];
  assert.equal(Array.isArray(expandDesignAuthoringDocument(boxes).values.boxes), true);
  const flat = expandDesignAuthoringDocument({ boxes, transition: 'fade', $styles: {}, $theme: 'x' });
  assert.deepEqual(Object.keys(flat.values).sort(), ['boxes', 'transition']);
  assert.equal((flat.values.boxes as Row[])[1]!.x, 101);
  const session = expandDesignAuthoringDocument({ values: { boxes: JSON.stringify(boxes), __label: 'Deck' } });
  assert.deepEqual(Object.keys(session.values).sort(), ['__label', 'boxes']);
  assert.equal((session.values.boxes as Row[])[1]!.x, 101);
  const stored = expandDesignAuthoringDocument({ boxes: [frame('f', 0, 0)] });
  assert.equal(stored.expanded, false);
  throwsAt(() => expandDesignAuthoringDocument({ values: { boxes: '[' } }), '/values/boxes', /not JSON/);
  throwsAt(() => expandDesignAuthoringDocument({ inputs: {} }), '/boxes', /boxes array/);
  throwsAt(() => expandDesignAuthoringDocument({ boxes: [{ $foo: 1 }] }), '/boxes/0/$foo');
});

test('hasDesignAuthoring finds authoring in rows, documents, adds and patches', () => {
  assert.equal(hasDesignAuthoring([frame('f', 0, 0)]), false);
  assert.equal(hasDesignAuthoring({ boxes: [{ id: 'a' }] }), false);
  assert.equal(hasDesignAuthoring([{ id: 'a', $in: 'f' }]), true);
  assert.equal(hasDesignAuthoring({ $styles: {}, boxes: [] }), true);
  assert.equal(hasDesignAuthoring({ values: { boxes: [{ $stack: {} }] } }), true);
  assert.equal(hasDesignAuthoring([{ op: 'add', layer: { $in: 'f' } }]), true);
  assert.equal(hasDesignAuthoring([{ id: 'a', set: { $style: 'title' } }]), true);
  assert.equal(hasDesignAuthoring('$in'), false);
});

// ─── the comparator ──────────────────────────────────────────────────────────

test('the row comparator accepts the same drawing and catches each planted difference', () => {
  const expected = readJson<Row[]>('tests/fixtures/author/expected.json');
  const clone = (): Row[] => JSON.parse(JSON.stringify(expected)) as Row[];
  // Moved artboards (with their layers), a pill for a rounded box, numeric weights and upper-case hex are the same document.
  const moved = clone();
  for (const row of moved) {
    if (row.id === 'a2' || row.frame === 'a2') row.x = Number(row.x) + 777;
    if (typeof row.weight === 'string') row.weight = Number(row.weight);
    if (typeof row.fg === 'string') row.fg = row.fg.toUpperCase();
    if (row.id === 'a2-hub') Object.assign(row, { shape: 'rounded', radius: 16 });
  }
  assert.deepEqual(designRowsProblems(expected, moved), []);
  const planted: Array<[string, (rows: Row[]) => void, RegExp]> = [
    ['a layer moved inside its artboard', (r) => { byId(r, 'a1-li1').y = Number(byId(r, 'a1-li1').y) + 1; }, /a1-li1: y/],
    ['a changed weight', (r) => { byId(r, 'a1-ct00').weight = '600'; }, /a1-ct00: weight/],
    ['a z field', (r) => { byId(r, 'a1-ct00').z = 0; }, /a1-ct00: z written/],
    ['an extra field', (r) => { byId(r, 'a1-ct00').role = 'title'; }, /a1-ct00: extra field role/],
    ['a missing field', (r) => { delete byId(r, 'a1-ct00').pad; }, /a1-ct00: missing field pad/],
    ['two layers swapped', (r) => { const i = r.findIndex((x) => x.id === 'a1-li0'); [r[i], r[i + 1]] = [r[i + 1]!, r[i]!]; }, /a1: its layers paint in a different order/],
    ['a path node moved', (r) => { byId(r, 'a2-cl0').path = '1!cubic!0_0!0!!!.444444_1!.9!-.444444'; }, /a2-cl0: contour 0 node 1/],
    ['a missing layer', (r) => { r.splice(r.findIndex((x) => x.id === 'a1-mark'), 1); }, /missing a1-mark/],
    ['pages reordered', (r) => { byId(r, 'a2').order = -1; }, /page in a different order/],
  ];
  for (const [label, plant, problem] of planted) {
    const rows = clone();
    plant(rows);
    const problems = designRowsProblems(expected, rows);
    assert.ok(problems.some((p) => problem.test(p)), `${label}: ${problems.join('; ') || 'no problem found'}`);
  }
  assert.deepEqual(designRowsProblems(expected, [...clone(), { id: 'x', kind: 'box', frame: 'a1' }], { frames: ['a2'] }), [], 'frames limits the comparison');
  assert.deepEqual(
    designRowsProblems([{ id: 'i', kind: 'image', image: 'photo:one' }], [{ id: 'i', kind: 'image', image: { id: 'user/media/abc', source: 'user' } }], { media: { 'photo:one': 'user/media/abc' } }),
    [],
  );
});

// ─── the delivered Sleepwalking documents (private, gated) ──────────────────

const DELIVERED = (process.env.LOLLY_CHECK_DELIVERED ?? '').trim();
const deliveredSkip =
  DELIVERED && existsSync(join(DELIVERED, 'light.lolly.boxes.json')) && existsSync(join(DELIVERED, 'dark.lolly.boxes.json'))
    ? false
    : 'the delivered Sleepwalking design fixture is not on this machine (set LOLLY_CHECK_DELIVERED)';

test('the delivered Sleepwalking documents are their own expansion', { skip: deliveredSkip }, () => {
  for (const name of ['light.lolly.boxes.json', 'dark.lolly.boxes.json']) {
    const boxes = JSON.parse(readFileSync(join(DELIVERED, name), 'utf8')) as Row[];
    const out = expandDesignAuthoring(boxes);
    assert.equal(out.expanded, false, name);
    assert.deepEqual(out.rows, boxes, name);
    out.rows.forEach((row, i) => {
      assert.equal(row, boxes[i], `${name} row ${i} is the same object`);
    });
    assert.deepEqual(designRowsProblems(boxes, boxes), [], `${name} compares equal to itself`);
  }
});
