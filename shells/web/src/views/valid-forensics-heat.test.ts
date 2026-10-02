// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { forensicReport, type ForensicReport } from '../../../../engine/src/forensic.ts';
import {
  DEFAULT_LAYERS,
  heatReaderHtml,
  inspectorHtml,
  modelLevel,
  regionHeatHtml,
  stepSegment,
} from './valid-forensics-heat.ts';

const text =
  'Plain opening line. <script>alert(1)</script> sits here.\nStrengths:\nWe delve into the tapestry of ideas. Closing words.';

async function report(): Promise<ForensicReport> {
  const page = { id: '1', width: 400, height: 200, text, complete: true, source: 'digital' as const, lines: [], shapes: [] };
  const base = await forensicReport(new Uint8Array([1]), [page], [], [
    { page: '1', model: 'm', version: 'v', windows: [], complete: true, rawMean: 0.4, threshold: 0.75, chunks: [{ index: 0, length: text.length, rawScore: 0.95 }], chunkThreshold: 0.9, chunkVersion: 'c' },
  ]);
  const delve = text.indexOf('delve');
  return {
    ...base,
    findings: [
      { id: 'v', rule: 'ai-vocabulary', family: 'ai-vocabulary', version: 'x', modality: 'text', label: 'AI-favoured <vocabulary>', detail: '', method: 'original-text', confidence: 0.8, confidenceBasis: 'heuristic', contribution: 'weak-clue', alternatives: [], measurements: {}, locations: [{ page: '1', span: { index: delve, length: 5 } }, { page: '1', span: { index: text.indexOf('tapestry'), length: 8 } }] },
      { id: 'q', rule: 'ai-phrasing', family: 'ai-phrasing', version: 'x', modality: 'text', label: 'Quoted phrase', detail: '', method: 'original-text', confidence: 1, confidenceBasis: 'heuristic', contribution: 'context-excluded', alternatives: [], measurements: {}, locations: [{ page: '1', span: { index: delve, length: 14 } }] },
      { id: 'card', rule: 'fingernail-card', family: 'fingernail-card', version: 'x', modality: 'layout', label: 'Card', detail: '', method: 'source-geometry', confidence: 1, confidenceBasis: 'observed', contribution: 'weak-clue', alternatives: [], measurements: {}, locations: [{ page: '1', box: { x: 40, y: 20, width: 100, height: 50 } }] },
    ],
  };
}

const dom = (html: string) => new JSDOM(`<body>${html}</body>`).window.document.body;

test('the reader escapes the text, keeps it whole and marks matched words by guidance', async () => {
  const r = await report();
  const html = heatReaderHtml(r, r.pages[0]!, { selected: 'v', layers: DEFAULT_LAYERS });
  const body = dom(html);
  assert.equal(body.querySelector('script'), null);
  assert.equal(body.querySelector('.fh-text')!.textContent, text, 'text survives byte for byte');
  assert.equal(body.querySelector('.fh-reader')!.getAttribute('data-layers'), 'heat marks model');
  const marks = [...body.querySelectorAll('.fh-mark')].map((m) => [m.textContent, m.className]);
  // The first word is covered by a clue and an excluded match, and the clue wins.
  assert.deepEqual(marks, [
    ['delve', 'fh-mark fh-mark--clue is-selected'],
    [' into the', 'fh-mark fh-mark--context'],
    ['tapestry', 'fh-mark fh-mark--clue is-selected'],
  ]);
  assert.ok(body.querySelector('.fh-mark')!.getAttribute('title')!.includes('AI-favoured <vocabulary>'));
});

test('every sentence the classifier read is openable, and only those or lit ones', async () => {
  const r = await report();
  const quiet = { ...r, models: [] };
  const segments = (rep: ForensicReport) =>
    [...dom(heatReaderHtml(rep, rep.pages[0]!, { selected: '', layers: DEFAULT_LAYERS })).querySelectorAll('.fh-text .fh-seg')].map((s) => s.getAttribute('role') === 'button');
  assert.deepEqual(segments(quiet), [false, false, false, true, false]);
  assert.deepEqual(segments(r), [true, true, true, true, true]);
  assert.equal(
    dom(heatReaderHtml(r, r.pages[0]!, { selected: '', layers: { ...DEFAULT_LAYERS, model: false } })).querySelector('.fh-reader')!.getAttribute('data-layers'),
    'heat marks'
  );
  assert.equal(stepSegment(quiet, '1', 3, 1), 3, 'no later lit sentence: stay');
  assert.equal(stepSegment(r, '1', 3, -1), 2);
});

test('the inspector names each signal, its guidance level and the raw chunk score', async () => {
  const r = await report();
  const card = dom(inspectorHtml(r, r.pages[0]!, { kind: 'segment', index: 3 }));
  const rows = [...card.querySelectorAll('.fh-signals li')].map((li) => [li.querySelector('.fh-chip')!.textContent, li.querySelector('strong')!.textContent]);
  assert.deepEqual(rows, [['Style clue', 'AI-favoured <vocabulary>'], ['Excluded: quoted or discussed', 'Quoted phrase']]);
  assert.match(card.textContent!, /0\.95/);
  assert.match(card.querySelector('.fh-gauge')!.getAttribute('aria-label')!, /not a probability/);
  assert.equal(inspectorHtml(r, r.pages[0]!, { kind: 'segment', index: 99 }), '');
  const region = dom(inspectorHtml(r, r.pages[0]!, { kind: 'region', index: 0 }));
  assert.deepEqual([...region.querySelectorAll('.fh-signals strong')].map((s) => s.textContent), ['Card']);
});

test('regions are placed in page percentages and carry their heat', async () => {
  const r = await report();
  const button = dom(regionHeatHtml(r, r.pages[0]!, { kind: 'region', index: 0 })).querySelector('button')!;
  assert.equal(button.getAttribute('style'), 'left:10%;top:10%;width:25%;height:25%;--heat:0.600');
  assert.ok(button.classList.contains('is-inspected'));
  assert.equal(regionHeatHtml(r, { ...r.pages[0]!, width: 0 }, undefined), '');
});

test('the classifier layer draws from the measured floor up to the chunk threshold', () => {
  assert.equal(modelLevel(undefined, 0.93, 0.85), 0);
  assert.equal(modelLevel(0.84, 0.93, 0.85), 0, 'scores common on human text are not drawn');
  assert.equal(modelLevel(0.85, 0.93, 0.85), 0);
  assert.ok(Math.abs(modelLevel(0.89, 0.93, 0.85) - 0.5) < 1e-9);
  assert.equal(modelLevel(0.97, 0.93, 0.85), 1);
  assert.equal(modelLevel(0.97, 0.8, 0.85), 0, 'a threshold under the floor draws nothing');
});
