// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIXTURES } from '../scripts/layout-lab/fixtures.ts';
import { prepareCandidates, validateBrief, inputKey } from '../scripts/layout-lab/candidates.ts';
import { parseRanking, promptFor, resultFor, scoreResult, summarize } from '../scripts/layout-lab/ranking.ts';
import { safeFile } from '../scripts/layout-lab/server.ts';
import { caseFromSource } from '../scripts/layout-lab/corpus.ts';
import { censusDeck } from '../engine/src/deck-census.ts';
import type { SourceDeckV1, SourceObjectV1 } from '../packages/core/src/rebrand-v1.ts';

test('every offered candidate preserves all source text and image references', () => {
  for (const { brief } of FIXTURES) {
    const before = JSON.stringify(brief);
    for (const c of prepareCandidates(brief).eligible) {
      assert.equal(c.overflow.length, 0);
      const textFor = (id: string): string => c.compiled.layers.filter(r => c.bindings[id]?.includes(String(r.id))).map(r => r.text).join('\n');
      assert.ok(textFor(`${brief.id}.title`).includes(brief.title), `${brief.id}/${c.id}: title`);
      for (const block of brief.blocks) {
        assert.ok(textFor(block.id).includes(block.heading), `${brief.id}/${c.id}: heading`);
        assert.ok(textFor(block.id).includes(block.text), `${brief.id}/${c.id}: body`);
      }
      if (brief.image) assert.ok(c.compiled.layers.some(r => r.image === brief.image!.id));
      assert.equal(new Set(c.compiled.layers.map(r => r.id)).size, c.compiled.layers.length);
    }
    assert.equal(JSON.stringify(brief), before);
  }
});

test('estimated overflow is refused before inference without dropping content', () => {
  const { eligible, rejected } = prepareCandidates(FIXTURES.find(f => f.brief.id === 'overflow')!.brief);
  assert.equal(eligible.length, 0);
  assert.ok(rejected.length > 0);
  assert.ok(rejected.every(c => c.overflow.length > 0));
});

test('model JSON must name only distinct offered options', () => {
  const candidates = prepareCandidates(FIXTURES[0]!.brief).eligible;
  assert.deepEqual(parseRanking('{"choices":[2,1]}', candidates).ids, [candidates[1]!.id, candidates[0]!.id]);
  for (const raw of ['{"choices":[0]}', '{"choices":[99]}', '{"choices":[1,1]}', '{"choices":["1"]}', '{"choices":[]}', '{"choices":[1],"action":"delete"}', '```json\n{"choices":[1]}\n```', '[]', 'null']) {
    assert.equal(parseRanking(raw, candidates).valid, false, raw);
  }
});

test('brief validation bounds context and rejects ambiguous source identities', () => {
  const brief = FIXTURES[0]!.brief;
  assert.throws(() => validateBrief({ ...brief, blocks: [...brief.blocks, brief.blocks[0]] }), /duplicate/);
  assert.throws(() => validateBrief({ ...brief, request: 'a'.repeat(601) }), /request/);
  assert.throws(() => validateBrief({ ...brief, image: { id: brief.blocks[0]!.id, description: 'photo' } }), /image/);
  assert.throws(() => validateBrief({ ...brief, blocks: Array(7).fill(brief.blocks[0]) }), /six/);
});

test('prompt has no evaluation labels and revision keys change with content and candidate order', () => {
  const fixture = FIXTURES[0]!;
  const candidates = prepareCandidates(fixture.brief).eligible;
  assert.ok(!JSON.stringify(promptFor(fixture.brief, candidates, 'json')).includes('acceptable'));
  const key = inputKey(fixture.brief, candidates);
  assert.notEqual(key, inputKey({ ...fixture.brief, request: 'Change the emphasis.' }, candidates));
  assert.notEqual(key, inputKey(fixture.brief, [...candidates].reverse()));
});

