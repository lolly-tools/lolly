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
} from '../engine/src/claudisms.ts';

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
