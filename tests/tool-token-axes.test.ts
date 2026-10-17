// SPDX-License-Identifier: MPL-2.0
/**
 * A tool's opt-out from a kind of theme group (plans/319 A4, manifest `tokenAxes`).
 *
 * The decision is pure (engine/src/tool-token-axes.ts) and the runtime applies it at
 * mount and on every theme switch, so these tests cover both: which groups an
 * ignored kind reaches, what the pin keeps, what it reports, and that a hook, a
 * linked value and `runtime.tokenSelection` all see the canonical option. The
 * fixture is the public Lolly Start design system lifted to a canonical colourway
 * plus Persimmon, the same shape tests/colourway.test.ts uses.
 *
 * Run with: node --test tests/tool-token-axes.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createTokenSet } from '../engine/src/tokens.ts';
import { resolveTokenSelection } from '../engine/src/token-selection.ts';
import { addColourway, liftToColourways, type ColourwayValues } from '../engine/src/colourway.ts';
import {
  describeIgnoredTokenChoice, effectiveAxisKinds, ignoredTokenAxes, ignoresTokenAxes, pinIgnoredTokenAxes,
} from '../engine/src/tool-token-axes.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { validateManifest } from '../engine/src/validate.ts';
import { validateTool, TOKEN_AXIS_KINDS } from '../packages/core/src/index.ts';

type Rec = Record<string, unknown>;
const START = (): Rec => JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));
const PERSIMMON: Record<string, ColourwayValues> = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};

/** Lolly Start with a canonical colourway (`main`) and Persimmon. */
function colourwayDoc(stored?: Record<string, string>): Rec {
  const lifted = liftToColourways(START(), { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: PERSIMMON });
  assert.ok(added.ok);
  const doc = added.doc;
  if (stored) doc.$metadata = { ...(doc.$metadata as Rec), activeThemeSelection: stored };
  return doc;
}
const primary = (doc: unknown, selection?: Record<string, string>): string | undefined =>
  createTokenSet(doc, selection ? { selection } : {}).colors().find((s) => s.path === 'color.semantic.primary')?.value;

// ─── The pure decision ───────────────────────────────────────────────────────

test('a tool with no ignored kind pins nothing', () => {
  const resolved = resolveTokenSelection(colourwayDoc(), { selection: { colourway: 'persimmon' } });
  assert.equal(ignoresTokenAxes(undefined), false);
  assert.equal(ignoresTokenAxes({}), false);
  assert.deepEqual(ignoredTokenAxes(resolved.groups, undefined), []);
  assert.deepEqual(pinIgnoredTokenAxes({ colourway: 'persimmon' }, resolved, {}), { selection: { colourway: 'persimmon' }, ignored: [] });
});

test('an ignored kind reaches every group of that kind, and mode reaches the ungrouped light and dark group', () => {
  const resolved = resolveTokenSelection(colourwayDoc());
  assert.deepEqual(Object.fromEntries(effectiveAxisKinds(resolved.groups)), { '': 'mode', colourway: 'colourway' });
  assert.deepEqual(ignoredTokenAxes(resolved.groups, { colourway: 'ignore' }), [{ group: 'colourway', kind: 'colourway', canonical: 'main' }]);
  assert.deepEqual(ignoredTokenAxes(resolved.groups, { mode: 'ignore' }), [{ group: '', kind: 'mode', canonical: 'light' }]);
  // A design system that declares a mode group of its own: the ungrouped group is no longer read as mode.
  const declared = [
    { id: '', options: [{ id: 'a', name: 'a' }, { id: 'b', name: 'b' }], canonical: 'a' },
    { id: 'look', kind: 'mode' as const, options: [{ id: 'day', name: 'Day' }, { id: 'night', name: 'Night' }], canonical: 'night' },
  ];
  assert.deepEqual(ignoredTokenAxes(declared, { mode: 'ignore' }), [{ group: 'look', kind: 'mode', canonical: 'night' }]);
});

