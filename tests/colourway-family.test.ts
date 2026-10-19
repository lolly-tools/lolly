// SPDX-License-Identifier: MPL-2.0
/**
 * The family of leads (plans/319, milestone A5): `host.tokens.family()` and
 * `axes()`, the `--brand-lead-*` canvas variables, the hook worker's copy of
 * both, and the polychrome tools that draw on the family (chart, gradient,
 * audiogram) or re-read their brand when the colours change (chart, gradient,
 * and filter in its own file, colourway-family-filter.test.ts).
 *
 * Two promises are pinned for every piece. A design system with one lead
 * renders exactly as before: the same patches, the same hydrated markup and the
 * same canvas style attribute as a shell that has no family at all. And a
 * design system with several leads gives them to the tools, in the design
 * system's order, in the look the artefact is in.
 *
 * The fixtures are the public Lolly Start and Lolly Demo systems, plus Lolly
 * Demo given two more colourways through the engine's own `addColourway`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readTokenAxes } from '../engine/src/token-axes.ts';
import { tokenSelectionKey } from '../engine/src/token-selection.ts';
import { analysePcm } from '../engine/src/audio-analyse.ts';
import { deriveBrandTokens } from '../engine/src/brand-derive.ts';
import { addColourway, colourwayFamily, type ColourwayValues } from '../engine/src/colourway.ts';
import {
  tokenFamily, tokenAxesOf, brandLeadVars, withTokenSelection, scopedTokenOptions, MAX_LEAD_VARS,
} from '../engine/src/token-context.ts';
import { createHookWorkerCore, type HookWorkerOut, type HookInitMsg } from '../engine/src/hook-worker-core.ts';
import { runHostConformance, formatConformance } from '../packages/core/src/host-conformance.ts';
import { createCliBridge, applyBrandVars } from '../shells/cli/src/bridge.ts';
import type { HostV1, TokenResolveOptions, TokenSet } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const START = (): Rec => load('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');
const DEMO = (): Rec => load('../brands/lolly-demo/catalog/assets/lolly/tokens/opal.json');
const ONE_LEAD: Record<string, () => Rec> = {
  'Lolly Start': START,
  'Lolly Demo': DEMO,
  'a derived system': () => deriveBrandTokens({ primary: '#2453ff', name: 'Fixture' }),
};

const PERSIMMON: Record<string, ColourwayValues> = {
  light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
  dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
};
const LAGOON: Record<string, ColourwayValues> = {
  light: { primary: '#0e7490', 'on-primary': '#ffffff', secondary: '#164e63' },
  dark: { primary: '#22d3ee', 'on-primary': '#082f49', secondary: '#a5f3fc' },
};

/** Lolly Demo with three colourways: its own lead (`main`, canonical), Persimmon and Lagoon. */
function threeLeads(): Rec {
  let doc = DEMO();
  for (const [id, name, values] of [['persimmon', 'Persimmon', PERSIMMON], ['lagoon', 'Lagoon', LAGOON]] as const) {
    const result = addColourway(doc, { id, name, values });
    assert.ok(result.ok, result.ok ? '' : result.reasons.join(' '));
    doc = result.doc;
  }
  return doc;
}

const swatch = (doc: unknown, path: string, opts: TokenResolveOptions = {}): string | undefined =>
  createTokenSet(doc, opts).colors().find(s => s.path === path)?.value;

// ─── The engine helpers ──────────────────────────────────────────────────────

