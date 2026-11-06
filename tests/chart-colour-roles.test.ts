// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly Chart's opt-in colour roles (plans/352 follow-up): the **Design system - colour
 * roles first** palette, and the engine read it stands on, `host.tokens.inspect()`'s
 * `colourRoles` (engine 1.320).
 *
 * Three promises are pinned. With the palette left alone a chart renders exactly as it
 * did before the engine carried the roles, on a system with roles and on one without.
 * With the palette chosen, the series take the design system's own roles in its own
 * order, in the piece's colourway and look, and leave out the roles the chart draws
 * its ground and words in. And a system with no colour roles charts as the ordered
 * palette, so the choice never leaves a chart worse off.
 *
 * Wefthouse is an invented textile brand (tests/fixtures/colour-roles). Lolly Demo is
 * the shipped pack, which declares Lead, Partner, Paper and Ink.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { readColourRoles } from '../engine/src/colour-roles.ts';
import { inspectTokenDocument } from '../engine/src/token-inspect.ts';
import { createHookWorkerCore, type HookWorkerOut } from '../engine/src/hook-worker-core.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import type { HostV1, TokenResolveOptions } from '../engine/src/bridge/host-v1.ts';

type Rec = Record<string, unknown>;
const load = (path: string): Rec => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const WEFTHOUSE = (): Rec => load('./fixtures/colour-roles/wefthouse.tokens.json');
const DEMO = (): Rec => load('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json');
const START = (): Rec => load('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json');
const SUSE_TOKENS = new URL('../brands/suse/catalog/assets/suse/tokens/brand.json', import.meta.url);

const hex = (doc: unknown, path: string, opts: TokenResolveOptions = {}): string =>
  String(createTokenSet(doc, opts).colors().find(s => s.path === path)?.value ?? '').toLowerCase();

const window = new JSDOM('<!doctype html><html><body></body></html>').window;
const cli = (doc: Rec, tokenSelection?: Record<string, string>): Promise<HostV1> =>
  createCliBridge({ dom: window as never, profile: {}, tokensDocument: doc, ...(tokenSelection ? { tokenSelection } : {}) } as never) as Promise<HostV1>;

/** The same host as one from before engine 1.320: its inspection carries no colour roles. */
function withoutRoles(host: HostV1): HostV1 {
  const tokens = host.tokens as NonNullable<HostV1['tokens']>;
  return { ...host, tokens: { ...tokens, inspect: async (o?: TokenResolveOptions) => { const { colourRoles: _roles, ...rest } = await tokens.inspect!(o); return rest; } } } as HostV1;
}

const fetchFile = (path: string): Promise<string> => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8');
let chart: Awaited<ReturnType<typeof loadTool>> | null = null;
async function mount(host: HostV1, initial: Rec = {}, tokenSelection?: Record<string, string>) {
  chart ??= await loadTool('chart', fetchFile);
  return createRuntime(chart, host, initial as never, tokenSelection ? { tokenSelection } : {});
}
type Mounted = Awaited<ReturnType<typeof mount>>;
const categorical = (rt: Mounted): string[] => JSON.parse(rt.getHydratedText('{{{_state}}}')).spec.theme.colours.categorical;

const d3Source = readFileSync(new URL('../community/chart/lib/d3.min.js', import.meta.url), 'utf8');
/** The colours a mounted chart draws, in the order they first appear: its hydrated
 *  markup run through the template's own script and d3 in jsdom. */
