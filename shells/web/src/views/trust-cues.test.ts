// SPDX-License-Identifier: MPL-2.0
// The illumination models (plans/136): lamp cues + the completeness receipt.
// Pure fixtures in, states out - the grammar's promises pinned: C2PA leads,
// warnings out-rank, unlit is never a failure, and the receipt's impossible
// checks always name their why.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyLampCues } from './valid-text.ts';
import type { VerifyReport } from './valid-verdict.ts';
import { verifyReceiptModel, receiptCounts } from './valid-receipt.ts';
import { stripAriaSummary } from './trust-lamps.ts';

const report = (over: Partial<VerifyReport>): VerifyReport => ({
  found: false, state: 'none', trusted: false, madeWithLolly: false,
  likelyMadeWithLolly: false, partsMadeWithLolly: false, delivered: false,
  format: 'png', checks: [],
  ...over,
} as VerifyReport);

test('a bare file: every lamp unlit, and unlit words never accuse', () => {
  const cues = verifyLampCues({ report: report({}) });
  assert.deepEqual(cues.map((c) => c.state), ['unlit', 'unlit', 'unlit', 'unlit']);
  assert.equal(cues[0]!.id, 'provenance', 'C2PA leads the strip');
  for (const c of cues) assert.doesNotMatch(c.word, /fail|invalid|bad/i);
});

test('a trusted credential lights provenance and integrity as facts', () => {
  const cues = verifyLampCues({ report: report({ found: true, state: 'valid', trusted: true }) });
  assert.equal(cues[0]!.state, 'fact');
  assert.equal(cues[1]!.state, 'fact');
});

test('a hash failure is a warning on integrity, never softened', () => {
  const cues = verifyLampCues({
    report: report({ found: true, state: 'invalid', checks: [{ code: 'assertion.dataHash.mismatch', ok: false, label: '', explanation: '' } as VerifyReport['checks'][number]] }),
  });
  assert.equal(cues[0]!.state, 'warn');
  assert.equal(cues[1]!.state, 'warn');
});

test('an AI declaration is a FACT (disclosure working), not a warning', () => {
  const cues = verifyLampCues({ report: report({ aiGenerated: { kind: 'generated', sourceType: 'x' } }) });
  assert.equal(cues[2]!.state, 'fact');
  assert.equal(cues[2]!.word, 'AI declared');
});

test('severe hidden characters make the signals lamp a warning', () => {
  const cues = verifyLampCues({
    report: report({}),
    panel: {
      band: 'weak', score: 20, tone: 'info', summary: '', pixelSourced: false, docKind: 'prose',
      rows: [], marks: [],
      facts: { words: 60, sentences: 4, paragraphs: 1, bulletLines: 0, hidden: [{ name: 'RLO', count: 1, severity: 'severe' }], scripts: [], punctuation: { emDash: 0, curlyQuotes: 0, ellipsisChar: 0 }, linkHosts: [], lineEndings: { lf: 0, crlf: 0 }, bom: false },
    },
  });
  assert.equal(cues[3]!.state, 'warn');
});

test('the aria summary counts warnings first', () => {
  const cues = verifyLampCues({ report: report({ found: true, state: 'invalid', checks: [{ code: 'assertion.dataHash.mismatch', ok: false, label: '', explanation: '' } as VerifyReport['checks'][number]] }) });
  assert.match(stripAriaSummary(cues.map((c) => ({ id: c.id, label: c.label, state: c.state, word: c.word }))), /^2 warnings\./);
});

test('the receipt: blocked and n/a checks always carry a why', () => {
  const rows = verifyReceiptModel({
    imprintScannable: false, sealScanned: true, textAnalysed: true, pixelSourced: true,
    textReadable: true, ocrReady: false, rewordReady: false, detectorStaged: false,
  });
  for (const r of rows) {
    if (r.status !== 'ran') assert.ok(r.why, `${r.name} must say why it did not run`);
  }
  const synth = rows.find((r) => /SynthID/.test(r.name));
  assert.equal(synth?.status, 'blocked');
  const c = receiptCounts(rows);
  assert.equal(c.ran + c.not, rows.length);
  assert.ok(c.ran >= 4);
});
