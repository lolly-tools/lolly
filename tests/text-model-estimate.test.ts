// SPDX-License-Identifier: MPL-2.0
// applyModelEstimate (plans/126 WP-A): the on-device classifier's verdict as a
// fourth, style-capped evidence bucket. These tests pin the FP posture:
// below-threshold runs change nothing, and the model alone can never reach
// 'strong'.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeTextSignals, applyModelEstimate } from '../engine/src/text-signals.ts';
import type { AiModelEstimate } from '../engine/src/text-signals.ts';

const est = (probAi: number, threshold = 0.98): AiModelEstimate =>
  ({ probAi, threshold, modelId: 'test-model', modelName: 'Test detector' });

// Clean formal prose: long enough for every tier, no tells - band none today.
const CLEAN = `Renewable energy adoption depends on three practical factors: cost, storage, and grid capacity.
Solar and wind are now the cheapest sources of new electricity in most markets. Prices fell because manufacturing scaled up, not because of a single breakthrough. The remaining cost problem is not generation but delivery, since transmission lines take a decade to permit and build in most countries.
Storage matters because the sun and wind do not follow demand. Batteries cover hours, not weeks, so grids still need firm capacity from hydro, nuclear, or gas for long stretches of bad weather. Some countries solve this with interconnects to neighbours instead.`;

test('below the operating threshold the report is returned unchanged', () => {
  const report = analyzeTextSignals(CLEAN, { source: 'digital' });
  const out = applyModelEstimate(report, est(0.9));
  assert.deepEqual(out, report);
});

test('a conclusive estimate adds the row and moves band/score together', () => {
  const report = analyzeTextSignals(CLEAN, { source: 'digital' });
  assert.ok(report.band === 'none' || report.band === 'weak', `fixture band ${report.band}`);
  const out = applyModelEstimate(report, est(0.999));
  const row = out.findings.find((f) => f.kind === 'model-estimate');
  assert.ok(row, 'expected the estimate finding');
  assert.equal(row!.tier, 'heuristic');
  assert.match(row!.detail ?? '', /Test detector/);
  assert.ok(out.score > report.score);
  assert.ok(out.band === 'weak' || out.band === 'notable', `band ${out.band}`);
  assert.match(out.summary, /\d+\/100/);
});

test('the model alone can never reach strong, even at certainty', () => {
  // A findings-free report is the pure "model alone" case.
  const empty = analyzeTextSignals('Short.', { source: 'digital' });
  assert.equal(empty.findings.length, 0, 'the fixture must carry no findings');
  const alone = applyModelEstimate(empty, est(1));
  assert.ok(alone.band === 'notable' || alone.band === 'weak', `band ${alone.band}`);
  // And one weak style hint on top must not tip it to strong either.
  const out = applyModelEstimate(analyzeTextSignals(CLEAN, { source: 'digital' }), est(1));
  assert.notEqual(out.band, 'strong');
});

test('the estimate stacks with real tells instead of replacing them', () => {
  const telly = `${CLEAN}\nIn today's fast-paced digital landscape, it is important to note that we must delve into a multifaceted tapestry of solutions. Furthermore, it is crucial to acknowledge that leveraging cutting-edge innovations serves as a robust foundation. In conclusion, the journey is both challenging and rewarding, showcasing seamless synergy across the evolving landscape.`;
  const base = analyzeTextSignals(telly, { source: 'digital' });
  const out = applyModelEstimate(base, est(1));
  assert.ok(out.score > base.score, 'the model bucket adds to the style evidence');
  const kinds = out.findings.map((f) => f.kind);
  assert.ok(kinds.includes('model-estimate'));
  assert.ok(kinds.some((k) => k !== 'model-estimate'), 'the original findings survive');
});

test('the original report is not mutated', () => {
  const report = analyzeTextSignals(CLEAN, { source: 'digital' });
  const findingsBefore = report.findings.length;
  applyModelEstimate(report, est(1));
  assert.equal(report.findings.length, findingsBefore);
});