async function drawnColours(rt: Mounted): Promise<string[]> {
  const dom = new JSDOM(`<!doctype html><body>${rt.getHydrated()}</body>`, { runScripts: 'outside-only', pretendToBeVisual: true } as never);
  try {
    (dom.window.HTMLCanvasElement.prototype as unknown as { getContext: unknown }).getContext = () => ({ measureText: (s: string) => ({ width: String(s).length * 7 }) });
    dom.window.eval(d3Source);
    for (const script of dom.window.document.querySelectorAll('script:not([type="application/json"])')) dom.window.eval(script.textContent || '');
    await new Promise<void>(resolve => setImmediate(resolve));
    const fills = [...dom.window.document.querySelectorAll('#d3-plot rect')].map(r => (r.getAttribute('fill') ?? '').toLowerCase());
    return [...new Set(fills.filter(f => /^#[0-9a-f]{6}$/.test(f)))];
  } finally { dom.window.close(); }
}

/** One bar per series, so the drawn colours are the series colours in order. */
const SIX = { chartType: 'bar', data: 'Quarter,A,B,C,D,E,F\nQ1,42,28,12,20,9,30\nQ2,49,35,18,22,14,31' };

/**
 * What the chart draws for these colours as its first series. The chart darkens a
 * colour too pale to read on its ground, whichever palette it came from, so the
 * comparison is a chart given the same colours by hand in Colour 1 onwards.
 */
async function drawnAsSlots(host: HostV1, colours: string[], selection: Record<string, string>): Promise<string[]> {
  const slots = Object.fromEntries(colours.map((c, i) => [`palette${i + 1}`, c]));
  const rt = await mount(host, { ...SIX, palette: 'ordered', ...slots }, selection);
  try { return (await drawnColours(rt)).slice(0, colours.length); } finally { rt.destroy?.(); }
}

// ─── The engine read ─────────────────────────────────────────────────────────

test('a token inspection carries the colour roles as readColourRoles reads them, whatever the read options', () => {
  const doc = WEFTHOUSE();
  const inspection = inspectTokenDocument(doc);
  assert.deepEqual(inspection.colourRoles, readColourRoles(doc));
  assert.deepEqual(inspection.colourRoles!.roles.filter(r => r.declared).map(r => [r.id, r.label, r.slots.join('+')]), [
    ['main', 'Main', 'primary'], ['accent', 'Accent', 'secondary'], ['supporting', 'Supporting', ''], ['tertiary', 'Tertiary', ''],
  ]);
  assert.deepEqual(inspectTokenDocument(doc, { selection: { '': 'dark', colourway: 'madder' } }).colourRoles, inspection.colourRoles, 'structure only');
  assert.equal(inspectTokenDocument(START()).colourRoles!.state, 'default', 'a system with no colour roles says so');
  assert.equal(inspectTokenDocument(null).colourRoles!.state, 'default');
});

test('the CLI host and the isolated hook worker both answer the roles in the design system\'s order', async () => {
  const host = await cli(WEFTHOUSE(), { '': 'dark', colourway: 'weld' });
  assert.deepEqual((await host.tokens!.inspect!()).colourRoles!.roles.map(r => r.id), ['main', 'accent', 'supporting', 'tertiary']);

  const sent: HookWorkerOut[] = [];
  const core = createHookWorkerCore({ post: m => sent.push(m) });
  core.handle({
    t: 'init', runId: 1, tokenDoc: DEMO(), tokenExcluded: [], seeds: {}, shell: 'test', capabilities: [],
    hostShape: { tokens: ['get', 'colors', 'resolve', 'themes'] },
    hooksSource: 'async function onInit() { var r = (await host.tokens.inspect()).colourRoles; return { words: r.roles.map(function (x) { return x.label; }).join(",") }; }',
  });
  core.handle({ t: 'invoke', runId: 1, callId: 1, name: 'onInit', ctx: {} });
  await new Promise(r => setTimeout(r, 0));
  const done = sent.find(m => m.t === 'invoke-done') as { ok: boolean; patch: Rec } | undefined;
  assert.ok(done?.ok);
  assert.equal(done.patch.words, 'Lead,Partner,Paper,Ink');
});

// ─── Nothing chosen: nothing changes ─────────────────────────────────────────

test('every palette but colour roles first hydrates exactly as on a host from before the roles were carried', async () => {
  chart ??= await loadTool('chart', fetchFile);
  const palettes = ((chart.manifest.inputs.find((i: { id: string }) => i.id === 'palette') as { options: { value: string }[] }).options).map(o => o.value).filter(v => v !== 'roles');
  assert.ok(palettes.includes('ordered') && palettes.length >= 9);
  for (const [name, make] of [['Wefthouse', WEFTHOUSE], ['Lolly Demo', DEMO], ['Lolly Start', START]] as const) {
    for (const look of ['light', 'dark']) {
      const selection = { '': look };
      const host = await cli(make(), selection);
      for (const initial of [{}, ...palettes.map(palette => ({ palette })), { renderMode: 'statistical' }]) {
        const now = await mount(host, initial, selection);
        const before = await mount(withoutRoles(host), initial, selection);
        assert.equal(now.getHydrated(), before.getHydrated(), `${name} ${look} ${JSON.stringify(initial)}`);
        now.destroy?.(); before.destroy?.();
      }
    }
  }
});

test('colour roles first on a system with none, or on an older host, charts as the ordered palette', async () => {
  for (const [name, host] of [['Lolly Start', await cli(START())], ['Wefthouse on an older host', withoutRoles(await cli(WEFTHOUSE()))]] as const) {
    const roles = await mount(host, { ...SIX, palette: 'roles' });
    const ordered = await mount(host, { ...SIX, palette: 'ordered' });
    assert.deepEqual(categorical(roles), categorical(ordered), name);
    assert.deepEqual(await drawnColours(roles), await drawnColours(ordered), name);
    roles.destroy?.(); ordered.destroy?.();
  }
});

// ─── Chosen: the roles lead ──────────────────────────────────────────────────

test('colour roles first draws the declared roles in brand order, in the piece\'s colourway and look, then the ordered palette', async () => {
  const doc = WEFTHOUSE();
  for (const selection of [{ '': 'light', colourway: 'indigo' }, { '': 'dark', colourway: 'madder' }, { '': 'light', colourway: 'weld' }]) {
    const want = ['main', 'accent', 'supporting', 'tertiary'].map(id => hex(doc, `color.semantic.${id}`, { selection }));
    assert.equal(new Set(want).size, 4, 'the fixture gives four distinct colours');
    const host = await cli(doc, selection);
    const roles = await mount(host, { ...SIX, palette: 'roles' }, selection);
    const ordered = await mount(host, { ...SIX, palette: 'ordered' }, selection);
    const drawn = await drawnColours(roles);
    assert.deepEqual(drawn.slice(0, 4), await drawnAsSlots(host, want, selection), JSON.stringify(selection));
    assert.equal(drawn.length, 6, 'six series, six colours');
    const rest = categorical(ordered).filter(c => !want.includes(c));
    assert.deepEqual(categorical(roles), [...want, ...rest].slice(0, 16), 'the roles lead and the ordered palette follows, each colour once');
    roles.destroy?.(); ordered.destroy?.();
  }
  // A colourway switch on an open chart reads the roles again.
  const host = await cli(doc, { '': 'light', colourway: 'indigo' });
  const rt = await mount(host, { ...SIX, palette: 'roles' }, { '': 'light', colourway: 'indigo' });
  await rt.setTokenSelection({ '': 'light', colourway: 'madder' });
  assert.equal(categorical(rt)[2], hex(doc, 'color.semantic.supporting', { selection: { '': 'light', colourway: 'madder' } }));
  rt.destroy?.();
});

test('Lolly Demo leads with Lead and Partner, and leaves Paper and Ink to the ground and the words', async () => {
  const doc = DEMO();
  for (const selection of [{ '': 'light' }, { '': 'dark', colourway: 'midnight' }] as Array<Record<string, string>>) {
    const host = await cli(doc, selection);
    const rt = await mount(host, { ...SIX, palette: 'roles' }, selection);
    const lead = hex(doc, 'color.semantic.primary', { selection }), partner = hex(doc, 'color.semantic.secondary', { selection });
    assert.deepEqual(categorical(rt).slice(0, 2), [lead, partner], JSON.stringify(selection));
    assert.deepEqual((await drawnColours(rt)).slice(0, 2), await drawnAsSlots(host, [lead, partner], selection), JSON.stringify(selection));
    for (const ground of ['surface', 'text']) assert.ok(!categorical(rt).slice(0, 2).includes(hex(doc, `color.semantic.${ground}`, { selection })), `${ground} is not one of the series the roles lead`);
    rt.destroy?.();
  }
});

test('SUSE leads with Primary accent, Supporting accent and Warm accent', { skip: !existsSync(SUSE_TOKENS) && 'brands/suse is not mounted on this machine' }, async () => {
  const doc = JSON.parse(readFileSync(SUSE_TOKENS, 'utf8')) as Rec;
  for (const selection of [{ '': 'light' }, { '': 'dark', colourway: 'waterhole' }] as Array<Record<string, string>>) {
    const host = await cli(doc, selection);
    const rt = await mount(host, { ...SIX, palette: 'roles' }, selection);
    const want = [...new Set(['primary', 'secondary', 'warm-accent'].map(id => hex(doc, `color.semantic.${id}`, { selection })))];
    assert.deepEqual(categorical(rt).slice(0, want.length), want, JSON.stringify(selection));
    assert.deepEqual((await drawnColours(rt)).slice(0, want.length), await drawnAsSlots(host, want, selection), JSON.stringify(selection));
    rt.destroy?.();
  }
});
