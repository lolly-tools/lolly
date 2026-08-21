// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { humanizeText } from '../engine/src/humanize.ts';

test('strips leaked model-scaffolding tokens and reports the models', () => {
  const r = humanizeText('See the source oaicite here and a [span_1] token too.');
  assert.ok(!/oaicite|\[span_1\]/.test(r.text));
  const fp = r.changes.find((c) => c.kind === 'fingerprint');
  assert.ok(fp, 'expected a fingerprint change');
  assert.ok(/OpenAI/.test(fp!.label) && /Gemini/.test(fp!.label));
});

test('a structural fingerprint strip keeps the line break', () => {
  // The transcript fingerprint is co-occurrence-gated (an "Assistant:" line only
  // counts beside a "Human:" line), so the fixture carries both halves.
  const r = humanizeText('Human: the question.\nFirst line.\nAssistant: the reply text.');
  assert.ok(!/Assistant:/.test(r.text));
  assert.match(r.text, /First line\.\nthe reply text\./);
});

test('a LONE "Assistant:" line (a human credits list) is never stripped', () => {
  // The confirmed false positive the gate exists for: film credits, staff
  // rosters and org charts write "Assistant: <name>" with no Human: anywhere.
  const r = humanizeText('Director: Maria Holt\nAssistant: James Lee\nProducer: Chen Wu');
  assert.match(r.text, /Assistant: James Lee/);
});

test('removes invisible/zero-width characters but keeps emoji joiners', () => {
  const r = humanizeText('hi\u200bthere \u{1F469}\u200d\u{1F4BB} done'); // ZWSP after "hi"; ZWJ inside the emoji
  assert.ok(!/\u200b/.test(r.text), 'zero-width space removed');
  assert.ok(r.text.includes('\u200d'), 'emoji ZWJ preserved');
});

test('normalises typography to house style', () => {
  const r = humanizeText('He said \u201chello\u201d \u2014 it\u2019s fine\u2026 really.');
  assert.equal(r.text, 'He said "hello" - it\'s fine... really.');
});

test('keeps a numeric en-dash range, tidies a word en-dash', () => {
  const r = humanizeText('pages 3\u20135 of the book \u2013 the good part');
  assert.match(r.text, /pages 3–5/);      // numeric range preserved
  assert.match(r.text, /book - the good/); // word en-dash tidied
});

test('is idempotent: clean text is returned unchanged with no changes', () => {
  const clean = 'A perfectly ordinary sentence with straight quotes and a hyphen - like this.';
  const r = humanizeText(clean);
  assert.equal(r.text, clean);
  assert.equal(r.changes.length, 0);
});

test('collapses the double spaces a strip can leave behind', () => {
  const r = humanizeText('a  b   c');
  assert.equal(r.text, 'a b c');
});
