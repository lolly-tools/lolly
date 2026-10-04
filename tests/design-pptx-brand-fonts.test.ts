// SPDX-License-Identifier: MPL-2.0
/**
 * The theme fonts a master-bound (Tier A) Design deck exports with.
 *
 * Both shells lower a Design document with slide-master bindings through
 * design-pptx.ts `designFramesToPptx`, which writes theme fonts only when the caller
 * passes them. Rebrand compile always did; the web download and `lolly design
 * --export=pptx` did not, so a run whose font is a slot keyword (or absent) opened in
 * the engine's default Calibri. These cases pin the brand family into the theme XML on
 * both shells, and pin that a generic-only stack still writes no face at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import { unzipSync, strFromU8 } from 'fflate';

process.env.LOLLY_PROFILE = 'lolly-start';

import { seedFrame } from '../engine/src/slide-master.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { tokenBrandFonts } from '../packages/node-shell/src/pptx-deck.ts';
import { readProfileTokenDocument } from '../packages/node-shell/src/design-brief.ts';
import type { SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/index.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const START_MASTERS = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'slides', 'masters.json');

/** The starter master and one master-bound Design document seeded from that master. */
function boundDoc(): { master: SlideMasterV1; masters: string; json: string } {
  const masters = readFileSync(START_MASTERS, 'utf8');
  const master = (JSON.parse(masters) as SlideMasterFileV1).masters[0]!;
  const seeded = seedFrame(master, 'content', { frameId: 'f0', x: 0, y: 0 });
  assert.ok(seeded, 'the starter master seeds a content frame');
  seeded!.frame.order = 0;
  for (const layer of seeded!.layers) {
    if (layer.role === 'title' && layer.kind === 'text') layer.text = 'Quarterly review';
  }
  // One free layer naming the sans slot and one naming no font: the runs that used to
  // get no typeface at all.
  const free = [
    { id: 'free-sans', kind: 'text', frame: 'f0', x: 40, y: 600, w: 600, h: 40, text: 'A sans note', font: 'sans', order: 90 },
    { id: 'free-none', kind: 'text', frame: 'f0', x: 40, y: 650, w: 600, h: 40, text: 'A plain note', order: 91 },
    { id: 'free-mono', kind: 'text', frame: 'f0', x: 40, y: 500, w: 600, h: 40, text: 'A mono note', font: 'mono', order: 92 },
  ];
  return { master, masters, json: JSON.stringify({ boxes: [seeded!.frame, ...seeded!.layers, ...free] }) };
}

/** The major and minor latin faces of a package's theme. */
function themeFaces(zip: Uint8Array): { major: string; minor: string } {
  const files = unzipSync(zip);
  const xml = strFromU8(files['ppt/theme/theme1.xml']!);
  const major = /<a:majorFont><a:latin typeface="([^"]*)"/.exec(xml)?.[1] ?? '';
  const minor = /<a:minorFont><a:latin typeface="([^"]*)"/.exec(xml)?.[1] ?? '';
  return { major, minor };
}

// ── the shared rule ───────────────────────────────────────────────────────────

test('tokenBrandFonts: display heads the major font, brand fills the rest, generics give none', async () => {
  const of = (tokens: Record<string, unknown>) => tokenBrandFonts((slot) => tokens[slot]);
  assert.deepEqual(await of({ brand: 'Inter' }), { major: 'Inter', minor: 'Inter' });
  assert.deepEqual(await of({ brand: ['Inter', 'sans-serif'], display: "'Fraunces', serif" }), { major: 'Fraunces', minor: 'Inter' });
  assert.equal(await of({ brand: ['system-ui', 'sans-serif'] }), undefined, 'a generic family is never a PowerPoint face');
  assert.equal(await of({ brand: '{font.missing}' }), undefined, 'alias residue is a missing token');
  assert.equal(await of({ display: 'Fraunces' }), undefined, 'a display face with no brand face is not a theme on its own');
  assert.equal(await tokenBrandFonts(() => { throw new Error('no tokens'); }), undefined, 'a resolver that throws counts as absent');
});

// ── the CLI shell ─────────────────────────────────────────────────────────────

async function cliDeck(brandFont?: (slot: 'brand' | 'display' | 'mono') => unknown): Promise<Uint8Array> {
  const { renderDesignPptx } = await import('../shells/cli/src/raster.ts');
  const { json } = boundDoc();
  const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>');
  const canvas = dom.window.document.getElementById('c')!;
  const script = dom.window.document.createElement('script');
  script.setAttribute('type', 'application/json');
  script.setAttribute('data-penpot-doc', '');
  script.textContent = json;
  canvas.appendChild(script);
  const bytes = await renderDesignPptx({
    canvas: canvas as unknown as Element, toolId: 'design',
    brandVar: () => '',
    ...(brandFont ? { brandFont } : {}),
    now: '2026-10-02T00:00:00.000Z',
  });
  assert.ok(bytes, 'a master-bound document takes Tier A');
  return bytes!;
}

