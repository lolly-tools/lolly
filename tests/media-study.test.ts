// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  type CostEntry,
  costSummary,
  type StudyLedger,
  unknownCosts,
} from '../scripts/media-study/records.ts';
import {
  captions,
  corpus,
  designBoxes,
  musicQuery,
  webVtt,
} from '../scripts/media-study/specimens.ts';
import { musicStateParams, parseMusicState } from '../shells/web/src/lib/music-state.ts';

function ledger(): StudyLedger {
  const at = '2026-11-15T12:00:00Z';
  return {
    version: 1,
    runId: 'test',
    startedAt: at,
    environment: {},
    decisions: [],
    publications: [],
    costs: [],
    attempts: [
      {
        id: 'a1',
        editionId: 'e1',
        outputId: 'video',
        operation: 'render',
        startedAt: at,
        endedAt: at,
        elapsedMs: 1000,
        condition: 'warm',
        outcome: 'failed',
        findings: ['encoder'],
        artifacts: [],
      },
      {
        id: 'a2',
        editionId: 'e1',
        outputId: 'video',
        operation: 'render',
        startedAt: at,
        endedAt: at,
        elapsedMs: 1000,
        condition: 'warm',
        outcome: 'succeeded',
        findings: [],
        artifacts: [{ path: 'video.webm', sha256: 'a'.repeat(64), bytes: 100 }],
      },
    ],
  };
}
const cost = (id: string, attemptId: string, extras: Partial<CostEntry> = {}): CostEntry => ({
  id,
  attemptId,
  category: 'compute',
  phase: 'production',
  basis: 'cash',
  certainty: 'actual',
  currency: 'GBP',
  tax: 'net',
  quantity: 2,
  unit: 'minute',
  unitRate: 0.5,
  note: 'test charge',
  ...extras,
});

test('failed attempts stay in cost; rendering does not imply review or publication', () => {
  const l = ledger();
  l.costs = [cost('c1', 'a1'), cost('c2', 'a2')];
  let s = costSummary(l);
  assert.equal(s.groups[0]?.production, 2);
  assert.equal(s.approvedAssets, 0);
  assert.equal(s.publishedEditions, 0);
  assert.equal(s.groups[0]?.knownProductionPerApproved, null);
  l.decisions.push({
    outputId: 'video',
    artifactSha256: 'a'.repeat(64),
    state: 'approved',
    reviewer: 'editor',
    at: l.startedAt,
    evidence: 'review.json',
  });
  s = costSummary(l);
  assert.equal(s.groups[0]?.knownProductionPerApproved, 2);
  l.decisions.push({
    outputId: 'video',
    artifactSha256: 'a'.repeat(64),
    state: 'rejected',
    reviewer: 'editor',
    at: l.startedAt,
    evidence: 'correction.json',
  });
  assert.equal(costSummary(l).approvedAssets, 0);
});
test('actual, assumed, currencies, tax and allocations stay separate', () => {
  const l = ledger();
  l.costs = [
    cost('a', 'a1'),
    cost('b', 'a1', { currency: 'USD' }),
    cost('c', 'a1', { certainty: 'assumed' }),
    cost('d', 'a2', { basis: 'allocation' }),
    cost('e', 'a2', { tax: 'gross' }),
  ];
  assert.equal(costSummary(l).groups.length, 5);
});
test('unknown labour is not zero and setup does not inflate recurring production', () => {
  const l = ledger();
  l.costs = [
    ...unknownCosts(l.attempts[0]!),
    cost('setup', 'a2', { phase: 'setup', quantity: 100 }),
    cost('ad', 'a2', { category: 'promotion' }),
  ];
  const s = costSummary(l, [10]);
  assert.equal(s.groups[0]?.missing.length, 2);
  assert.equal(l.costs[0]?.quantity, null);
  assert.equal(s.groups[1]?.production, 0);
  assert.deepEqual(s.groups[1]?.setupPerEdition, [{ editions: 10, amount: 5 }]);
  assert.equal(s.groups[1]?.promotion, 1);
});
test('duplicate costs, orphan attempts, invalid quantities and zero horizons fail visibly', () => {
  const l = ledger();
  l.costs = [cost('one', 'a1'), cost('one', 'a1')];
  assert.throws(() => costSummary(l), /Duplicate/);
  l.costs = [cost('one', 'missing')];
  assert.throws(() => costSummary(l), /Unknown/);
  l.costs = [cost('one', 'a1', { quantity: -2 })];
  assert.throws(() => costSummary(l), /nonnegative/);
  l.costs = [];
  assert.throws(() => costSummary(l, [0]), /positive/);
  assert.deepEqual(costSummary(l).uncostedAttempts, ['a1', 'a2']);
});

test('approval is tied to retained bytes and cannot attach to a different revision', () => {
  const l = ledger();
  l.decisions.push({
    outputId: 'video',
    artifactSha256: 'b'.repeat(64),
    state: 'approved',
    reviewer: 'editor',
    at: l.startedAt,
    evidence: 'review.json',
  });
  assert.throws(() => costSummary(l), /exact successful artifact/);
  l.decisions = [];
  l.publications.push({
    editionId: 'missing',
    artifactSha256: ['a'.repeat(64)],
    state: 'published',
    destination: 'test account',
    observedAt: l.startedAt,
    evidence: 'receipt.json',
  });
  assert.throws(() => costSummary(l), /exact artifacts/);
});

test('all nine candidate recipes retain every authored setting and reuse their seed on retry', () => {
  const seeds = new Set<number>();
  for (const story of corpus.stories)
    for (const mode of corpus.modes) {
      const query = musicQuery(story, mode);
      const state = parseMusicState(query);
      const written = new URLSearchParams(musicStateParams(state));
      for (const [key, value] of new URLSearchParams(query))
        assert.equal(written.get(key), value, `${story.id}/${mode.id}: ${key}`);
      assert.equal(query, musicQuery(story, mode));
      assert.equal(state.tag, 'off');
      seeds.add(state.seed);
    }
  assert.equal(seeds.size, 9);
});

test('captions preserve measured sentence timing and reject missing timing', () => {
  const words = [{ text: 'A complete sentence.', start: 0.25, end: 3.75 }];
  assert.deepEqual(captions(words, 'sentence'), words);
  assert.match(webVtt(words, 0.5), /00:00:00.750 --> 00:00:04.250/);
  assert.throws(() => captions([], 'none'), /no timing/);
  assert.throws(() => captions([{ text: 'bad', start: 1, end: 0 }], 'word'), /invalid/);
  assert.deepEqual(
    captions(
      [
        { text: 'One', start: 0, end: 1 },
        { text: 'two', start: 1.2, end: 2 },
      ],
      'word'
    ),
    [{ text: 'One two', start: 0, end: 2 }]
  );
});

test('sound comparisons keep the visual and factual core fixed across modes', () => {
  const colours = {
    primary: '#033633',
    secondary: '#008657',
    surface: '#ffffff',
    text: '#09141a',
    muted: '#373e44',
  };
  const story = corpus.stories.find((s) => s.id === 'sound')!;
  const first = designBoxes(story, corpus.modes[0]!, colours);
  for (const mode of corpus.modes) assert.deepEqual(designBoxes(story, mode, colours), first);
});