test('the family lists every lead canonical first, marks the active one and follows the look', async () => {
  const doc = threeLeads();
  const demo = DEMO();
  const light = await tokenFamily(doc, 'primary', { selection: { '': 'light', colourway: 'main' } });
  assert.deepEqual(light.map(m => [m.id, m.name, m.canonical, m.active, m.value]), [
    ['main', 'Main', true, true, swatch(demo, 'color.semantic.primary', { theme: 'light' })],
    ['persimmon', 'Persimmon', false, false, PERSIMMON.light!.primary],
    ['lagoon', 'Lagoon', false, false, LAGOON.light!.primary],
  ]);
  // The same values the A0 helper gives, so there is one definition of the family.
  assert.deepEqual(light.map(m => m.value), colourwayFamily(doc, 'primary', { '': 'light' }).map(l => l.value));

  const dark = await tokenFamily(doc, 'primary', { selection: { '': 'dark', colourway: 'persimmon' } });
  assert.deepEqual(dark.map(m => [m.id, m.active, m.value]), [
    ['main', false, swatch(demo, 'color.semantic.primary', { theme: 'dark' })],
    ['persimmon', true, PERSIMMON.dark!.primary],
    ['lagoon', false, LAGOON.dark!.primary],
  ]);

  // A theme request picks the look and keeps the document's own colourway.
  const stored = { ...doc, $metadata: { ...(doc.$metadata as Rec), activeThemeSelection: { '': 'light', colourway: 'lagoon' } } };
  const themed = await tokenFamily(stored, 'primary', { theme: 'dark' });
  assert.deepEqual(themed.map(m => [m.id, m.active, m.value]), [
    ['main', false, swatch(demo, 'color.semantic.primary', { theme: 'dark' })],
    ['persimmon', false, PERSIMMON.dark!.primary],
    ['lagoon', true, LAGOON.dark!.primary],
  ]);

  // Other roles, by slot name or by full path.
  assert.deepEqual((await tokenFamily(doc, 'secondary', { selection: { '': 'light' } })).map(m => m.value).slice(1), [PERSIMMON.light!.secondary, LAGOON.light!.secondary]);
  assert.deepEqual((await tokenFamily(doc, 'color.semantic.on-primary', { selection: { '': 'dark' } })).map(m => m.value).slice(1), [PERSIMMON.dark!['on-primary'], LAGOON.dark!['on-primary']]);
  assert.equal((await tokenFamily(doc)).length, 3, 'the role defaults to primary');

  // A role that is not a usable name answers an empty family rather than throwing.
  for (const role of ['', 7, null, {}, 'x'.repeat(300)]) assert.deepEqual(await tokenFamily(doc, role), [], `role ${JSON.stringify(role)?.slice(0, 20)}`);
  assert.deepEqual(await tokenFamily(doc, 'no-such-slot'), [], 'a role no colourway defines leaves every member out');
});

test('a design system with one lead has no family and no lead variables', async () => {
  for (const [name, make] of Object.entries(ONE_LEAD)) {
    const doc = make();
    assert.deepEqual(await tokenFamily(doc), [], name);
    assert.deepEqual(await tokenFamily(doc, 'primary', { theme: 'dark' }), [], `${name} in dark`);
    assert.deepEqual(brandLeadVars(await tokenFamily(doc)), [], name);
  }
});

test('axes are a copy of the document\'s theme groups', () => {
  const doc = threeLeads();
  const axes = tokenAxesOf(doc);
  assert.deepEqual(axes, readTokenAxes(doc).axes);
  assert.deepEqual(axes.map(a => [a.group, a.kind, a.canonical, a.options.map(o => o.id)]), [
    ['', 'mode', 'light', ['light', 'dark']],
    ['colourway', 'colourway', 'main', ['main', 'persimmon', 'lagoon']],
  ]);
  axes[1]!.options.pop();
  axes[1]!.canonical = 'lagoon';
  assert.equal(tokenAxesOf(doc)[1]!.options.length, 3, 'editing an answer changes nothing the next read sees');
  assert.equal(tokenAxesOf(doc)[1]!.canonical, 'main');
  assert.deepEqual(tokenAxesOf({}), [], 'a document with no themes has no axes');
});

/** A tokens API over one document, memoised per selection as every shell's is. */
function docTokens(doc: unknown, opts: { family?: boolean } = {}): NonNullable<HostV1['tokens']> {
  const sets = new Map<string, TokenSet>();
  const set = (o: TokenResolveOptions = {}): TokenSet => {
    const key = tokenSelectionKey(o);
    let s = sets.get(key);
    if (!s) { s = createTokenSet(doc, o); sets.set(key, s); }
    return s;
  };
  return {
    get: async (o = {}) => set(o),
    colors: async (o = {}) => set(o).colors(),
    resolve: async (ref, o = {}) => set(o).resolve(ref),
    themes: async () => set().themes(),
    ...(opts.family === false ? {} : {
      axes: async () => tokenAxesOf(doc),
      family: async (role?: string, o: TokenResolveOptions = {}) => tokenFamily(doc, role, o, set),
    }),
  };
}