test('CLI Tier A: the theme carries the brand family from the token document', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const tokens: Record<string, unknown> = { brand: ['Inter', 'sans-serif'], display: ['Fraunces', 'serif'] };
  const zip = await cliDeck((slot) => tokens[slot]);
  assert.deepEqual(themeFaces(zip), { major: 'Fraunces', minor: 'Inter' });
  const slide = strFromU8(unzipSync(zip)['ppt/slides/slide1.xml']!);
  assert.doesNotMatch(slide, /typeface="Calibri"/, 'no run names Calibri');
});

test('CLI Tier A: a generic-only brand stack keeps the theme it had', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const generic = await cliDeck((slot) => (slot === 'brand' ? ['ui-sans-serif', 'system-ui', 'sans-serif'] : undefined));
  const none = await cliDeck();
  assert.deepEqual(themeFaces(generic), { major: 'Calibri', minor: 'Calibri' });
  assert.deepEqual(themeFaces(generic), themeFaces(none), 'the same theme as a caller that passes no fonts');
});

test('CLI Tier A under lolly-start: font.brand is "SUSE", not generic, so the theme becomes SUSE', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const doc = readProfileTokenDocument({ profile: 'lolly-start' });
  assert.ok(doc, 'the lolly-start token document reads');
  const set = createTokenSet(doc!.doc);
  assert.equal(set.resolve('{font.brand}'), 'SUSE', 'the starter brand gives a real face');
  assert.equal(set.resolve('{font.display}'), undefined, 'and no display face');
  const zip = await cliDeck((slot) => set.resolve(`{font.${slot}}`));
  assert.deepEqual(themeFaces(zip), { major: 'SUSE', minor: 'SUSE' });
});

// ── the web shell ─────────────────────────────────────────────────────────────

async function webDeck(fontVars: Record<string, string>): Promise<Uint8Array> {
  const { master, masters } = boundDoc();
  const { json } = boundDoc();
  const { setExportHost } = await import('../shells/web/src/bridge/export-shared.ts');
  const { renderPptx } = await import('../shells/web/src/bridge/export-pptx.ts');
  const dom = new JSDOM('<!doctype html><html><body><div id="tool-canvas"></div></body></html>');
  const g = globalThis as { window?: unknown; document?: unknown };
  const before = { window: g.window, document: g.document };
  g.window = dom.window;
  g.document = dom.window.document;
  try {
    const node = dom.window.document.getElementById('tool-canvas')!;
    for (const [name, value] of Object.entries(fontVars)) node.style.setProperty(name, value);
    const script = dom.window.document.createElement('script');
    script.setAttribute('type', 'application/json');
    script.setAttribute('data-penpot-doc', '');
    script.textContent = json;
    node.appendChild(script);
    const bytes = new TextEncoder().encode(masters);
    setExportHost({
      assets: {
        query: async () => ['lolly/slides/masters'],
        bytes: async () => bytes,
      },
      log: () => {},
    } as never);
    assert.ok(master.id, 'the starter master has an id');
    const blob = await renderPptx(node as unknown as Element, {} as never);
    return new Uint8Array(await blob.arrayBuffer());
  } finally {
    g.window = before.window;
    g.document = before.document;
    setExportHost(undefined as never);
  }
}

test('web Tier A: the theme carries the canvas brand family, display as the major font', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const zip = await webDeck({ '--font-brand': "'Inter', ui-sans-serif, sans-serif", '--font-display': "'Fraunces', serif" });
  assert.deepEqual(themeFaces(zip), { major: 'Fraunces', minor: 'Inter' });
  assert.deepEqual(themeFaces(await webDeck({ '--font-brand': "'Inter', sans-serif" })), { major: 'Inter', minor: 'Inter' });
});

test('web Tier A: a generic-only brand stack keeps the theme it had', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  assert.deepEqual(themeFaces(await webDeck({ '--font-brand': 'ui-sans-serif, system-ui, sans-serif' })), { major: 'Calibri', minor: 'Calibri' });
  assert.deepEqual(themeFaces(await webDeck({})), { major: 'Calibri', minor: 'Calibri' }, 'no brand var is no theme font');
});

// ── the mono face, and a release's render alias ──────────────────────────────

/** The latin typeface of the run whose text is `text`, or '' for a run that states none. */
function runFace(zip: Uint8Array, text: string): string {
  const slide = strFromU8(unzipSync(zip)['ppt/slides/slide1.xml']!);
  const at = slide.indexOf(`<a:t>${text}</a:t>`);
  assert.ok(at > 0, `the slide carries a run "${text}"`);
  return /<a:latin typeface="([^"]*)"/.exec(slide.slice(slide.lastIndexOf('<a:r>', at), at))?.[1] ?? '';
}

const RELEASE_ALIAS = `Lolly Release ${'5d'.repeat(32)}`;

