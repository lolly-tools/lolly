// SPDX-License-Identifier: MPL-2.0
/** Token workflow contracts across resolution, binding, recipes and pinned fonts. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createTokenSet } from './tokens.ts';
import { resolveTokenSelection, tokenSelectionKey, parseTokenSelection } from './token-selection.ts';
import { inspectTokenDocument, diffTokenDocuments } from './token-inspect.ts';
import { generateTokenRecipe } from './token-recipes.ts';
import { mergeTokenDocuments, decideTokenMergeConflict } from './token-merge.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { applyPinnedFontFamilies, restorePinnedFontFamilies, pinnedFontAliases, verifyPinnedFontBytes } from './token-font-pins.ts';
import { withTokenSourceValue } from './token-edit.ts';
import { withTokenSelection } from './token-context.ts';
import type { HostV1, TokenResolveOptions } from './bridge/host-v1.ts';
import { sha256Hex } from './bytes.ts';
import { readVersionIndex, withVersionIndex } from './design-version.ts';
import { parseUrlState, serializeUrlState } from './url-mode.ts';
import { buildInputModel, flattenValue } from './inputs.ts';
import { loadTool, type ToolManifest } from './loader.ts';
import { createRuntime } from './runtime.ts';
import { TOKEN_EXT } from './token-ext.ts';

const layered = () => ({
  base: { identity: { $type: 'color', Beacon: { $value: '#7c3aed' } }, step: { $type: 'dimension', $value: { value: 8, unit: 'px' } } },
  day: { ink: { $type: 'color', $value: '{identity.Beacon}' } },
  night: { ink: { $type: 'color', $value: '#eeeedd' } },
  compact: { step: { $type: 'dimension', $value: { value: 4, unit: 'px' } } },
  roomy: { step: { $type: 'dimension', $value: { value: 16, unit: 'px' } } },
  $themes: [
    { id: 'day-id', name: 'Day', group: 'appearance', selectedTokenSets: { base: 'source', day: 'enabled' } },
    { id: 'night-id', name: 'Night', group: 'appearance', selectedTokenSets: { base: 'source', night: 'enabled' } },
    { id: 'compact-id', name: 'Compact', group: 'density', selectedTokenSets: { compact: 'enabled' } },
    { id: 'roomy-id', name: 'Roomy', group: 'density', selectedTokenSets: { roomy: 'enabled' } },
  ],
  $metadata: { tokenSetOrder: ['base', 'day', 'night', 'compact', 'roomy'], activeThemes: ['night-id', 'roomy-id'] },
});

test('explicit axes compose, stable ids survive labels, and legacy theme callers work', () => {
  const d = layered(), opts = { selection: { appearance: 'day-id', density: 'roomy-id' } };
  assert.equal(createTokenSet(d, opts).resolve('ink'), '#7c3aed');
  assert.deepEqual(createTokenSet(d, opts).resolve('step'), { value: 16, unit: 'px' });
  assert.equal(createTokenSet(d).resolve('ink'), '#eeeedd');
  assert.deepEqual(createTokenSet(d, { theme: 'Day' }).resolve('step'), { value: 4, unit: 'px' });
  d.$themes[0]!.name = 'A renamed imported choice';
  assert.equal(createTokenSet(d, opts).resolve('ink'), '#7c3aed');
  assert.equal(tokenSelectionKey(opts), tokenSelectionKey({ selection: { density: 'roomy-id', appearance: 'day-id' } }));
  const invalid = resolveTokenSelection(d, { selection: { appearance: 'removed', deleted: 'unknown' } });
  assert.equal(invalid.diagnostics.length, 2);
  assert.equal(invalid.choices.appearance, 'day-id');
});

test('scoped host defaults leave explicit legacy theme calls intact', async () => {
  const source = layered();
  const host = { tokens: { get: async (opts?: TokenResolveOptions) => createTokenSet(source, opts), resolve: async (ref: string, opts?: TokenResolveOptions) => createTokenSet(source, opts).resolve(ref) } } as unknown as HostV1;
  const scoped = withTokenSelection(host, { appearance: 'night-id', density: 'roomy-id' });
  assert.equal(await scoped.tokens!.resolve('ink'), '#eeeedd');
  assert.equal(await scoped.tokens!.resolve('ink', { theme: 'Day' }), '#7c3aed');
  assert.deepEqual((await scoped.tokens!.get({ theme: 'Day' })).resolve('step'), { value: 4, unit: 'px' });
});

test('inspection retains inactive definitions, winning sources, pointers and reverse edges', () => {
  const d = layered(), original = structuredClone(d);
  const report = inspectTokenDocument(d, { selection: { appearance: 'day-id', density: 'roomy-id' } });
  const step = report.tokens.find(t => t.path === 'step')!;
  assert.equal(step.source?.set, 'roomy');
  assert.equal(step.candidates.length, 3);
  assert.equal(step.candidates.find(c => c.set === 'compact')?.active, false);
  assert.deepEqual(report.tokens.find(t => t.path === 'ink')?.references, ['identity.Beacon']);
  assert.deepEqual(report.tokens.find(t => t.path === 'identity.Beacon')?.usedBy, ['ink']);
  assert.equal(step.source?.location, '/roomy/step');
  assert.deepEqual(d, original);
});

test('inspection distinguishes declared role slots from token dependents and observed usage', () => {
  const doc = { identity: { Beacon: { $type: 'color', $value: '#7c3aed' } }, $extensions: { [TOKEN_EXT]: { brandSystem: {
    schemaVersion: 1, id: 'custom-brand', label: 'Custom brand',
    roles: [{ id: 'signal', label: 'Beacon', resources: [{ type: 'token', path: 'identity.Beacon' }] }, { id: 'absent', label: 'Absent', resources: [{ type: 'token', path: 'missing' }] }],
    bindings: [{ id: 'headline-accent', roleId: 'signal', consumer: { tool: 'brand-poster', slot: 'accent' }, modes: ['night'] }], rules: [],
  } } } };
  const original = structuredClone(doc), report = inspectTokenDocument(doc);
  const token = report.tokens.find(entry => entry.path === 'identity.Beacon')!;
  assert.deepEqual(token.usedBy, []);
  assert.deepEqual(token.declaredConsumers, [{ roleId: 'signal', label: 'Beacon', bindings: [{ id: 'headline-accent', tool: 'brand-poster', slot: 'accent', modes: ['night'] }] }]);
  assert.ok(report.diagnostics.some(issue => issue.code === 'missing' && issue.path === 'missing'));
  assert.deepEqual(doc, original);
});

test('indirect changes, cycles, missing targets and unsupported constructs are explainable', () => {
  const a = { foundation: { $type: 'number', $value: 4 }, semantic: { $type: 'number', $value: '{foundation}' } };
  const b = structuredClone(a); b.foundation.$value = 8;
  assert.deepEqual(diffTokenDocuments(a, b).map(x => [x.path, x.kind]), [['foundation', 'authored'], ['semantic', 'resolved']]);
  const r = inspectTokenDocument({ a: { $value: '{b}' }, b: { $value: '{a}' }, c: { $value: '{missing}' }, group: { $extends: '#/a' } });
  assert.ok(r.tokens.some(x => x.diagnostics.some(d => d.code === 'cycle')));
  assert.ok(r.tokens.find(x => x.path === 'c')?.diagnostics.some(d => d.code === 'missing'));
  assert.ok(r.diagnostics.some(d => d.code === 'unsupported'));
  let deep: Record<string, unknown> = { token: { $value: 1 } };
  for (let i = 0; i < 60; i++) deep = { group: deep };
  assert.equal(inspectTokenDocument(deep).truncated, true);
});

test('supported composites resolve nested aliases without rewriting imported source', () => {
  const d = { size: { $type: 'dimension', $value: { value: 18, unit: 'px' } }, family: { $type: 'fontFamily', $value: 'Beacon Sans' }, heading: { $type: 'typography', $value: { fontFamily: '{family}', fontSize: '{size}', fontWeight: 700 } }, opaque: { $type: 'custom', $value: { item: '{family}' } } };
  const result = createTokenSet(d);
  assert.deepEqual(result.resolve('heading'), { fontFamily: 'Beacon Sans', fontSize: { value: 18, unit: 'px' }, fontWeight: 700 });
  assert.deepEqual(result.resolve('opaque'), { item: '{family}' });
  assert.equal(d.heading.$value.fontFamily, '{family}');
});

test('composite references retain mismatched types and explain the expected field type', () => {
  const d = { ink: { $type: 'color', $value: '#123456' }, heading: { $type: 'typography', $value: { fontSize: '{ink}', vendorValue: '{ink}' } } };
  assert.deepEqual(createTokenSet(d).resolve('heading'), d.heading.$value);
  assert.match(inspectTokenDocument(d).tokens.find(t => t.path === 'heading')!.diagnostics[0]!.message, /Expected dimension/);
});

test('semantic diffs ignore JSON key order and compare independent before/after contexts', () => {
  assert.deepEqual(diffTokenDocuments({ t: { $type: 'dimension', $value: { value: 4, unit: 'px' } } }, { t: { $value: { unit: 'px', value: 4 }, $type: 'dimension' } }), []);
  const source = layered();
  assert.ok(diffTokenDocuments(source, source, { selection: { appearance: 'day-id' } }, { selection: { appearance: 'night-id' } }).some(c => c.path === 'ink' && c.before === '#7c3aed' && c.after === '#eeeedd'));
});

test('source editing validates scalar units and composites while retaining opaque metadata', () => {
  const source = { size: { $type: 'dimension', $value: '2rem', $extensions: { vendor: { retained: true } } }, text: { $type: 'string', $value: 'Title' } };
  const changed = withTokenSourceValue(source, '/size', { value: 18, unit: 'px' });
  assert.deepEqual((changed.size as typeof source.size).$extensions, source.size.$extensions);
  assert.equal(source.size.$value, '2rem');
  assert.throws(() => withTokenSourceValue(source, '/size', 'nonsense'), /supported token type/);
  assert.throws(() => withTokenSourceValue(source, '/text', 42), /supported token type/);
  assert.throws(() => withTokenSourceValue({ curve: { $type: 'cubicBezier', $value: [0, 0, 1, 1] } }, '/curve', [2, 0, 1, 1]), /supported token type/);
});

test('typed consumers reject relative units, incompatible types, ranges and disallowed choices', () => {
  const set = createTokenSet({ inch: { $type: 'dimension', $value: { value: 1, unit: 'in' } }, relative: { $type: 'dimension', $value: '2rem' }, family: { $type: 'fontFamily', $value: ['Beacon Sans', 'sans-serif'] } });
  assert.equal(resolveTokenBinding(set.get('inch'), { type: 'number' }).value, 96);
  assert.equal(resolveTokenBinding(set.get('relative'), { type: 'number' }).status, 'incompatible');
  assert.equal(resolveTokenBinding(set.get('inch'), { type: 'number', max: 90 }).status, 'incompatible');
  assert.equal(resolveTokenBinding(set.get('family'), { type: 'select', options: [{ value: 'Other' }] }).status, 'incompatible');
  assert.equal(resolveTokenBinding(set.get('family'), { type: 'select', brandFonts: true }).value, 'Beacon Sans');
  assert.equal(resolveTokenBinding(set.get('family'), { type: 'text', maxLength: 4 }).status, 'incompatible');
  assert.equal(flattenValue({ ref: '{inch}', value: 96 }), 96);
});

test('theme choices and typed references preserve cached values through URL transport', () => {
  const manifest = { id: 'fixture', version: '1.0.0', inputs: [{ id: 'gap', type: 'number', default: 4 }, { id: 'title', type: 'text' }] } as ToolManifest;
  const model = buildInputModel(manifest, { initial: { gap: { ref: '{step}', value: 8 }, title: { ref: '{label}', value: 'Beacon' } } });
  const selection = { appearance: 'day-id', density: 'roomy-id' };
  const wire = serializeUrlState(model, { tokenSelection: selection });
  const parsed = parseUrlState(`?${wire}`, manifest);
  assert.deepEqual(parsed.tokenSelection, selection);
  assert.deepEqual(parsed.values.gap, { ref: '{step}', value: 8 });
  assert.deepEqual(parsed.values.title, { ref: '{label}', value: 'Beacon' });
  assert.equal(new URLSearchParams(wire).get('gap'), '8');
  assert.equal(new URLSearchParams(wire).get('title'), 'Beacon');
  assert.deepEqual(parseUrlState('gap=%7Bstep%7D', manifest).values.gap, { ref: '{step}' });
  assert.throws(() => parseUrlState('_ref.title=invalid', manifest), /token reference/);
  assert.throws(() => parseTokenSelection('[1,2]'));
  assert.throws(() => parseTokenSelection('{"density":1}'));
});

test('literal braces remain text while explicit typed links refresh in the runtime', async () => {
  const manifest = {
    id: 'token-literals', name: 'Token literals', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { formats: ['svg'], width: 100, height: 100 },
    inputs: [{ id: 'title', type: 'text', default: '{label}' }, { id: 'body', type: 'longtext', default: '{body}' }, { id: 'choice', type: 'select', options: [{ value: '{choice}', label: 'Literal' }], default: '{choice}' }],
  } as ToolManifest;
  const tool = await loadTool(manifest.id, async path => {
    if (path.endsWith('tool.json')) return JSON.stringify(manifest);
    if (path.endsWith('template.html')) return '<svg><text>{{title}}|{{body}}|{{choice}}</text></svg>';
    throw new Error('No optional source');
  });
  const source = { label: { $type: 'string', $value: 'Linked title' }, body: { $type: 'string', $value: 'Linked body' }, choice: { $type: 'string', $value: 'Linked choice' } };
  const host = {
    version: '1', shell: 'cli', capabilities: [], log: () => {}, profile: { get: async () => ({}) },
    assets: { get: async () => null, query: async () => [] }, state: { load: async () => null, save: async () => {}, list: async () => [] },
    clipboard: {}, export: {}, tokens: { get: async () => createTokenSet(source) },
  } as unknown as HostV1;
  const parsed = parseUrlState('title=%7Blabel%7D&body=%7Bbody%7D&choice=%7Bchoice%7D', manifest);
  const literal = await createRuntime(tool, host, parsed.values);
  assert.match(literal.getHydrated(), /\{label\}\|\{body\}\|\{choice\}/);
  const linked = await createRuntime(tool, host, { title: { ref: '{label}', value: 'Cached title' } });
  assert.equal(flattenValue(linked.getModel().find(input => input.id === 'title')!.value), 'Linked title');
  assert.match(linked.getHydrated(), /Linked title\|\{body\}\|\{choice\}/);
  await linked.setInput('title', '{label}');
  assert.match(linked.getHydrated(), /\{label\}\|\{body\}\|\{choice\}/);
});

test('registered recipes are deterministic, bounded and preserve manual token ownership', () => {
  const recipe = { id: 'scale', version: 1 as const, kind: 'spacing' as const, prefix: 'rhythm.scale', count: 4, base: 8, ratio: 1.25 };
  const d = generateTokenRecipe({}, recipe);
  assert.deepEqual(createTokenSet(d).resolve('rhythm.scale.4'), { value: 24, unit: 'px' });
  assert.deepEqual(generateTokenRecipe(d, recipe), d);
  assert.throws(() => generateTokenRecipe({ rhythm: { scale: { '1': { $value: 99 } } } }, recipe), /manual token/);
  assert.throws(() => generateTokenRecipe({}, { ...recipe, count: 100 }));
  assert.throws(() => generateTokenRecipe({}, { ...recipe, prefix: '__proto__.bad' }));
  const edited = structuredClone(d);
  (((edited.rhythm as Record<string, unknown>).scale as Record<string, { $value: unknown }>)[4]!).$value = { value: 100, unit: 'px' };
  const shrunk = generateTokenRecipe(edited, { ...recipe, count: 2 });
  assert.deepEqual(createTokenSet(shrunk).resolve('rhythm.scale.4'), { value: 100, unit: 'px' });
  const reset = generateTokenRecipe(shrunk, recipe, { clearOverrides: ['rhythm.scale.4'] });
  assert.deepEqual(createTokenSet(reset).resolve('rhythm.scale.4'), { value: 24, unit: 'px' });
});

test('upstream changes merge additions and deletions while retaining conflicting approved values', () => {
  const base = { color: { $type: 'color', $value: '#111111' }, remove: { $value: 1 } };
  const local = { ...base, color: { $type: 'color', $value: '#222222' } };
  const incoming = { color: { $type: 'color', $value: '#333333' }, added: { $value: 2 } };
  const result = mergeTokenDocuments(base, local, incoming);
  assert.deepEqual(result.document, { color: local.color, added: { $value: 2 } });
  assert.equal(result.conflicts[0]?.location, '/color');
  assert.deepEqual(decideTokenMergeConflict(result.document, result.conflicts[0]!, 'incoming').color, incoming.color);
  const deletion = mergeTokenDocuments(base, local, {});
  assert.equal('color' in decideTokenMergeConflict(deletion.document, deletion.conflicts[0]!, 'incoming'), false);
  assert.deepEqual(local.color, { $type: 'color', $value: '#222222' });
});

test('release fonts retain descriptors, isolate family names and reject substituted bytes', async () => {
  const bytes = new TextEncoder().encode('fixed font fixture'), sha256 = await sha256Hex(bytes);
  const pin = { id: 'user/font/beacon', version: '1.0.0', sha256, font: { family: 'Beacon Sans', weight: '100 900', style: 'normal' } };
  const source = { type: { $type: 'fontFamily', $value: 'Beacon Sans' } };
  const alias = (await pinnedFontAliases([pin])).get('beacon sans')!;
  const projected = await applyPinnedFontFamilies(source, [pin]);
  assert.equal(createTokenSet(projected).resolve('type'), alias);
  assert.equal(source.type.$value, 'Beacon Sans');
  assert.deepEqual(await restorePinnedFontFamilies(projected, [pin]), source);
  const version = { slug: 'v1', label: 'V1', date: '2026-09-30', checksum: 'fixture', assets: [pin] };
  assert.deepEqual(readVersionIndex(withVersionIndex(source, { active: 'v1', versions: [version] })).versions[0]?.assets?.[0]?.font, pin.font);
  assert.deepEqual(await verifyPinnedFontBytes(pin, bytes), bytes);
  await assert.rejects(() => verifyPinnedFontBytes(pin, new Uint8Array([1])), /bytes changed/);
});