const bareHost = (tokens: HostV1['tokens']): HostV1 => ({
  version: '1', shell: 'test', log: () => {},
  profile: { get: async () => ({}), subscribe: () => () => {} },
  assets: { get: async (id: string) => ({ id, url: `asset:${id}` }) },
  ...(tokens ? { tokens } : {}),
} as unknown as HostV1);

test('a document\'s choices scope the family like every other read', async () => {
  const doc = threeLeads();
  const scoped = withTokenSelection(bareHost(docTokens(doc)), { '': 'dark', colourway: 'persimmon' });
  const family = await scoped.tokens!.family!();
  assert.deepEqual(family.map(m => [m.id, m.active, m.value]), [
    ['main', false, swatch(DEMO(), 'color.semantic.primary', { theme: 'dark' })],
    ['persimmon', true, PERSIMMON.dark!.primary],
    ['lagoon', false, LAGOON.dark!.primary],
  ]);
  // A theme picks the look and keeps the document's colourway; a selection replaces both.
  assert.deepEqual((await scoped.tokens!.family!('primary', { theme: 'light' })).map(m => [m.active, m.value]).find(([a]) => a), [true, PERSIMMON.light!.primary]);
  assert.deepEqual((await scoped.tokens!.family!('primary', { selection: { '': 'light', colourway: 'lagoon' } })).filter(m => m.active).map(m => m.id), ['lagoon']);
  // Axes are structure: the scope passes them through unchanged.
  assert.deepEqual(await scoped.tokens!.axes!(), tokenAxesOf(doc));
  // A host without the member stays without it, so a tool's feature-detect still works.
  const without = withTokenSelection(bareHost(docTokens(doc, { family: false })), { colourway: 'persimmon' });
  assert.equal(without.tokens!.family, undefined);
  assert.equal(without.tokens!.axes, undefined);
  assert.deepEqual(scopedTokenOptions({ a: 'b' }, { selection: {} }), { selection: {} }, 'an explicit selection is never widened');
});

test('the lead variables are one per lead, canonical first, then the count', () => {
  const family = [{ value: '#033633' }, { value: '#C2410C' }, { value: '#0e7490' }];
  assert.deepEqual(brandLeadVars(family), [
    ['--brand-lead-1', '#033633'], ['--brand-lead-2', '#C2410C'], ['--brand-lead-3', '#0e7490'], ['--brand-lead-count', '3'],
  ]);
  assert.deepEqual(brandLeadVars([{ value: '#033633' }]), [], 'one lead paints nothing');
  assert.deepEqual(brandLeadVars(null), []);
  assert.deepEqual(brandLeadVars([{ value: 'red' }, { value: '#033633' }, { value: '{color.x}' }]), [], 'only plain hex colours count');
  const many = Array.from({ length: MAX_LEAD_VARS + 4 }, (_, i) => ({ value: `#0000${i.toString(16).padStart(2, '0')}` }));
  const vars = brandLeadVars(many);
  assert.equal(vars.length, MAX_LEAD_VARS + 1, 'the canvas carries at most MAX_LEAD_VARS leads');
  assert.deepEqual(vars.at(-1), ['--brand-lead-count', String(MAX_LEAD_VARS)]);
});

// ─── The hook worker ─────────────────────────────────────────────────────────

const tick = (): Promise<void> => new Promise(r => setTimeout(r, 0));

function core() {
  const sent: HookWorkerOut[] = [];
  return { sent, core: createHookWorkerCore({ post: m => sent.push(m) }) };
}

const withChoices = (doc: Rec, choices: Record<string, string>): Rec =>
  ({ ...doc, $metadata: { ...(doc.$metadata as Rec ?? {}), activeThemeSelection: choices } });

const WORKER_HOOKS = `
  var kept = host.tokens;
  async function read() {
    var family = typeof kept.family === 'function' ? await kept.family() : null;
    return {
      hasFamily: typeof host.tokens.family, hasAxes: typeof host.tokens.axes,
      family: family && family.map(function (m) { return m.id + (m.active ? '*' : '') + '=' + m.value; }).join(' '),
      axes: typeof kept.axes === 'function' ? (await kept.axes()).map(function (a) { return a.kind; }).join(' ') : null,
      primary: await kept.resolve('{color.semantic.primary}'),
    };
  }
  function onInit() { return read(); }
  function onInput() { return read(); }
`;

