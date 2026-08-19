// SPDX-License-Identifier: MPL-2.0
/**
 * Byte-exact golden tests for the engine's export emitters - the tier that
 * runs on EVERY clone: no browser, no brand pack, no network.
 *
 * (a) Vector emitters emitEmf / emitEps / emitDxf (engine/src/emf.ts, eps.ts,
 *     dxf.ts) against hand-built VectorIr fixtures covering the emission
 *     surface the IR can express: filled paths (both fill rules), stroked
 *     paths, fill+stroke, multi-subpath glyph outlines (text-as-paths - the IR
 *     carries no text or gradient prims; both are resolved upstream by the
 *     shell's IR producer, so paths and the raster image escape-hatch ARE the
 *     whole surface), an image region (DXF drops it - droppedImages pinned),
 *     and physical-unit output (mm) plus the EPS CMYK colour mode.
 * (b) Data/text formats hydrated by the engine (buildDataPayload in
 *     engine/src/runtime.ts) through the real runtime.export path: the
 *     community chart-creator / color-palette template.csv siblings (real
 *     public tools, real hooks), the model-derived JSON payload, and a
 *     synthetic tool double pinning the ics/vcf helpers (icsStamp / rfcText - 
 *     community ships no ics/vcf tool; the SUSE ones live in a private pack
 *     that would force CI skips).
 *
 * Every input is pinned - no now-defaults, no randomness - so the goldens are
 * byte-stable across runs and machines.
 *
 * Run:        node --test tests/export-emitter-golden.test.ts
 * Regenerate: UPDATE_GOLDENS=1 node --test tests/export-emitter-golden.test.ts
 *   (then re-run without UPDATE_GOLDENS to confirm green, and diff-review the
 *   fixture change before committing - the golden diff IS the review artefact
 *   for any emitter change.)
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { emitEmf } from '../engine/src/emf.ts';
import type { VectorIr, VectorImagePrim, VectorPathPrim } from '../engine/src/emf.ts';
import { emitEps } from '../engine/src/eps.ts';
import { emitDxf } from '../engine/src/dxf.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { LoadedTool } from '../engine/src/loader.ts';
import { baseHost } from './helpers/host.ts';

const REPO_ROOT_URL = new URL('../', import.meta.url);
const repoPath = (rel: string): string => fileURLToPath(new URL(rel, REPO_ROOT_URL));

const UPDATE_GOLDENS = process.env.UPDATE_GOLDENS === '1';
const FIXTURE_PATH = repoPath('tests/fixtures/export-emitter.golden.json');

type Golden = Record<string, string>;

function loadFixture(): Golden {
  try {
    return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as Golden;
  } catch {
    return {};
  }
}

const committed = loadFixture();
const regenerated: Golden = {};

after(() => {
  if (!UPDATE_GOLDENS) return;
  mkdirSync(repoPath('tests/fixtures'), { recursive: true });
  // Rebuilt from scratch each regen run, keys sorted - no stale leftovers.
  const sorted: Golden = {};
  for (const key of Object.keys(regenerated).sort()) sorted[key] = regenerated[key]!;
  writeFileSync(FIXTURE_PATH, `${JSON.stringify(sorted, null, 2)}\n`, 'utf8');
});

/** Records the live value as the new golden (UPDATE_GOLDENS=1) or asserts it
 *  matches the committed fixture byte-for-byte. */
function goldenCase(id: string, live: string): void {
  if (UPDATE_GOLDENS) {
    regenerated[id] = live;
    return;
  }
  const want = committed[id];
  assert.ok(want !== undefined,
    `no committed golden for "${id}" — regenerate with UPDATE_GOLDENS=1 node --test tests/export-emitter-golden.test.ts`);
  assert.equal(live, want, `output for "${id}" drifted from the committed golden`);
}

const b64 = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64');

// ─── (a) hand-built VectorIr fixtures ────────────────────────────────────────

const path = (
  subpaths: VectorPathPrim['subpaths'],
  fill: VectorPathPrim['fill'],
  stroke: VectorPathPrim['stroke'],
  fillRule: VectorPathPrim['fillRule'] = 'nonzero',
): VectorPathPrim => ({ type: 'path', subpaths, fill, stroke, fillRule });