test('invalid output is a failed recommendation, never scored as a fallback success', () => {
  const fixture = FIXTURES[0]!;
  const candidates = prepareCandidates(fixture.brief).eligible;
  const result = scoreResult(resultFor(fixture.brief, candidates, 'json', { ids: fixture.acceptable, valid: false, raw: 'bad' }, { backend: 'test', loadMs: 10, inferenceMs: 20 }), fixture);
  assert.equal(result.top1, false);
  assert.equal(result.top3, false);
  assert.equal(result.fallback, false);
  assert.equal(summarize([result])[0]!.valid, 0);
  assert.equal(summarize([result])[0]!.medianMs, 20, 'invalid output still costs inference time');
});

test('local model server refuses path traversal and symlinks outside its root', () => {
  const base = mkdtempSync(path.join(tmpdir(), 'lolly-layout-lab-'));
  const outside = `${base}-outside`;
  try {
    writeFileSync(path.join(base, 'model.json'), '{}'); writeFileSync(outside, 'private');
    symlinkSync(outside, path.join(base, 'link'));
    assert.ok(safeFile(base, 'model.json'));
    assert.equal(safeFile(base, '../' + path.basename(outside)), null);
    assert.equal(safeFile(base, 'link'), null);
  } finally { rmSync(base, { recursive: true, force: true }); rmSync(outside, { force: true }); }
});

function corpusDeck(extra: SourceObjectV1[] = []): SourceDeckV1 {
  const text = (id: string, content: string, y: number, size: number): SourceObjectV1 => ({
    id, fingerprint: id, kind: 'text', origin: 'slide', fidelity: { state: 'editable' },
    box: { x: 70, y, w: 950, h: 150, rot: 0 },
    text: { paras: [{ runs: [{ text: content, sizePt: size }] }] }, ...(id === 'title' ? { placeholder: 'title' as const } : {}),
  });
  return {
    version: 1, source: { kind: 'pptx', hash: 'sha256:test', instanceId: 'test', lineageId: 'test', pageCount: 1 }, fonts: [], warnings: [], reader: { name: 'test', version: '1' },
    slides: [{ id: 'slide1', index: 0, width: 1280, height: 720, background: {}, origin: { kind: 'pptx' }, warnings: [], readingOrder: ['title', 'body'],
      objects: [text('title', 'Local recommendations', 50, 40), text('body', 'Every source word stays available for review.', 250, 24), ...extra] }],
  };
}

test('a real corpus brief retains its source text and stays unlabelled', () => {
  const deck = corpusDeck();
  const one = caseFromSource('private.pptx', '0123456789abcdef-p1', deck.slides[0]!, censusDeck(deck));
  assert.equal(one.status, 'ready');
  assert.equal(one.brief?.title, 'Local recommendations');
  assert.equal(one.brief?.blocks[0]?.text, 'Every source word stays available for review.');
  const candidates = prepareCandidates(one.brief!, one.features).eligible;
  const result = resultFor(one.brief!, candidates, 'rules', { ids: [candidates[0]!.id], valid: true, raw: '' }, { backend: 'rules', loadMs: 0, inferenceMs: 0 });
  assert.equal(summarize([result])[0]!.top1, null);
  assert.equal(summarize([result])[0]!.candidateRecall, null);
});

test('chart and table content cannot disappear into a text-only corpus brief', () => {
  for (const kind of ['chart', 'table'] as const) {
    const deck = corpusDeck([{ id: 'data', fingerprint: 'data', kind, origin: 'slide', fidelity: { state: 'editable' }, box: { x: 80, y: 430, w: 900, h: 180, rot: 0 }, text: { paras: [{ runs: [{ text: 'Data labels alone cannot represent the chart or table.' }] }] } }]);
    const one = caseFromSource('data.pptx', '0123456789abcdef-p1', deck.slides[0]!, censusDeck(deck));
    assert.equal(one.status, 'inspect');
    assert.equal(one.brief, undefined);
    assert.ok(one.readout.some(r => r.id === 'data' && !r.excluded));
  }
});

test('a flattened page with no OCR stays available for inspection but cannot be ranked', () => {
  const deck = corpusDeck();
  deck.slides[0]!.origin.flattened = true;
  const one = caseFromSource('scan.pdf', '0123456789abcdef-p1', deck.slides[0]!, censusDeck(deck));
  assert.equal(one.mode, 'ocr-needed');
  assert.equal(one.status, 'inspect');
  assert.equal(one.candidateCount, 0);
});
