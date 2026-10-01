// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/claudisms.ts - the AI writing-tell lexicon consumed by
 * text-signals.ts (analysis) and humanize.ts (fingerprint scan).
 *
 * This file pins the contract the rest of the pipeline relies on:
 *   - MODEL_FINGERPRINTS entries are regexes that must actually match the
 *     leaked-artifact strings they document (a typo'd pattern would silently
 *     stop detecting a real fingerprint and nobody would notice at runtime).
 *   - `g` flags on every Tell/fingerprint regex, since callers (analyzer,
 *     humanize.ts) walk every span with String.matchAll/replace-loop
 *     semantics that require the global flag; a non-global regex would only
 *     find the first hit per document.
 *   - the `requires` co-occurrence gate on the transcript-scaffolding
 *     fingerprint (Assistant: alone must not convict; Human: must also
 *     appear), which is the one entry in this file with conditional logic.
 *   - FAMILY_TELLS wires each family's tells list correctly (a copy-paste
 *     swap here would misattribute every family's style lean).
 *   - LEXICON_VERSION is a positive integer, since stored analyses key off
 *     it to invalidate on lexicon changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_FINGERPRINTS,
  CLAUDE_TELLS,
  AI_WORDS,
  AI_PHRASES,
  AI_STRUCTURE,
  CHATBOT_ARTIFACTS,
  CHATBOT_SOFT,
  SPELLING_VARIANTS,
  FAMILY_TELLS,
  CHATGPT_TELLS,
  GEMINI_TELLS,
  DEEPSEEK_TELLS,
  LEXICON_VERSION,
  spatialPointerRe,
} from '../engine/src/claudisms.ts';
import { RATCHETED_PHRASES } from '../scripts/check-docs-vernacular.ts';

test('every Tell and fingerprint regex carries the global flag', () => {
  const all: RegExp[] = [
    ...MODEL_FINGERPRINTS.map(f => f.re),
    ...CLAUDE_TELLS.map(t => t.re),
    ...AI_PHRASES.map(t => t.re),
    ...AI_STRUCTURE.map(t => t.re),
    ...CHATBOT_ARTIFACTS.map(t => t.re),
    ...CHATBOT_SOFT.map(t => t.re),
    ...CHATGPT_TELLS.map(t => t.re),
    ...GEMINI_TELLS.map(t => t.re),
    ...DEEPSEEK_TELLS.map(t => t.re),
  ];
  for (const re of all) {
    assert.ok(re.global, `expected global flag on ${re}`);
  }
});

test('known leaked-artifact strings actually match their documented fingerprint', () => {
  const cases: Array<[string, string]> = [
    ['OpenAI citation token (oaicite)', 'here is a claim oaicite text'],
    ['OpenAI contentReference token', ':contentReference[oaicite:1]{index=1}'],
    ['OpenAI tool-call token', 'a claim turn0search3 more text'],
    ['ChatML scaffolding tag', 'before <|im_start|> after'],
    ['Gemini span token', 'a fact [span_12] noted'],
    ['Claude tool-scaffolding tag', 'raw output <antml:invoke>'],
  ];
  for (const [label, sample] of cases) {
    const fingerprint = MODEL_FINGERPRINTS.find(fp => fp.label === label);
    assert.ok(fingerprint, `expected a fingerprint labelled "${label}"`);
    const re = new RegExp(fingerprint!.re.source, fingerprint!.re.flags);
    assert.ok(re.test(sample), `expected "${label}" to match sample: ${sample}`);
  }
});

test('the Claude transcript fingerprint requires co-occurring Human: and Assistant:', () => {
  const scaffold = MODEL_FINGERPRINTS.find(f => f.label === 'Claude transcript scaffolding');
  assert.ok(scaffold?.requires, 'transcript scaffolding fingerprint must declare a requires gate');
  const re = new RegExp(scaffold!.re.source, scaffold!.re.flags);
  const reqRe = scaffold!.requires!;
  // The primary pattern matches "Assistant: " alone (film credits, org charts) -
  // it is the `requires` gate that turns this into a real convict/no-convict split.
  assert.ok(re.test('Assistant: here is the answer'));
  assert.equal(reqRe.test('Assistant: here is the answer'), false);
  assert.ok(reqRe.test('Human: hello\nAssistant: hi'));
});

test('word and phrase lists carry no duplicate entries', () => {
  assert.equal(new Set(AI_WORDS).size, AI_WORDS.length);
  const labels = AI_PHRASES.map(p => p.label);
  assert.equal(new Set(labels).size, labels.length);
});

test('SPELLING_VARIANTS pairs distinguish US and UK spellings and never both match the same word', () => {
  const pair = SPELLING_VARIANTS.find(p => p.label === 'color/colour')!;
  assert.ok(new RegExp(pair.us.source, pair.us.flags).test('the color scheme'));
  assert.equal(new RegExp(pair.us.source, pair.us.flags).test('the colour scheme'), false);
  assert.ok(new RegExp(pair.uk.source, pair.uk.flags).test('the colour scheme'));
  assert.equal(new RegExp(pair.uk.source, pair.uk.flags).test('the color scheme'), false);
});

