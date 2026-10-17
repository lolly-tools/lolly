// SPDX-License-Identifier: MPL-2.0
/**
 * A tool that ignores the colourway, rendered for real through `lolly run` and the
 * MCP `render()` (plans/319 A4, manifest `tokenAxes`).
 *
 * tests/tool-token-axes.test.ts pins the runtime's decision and
 * tests/cli-token-axes.test.ts the CLI warning's wording. This file pins the
 * wiring around both: a run asked for a colourway the tool ignores
 *   - says so (THEME_CHOICE_IGNORED on the CLI, a render note on MCP), and
 *   - draws in the canonical colourway in EVERY token read of the run, not only
 *     the canvas: the eps-cmyk palette is built by the bridge itself, after the
 *     runtime has mounted, so a bridge left on the link's `_themes` loses the
 *     canonical lead's authored CMYK and converts it generically.
 * A tool that follows the colourway still draws the one asked for, and is told
 * nothing. The browser tier's notes come from the server's own reading of the
 * design system (its runtime lives in the web shell), so that reading is pinned
 * against the same fixture.
 *
 * Hermetic, in the style of tests/cli-ga-contract.test.ts: a fixture content root
 * through LOLLY_ROOT, the design system as the active terminal system in a
 * temporary LOLLY_STATE_DIR, both set before the first import, and LOLLY_WEB_DIST
 * pointed at nothing so no browser tier is ever reached.
 *
 * Run with: node --test tests/token-axes-run.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addColourway, liftToColourways } from '../engine/src/colourway.ts';

type Rec = Record<string, unknown>;

const root = await mkdtemp(join(tmpdir(), 'lolly-token-axes-run-'));
after(() => rm(root, { recursive: true, force: true }));

/** The canonical lead, with the CMYK build the design system authored for print. */
const MAIN_LEAD = '#0c6b58';
const MAIN_CMYK = '0.11 0.22 0.33 0.44 setcmykcolor';
const PERSIMMON_LEAD = '#c2410c';

/** Lolly Start lifted to two colourways, the canonical one carrying an authored CMYK. */
function colourwayDoc(): Rec {
  const start = JSON.parse(readFileSync(new URL('../brands/lolly-start/catalog/assets/lolly/tokens/brand.json', import.meta.url), 'utf8')) as Rec;
  const lifted = liftToColourways(start, { id: 'main', name: 'Main' });
  assert.ok(lifted.ok);
  const added = addColourway(lifted.doc, { id: 'persimmon', name: 'Persimmon', values: {
    light: { primary: PERSIMMON_LEAD, 'on-primary': '#ffffff', secondary: '#7c2d12' },
    dark: { primary: '#fb923c', 'on-primary': '#111111', secondary: '#fed7aa' },
  } });
  assert.ok(added.ok);
  const doc = structuredClone(added.doc) as Rec;
  const slots = ((doc['colourway/main'] as Rec).color as Rec).colourway as Rec;
  (slots.light as Rec).primary = { $value: MAIN_LEAD, $extensions: { 'com.suse.lolly': { cmyk: [11, 22, 33, 44] } } };
  return doc;
}

// The hook draws the lead it reads through the runtime's host, so the rectangle is
// whatever colourway the runtime applied; the eps-cmyk palette is the bridge's own read.
const TEMPLATE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80" width="120" height="80"><rect width="120" height="80" fill="{{lead}}"/></svg>';
const HOOKS = 'async function onInit() {\n  return { lead: await host.tokens.resolve("{color.semantic.primary}") };\n}\n';
const manifest = (id: string, name: string, extra: Rec = {}): string => JSON.stringify({
  id, name, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
  render: { width: 120, height: 80, formats: ['svg', 'eps-cmyk'] },
  hooks: { onInit: true }, inputs: [], ...extra,
});

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));
await writeFile(join(root, 'catalog', 'tools', 'index.json'), JSON.stringify({ version: '1', tools: [{ id: 'ramp-tool' }, { id: 'lead-tool' }] }));
for (const [id, json] of [
  ['ramp-tool', manifest('ramp-tool', 'Ramp', { tokenAxes: { colourway: 'ignore' } })],
  ['lead-tool', manifest('lead-tool', 'Lead')],
] as const) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  await writeFile(join(root, 'tools', id, 'tool.json'), json);
  await writeFile(join(root, 'tools', id, 'template.html'), TEMPLATE);
  await writeFile(join(root, 'tools', id, 'hooks.js'), HOOKS);
}

process.env.LOLLY_ROOT = root;
process.env.LOLLY_STATE_DIR = join(root, 'state');
process.env.LOLLY_WEB_DIST = join(root, 'no-such-dist');
delete process.env.LOLLY_WEB_BASE;
delete process.env.LOLLY_TUI_DIR;

