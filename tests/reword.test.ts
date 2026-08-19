// SPDX-License-Identifier: MPL-2.0
// The pure side of on-device rewording (plans/127): the deterministic
// suggestion table, sentence-span selection, reply normalisation, and the
// candidate gate. No model anywhere near this file - canned candidates only.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  suggestRewrites, applySuggestion, rewordableSpans, buildRewordMessages,
  normalizeRewordReply, rewordGate, rewordCandidates, REWORD_SYSTEM_PROMPT,
} from '../engine/src/reword.ts';
import type { TextSignalFinding } from '../engine/src/text-signals.ts';

// ── suggestRewrites ───────────────────────────────────────────────────────────

test('swaps keep case and inflection', () => {
  const s = suggestRewrites('Utilize the tool. She utilizes it. They were utilizing it prior to launch.');
  const repl = s.map((x) => x.replacement);
  assert.ok(repl.includes('Use'), 'sentence-initial swap is capitalised');
  assert.ok(repl.includes('uses'), 'third person survives');
  assert.ok(repl.includes('using'), 'gerund survives');
  assert.ok(repl.includes('before'), 'prior to → before');
});

test('a filler opener deletion re-capitalises the sentence it leaves behind', () => {
  const text = 'It is important to note that the cat sat.';
  const s = suggestRewrites(text);
  assert.equal(s.length, 1);
  assert.equal(s[0]!.kind, 'delete');
  assert.equal(applySuggestion(text, s[0]!), 'The cat sat.');
});

test('serves-as keeps its article; connector swap keeps sentence case', () => {
  const a = suggestRewrites('This serves as an anchor.');
  assert.equal(applySuggestion('This serves as an anchor.', a[0]!), 'This is an anchor.');
  const b = suggestRewrites('Furthermore, it rained.');
  assert.equal(applySuggestion('Furthermore, it rained.', b[0]!), 'Also, it rained.');
});

test('quoted phrases are not ours to reword', () => {
  const s = suggestRewrites('The doc said "we leverage synergies" verbatim.');
  assert.equal(s.length, 0);
});

test('overlapping suggestions keep the first', () => {
  // "a wide range of" and "numerous" do not overlap; sanity-check ordering + apply chain.
  let text = 'We offer a wide range of options and numerous plans.';
  let s = suggestRewrites(text);
  assert.ok(s.length >= 2);
  assert.ok(s.every((x, i) => i === 0 || x.index >= s[i - 1]!.index + s[i - 1]!.length), 'non-overlapping, sorted');
  while (s.length) { text = applySuggestion(text, s[0]!); s = suggestRewrites(text); }
  assert.equal(text, 'We offer many options and many plans.');
});

// ── rewordableSpans ───────────────────────────────────────────────────────────

const finding = (over: Partial<TextSignalFinding>): TextSignalFinding => ({
  tier: 'heuristic', kind: 'llm-lexicon', label: 'x', weight: 1, heat: 0.5, ...over,
});

test('spans expand to sentence bounds and merge same-sentence hits', () => {
  const text = 'A calm first sentence sits here. The team will leverage robust seamless workflows today. A calm third sentence.';
  const i1 = text.indexOf('leverage');
  const i2 = text.indexOf('seamless');
  const spans = rewordableSpans(text, [
    finding({ spans: [{ index: i1, length: 8 }] }),
    finding({ spans: [{ index: i2, length: 8 }], heat: 0.4 }),
  ]);
  assert.equal(spans.length, 1, 'same sentence merged');
  const slice = text.slice(spans[0]!.index, spans[0]!.index + spans[0]!.length);
  assert.equal(slice, 'The team will leverage robust seamless workflows today.');
  assert.ok(Math.abs(spans[0]!.heat - 0.9) < 1e-9, 'heats summed');
});

test('fingerprint (artifact tier) and ai-span findings never queue a span; caps hold', () => {
  const text = `${'This sentence right here is long enough to clear the floor. '.repeat(20)}`;
  const mk = (kind: string, tier: 'artifact' | 'heuristic', at: number): TextSignalFinding =>
    finding({ kind, tier, spans: [{ index: at, length: 4 }] });
  const none = rewordableSpans(text, [mk('model-fingerprint', 'artifact', 5), mk('ai-span', 'heuristic', 5)]);
  assert.equal(none.length, 0);
  const many = rewordableSpans(
    text,
    Array.from({ length: 20 }, (_, i) => mk('llm-lexicon', 'heuristic', i * 61 + 5)),
  );
  assert.ok(many.length <= 12, `capped, got ${many.length}`);
  assert.ok(many.every((s, i) => i === 0 || s.index > many[i - 1]!.index), 'document order');
});