// Filled-only: one closed shape with a cubic, evenodd rule.
const FILLED: VectorIr = {
  width: 200, height: 100,
  prims: [path([{
    segments: [
      { op: 'M', x: 10, y: 10 },
      { op: 'C', x1: 40, y1: 0, x2: 80, y2: 0, x: 110, y: 10 },
      { op: 'L', x: 110, y: 90 },
      { op: 'L', x: 10, y: 90 },
    ],
    closed: true,
  }], { r: 255, g: 0, b: 0 }, null, 'evenodd')],
};

// Stroke-only: an OPEN polyline (exercises the no-fill, no-closepath branch).
const STROKED: VectorIr = {
  width: 200, height: 100,
  prims: [path([{
    segments: [
      { op: 'M', x: 20, y: 80 },
      { op: 'L', x: 100, y: 20 },
      { op: 'C', x1: 130, y1: 10, x2: 160, y2: 40, x: 180, y: 80 },
    ],
    closed: false,
  }], null, { r: 0, g: 64, b: 128, width: 3.5 })],
};

// Fill + stroke on the same prim (EMF STROKEANDFILLPATH; EPS gsave/grestore).
const FILL_STROKE: VectorIr = {
  width: 200, height: 100,
  prims: [path([{
    segments: [
      { op: 'M', x: 30, y: 30 },
      { op: 'L', x: 170, y: 30 },
      { op: 'L', x: 170, y: 70 },
      { op: 'L', x: 30, y: 70 },
    ],
    closed: true,
  }], { r: 0, g: 128, b: 64 }, { r: 20, g: 20, b: 20, width: 2 })],
};

// Text-as-paths: an "o"-like glyph - outer + inner (counter) subpath in ONE
// prim, nonzero winding. This is exactly what outlined text reaches the
// emitters as (the IR has no text prim), so it pins the multi-subpath surface.
const GLYPH_OUTLINE: VectorIr = {
  width: 100, height: 100,
  prims: [path([
    {
      segments: [
        { op: 'M', x: 50, y: 10 },
        { op: 'C', x1: 75, y1: 10, x2: 90, y2: 30, x: 90, y: 50 },
        { op: 'C', x1: 90, y1: 70, x2: 75, y2: 90, x: 50, y: 90 },
        { op: 'C', x1: 25, y1: 90, x2: 10, y2: 70, x: 10, y: 50 },
        { op: 'C', x1: 10, y1: 30, x2: 25, y2: 10, x: 50, y: 10 },
      ],
      closed: true,
    },
    {
      segments: [
        { op: 'M', x: 50, y: 30 },
        { op: 'C', x1: 40, y1: 30, x2: 30, y2: 40, x: 30, y: 50 },
        { op: 'C', x1: 30, y1: 60, x2: 40, y2: 70, x: 50, y: 70 },
        { op: 'C', x1: 60, y1: 70, x2: 70, y2: 60, x: 70, y: 50 },
        { op: 'C', x1: 70, y1: 40, x2: 60, y2: 30, x: 50, y: 30 },
      ],
      closed: true,
    },
  ], { r: 10, g: 10, b: 10 }, null, 'nonzero')],
};

// Raster escape-hatch: a path plus a tiny 2×2 opaque-RGB image region.
// EMF/EPS embed it (STRETCHDIBITS / PostScript image); DXF DROPS it.
const IMAGE_PRIM: VectorImagePrim = {
  type: 'image',
  x: 120, y: 20, w: 60, h: 60, pxW: 2, pxH: 2,
  rgb: new Uint8Array([255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0]),
};
const WITH_IMAGE: VectorIr = {
  width: 200, height: 100,
  prims: [FILL_STROKE.prims[0]!, IMAGE_PRIM],
};

const CASES: Array<[string, VectorIr]> = [
  ['filled-evenodd', FILLED],
  ['stroked-open', STROKED],
  ['fill-stroke', FILL_STROKE],
  ['glyph-outline', GLYPH_OUTLINE],
  ['image-region', WITH_IMAGE],
];

