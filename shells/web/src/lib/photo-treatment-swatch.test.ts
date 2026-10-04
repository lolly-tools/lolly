// SPDX-License-Identifier: MPL-2.0
/**
 * Photo look swatches (plan 291 W7). A gradient-map look has only `stops`, so a swatch
 * built from shadow/mid/highlight came out as `linear-gradient(135deg,)` in the asset
 * picker (blank) and as a neutral grey ramp in the Assets colour rows, so a green
 * brand grade showed grey. Both surfaces now share one helper.
 *
 * Run: node --test shells/web/src/lib/photo-treatment-swatch.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { photoTreatmentSwatch } from './photo-treatment-swatch.ts';
import { parsePhotoTreatmentsDoc, type PhotoTreatment } from '../../../../engine/src/photo-treatment.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '../../../..');
const colours = (css: string): string[] => css.match(/#[0-9a-f]{6}\b/gi) ?? [];

test('a stops-only gradient map gets a real ramp that shows its colours', () => {
  const green: PhotoTreatment = { id: 'grade', kind: 'gradient-map', stops: ['#0c322c', '#30ba78', '#ffffff'] };
  const css = photoTreatmentSwatch(green);
  assert.doesNotMatch(css, /\(135deg,\)/, 'never an empty gradient');
  const list = colours(css);
  assert.ok(list.length >= 2, css);
  const mid = list[Math.floor(list.length / 2)]!;
  const [r, g, b] = [1, 3, 5].map(i => parseInt(mid.slice(i, i + 2), 16));
  assert.ok(g! > r! + 20 && g! > b! + 10, `the middle of a green look reads green (${mid})`);
  assert.equal(list[0], '#0c322c', 'the shadow end is the first stop');
});

test('the legacy kinds keep their swatches, a lut gets a neutral marker, and bad colours never reach the CSS', () => {
  assert.equal(photoTreatmentSwatch({ id: 'g', kind: 'greyscale' }), 'linear-gradient(135deg,#2b2b2b,#e9e9e9)');
  assert.equal(photoTreatmentSwatch({ id: 'd', kind: 'duotone', shadow: '#112233', mid: '#445566', highlight: '#ddeeff' }), 'linear-gradient(135deg,#112233,#445566,#ddeeff)');
  assert.match(photoTreatmentSwatch({ id: 'l', kind: 'lut', lut: 'x/luts/film' }), /^repeating-linear-gradient\(/);
  const hostile = photoTreatmentSwatch({ id: 'd', kind: 'duotone', shadow: '#000000', mid: 'red;}" onclick="x', highlight: '#ffffff' });
  assert.equal(hostile, 'linear-gradient(135deg,#000000,#ffffff)');
});

test("every shipped public look has a swatch with colours", () => {
  const doc = JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/palette/photo-treatments.json'), 'utf8'));
  for (const look of parsePhotoTreatmentsDoc(doc)) {
    const css = photoTreatmentSwatch(look);
    assert.ok(look.kind === 'lut' || colours(css).length >= 2, `${look.id}: ${css}`);
  }
});

test('the picker strip and the Assets colour rows both draw swatches through the shared helper', () => {
  const picker = readFileSync(join(HERE, '../components/photo-treatment-strip.ts'), 'utf8');
  assert.match(readFileSync(join(HERE, '../views/picker.ts'), 'utf8'), /photoTreatmentStripHtml\(/, 'picker delegates its swatches to the shared strip');
  const assetsDir = join(HERE, '../views/assets');
  const assets = readdirSync(assetsDir).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => readFileSync(join(assetsDir, f), 'utf8')).join('\n');
  for (const [name, src] of [['picker', picker], ['assets', assets]] as const) {
    assert.match(src, /photoTreatmentSwatch\(/, `${name} uses photoTreatmentSwatch`);
    assert.doesNotMatch(src, /\[t\.shadow(?: \?\? '#333')?, t\.mid, t\.highlight/, `${name} no longer builds a swatch from shadow/mid/highlight alone`);
  }
});
