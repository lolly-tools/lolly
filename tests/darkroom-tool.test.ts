// SPDX-License-Identifier: MPL-2.0
/**
 * darkroom tool contract tests.
 *
 * Run with: node --test tests/darkroom-tool.test.ts
 * No test framework - node:test built-in.
 *
 * Loads the REAL tool straight from community/darkroom and
 * drives it through the engine with a stubbed host - only the host is stubbed;
 * the code under test is the shipped manifest + hooks. Guards:
 *   - headless degradation: no canvas → the placeholder note, never a throw,
 *   - .cube parsing (3D and 1D) surfaced through the LUT chip, and the
 *     friendly error chip for an unreadable file,
 *   - the .cube BAKE (pure maths, works headless - the CLI path): identity
 *     pipeline bakes an identity LUT, exposure moves the mid-grey entry the
 *     way linear-light stops must, a duotone bakes its shadow stop into the
 *     black entry, bakeSize is honoured, and the bakeLut switch resets itself,
 *   - baked output round-trips through the documented .cube grammar
 *     (red-fastest, DOMAIN 0..1, N³ rows),
 *   - the `videoLook` extra: published headless (before the raster guard, like
 *     the bake), versioned, flagged with whether the look does anything, and
 *     key-guarded so only a colour change re-publishes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseCubeLut } from '../engine/src/grade.ts';
import { baseHost } from './helpers/host.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

assert.ok(existsSync(join(TOOLS_DIR, 'darkroom', 'tool.json')),
  'community/darkroom/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('darkroom', fetchFile);

// Serve the shipped preset .cube files to the tool's own fetch() from disk, so
// the preset path runs end-to-end without an HTTP server. The id pattern is the
// tool's own whitelist shape - anything else (incl. any traversal attempt) 404s.
const LUT_DIR = join(TOOLS_DIR, 'darkroom', 'assets', 'luts');
const PRESET_IDS = ['slide-standard', 'slide-vivid', 'chrome-muted', 'mono-fine', 'suse7-slog3-heavy'];
// Authored grid size per preset: the CC0 film emulations are resampled to 33³;
// the credited SUSE7 S-Log3 (Heavy) grade ships at its native 65³ (steep log→
// display curves band at 33³, so it keeps the finer lattice).
const PRESET_SIZE: Record<string, number> = {
  'slide-standard': 33, 'slide-vivid': 33, 'chrome-muted': 33, 'mono-fine': 33,
  'suse7-slog3-heavy': 65,
};
(globalThis as any).fetch = async (url: any) => {
  const m = String(url).match(/\/tools\/darkroom\/assets\/luts\/([a-z0-9-]+)\.cube$/);
  if (!m) return { ok: false, status: 404, text: async () => '' };
  try {
    const text = await readFile(join(LUT_DIR, `${m[1]}.cube`), 'utf8');
    return { ok: true, status: 200, text: async () => text };
  } catch {
    return { ok: false, status: 404, text: async () => '' };
  }
};

const value = (rt: any, id: string) => rt.getModel().find((i: any) => i.id === id)?.value;

function lutFile(name: string, text: string) {
  const bytes = new TextEncoder().encode(text);
  return { __file: true, name, mime: 'text/plain', size: bytes.length, bytes, url: null };
}

// A host whose export.file captures every delivered blob (the .cube bake path).
function makeHost() {
  const delivered: { blob: Blob; filename?: string }[] = [];
  const host: any = baseHost();
  host.tokens = {
    colors: async () => [
      { value: '#101418', name: 'Ink',   path: 'color.ramp.neutral.1' },
      { value: '#5c7cfa', name: 'Brand', path: 'color.ramp.primary.5' },
      { value: '#f6f4ee', name: 'Paper', path: 'color.ramp.neutral.9' },
    ],
  };
  host.export = {
    file: async (blob: Blob, opts: { filename?: string } = {}) => { delivered.push({ blob, filename: opts.filename }); },
  };
  return { host, delivered };
}

// Parse a baked .cube: header keywords + N³ float triples (red-fastest).
function parseBaked(text: string) {
  const lines = text.split('\n');
  const sizeLine = lines.find(l => l.startsWith('LUT_3D_SIZE'));
  assert.ok(sizeLine, 'baked cube declares LUT_3D_SIZE');
  const size = Number(sizeLine!.split(/\s+/)[1]);
  // Any line that is exactly three finite numbers is a data row. The tool's own
  // bake writes fixed-decimals (\d+\.\d+), but a real-world .cube (e.g. a Resolve
  // export) also carries bare integers (`0`) and scientific notation (`4.5e-05`),
  // so match the engine parser's leniency rather than one formatter's output.
  const rows: [number, number, number][] = [];
  for (const l of lines) {
    const t = l.trim();
    if (!t || t[0] === '#') continue;
    const parts = t.split(/\s+/);
    if (parts.length !== 3) continue;
    const n = parts.map(Number) as [number, number, number];
    if (n.every(Number.isFinite)) rows.push(n);
  }
  return { size, rows };
}

test('manifest: a designer-grade raster tool on the ^1.12 engine', () => {
  const m = tool.manifest;
  assert.equal(m.id, 'darkroom');
  // ^1.12 floor inherited from the folded-in Layers tool (host.layers.writePsd).
  assert.equal(m.engineVersion, '^1.12.0');
  assert.equal(m.render.liveMaxEdge, 1280);
  const lut = m.inputs.find((i: any) => i.id === 'lutFile');
  assert.equal(lut.type, 'file');
  assert.ok(lut.accept.includes('.cube'));
  const bake = m.inputs.find((i: any) => i.id === 'bakeLut');
  assert.equal(bake.type, 'boolean');
  assert.equal(bake.default, false);
});

test('headless still render degrades to the placeholder note', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  const html = rt.getHydrated() as string;
  assert.match(html, /Preview renders in the browser/);
});

test('a 3D .cube surfaces its title and grid in the LUT chip', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  // A valid 2³ invert LUT (red-fastest rows).
  const cube = [
    'TITLE "Invert"',
    'LUT_3D_SIZE 2',
    '1 1 1', '0 1 1', '1 0 1', '0 0 1',
    '1 1 0', '0 1 0', '1 0 0', '0 0 0',
  ].join('\n');
  await rt.setInput('lutSource', 'custom' as any);
  await rt.setInput('lutFile', lutFile('invert.cube', cube) as any);
  const html = rt.getHydrated() as string;
  assert.match(html, /Invert · 2³/);
});

test('a 1D .cube is labelled as a 1D ramp; junk is a friendly error', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('lutSource', 'custom' as any);
  await rt.setInput('lutFile', lutFile('curve.cube', 'LUT_1D_SIZE 2\n0 0 0\n1 1 1\n') as any);
  assert.match(rt.getHydrated() as string, /2-step 1D/);

  await rt.setInput('lutFile', lutFile('junk.cube', 'not a lut at all\n') as any);
  assert.match(rt.getHydrated() as string, /LUT not readable/);
});

test('bake: the default pipeline bakes an identity LUT and resets the switch', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('bakeLut', true as any);

  assert.equal(delivered.length, 1, 'one .cube delivered');
  assert.equal(delivered[0]!.filename, 'darkroom-look-33.cube');
  const { size, rows } = parseBaked(await delivered[0]!.blob.text());
  assert.equal(size, 33);
  assert.equal(rows.length, 33 * 33 * 33);
  assert.deepEqual(rows[0], [0, 0, 0], 'black maps to black');
  assert.deepEqual(rows[rows.length - 1], [1, 1, 1], 'white maps to white');
  // Mid-grey grid point (r=g=b=16 of 0..32) is exactly 0.5 in, 0.5 out.
  const mid = rows[(16 * 33 + 16) * 33 + 16]!;
  for (const c of mid) assert.ok(Math.abs(c - 0.5) < 0.005, `identity mid-grey stays put (got ${c})`);

  assert.equal(value(rt, 'bakeLut'), false, 'the switch flips itself back off');
});

test('bake: +1 EV lifts mid-grey like a linear-light stop', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('exposure', 1 as any);
  await rt.setInput('bakeLut', true as any);

  const { rows } = parseBaked(await delivered[0]!.blob.text());
  const mid = rows[(16 * 33 + 16) * 33 + 16]!;
  // srgb 0.5 → linear ≈0.214 → ×2 → ≈0.428 → srgb ≈0.687
  for (const c of mid) assert.ok(Math.abs(c - 0.687) < 0.02, `mid-grey after +1 EV ≈ 0.687 (got ${c})`);
});

test('bake: duotone bakes the shadow stop into the black entry', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('treatment', 'duotone' as any);
  await rt.setInput('treatmentAmount', 100 as any);
  await rt.setInput('treatShadow', '#30ba78' as any);
  await rt.setInput('treatHighlight', '#ffffff' as any);
  await rt.setInput('bakeLut', true as any);

  const { rows } = parseBaked(await delivered[0]!.blob.text());
  const black = rows[0]!;
  // OKLab L of black is 0 → the duotone ramp's shadow end → the stop itself.
  assert.ok(Math.abs(black[0] - 0x30 / 255) < 0.03, `shadow R ≈ #30 (got ${black[0]})`);
  assert.ok(Math.abs(black[1] - 0xba / 255) < 0.03, `shadow G ≈ #ba (got ${black[1]})`);
  assert.ok(Math.abs(black[2] - 0x78 / 255) < 0.03, `shadow B ≈ #78 (got ${black[2]})`);
});

test('manifest: the HSL mixer declares a mode + 24 banded sliders', () => {
  const hsl = tool.manifest.inputs.filter((i: any) => i.section === 'HSL / Colour');
  const mode = hsl.find((i: any) => i.id === 'hslMode');
  assert.ok(mode && mode.type === 'select', 'a Hue/Saturation/Luminance mode select');
  assert.deepEqual(mode.options.map((o: any) => o.value), ['hue', 'saturation', 'luminance']);
  const sliders = hsl.filter((i: any) => i.display === 'slider');
  assert.equal(sliders.length, 24, '8 bands × 3 properties');
  // Every band slider is gated to exactly one mode and carries a compact urlKey.
  for (const s of sliders) {
    assert.ok(s.showIf && s.showIf.hslMode && s.showIf.hslMode.length === 1, `${s.id} gated by mode`);
    assert.equal(s.min, -100); assert.equal(s.max, 100); assert.equal(s.default, 0);
    assert.ok(/^m[hsl]\d$/.test(s.urlKey), `${s.id} has a compact urlKey (got ${s.urlKey})`);
  }
  assert.equal(new Set(sliders.map((s: any) => s.urlKey)).size, 24, 'urlKeys are unique');
});

test('bake: the HSL mixer folds into the .cube, and protects greys', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  // Fully desaturate the red band: pure red should bake out to neutral grey,
  // while a grey grid point (no hue) must stay exactly put.
  await rt.setInput('hslSatRed', -100 as any);
  await rt.setInput('bakeLut', true as any);

  const { rows } = parseBaked(await delivered[0]!.blob.text());
  const N = 33;
  const red = rows[N - 1]!;                       // corner (r=1, g=0, b=0), red-fastest
  for (const c of red) assert.ok(Math.abs(c - 0.5) < 0.02, `red desaturates to grey (got ${c})`);
  const mid = rows[(16 * N + 16) * N + 16]!;      // mid-grey grid point - no hue, untouched
  for (const c of mid) assert.ok(Math.abs(c - 0.5) < 0.005, `grey is protected from the mixer (got ${c})`);

  // A hue rotation on the red band moves the red corner off pure red.
  const rt2 = await createRuntime(tool, host, {});
  delivered.length = 0;
  await rt2.setInput('hslHueRed', 100 as any);    // +40° → toward orange
  await rt2.setInput('bakeLut', true as any);
  const red2 = parseBaked(await delivered[0]!.blob.text()).rows[N - 1]!;
  assert.ok(red2[1] > red2[2] + 0.15, `red band rotates toward orange - G lifts above B (got G=${red2[1]}, B=${red2[2]})`);
});

test('bake: a loaded LUT folds into the bake, and bakeSize is honoured', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  // Invert LUT: the baked pipeline should come out inverted end-to-end.
  const cube = [
    'LUT_3D_SIZE 2',
    '1 1 1', '0 1 1', '1 0 1', '0 0 1',
    '1 1 0', '0 1 0', '1 0 0', '0 0 0',
  ].join('\n');
  await rt.setInput('lutSource', 'custom' as any);
  await rt.setInput('lutFile', lutFile('invert.cube', cube) as any);
  await rt.setInput('bakeSize', '17' as any);
  await rt.setInput('bakeLut', true as any);

  assert.equal(delivered[0]!.filename, 'darkroom-look-17.cube');
  const { size, rows } = parseBaked(await delivered[0]!.blob.text());
  assert.equal(size, 17);
  assert.equal(rows.length, 17 * 17 * 17);
  assert.deepEqual(rows[0], [1, 1, 1], 'black inverts to white');
  assert.deepEqual(rows[rows.length - 1], [0, 0, 0], 'white inverts to black');
});

// ── open preset LUTs (CC0, shipped) ──────────────────────────────────────────

test('manifest: LUT source switch gates upload + preset library', () => {
  const m = tool.manifest;
  const src = m.inputs.find((i: any) => i.id === 'lutSource');
  assert.equal(src.type, 'select');
  assert.equal(src.default, 'none');
  assert.deepEqual(src.options.map((o: any) => o.value), ['none', 'preset', 'custom']);

  const preset = m.inputs.find((i: any) => i.id === 'lutPreset');
  assert.deepEqual(preset.showIf, { lutSource: ['preset'] });
  assert.deepEqual(preset.options.map((o: any) => o.value).sort(), [...PRESET_IDS].sort());

  const file = m.inputs.find((i: any) => i.id === 'lutFile');
  assert.deepEqual(file.showIf, { lutSource: ['custom'] }, 'upload only shows for the custom source');
  const dl = m.inputs.find((i: any) => i.id === 'downloadPresetLut');
  assert.equal(dl.type, 'boolean');
  assert.deepEqual(dl.showIf, { lutSource: ['preset'] });
});

test('every shipped preset .cube is a valid LUT at its authored size, in range', async () => {
  for (const id of PRESET_IDS) {
    const text = await readFile(join(LUT_DIR, `${id}.cube`), 'utf8');
    assert.match(text, /^TITLE "/m, `${id}: has a title`);
    const { size, rows } = parseBaked(text);
    const expected = PRESET_SIZE[id]!;
    assert.equal(size, expected, `${id}: ${expected}³`);
    assert.equal(rows.length, expected * expected * expected, `${id}: full grid`);
    const mid = ((size >> 1) * size + (size >> 1)) * size + (size >> 1);
    for (const [r, g, b] of [rows[0]!, rows[rows.length - 1]!, rows[mid]!]) {
      for (const c of [r, g, b]) assert.ok(c >= 0 && c <= 1, `${id}: value in [0,1]`);
    }
  }
});

test('a preset LUT applies and labels the chip with its title + grid', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('lutSource', 'preset' as any);
  await rt.setInput('lutPreset', 'slide-vivid' as any);
  assert.match(rt.getHydrated() as string, /Vivid slide · 33³/);
});

test('Download this LUT hands over the raw shipped .cube and resets the switch', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('lutSource', 'preset' as any);
  await rt.setInput('lutPreset', 'slide-vivid' as any);
  await rt.setInput('downloadPresetLut', true as any);

  assert.equal(delivered.length, 1, 'one .cube delivered');
  assert.equal(delivered[0]!.filename, 'darkroom-slide-vivid.cube');
  const { size, rows } = parseBaked(await delivered[0]!.blob.text());
  assert.equal(size, 33);
  assert.equal(rows.length, 33 * 33 * 33);
  assert.equal(value(rt, 'downloadPresetLut'), false, 'the switch flips itself back off');
});

test('an out-of-whitelist preset id falls back to the standard slide (no path escape)', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('lutSource', 'preset' as any);
  await rt.setInput('lutPreset', '../../../etc/passwd' as any);
  // Coerced to the default id; the bad string never reaches the fetch URL.
  assert.match(rt.getHydrated() as string, /Standard slide · 33³/);
});

test('bake folds an active preset LUT into the delivered .cube', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  await rt.setInput('lutSource', 'preset' as any);
  await rt.setInput('lutPreset', 'slide-vivid' as any);
  await rt.setInput('bakeLut', true as any);

  assert.equal(delivered.length, 1, 'one baked .cube delivered');
  const { size, rows } = parseBaked(await delivered[0]!.blob.text());
  assert.equal(size, 33);
  assert.equal(rows.length, 33 * 33 * 33);
  // The vivid slide preset is not an identity: at least one grid node must move
  // away from its input value (compare each baked row to the identity grid).
  const moved = rows.some((row, k) => {
    const r = (k % 33) / 32, g = (Math.floor(k / 33) % 33) / 32, b = Math.floor(k / (33 * 33)) / 32;
    return Math.abs(row[0]! - r) > 0.02 || Math.abs(row[1]! - g) > 0.02 || Math.abs(row[2]! - b) > 0.02;
  });
  assert.ok(moved, 'the baked cube reflects the preset, not an identity');
});

// ── Screen-only overlays: histogram + before/after divider ───────────────────
// These are the static-source contracts that keep the two review overlays out of
// the export. The interactive drag/rotate/resize itself is DOM-only (verified in a
// real browser), but the invariants below are the ones a regression would trip:
//   - the histogram + drag grips live under the single [data-export-hide] HUD, so
//     they are NEVER part of any render (the "still never rendered" guarantee), and
//   - the before/after divider (before-image + seam) is part of the SVG artwork,
//     NOT export-hidden, so a raster export bakes it exactly as placed, and
//   - the split is no longer baked into the composed bitmap (that made the
//     histogram read a half-before/half-after frankenframe and forced the seam
//     into every export at a fixed midpoint).

test('overlays: histogram + split grips are export-hidden; the divider is not', async () => {
  const tpl = await fetchFile('darkroom/template.html');
  // Anchor on the actual HUD attribute (not the prose mentions in comments/scripts).
  const attr = /\sdata-export-hide(?=[\s>])/g;
  const hud = tpl.search(attr);
  assert.ok(hud > 0, 'template has a [data-export-hide] HUD');
  // Two audited export-hidden nodes: the HUD, and the layered-mode PSD button
  // (plan 106). Anything beyond these is an unaudited export leak.
  assert.equal((tpl.match(attr) || []).length, 2,
    'exactly the two audited export-hidden nodes (HUD + PSD button)');
  assert.match(tpl, /data-export-file[^>]*data-export-hide|data-export-hide[^>]*data-export-file/,
    'the second export-hidden node is the PSD rebuild button');

  // Screen-only chrome sits inside the HUD (appears after it in document order).
  for (const marker of ['data-bs-hist', 'data-bs-split-move', 'data-bs-split-rot']) {
    const at = tpl.indexOf(marker);
    assert.ok(at > hud, `${marker} must live inside the export-hidden HUD (never exported)`);
  }
  // The divider composite is artwork inside the <svg>, ABOVE the HUD → it exports.
  for (const marker of ['data-bs-before', 'data-bs-seam', 'data-bs-clip']) {
    const at = tpl.indexOf(marker);
    assert.ok(at > 0 && at < hud, `${marker} must be SVG artwork, not export-hidden chrome`);
  }
});

test('overlays: the split is composited, not baked into the bitmap', async () => {
  const hooks = await fetchFile('darkroom/hooks.js');
  // The framed source is handed back for the "before" layer, and the paths emit it.
  assert.ok(hooks.includes('out.__bsFramed = framed'),
    'renderFrame must expose the framed source for the before layer');
  assert.ok(hooks.includes('beforeSrc'), 'the render paths must emit a beforeSrc');
  // The old in-bitmap seam bake (a fixed midpoint white bar) must be gone - its
  // return would put the seam into EVERY export at a fixed position again.
  assert.ok(!/fillRect\(\s*half\b/.test(hooks),
    'the split must not be painted into the composed bitmap');

  const styles = await fetchFile('darkroom/styles.css');
  for (const cls of ['.bs-split-grip', '.bs-hist-resize']) {
    assert.ok(styles.includes(cls), `styles must define ${cls} for the drag/resize affordance`);
  }
});

// ── the `videoLook` extra (plans/130) ────────────────────────────────────────
// The tool publishes its current grade as a .cube envelope so a shell can apply
// the same look to a video clip. Three properties matter and none is visible in
// the rendered template: it must exist HEADLESS (the maths is pure and is
// published before the raster guard - baseHost has no host.raster, so every
// assertion below runs through that early return, exactly like the CLI would);
// it must be key-guarded on the COLOUR identity, because serialising a 33³ table
// is synchronous CPU that a grain, framing or histogram tweak must not pay; and
// it must say whether the look is a real grade, because an identity cube is
// indistinguishable from a real one by inspection and a shell would otherwise
// re-encode a clip to change nothing.
//
// `videoLook` is an EXTRA, not an input, so it is only reachable by hydrating a
// string against the runtime context. The triple-stache is required: the value is
// JSON and {{x}} would escape its quotes into &quot;.
function readVideoLook(rt: any) {
  const raw = rt.getHydratedString('{{{videoLook}}}');
  assert.ok(raw, 'the tool publishes a videoLook extra');
  return JSON.parse(raw) as { v: number; on: number; cube: string; key: string };
}

test('videoLook: publishes a versioned .cube envelope, headless', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});

  const look = readVideoLook(rt);
  assert.equal(look.v, 1, 'the envelope is versioned');
  assert.ok(typeof look.key === 'string' && look.key.length > 0, 'the envelope carries its memo key');

  // The cube text is the tool's real bake at the default grid, not a stub.
  const { size, rows } = parseBaked(look.cube);
  assert.equal(size, 33);
  assert.equal(rows.length, 33 * 33 * 33);
  assert.deepEqual(rows[0], [0, 0, 0], 'default look is an identity: black stays black');

  // And the ENGINE's ported parser reads the tool's own bake - the free
  // cross-check that the two copies of the format agree (tests/grade-drift.test.ts
  // pins the maths; this pins the round trip a shell actually performs).
  const lut = parseCubeLut(look.cube);
  assert.equal(lut.kind, '3d');
  assert.equal(lut.size, 33);
});

test('videoLook: the download grid is not the video grid - the cube stays 33³', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  const before = readVideoLook(rt);
  assert.equal(parseCubeLut(before.cube).size, 33);

  // bakeSize is the grid of the .cube DOWNLOAD, chosen for whatever an NLE wants
  // to be handed. The video look is the PREVIEW's own lattice - the table the
  // still on screen is graded through, which is 33³ by construction - so moving
  // the download preference must neither change the published look nor spend
  // 150 ms and 7 MB re-serialising a 65³ one on a slider tick.
  await rt.setInput('bakeSize', '65' as any);
  const after = readVideoLook(rt);
  assert.equal(after.key, before.key, 'the download grid is not part of the look identity');
  assert.equal(after.cube, before.cube, 'the published cube is the same text');
  assert.equal(parseCubeLut(after.cube).size, 33);
});

test('videoLook: the envelope says whether the look actually does anything', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  // An untouched darkroom bakes a perfectly good identity cube. Applying it to a
  // clip would re-encode the file, cost a generation of quality and stamp a
  // colour-grade credential for an adjustment that never happened, so the
  // envelope carries the answer rather than leaving a shell to guess from text.
  assert.equal(readVideoLook(rt).on, 0, 'the default pipeline is an identity');

  await rt.setInput('exposure', 1 as any);
  assert.equal(readVideoLook(rt).on, 1, '+1 EV is a real grade');
});

test('videoLook: a colour change republishes under a new key', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  const before = readVideoLook(rt);

  await rt.setInput('exposure', 1 as any);
  const after = readVideoLook(rt);
  assert.notEqual(after.key, before.key, '+1 EV is a different look');
  assert.notEqual(after.cube, before.cube, 'and the cube text moves with it');
  // Same linear-light stop the .cube download bakes: srgb 0.5 → ≈0.687.
  const mid = parseBaked(after.cube).rows[(16 * 33 + 16) * 33 + 16]!;
  for (const c of mid) assert.ok(Math.abs(c - 0.687) < 0.02, `mid-grey after +1 EV ≈ 0.687 (got ${c})`);
});

test('videoLook: a non-colour input does not pay for a rebake', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
  const before = readVideoLook(rt);

  // The histogram is a screen-only overlay - it cannot change the grade, so the
  // hook emits `undefined` and the engine's mergePatch leaves the extra standing.
  await rt.setInput('histogram', true as any);
  const after = readVideoLook(rt);
  assert.equal(after.key, before.key, 'the look key is unchanged by a view-only input');
  assert.equal(after.cube, before.cube, 'the published cube is the same text');
});