test('emitEmf: golden bytes per fixture', () => {
  for (const [name, ir] of CASES) {
    goldenCase(`emf/${name}`, b64(emitEmf(ir, { width: ir.width, height: ir.height })));
  }
});

test('emitEps: golden text per fixture', () => {
  for (const [name, ir] of CASES) {
    goldenCase(`eps/${name}`, emitEps(ir, { width: ir.width, height: ir.height }));
  }
});

test('emitDxf: golden text per fixture, image prim dropped', () => {
  for (const [name, ir] of CASES) {
    const { text, droppedImages } = emitDxf(ir, { width: ir.width, height: ir.height });
    goldenCase(`dxf/${name}`, text);
    // DXF has no raster carrier - the emitter must COUNT the drop (the shell
    // warns from this), never silently lose it.
    assert.equal(droppedImages, name === 'image-region' ? 1 : 0, `droppedImages for ${name}`);
  }
});

test('physical units: 40×20 mm output changes headers/coords in all three formats', () => {
  const opts = { width: 40, height: 20, unit: 'mm', dpi: 300 };
  goldenCase('emf/physical-mm', b64(emitEmf(FILL_STROKE, opts)));
  goldenCase('eps/physical-mm', emitEps(FILL_STROKE, opts));
  goldenCase('dxf/physical-mm', emitDxf(FILL_STROKE, opts).text);
  // The physical size must actually reach the output (vs the px-default case).
  assert.notEqual(emitEps(FILL_STROKE, opts), emitEps(FILL_STROKE, { width: FILL_STROKE.width, height: FILL_STROKE.height }));
});

test('emitEps: CMYK colour mode golden', () => {
  const rgbOut = emitEps(FILL_STROKE, { width: 200, height: 100 });
  const cmykOut = emitEps(FILL_STROKE, { width: 200, height: 100, cmyk: true });
  goldenCase('eps/fill-stroke-cmyk', cmykOut);
  assert.notEqual(cmykOut, rgbOut, 'cmyk mode changes the emitted operators');
  assert.ok(cmykOut.includes('setcmykcolor'), 'cmyk output uses setcmykcolor');
});

// ── non-vacuity + determinism controls for (a) ───────────────────────────────

test('negative control: a perturbed fixture emits different bytes in every format', () => {
  const perturbed: VectorIr = structuredClone(FILLED);
  (perturbed.prims[0] as VectorPathPrim).fill = { r: 254, g: 0, b: 0 };
  assert.notEqual(b64(emitEmf(perturbed, { width: 200, height: 100 })),
    b64(emitEmf(FILLED, { width: 200, height: 100 })), 'EMF sees the perturbation');
  assert.notEqual(emitEps(perturbed, { width: 200, height: 100 }),
    emitEps(FILLED, { width: 200, height: 100 }), 'EPS sees the perturbation');
  const seg = (perturbed.prims[0] as VectorPathPrim).subpaths[0]!.segments[0];
  if (seg?.op === 'M') seg.x = 11; // DXF flattens colour-independently - move a point too
  assert.notEqual(emitDxf(perturbed, { width: 200, height: 100 }).text,
    emitDxf(FILLED, { width: 200, height: 100 }).text, 'DXF sees the perturbation');
});

test('goldens are structurally non-trivial (would fail on empty output)', () => {
  const g = UPDATE_GOLDENS ? regenerated : committed;
  const emf = Buffer.from(g['emf/filled-evenodd'] ?? '', 'base64');
  assert.ok(emf.length > 200, 'EMF golden carries records, not just a header');
  assert.equal(new DataView(emf.buffer, emf.byteOffset).getUint32(0x28, true), 0x464D4520, "EMF signature ' EMF'");
  assert.ok((g['eps/filled-evenodd'] ?? '').startsWith('%!PS-Adobe-3.0 EPSF-3.0'), 'EPS DSC header');
  assert.ok((g['eps/filled-evenodd'] ?? '').includes('curveto'), 'EPS golden carries path geometry');
  assert.ok((g['eps/filled-evenodd'] ?? '').includes('eofill'), 'evenodd fill rule reached the EPS output');
  assert.ok((g['dxf/filled-evenodd'] ?? '').includes('ENTITIES'), 'DXF golden carries an ENTITIES section');
  assert.ok((g['emf/image-region'] ?? '').length > (g['emf/fill-stroke'] ?? '').length,
    'image bytes actually embedded in the EMF image-region golden');
});

