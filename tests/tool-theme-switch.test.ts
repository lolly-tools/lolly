// SPDX-License-Identifier: MPL-2.0
/**
 * A live theme or colourway switch draws what a fresh mount in that choice draws
 * (plans/319 A4).
 *
 * The tool sidebar's Design system section switches a mounted tool through
 * `runtime.setTokenSelection`. Before this suite, six community tools kept the old
 * theme until a reload: their hooks read colours from `host.tokens` once and kept
 * them, two of them wrote over their own linked accent input, and an isolated
 * tool's Worker answered `host.tokens` from the theme it was mounted in. So:
 *
 *  - the runtime: every switch reaches `onInput` once more with id `'__tokens'`,
 *    after the linked inputs re-resolve, and the patch from that run cannot write
 *    a declared input; an executor's `tokensChanged` runs before any hook does;
 *  - every community tool: a live switch gives the same `getHydrated()` as a fresh
 *    mount in the new choice, in this realm and, for the `isolate: true` tools, in
 *    the Node worker executor;
 *  - the two accents keep their design-system link through the mount;
 *  - Diagram Builder's Brand themes and the raster tools' kept colours (Filter's
 *    treatment seeds and brand palette, Darkroom's seeds) are read again.
 *
 * The tools mount through the real CLI bridge on the public Lolly Start design
 * system, plain (light and dark) and lifted to a canonical colourway plus
 * Persimmon. The clock is frozen, because Timezone draws the current time.
 *
 * Run with: node --test tests/tool-theme-switch.test.ts
 */
import { test, after, mock } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime, type Hooks, type Runtime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';
import { createNodeHookExecutor } from '../packages/node-shell/src/hook-worker.ts';
import type { HostV1 } from '../packages/core/src/host-v1.ts';

type Rec = Record<string, unknown>;
type Selection = Record<string, string>;

const COMMUNITY = new URL('../community/', import.meta.url);
const START = (): Rec => JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8'));