function initWith(doc: unknown, members: string[]): HookInitMsg {
  return {
    t: 'init', runId: 1, hooksSource: WORKER_HOOKS, tokenDoc: doc, tokenExcluded: [],
    hostShape: { tokens: ['get', 'colors', 'resolve', 'themes', ...members] }, seeds: {}, shell: 'test', capabilities: [],
  };
}

async function invoke(c: ReturnType<typeof core>, name: 'onInit' | 'onInput', callId: number): Promise<Rec> {
  c.core.handle({ t: 'invoke', runId: 1, callId, name, ctx: {} });
  await tick();
  const done = c.sent.find(m => m.t === 'invoke-done' && (m as { callId: number }).callId === callId) as { ok: boolean; patch: Rec; error?: string };
  assert.ok(done?.ok, done?.error ?? `no invoke-done for call ${callId}`);
  return done.patch;
}

test('an isolated hook reads the family and the axes the owning host offers, scoped to the document', async () => {
  const c = core();
  c.core.handle(initWith(withChoices(threeLeads(), { '': 'dark', colourway: 'persimmon' }), ['axes', 'family']));
  const patch = await invoke(c, 'onInit', 1);
  assert.equal(patch.hasFamily, 'function');
  assert.equal(patch.axes, 'mode colourway');
  assert.equal(patch.family, `main=${swatch(DEMO(), 'color.semantic.primary', { theme: 'dark' })} persimmon*=${PERSIMMON.dark!.primary} lagoon=${LAGOON.dark!.primary}`);
  assert.equal(patch.primary, PERSIMMON.dark!.primary);
});

test('an isolated hook sees no family when the owning host has none', async () => {
  const c = core();
  c.core.handle(initWith(threeLeads(), []));
  const patch = await invoke(c, 'onInit', 1);
  assert.equal(patch.hasFamily, 'undefined');
  assert.equal(patch.hasAxes, 'undefined');
  assert.equal(patch.family, null);
});

test('a tokens message re-points an isolated run, even through a reference the hook kept', async () => {
  const c = core();
  const doc = threeLeads();
  c.core.handle(initWith(withChoices(doc, { '': 'light', colourway: 'main' }), ['family']));
  const before = await invoke(c, 'onInit', 1);
  assert.equal(before.primary, swatch(DEMO(), 'color.semantic.primary', { theme: 'light' }));

  c.core.handle({ t: 'tokens', runId: 1, tokenDoc: withChoices(doc, { '': 'light', colourway: 'lagoon' }), tokenExcluded: [] });
  const after = await invoke(c, 'onInput', 2);
  assert.equal(after.primary, LAGOON.light!.primary, 'the hook\'s kept host.tokens answers from the new snapshot');
  assert.match(String(after.family), /lagoon\*=/);
  assert.equal(after.hasFamily, 'function', 'the members the owner offered survive the refresh');

  // A null document keeps the last good one; a run that was given no tokens ignores a document.
  c.core.handle({ t: 'tokens', runId: 1, tokenDoc: null, tokenExcluded: [] });
  assert.equal((await invoke(c, 'onInput', 3)).primary, LAGOON.light!.primary);
  const bare = core();
  bare.core.handle({ ...initWith(null, []), hooksSource: 'function onInit() { return { has: typeof host.tokens }; }' });
  bare.core.handle({ t: 'tokens', runId: 1, tokenDoc: doc, tokenExcluded: [] });
  bare.core.handle({ t: 'invoke', runId: 1, callId: 9, name: 'onInit', ctx: {} });
  await tick();
  assert.deepEqual((bare.sent.find(m => m.t === 'invoke-done') as { patch: Rec }).patch, { has: 'undefined' });
});

// ─── The CLI bridge ──────────────────────────────────────────────────────────

const window = new JSDOM('<!doctype html><html><body></body></html>').window;
const cli = (doc: Rec, tokenSelection?: Record<string, string>): Promise<HostV1> =>
  createCliBridge({ dom: window as never, profile: {}, tokensDocument: doc, ...(tokenSelection ? { tokenSelection } : {}) } as never) as Promise<HostV1>;

