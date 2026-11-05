// SPDX-License-Identifier: MPL-2.0
/**
 * Baseline of Lolly's speech text preparation against the cases filmcraft's tts-text normaliser is tested with
 * (plan 342 O6): cardinals, ordinals, money, dates, times and acronyms. The fixtures are in
 * tests/fixtures/speech-text-normaliser.json: each has the input, the spoken form filmcraft expects, and what
 * Lolly's normalizeForSpeech does today.
 *
 * Read the result as a gap list, not as a failure list. normalizeForSpeech is the text half of a pipeline whose second
 * half is the eSpeak phonemizer, which reads numerals itself, so a case marked "gap" often means "left for the
 * phonemizer" rather than "wrong". That second half is not run here, so the numeral reading is unmeasured. Cases with a
 * `misread` note are the ones where the text stage itself produces wrong content.
 *
 * The test pins each case to its recorded status. A handled case that regresses fails. A gap that starts to be handled
 * also fails, so the fixture file is updated and the gap list shrinks on purpose. No filmcraft normaliser or
 * letter-to-sound code is used.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizeForSpeech } from '../engine/src/speech-text.ts';

interface Case { id: string; category: string; lang: string; input: string; spoken: string; observed: string; lolly: 'handled' | 'gap'; misread?: string }
const doc = JSON.parse(readFileSync(new URL('./fixtures/speech-text-normaliser.json', import.meta.url), 'utf8')) as { cases: Case[] };
const comp = (s: string): string => s.toLowerCase().replace(/-/g, ' ').replace(/[^a-z0-9' ]/g, '').split(/\s+/).filter(Boolean).join(' ');

test('fixtures cover the six categories and carry the recorded baseline', () => {
  const cats = new Set(doc.cases.map(c => c.category));
  for (const need of ['cardinals', 'ordinals', 'money', 'dates', 'times', 'acronyms']) assert.ok(cats.has(need), need);
  assert.equal(new Set(doc.cases.map(c => c.id)).size, doc.cases.length, 'case ids are unique');
});

for (const c of doc.cases) {
  test(`${c.id} ${c.lolly === 'gap' ? 'KNOWN GAP ' : ''}${JSON.stringify(c.input)}`, () => {
    const out = normalizeForSpeech(c.input);
    assert.equal(out, c.observed, 'the recorded output changed: re-run the baseline and review the diff');
    const handled = comp(out) === comp(c.spoken);
    if (c.lolly === 'handled') assert.ok(handled, `${c.input} -> ${out}, expected ${c.spoken}`);
    else assert.ok(!handled, `${c.id} is now handled: mark it "handled" in the fixture file`);
  });
}

test('baseline summary by category', t => {
  const rows: Record<string, { handled: number; gap: number; misread: number }> = {};
  for (const c of doc.cases) {
    rows[c.category] ??= { handled: 0, gap: 0, misread: 0 };
    const r = rows[c.category]!;
    r[c.lolly]++; if (c.misread) r.misread++;
  }
  t.diagnostic(JSON.stringify(rows));
  assert.ok(Object.values(rows).every(r => r.handled + r.gap > 0));
});
