// SPDX-License-Identifier: MPL-2.0
/** Token workflow contracts across resolution, binding, recipes, pinned fonts and the shared token fixtures. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createTokenSet } from './tokens.ts';
import { tokenCompatibility } from './token-compatibility.ts';
import { assembleTokenSetFiles, coerceTokensDoc, summarizeTokensDoc } from './brand-import.ts';
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

// Fixture coverage. tests/fixtures/tokens/README.md carries one table row per case id
// used below; the last test fails when the table and these cases drift apart.
const FIXTURES = new URL('../../tests/fixtures/tokens/', import.meta.url);
const fixtureCases = new Set<string>();
type Doc = Record<string, unknown>;
const fixture = (name: string): Doc => JSON.parse(readFileSync(new URL(name, FIXTURES), 'utf8')) as Doc;
function fixtureTest(ids: string[], name: string, fn: () => void): void {
  for (const id of ids) fixtureCases.add(id);
  test(`fixture ${ids.join(' ')}: ${name}`, fn);
}
const LARK = { day: 'lark-day', night: 'lark-night', standardDensity: 'lark-density-standard', compact: 'lark-compact', standardCampaign: 'lark-campaign-standard', launch: 'lark-launch' };
const FENN = { hell: '6a1c0e5f9b2d47a8c3e1f0d9b8a7c6e5d4f3a2b1', dunkel: '0f9e8d7c6b5a4f3e2d1c0b9a8f7e6d5c4b3a2f1e', kontrastStandard: 'c4b3a2f1e0d9c8b7a6f5e4d3c2b1a0f9e8d7c6b5', hoch: '9d8c7b6a5f4e3d2c1b0a9f8e7d6c5b4a3f2e1d0c', markeStandard: '1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c', junior: 'e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4' };
const dayLaunch = { selection: { appearance: LARK.day, density: LARK.standardDensity, campaign: LARK.launch } };
const reverseKeys = (v: unknown): unknown => Array.isArray(v) ? v.map(reverseKeys) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).reverse().map(([k, x]) => [k, reverseKeys(x)])) : v;

fixtureTest(['S1', 'S2', 'R1'], 'Larkspur composes stable ids, stored defaults and ordered set collisions', () => {
  const doc = fixture('larkspur.tokens.json'), original = structuredClone(doc);
  const stored = resolveTokenSelection(doc);
  assert.deepEqual(stored.choices, { appearance: LARK.night, density: LARK.compact, campaign: LARK.standardCampaign });
  assert.deepEqual(stored.defaults, ['campaign']);
  assert.deepEqual(stored.diagnostics, []);
  assert.equal(createTokenSet(doc).resolve('action.fill'), '#8f83ff');
  assert.deepEqual(createTokenSet(doc).resolve('space.unit'), { value: 2, unit: 'px' });
  const launch = createTokenSet(doc, dayLaunch);
  assert.equal(launch.resolve('action.fill'), '#ffb38a');
  assert.deepEqual(launch.resolve('space.unit'), { value: 4, unit: 'px' });
  const fill = inspectTokenDocument(doc, dayLaunch).tokens.find(t => t.path === 'action.fill')!;
  assert.equal(fill.source?.location, '/campaign~1launch/action/fill');
  assert.deepEqual(fill.candidates.map(c => [c.set, c.active]), [['mode/night', false], ['mode/day', true], ['campaign/launch', true]]);
  assert.deepEqual(doc, original);
});

fixtureTest(['S4', 'S5'], 'legacy theme names apply in every group with that name and ignore stored choices', () => {
  const doc = fixture('larkspur.tokens.json');
  const shared = resolveTokenSelection(doc, { theme: 'Standard' });
  assert.deepEqual(shared.choices, { appearance: LARK.day, density: LARK.standardDensity, campaign: LARK.standardCampaign });
  assert.deepEqual(shared.defaults, ['appearance']);
  assert.deepEqual(resolveTokenSelection(doc, { theme: 'campaign/Standard' }).defaults, ['appearance', 'density']);
  const partial = resolveTokenSelection(doc, { selection: { density: LARK.standardDensity } });
  assert.deepEqual({ choices: partial.choices, defaults: partial.defaults }, { choices: { appearance: LARK.night, density: LARK.standardDensity, campaign: LARK.standardCampaign }, defaults: ['campaign'] });
  const night = resolveTokenSelection(doc, { theme: 'Night' });
  assert.deepEqual(night.choices, { appearance: LARK.night, density: LARK.standardDensity, campaign: LARK.standardCampaign });
  assert.deepEqual(createTokenSet(doc, { theme: 'Night' }).resolve('space.unit'), { value: 4, unit: 'px' });
});

fixtureTest(['R2', 'R3', 'R4'], 'alias chains, gradient stops and shadow fields resolve without rewriting the source', () => {
  const doc = fixture('larkspur.tokens.json'), original = structuredClone(doc);
  const launch = createTokenSet(doc, dayLaunch);
  assert.equal(launch.resolve('button.primary.fill'), '#ffb38a');
  assert.equal(launch.resolve('surface.raised'), '#fbfaf7');
  const report = inspectTokenDocument(doc, dayLaunch);
  const byPath = new Map(report.tokens.map(t => [t.path, t]));
  assert.deepEqual(byPath.get('action.fill')?.usedBy, ['button.primary.fill']);
  assert.deepEqual(byPath.get('palette.dawn')?.usedBy, ['gradient.horizon', 'action.fill']);
  assert.deepEqual(byPath.get('gradient.horizon')?.references, ['palette.dawn', 'palette.dusk']);
  assert.deepEqual(launch.resolve('gradient.horizon'), [{ color: '#ffb38a', position: 0 }, { color: '#3a2f7a', position: 1 }]);
  const card = (selection: Record<string, string>) => createTokenSet(doc, { selection }).resolve('elevation.card') as Record<string, unknown>;
  assert.deepEqual(card({ appearance: LARK.day, density: LARK.standardDensity }), { color: '#1c1a2e33', offsetX: { value: 0, unit: 'px' }, offsetY: { value: 4, unit: 'px' }, blur: { value: 4, unit: 'px' }, spread: { value: 0, unit: 'px' } });
  assert.deepEqual(card({ appearance: LARK.day, density: LARK.compact }).offsetY, { value: 2, unit: 'px' });
  assert.deepEqual(doc, original);
});

fixtureTest(['R6', 'R7', 'R8'], 'missing and cyclic references are diagnosed while unknown extensions stay opaque', () => {
  const lark = fixture('larkspur.tokens.json'), fenn = fixture('fennwick.tokens.json');
  const day = inspectTokenDocument(lark, dayLaunch), fennReport = inspectTokenDocument(fenn);
  const issue = (report: typeof day, path: string) => report.tokens.find(t => t.path === path)!.diagnostics.map(d => d.code);
  assert.deepEqual(issue(day, 'text.muted'), ['missing']);
  assert.deepEqual(issue(fennReport, 'verweis.fehlt'), ['missing']);
  assert.equal(createTokenSet(lark, dayLaunch).resolve('text.muted'), '{palette.mist}');
  // Only the first member reached carries the cycle code; D3 covers the walk order.
  assert.deepEqual(['focus.ring', 'focus.halo'].map(path => issue(day, path)), [['cycle'], []]);
  assert.deepEqual(['zyklus.eins', 'zyklus.zwei', 'zyklus.drei'].map(path => issue(fennReport, path)), [['cycle'], [], []]);
  for (const path of ['focus.ring', 'focus.halo']) assert.match(String(createTokenSet(lark, dayLaunch).resolve(path)), /^\{focus\./);
  for (const path of ['zyklus.eins', 'zyklus.zwei', 'zyklus.drei']) assert.match(String(createTokenSet(fenn).resolve(path)), /^\{zyklus\./);
  assert.deepEqual(createTokenSet(lark).get('palette.larkspur')?.extensions, { 'org.example.larkspur': { swatchId: 'LK-001', reviewed: false } });
  const moos = fennReport.tokens.find(t => t.path === 'farbe.moos')!;
  assert.deepEqual(moos.source?.extensions, { 'com.example.fennwick': { druckfarbe: 'Moos 57', notiz: '{kein.verweis}' } });
  assert.deepEqual(moos.references, []);
  assert.ok(!fennReport.tokens.some(t => t.references.includes('kein.verweis')));
  assert.deepEqual(tokenCompatibility(fenn).extensionNamespaces, ['com.example.fennwick']);
});

fixtureTest(['U1', 'U2', 'U3'], 'DTCG 2025.10 pointer references and group inheritance are retained, not resolved', () => {
  const doc = fixture('larkspur.tokens.json'), original = structuredClone(doc);
  const set = createTokenSet(doc, dayLaunch), report = inspectTokenDocument(doc, dayLaunch), compat = tokenCompatibility(doc);
  assert.equal(set.has('palette.accent'), false);
  assert.ok(report.diagnostics.some(d => d.code === 'unsupported' && d.path === 'palette.accent'));
  assert.ok(compat.diagnostics.some(d => d.code === 'json-pointer' && d.path === '/foundation~1colour/palette/accent/$ref'));
  assert.deepEqual(set.resolve('space.inset'), { value: { $ref: '#/foundation~1space/space/unit/$value/value' }, unit: 'px' });
  assert.ok(compat.diagnostics.some(d => d.code === 'json-pointer' && d.path === '/foundation~1space/space/inset/$value/value/$ref'));
  assert.ok(!report.diagnostics.some(d => d.path === 'space.inset') && !report.tokens.find(t => t.path === 'space.inset')!.diagnostics.length);
  assert.equal(set.resolve('button.quiet.fill'), '#fbfaf7');
  assert.equal(set.has('button.quiet.label'), false);
  assert.ok(report.diagnostics.some(d => d.code === 'unsupported' && d.path === 'button.quiet'));
  assert.ok(compat.diagnostics.some(d => d.code === 'group-inheritance' && d.path === '/components/button/quiet/$extends'));
  assert.deepEqual(doc, original);
});

fixtureTest(['C1', 'D1'], 'the compatibility report reads named themes one at a time and miscounts object values', () => {
  const doc = fixture('larkspur.tokens.json'), report = tokenCompatibility(doc);
  assert.deepEqual(report.selections.map(s => s.mode), [null, LARK.day, LARK.night, LARK.standardDensity, LARK.compact, LARK.standardCampaign, LARK.launch]);
  assert.equal(report.truncated, false);
  // D1: a resolved object value still matches the brace test on its serialised form.
  const unresolved = new Set(report.diagnostics.filter(d => d.code === 'unresolved-value' && !d.mode).map(d => d.path));
  for (const resolved of ['space.unit', 'space.gutter', 'gradient.horizon', 'elevation.card']) {
    assert.ok(unresolved.has(resolved), `${resolved} is still counted`);
    assert.doesNotMatch(JSON.stringify(createTokenSet(doc).resolve(resolved)), /"\{[^{}]+\}"/);
  }
  assert.ok(tokenCompatibility(fixture('fennwick.tokens.json')).diagnostics.some(d => d.code === 'unresolved-value' && d.path === 'maß.basis'));
});

fixtureTest(['S3', 'S6', 'S7', 'S8'], 'Fennwick reports competing, duplicate and missing selections without renaming labels', () => {
  const doc = fixture('fennwick.tokens.json');
  const stored = resolveTokenSelection(doc);
  assert.deepEqual(stored.choices, { Erscheinung: FENN.hell, Kontrast: FENN.kontrastStandard, Marke: FENN.junior });
  assert.deepEqual(stored.defaults, ['Kontrast']);
  assert.deepEqual(stored.diagnostics.map(d => d.message), [`Duplicate theme id ${FENN.junior} in Marke.`, 'Competing choices in Erscheinung; the first is effective.']);
  assert.deepEqual(stored.groups.find(g => g.id === 'Marke')?.options.map(o => o.name), ['Standard', 'Junior']);
  assert.equal(createTokenSet(doc).themes().length, 7);
  assert.equal(tokenCompatibility(doc).selections.filter(s => s.mode === FENN.junior).length, 2);
  const hoch = resolveTokenSelection(doc, { selection: { Erscheinung: FENN.dunkel, Kontrast: FENN.hoch, Marke: FENN.markeStandard } });
  assert.ok(hoch.diagnostics.some(d => d.message === 'Selected set 20 Kontrast/Fokus is missing.'));
  assert.deepEqual(hoch.sets, ['00 Basis/Farben', '00 Basis/Maße', '10 Semantik/Gemeinsam', '10 Semantik/Dunkel', '20 Kontrast/Hoch']);
  assert.equal(createTokenSet(doc, { selection: hoch.choices }).resolve('schaltfläche.hintergrund'), '#16241c');
});

fixtureTest(['R5'], 'a typography composite reports an indirect change when only its font family source changes', () => {
  const doc = fixture('fennwick.tokens.json');
  const standard = { selection: { Erscheinung: FENN.hell, Kontrast: FENN.kontrastStandard, Marke: FENN.markeStandard } };
  const junior = { selection: { ...standard.selection, Marke: FENN.junior } };
  assert.deepEqual(createTokenSet(doc, standard).resolve('schrift.fließtext'), { fontFamily: ['Fennwick Grotesk', 'sans-serif'], fontSize: { value: 18, unit: 'px' }, fontWeight: 400, lineHeight: 1.4 });
  assert.deepEqual(diffTokenDocuments(doc, doc, standard, junior).map(c => [c.path, c.kind]), [['schrift.familie', 'authored'], ['schrift.fließtext', 'resolved']]);
  assert.deepEqual(inspectTokenDocument(doc, junior).tokens.find(t => t.path === 'schrift.fließtext')?.diagnostics, []);
});

fixtureTest(['R9', 'D2', 'D3'], 'reordered keys keep selections and values but still disturb candidates and cycles', () => {
  for (const [name, collision, cycle] of [['larkspur.tokens.json', 'action.fill', 'focus.ring'], ['fennwick.tokens.json', 'schaltfläche.hintergrund', 'zyklus.eins']] as const) {
    const doc = fixture(name), reordered = reverseKeys(doc) as Doc;
    assert.deepEqual(resolveTokenSelection(reordered), resolveTokenSelection(doc));
    const values = (d: Doc) => new Map(createTokenSet(d).query().map(e => [e.path, e.value]));
    const a = values(doc), b = values(reordered);
    assert.deepEqual([...b.keys()].sort(), [...a.keys()].sort());
    const inCycle = (path: string) => path.startsWith(`${cycle.split('.')[0]}.`);
    for (const [path, value] of a) if (!inCycle(path)) assert.deepEqual(b.get(path), value, path);
    // D2 and D3: the diff still reports the collision and the cycle members.
    const changed = diffTokenDocuments(doc, reordered);
    assert.ok(changed.some(c => c.path === collision && c.kind === 'authored' && c.before === c.after), `${name} ${collision}`);
    assert.ok(changed.some(c => c.path === cycle && c.kind === 'resolved'), `${name} ${cycle}`);
    assert.ok(changed.every(c => c.path === collision || inCycle(c.path)), `${name} ${changed.map(c => c.path).join(', ')}`);
  }
});

const preset = (): Doc => fixture('tokens-studio/default-preset.json');
// The plugin's start screen loads this preset with these set states (setDefaultTokens.ts).
const startScreen = { id: 'start-screen', name: 'Start screen', selectedTokenSets: { core: 'source', light: 'enabled', theme: 'enabled' } };

fixtureTest(['T1', 'T2'], 'the Tokens Studio preset is one implicit set until set order and a theme are supplied', () => {
  const published = preset();
  assert.equal(coerceTokensDoc(published).source, 'dtcg');
  const flat = createTokenSet(published);
  assert.equal(flat.resolve('core.colors.black'), '#000000');
  assert.equal(flat.resolve('light.fg.default'), '{colors.black}');
  assert.equal(flat.has('fg.default'), false);
  const order = { tokenSetOrder: ['core', 'light', 'dark', 'theme'] };
  const layered = { ...preset(), $themes: [], $metadata: order };
  assert.equal(coerceTokensDoc(layered).source, 'tokens-studio');
  assert.deepEqual(summarizeTokensDoc(layered).sets, ['core', 'light', 'dark', 'theme']);
  assert.equal(createTokenSet(layered).resolve('fg.default'), '#ffffff');
  const started = createTokenSet({ ...preset(), $themes: [startScreen], $metadata: order });
  assert.equal(started.resolve('fg.default'), '#000000');
  assert.equal(started.resolve('accent.default'), '#7f9cf5');
  assert.equal(started.resolve('button.primary.background'), '#7f9cf5');
});

fixtureTest(['T3', 'T4'], 'Tokens Studio type names, maths and embedded references stay as authored', () => {
  const doc = { ...preset(), $themes: [startScreen], $metadata: { tokenSetOrder: ['core', 'light', 'dark', 'theme'] } };
  const set = createTokenSet(doc), report = inspectTokenDocument(doc);
  assert.deepEqual(set.resolve('typography.H1.Bold'), { fontFamily: '{fontFamilies.heading}', fontWeight: '{fontWeights.headingBold}', lineHeight: '{lineHeights.heading}', fontSize: '{fontSizes.h1}', paragraphSpacing: '{paragraphSpacing.h1}', letterSpacing: '{letterSpacing.decreased}' });
  const h1 = report.tokens.find(t => t.path === 'typography.H1.Bold')!;
  assert.ok(h1.diagnostics.some(d => d.code === 'type' && d.message === 'Expected fontFamily, but fontFamilies.heading is fontFamilies.'));
  assert.equal(set.get('fontSizes.h1')?.type, 'fontSizes');
  assert.equal(set.resolve('fontSizes.h1'), 'roundTo({fontSizes.body}*1.25^5)');
  assert.equal(set.resolve('dimension.sm'), '{dimension.xs} * {dimension.scale}');
  assert.equal((set.resolve('boxShadow.default') as { color: string }[])[0]?.color, 'rgba({shadows.default}, 0.15)');
  const unresolved = new Set(tokenCompatibility(doc).diagnostics.filter(d => d.code === 'unresolved-value').map(d => d.path));
  for (const path of ['fontSizes.h1', 'dimension.sm', 'boxShadow.default', 'typography.H1.Bold']) assert.ok(unresolved.has(path), path);
});

fixtureTest(['T5'], 'a legacy value/type sync folder assembles sets and themes but yields no tokens', () => {
  const root = new URL('tokens-studio/modifier-sync/', FIXTURES);
  const files: Record<string, unknown> = {};
  for (const path of ['$metadata.json', '$themes.json', 'core.json', 'theme/01-light.json', 'theme/02-dark.json']) files[path] = JSON.parse(readFileSync(new URL(path, root), 'utf8'));
  const assembled = assembleTokenSetFiles(files);
  assert.equal(assembled.source, 'token-set-files');
  assert.deepEqual(assembled.warnings, []);
  const doc = assembled.doc!;
  assert.deepEqual(summarizeTokensDoc(doc), { sets: ['core', 'theme/01-light', 'theme/02-dark'], themes: [{ name: 'light', group: null }, { name: 'dark', group: null }], tokenCount: 0, colorCount: 0 });
  assert.deepEqual(resolveTokenSelection(doc, { theme: 'dark' }).sets, ['core', 'theme/01-light', 'theme/02-dark']);
  assert.deepEqual((doc.$themes as { $figmaStyleReferences?: unknown }[])[0]?.$figmaStyleReferences, {});
  const report = inspectTokenDocument(doc), compat = tokenCompatibility(doc);
  assert.equal(report.tokens.length, 0);
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(compat.diagnostics, []);
  assert.deepEqual(compat.extensionNamespaces, ['studio.tokens']);
});

// Test data only: rename a token's value, type and description keys to their DTCG form.
const dtcgKeys = (v: unknown): unknown => !v || typeof v !== 'object' || Array.isArray(v) ? v
  : 'value' in v && 'type' in v ? Object.fromEntries(Object.entries(v).map(([k, x]) => [['value', 'type', 'description'].includes(k) ? `$${k}` : k, x]))
  : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k.startsWith('$') ? x : dtcgKeys(x)]));

fixtureTest(['T6'], 'the published single-file layout yields no tokens until its keys are renamed', () => {
  const published = fixture('tokens-studio/token-examples/radix.json'), original = structuredClone(published);
  const sets = ['radix-colors-v2', 'shadows', 'Notes on file'];
  assert.equal(coerceTokensDoc(published).source, 'tokens-studio');
  assert.deepEqual(summarizeTokensDoc(published), { sets, themes: [], tokenCount: 0, colorCount: 0 });
  assert.deepEqual(resolveTokenSelection(published).sets, sets);
  const report = inspectTokenDocument(published);
  assert.equal(report.tokens.length, 0);
  assert.deepEqual(report.diagnostics, []);
  assert.deepEqual(tokenCompatibility(published).diagnostics, []);
  const renamed = dtcgKeys(published) as Doc, set = createTokenSet(renamed);
  assert.equal(summarizeTokensDoc(renamed).tokenCount, 1531);
  assert.equal(set.resolve('colors.gray.light-alpha.5'), '#0000001f');
  assert.equal(set.get('shadows.light.1')?.type, 'boxShadow');
  assert.equal((set.resolve('shadows.light.1') as { color: string }[])[0]?.color, '{colors.gray.light-alpha.5}');
  assert.deepEqual(published, original);
});

test('fixture coverage table, case ids and upstream file identities agree', () => {
  const readme = readFileSync(new URL('README.md', FIXTURES), 'utf8');
  const rows = [...readme.matchAll(/^\| ([A-Z]\d+) \|/gm)].map(m => m[1]!);
  assert.equal(new Set(rows).size, rows.length, 'a case id appears twice in the table');
  assert.deepEqual([...rows].sort(), [...fixtureCases].sort());
  const blob = (bytes: Buffer) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  const listed = new Map([...readme.matchAll(/^\| `(tokens-studio\/[^`]+)` \| `[^`]+` \| `([0-9a-f]{40})` \|/gm)].map(m => [m[1]!, m[2]!]));
  const studio = new URL('tokens-studio/', FIXTURES);
  const onDisk = readdirSync(studio, { recursive: true, encoding: 'utf8' }).filter(p => statSync(new URL(p, studio)).isFile()).map(p => `tokens-studio/${p}`);
  assert.deepEqual([...listed.keys()].sort(), onDisk.sort());
  for (const [file, id] of listed) assert.equal(blob(readFileSync(new URL(file, FIXTURES))), id, file);
});