test('tokenBrandFonts: font.mono is returned for mono runs, and only a plain family name is a face', async () => {
  const of = (tokens: Record<string, unknown>) => tokenBrandFonts((slot) => tokens[slot]);
  assert.deepEqual(await of({ brand: 'SUSE', mono: ['SUSE Mono', 'monospace'] }), { major: 'SUSE', minor: 'SUSE', mono: 'SUSE Mono' });
  assert.deepEqual(await of({ mono: 'SUSE Mono' }), { mono: 'SUSE Mono' }, 'a mono face with no brand face is still the mono face');
  assert.equal(await of({ mono: ['ui-monospace', 'monospace'] }), undefined, 'a generic mono stack gives none');
  assert.equal(await of({ brand: RELEASE_ALIAS }), undefined, 'the release render alias is never a PowerPoint face');
  assert.deepEqual(await of({ brand: [RELEASE_ALIAS, 'Inter'] }), { major: 'Inter', minor: 'Inter' }, 'the next plain name stands in');
  assert.equal(await of({ brand: "x'; y" }), undefined, 'a name with punctuation is not a family');
});

for (const profile of ['lolly-start', 'suse'] as const) {
  test(`CLI Tier A under ${profile}: a mono-slot run names font.mono, never the sans face`, async (t) => {
    if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
    const doc = readProfileTokenDocument({ profile });
    if (!doc) { t.skip(`brands/${profile} is not checked out`); return; }
    const set = createTokenSet(doc.doc);
    assert.equal(set.resolve('{font.mono}'), 'SUSE Mono', `${profile} names SUSE Mono as its mono face`);
    const zip = await cliDeck((slot) => set.resolve(`{font.${slot}}`));
    assert.equal(runFace(zip, 'A mono note'), 'SUSE Mono');
    assert.equal(runFace(zip, 'A sans note'), 'SUSE');
    assert.doesNotMatch(strFromU8(unzipSync(zip)['ppt/theme/theme1.xml']!), /SUSE Mono/, 'the mono face never reaches the theme');
  });
}

test('CLI Tier A: with no mono face, a mono run falls back to the minor font', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const zip = await cliDeck((slot) => (slot === 'brand' ? 'Inter' : undefined));
  assert.equal(runFace(zip, 'A mono note'), 'Inter');
});

test('CLI Tier A under a pinned-font version: the deck carries the authored family, not the render alias', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const { authoredBrandFont } = await import('../shells/cli/src/raster.ts');
  const { applyPinnedFontFamilies, restorePinnedFontFamilies } = await import('../engine/src/token-font-pins.ts');
  const pins = [{ id: 'lolly/fonts/suse', version: '1', sha256: 'b'.repeat(64), font: { family: 'SUSE', weight: '100 900', style: 'normal' } }];
  const authored = readProfileTokenDocument({ profile: 'lolly-start' })!.doc;
  // What the CLI bridge serves under such a version: resolve() answers the render
  // projection, snapshot() the authored document.
  const projected = await applyPinnedFontFamilies(authored, pins);
  const render = createTokenSet(projected);
  assert.match(String(render.resolve('{font.brand}')), /^Lolly Release [0-9a-f]{64}$/, 'the projection carries the alias');
  const tokens = {
    resolve: (ref: string) => render.resolve(ref),
    snapshot: async () => ({ document: await restorePinnedFontFamilies(projected, pins) }),
  };
  const zip = await cliDeck(await authoredBrandFont(tokens));
  assert.deepEqual(themeFaces(zip), { major: 'SUSE', minor: 'SUSE' });
  assert.equal(runFace(zip, 'A sans note'), 'SUSE');
  for (const [path, bytes] of Object.entries(unzipSync(zip))) assert.doesNotMatch(strFromU8(bytes), /Lolly Release/, `${path} never names the alias`);

  // The backstop: a caller that still hands over the projection writes no alias either.
  const raw = await cliDeck((slot) => render.resolve(`{font.${slot}}`));
  assert.deepEqual(themeFaces(raw), { major: 'Calibri', minor: 'Calibri' });
  for (const [path, bytes] of Object.entries(unzipSync(raw))) assert.doesNotMatch(strFromU8(bytes), /Lolly Release/, `${path} never names the alias`);
});

test('web Tier A: a mono-slot run names the canvas --font-mono face, never in the theme', async (t) => {
  if (!existsSync(START_MASTERS)) { t.skip('brands/lolly-start is not checked out'); return; }
  const zip = await webDeck({ '--font-brand': "'Inter', sans-serif", '--font-mono': "'SUSE Mono', ui-monospace, monospace" });
  assert.equal(runFace(zip, 'A mono note'), 'SUSE Mono');
  assert.equal(runFace(zip, 'A sans note'), 'Inter');
  assert.deepEqual(themeFaces(zip), { major: 'Inter', minor: 'Inter' });
  assert.equal(runFace(await webDeck({ '--font-brand': "'Inter', sans-serif" }), 'A mono note'), 'Inter', 'no mono face falls back to minor');
});