test('determinism: emitting the same fixture twice is byte-identical', () => {
  assert.equal(b64(emitEmf(WITH_IMAGE, {})), b64(emitEmf(WITH_IMAGE, {})));
  assert.equal(emitEps(WITH_IMAGE, {}), emitEps(WITH_IMAGE, {}));
  assert.equal(emitDxf(WITH_IMAGE, {}).text, emitDxf(WITH_IMAGE, {}).text);
});

// ─── (b) data/text format goldens through the engine's buildDataPayload ──────

// Loads a REAL community tool (public submodule, always mounted) straight from
// its source pack - never the gitignored tools/ profile view.
function loadCommunityTool(id: string, textExts: string[]): LoadedTool {
  const dir = `community/${id}/`;
  const read = (rel: string): string => readFileSync(repoPath(dir + rel), 'utf8');
  const textTemplates: Record<string, string | null> = {};
  for (const ext of textExts) textTemplates[ext] = read(`template.${ext}`);
  return {
    manifest: JSON.parse(read('tool.json')),
    template: read('template.html'),
    styles: null, // csv hydration never reads styles
    hooksSource: read('hooks.js'),
    hooksUrl: null,
    textTemplates,
    textTemplateErrors: {},
  };
}

// runtime.export hands data formats to host.export.render as opts.dataText - 
// capture that instead of rendering anything.
function captureHost() {
  const seen: Array<{ format: string; dataText?: string; dataMime?: string }> = [];
  const host = baseHost({
    export: {
      render: async (_node: unknown, format: string, opts: { dataText?: string; dataMime?: string }) => {
        seen.push({ format, dataText: opts.dataText, dataMime: opts.dataMime });
        return new Blob([opts.dataText ?? '']);
      },
      download: async () => {},
    },
  });
  return { host, seen };
}

async function hydrateData(tool: LoadedTool, initial: Record<string, unknown>, format: string):
  Promise<{ dataText: string; dataMime: string }> {
  const { host, seen } = captureHost();
  const rt = await createRuntime(tool, host, initial as never);
  await rt.export({}, format, { embedMeta: false });
  const out = seen[0]!;
  assert.equal(out.format, format);
  assert.ok(typeof out.dataText === 'string', `dataText produced for ${format}`);
  return { dataText: out.dataText!, dataMime: out.dataMime! };
}