/** Lolly Start with a canonical colourway (`main`) and Persimmon. */
function threeLeads(): Rec {
  const lifted = liftToColourways(START(), { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: '#c2410c', 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  return added.doc;
}

const fetchCommunity = async (path: string): Promise<string> => readFileSync(new URL(path, COMMUNITY), 'utf8');
const runtimes: Runtime[] = [];
after(() => { for (const r of runtimes) { try { r.destroy?.(); } catch { /* already gone */ } } });

/** Mount a community tool through a real CLI bridge, recording every warning. */
async function mountCommunity(id: string, doc: Rec, opts: { selection?: Selection; worker?: boolean } = {}) {
  const dom = new JSDOM('<!DOCTYPE html><html><body><div id="canvas"></div></body></html>');
  const host = await createCliBridge({ dom: dom as never, tokensDocument: doc as never });
  const warnings: string[] = [];
  host.log = (level, msg) => { if (level === 'warn' || level === 'error') warnings.push(msg); };
  const tool = await loadTool(id, fetchCommunity as never);
  const runtime = await createRuntime(tool, host, {}, {
    ...(opts.selection ? { tokenSelection: opts.selection } : {}),
    ...(opts.worker ? { hookExecutor: createNodeHookExecutor({ allowInRealmFallback: false }) } : {}),
  });
  runtimes.push(runtime);
  return { runtime, warnings, tool };
}

/** A message without the hook name a runtime prefixes, so the same failure at mount
 *  and at a switch compare equal. */
const plain = (msg: string): string => msg.replace(/^(onInit|onInput) /, '');

const COMMUNITY_TOOLS = readdirSync(COMMUNITY).filter((id) => existsSync(new URL(`${id}/tool.json`, COMMUNITY))).sort();
const ISOLATED = new Set(COMMUNITY_TOOLS.filter((id) => JSON.parse(readFileSync(new URL(`${id}/tool.json`, COMMUNITY), 'utf8')).isolate === true));

/** The first point where two renders part, with some context either side. */
function firstDifference(live: string, fresh: string): string {
  let i = 0;
  while (i < live.length && live[i] === fresh[i]) i++;
  const cut = (s: string): string => s.slice(Math.max(0, i - 60), i + 60).replace(/\s+/g, ' ');
  return `\n  live : ${cut(live)}\n  fresh: ${cut(fresh)}`;
}

const SWITCHES: { name: string; doc: () => Rec; to: Selection; workerToo: boolean }[] = [
  { name: 'Lolly Start, light to dark', doc: START, to: { '': 'dark' }, workerToo: false },
  { name: 'three leads, Main in light to Persimmon in dark', doc: threeLeads, to: { '': 'dark', colourway: 'persimmon' }, workerToo: true },
];

for (const { name, doc, to, workerToo } of SWITCHES) {
  test(`every community tool draws a live switch as a fresh mount draws it (${name})`, { timeout: 300_000 }, async () => {
    mock.timers.enable({ apis: ['Date'], now: Date.UTC(2026, 9, 19, 12) });
    const stale: string[] = [];
    try {
      for (const id of COMMUNITY_TOOLS) {
        for (const worker of workerToo && ISOLATED.has(id) ? [false, true] : [false]) {
          const where = `${id}${worker ? ' (worker)' : ''}`;
          const fresh = await mountCommunity(id, doc(), { selection: to, worker });
          const live = await mountCommunity(id, doc(), { worker });
          const before = live.warnings.length;
          await live.runtime.setTokenSelection(to);
          const drawn = live.runtime.getHydrated(), expected = fresh.runtime.getHydrated();
          if (drawn !== expected) stale.push(`${where}${firstDifference(drawn, expected)}`);
          // A switch may log only what a mount in this headless host already logs
          // (Darkroom's canvas, Finish Preview's pixels); anything new is the notice failing.
          const known = new Set(fresh.warnings.map(plain));
          const fresh_ = live.warnings.slice(before).map(plain).filter((m) => !known.has(m));
          if (fresh_.length) stale.push(`${where} logged on the switch: ${fresh_.join(' | ')}`);
        }
      }
    } finally { mock.timers.reset(); }
    assert.deepEqual(stale, [], 'a live switch must draw what a fresh mount in that choice draws');
  });
}

test('Record and Wayfinding Signage keep the accent linked to the design system', async () => {
  for (const id of ['record', 'wayfinding-signage']) {
    const { runtime } = await mountCommunity(id, START());
    const accent = runtime.getModel().find((i) => i.id === 'accent')?.value as { ref?: string } | string | undefined;
    assert.equal(typeof accent === 'object' ? accent?.ref : accent, '{color.semantic.secondary}',
      `${id}: the mount must not write a fixed colour over the linked accent`);
  }
});

test('Diagram Builder reads its Brand themes again, so a theme picked after a colourway switch is the new colourway', async () => {
  const live = await mountCommunity('diagram-builder', threeLeads());
  await live.runtime.setTokenSelection({ '': 'light', colourway: 'persimmon' });
  const fresh = await mountCommunity('diagram-builder', threeLeads(), { selection: { '': 'light', colourway: 'persimmon' } });
  for (const { runtime } of [live, fresh]) await runtime.setInput('theme', 'brand-light');
  const stroke = (r: Runtime) => r.getModel().find((i) => i.id === 'nodeStroke')?.value;
  assert.equal(stroke(fresh.runtime), '#c2410c', 'the fixture: Brand light strokes in the lead');
  assert.equal(stroke(live.runtime), stroke(fresh.runtime));
  assert.equal(live.runtime.getHydrated(), fresh.runtime.getHydrated());
});

// ─── The raster tools ───────────────────────────────────────────────────────
// Filter and Darkroom render only where a bitmap can be drawn, which this headless
// host cannot do, so the pass above sees their placeholder. These count the design
// system's colour reads instead, on a host that can decode: a kept read must be
// read again after a switch, and only then.

function rasterHost(doc: Rec) {
  let reads = 0;
  const set = (opts: Rec = {}) => createTokenSet(doc, opts);
  const host = {
    version: '1', shell: 'cli', capabilities: [],
    log: () => {},
    profile: { get: async () => ({}), subscribe: () => () => {} },
    state: { save: async () => {}, load: async () => null, list: async () => [], delete: async () => {} },
    assets: { get: async (id: string) => ({ id, url: `asset:${id}` }), query: async () => [], pick: async () => null, isAvailable: async () => true },
    raster: { canRaster: () => true, decode: async () => ({ width: 8, height: 8, naturalWidth: 8, naturalHeight: 8 }) },
    tokens: {
      get: async (opts?: Rec) => set(opts),
      resolve: async (ref: string, opts?: Rec) => set(opts).resolve(ref),
      themes: async () => set().themes(),
      colors: async (opts?: Rec) => { reads++; return set(opts).colors(); },
    },
  };
  return { host: host as unknown as HostV1, reads: () => reads };
}

const RASTER_CASES: { tool: string; state: Rec; edit: [string, unknown] }[] = [
  { tool: 'filter', state: { effect: 'duotone' }, edit: ['du_treatmentAmount', 40] },
  { tool: 'filter', state: { effect: 'dither', di_palette: 'brand' }, edit: ['di_strength', 30] },
  { tool: 'darkroom', state: {}, edit: ['exposure', 0.5] },
];

for (const { tool: id, state, edit } of RASTER_CASES) {
  test(`${id}${state.effect ? ` (${state.effect})` : ''} reads the design system's colours again after a switch, and not on an edit`, async () => {
    const { host, reads } = rasterHost(START());
    const tool = await loadTool(id, fetchCommunity as never);
    const runtime = await createRuntime(tool, host, state as never);
    runtimes.push(runtime);
    const atMount = reads();
    assert.ok(atMount >= 1, 'the mount reads the colours');
    await runtime.setInput(edit[0], edit[1] as never);
    assert.equal(reads(), atMount, 'an edit answers from the colours already read');
    await runtime.setTokenSelection({ '': 'dark' });
    assert.ok(reads() > atMount, 'a switch reads them again, in the new choice');
  });
}

// ─── The runtime ────────────────────────────────────────────────────────────

let seq = 0;
function toolDouble(hooksSource: string, inputs: Rec[]): never {
  return {
    manifest: {
      id: `theme-switch-${++seq}`, name: 'Switch', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['svg'] }, inputs, hooks: { onInit: true, onInput: true },
    },
    template: '<b>{{title}}</b><i>{{note}}</i>',
    hooksSource,
  } as never;
}

function tokensHost(doc: Rec): HostV1 {
  const set = (opts: Rec = {}) => createTokenSet(doc, opts);
  return {
    version: '1', shell: 'cli', capabilities: [], log: () => {},
    profile: { get: async () => ({}), subscribe: () => () => {} },
    state: { save: async () => {}, load: async () => null, list: async () => [], delete: async () => {} },
    assets: { get: async (id: string) => ({ id, url: `asset:${id}` }), query: async () => [], pick: async () => null, isAvailable: async () => true },
    tokens: {
      get: async (opts?: Rec) => set(opts),
      resolve: async (ref: string, opts?: Rec) => set(opts).resolve(ref),
      themes: async () => set().themes(),
      colors: async (opts?: Rec) => set(opts).colors(),
      snapshot: async () => ({ document: doc, renderDocument: doc, system: null, version: 'test', selection: {} }),
    },
  } as unknown as HostV1;
}

// The in-realm hooks below record the ids they hear here, on the shared global.
const CALLS = '__themeSwitchCalls';
const recorded: string[] = [];
(globalThis as Rec)[CALLS] = recorded;
const calls = (): string[] => recorded;

test('a switch reaches onInput once as __tokens, after the linked inputs, and with no linked input at all', async () => {
  const record = `function onInit(){ return {}; } function onInput({ id }){ globalThis.${CALLS}.push(id); return {}; }`;
  const linked = await createRuntime(toolDouble(record, [
    { id: 'title', type: 'text', default: 'hi' },
    { id: 'fill', type: 'color', default: '{color.semantic.surface}' },
  ]), tokensHost(START()));
  calls().length = 0;
  await linked.setTokenSelection({ '': 'dark' });
  assert.deepEqual(calls(), ['fill', '__tokens'], 'the moved link first, then the notice');

  const unlinked = await createRuntime(toolDouble(record, [{ id: 'title', type: 'text', default: 'hi' }]), tokensHost(START()));
  calls().length = 0;
  await unlinked.setTokenSelection({ '': 'dark' });
  assert.deepEqual(calls(), ['__tokens'], 'a tool with nothing linked still hears the switch');
});

test('the __tokens patch updates computed values and never writes a declared input', async () => {
  const runtime = await createRuntime(toolDouble(`
    function onInit(){ return { note: 'mounted' }; }
    async function onInput({ id, host }){
      if (id !== '__tokens') return {};
      return { title: 'overwritten', fill: '#000000', note: await host.tokens.resolve('{color.semantic.surface}') };
    }`, [
    { id: 'title', type: 'text', default: 'hi' },
    { id: 'fill', type: 'color', default: '{color.semantic.surface}' },
  ]), tokensHost(START()));
  await runtime.setTokenSelection({ '': 'dark' });
  const dark = createTokenSet(START(), { selection: { '': 'dark' } }).resolve('{color.semantic.surface}');
  assert.match(runtime.getHydrated(), new RegExp(`<b>hi</b><i>${dark}</i>`), 'the computed note follows; the title stays');
  const fill = runtime.getModel().find((i) => i.id === 'fill')?.value as { ref?: string };
  assert.equal(fill.ref, '{color.semantic.surface}', 'the link survives the notice');
});

test('an executor that keeps its own tokens takes the new scope before any hook runs under it', async () => {
  const order: string[] = [];
  // The executor is handed the runtime's own host, whose tokens follow the runtime's scope.
  const executor = async (_tool: unknown, runtimeHost: HostV1): Promise<Hooks> => ({
    onInit: () => ({}),
    onInput: async ({ id }: { id: string }) => { order.push(`onInput:${id}`); return {}; },
    onFrame: null, onLevel: null, beforeExport: null, afterExport: null, exportFile: null, exportStill: null,
    tokensChanged: async () => {
      order.push(`tokensChanged:${await runtimeHost.tokens!.resolve('{color.semantic.surface}')}`);
    },
  } as unknown as Hooks);
  const runtime = await createRuntime(toolDouble('/* hooks run in the executor double */', [
    { id: 'title', type: 'text', default: 'hi' },
    { id: 'fill', type: 'color', default: '{color.semantic.surface}' },
  ]), tokensHost(START()), {}, { hookExecutor: executor as never });
  await runtime.setTokenSelection({ '': 'dark' });
  const dark = createTokenSet(START(), { selection: { '': 'dark' } }).resolve('{color.semantic.surface}');
  assert.deepEqual(order, [`tokensChanged:${dark}`, 'onInput:fill', 'onInput:__tokens'],
    'the executor is told first, while the host already answers in the new choice');
});

test('an isolated hook in the Node worker reads the theme a switch chose', async () => {
  const runtime = await createRuntime(toolDouble(`
    async function read(host){ return { note: await host.tokens.resolve('{color.semantic.surface}') }; }
    function onInit({ host }){ return read(host); }
    function onInput({ host }){ return read(host); }`, [{ id: 'title', type: 'text', default: 'hi' }]),
  tokensHost(START()), {}, { hookExecutor: createNodeHookExecutor({ allowInRealmFallback: false }) });
  runtimes.push(runtime);
  const surface = (selection: Selection) => createTokenSet(START(), { selection }).resolve('{color.semantic.surface}');
  assert.match(runtime.getHydrated(), new RegExp(`<i>${surface({ '': 'light' })}</i>`));
  await runtime.setTokenSelection({ '': 'dark' });
  assert.match(runtime.getHydrated(), new RegExp(`<i>${surface({ '': 'dark' })}</i>`), 'the worker answered from the mount-time theme');
  await runtime.setTokenSelection({ '': 'light' });
  assert.match(runtime.getHydrated(), new RegExp(`<i>${surface({ '': 'light' })}</i>`), 'and follows back');
});
