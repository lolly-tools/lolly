// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  forensicSegments,
  forensicChunkSpans,
  forensicChunkScores,
  forensicHeat,
  forensicReport,
  verifyForensicReport,
  FORENSIC_GUIDANCE_WEIGHT,
  FORENSIC_VERSION,
} from '../engine/src/forensic.ts';
import type { ForensicFinding, ForensicPage, ForensicReport } from '../engine/src/forensic.ts';

const page = (text: string, extra: Partial<ForensicPage> = {}): ForensicPage => ({
  id: '1',
  width: 600,
  height: 400,
  text,
  complete: true,
  source: 'digital',
  lines: [],
  shapes: [],
  ...extra,
});
const slice = (text: string, s: { index: number; length: number }) =>
  text.slice(s.index, s.index + s.length);

test('segments keep exact offsets, skip indentation and keep headings as lines', () => {
  const text =
    'Based on e.g. the 2.5 release, Dr. Smith agreed. It shipped!\n Strengths:\n\n Deep Expertise: They focus on platforms. U.S. buyers like it.';
  const segments = forensicSegments(text);
  assert.deepEqual(
    segments.map((s) => [s.kind, slice(text, s)]),
    [
      ['sentence', 'Based on e.g. the 2.5 release, Dr. Smith agreed.'],
      ['sentence', 'It shipped!'],
      ['line', 'Strengths:'],
      ['sentence', 'Deep Expertise: They focus on platforms.'],
      ['sentence', 'U.S. buyers like it.'],
    ]
  );
  assert.ok(segments.every((s) => !/^\s|\s$/.test(slice(text, s))));
});

test('classifier chunks follow sentences, clear the word floor and fold a short tail', () => {
  const sentence = (n: number) => `${Array.from({ length: n }, (_, i) => (i ? 'word' : 'Word')).join(' ')}.`;
  const text = [sentence(30), sentence(30), sentence(30), sentence(30), sentence(10)].join(' ');
  const chunks = forensicChunkSpans(text);
  assert.equal(chunks.length, 2);
  assert.equal(chunks[0]!.index, 0);
  assert.equal(slice(text, chunks.at(-1)!).endsWith(sentence(10)), true, 'tail folded in');
  for (const c of chunks) assert.ok(slice(text, c).split(/\s+/).length >= 55);
  assert.deepEqual(forensicChunkSpans(sentence(40)), [], 'under the 50-word floor: no chunk');
  const long = Array.from({ length: 200 }, () => sentence(60)).join(' ');
  assert.equal(forensicChunkSpans(long).length, 64, 'capped');
});

test('chunk scores keep offsets, clamp scores and stop on cancel', async () => {
  const text = Array.from({ length: 3 }, () => `Alpha ${'beta '.repeat(58)}omega.`).join(' ');
  const seen: string[] = [];
  const chunks = await forensicChunkScores(text, async (chunk) => {
    seen.push(chunk);
    return seen.length === 2 ? null : 1.4;
  });
  assert.equal(seen.length, 3);
  assert.deepEqual(chunks.map((c) => c.rawScore), [1, 1]);
  assert.equal(slice(text, chunks[0]!), seen[0]);
  let calls = 0;
  await forensicChunkScores(text, async () => ++calls, () => calls >= 1);
  assert.equal(calls, 1);
});

const finding = (over: Partial<ForensicFinding>): ForensicFinding => ({
  id: over.id ?? 'f',
  rule: over.family ?? 'x',
  family: over.family ?? 'x',
  version: FORENSIC_VERSION,
  modality: 'text',
  label: over.label ?? 'X',
  detail: 'd',
  method: 'original-text',
  confidence: 0.5,
  confidenceBasis: 'heuristic',
  contribution: 'weak-clue',
  alternatives: [],
  locations: [],
  measurements: {},
  ...over,
});

