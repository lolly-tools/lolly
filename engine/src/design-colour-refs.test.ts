// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 291 W4: one document, every theme. Colour references written into a Design
 * row become literals plus links; run colours and gradient tints follow the theme;
 * the runtime switches theme after mount.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet } from './tokens.ts';
import { tokenColorVar } from './color-face.ts';
import {
  normaliseDesignColourRefs, readBlockTokenBindings, readBlockRunBindings, reconcileBlockTokenBindings,
  resolveBlockTokenBindings, withBlockTokenBinding, tintGradientSpec, hasDesignColourRefs, type DesignColourRefIssue,
} from './token-block-bindings.ts';
import { buildInputModel, updateInput, type BlockFieldSpec, type InputValue } from './inputs.ts';
import { loadTool, type ToolManifest } from './loader.ts';
import { createRuntime } from './runtime.ts';
import type { HostV1, TokenResolveOptions } from './bridge/host-v1.ts';

// A two-theme pack in the shape both shipped packs use: base ramps, light and dark sets, no group.
const doc = {
  $themes: [
    { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
    { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
  ],
  $metadata: { tokenSetOrder: ['base', 'light', 'dark'] },
  base: { color: { $type: 'color', ramp: { n1: { $value: '#1d1d1d' }, n3: { $value: '#525252' }, n4: { $value: '#6f6f6f' }, n7: { $value: '#dcdbdc' }, n9: { $value: '#ffffff' }, a3: { $value: '#008657' }, a4: { $value: '#30ba78' }, r3: { $value: '#bd3314' }, r5: { $value: '#fe7c3f' } } } },
  light: { color: { $type: 'color', semantic: { text: { $value: '{color.ramp.n1}' }, surface: { $value: '{color.ramp.n9}' } }, role: { 'muted-ink': { $value: '{color.ramp.n4}' }, 'accent-ink': { $value: '{color.ramp.a3}' }, 'alert-ink': { $value: '{color.ramp.r3}' }, hairline: { $value: '{color.ramp.n7}' } } } },
  dark: { color: { $type: 'color', semantic: { text: { $value: '{color.ramp.n9}' }, surface: { $value: '{color.ramp.n1}' } }, role: { 'muted-ink': { $value: '{color.ramp.n7}' }, 'accent-ink': { $value: '{color.ramp.a4}' }, 'alert-ink': { $value: '{color.ramp.r5}' }, hairline: { $value: '{color.ramp.n3}' } } } },
};
const light = createTokenSet(doc, {});
const dark = createTokenSet(doc, { selection: { '': 'dark' } });
const COLOURS = ['bg', 'fg', 'stroke'];
const fields: BlockFieldSpec[] = [
  { id: 'id', type: 'text' }, { id: 'kind', type: 'text' }, { id: 'bg', type: 'color' }, { id: 'fg', type: 'color' }, { id: 'stroke', type: 'color' },
  { id: 'text', type: 'text' }, { id: 'grad', type: 'text' }, { id: 'tokenLinks', type: 'text', default: '' },
];

test('a bare alias and the colour field var() form become the literal plus a link', () => {
  const rows: InputValue[] = [
    { id: 's1', kind: 'frame', bg: '{color.semantic.surface}' },
    { id: 't', kind: 'text', fg: '{color.role.muted-ink}', text: 'x' },
    { id: 'p', kind: 'path', stroke: `var(${tokenColorVar('{color.role.hairline}')}, #dcdbdc)` },
  ];
  const out = normaliseDesignColourRefs(rows, COLOURS, light) as Record<string, unknown>[];
  assert.equal(out[0]!.bg, '#ffffff');
  assert.deepEqual(readBlockTokenBindings(out[0]!.tokenLinks).bg, { ref: '{color.semantic.surface}', value: '#ffffff', status: 'linked' });
  assert.equal(out[1]!.fg, '#6f6f6f');
  assert.equal(out[2]!.stroke, '#dcdbdc');
  assert.equal(readBlockTokenBindings(out[2]!.tokenLinks).stroke?.ref, '{color.role.hairline}');
  // The same rows under the dark set: the literal is the dark value, the link the same ref.
  const darkRows = resolveBlockTokenBindings(out as InputValue[], 'tokenLinks', fields, dark) as Record<string, unknown>[];
  assert.deepEqual([darkRows[0]!.bg, darkRows[1]!.fg, darkRows[2]!.stroke], ['#1d1d1d', '#dcdbdc', '#525252']);
});

test('rows with no reference are returned untouched, the array included', () => {
  const rows: InputValue[] = [{ id: 'a', kind: 'box', bg: '#ffffff', text: '{#008657 w500|risk}' }, { id: 'b', kind: 'text', fg: '#000000', text: 'plain {x|y}' }];
  assert.equal(normaliseDesignColourRefs(rows, COLOURS, light), rows);
  assert.equal(hasDesignColourRefs(rows, COLOURS), false);
  const linked = withBlockTokenBinding({ id: 'c', bg: '#ffffff' }, 'tokenLinks', 'bg', { ref: '{color.semantic.surface}', value: '#ffffff' }) as InputValue;
  const resolved = resolveBlockTokenBindings([rows[0]!, linked], 'tokenLinks', fields, light);
  assert.equal(resolved[0], rows[0]);
});

test('an unresolved reference keeps the previous literal and says so, never the raw alias', () => {
  const issues: DesignColourRefIssue[] = [];
  const prior = withBlockTokenBinding({ id: 'a', kind: 'box', bg: '#123456' }, 'tokenLinks', 'bg', { ref: '{color.semantic.surface}', value: '#123456' });
  const rows: InputValue[] = [
    { ...prior, bg: '{color.role.missing}' } as InputValue,
    { id: 'b', kind: 'box', bg: `var(${tokenColorVar('{color.nope}')}, #abcdef)` },
    { id: 'c', kind: 'box', bg: '{color.nope}' },
  ];
  const out = normaliseDesignColourRefs(rows, COLOURS, light, 'srgb', { onIssue: (i) => issues.push(i), pointer: '/boxes' }) as Record<string, unknown>[];
  assert.equal(out[0]!.bg, '#123456');
  assert.deepEqual(readBlockTokenBindings(out[0]!.tokenLinks).bg?.status, 'unresolved');
  assert.equal(readBlockTokenBindings(out[0]!.tokenLinks).bg?.ref, '{color.role.missing}');
  assert.equal(out[1]!.bg, '#abcdef');
  assert.equal(out[2]!.bg, '');
  assert.deepEqual(issues.map((i) => i.pointer), ['/boxes/0/bg', '/boxes/1/bg', '/boxes/2/bg']);
  // Once the token exists the next resolve completes the link.
  const later = resolveBlockTokenBindings(out as InputValue[], 'tokenLinks', fields, createTokenSet({ color: { nope: { $type: 'color', $value: '#010203' } } }));
  assert.equal((later[2] as Record<string, unknown>).bg, '#010203');
});

test('run colours: the @ form lowers to a literal run, and a theme switch rewrites the hex', () => {
  const rows: InputValue[] = [{ id: 't', kind: 'text', text: 'Not an exit. An {@color.role.alert-ink w500|assumption}, {@color.role.accent-ink mono|A} and {u|plain}.' }];
  const out = normaliseDesignColourRefs(rows, COLOURS, light) as Record<string, unknown>[];
  assert.equal(out[0]!.text, 'Not an exit. An {#bd3314 w500|assumption}, {#008657 mono|A} and {u|plain}.');
  assert.deepEqual(readBlockRunBindings(out[0]!.tokenLinks), {
    bd3314: { ref: '{color.role.alert-ink}', value: '#bd3314', status: 'linked' },
    '008657': { ref: '{color.role.accent-ink}', value: '#008657', status: 'linked' },
  });
  // The reconciler ignores run links, and an ordinary field link keeps them.
  assert.deepEqual(readBlockTokenBindings(out[0]!.tokenLinks), {});
  const edited = reconcileBlockTokenBindings([withBlockTokenBinding(out[0]! as never, 'tokenLinks', 'fg', { ref: '{color.semantic.text}', value: '#1d1d1d' }) as InputValue], 'tokenLinks');
  assert.equal(Object.keys(readBlockRunBindings((edited[0] as Record<string, unknown>).tokenLinks)).length, 2);
  const darkRow = resolveBlockTokenBindings(out as InputValue[], 'tokenLinks', fields, dark)[0] as Record<string, unknown>;
  assert.equal(darkRow.text, 'Not an exit. An {#fe7c3f w500|assumption}, {#30ba78 mono|A} and {u|plain}.');
  assert.deepEqual(Object.keys(readBlockRunBindings(darkRow.tokenLinks)).sort(), ['30ba78', 'fe7c3f']);
  const back = resolveBlockTokenBindings([darkRow as InputValue], 'tokenLinks', fields, light)[0] as Record<string, unknown>;
  assert.equal(back.text, out[0]!.text);
});

test('two references that share a hex in one row are refused with a pointer', () => {
  const issues: DesignColourRefIssue[] = [];
  const shared = createTokenSet({ color: { a: { $type: 'color', $value: '#112233' }, b: { $type: 'color', $value: '#112233' } } });
  const out = normaliseDesignColourRefs([{ id: 't', text: '{@color.a|one} {@color.b|two}' }], COLOURS, shared, 'srgb', { onIssue: (i) => issues.push(i), pointer: '/boxes' }) as Record<string, unknown>[];
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.code, 'colour.run.ambiguous');
  assert.equal(issues[0]!.pointer, '/boxes/0/text');
  assert.equal(out[0]!.text, '{#112233|one} {@color.b|two}');
  // A reference on the hex a literal run already uses is refused the same way.
  const lit: DesignColourRefIssue[] = [];
  normaliseDesignColourRefs([{ id: 't', text: '{#008657|lit} {@color.role.accent-ink|ref}' }], COLOURS, light, 'srgb', { onIssue: (i) => lit.push(i) });
  assert.equal(lit[0]?.code, 'colour.run.ambiguous');
});

test('a run link whose run was edited away is kept, detached', () => {
  const out = normaliseDesignColourRefs([{ id: 't', text: 'a {@color.role.accent-ink|b}' }], COLOURS, light) as Record<string, unknown>[];
  const edited = { ...out[0]!, text: 'a b' } as InputValue;
  const next = resolveBlockTokenBindings([edited], 'tokenLinks', fields, dark)[0] as Record<string, unknown>;
  assert.equal(next.text, 'a b');
  assert.equal(readBlockRunBindings(next.tokenLinks)['008657']?.custom, true);
});

test('a gradient tint link recolours every stop and keeps each alpha', () => {
  assert.equal(tintGradientSpec('lin_0_fffffff2-0_ffffffa6-30_ffffff00-62', '#0c322c'), 'lin_0_0c322cf2-0_0c322ca6-30_0c322c00-62');
  assert.equal(tintGradientSpec('lin_90_fff-0_transparent-100', '#123456'), 'lin_90_123456-0_12345600-100');
  assert.equal(tintGradientSpec('rad_0_ffffff-0_000000-100', '#123456'), null);
  const row = { id: 'scrim', kind: 'box', grad: 'lin_0_fffffff2-0_ffffffa6-30_ffffff00-62', tokenLinks: JSON.stringify({ grad: { ref: '{color.semantic.surface}', value: 'lin_0_fffffff2-0_ffffffa6-30_ffffff00-62', mode: 'tint' } }) };
  const darkRow = resolveBlockTokenBindings([row], 'tokenLinks', fields, dark)[0] as Record<string, unknown>;
  assert.equal(darkRow.grad, 'lin_0_1d1d1df2-0_1d1d1da6-30_1d1d1d00-62');
  assert.deepEqual(readBlockTokenBindings(darkRow.tokenLinks).grad, { ref: '{color.semantic.surface}', value: darkRow.grad, status: 'linked', mode: 'tint' });
  const lightRow = resolveBlockTokenBindings([darkRow as InputValue], 'tokenLinks', fields, light)[0] as Record<string, unknown>;
  assert.equal(lightRow.grad, row.grad);
  // Editing the gradient detaches the link like any other.
  const edited = reconcileBlockTokenBindings([{ ...lightRow, grad: 'lin_0_000000-0_ffffff-100' } as InputValue], 'tokenLinks')[0] as Record<string, unknown>;
  assert.equal(readBlockTokenBindings(edited.tokenLinks).grad?.custom, true);
  assert.equal((resolveBlockTokenBindings([edited as InputValue], 'tokenLinks', fields, dark)[0] as Record<string, unknown>).grad, 'lin_0_000000-0_ffffff-100');
  // A radial spec is refused, and keeps its stops.
  const radial = { ...row, grad: 'rad_0_ffffff-0_000000-100', tokenLinks: JSON.stringify({ grad: { ref: '{color.semantic.surface}', value: 'rad_0_ffffff-0_000000-100', mode: 'tint' } }) };
  const kept = resolveBlockTokenBindings([radial], 'tokenLinks', fields, dark)[0] as Record<string, unknown>;
  assert.equal(kept.grad, radial.grad);
  assert.equal(readBlockTokenBindings(kept.tokenLinks).grad?.status, 'incompatible');
});

const manifest = {
  id: 'colour-refs', name: 'Colour refs', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { formats: ['svg'], width: 100, height: 100 }, hooks: { onInput: true },
  inputs: [{ id: 'boxes', type: 'blocks', fields, tokenBindingsField: 'tokenLinks', default: [] }],
} as unknown as ToolManifest;

test('a write stores the literal plus a link; with no token set, an unresolved link and no alias', () => {
  let model = buildInputModel(manifest, { initial: { boxes: [] } });
  model = updateInput(model, 'boxes', [{ id: 'a', kind: 'box', bg: '{color.role.hairline}' }], { tokenSet: light });
  const row = (model[0]!.value as Record<string, unknown>[])[0]!;
  assert.equal(row.bg, '#dcdbdc');
  assert.equal(readBlockTokenBindings(row.tokenLinks).bg?.status, 'linked');
  model = updateInput(model, 'boxes', [{ id: 'a', kind: 'box', bg: '{color.role.hairline}' }]);
  const bare = (model[0]!.value as Record<string, unknown>[])[0]!;
  assert.equal(bare.bg, '');
  assert.equal(readBlockTokenBindings(bare.tokenLinks).bg?.status, 'unresolved');
});

function hostFor(log: string[] = []): HostV1 {
  return {
    version: '1', shell: 'cli', capabilities: [], log: (level: string, message: string) => { log.push(`${level}:${message}`); },
    profile: { get: async () => ({}) }, assets: { get: async () => null, query: async () => [] },
    state: { load: async () => null, save: async () => {}, list: async () => [] }, clipboard: {}, export: {},
    tokens: { get: async (opts: TokenResolveOptions = {}) => createTokenSet(doc, opts), colors: async () => [], resolve: async () => undefined },
  } as unknown as HostV1;
}

async function mountTool() {
  return loadTool(manifest.id, async (path) => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg>{{#each boxes}}<g data-bg="{{bg}}" data-text="{{text}}" data-grad="{{grad}}"></g>{{/each}}<desc>{{seen}}</desc></svg>';
    if (path.endsWith('hooks.js')) return 'var calls = 0; function onInput(ctx) { calls++; return { seen: ctx.id + calls }; }';
    throw new Error('No optional source');
  });
}

test('setTokenSelection switches a mounted document between themes and runs onInput', async () => {
  const tool = await mountTool();
  const authored = normaliseDesignColourRefs([
    { id: 'f', kind: 'frame', bg: '{color.semantic.surface}' },
    { id: 't', kind: 'text', fg: '{color.role.muted-ink}', text: 'An {@color.role.alert-ink w500|assumption}' },
    { id: 's', kind: 'box', grad: 'lin_0_fffffff2-0_ffffff00-62', tokenLinks: JSON.stringify({ grad: { ref: '{color.semantic.surface}', value: 'lin_0_fffffff2-0_ffffff00-62', mode: 'tint' } }) },
  ], COLOURS, light);
  const runtime = await createRuntime(tool, hostFor(), { boxes: authored });
  assert.equal(runtime.tokenSelection, undefined);
  assert.match(runtime.getHydrated(), /data-bg="#ffffff"/);
  await runtime.setTokenSelection({ '': 'dark' });
  assert.deepEqual(runtime.tokenSelection, { '': 'dark' });
  const html = runtime.getHydrated();
  assert.match(html, /data-bg="#1d1d1d"/);
  assert.match(html, /data-text="An \{#fe7c3f w500\|assumption\}"/);
  assert.match(html, /data-grad="lin_0_1d1d1df2-0_1d1d1d00-62"/);
  assert.match(html, /<desc>boxes\d+<\/desc>/);
  const rows = runtime.getModel()[0]!.value as Record<string, unknown>[];
  assert.equal(rows[1]!.fg, '#dcdbdc');
  await runtime.setTokenSelection({});
  assert.equal(runtime.tokenSelection, undefined);
  assert.match(runtime.getHydrated(), /data-text="An \{#bd3314 w500\|assumption\}"/);
  await assert.rejects(runtime.setTokenSelection({ '': 5 } as unknown as Record<string, string>), /Theme choices/);
});

test('the mount resolves a saved theme, and setInput lowers a reference under it', async () => {
  const tool = await mountTool();
  const runtime = await createRuntime(tool, hostFor(), { boxes: [{ id: 'a', kind: 'box', bg: '{color.semantic.surface}' }], __tokenSelection: { '': 'dark' } as unknown as InputValue });
  assert.equal((runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!.bg, '#1d1d1d');
  await runtime.setInput('boxes', [{ id: 'a', kind: 'box', bg: '{color.role.accent-ink}', text: '{@color.role.accent-ink|go}' }]);
  const row = (runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!;
  assert.equal(row.bg, '#30ba78');
  assert.equal(row.text, '{#30ba78|go}');
  assert.equal(readBlockTokenBindings(row.tokenLinks).bg?.ref, '{color.role.accent-ink}');
  await runtime.applyPatch({ boxes: [{ id: 'a', kind: 'box', stroke: `var(${tokenColorVar('{color.role.hairline}')}, #dcdbdc)` }] });
  assert.equal((runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!.stroke, '#525252');
});

test('an edit made while a theme switch resolves is resolved in the new theme too', async () => {
  const tool = await mountTool();
  const runtime = await createRuntime(tool, hostFor(), { boxes: normaliseDesignColourRefs([{ id: 'a', kind: 'box', bg: '{color.semantic.surface}' }], COLOURS, light) });
  const switching = runtime.setTokenSelection({ '': 'dark' });
  const editing = runtime.setInput('boxes', [{ id: 'a', kind: 'box', bg: '{color.semantic.surface}' }, { id: 'b', kind: 'box', bg: '{color.role.hairline}' }]);
  await Promise.all([switching, editing]);
  const rows = runtime.getModel()[0]!.value as Record<string, unknown>[];
  assert.deepEqual(rows.map((r) => r.bg), ['#1d1d1d', '#525252']);
  // The later of two switches wins.
  const first = runtime.setTokenSelection({});
  const second = runtime.setTokenSelection({ '': 'dark' });
  await Promise.all([first, second]);
  assert.deepEqual(runtime.tokenSelection, { '': 'dark' });
  assert.equal((runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!.bg, '#1d1d1d');
});

// ─── fix:colours (plan 291 M4 review) ────────────────────────────────────────

test('undo, paste or a peer write of rows saved in another theme lands in the current theme', async () => {
  const tool = await mountTool();
  const runtime = await createRuntime(tool, hostFor(), { boxes: [{ id: 'a', kind: 'box', bg: '{color.semantic.surface}', text: 'An {@color.role.accent-ink|ink}', grad: 'lin_0_ffffffcc-0_ffffff00-62', tokenLinks: JSON.stringify({ grad: { ref: '{color.semantic.surface}', value: 'lin_0_ffffffcc-0_ffffff00-62', mode: 'tint' } }) }] });
  // What a history entry holds: the rows as they were, in light.
  const before = structuredClone(runtime.getModel()[0]!.value) as Record<string, unknown>[];
  assert.equal(before[0]!.bg, '#ffffff');
  await runtime.setInput('boxes', [{ ...before[0]!, x: 40 }] as InputValue);
  await runtime.setTokenSelection({ '': 'dark' });
  assert.equal((runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!.bg, '#1d1d1d');
  // Undo writes the light rows back while the document is dark (tool/history.ts does this).
  await runtime.applyPatch({ boxes: before as InputValue });
  const undone = (runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!;
  assert.equal(undone.bg, '#1d1d1d');
  assert.equal(undone.text, 'An {#30ba78|ink}');
  assert.equal(undone.grad, 'lin_0_1d1d1dcc-0_1d1d1d00-62');
  assert.match(runtime.getHydrated(), /data-bg="#1d1d1d"/);
  assert.equal(readBlockTokenBindings(undone.tokenLinks).bg?.status, 'linked');
  // A pasted row carrying the light literal, through setInput, is re-resolved the same way.
  await runtime.setInput('boxes', [...(runtime.getModel()[0]!.value as InputValue[]), { ...before[0]!, id: 'b' } as InputValue]);
  assert.deepEqual((runtime.getModel()[0]!.value as Record<string, unknown>[]).map((r) => r.bg), ['#1d1d1d', '#1d1d1d']);
  // An edit the user made to a linked colour is theirs: it is detached, not re-resolved.
  await runtime.setInput('boxes', [{ ...undone, bg: '#ff0000' } as InputValue]);
  const own = (runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!;
  assert.equal(own.bg, '#ff0000');
  assert.equal(readBlockTokenBindings(own.tokenLinks).bg?.custom, true);
});

test('a write of rows already in the current theme keeps every row object', async () => {
  const tool = await mountTool();
  const runtime = await createRuntime(tool, hostFor(), { boxes: normaliseDesignColourRefs([{ id: 'a', kind: 'box', bg: '{color.semantic.surface}' }, { id: 'b', kind: 'box', bg: '#123456' }], COLOURS, light) });
  const rows = runtime.getModel()[0]!.value as InputValue[];
  assert.equal(resolveBlockTokenBindings(rows, 'tokenLinks', fields, light), rows, 'resolved rows resolve to the same array');
  const next = [rows[0]!, { ...(rows[1] as Record<string, unknown>), x: 5 } as InputValue];
  await runtime.setInput('boxes', next);
  const after = runtime.getModel()[0]!.value as InputValue[];
  assert.equal(after[0], rows[0]);
  assert.equal(after[1], next[1]);
});

test('back-to-back writes commit in the order they were made, with and without a reference', async () => {
  const tool = await mountTool();
  for (const delay of [0, 5]) {
    const host = hostFor();
    const get = host.tokens!.get;
    host.tokens = { ...host.tokens!, get: async (o?: TokenResolveOptions) => { if (delay) await new Promise((r) => setTimeout(r, delay)); return get(o); } };
    const runtime = await createRuntime(tool, host, { boxes: [{ id: 'a', kind: 'box', x: 0, bg: '#ffffff' }] });
    const first = runtime.setInput('boxes', [{ id: 'a', kind: 'box', x: 0, bg: '{color.semantic.surface}' }]);
    const second = runtime.setInput('boxes', [{ id: 'a', kind: 'box', x: 50, bg: '#ffffff' }]);
    await Promise.all([first, second]);
    const row = (runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!;
    assert.equal(row.x, 50, `the later move survives (token read ${delay} ms)`);
    // And the other way round: the later write holds the reference.
    const third = runtime.setInput('boxes', [{ id: 'a', kind: 'box', x: 70, bg: '#ffffff' }]);
    const fourth = runtime.applyPatch({ boxes: [{ id: 'a', kind: 'box', x: 90, bg: '{color.role.hairline}' }] });
    await Promise.all([third, fourth]);
    const last = (runtime.getModel()[0]!.value as Record<string, unknown>[])[0]!;
    assert.deepEqual([last.x, last.bg], [90, '#dcdbdc']);
  }
});

test('an edit made before a slow theme switch lands in the new theme', async () => {
  const tool = await mountTool();
  const host = hostFor();
  const get = host.tokens!.get;
  let slowLight = 0;
  host.tokens = { ...host.tokens!, get: async (o?: TokenResolveOptions) => { if (slowLight && !JSON.stringify(o ?? {}).includes('dark')) await new Promise((r) => setTimeout(r, slowLight)); return get(o); } };
  const runtime = await createRuntime(tool, host, { boxes: normaliseDesignColourRefs([{ id: 'a', kind: 'box', bg: '{color.semantic.surface}' }], COLOURS, light) });
  slowLight = 50;
  const edit = runtime.setInput('boxes', [{ id: 'a', kind: 'box', bg: '{color.semantic.surface}' }, { id: 'b', kind: 'box', bg: '{color.role.hairline}' }]);
  const swap = runtime.setTokenSelection({ '': 'dark' });
  await Promise.all([edit, swap]);
  assert.deepEqual(runtime.tokenSelection, { '': 'dark' });
  assert.deepEqual((runtime.getModel()[0]!.value as Record<string, unknown>[]).map((r) => r.bg), ['#1d1d1d', '#525252']);
});

test('a theme switch never merges two run links onto one hex', () => {
  // In dark, role.one moves onto the hex brand.constant keeps in every theme.
  const pair = {
    $themes: [
      { name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } },
      { name: 'dark', selectedTokenSets: { base: 'enabled', dark: 'enabled' } },
    ],
    $metadata: { tokenSetOrder: ['base', 'light', 'dark'] },
    base: { color: { $type: 'color', ramp: { a: { $value: '#111111' }, b: { $value: '#222222' }, c: { $value: '#333333' } }, brand: { constant: { $value: '{color.ramp.b}' } } } },
    light: { color: { $type: 'color', role: { one: { $value: '{color.ramp.a}' }, two: { $value: '{color.ramp.b}' }, three: { $value: '{color.ramp.a}' } } } },
    dark: { color: { $type: 'color', role: { one: { $value: '{color.ramp.b}' }, two: { $value: '{color.ramp.c}' }, three: { $value: '{color.ramp.b}' } } } },
  };
  const pl = createTokenSet(pair, {});
  const pd = createTokenSet(pair, { selection: { '': 'dark' } });
  const authored = normaliseDesignColourRefs([{ id: 't', kind: 'text', text: '{@color.role.one w500|risk} and {@color.brand.constant|green}' }], COLOURS, pl) as Record<string, unknown>[];
  assert.equal(authored[0]!.text, '{#111111 w500|risk} and {#222222|green}');
  const darkRow = resolveBlockTokenBindings(authored as InputValue[], 'tokenLinks', fields, pd)[0] as Record<string, unknown>;
  const darkRuns = readBlockRunBindings(darkRow.tokenLinks);
  assert.equal(darkRow.text, '{#111111 w500|risk} and {#222222|green}');
  assert.equal(darkRuns['222222']?.ref, '{color.brand.constant}');
  assert.equal(darkRuns['111111']?.ref, '{color.role.one}');
  assert.equal(darkRuns['111111']?.status, 'incompatible');
  // Back in light both links are whole again.
  const back = resolveBlockTokenBindings([darkRow as InputValue], 'tokenLinks', fields, pl)[0] as Record<string, unknown>;
  assert.equal(back.text, authored[0]!.text);
  assert.deepEqual(readBlockRunBindings(back.tokenLinks), readBlockRunBindings(authored[0]!.tokenLinks));
  // A chain moves together: one takes two's old hex while two moves on.
  const chain = normaliseDesignColourRefs([{ id: 'c', kind: 'text', text: '{@color.role.one|a} {@color.role.two|b}' }], COLOURS, pl) as Record<string, unknown>[];
  const chained = resolveBlockTokenBindings(chain as InputValue[], 'tokenLinks', fields, pd)[0] as Record<string, unknown>;
  assert.equal(chained.text, '{#222222|a} {#333333|b}');
  assert.deepEqual(Object.values(readBlockRunBindings(chained.tokenLinks)).map((l) => l.status), ['linked', 'linked']);
  // Two links that land on one hex: the first keeps the move, the second keeps its colour.
  const both = normaliseDesignColourRefs([{ id: 'd', kind: 'text', text: '{@color.role.one|a} {#444444|x}' }], COLOURS, pl) as Record<string, unknown>[];
  assert.equal(Object.keys(readBlockRunBindings(both[0]!.tokenLinks)).length, 1);
});
