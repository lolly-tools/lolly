// SPDX-License-Identifier: MPL-2.0
/**
 * Design authoring guards (plan 291 M2 review fixes): the row cap holds while a macro
 * is still expanding, a multi-row add refuses fields a plain add refuses, text colour
 * chosen without a brief reads the row's own fill, the contrast note covers every
 * colour a row did not state, the theme's text colour is written as hex, an inline
 * style keeps the body style, error pointers name the template or the item that wrote
 * the key, and a call's notes are given once.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-authoring-guards.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  applyAuthoredLayerOperations, applyAuthoredLayerPatches, expandDesignAuthoring,
} from '../engine/src/design-authoring.ts';
import { designBrief } from '../engine/src/design-brief.ts';
import { textStylesFromBrief } from '../engine/src/design-text-style.ts';

type Row = Record<string, unknown>;
const frame = (id: string, extra: Row = {}): Row =>
  ({ id, kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff', clipChildren: true, ...extra });
const throwsAt = (fn: () => unknown, pointer: string, words?: RegExp): void => {
  assert.throws(fn, (err: Error) => {
    assert.ok(err.message.startsWith(`${pointer}: `), `expected the error at ${pointer}, got: ${err.message}`);
    if (words) assert.match(err.message, words);
    return true;
  });
};
const defaults = (_field: string, fallback?: unknown): unknown => fallback;
const byId = (rows: Row[], id: string): Row => {
  const row = rows.find((r) => r.id === id);
  assert.ok(row, `row ${id} exists`);
  return row;
};
const briefWith = (text: string, background = '#ffffff'): Row => ({
  themes: [{ name: 'light', semantic: { text, background } }],
});

test('a small macro with a huge product of items and templates hits the cap before it is built', () => {
  // 600 templates by 600 items is 360000 rows from about 30 KB of input.
  const n = 600;
  const item = Array.from({ length: n }, (_, k) => ({ id: `t${k}-{i}`, kind: 'box' }));
  const items = Array.from({ length: n }, () => ({}));
  const started = performance.now();
  throwsAt(() => expandDesignAuthoring([frame('f'), { id: 'm', $in: 'f', $stack: { pitch: 1, item, items } }]), '/1', /more than the cap of 5000 rows/);
  assert.ok(performance.now() - started < 1000, 'refused without building the whole product');
  // The same holds for a grid and a table, and for a lower cap.
  const cell = item.slice(0, 10);
  throwsAt(() => expandDesignAuthoring([{ $grid: { columns: 2, colWidth: 1, rowPitch: 1, cell, items } }], { maxRows: 50 }), '/0', /cap of 50 rows/);
  throwsAt(() => expandDesignAuthoring([{ $table: { pitch: 1, columns: cell, rows: items.map(() => cell.map(() => ({}))) } }], { maxRows: 50 }), '/0', /cap of 50 rows/);
  // Exactly at the cap is still accepted.
  assert.equal(expandDesignAuthoring([{ $grid: { columns: 5, colWidth: 1, rowPitch: 1, cell, items: items.slice(0, 5) } }], { maxRows: 50 }).rows.length, 50);
});

test('a multi-row authored add refuses an unknown operation field, as a plain add does', () => {
  const base = [frame('f'), { id: 'a', kind: 'box', frame: 'f' }];
  const stack = (n: number): Row => ({ id: 'm', $in: 'f', $stack: { pitch: 10, item: [{ slot: 't', kind: 'box', w: 1, h: 1 }], items: Array.from({ length: n }, () => ({})) } });
  throwsAt(() => applyAuthoredLayerOperations(base, [{ op: 'add', afterID: 'a', layer: stack(2) }], defaults), '/layerOperations/0/afterID', /unknown add field/);
  throwsAt(() => applyAuthoredLayerOperations(base, [{ op: 'add', afterID: 'a', layer: stack(1) }], defaults), '/layerOperations/0/afterID', /unknown add field/);
  assert.equal(applyAuthoredLayerOperations(base, [{ op: 'add', layer: stack(2) }], defaults).rows.length, 4);
});

test('without a brief, text takes its ink from its own fill first, then its artboard', () => {
  const rows = expandDesignAuthoring([
    frame('w'),
    { id: 'card', $in: 'w', kind: 'text', text: 'On a dark card', bg: '#14181d' },
    { id: 'plain', $in: 'w', kind: 'text', text: 'On the white artboard' },
  ]).rows;
  assert.equal(byId(rows, 'card').fg, '#ffffff', 'light ink on the dark card');
  assert.equal(byId(rows, 'plain').fg, '#000000');
});

test('an artboard fill written as var(--token, fallback) is read by its fallback; an unreadable one is noted', () => {
  const dark = expandDesignAuthoring([frame('d', { bg: 'var(--brand-primary, #1e293b)' }), { id: 't', $in: 'd', kind: 'text', text: 'x' }]);
  assert.equal(byId(dark.rows, 't').fg, '#ffffff', 'white on the navy fallback');
  assert.deepEqual(dark.notes.map((n) => n.code), ['authoring.fg.derived']);
  const unknown = expandDesignAuthoring([frame('u', { bg: 'var(--brand-surface)' }), { id: 't', $in: 'u', kind: 'text', text: 'x' }]);
  assert.equal(byId(unknown.rows, 't').fg, '#000000');
  assert.deepEqual(unknown.notes.map((n) => [n.code, n.path]), [['authoring.fg.ground', '/1']]);
  assert.match(unknown.notes[0]!.message, /without a contrast check/);
});

test('the contrast note covers brief-styled rows and the row\'s own fill', () => {
  const brief = briefWith('#111111');
  const out = expandDesignAuthoring([
    frame('f', { bg: '#000000' }),
    { id: 'a', $in: 'f', kind: 'text', text: 'body style' },
    { id: 'b', $in: 'f', $style: 'title', text: 'title style' },
    { id: 'c', $in: 'f', kind: 'text', text: 'stated', fg: '#111111' },
  ], { brief });
  assert.equal(byId(out.rows, 'a').fg, '#111111');
  const note = out.notes.find((n) => n.code === 'authoring.fg.contrast');
  assert.ok(note, 'a contrast note');
  assert.equal(note.path, '/1');
  assert.match(note.message, /^2 text rows/, 'a and b, never c whose fg the row states');
  // A light card on a dark artboard: the theme's dark text reads well on the card.
  const card = expandDesignAuthoring([frame('f', { bg: '#000000' }), { id: 'a', $in: 'f', kind: 'text', text: 'x', bg: '#ffffff' }], { brief });
  assert.deepEqual(card.notes.filter((n) => n.code === 'authoring.fg.contrast'), []);
});

test('the theme text colour is written as hex for a style that states none', () => {
  for (const text of ['rgb(255, 255, 255)', 'oklch(1 0 0)', '#FFFFFF']) {
    const rows = expandDesignAuthoring([
      frame('f', { bg: '#000000' }),
      { id: 'hero', $in: 'f', $style: 'hero', text: 'x' },
      { id: 'title', $in: 'f', $style: 'title', text: 'y' },
    ], { brief: briefWith(text, '#000000'), styles: { hero: { fontSize: 99 } } }).rows;
    assert.equal(byId(rows, 'hero').fg, '#ffffff', `${text} as hex`);
    assert.equal(byId(rows, 'title').fg, '#ffffff');
  }
});

test('an inline style replaces the body style an unstyled row takes; basedOn body keeps it (as documented)', () => {
  const rows = expandDesignAuthoring([
    frame('f'),
    { id: 'none', $in: 'f', kind: 'text', text: 'a' },
    { id: 'inline', $in: 'f', $style: { fg: '#ff0000' }, text: 'b' },
    { id: 'field', $in: 'f', kind: 'text', text: 'c', fg: '#ff0000' },
    { id: 'based', $in: 'f', $style: { basedOn: 'body', fg: '#ff0000' }, text: 'd' },
  ]).rows;
  const pick = (r: Row): unknown[] => [r.fontSize, r.lineHeight, r.weight, r.fg];
  assert.deepEqual(pick(byId(rows, 'inline')), [24, 1.2, '400', '#ff0000'], 'an inline style without basedOn sits on the agent base');
  assert.deepEqual(pick(byId(rows, 'based')), pick(byId(rows, 'field')), 'basedOn body changes only the colour, like an fg row field');
  assert.deepEqual(pick(byId(rows, 'none')).slice(0, 3), pick(byId(rows, 'field')).slice(0, 3));
});

test('an error on a template key names the template, and one on an item key names the item', () => {
  const grid = (items: unknown[], extra: Row = {}): unknown[] =>
    [frame('f'), { id: 'g', $in: 'f', $grid: { columns: 2, colWidth: 100, rowPitch: 50, cell: [{ slot: 'a', kind: 'text', $style: 'missing', ...extra }], items } }];
  throwsAt(() => expandDesignAuthoring(grid(['A'])), '/1/$grid/cell/0/$style', /"missing" does not exist/);
  throwsAt(() => expandDesignAuthoring(grid([{ a: 'A' }])), '/1/$grid/cell/0/$style');
  throwsAt(() => expandDesignAuthoring(grid([{}])), '/1/$grid/cell/0/$style');
  throwsAt(() => expandDesignAuthoring(grid([{ a: { $style: 'gone' } }])), '/1/$grid/items/0/a/$style', /"gone" does not exist/);
  throwsAt(() => expandDesignAuthoring(grid([{ a: { x: 'far' } }], { $style: 'body' })), '/1/$grid/items/0/a/x', /expected a number/);
});

test('a template id without a placeholder is refused with the fix', () => {
  throwsAt(() => expandDesignAuthoring([frame('f'), { $in: 'f', $grid: { columns: 2, colWidth: 1, rowPitch: 1, cell: [{ id: 's2-card', kind: 'box' }], items: [{}, {}] } }]),
    '/1/$grid/cell/0/id', /every item gets the id "s2-card"; put \{i\} \(or \{r\} and \{c\}\)/);
});

test('a call gives each note once, over all its operations and patches', () => {
  const add = (id: string): Row => ({ op: 'add', layer: { id, $in: 'f', kind: 'text', text: id } });
  const ops = applyAuthoredLayerOperations([frame('f')], [add('a'), add('b'), add('c')], defaults, { theme: 'dark' });
  assert.deepEqual(ops.notes.map((n) => [n.code, n.path]), [['authoring.theme.unused', '/$theme'], ['authoring.fg.derived', '/layerOperations/0/layer']]);
  assert.match(ops.notes[1]!.message, /^3 text rows/);
  const base = [frame('f'), { id: 'a', kind: 'text', frame: 'f', text: 'a' }, { id: 'b', kind: 'text', frame: 'f', text: 'b' }];
  const patched = applyAuthoredLayerPatches(base, [{ id: 'a', set: { $style: 'title' } }, { id: 'b', set: { $style: 'title' } }], { theme: 'dark' });
  assert.deepEqual(patched.notes.map((n) => n.code), ['authoring.theme.unused', 'authoring.fg.derived']);
  assert.match(patched.notes[1]!.message, /^2 text rows/);
});

test('the brief lists the text styles $style resolves to, at the master size', () => {
  const brief = designBrief(null);
  const size = brief.type.size as { width: number; height: number };
  assert.deepEqual(brief.type.styles, textStylesFromBrief(brief, { width: size.width, height: size.height }));
  assert.match(brief.type.note, /styles is the table a Design \$style resolves to/);
  // An artboard at the master size gets exactly the listed size.
  const rows = expandDesignAuthoring([frame('f', { w: size.width, h: size.height }), { id: 't', $in: 'f', $style: 'label', text: 'x' }], { brief }).rows;
  assert.equal(byId(rows, 't').fontSize, brief.type.styles.label!.fontSize);
});