test('a requested colourway the tool ignores is pinned to canonical and reported, and the mode choice is kept', () => {
  const doc = colourwayDoc();
  const requested = { '': 'dark', colourway: 'persimmon' };
  const pinned = pinIgnoredTokenAxes(requested, resolveTokenSelection(doc, { selection: requested }), { colourway: 'ignore' });
  assert.deepEqual(pinned.selection, { '': 'dark', colourway: 'main' });
  assert.deepEqual(pinned.ignored, [{ group: 'colourway', kind: 'colourway', canonical: 'main', requested: 'persimmon' }]);
  assert.equal(primary(doc, pinned.selection), primary(doc, { '': 'dark', colourway: 'main' }));
  assert.notEqual(primary(doc, pinned.selection), primary(doc, requested), 'the fixture tells the two leads apart');
});

test('a stored choice is pinned but not reported, and a canonical or unknown request changes nothing', () => {
  const stored = colourwayDoc({ '': 'dark', colourway: 'persimmon' });
  const fromStore = pinIgnoredTokenAxes(undefined, resolveTokenSelection(stored), { colourway: 'ignore' });
  assert.deepEqual(fromStore.selection, { '': 'dark', colourway: 'main' }, 'explicit, so the stored dark is kept');
  assert.deepEqual(fromStore.ignored, [], 'the design system stored it; nobody asked for it on this render');

  const doc = colourwayDoc();
  assert.deepEqual(pinIgnoredTokenAxes(undefined, resolveTokenSelection(doc), { colourway: 'ignore' }), { selection: undefined, ignored: [] },
    'nothing to pin keeps the address and the session as they were');
  const asked = { colourway: 'main' };
  assert.deepEqual(pinIgnoredTokenAxes(asked, resolveTokenSelection(doc, { selection: asked }), { colourway: 'ignore' }), { selection: { colourway: 'main' }, ignored: [] });
  const unknown = { colourway: 'sepia' };
  assert.deepEqual(pinIgnoredTokenAxes(unknown, resolveTokenSelection(doc, { selection: unknown }), { colourway: 'ignore' }).ignored, [],
    'an option the design system does not declare is the resolver\'s diagnostic, not an ignored choice');
});

test('a tool that ignores mode keeps the colourway the link chose', () => {
  const doc = colourwayDoc();
  const requested = { '': 'dark', colourway: 'persimmon' };
  const pinned = pinIgnoredTokenAxes(requested, resolveTokenSelection(doc, { selection: requested }), { mode: 'ignore' });
  assert.deepEqual(pinned.selection, { '': 'light', colourway: 'persimmon' });
  assert.deepEqual(pinned.ignored.map((c) => [c.kind, c.requested, c.canonical]), [['mode', 'dark', 'light']]);
});

test('the report is one plain sentence that names the tool, the request and what was used', () => {
  const sentence = describeIgnoredTokenChoice({ group: 'colourway', kind: 'colourway', canonical: 'main', requested: 'persimmon' }, 'Filter');
  assert.equal(sentence, 'Filter ignores the colourway, so persimmon was not applied. It renders in main, the canonical option.');
  assert.match(describeIgnoredTokenChoice({ group: 'leads', kind: 'colourway', canonical: 'a', requested: 'b' }, 'X'), /colourway \(theme group leads\)/);
  assert.doesNotMatch(sentence, /—/);
});

// ─── The manifest field ──────────────────────────────────────────────────────

const manifest = (extra: Rec = {}): Rec => ({
  id: 'axes-probe', name: 'Axes probe', version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { width: 10, height: 10, formats: ['svg'] }, inputs: [], ...extra,
});

test('both schema copies accept tokenAxes keyed by axis kind with the one behaviour, and refuse anything else', () => {
  for (const ok of [{ colourway: 'ignore' }, { mode: 'ignore', density: 'ignore' }, {}]) {
    assert.equal(validateManifest(manifest({ tokenAxes: ok })).valid, true, JSON.stringify(ok));
    assert.equal(validateTool(manifest({ tokenAxes: ok })).valid, true, JSON.stringify(ok));
  }
  for (const bad of [{ colourway: 'follow' }, { lead: 'ignore' }, { colourway: true }, ['colourway']]) {
    assert.equal(validateManifest(manifest({ tokenAxes: bad })).valid, false, JSON.stringify(bad));
    assert.equal(validateTool(manifest({ tokenAxes: bad })).valid, false, JSON.stringify(bad));
  }
  const schema = JSON.parse(readFileSync(new URL('../schemas/tool.schema.json', import.meta.url), 'utf8'));
  assert.deepEqual(Object.keys(schema.properties.tokenAxes.properties), [...TOKEN_AXIS_KINDS], 'the keys are exactly the axis kinds, in their documented order');
});