/** The same host with the plans/319 reads taken away: a shell from before milestone A5. */
function withoutFamily(host: HostV1): HostV1 {
  const { family: _family, axes: _axes, ...tokens } = host.tokens as NonNullable<HostV1['tokens']>;
  return { ...host, tokens } as HostV1;
}

test('the CLI bridge answers the family for its run\'s choices, conforms and paints the lead variables', async () => {
  const host = await cli(threeLeads(), { '': 'dark', colourway: 'persimmon' });
  const report = await runHostConformance(host);
  assert.ok(report.ok, formatConformance(report));
  const family = await host.tokens!.family!();
  assert.deepEqual(family.map(m => [m.id, m.active]), [['main', false], ['persimmon', true], ['lagoon', false]]);
  assert.deepEqual((await host.tokens!.axes!()).map(a => a.kind), ['mode', 'colourway']);

  const el = window.document.createElement('div');
  await applyBrandVars(el as unknown as HTMLElement, host);
  assert.equal(el.style.getPropertyValue('--brand-lead-1'), swatch(DEMO(), 'color.semantic.primary', { theme: 'dark' }));
  assert.equal(el.style.getPropertyValue('--brand-lead-2'), PERSIMMON.dark!.primary);
  assert.equal(el.style.getPropertyValue('--brand-lead-3'), LAGOON.dark!.primary);
  assert.equal(el.style.getPropertyValue('--brand-lead-count'), '3');
  assert.equal(el.style.getPropertyValue('--brand-primary'), PERSIMMON.dark!.primary, 'the canvas lead stays the artefact\'s own');
});

test('on the CLI a one-lead design system paints exactly the canvas a shell without the family paints', async () => {
  for (const [name, make] of Object.entries(ONE_LEAD)) {
    const host = await cli(make());
    assert.deepEqual(await host.tokens!.family!(), [], name);
    const a = window.document.createElement('div');
    const b = window.document.createElement('div');
    await applyBrandVars(a as unknown as HTMLElement, host);
    await applyBrandVars(b as unknown as HTMLElement, withoutFamily(host));
    assert.ok(a.getAttribute('style'), `${name} paints its brand`);
    assert.equal(a.getAttribute('style'), b.getAttribute('style'), name);
    assert.doesNotMatch(a.getAttribute('style') ?? '', /--brand-lead/, name);
  }
});

// ─── The tools ───────────────────────────────────────────────────────────────

const fetchFile = (path: string): Promise<string> => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8');
const tools = new Map<string, Awaited<ReturnType<typeof loadTool>>>();
async function tool(id: string) {
  if (!tools.has(id)) tools.set(id, await loadTool(id, fetchFile));
  return tools.get(id)!;
}

/** A tool mounted through the real runtime on a host, in-realm. */
async function mount(id: string, host: HostV1, initial: Rec = {}, tokenSelection?: Record<string, string>) {
  return createRuntime(await tool(id), host, initial as never, tokenSelection ? { tokenSelection } : {});
}

const chartState = (rt: Awaited<ReturnType<typeof mount>>): { spec: { theme: { colours: { primary: string; categorical: string[] } } } } =>
  JSON.parse(rt.getHydratedText('{{{_state}}}'));

test('chart, gradient, audiogram and filter render a one-lead design system exactly as a shell without the family', async () => {
  for (const [name, make] of Object.entries(ONE_LEAD)) {
    const host = await cli(make());
    for (const id of ['chart', 'gradient', 'audiogram', 'filter']) {
      const withIt = await mount(id, host);
      const without = await mount(id, withoutFamily(host));
      assert.equal(withIt.getHydrated(), without.getHydrated(), `${id} on ${name}`);
      withIt.destroy?.(); without.destroy?.();
    }
  }
});

/** Every value a select input of a tool declares. */
async function optionsOf(id: string, input: string): Promise<string[]> {
  const declared = (await tool(id)).manifest.inputs.find((i: { id: string }) => i.id === input) as { options?: { value: string }[] } | undefined;
  return (declared?.options ?? []).map(o => o.value);
}