test('FAMILY_TELLS wires each family to its own tells list, not a mismatched one', () => {
  const claude = FAMILY_TELLS.find(f => f.family === 'Claude');
  const chatgpt = FAMILY_TELLS.find(f => f.family === 'ChatGPT (OpenAI)');
  assert.equal(claude?.tells, CLAUDE_TELLS);
  assert.equal(chatgpt?.tells, CHATGPT_TELLS);
  assert.ok(FAMILY_TELLS.every(f => f.tells.length > 0));
});

test('LEXICON_VERSION is a positive integer consumers can key persisted analyses on', () => {
  assert.equal(Number.isInteger(LEXICON_VERSION), true);
  assert.ok(LEXICON_VERSION > 0);
});

test('the "…here," aside catches the pointer use and leaves the place senses alone', () => {
  const aside = CLAUDE_TELLS.find(t => t.label === 'the "…here," aside');
  assert.ok(aside, 'expected the "…here," aside tell');
  const hits = (s: string) => [...s.matchAll(new RegExp(aside!.re.source, aside!.re.flags))].length;
  for (const s of [
    'The risk here, though, is the export path.',
    'What matters here, then, is the fallback.',
    'The trick here, of course, is timing.',
  ]) assert.equal(hits(s), 1, `expected a hit: ${s}`);
  for (const s of [
    'Put the box over here, next to the logo.',
    'Click here, then choose Export.',
    'Come here, quickly.',
    'We have lived here, on and off, for years.',
    'Here, the layout changes.',
    'The layout is fine here.',
    // The copula flourish already scores this span; it must not count twice.
    'The export is the weak point here, clearly.',
  ]) assert.equal(hits(s), 0, `expected no hit: ${s}`);
});

// The pointer phrases, figurative (a tell) and spatial (legitimate).
const POINTER_FIGURATIVE = [
  'Each claim here has a mechanism behind it, and each mechanism ships.',
  'Every claim this site makes, with the mechanism that enforces it beside it.',
  'The page returns the answer with the source cited beside it.',
  'There is no second, richer configuration behind it.',
  'It keeps the original text next to it for reference.',
  'The decision in front of it is simple.',
  'The principle above it still applies.',
  'Everything below it follows from that choice.',
  'The people behind it wrote the first release.',
];
const POINTER_SPATIAL = [
  'The colours sit in a strip, with a **Use as primary** button beside it.',
  'The controls sit beside the preview, or above it on a phone.',
  'Moving the camera redraws the frame and the backdrop behind it.',
  'The rings are painted on a layer above it.',
  'A **Search settings** field above it filters the list.',
  'Press the camera beside it to record a video.',
  'The guard runs before the loop below it.',
];

test('the "beside it" pointer scores the figurative use and skips spatial writing', () => {
  const tell = CLAUDE_TELLS.find(t => t.label === '"beside it" / "behind it" pointer');
  assert.ok(tell, 'expected the pointer tell in CLAUDE_TELLS');
  const hits = (s: string) => [...s.matchAll(new RegExp(tell!.re.source, tell!.re.flags))].length;
  for (const s of POINTER_FIGURATIVE) assert.equal(hits(s), 1, `expected a hit: ${s}`);
  for (const s of POINTER_SPATIAL) assert.equal(hits(s), 0, `expected no hit: ${s}`);
});

test('the docs, comment and UI-copy gates use the same pointer rule as the detector', () => {
  const rule = RATCHETED_PHRASES.find(p => p.what.startsWith('"beside it" / "behind it" / "above it" pointer'));
  assert.ok(rule, 'expected the pointer rule in RATCHETED_PHRASES');
  assert.equal(rule!.re.source, spatialPointerRe('i').source);
  assert.equal(rule!.re.global, false, 'a per-line test() rule must not be global (lastIndex would carry over)');
  for (const s of POINTER_FIGURATIVE) assert.ok(rule!.re.test(s), `gate should flag: ${s}`);
  for (const s of POINTER_SPATIAL) assert.equal(rule!.re.test(s), false, `gate should pass: ${s}`);
});

test('claudisms from the docs gate list are scored by the detector', () => {
  const all = [...CLAUDE_TELLS, ...AI_PHRASES];
  const scored = (s: string) => all.some(t => new RegExp(t.re.source, t.re.flags).test(s));
  for (const s of [
    'That is worth knowing before you start.',
    'Which brings us back to the export path.',
    'The signature anchors it to the root.',
    'The file is written, in full.',
    'We ran a deep dive on the numbers.',
    'The archive is a treasure trove of assets.',
    'This release raises the bar for exports.',
    'Also worth noting: the cache is local.',
    'Teams should lean into the change.',
    'Moving on to the next section, the cache.',
    'The existing landscape offers no answer.',
  ]) assert.ok(scored(s), `expected the detector to score: ${s}`);
  const heading = CLAUDE_TELLS.find(t => t.label === 'heading that ends in "it"')!;
  assert.ok(new RegExp(heading.re.source, heading.re.flags).test('Intro\n## How to hold us to it\nBody'));
  assert.equal(new RegExp(heading.re.source, heading.re.flags).test('## How exports work'), false);
});
