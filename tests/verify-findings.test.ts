// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verifyFindings, verifyRights, verifySoftware, fillFindingText, VERIFY_FINDING_IDS } from '../engine/src/verify-findings.ts';
import type { VerifyFindingsReport } from '../engine/src/verify-findings.ts';
import type { FileMetadata } from '../engine/src/file-metadata.ts';

const none: VerifyFindingsReport = { found: false, state: 'none', trusted: false, madeWithLolly: false, likelyMadeWithLolly: false, partsMadeWithLolly: false, checks: [] };
const signed = (extra: Partial<VerifyFindingsReport> = {}): VerifyFindingsReport => ({
  ...none, found: true, state: 'valid', checks: [{ code: 'assertion.dataHash.match', ok: true }], ...extra,
});
const meta = (fields: FileMetadata['fields'], extra: Partial<FileMetadata> = {}): FileMetadata => ({ format: 'JPEG', fields, ...extra });
const by = (list: ReturnType<typeof verifyFindings>, id: string) => list.find((f) => f.id === id)!;

test('every slot is returned, in the fixed order, for a file with nothing in it', () => {
  const list = verifyFindings({ report: none, meta: meta([]) });
  assert.deepEqual(list.map((f) => f.id), [...VERIFY_FINDING_IDS]);
  assert.deepEqual(list.map((f) => f.state), ['none', 'unknown', 'nothing-declared', 'none', 'none', 'none']);
  assert.ok(list.every((f) => f.tone === 'quiet'));
});

test('a credential whose hash failed reads as changed, and never as signed', () => {
  const report = signed({ state: 'invalid', checks: [{ code: 'assertion.dataHash.mismatch', ok: false }], aiGenerated: { kind: 'generated' } });
  const list = verifyFindings({ report });
  assert.equal(by(list, 'credential').state, 'changed');
  assert.equal(by(list, 'ai').state, 'declared-unverified');
  assert.equal(by(list, 'ai').strength, 'unverified');
});

test('made with Lolly leads the names and carries the tool', () => {
  const report = signed({ madeWithLolly: true, trusted: true, environment: { tool: 'QR Code' }, claim: { generatorInfo: { name: 'Lolly', version: '1.2.2' } } });
  const made = by(verifyFindings({ report }), 'made-with');
  assert.equal(made.state, 'lolly');
  assert.equal(made.names[0], 'Lolly');
  assert.equal(fillFindingText(made.detail, made.vars), 'Made with Lolly, in QR Code.');
});

test('AI declared in metadata is stated, and the text analysis alone is estimated', () => {
  const stated = by(verifyFindings({ report: none, meta: meta([], { ai: { kind: 'generated', sourceType: 'trainedAlgorithmicMedia', credit: 'Made with Google AI' } }) }), 'ai');
  assert.equal(stated.state, 'declared-metadata');
  assert.equal(stated.strength, 'stated');
  assert.ok(stated.evidence.some((e) => e.value === 'SynthID likely' && e.strength === 'hint'));
  const text = by(verifyFindings({ report: none, text: { band: 'notable', signals: 7, artifacts: 0, invisible: 0 } }), 'ai');
  assert.equal(text.state, 'text-signals');
  assert.equal(text.strength, 'estimated');
  const clean = by(verifyFindings({ report: none, text: { band: 'none', signals: 0, artifacts: 0, invisible: 0 } }), 'ai');
  assert.equal(clean.state, 'nothing-found');
});

test('a Creative Commons address becomes the licence name, and two known licences disagree', () => {
  const one = meta([{ label: 'xmpRights:WebStatement', value: 'https://creativecommons.org/licenses/by/4.0/', group: 'authorship' }]);
  const rights = verifyRights(none, one);
  assert.equal(rights.length, 1);
  assert.equal(rights[0]!.id, 'CC-BY-4.0');
  assert.equal(by(verifyFindings({ report: none, meta: one }), 'licence').state, 'licence');
  const two = meta([...one.fields, { label: 'License', value: 'MIT', group: 'authorship' }]);
  const conflict = by(verifyFindings({ report: none, meta: two }), 'licence');
  assert.equal(conflict.state, 'conflict');
  assert.equal(conflict.tone, 'warn');
});

test('licence wording never claims clearance', () => {
  const all = verifyFindings({ report: signed({ rights: 'CC-BY-4.0' }) });
  for (const f of all) assert.doesNotMatch(`${f.word} ${f.detail}`, /cleared|legally safe|copyright verified/i);
});

test('a location and a hidden payload each raise their own slot', () => {
  const m = meta([{ label: 'Coordinates', value: '-27.47, 153.02', group: 'location', sensitive: true }], { gps: { lat: -27.47, lon: 153.02 }, lsb: { suspicious: true, score: 0.9 } });
  const list = verifyFindings({ report: none, meta: m });
  assert.equal(by(list, 'personal').state, 'location');
  assert.equal(by(list, 'hidden').state, 'found');
});

test('software names keep the strength of the evidence that named them', () => {
  const m = meta([{ label: 'Software', value: 'Adobe Photoshop 25.0', group: 'software' }, { label: 'Camera', value: 'iPhone 16 Pro', group: 'device' }]);
  const list = verifySoftware(none, m);
  assert.ok(list.some((s) => /Photoshop/.test(s.name) && s.strength === 'stated'));
  assert.ok(list.some((s) => s.role === 'device' && s.name === 'iPhone 16 Pro'));
});