test('on a one-lead design system every chart palette and gradient mode, in both looks, renders as a shell without the family', async () => {
  const cases: [string, Rec][] = [
    ...(await optionsOf('chart', 'palette')).map((palette): [string, Rec] => ['chart', { palette }]),
    ...(await optionsOf('gradient', 'mode')).map((mode): [string, Rec] => ['gradient', { mode }]),
  ];
  assert.ok(cases.length >= 12, 'the chart palettes and gradient modes were read from the manifests');
  for (const [name, make] of Object.entries(ONE_LEAD)) {
    for (const look of ['light', 'dark']) {
      const selection = { '': look };
      const host = await cli(make(), selection);
      for (const [id, initial] of cases) {
        const withIt = await mount(id, host, initial, selection);
        const without = await mount(id, withoutFamily(host), initial, selection);
        assert.equal(withIt.getHydrated(), without.getHydrated(), `${id} ${JSON.stringify(initial)} on ${name} in ${look}`);
        withIt.destroy?.(); without.destroy?.();
      }
    }
  }
});

test('on a one-lead design system a look switch leaves chart and gradient where a fresh render in that look is', async () => {
  // Before the family, both tools kept the colours they read at mount, so a switch
  // from light to dark left the chart's palette and the gradient's shuffle light.
  for (const [name, make] of Object.entries(ONE_LEAD)) {
    const host = await cli(make());
    for (const [id, initial] of [['chart', { palette: 'ordered' }], ['chart', { palette: 'diverging' }], ['gradient', {}]] as const) {
      const switched = await mount(id, host, initial, { '': 'light' });
      await switched.setTokenSelection({ '': 'dark' });
      const fresh = await mount(id, host, initial, { '': 'dark' });
      assert.equal(switched.getHydrated(), fresh.getHydrated(), `${id} ${JSON.stringify(initial)} on ${name}`);
      switched.destroy?.(); fresh.destroy?.();
    }
  }
});

test('chart leads with the family: the leads follow Primary and Secondary in the ordered palette', async () => {
  const host = await cli(threeLeads());
  const rt = await mount('chart', host, {}, { '': 'light', colourway: 'persimmon' });
  const { categorical, primary } = chartState(rt).spec.theme.colours;
  const main = swatch(DEMO(), 'color.semantic.primary', { theme: 'light' })!.toLowerCase();
  assert.equal(primary, PERSIMMON.light!.primary);
  assert.deepEqual(categorical.slice(0, 4), [PERSIMMON.light!.primary, PERSIMMON.light!.secondary, main, LAGOON.light!.primary]);
  // Without the family the same document charts its active colourway alone.
  const plain = await mount('chart', withoutFamily(host), {}, { '': 'light', colourway: 'persimmon' });
  assert.ok(!chartState(plain).spec.theme.colours.categorical.slice(0, 4).includes(LAGOON.light!.primary));
  rt.destroy?.(); plain.destroy?.();
});

test('chart re-reads the design system after a colourway switch, without onInit and without touching inputs', async () => {
  const host = await cli(threeLeads());
  let colorReads = 0;
  const tokens = host.tokens as NonNullable<HostV1['tokens']>;
  const counted = { ...host, tokens: { ...tokens, colors: (o?: TokenResolveOptions) => { colorReads += 1; return tokens.colors(o); } } } as HostV1;
  const rt = await mount('chart', counted, { heading: 'Kept heading' }, { '': 'light', colourway: 'main' });
  const main = swatch(DEMO(), 'color.semantic.primary', { theme: 'light' })!.toLowerCase();
  assert.equal(chartState(rt).spec.theme.colours.primary, main);

  // An edit with nothing switched reads no palette again.
  const reads = colorReads;
  await rt.setInput('heading', 'Still kept');
  assert.equal(colorReads, reads, 'an ordinary edit keeps the brand it has');

  await rt.setTokenSelection({ '': 'light', colourway: 'lagoon' });
  assert.equal(chartState(rt).spec.theme.colours.primary, LAGOON.light!.primary, 'the switch reached the latched brand');
  assert.equal(chartState(rt).spec.theme.colours.categorical[0], LAGOON.light!.primary);
  assert.equal(rt.getModel().find(i => i.id === 'heading')!.value, 'Still kept', 'the user\'s input is untouched');
  rt.destroy?.();
});

