// SPDX-License-Identifier: MPL-2.0
/**
 * Units DRIFT GUARDS for the Design tool (plans/184 R13) - static reads of the places a
 * length is spelled out a second time, the same static-read pattern as a11y-prefs-contract.test.ts:
 *
 *   1. the paper presets in free-canvas.ts round-trip through the engine's units.ts to
 *      the physical size their name claims. A4 was 2480 x 3508 CSS px for months - 300
 *      dpi baked into a 96 dpi unit, a 656 mm wide page - because nothing ever measured
 *      the table against the unit it is in;
 *   2. the inspector reads time in seconds everywhere (`unit: 'ms'` is gone), and every
 *      seconds cell says how many decimals it keeps;
 *   3. lib/unit-steps.ts knows every engine unit, and its display precision loses under
 *      half a CSS pixel on a round trip - the bar shows a length and reads it back;
 *   4. the export bar's width/height and the URL's w/h are read with parseFloat, never
 *      parseInt: `8.5in` was truncated to `8in` by the URL sync and the scrub alike.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/design-units-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { UNITS, toUnit } from '@lolly/engine';
import { stepFor, decimalsFor, displayIn, convertLength, roundIn } from '../lib/unit-steps.ts';

const here = dirname(fileURLToPath(import.meta.url));
const src = (rel: string): string => readFileSync(join(here, rel), 'utf8');
// The free canvas is an orchestrator plus feature modules under free-canvas/ (2026-09-09 split), so
// a source pin reads all of it rather than guessing which module a line moved to.
const freeCanvasSrc = (): string => [src('./free-canvas.ts'), ...readdirSync(join(here, 'free-canvas')).filter((n) => n.endsWith('.ts')).sort().map((n) => src(`./free-canvas/${n}`))].join('\n');
const designManifest = (): Record<string, unknown> => JSON.parse(readFileSync(join(here, '../../../../community/design/tool.json'), 'utf8')) as Record<string, unknown>;

/** Every `['Name', w, h]` triple of one preset table. */
function presets(source: string, name: string): Array<[string, number, number]> {
  const m = new RegExp(`const ${name}: Array<\\[string, number, number\\]> = \\[([\\s\\S]*?)\\];`).exec(source);
  assert.ok(m, `${name} table found in free-canvas.ts`);
  const out: Array<[string, number, number]> = [];
  for (const r of m![1]!.matchAll(/\['([^']+)',\s*([\d.]+),\s*([\d.]+)\]/g)) out.push([r[1]!, parseFloat(r[2]!), parseFloat(r[3]!)]);
  assert.ok(out.length > 3, `${name} parsed`);
  return out;
}

const PAPER: Record<string, { w: number; h: number; unit: 'mm' | 'in'; tol: number }> = {
  'A4 portrait': { w: 210, h: 297, unit: 'mm', tol: 0.05 },
  'Letter': { w: 8.5, h: 11, unit: 'in', tol: 0.001 },
};

test('units: every paper preset is its physical size in 96-dpi CSS px', () => {
  const fc = freeCanvasSrc();
  const all = [...presets(fc, 'SIZE_PRESETS'), ...presets(fc, 'PAGE_PRESETS')];
  let papers = 0;
  for (const [name, w, h] of all) {
    const paper = PAPER[name];
    if (!paper) {
      // A screen preset stays a screen size: a 300-dpi paper sneaking back in as px is
      // the only way a preset gets this large.
      assert.ok(w <= 3840 && h <= 3840, `${name} ${w}x${h} is a screen size, not a print raster`);
      continue;
    }
    papers++;
    assert.ok(Math.abs(toUnit({ value: w, unit: 'px' }, paper.unit) - paper.w) <= paper.tol, `${name} width ${w} px is ${paper.w} ${paper.unit}`);
    assert.ok(Math.abs(toUnit({ value: h, unit: 'px' }, paper.unit) - paper.h) <= paper.tol, `${name} height ${h} px is ${paper.h} ${paper.unit}`);
  }
  assert.ok(papers >= 2, 'both paper presets were measured');
});

test('units: the inspector shows time in seconds, with a declared precision', () => {
  const di = src('./design-inspector.ts');
  assert.equal(/unit:\s*'ms'/.test(di), false, 'no cell is labelled ms - one time notation');
  for (const m of di.matchAll(/\{[^{}]*unit:\s*'s'[^{}]*\}/g)) {
    assert.match(m[0], /precision:\s*\d/, `a seconds cell says its decimals: ${m[0].slice(0, 80)}`);
  }
});

test('units: unit-steps covers every engine unit and round-trips under half a px', () => {
  for (const u of UNITS) {
    assert.ok(stepFor(u) > 0, `${u} has a step`);
    assert.ok(decimalsFor(u) >= 0, `${u} has a precision`);
    for (const px of [1, 63.5, 793.7, 816, 1122.5, 1920, 3840]) {
      const shown = displayIn(px, u);
      const back = convertLength(shown, u, 'px');
      assert.ok(Math.abs(back - px) < 0.5, `${px} px -> ${shown} ${u} -> ${back} px`);
    }
  }
  assert.equal(displayIn(793.7, 'mm'), 210, 'A4 width reads as 210 mm');
  assert.equal(displayIn(1122.5, 'mm'), 297, 'A4 height reads as 297 mm');
  assert.equal(displayIn(816, 'in'), 8.5, 'Letter width reads as 8.5 in');
  assert.equal(roundIn(-0.00001, 'mm'), 0, 'no negative zero');
  assert.equal(convertLength(12, 'furlong', 'px'), 12, 'an unknown unit passes through');
});

test('units: export size fields and URL w/h are read as decimals', () => {
  const ta = src('./tool-actions.ts');
  const tool = src('./tool.ts');
  for (const field of ['export-width', 'export-height']) {
    assert.equal(new RegExp(`parseInt\\([^;]*${field}`).test(ta), false, `tool-actions reads ${field} with parseFloat`);
    assert.equal(new RegExp(`parseInt\\([^;]*${field}`).test(tool), false, `tool.ts reads ${field} with parseFloat`);
  }
  const scrub = src('./tool-action-helpers.ts');
  assert.equal(/parseInt\(inputEl\.value/.test(scrub), false, 'the scrub reads the field with parseFloat');
  assert.match(scrub, /opts\.step\?\.\(\)/, 'the scrub takes a per-unit step');
});

test('units: Design persists one document unit and DPI, and mirrors them to export', () => {
  const manifest = designManifest();
  const inputs = manifest.inputs as Array<{ id: string; default: unknown }>;
  assert.deepEqual(inputs.find(i => i.id === 'documentUnit')?.default, 'px');
  assert.deepEqual(inputs.find(i => i.id === 'documentDpi')?.default, 300);

  const fc = freeCanvasSrc();
  const actions = [src('./tool-actions.ts'), ...readdirSync(join(here, 'tool-actions')).filter((n) => n.endsWith('.ts')).sort().map((n) => src(`./tool-actions/${n}`))].join('\n');
  const dimensionFields = src('./export-dimension-fields.ts');
  const inspector = src('./design-inspector.ts');
  assert.match(fc, /setDocumentSettings\?\(settings:/, 'the canvas has a shell callback for shared unit/DPI state');
  assert.match(fc, /runtime\.setInput\('documentUnit', unit\)/, 'changing the size-panel unit persists in the document');
  assert.match(fc, /runtime\.setInput\('documentDpi', next\)/, 'changing DPI persists in the document');
  assert.match(fc, /const pxW = toUnitVal\((?:fc, )?w, unit, 'px'\)/, 'artboard dimensions retain fractional CSS pixels');
  assert.match(dimensionFields, /export interface ExportDimensionUpdate[\s\S]*dpi\?: number/, 'the dimension seam accepts the document DPI');
  assert.match(actions, /applyExportDimensionFields\(el!?, (?:ta\.)?curUnit, update\)/, 'the export bar applies dimensions through the typed seam');
  assert.match(inspector, /const DOCUMENT_UNITS = \['px', 'mm', 'cm', 'in', 'pt'\]/, 'the Inspector exposes the document unit vocabulary');
  assert.match(inspector, /docSelectRow\(t\('Document unit'\), 'documentUnit'/, 'the Inspector can change the persisted document unit');
  assert.match(inspector, /docNumRow\(t\('Document DPI'\), 'documentDpi'/, 'the Inspector can change the persisted document DPI');
  assert.match(inspector, /write\(field, o\.scale \? v \* o\.scale : v\)/, 'Inspector geometry converts its displayed document unit back to CSS px once');
});
