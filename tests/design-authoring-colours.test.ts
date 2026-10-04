// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 W4 in the authoring lowering: colour references (`{path}` in a colour field,
 * `{@path …|}` in a run), `$tint` on a gradient, and `$themes`, lowered to literals plus
 * `tokenLinks` when the brand's tokens are given, and left for the runtime when not.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/design-authoring-colours.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { applyAuthoredLayerOperations, applyAuthoredLayerPatches, expandDesignAuthoring, expandDesignAuthoringDocument } from '../engine/src/design-authoring.ts';
import { designBrief } from '../engine/src/design-brief.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readBlockRunBindings, readBlockTokenBindings, resolveBlockTokenBindings } from '../engine/src/token-block-bindings.ts';
import type { BlockFieldSpec, InputValue } from '../engine/src/inputs.ts';

type Row = Record<string, unknown>;
const doc = {
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ],
  base: { color: { $type: 'color', ramp: { n1: { $value: '#1d1d1d' }, n4: { $value: '#6f6f6f' }, n7: { $value: '#dcdbdc' }, n9: { $value: '#ffffff' }, a3: { $value: '#008657' }, a4: { $value: '#30ba78' } } } },
  light: { color: { $type: 'color', semantic: { text: { $value: '{color.ramp.n1}' }, surface: { $value: '{color.ramp.n9}' }, muted: { $value: '{color.ramp.n4}' } }, role: { 'muted-ink': { $value: '{color.ramp.n4}' }, 'accent-ink': { $value: '{color.ramp.a3}' } } } },
  dark: { color: { $type: 'color', semantic: { text: { $value: '{color.ramp.n9}' }, surface: { $value: '{color.ramp.n1}' }, muted: { $value: '{color.ramp.n7}' } }, role: { 'muted-ink': { $value: '{color.ramp.n7}' }, 'accent-ink': { $value: '{color.ramp.a4}' } } } },
};
const tokens = createTokenSet(doc, {});
const dark = createTokenSet(doc, { selection: { '': 'dark' } });
const fields: BlockFieldSpec[] = ['bg', 'fg', 'stroke'].map((id) => ({ id, type: 'color' as const }));
const frame: Row = { id: 's1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, rot: 0, shape: 'rect', bg: '#ffffff', clipChildren: true };
const throwsAt = (fn: () => unknown, pointer: string, words?: RegExp): void => {
  assert.throws(fn, (err: Error) => {
    assert.ok(err.message.startsWith(`${pointer}: `), `expected an error at ${pointer}, got ${err.message}`);
    if (words) assert.match(err.message, words);
    return true;
  });
};

test('references in authored and stored rows lower to literals plus links', () => {
  const r = expandDesignAuthoring([
    { ...frame, bg: '{color.semantic.surface}' },
    { id: 't', $in: 's1', kind: 'text', x: 10, y: 20, w: 400, h: 60, text: 'An {@color.role.accent-ink w500|assumption}', fg: '{color.role.muted-ink}' },
  ], { tokens });
  const [f, t] = r.rows as Row[];
  assert.equal(f!.bg, '#ffffff');
  assert.equal(readBlockTokenBindings(f!.tokenLinks).bg?.ref, '{color.semantic.surface}');
  assert.equal(t!.fg, '#6f6f6f');
  assert.equal(t!.text, 'An {#008657 w500|assumption}');
  assert.deepEqual(Object.keys(readBlockRunBindings(t!.tokenLinks)), ['008657']);
  // The stored literals follow the theme on the next resolve.
  const darkRows = resolveBlockTokenBindings(r.rows as InputValue[], 'tokenLinks', [...fields, { id: 'tokenLinks', type: 'text' }], dark) as Row[];
  assert.deepEqual([darkRows[0]!.bg, darkRows[1]!.fg, darkRows[1]!.text], ['#1d1d1d', '#dcdbdc', 'An {#30ba78 w500|assumption}']);
});

test('a document with no reference expands to itself, with or without tokens', () => {
  const rows = [frame, { id: 'b', kind: 'box', frame: 's1', x: 0, y: 0, w: 10, h: 10, bg: '#008657' }];
  const r = expandDesignAuthoring(rows, { tokens });
  assert.equal(r.expanded, false);
  assert.equal(r.rows[0], rows[0]);
  assert.equal(r.rows[1], rows[1]);
});

test('without tokens a reference is left for the runtime and noted; a stored row is not touched', () => {
  const stored = { id: 'b', kind: 'box', bg: '{color.semantic.surface}' };
  const plain = expandDesignAuthoring([stored]);
  assert.equal(plain.expanded, false);
  assert.equal(plain.rows[0], stored);
  const r = expandDesignAuthoring([frame, { id: 't', $in: 's1', kind: 'text', text: 'x', fg: '{color.role.muted-ink}' }]);
  assert.equal((r.rows[1] as Row).fg, '{color.role.muted-ink}');
  assert.ok(r.notes.some((n) => n.code === 'authoring.colour.deferred' && n.path === '/1/fg'), JSON.stringify(r.notes));
});

test('a reference that does not resolve, and two run references on one colour, are errors at their pointer', () => {
  throwsAt(() => expandDesignAuthoring([frame, { id: 't', $in: 's1', kind: 'text', text: 'x', fg: '{color.role.nope}' }], { tokens }), '/1/fg', /does not resolve/);
  throwsAt(() => expandDesignAuthoring([{ id: 'b', kind: 'box', bg: '{color.nope}' }], { tokens }), '/0/bg', /does not resolve/);
  const twins = createTokenSet({ color: { a: { $type: 'color', $value: '#112233' }, b: { $type: 'color', $value: '#112233' } } });
  throwsAt(() => expandDesignAuthoring([{ id: 't', kind: 'text', $style: 'body', text: '{@color.a|one} {@color.b|two}' }], { tokens: twins }), '/0/text', /cannot tell the two apart/);
  // In a macro, the pointer points at the template key that was written.
  throwsAt(() => expandDesignAuthoring([frame, { id: 'st', $in: 's1', $stack: { pitch: 40, item: [{ slot: 'l', kind: 'text', w: 200, h: 30, fg: '{color.nope}' }], items: ['a'] } }], { tokens }), '/1/$stack/item/0/fg');
});

test('$tint links a linear grad to a colour and recolours its stops; a radial one is refused', () => {
  const r = expandDesignAuthoring([frame, { id: 'scrim', $in: 's1', kind: 'box', w: 1920, h: 1080, grad: 'lin_0_fffffff2-0_ffffffa6-30_ffffff00-62', $tint: 'color.semantic.surface' }], { tokens });
  const scrim = r.rows[1] as Row;
  assert.equal(scrim.grad, 'lin_0_fffffff2-0_ffffffa6-30_ffffff00-62');
  assert.deepEqual(readBlockTokenBindings(scrim.tokenLinks).grad, { ref: '{color.semantic.surface}', value: scrim.grad, status: 'linked', mode: 'tint' });
  const d = resolveBlockTokenBindings([scrim as InputValue], 'tokenLinks', fields, dark)[0] as Row;
  assert.equal(d.grad, 'lin_0_1d1d1df2-0_1d1d1da6-30_1d1d1d00-62');
  throwsAt(() => expandDesignAuthoring([{ id: 'r', kind: 'box', grad: 'rad_0_ffffff-0_000000-100', $tint: '{color.semantic.surface}' }], { tokens }), '/0/grad', /linear/);
  throwsAt(() => expandDesignAuthoring([{ id: 'r', kind: 'box', $tint: '{color.semantic.surface}' }], { tokens }), '/0/$tint', /grad/);
});

test('$themes links a style colour to the brief slot it came from, so text follows the theme', () => {
  const brief = designBrief(doc, null);
  const authored = { boxes: [frame, { id: 't', $in: 's1', kind: 'text', text: 'x', $style: 'body' }, { id: 'c', $in: 's1', kind: 'text', text: 'y', $style: 'caption' }] };
  const single = expandDesignAuthoringDocument(authored, { brief, tokens });
  assert.equal((single.rows[1] as Row).tokenLinks, undefined, 'one theme: literal colours, as before');
  const both = expandDesignAuthoringDocument({ ...authored, $themes: ['light', 'dark'] }, { brief, tokens });
  const [, body, caption] = both.rows as Row[];
  assert.equal(body!.fg, '#1d1d1d');
  assert.equal(readBlockTokenBindings(body!.tokenLinks).fg?.ref, '{color.semantic.text}');
  assert.equal(readBlockTokenBindings(caption!.tokenLinks).fg?.ref, '{color.semantic.muted}');
  assert.equal('$themes' in both.values, false);
  throwsAt(() => expandDesignAuthoringDocument({ ...authored, $themes: ['light', 'sepia'] }, { brief, tokens }), '/$themes', /no theme "sepia"/);
  throwsAt(() => expandDesignAuthoringDocument({ ...authored, $themes: 'every' }, { brief, tokens }), '/$themes');
});

test('$themes leaves a colour the author wrote into a style as written; only a brief colour is linked', () => {
  // A white headline over a photo stays white in the dark theme: the author chose the
  // colour, so it must not be linked to whichever slot happens to share its hex.
  const brief = designBrief(doc, null);
  const authored = {
    $themes: ['light', 'dark'],
    $styles: { display: { fontSize: 104, fg: '#ffffff' }, quiet: { basedOn: 'display', fontSize: 40 }, ink: { fg: '{color.role.muted-ink}' } },
    boxes: [
      frame,
      { id: 'd', $in: 's1', kind: 'text', text: 'x', $style: 'display' },
      { id: 'q', $in: 's1', kind: 'text', text: 'y', $style: 'quiet' },
      { id: 'i', $in: 's1', kind: 'text', text: 'z', $style: { basedOn: 'display', fg: '#1d1d1d' } },
      { id: 'r', $in: 's1', kind: 'text', text: 'w', $style: 'ink' },
      { id: 'b', $in: 's1', kind: 'text', text: 'v', $style: 'body' },
    ],
  };
  const rows = expandDesignAuthoringDocument(authored, { brief, tokens }).rows as Row[];
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const id of ['d', 'q']) {
    assert.equal(byId.get(id)!.fg, '#ffffff', `${id}: the style's own colour`);
    assert.equal(byId.get(id)!.tokenLinks, undefined, `${id}: not linked to the surface slot`);
  }
  assert.equal(byId.get('i')!.tokenLinks, undefined, 'an inline style colour is the author\'s too');
  assert.equal(readBlockTokenBindings(byId.get('r')!.tokenLinks).fg?.ref, '{color.role.muted-ink}', 'a style that names a token keeps that token');
  assert.equal(readBlockTokenBindings(byId.get('b')!.tokenLinks).fg?.ref, '{color.semantic.text}', 'a brief colour is still linked');
  const darkRows = resolveBlockTokenBindings(rows as InputValue[], 'tokenLinks', [...fields, { id: 'tokenLinks', type: 'text' }], dark) as Row[];
  assert.deepEqual(darkRows.filter((r) => r.kind === 'text').map((r) => r.fg), ['#ffffff', '#ffffff', '#1d1d1d', '#dcdbdc', '#ffffff']);
});

test('patches and adds lower references and keep the links a row already has', () => {
  const rows = expandDesignAuthoring([frame, { id: 't', $in: 's1', kind: 'text', text: 'x', fg: '{color.role.muted-ink}' }], { tokens }).rows;
  const patched = applyAuthoredLayerPatches(rows, [{ id: 't', set: { bg: '{color.role.accent-ink}' } }], { tokens }).rows;
  const t = patched[1]!;
  assert.equal(t.bg, '#008657');
  assert.deepEqual(Object.keys(readBlockTokenBindings(t.tokenLinks)).sort(), ['bg', 'fg']);
  throwsAt(() => applyAuthoredLayerPatches(rows, [{ id: 't', set: { fg: '{color.nope}' } }], { tokens }), '/layerPatches/0/set/fg', /does not resolve/);
  const added = applyAuthoredLayerOperations(rows, [{ op: 'add', layer: { id: 'n', kind: 'box', frame: 's1', x: 0, y: 0, w: 5, h: 5, bg: '{color.semantic.surface}' } }], undefined, { tokens }).rows;
  assert.equal(added.find((r) => r.id === 'n')!.bg, '#ffffff');
});
