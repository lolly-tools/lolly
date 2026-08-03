// SPDX-License-Identifier: MPL-2.0
/**
 * bitmap-studio tool contract tests.
 *
 * Run with: node --test tests/bitmap-studio-tool.test.ts
 * No test framework — node:test built-in.
 *
 * Loads the REAL tool straight from community/bitmap-studio and
 * drives it through the engine with a stubbed host — only the host is stubbed;
 * the code under test is the shipped manifest + hooks. Guards:
 *   - headless degradation: no canvas → the placeholder note, never a throw,
 *   - .cube parsing (3D and 1D) surfaced through the LUT chip, and the
 *     friendly error chip for an unreadable file,
 *   - the .cube BAKE (pure maths, works headless — the CLI path): identity
 *     pipeline bakes an identity LUT, exposure moves the mid-grey entry the
 *     way linear-light stops must, a duotone bakes its shadow stop into the
 *     black entry, bakeSize is honoured, and the bakeLut switch resets itself,
 *   - baked output round-trips through the documented .cube grammar
 *     (red-fastest, DOMAIN 0..1, N³ rows).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

const TOOLS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(TOOLS_DIR, path), 'utf8');

assert.ok(existsSync(join(TOOLS_DIR, 'bitmap-studio', 'tool.json')),
  'community/bitmap-studio/tool.json is missing — the tool was renamed or deleted');

const tool: any = await loadTool('bitmap-studio', fetchFile);

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
  const rows = lines
    .filter(l => /^\d+\.\d+ \d+\.\d+ \d+\.\d+$/.test(l))
    .map(l => l.split(' ').map(Number) as [number, number, number]);
  return { size, rows };
}

test('manifest: a designer-grade raster tool on the ^1.4 engine', () => {
  const m = tool.manifest;
  assert.equal(m.id, 'bitmap-studio');
  assert.equal(m.engineVersion, '^1.4.0');
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
  await rt.setInput('lutFile', lutFile('invert.cube', cube) as any);
  const html = rt.getHydrated() as string;
  assert.match(html, /Invert · 2³/);
});

test('a 1D .cube is labelled as a 1D ramp; junk is a friendly error', async () => {
  const { host } = makeHost();
  const rt = await createRuntime(tool, host, {});
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
  assert.equal(delivered[0]!.filename, 'bitmap-studio-look-33.cube');
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

test('bake: a loaded LUT folds into the bake, and bakeSize is honoured', async () => {
  const { host, delivered } = makeHost();
  const rt = await createRuntime(tool, host, {});
  // Invert LUT: the baked pipeline should come out inverted end-to-end.
  const cube = [
    'LUT_3D_SIZE 2',
    '1 1 1', '0 1 1', '1 0 1', '0 0 1',
    '1 1 0', '0 1 0', '1 0 0', '0 0 0',
  ].join('\n');
  await rt.setInput('lutFile', lutFile('invert.cube', cube) as any);
  await rt.setInput('bakeSize', '17' as any);
  await rt.setInput('bakeLut', true as any);

  assert.equal(delivered[0]!.filename, 'bitmap-studio-look-17.cube');
  const { size, rows } = parseBaked(await delivered[0]!.blob.text());
  assert.equal(size, 17);
  assert.equal(rows.length, 17 * 17 * 17);
  assert.deepEqual(rows[0], [1, 1, 1], 'black inverts to white');
  assert.deepEqual(rows[rows.length - 1], [0, 0, 0], 'white inverts to black');
});
