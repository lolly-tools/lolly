// SPDX-License-Identifier: MPL-2.0
/**
 * Palette Lab (community/color-palette) - Contrast mode contract.
 *
 * Loads the REAL tool from disk (manifest + template + hooks) and drives it
 * through the engine with a host whose `color` bridge is the actual
 * `makeColorApi()` - the same object every shell attaches - so this guards the
 * tool's real behaviour end to end, not a fixture.
 *
 * Contrast mode's promise: every ramp step is a tone of its row's hue whose
 * FORWARD APCA Lc against the chosen background hits a per-step target. The tool
 * gets there through `host.color.solveApca` (engine 1.107). We verify the promise
 * from the outside: RE-MEASURE each emitted hex with `apcaContrast(hex, bg)` and
 * check it lands on its target - and that a target past the achievable ceiling is
 * flagged `reachable: false` (the closest colour returned, never a silent miss).
 *
 * Run with: node --test tests/color-palette-contrast.test.ts
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeColorApi, apcaContrast } from '../engine/src/color-tools.ts';
import { contrastRatio } from '../engine/src/brand-derive.ts';
import { simulateCvdHex, toGrayscaleHex } from '../engine/src/color-vision.ts';
import { baseHost } from './helpers/host.ts';

// color-palette ships in the PUBLIC community pack. Load from the SOURCE pack, not
// the gitignored tools/ profile view, so the suite is profile-independent: skip
// only when community/ isn't checked out (a clone without submodules); with it
// present, a missing tool dir means a rename/delete and must FAIL loudly.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'color-palette', 'tool.json')),
    'community/color-palette/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('color-palette', fetchFile);

// A host whose color bridge is the engine's real ColorAPI - exactly what web/CLI
// attach. `strip` removes solveApca to exercise the feature-detect fallback.
function makeHost(strip = false): any {
  const color: any = makeColorApi();
  if (strip) delete color.solveApca;
  return baseHost({ color });
}

async function mount(initialState: any, opts: { strip?: boolean } = {}) {
  const rt = await createRuntime(tool, makeHost(opts.strip), initialState);
  // tokensJson is a hook `extra`; render it raw (triple-stache bypasses escaping)
  // and parse it - it is the machine-readable record of every solved step.
  const tokens = JSON.parse(rt.getHydratedString('{{{tokensJson}}}') as string);
  return { rt, html: rt.getHydrated() as string, tokens };
}

// Every ramp token across every entry: { hex, apca:{ targetLc, achievedLc, reachable, bg } | undefined }.
function rampTokens(tokens: any): Array<{ entry: string; step: string; hex: string; apca: any }> {
  const out: Array<{ entry: string; step: string; hex: string; apca: any }> = [];
  const ramp = tokens.color?.ramp ?? {};
  for (const entry of Object.keys(ramp)) {
    for (const step of Object.keys(ramp[entry])) {
      const tok = ramp[entry][step];
      out.push({ entry, step, hex: tok.$value, apca: tok.$extensions?.['org.lolly.apca'] });
    }
  }
  return out;
}

// APCA bisection lands within ~1 Lc; allow a little slack for 8-bit hex rounding.
const LC_TOL = 2.0;

test('contrast mode: every reachable step re-measures within tolerance of its target', { skip: SKIP }, async () => {
  const bg = '#ffffff';
  const { tokens } = await mount({
    seed: '#2563eb', harmony: 'complement', steps: 6, neutrals: true,
    mode: 'contrast', bg, lcTargets: '15,45,75,90,100,108',
  });

  const cells = rampTokens(tokens);
  assert.ok(cells.length > 0, 'contrast mode produced no ramp tokens');

  let reachableChecked = 0;
  let unreachableSeen = 0;
  for (const c of cells) {
    assert.ok(c.apca, `token ${c.entry}.${c.step} carries no APCA extension in contrast mode`);
    assert.equal(c.apca.bg, bg, 'the solved-against background must be recorded on each token');

    // RE-MEASURE the emitted hex from scratch, forward APCA against the bg.
    const measured = Math.abs(apcaContrast(c.hex, bg));

    if (c.apca.reachable) {
      assert.ok(Math.abs(measured - c.apca.targetLc) <= LC_TOL,
        `${c.entry}.${c.step}: reachable but re-measured Lc ${measured.toFixed(2)} != target ${c.apca.targetLc}`);
      reachableChecked++;
    } else {
      // A capped step must fall SHORT of its target (that is why it is unreachable),
      // and the recorded achieved Lc must agree with a fresh measurement.
      assert.ok(measured < c.apca.targetLc,
        `${c.entry}.${c.step}: flagged unreachable but re-measured Lc ${measured.toFixed(2)} met target ${c.apca.targetLc}`);
      assert.ok(Math.abs(measured - c.apca.achievedLc) <= LC_TOL,
        `${c.entry}.${c.step}: recorded achieved ${c.apca.achievedLc} != re-measured ${measured.toFixed(2)}`);
      unreachableSeen++;
    }
  }

  assert.ok(reachableChecked >= 3, `expected several reachable steps, got ${reachableChecked}`);
  // The Lc-108 target is past APCA's black-on-white ceiling (~106) for every hue,
  // so at least one step per entry must be flagged unreachable.
  assert.ok(unreachableSeen >= 1, 'a target past the ceiling must produce at least one capped step');
});

test('contrast mode: the CSV carries achieved-vs-target Lc and a reachability flag', { skip: SKIP }, async () => {
  const { rt } = await mount({
    seed: '#16a34a', harmony: 'complement', steps: 4, neutrals: false,
    mode: 'contrast', bg: '#0b1220', lcTargets: '30,60,90,120',
  });
  // template.csv reads exactly these fields off each csvRows entry
  // (name,hex,on,wcag,level,apca,target,reach). Probe the same extra directly so
  // the test pins the DATA the columns render, not the delimiter mechanics.
  const probe = rt.getHydratedString('{{#each csvRows}}{{name}}|{{apca}}|{{target}}|{{reach}};{{/each}}') as string;
  const rows = probe.split(';').filter(Boolean).map(r => {
    const [name, apca, target, reach] = r.split('|');
    return { name, apca, target, reach };
  });

  // The ramp cells are exactly the rows that carry a target column; the base
  // swatch rows carry neither target nor reach (own-label legibility only).
  const cellRows = rows.filter(r => r.target !== '');
  const baseRows = rows.filter(r => r.target === '');
  assert.ok(cellRows.length > 0, 'no contrast ramp rows emitted to the CSV');
  assert.ok(cellRows.every(r => Number.isFinite(Number(r.target))),
    'every contrast ramp row must carry a numeric target Lc column');
  assert.ok(cellRows.every(r => r.reach === 'yes' || r.reach === 'no'),
    'every contrast ramp row must carry a yes/no reachability column');
  assert.ok(cellRows.some(r => r.reach === 'no'),
    'Lc 120 on a mid-dark bg must cap at least one step (reach=no)');
  assert.ok(baseRows.length > 0 && baseRows.every(r => r.reach === ''),
    'base swatch rows must not carry ramp-cell reachability');
});

test('contrast mode: the contrastCurve preset drives targets when no custom Lc is given', { skip: SKIP }, async () => {
  const bg = '#ffffff';
  const { tokens } = await mount({
    seed: '#2563eb', harmony: 'complement', steps: 6, neutrals: false,
    mode: 'contrast', bg, contrastCurve: 'even', // NO lcTargets → the preset MUST drive
  });
  const cells = rampTokens(tokens);
  assert.ok(cells.length > 0, 'contrast mode produced no ramp tokens');

  // The regression guard: an empty lcTargets must fall through to the curve, not
  // parse to [0] and zero every step.
  assert.ok(cells.every(c => c.apca && c.apca.targetLc > 0),
    'preset targets must be non-zero (empty lcTargets must not become an all-zero ramp)');

  // The 'even' preset spans Lc 15..90 across 6 steps: the distinct targets are
  // 15,30,45,60,75,90 (the same set for every entry - targets track step
  // position, not hue), so the unique sorted set must be exactly the preset.
  const targetsSeen = Array.from(new Set(cells.map(c => c.apca.targetLc))).sort((a, b) => a - b);
  assert.deepEqual(targetsSeen, [15, 30, 45, 60, 75, 90],
    `even preset targets should be 15..90, got ${targetsSeen.join(',')}`);
});

test('perceptual (default) mode never emits an APCA solve extension', { skip: SKIP }, async () => {
  const { tokens } = await mount({ seed: '#2563eb', harmony: 'triad-3', steps: 7, neutrals: true });
  const cells = rampTokens(tokens);
  assert.ok(cells.length > 0);
  assert.ok(cells.every(c => c.apca === undefined),
    'OKLab mode must stay byte-compatible: no per-step APCA extension');
});

test('contrast mode falls back to the perceptual ramp when the host cannot solve', { skip: SKIP }, async () => {
  // Same request, but host.color has no solveApca (an older shell). The tool must
  // still render a ramp - just the OKLab one - never blank, never a thrown hook.
  const { tokens, html } = await mount(
    { seed: '#2563eb', harmony: 'complement', steps: 6, neutrals: true, mode: 'contrast', bg: '#ffffff' },
    { strip: true },
  );
  const cells = rampTokens(tokens);
  assert.ok(cells.length > 0, 'fallback produced no ramp');
  assert.ok(cells.every(c => c.apca === undefined),
    'without solveApca the tool must degrade to OKLab, not fake solve metadata');
  assert.match(html, /class="pl-svg"/); // the sheet still rendered
});

// ── palette exchange: parity with the catalog Swatches download ───────────────
// The tool ships json/css/scss/gpl/ase, driven by the flat paletteSwatches extra
// through host.color.paletteExport / paletteExportBytes (engine 1.108). A
// wrapping export.render (like the CLI bridge) lets us read the engine-hydrated
// bytes; the binary .ase rides the exportStill hook and skips render entirely.

function exportHost(): any {
  const host: any = makeHost();
  host.export = {
    render: async (_n: unknown, _f: string, opts: any) =>
      new Blob([opts.dataText ?? '<no-data>'], { type: opts.dataMime ?? 'text/plain' }),
  };
  return host;
}

async function mountExport(initialState: any) {
  const rt = await createRuntime(tool, exportHost(), initialState);
  return rt;
}

// Walk a dotted key ('color.ramp.seed.100') into the parsed tokens tree, return
// the leaf's $value or undefined.
function tokenValueAt(tokens: any, key: string): string | undefined {
  let node = tokens;
  for (const seg of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[seg];
  }
  return node && typeof node === 'object' ? node.$value : undefined;
}

test('palette exchange: paletteSwatches keys + hexes mirror the tokens tree exactly', { skip: SKIP }, async () => {
  const rt = await mountExport({ seed: '#2563eb', harmony: 'triad-3', steps: 5, neutrals: true });
  const tokens = JSON.parse(rt.getHydratedString('{{{tokensJson}}}') as string);
  // Read the flat swatch list the exchange serializers consume.
  const probe = rt.getHydratedString('{{#each paletteSwatches}}{{key}}\t{{hex}}\t{{group}}\t{{name}}\n{{/each}}') as string;
  const rows = probe.split('\n').filter(Boolean).map((l) => {
    const [key, hex, group, name] = l.split('\t');
    return { key, hex, group, name };
  });
  assert.ok(rows.length >= 4, 'expected base swatches + ramp cells');

  for (const r of rows) {
    assert.match(r.key!, /^color\.(ramp\.[a-z0-9-]+\.\d+|[a-z0-9-]+)$/, `unexpected key shape ${r.key}`);
    assert.equal(tokenValueAt(tokens, r.key!), r.hex,
      `${r.key}: paletteSwatches hex ${r.hex} must equal the tokens tree $value`);
  }
  // Base rows are grouped 'Palette'; ramp cells are '<name> ramp'.
  assert.ok(rows.some(r => r.group === 'Palette'), 'a base swatch must be grouped Palette');
  assert.ok(rows.some(r => r.group!.endsWith(' ramp')), 'ramp cells must be grouped "<name> ramp"');
});

test('palette exchange: json export is the DTCG tokens document (template.json)', { skip: SKIP }, async () => {
  const rt = await mountExport({ seed: '#16a34a', harmony: 'complement', steps: 4, neutrals: false });
  const blob = await rt.export({}, 'json', { embedMeta: false });
  assert.equal(blob.type, 'application/json');
  const doc = JSON.parse(await blob.text());
  // The tool's own rich DTCG fragment, not the built-in {tool,version,inputs} dump.
  assert.equal(doc.color?.$type, 'color');
  assert.ok(doc.color?.seed?.$value, 'the seed colour must be a DTCG leaf');
  assert.equal(doc.tool, undefined, 'json must be the tokens document, not the model dump');
});

test('palette exchange: css / scss / gpl carry the resolved palette', { skip: SKIP }, async () => {
  const rt = await mountExport({ seed: '#2563eb', harmony: 'triad-3', steps: 5, neutrals: true });

  const css = await rt.export({}, 'css', { embedMeta: false });
  assert.equal(css.type, 'text/css');
  const cssText = await css.text();
  assert.match(cssText, /^:root \{/, 'default cssStyle is custom properties');
  assert.match(cssText, /--color-seed: #[0-9a-f]{6};/);

  const scss = await rt.export({}, 'scss', { embedMeta: false });
  assert.equal(scss.type, 'text/x-scss');
  assert.match(await scss.text(), /\$color-seed: #[0-9a-f]{6};/);

  const gpl = await rt.export({}, 'gpl', { embedMeta: false });
  assert.equal(gpl.type, 'text/plain');
  const gplText = await gpl.text();
  assert.match(gplText, /^GIMP Palette\nName: Palette Lab\n/);
  assert.match(gplText, /\d+ +\d+ +\d+\tPalette Seed/, 'a space-padded RGB row for the seed');
});

test('palette exchange: cssStyle=classes switches the CSS export to utility classes', { skip: SKIP }, async () => {
  const rt = await mountExport({ seed: '#7c3aed', harmony: 'complement', steps: 4, neutrals: false, cssStyle: 'classes' });
  const cssText = await (await rt.export({}, 'css', { embedMeta: false })).text();
  assert.match(cssText, /\.bg-color-seed \{ background-color: #[0-9a-f]{6}; \}/);
  assert.match(cssText, /\.text-color-seed \{ color: #[0-9a-f]{6}; \}/);
  assert.ok(!cssText.startsWith(':root'), 'classes mode must not emit a :root block');
});

test('palette exchange: ase export is a real ASEF file via exportStill (render skipped)', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, (() => {
    const host: any = makeHost();
    let renderCalls = 0;
    host.export = { render: async () => { renderCalls++; return new Blob(['x'], { type: 'text/plain' }); } };
    (host as any)._renderCalls = () => renderCalls;
    return host;
  })(), { seed: '#2563eb', harmony: 'triad-3', steps: 5, neutrals: true });

  const blob = await rt.export({}, 'ase', { embedMeta: false });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'ASEF', 'ASE signature');
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const blocks = dv.getUint32(8, false);
  assert.ok(blocks > 0, 'at least one colour-entry block');
  // Block count == the number of resolved swatches (base + every ramp cell).
  const probe = rt.getHydratedString('{{#each paletteSwatches}}{{hex}}\n{{/each}}') as string;
  const resolved = probe.split('\n').filter(h => /^#[0-9a-f]{6}$/i.test(h)).length;
  assert.equal(blocks, resolved, 'one ASE block per resolved swatch');
});

test('palette exchange: exportStill declines every non-ase format', { skip: SKIP }, async () => {
  // If exportStill hijacked css, the bytes would be ASEF, not CSS text.
  const rt = await mountExport({ seed: '#2563eb', harmony: 'triad-3', steps: 4, neutrals: false });
  for (const fmt of ['json', 'css', 'scss', 'gpl']) {
    const bytes = new Uint8Array(await (await rt.export({}, fmt, { embedMeta: false })).arrayBuffer());
    assert.notEqual(String.fromCharCode(...bytes.slice(0, 4)), 'ASEF', `${fmt} must not be hijacked into an ASE file`);
  }
});

test('palette exchange: an older shell (no paletteExport) degrades CSS/SCSS/GPL to empty, declines ase', { skip: SKIP }, async () => {
  const rt = await createRuntime(tool, (() => {
    const color: any = makeColorApi();
    delete color.paletteExport; delete color.paletteExportBytes; // pre-1.108 shell
    const host: any = baseHost({ color });
    host.export = { render: async (_n: unknown, _f: string, opts: any) => new Blob([opts.dataText ?? ''], { type: opts.dataMime ?? 'text/plain' }) };
    return host;
  })(), { seed: '#2563eb', harmony: 'triad-3', steps: 4, neutrals: true });

  assert.equal((await (await rt.export({}, 'css', { embedMeta: false })).text()).trim(), '',
    'without host.color.paletteExport the CSS export is empty, never a thrown hook');
  // ase declines (exportStill returns null) → falls through to the wrapping render,
  // which produced no dataText → an empty, non-ASEF blob. The point: no throw.
  const ase = new Uint8Array(await (await rt.export({}, 'ase', { embedMeta: false })).arrayBuffer());
  assert.notEqual(String.fromCharCode(...ase.slice(0, 4)), 'ASEF', 'no ASE without paletteExportBytes');
});

// ── every shipped example ─────────────────────────────────────────────────────
// The gallery offers each of these as a one-click starting point, so each one is
// a URL people actually land on. A hook that throws is only LOGGED by the runtime
// (never rethrown), so a broken example would quietly render a half-empty sheet -
// the log is the only assertion that catches it.

test('every declared example hydrates with no hook error and a painted sheet', { skip: SKIP }, async () => {
  const examples: Array<{ label: string; values: Record<string, any> }> = tool.manifest.examples ?? [];
  // The catalog validator warns past 8 looks (each is a live gallery render), so
  // the count is bounded both ways; the two 2.3.0 aids must each keep a look.
  assert.ok(examples.length > 0 && examples.length <= 8, 'examples exist and stay within the gallery cap of 8');
  assert.ok(examples.some(ex => ex.values.grid === true), 'a Contrast grid look must ship');
  assert.ok(examples.some(ex => ex.values.vision && ex.values.vision !== 'normal'), 'a colour-vision look must ship');

  for (const ex of examples) {
    const logged: string[] = [];
    const host = baseHost({
      color: makeColorApi(),
      log: (level: string, msg: string) => { if (level === 'error' || level === 'warn') logged.push(`${level}: ${msg}`); },
    });
    const rt = await createRuntime(tool, host, ex.values);
    const html = rt.getHydrated() as string;

    assert.deepEqual(logged, [], `${ex.label}: the runtime logged a hook failure`);
    assert.match(html, /class="pl-svg"/, `${ex.label}: no sheet rendered`);
    assert.doesNotMatch(html, /\{\{/, `${ex.label}: an unresolved template reference survived hydration`);
    assert.doesNotMatch(html, /fill=""/, `${ex.label}: an element was left with an empty fill`);
    // An example that sets an id the manifest no longer declares silently does
    // nothing, which is the failure mode a rename leaves behind.
    for (const id of Object.keys(ex.values)) {
      assert.ok(tool.manifest.inputs.some((i: any) => i.id === id), `${ex.label}: sets unknown input "${id}"`);
    }
  }
});

// ── review aids: colour-vision preview + the contrast grid (tool 2.3.0) ───────
// Two inputs that only change what is PAINTED. `vision` repaints every swatch,
// ramp cell and grid cell through the shared `cvd` region (the same Machado
// matrices as engine/src/color-vision.ts), leaving every label showing the real
// hex; `grid` appends a foreground-on-background matrix under the ramps. Both
// default off, so the plain sheet must be untouched by their arrival.

describe('review aids', () => {
  // The hook carries a byte-for-byte copy of the engine's matrices, so in
  // practice these agree exactly; the channel window is here so an 8-bit
  // rounding difference reads as a pass and a wrong matrix still reads as a
  // failure.
  const chans = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const near = (got: string, want: string, what: string) => {
    assert.match(got, /^#[0-9a-f]{6}$/, `${what}: not a hex colour, got "${got}"`);
    const [g, w] = [chans(got), chans(want)];
    assert.ok(g.every((v, i) => Math.abs(v - w[i]!) <= 1),
      `${what}: painted ${got}, the engine simulates ${want}`);
  };

  // One record per swatch row, with the geometry the template positions from.
  const readSwatches = (rt: any) =>
    (rt.getHydratedString(
      '{{#each swatches}}{{name}}|{{hex}}|{{paint}}|{{on}}|{{y}}|{{h}}|{{nameY}}|{{hexY}}|{{badgeY}}|{{cellLabelY}};{{/each}}',
    ) as string)
      .split(';').filter(Boolean)
      .map((r) => {
        const [name, hex, paint, on, y, h, nameY, hexY, badgeY, cellLabelY] = r.split('|');
        return { name, hex, paint, on, y, h, nameY, hexY, badgeY, cellLabelY };
      });

  const readGrid = (rt: any) =>
    (rt.getHydratedString(
      '{{#each gridCells}}{{fg}}|{{bg}}|{{fgPaint}}|{{bgPaint}}|{{ratio}}|{{level}};{{/each}}',
    ) as string)
      .split(';').filter(Boolean)
      .map((r) => {
        const [fg, bg, fgPaint, bgPaint, ratio, level] = r.split('|');
        return { fg, bg, fgPaint, bgPaint, ratio, level };
      });

  test('the default sheet keeps its swatch count and row geometry', { skip: SKIP }, async () => {
    // The whole point of shipping both aids off by default: nothing about the
    // sheet people already have may move. These are the pre-2.3.0 numbers -
    // 4 rows for the default triad (seed + 2 accents + neutral) across the full
    // 150..944 band, at the roomy 44/78/-24 text offsets.
    const { rt } = await mount({ seed: '#2563eb' });
    const rows = readSwatches(rt);
    assert.equal(rows.length, 4, 'seed + two triad accents + the neutral row');
    assert.deepEqual(rows.map((r) => [r.y, r.h, r.nameY, r.hexY, r.badgeY]), [
      ['150', '185', '194', '228', '311'],
      ['353', '185', '397', '431', '514'],
      ['556', '185', '600', '634', '717'],
      ['759', '185', '803', '837', '920'],
    ]);
    // Seven ramp cells per row, and with no simulation the paint IS the colour.
    const cellCounts = (rt.getHydratedString('{{#each swatches}}{{#each ramp}}x{{/each}};{{/each}}') as string)
      .split(';').filter(Boolean).map((s) => s.length);
    assert.deepEqual(cellCounts, [7, 7, 7, 7]);
    assert.ok(rows.every((r) => r.paint === r.hex), 'normal vision must paint the real colour');
  });

  test('a simulation repaints every swatch and ramp cell but never the labels', { skip: SKIP }, async () => {
    const seed = '#2563eb';
    for (const [vision, sim] of [
      ['deutan', (h: string) => simulateCvdHex(h, 'deutan', 1)],
      ['protan', (h: string) => simulateCvdHex(h, 'protan', 1)],
      ['tritan', (h: string) => simulateCvdHex(h, 'tritan', 1)],
      ['gray', (h: string) => toGrayscaleHex(h)],
    ] as Array<[string, (h: string) => string | null]>) {
      const { rt } = await mount({ seed, harmony: 'triad-3', steps: 5, neutrals: true, vision });
      const rows = readSwatches(rt);
      assert.equal(rows.length, 4);
      // The seed row is the known swatch: its label still reads the real hex,
      // and its fill is the engine's simulation of it.
      assert.equal(rows[0]!.hex, seed, `${vision}: the label must keep the real hex`);
      near(rows[0]!.paint!, sim(seed)!, `${vision}: the seed swatch fill`);

      // Every row and every ramp cell, not only the seed.
      for (const r of rows) near(r.paint!, sim(r.hex!)!, `${vision}: ${r.name} fill`);
      const cells = (rt.getHydratedString('{{#each swatches}}{{#each ramp}}{{hex}}|{{paint}};{{/each}}{{/each}}') as string)
        .split(';').filter(Boolean).map((c) => c.split('|'));
      assert.ok(cells.length >= 20, 'four rows of five ramp cells');
      for (const [hex, paint] of cells) near(paint!, sim(hex!)!, `${vision}: ramp cell ${hex}`);

      // The sheet says which simulation is on; the tokens document does not,
      // because a preview must not rewrite the exported palette.
      const { tokens } = await mount({ seed, harmony: 'triad-3', steps: 5, neutrals: true, vision });
      assert.match(rt.getHydratedString('{{subtitle}}') as string, /preview/);
      assert.doesNotMatch(String(tokens.$description), /preview/,
        'a repaint must not leak into the DTCG description');
      assert.equal(tokens.color.seed.$value, seed, 'the tokens carry the real palette, never the simulation');
    }
  });

  test('the grid is a square matrix whose ratios re-measure to the engine', { skip: SKIP }, async () => {
    const { rt } = await mount({ seed: '#2563eb', harmony: 'triad-3', steps: 6, neutrals: true, grid: true });
    const cells = readGrid(rt);
    // Seed + two triad accents + neutral mid, plus the sheet's own paper and
    // ink: six colours, so thirty-six cells.
    const n = Math.round(Math.sqrt(cells.length));
    assert.equal(n * n, cells.length, `the grid must be square, got ${cells.length} cells`);
    assert.equal(n, 6, 'four base colours plus paper and ink');

    const fgs = Array.from(new Set(cells.map((c) => c.fg)));
    const bgs = Array.from(new Set(cells.map((c) => c.bg)));
    assert.deepEqual(fgs, bgs, 'rows and columns are the same colours, in the same order');

    for (const [i, c] of cells.entries()) {
      assert.equal(c.fg, fgs[Math.floor(i / n)], 'cells run row by row');
      assert.equal(c.bg, bgs[i % n], 'columns cycle within a row');
      // RE-MEASURE from scratch: the cell's number must be the engine's.
      assert.equal(c.ratio, contrastRatio(c.fg!, c.bg!).toFixed(2),
        `${c.fg} on ${c.bg}: the cell's ratio must equal the engine's`);
      // The level word follows the sheet's own bars, so a cell never leans on
      // colour to say whether it passed.
      const r = Number(c.ratio);
      const want = r >= 7 ? 'AAA' : r >= 4.5 ? 'AA' : r >= 3 ? 'AA18' : 'Low';
      assert.equal(c.level, want, `${c.fg} on ${c.bg}: level must follow the ratio`);
      // With no simulation the cell paints the real pair.
      assert.equal(c.fgPaint, c.fg);
      assert.equal(c.bgPaint, c.bg);
    }
    // A colour on itself is 1:1, and paper against ink is the readable extreme -
    // a grid that could only ever say Low would be telling nobody anything.
    assert.ok(cells.some((c) => c.ratio === '1.00'), 'the diagonal is a colour on itself');
    assert.ok(cells.some((c) => c.level === 'AAA'), 'paper and ink must clear AAA against each other');

    // The CSV gains a second block of the same rows.
    const csv = (rt.getHydratedString('{{#each gridCsvRows}}{{fg}},{{bg}},{{ratio}},{{level}};{{/each}}') as string)
      .split(';').filter(Boolean);
    assert.equal(csv.length, cells.length);
    assert.equal(csv[0], `${cells[0]!.fg},${cells[0]!.bg},${cells[0]!.ratio},${cells[0]!.level}`);
  });

  test('the grid is absent by default and the ramps keep the full sheet', { skip: SKIP }, async () => {
    const { rt, html } = await mount({ seed: '#2563eb', harmony: 'triad-3', steps: 6, neutrals: true });
    assert.equal(readGrid(rt).length, 0, 'grid=false must emit no cells');
    assert.equal(rt.getHydratedString('{{gridOn}}'), 'false');
    assert.equal(rt.getHydratedString('{{#each gridCsvRows}}x{{/each}}'), '',
      'the CSV must not grow a second block when the grid is off');
    assert.doesNotMatch(html, /Contrast grid/, 'no grid heading is drawn');

    // Turning it on moves the ramp rows up inside the same fixed viewBox rather
    // than growing the page: the last row must end well above the grid band.
    const on = await mount({ seed: '#2563eb', harmony: 'triad-3', steps: 6, neutrals: true, grid: true });
    const last = readSwatches(on.rt).at(-1)!;
    assert.ok(Number(last.y) + Number(last.h) <= 620,
      `the ramp block must clear the grid band, ended at ${Number(last.y) + Number(last.h)}`);
    assert.match(on.html, /viewBox="0 0 1600 1000"/, 'the sheet keeps its fixed size');
    assert.doesNotMatch(on.html, /\{\{/, 'the grid markup left no unresolved reference');
    assert.doesNotMatch(on.html, /fill=""/, 'no grid element may be left with an empty fill');
  });

  test('a simulation repaints the grid without moving its numbers', { skip: SKIP }, async () => {
    const plain = readGrid((await mount({ seed: '#16a34a', harmony: 'complement', steps: 5, neutrals: true, grid: true })).rt);
    const seen = readGrid((await mount({ seed: '#16a34a', harmony: 'complement', steps: 5, neutrals: true, grid: true, vision: 'protan' })).rt);
    assert.equal(seen.length, plain.length);
    for (const [i, c] of seen.entries()) {
      assert.equal(c.ratio, plain[i]!.ratio, 'the reported ratio describes the real palette');
      assert.equal(c.fg, plain[i]!.fg, 'the recorded colour is the real one');
      near(c.fgPaint!, simulateCvdHex(c.fg!, 'protan', 1)!, `grid cell ${c.fg} ink`);
      near(c.bgPaint!, simulateCvdHex(c.bg!, 'protan', 1)!, `grid cell ${c.bg} ground`);
    }
  });

  test('the three row lines stay apart at every row height the grid can produce', { skip: SKIP }, async () => {
    // The grid takes the bottom third of the fixed viewBox, so the ramp rows are
    // squeezed and the row's name/hex/badge lines close up. The switch to the
    // close-up offsets used to sit at 102px of row, but the roomy offsets only
    // clear at 126 - so a four-row grid (the shipped "Contrast grid" example)
    // put the 15px badge 2px under the 19px hex baseline, printing one line on
    // top of the other. Every harmony, with and without neutrals.
    for (const grid of [false, true]) {
      for (const harmony of ['complement', 'adjacent-3', 'triad-3', 'tetrad-4', 'free-4']) {
        for (const neutrals of [true, false]) {
          const where = `${harmony}/neutrals=${neutrals}/grid=${grid}`;
          const { rt } = await mount({ seed: '#2563eb', harmony, neutrals, grid, steps: 7 });
          const rows = readSwatches(rt);
          assert.ok(rows.length >= 2, `${where}: no rows`);
          for (const r of rows) {
            const [y, h, nameY, hexY, badgeY] = [r.y, r.h, r.nameY, r.hexY, r.badgeY].map(Number);
            // A 19px hex line drops about 5px of descender; a 15px badge rises
            // about 11px of cap. 16px apart is touching, so 18 is the bar.
            assert.ok(badgeY! - hexY! >= 18,
              `${where}: the badge sits ${(badgeY! - hexY!).toFixed(1)}px under the hex line`);
            assert.ok(hexY! - nameY! >= 18, `${where}: the hex line sits on the name line`);
            assert.ok(badgeY! <= y! + h!, `${where}: the badge fell outside its row`);
          }
          if (grid) {
            const last = rows.at(-1)!;
            assert.ok(Number(last.y) + Number(last.h) <= 620,
              `${where}: the ramp block runs into the grid band`);
          }
        }
      }
    }
  });

  test('an unknown vision value falls back to the real sheet instead of a blank fill', { skip: SKIP }, async () => {
    // `vision` arrives as a URL param, so junk must degrade, never paint ''.
    const { rt, html } = await mount({ seed: '#2563eb', vision: 'nonsense' });
    assert.ok(readSwatches(rt).every((r) => r.paint === r.hex));
    assert.doesNotMatch(rt.getHydratedString('{{subtitle}}') as string, /preview/);
    assert.doesNotMatch(html, /fill=""/);
  });
});