test('a decimal never splits its sentence', () => {
  const text = 'Version 3.5 will leverage robust tooling across the board for everyone.';
  const spans = rewordableSpans(text, [finding({ spans: [{ index: text.indexOf('leverage'), length: 8 }] })]);
  assert.equal(spans.length, 1);
  assert.equal(spans[0]!.index, 0, 'sentence start is the text start, not after "3."');
});

// ── prompt + reply normalisation ──────────────────────────────────────────────

test('buildRewordMessages wraps the shared system prompt', () => {
  const m = buildRewordMessages('  A sentence.  ');
  assert.equal(m[0]!.role, 'system');
  assert.equal(m[0]!.content, REWORD_SYSTEM_PROMPT);
  assert.equal(m[1]!.content, 'A sentence.');
});

test('normalizeRewordReply strips labels, wrapping quotes, and trailing chatter', () => {
  assert.equal(normalizeRewordReply('Rewritten: "The cat sat."\nHope this helps!'), 'The cat sat.');
  assert.equal(normalizeRewordReply('“Plain words win.”'), 'Plain words win.');
  assert.equal(normalizeRewordReply('\n\nShorter version - Keep it simple.\n'), 'Keep it simple.');
  assert.equal(normalizeRewordReply('   '), '');
});

// ── the gate ──────────────────────────────────────────────────────────────────

const ORIGINAL = 'The team at SUSE will leverage 3 robust new tools to fundamentally transform how we deliver value at https://suse.com today.';

test('gate refuses the original back, and anything longer', () => {
  assert.deepEqual(rewordGate(ORIGINAL, `  ${ORIGINAL}  `).reasons, ['unchanged']);
  const longer = rewordGate(ORIGINAL, `${ORIGINAL} It also does much more than that.`);
  assert.ok(longer.reasons.includes('longer'));
});

test('gate refuses dropped or invented facts', () => {
  const dropNumber = rewordGate(ORIGINAL, 'The team at SUSE will use robust new tools to change delivery at https://suse.com today.');
  assert.ok(dropNumber.reasons.includes('facts-changed'), 'dropped the 3');
  const wrongUrl = rewordGate(ORIGINAL, 'The team at SUSE will use 3 new tools to change delivery at https://example.com today.');
  assert.ok(wrongUrl.reasons.includes('facts-changed'), 'swapped the link');
});

test('gate refuses dropped or invented names', () => {
  const dropName = rewordGate(ORIGINAL, 'The team will use 3 new tools to change how we deliver at https://suse.com today.');
  assert.ok(dropName.reasons.includes('names-changed'), 'SUSE vanished');
  const newName = rewordGate(ORIGINAL, 'The SUSE team and Oracle will use 3 tools at https://suse.com today.');
  assert.ok(newName.reasons.includes('names-changed'), 'Oracle appeared');
});

test('gate refuses degenerate replies: off-topic and collapsed-to-nothing', () => {
  const offTopic = rewordGate(ORIGINAL, "That's your sentence, rewritten as requested.");
  assert.ok(offTopic.reasons.includes('off-topic'), `got ${offTopic.reasons.join()}`);
  const tiny = rewordGate(ORIGINAL, 'The team wins.');
  assert.ok(tiny.reasons.includes('too-short'), `got ${tiny.reasons.join()}`);
});

test('a capital starting a SECOND sentence is sentence case, not an invented name', () => {
  const orig = 'The team said the robust workflow helps everyone move faster every day of the week.';
  const v = rewordGate(orig, 'The team said the workflow helps. It moves everyone faster every day.');
  assert.ok(!v.reasons.includes('names-changed'), `got ${v.reasons.join()}`);
});

test('gate refuses a candidate carrying an artifact tell', () => {
  const v = rewordGate(ORIGINAL, 'The SUSE team will use 3 new tools at https://suse.com ​today.');
  assert.ok(v.reasons.includes('artifact'), `got ${v.reasons.join()}`);
});

test('a genuinely shorter, plainer candidate passes', () => {
  const v = rewordGate(ORIGINAL, 'The SUSE team will use 3 new tools to change how we deliver at https://suse.com today.');
  assert.deepEqual(v.reasons, []);
  assert.ok(v.ok);
});

test('rewordCandidates runs the whole pipeline: normalise, clean, gate, dedupe, rank', () => {
  const good = 'The SUSE team will use 3 new tools to change how we deliver at https://suse.com today.';
  const out = rewordCandidates(ORIGINAL, [
    `Rewritten: “${good}”`,          // survives, via label + curly-quote cleanup
    good,                            // duplicate after squash - dropped
    ORIGINAL,                        // unchanged - refused
    'The team will use tools.',      // facts + names gone - refused
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0]!.text, good);
});