const paletteOf = (rt: Awaited<ReturnType<typeof mount>>): string[] => JSON.parse(rt.getHydratedText('{{{paletteJson}}}'));

test('gradient shuffles from the family first, then the rest of the design system', async () => {
  const host = await cli(threeLeads());
  const rt = await mount('gradient', host, {}, { '': 'dark', colourway: 'lagoon' });
  const main = swatch(DEMO(), 'color.semantic.primary', { theme: 'dark' })!.toLowerCase();
  const palette = paletteOf(rt);
  assert.deepEqual(palette.slice(0, 3), [main, PERSIMMON.dark!.primary, LAGOON.dark!.primary]);
  assert.ok(palette.length > 3 && palette.length <= 32, 'the rest of the design system follows, capped as before');
  assert.equal(new Set(palette).size, palette.length, 'no colour repeats');
  rt.destroy?.();
});

test('gradient re-reads its palette after a switch, and stays synchronous where there are no tokens', async () => {
  const host = await cli(threeLeads());
  const rt = await mount('gradient', host, {}, { '': 'light', colourway: 'main' });
  const before = paletteOf(rt);
  assert.ok(!before.includes(LAGOON.dark!.primary));
  await rt.setTokenSelection({ '': 'dark', colourway: 'lagoon' });
  const after = paletteOf(rt);
  assert.notDeepEqual(after, before);
  assert.deepEqual(after.slice(0, 3), [swatch(DEMO(), 'color.semantic.primary', { theme: 'dark' })!.toLowerCase(), PERSIMMON.dark!.primary, LAGOON.dark!.primary]);
  rt.destroy?.();

  const source = await readFile(new URL('../community/gradient/hooks.js', import.meta.url), 'utf8');
  const hooks = new Function('host', `${source}; return { onInput };`)({ log: () => {} }) as { onInput: (ctx: unknown) => unknown };
  const model = (await tool('gradient')).manifest.inputs.map((i: { id: string; default?: unknown }) => ({ id: i.id, value: i.default }));
  const out = hooks.onInput({ model });
  assert.equal(typeof (out as { then?: unknown }).then, 'undefined', 'no token reads, no promise');
});

test('audiogram seeds the visualizer with the other leads after its background', async () => {
  const SR = 8000;
  const channel = new Float32Array(SR * 3).map((_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * (i / SR)));
  const vizHost = (base: HostV1): HostV1 => ({
    ...base,
    assets: { ...base.assets, get: async (id: string, o?: never) => (id === 'clip' ? { id, url: 'blob:clip', type: 'audio', format: 'wav' } : base.assets.get(id, o)) },
    audio: { isAvailable: () => true, analyse: async (_src: unknown, opts: never) => analysePcm([channel], SR, opts) },
    viz: { isAvailable: () => true, presets: async () => [{ id: 'lolly-a', name: 'A', author: 'Lolly' }] },
  } as unknown as HostV1);
  const host = await cli(threeLeads());
  const initial = { style: 'milkdrop', audio: { id: 'clip', url: 'blob:clip', type: 'audio' } };
  const rt = await mount('audiogram', vizHost(host), initial, { '': 'light', colourway: 'main' });
  const colours = rt.getHydratedText('{{agVizColors}}').split(' ');
  const accent = rt.getModel().find(i => i.id === 'accent')!.value as { value?: string } | string;
  const accentHex = (typeof accent === 'string' ? accent : accent.value)!.toLowerCase();
  assert.equal(colours[0]!.toLowerCase(), accentHex, 'the accent leads');
  // Every lead but the accent itself (here the accent is the secondary, so all three).
  const leads = [swatch(DEMO(), 'color.semantic.primary', { theme: 'light' })!.toLowerCase(), PERSIMMON.light!.primary, LAGOON.light!.primary].filter(l => l !== accentHex);
  assert.deepEqual(colours.slice(2, 2 + leads.length), leads, 'the other leads follow the background');
  const plain = await mount('audiogram', vizHost(withoutFamily(host)), initial, { '': 'light', colourway: 'main' });
  assert.ok(!plain.getHydratedText('{{agVizColors}}').includes(LAGOON.light!.primary));
  rt.destroy?.(); plain.destroy?.();
});