// ─── The runtime ─────────────────────────────────────────────────────────────

function hostFor(doc: Rec): any {
  return {
    version: '1', shell: 'test', capabilities: [], log: () => {},
    profile: { get: async () => ({}) },
    assets: { get: async () => null, query: async () => [] },
    state: { load: async () => null, save: async () => {}, list: async () => [] },
    tokens: {
      get: async (opts = {}) => createTokenSet(doc, opts),
      colors: async (opts = {}) => createTokenSet(doc, opts).colors(),
      resolve: async (ref: string, opts = {}) => createTokenSet(doc, opts).resolve(ref),
      themes: async () => createTokenSet(doc).themes(),
      snapshot: async () => ({ document: doc, system: null, version: null, selection: { choices: {} } }),
    },
  };
}

let seq = 0;
function probe(tokenAxes?: Rec): any {
  return {
    manifest: manifest({ id: `axes-probe-${++seq}`, hooks: { onInit: true }, ...(tokenAxes ? { tokenAxes } : {}) }),
    template: '<p>{{lead}}</p>',
    styles: null,
    hooksSource: 'async function onInit({ host }) { return { lead: await host.tokens.resolve("color.semantic.primary") }; }',
    textTemplates: {}, textTemplateErrors: {}, hooksUrl: null, trustClass: 'builtin-verified',
  };
}

test('the runtime pins an ignored colourway at mount: hooks, the selection and the report agree', async () => {
  const doc = colourwayDoc();
  const main = primary(doc, { colourway: 'main' })!;
  const persimmon = primary(doc, { colourway: 'persimmon' })!;
  const runtime = await createRuntime(probe({ colourway: 'ignore' }), hostFor(doc), {}, { tokenSelection: { colourway: 'persimmon' } });
  assert.equal(runtime.getHydrated(), `<p>${main}</p>`);
  assert.deepEqual(runtime.tokenSelection, { '': 'light', colourway: 'main' });
  assert.deepEqual(runtime.ignoredTokenChoices, [{ group: 'colourway', kind: 'colourway', canonical: 'main', requested: 'persimmon' }]);

  const follows = await createRuntime(probe(), hostFor(doc), {}, { tokenSelection: { colourway: 'persimmon' } });
  assert.equal(follows.getHydrated(), `<p>${persimmon}</p>`, 'a tool without the opt-out follows the colourway');
  assert.deepEqual(follows.ignoredTokenChoices, []);
});

test('a saved session choice and a later switch are pinned the same way', async () => {
  const doc = colourwayDoc();
  const runtime = await createRuntime(probe({ colourway: 'ignore' }), hostFor(doc), { __tokenSelection: { '': 'dark', colourway: 'persimmon' } } as never);
  assert.deepEqual(runtime.tokenSelection, { '': 'dark', colourway: 'main' });
  await runtime.setTokenSelection({ '': 'light', colourway: 'persimmon' });
  assert.deepEqual(runtime.tokenSelection, { '': 'light', colourway: 'main' });
  assert.deepEqual(runtime.ignoredTokenChoices?.map((c) => c.requested), ['persimmon']);
  await runtime.setTokenSelection({ '': 'dark' });
  assert.deepEqual(runtime.tokenSelection, { '': 'dark' }, 'a switch that leaves the colourway canonical needs no pin');
  assert.deepEqual(runtime.ignoredTokenChoices, []);
});

test('a host with only a theme list still pins, from the canonical marks it reports', async () => {
  const doc = colourwayDoc();
  const host = hostFor(doc);
  delete host.tokens.snapshot;
  const runtime = await createRuntime(probe({ colourway: 'ignore' }), host, {}, { tokenSelection: { colourway: 'persimmon' } });
  assert.equal(runtime.tokenSelection?.colourway, 'main');
  assert.equal(runtime.getHydrated(), `<p>${primary(doc, { colourway: 'main' })}</p>`);
});
