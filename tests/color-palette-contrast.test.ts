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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { makeColorApi, apcaContrast } from '../engine/src/color-tools.ts';
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
    'community/color-palette/tool.json is missing — pack is mounted, so the tool was renamed or deleted');
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