const { createNodeDesignSystem } = await import('../packages/node-shell/src/design-systems.ts');
await createNodeDesignSystem({ label: 'Two leads', tokens: colourwayDoc() });

const { runToolCli } = await import('../shells/cli/src/run.ts');
const { configureOutput, recordedWarnings, resetOutput } = await import('../shells/cli/src/output.ts');
const { browserTierThemeNotes, render } = await import('../services/mcp/src/render.ts');

const PERSIMMON = JSON.stringify({ '': 'light', colourway: 'persimmon' });
let seq = 0;

/** One `lolly run`, quiet, returning the file it wrote and the warnings it recorded. */
async function run(toolId: string, format: 'svg' | 'eps-cmyk'): Promise<{ text: string; warnings: ReturnType<typeof recordedWarnings> }> {
  resetOutput();
  configureOutput({ quiet: true });
  const outputPath = join(root, `out-${seq++}.${format === 'svg' ? 'svg' : 'eps'}`);
  const write = process.stderr.write.bind(process.stderr);
  (process.stderr as { write: unknown }).write = () => true;
  try {
    await runToolCli({ toolId, params: { _themes: PERSIMMON, export: format }, outputPath, format, browserTier: false });
  } finally {
    (process.stderr as { write: unknown }).write = write;
  }
  return { text: await readFile(outputPath, 'utf8'), warnings: recordedWarnings() };
}

const ignored = (warnings: ReturnType<typeof recordedWarnings>) => warnings.filter((w) => w.code === 'THEME_CHOICE_IGNORED');

test('lolly run: a colourway the tool ignores is reported, and the file is drawn in the canonical lead', async () => {
  const { text, warnings } = await run('ramp-tool', 'svg');
  assert.match(text, new RegExp(`fill="${MAIN_LEAD}"`, 'i'));
  assert.deepEqual(ignored(warnings).map((w) => w.extra), [{ group: 'colourway', kind: 'colourway', requested: 'persimmon', applied: 'main' }]);
});

test('lolly run: the bridge\'s own eps-cmyk palette follows the pin, so the canonical lead keeps its authored CMYK', async () => {
  const { text, warnings } = await run('ramp-tool', 'eps-cmyk');
  assert.ok(text.includes(MAIN_CMYK), 'the lead is printed in the CMYK the design system authored, not a generic conversion');
  assert.equal(ignored(warnings).length, 1);
});

test('lolly run: a tool that follows the colourway draws the one asked for and is told nothing', async () => {
  const { text, warnings } = await run('lead-tool', 'svg');
  assert.match(text, new RegExp(`fill="${PERSIMMON_LEAD}"`, 'i'));
  assert.deepEqual(ignored(warnings), []);
});

const query = `_themes=${encodeURIComponent(PERSIMMON)}`;
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);
const notes = (warnings: readonly string[]): string[] => warnings.filter((w) => w.includes('was not applied'));

test('MCP render: the ignored colourway is a render note, and the canvas and the eps-cmyk palette are canonical', async () => {
  const svg = await render('ramp-tool', query, { format: 'svg', noBrowser: true });
  assert.equal(svg.tier.startsWith('A'), true);
  assert.match(decode(svg.bytes), new RegExp(`fill="${MAIN_LEAD}"`, 'i'));
  assert.deepEqual(notes(svg.warnings), ['Ramp ignores the colourway, so persimmon was not applied. It renders in main, the canonical option.']);

  const eps = await render('ramp-tool', query, { format: 'eps-cmyk', noBrowser: true });
  assert.ok(decode(eps.bytes).includes(MAIN_CMYK), 'the bridge the export runs in follows the pin');
  assert.equal(notes(eps.warnings).length, 1);
});

test('MCP render: a tool that follows the colourway draws the one asked for and carries no note', async () => {
  const svg = await render('lead-tool', query, { format: 'svg', noBrowser: true });
  assert.match(decode(svg.bytes), new RegExp(`fill="${PERSIMMON_LEAD}"`, 'i'));
  assert.deepEqual(notes(svg.warnings), []);
});

test('MCP browser tier: the server reads the same decision from the same design system', async () => {
  const persimmon = JSON.parse(PERSIMMON) as Record<string, string>;
  assert.deepEqual(await browserTierThemeNotes('ramp-tool', {}, persimmon), ['Ramp ignores the colourway, so persimmon was not applied. It renders in main, the canonical option.']);
  assert.deepEqual(await browserTierThemeNotes('lead-tool', {}, persimmon), [], 'a tool that follows the colourway');
  assert.deepEqual(await browserTierThemeNotes('ramp-tool', {}, undefined), [], 'a request that names no theme');
});