test('heat combines distinct findings by guidance level and keeps excluded matches visible', async () => {
  const text = 'First sentence here. Second sentence here. Third one.';
  const base = await forensicReport(new Uint8Array([1]), [page(text)], []);
  const report: ForensicReport = {
    ...base,
    findings: [
      finding({ id: 'a', family: 'ai-vocabulary', confidence: 0.5, locations: [{ page: '1', span: { index: 6, length: 8 } }] }),
      finding({ id: 'b', family: 'model-fingerprint', contribution: 'specific-artifact', confidence: 0.9, locations: [{ page: '1', span: { index: 0, length: 5 } }, { page: '1', span: { index: 28, length: 8 } }] }),
      finding({ id: 'c', family: 'ai-phrasing', contribution: 'context-excluded', confidence: 1, locations: [{ page: '1', span: { index: 44, length: 5 } }] }),
      finding({ id: 'd', family: 'uniform-burstiness', locations: [{ page: '1' }] }),
      finding({ id: 'e', family: 'local-classifier', confidence: 1, locations: [{ page: '1', span: { index: 0, length: text.length } }] }),
    ],
  };
  const heat = forensicHeat(report, '1');
  const [first, second, third] = heat.segments;
  const a = 0.5 * FORENSIC_GUIDANCE_WEIGHT.clue,
    b = 0.9 * FORENSIC_GUIDANCE_WEIGHT.artifact;
  assert.ok(Math.abs(first!.heat - (1 - (1 - a) * (1 - b))) < 1e-9);
  assert.deepEqual(first!.signals.map((s) => s.finding), ['b', 'a'], 'strongest first');
  assert.ok(Math.abs(second!.heat - b) < 1e-9);
  assert.equal(third!.heat, 0, 'an excluded match adds no heat');
  assert.deepEqual(third!.signals.map((s) => [s.finding, s.guidance]), [['c', 'context']]);
  assert.deepEqual(heat.document.map((d) => d.finding).sort(), ['d', 'e'], 'whole-text signals stay off the sentences');
  assert.equal(heat.max, first!.heat);
  assert.deepEqual(first!.signals[0]!.spans, [{ index: 0, length: 5 }]);
});

test('heat carries classifier chunk scores beside the heat, never inside it', async () => {
  const text = 'One sentence here. Another sentence there.';
  const base = await forensicReport(new Uint8Array([1]), [page(text)], [], [
    {
      page: '1',
      model: 'm',
      version: 'v',
      windows: [],
      complete: true,
      rawMean: 0.5,
      threshold: 0.75,
      chunks: [{ index: 0, length: 18 }, { index: 19, length: 23 }].map((c, i) => ({ ...c, rawScore: i ? 0.95 : 0.2 })),
      chunkThreshold: 0.9,
      chunkFloor: 0.85,
      chunkVersion: 'chunk-policy/1',
    },
  ]);
  const heat = forensicHeat(base, '1');
  assert.deepEqual(heat.segments.map((s) => [s.model, s.heat]), [[0.2, 0], [0.95, 0]]);
  assert.equal(heat.model?.threshold, 0.9);
  assert.equal(heat.model?.floor, 0.85);
  assert.equal(await verifyForensicReport(base, new Uint8Array([1])), true);
  const forged = structuredClone(base);
  forged.models[0]!.chunks![0]!.rawScore = 7;
  assert.equal(await verifyForensicReport(forged, new Uint8Array([1])), false);
  const floor = structuredClone(base);
  floor.models[0]!.chunkFloor = -1;
  assert.equal(await verifyForensicReport(floor, new Uint8Array([1])), false);
  const outside = structuredClone(base);
  outside.models[0]!.chunks![0]!.length = 9_999;
  assert.equal(await verifyForensicReport(outside, new Uint8Array([1])), false);
});

test('regions merge findings on the same box', async () => {
  const box = { x: 10, y: 10, width: 50, height: 20 };
  const base = await forensicReport(new Uint8Array([1]), [page('')], []);
  const report: ForensicReport = {
    ...base,
    findings: [
      finding({ id: 'a', modality: 'layout', family: 'fingernail-card', confidence: 1, locations: [{ page: '1', box }] }),
      finding({ id: 'b', family: 'ai-vocabulary', confidence: 0.5, locations: [{ page: '1', box: { ...box } }] }),
      finding({ id: 'c', family: 'eyebrow-heading', locations: [{ page: '2', box }] }),
    ],
  };
  const heat = forensicHeat(report, '1');
  assert.equal(heat.regions.length, 1);
  assert.deepEqual(heat.regions[0]!.signals.map((s) => s.finding), ['a', 'b']);
  assert.ok(Math.abs(heat.regions[0]!.heat - (1 - (1 - 0.6) * (1 - 0.3))) < 1e-9);
});
