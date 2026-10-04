// SPDX-License-Identifier: MPL-2.0
/**
 * Hostile or malformed Design documents against the engine half of `lolly check`
 * (plan 291, W1): a layer with a negative size still yields a report that fits its
 * schema, and a crafted colour value cannot stall the Verify colour reader.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/check-hardening.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Ajv from 'ajv/dist/2020.js';

import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { checkFindingFromBrand, checkFindingsFromHouseRules, designLayerLookup, verifyDesignDocument } from '../engine/src/design-check.ts';
import { designForensicPages } from '../engine/src/forensic.ts';
import type { CheckFindingV1 } from '../packages/core/src/check-v1.ts';

const SCHEMA = JSON.parse(readFileSync(new URL('../schemas/check-report-v1.schema.json', import.meta.url), 'utf8')) as Record<string, unknown>;
type Validator = ((d: unknown) => boolean) & { errors?: unknown };
type AjvCtor = new (opts: unknown) => { compile: (s: unknown) => Validator };
const validateReport = new (Ajv as unknown as AjvCtor)({ allErrors: true, strict: false }).compile(SCHEMA);

function assertValid(findings: CheckFindingV1[]): void {
  const n = (s: string) => findings.filter((f) => f.severity === s).length;
  const counts = { error: n('error'), warn: n('warn'), info: n('info') };
  const zero = { error: 0, warn: 0, info: 0 };
  const per = (family: string) => {
    const own = findings.filter((f) => f.family === family);
    const c = (s: string) => own.filter((f) => f.severity === s).length;
    return own.length ? { state: 'ran', error: c('error'), warn: c('warn'), info: c('info') } : { state: 'skipped', ...zero };
  };
  const refused = counts.error > 0;
  const report = {
    format: 'lolly-check', version: 1, input: { kind: 'design' },
    outcome: refused ? 'refused' : counts.warn ? 'review' : 'clean', exitCode: refused ? 4 : counts.warn ? 5 : 0, strict: false,
    families: { structure: per('structure'), render: per('render'), brand: per('brand'), verify: per('verify'), fidelity: per('fidelity') },
    summary: counts, findings, designSystem: null,
  };
  assert.equal(validateReport(JSON.parse(JSON.stringify(report))), true, JSON.stringify(validateReport.errors, null, 2));
}

test('a layer with a negative width or height is clamped in every finding box, so the report fits its schema', async () => {
  const boxes = [
    { id: 'f', kind: 'frame', name: 'One', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'neg', kind: 'text', frame: 'f', name: 'Negative', x: 100, y: 100, w: -100, h: -50, text: 'Hello', bg: '#ca3020', font: 'Other Sans' },
  ];
  const lookup = designLayerLookup(boxes);
  assert.deepEqual(lookup.get('neg')?.box, { x: 100, y: 100, width: 0, height: 0 });
  const doc = { color: { red: { $type: 'color', $value: '#CC3322' } }, font: { brand: { $type: 'fontFamily', $value: 'Example Sans' } } };
  const brand = checkBrandDesign(boxes, doc).findings.map((f) => checkFindingFromBrand(f, lookup));
  assert.ok(brand.length >= 2 && brand.every((f) => f.box?.width === 0 && f.box.height === 0));
  const house = checkFindingsFromHouseRules(
    { findings: [{ ruleId: 'x.weight', kind: 'text-weight', layerId: 'neg', message: 'Headlines use weight 500.', requirement: 'required' }], unknown: [] },
    lookup
  );
  const verify = (await verifyDesignDocument(boxes)).findings;
  assertValid([...brand, ...house, ...verify]);
});

test('an unclosed var() fallback of spaces cannot stall the Verify colour reader', () => {
  const hostile = `var(--a,${' '.repeat(50_000)}x`;
  const boxes = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'card', kind: 'box', frame: 'f', x: 100, y: 100, w: 600, h: 400, shape: 'rounded', radius: 24, bg: hostile },
    { id: 'strip', kind: 'box', frame: 'f', x: 100, y: 100, w: 600, h: 8, bg: hostile },
    { id: 'rule', kind: 'path', frame: 'f', x: 100, y: 600, w: 600, h: 2, stroke: hostile, strokeW: 4 },
  ];
  const started = performance.now();
  const built = designForensicPages(boxes);
  const took = performance.now() - started;
  assert.equal(built.pages.length, 1);
  assert.ok(took < 250, `took ${Math.round(took)} ms`);

  // A well-formed var() with a literal fallback still reads as that colour.
  const fine = designForensicPages([
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080 },
    { id: 'card', kind: 'box', frame: 'f', x: 100, y: 100, w: 600, h: 400, shape: 'rounded', radius: 24, bg: '#ffffff' },
    { id: 'strip', kind: 'box', frame: 'f', x: 100, y: 100, w: 600, h: 8, bg: 'var(--brand-accent,  #30ba78 )' },
  ]);
  assert.ok(fine.pages[0]!.shapes.some((s) => s.accent?.colour === '#30ba78'), JSON.stringify(fine.pages[0]!.shapes));
});