test('data: color-palette template.csv golden (hook-computed csvRows)', async () => {
  const tool = loadCommunityTool('color-palette', ['csv']);
  // seed pinned to a literal hex - its manifest default is a brand-token ref
  // the stub host can't resolve.
  const { dataText, dataMime } = await hydrateData(
    tool, { seed: '#336699', harmony: 'triad-3', steps: 5, neutrals: true }, 'csv');
  assert.equal(dataMime, 'text/csv');
  goldenCase('data/color-palette-csv', dataText);
  // Non-vacuity: csvRows comes from the tool's onInit hook - an empty hydration
  // (hook failed silently) would be header-only, so demand real swatch rows.
  const rows = dataText.trim().split('\n');
  assert.ok(rows.length > 5, `hook produced swatch rows, got ${rows.length} lines`);
  assert.ok(/#[0-9a-fA-F]{6}/.test(dataText), 'rows carry hex colours');
});

test('data: model-derived JSON payload golden', async () => {
  const tool = loadCommunityTool('color-palette', ['csv']);
  const { dataText, dataMime } = await hydrateData(
    tool, { seed: '#336699', harmony: 'triad-3', steps: 5, neutrals: true }, 'json');
  assert.equal(dataMime, 'application/json');
  goldenCase('data/color-palette-json', dataText);
  const parsed = JSON.parse(dataText);
  assert.equal(parsed.tool, 'color-palette');
  assert.equal(parsed.inputs.seed, '#336699', 'pinned input survives into the payload');
});

// Synthetic tool double for ics/vcf: community ships no ics/vcf tool (those
// live in the private SUSE pack), so pin the engine's icsStamp/rfcText helpers
// with hand-written sibling templates instead of forcing a CI skip.
function dataToolDouble(): LoadedTool {
  return {
    manifest: {
      id: 'golden-data-double', name: 'Golden data double', version: '1.0.0',
      engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['ics', 'vcf'] },
      inputs: [
        { id: 'title', type: 'text', default: '' },
        { id: 'notes', type: 'longtext', default: '' },
        { id: 'start', type: 'datetime-local', default: '2026-01-02T09:30' },
        { id: 'end', type: 'datetime-local', default: '2026-01-02T10:00' },
        { id: 'day', type: 'date', default: '2026-01-02' },
      ],
    } as never,
    template: '<div>{{title}}</div>',
    styles: null,
    hooksSource: null,
    hooksUrl: null,
    textTemplates: {
      ics: [
        'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lolly//Golden//EN', 'BEGIN:VEVENT',
        'UID:golden-data-double@lolly.tools',
        'DTSTAMP:{{icsStamp start}}',
        'DTSTART:{{icsStamp start}}',
        'DTEND:{{icsStamp end}}',
        'SUMMARY:{{rfcText title}}',
        'DESCRIPTION:{{rfcText notes}}',
        'END:VEVENT', 'END:VCALENDAR', '',
      ].join('\r\n'),
      vcf: [
        'BEGIN:VCARD', 'VERSION:4.0',
        'FN:{{rfcText title}}',
        'BDAY:{{icsStamp day}}',
        'NOTE:{{rfcText notes}}',
        'END:VCARD', '',
      ].join('\r\n'),
    },
    textTemplateErrors: {},
  };
}

// Every date/time pinned explicitly; text exercises the RFC 5545/6350 escapes.
const DATA_INPUTS = {
  title: 'Planning; Q3, part 1',
  notes: 'Line one\nback\\slash, done',
  start: '2026-03-04T14:30',
  end: '2026-03-04T15:00',
  day: '1999-12-31',
};

test('data: ics golden (icsStamp + rfcText through buildDataPayload)', async () => {
  const { dataText, dataMime } = await hydrateData(dataToolDouble(), DATA_INPUTS, 'ics');
  assert.equal(dataMime, 'text/calendar');
  goldenCase('data/ics', dataText);
  assert.ok(dataText.includes('DTSTART:20260304T143000'), 'icsStamp basic form with padded seconds');
  assert.ok(dataText.includes('SUMMARY:Planning\\; Q3\\, part 1'), 'rfcText escapes ; and ,');
  assert.ok(dataText.includes('DESCRIPTION:Line one\\nback\\\\slash\\, done'), 'rfcText escapes newline and backslash');
});

test('data: vcf golden', async () => {
  const { dataText, dataMime } = await hydrateData(dataToolDouble(), DATA_INPUTS, 'vcf');
  assert.equal(dataMime, 'text/vcard');
  goldenCase('data/vcf', dataText);
  assert.ok(dataText.includes('BDAY:19991231'), 'date-only icsStamp form');
  assert.ok(dataText.includes('FN:Planning\\; Q3\\, part 1'), 'escaped FN present');
});

test('data negative control: a perturbed input hydrates different bytes; repeat runs are stable', async () => {
  const base = await hydrateData(dataToolDouble(), DATA_INPUTS, 'ics');
  const again = await hydrateData(dataToolDouble(), DATA_INPUTS, 'ics');
  assert.equal(again.dataText, base.dataText, 'same pinned inputs → identical bytes');
  const moved = await hydrateData(dataToolDouble(), { ...DATA_INPUTS, start: '2026-03-04T14:31' }, 'ics');
  assert.notEqual(moved.dataText, base.dataText, 'a one-minute shift changes the payload');
});
