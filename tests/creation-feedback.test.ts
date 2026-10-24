// SPDX-License-Identifier: MPL-2.0
/**
 * Creation feedback (engine 1.283): one report for a Design document that informs
 * and never blocks, with the house-rule findings and the writing score for the text
 * the document draws. Over the synthetic Tidewater design system, so public CI sees
 * every case.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { brandSystemOf } from '../engine/src/brand-system.ts';
import { checkDesignHouseRules } from '../engine/src/design-house-rules.ts';
import { analyzeTextSignals } from '../engine/src/text-signals.ts';
import {
  CREATION_FEEDBACK_FORMAT, creationFeedback, creationFeedbackDelta, designVisibleText, designWritingScore,
} from '../engine/src/creation-feedback.ts';
import { checkFindingFromWritingScore, WRITING_SCORE_CODE } from '../engine/src/design-check.ts';

const doc = JSON.parse(readFileSync(new URL('./fixtures/design-brief/tokens.json', import.meta.url), 'utf8'));
const rules = brandSystemOf(doc)?.rules ?? [];

const STRONG =
  "In today's fast-paced world, it's important to delve into the rich tapestry of innovation. As an AI language model, I hope this helps! " +
  'Let me know if you have any other questions. This is a testament to our commitment, and it underscores the pivotal, transformative role we play in the ever-evolving landscape.\u200B';
const PLAIN = 'Our quarterly results are in. Revenue grew in every region, and the support queue is shorter than it was in spring.';

/** One white 1920x1080 artboard and its layers, each a left-aligned weight-400 text unless it says otherwise. */
const board = (...layers: Record<string, unknown>[]): Record<string, unknown>[] => [
  { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
  ...layers.map((l, i) => ({ frame: 'a1', kind: 'text', x: 100, y: 100 + i * 120, w: 1600, h: 100, fontSize: 28, weight: '400', align: 'left', fg: '#13294b', ...l })),
];

test('the report carries the house-rule findings and the writing score in one shape', () => {
  const boxes = board({ id: 'title', text: 'Quarterly results', align: 'center' }, { id: 'body', text: STRONG });
  const report = creationFeedback(boxes, rules, doc);
  assert.equal(report.format, CREATION_FEEDBACK_FORMAT);
  assert.equal(report.version, 1);
  // The same findings checkDesignHouseRules gives, unchanged.
  const direct = checkDesignHouseRules(boxes, rules.filter((r) => !['color-choices', 'font-choices', 'fixed-artwork', 'text-length'].includes(r.kind)), doc);
  assert.equal(report.houseRules.state, 'checked');
  assert.deepEqual(report.houseRules.findings, direct.findings);
  assert.equal(report.houseRules.checked, direct.checked);
  assert.ok(report.houseRules.findings.some((f) => f.layerId === 'title' && f.kind === 'text-align'));

  // The writing score is analyzeTextSignals over the drawn words, verbatim.
  const text = designVisibleText(boxes).text;
  const signals = analyzeTextSignals(text, { source: 'digital' });
  assert.equal(report.writing.state, 'scored');
  assert.equal(report.writing.score, signals.score);
  assert.equal(report.writing.band, signals.band);
  assert.equal(report.writing.summary, signals.summary);
  assert.equal(report.writing.band, 'strong');
  assert.equal(report.writing.textLayers, 2);

  // The strongest phrases name the layer they sit in, so a model can revise that layer.
  assert.ok(report.writing.phrases.length > 0 && report.writing.phrases.length <= 5);
  for (const p of report.writing.phrases) assert.equal(p.layerId, 'body', p.text);
  assert.ok(report.writing.phrases.some((p) => p.text === '[U+200B]'), 'an invisible character is spelled out');
  assert.ok(report.writing.phrases.some((p) => /As an AI/.test(p.text)));
  assert.ok(report.writing.signals.every((s) => s.layerIds.every((id) => id === 'title' || id === 'body')));

  // The summary: checked and informs, the engine's own words, never a verdict.
  assert.match(report.summary, /^Checked \d+ house rules: 1 finding informs 1 layer\. The first, on layer "title": /);
  assert.ok(report.summary.includes(`Writing signal (strong): ${signals.summary}`));
  assert.match(report.summary, /To lower the score, revise the flagged phrases in layer "body"/);
  assert.match(report.summary, /This feedback informs; it never blocks an export\.$/);
  assert.doesNotMatch(report.summary, /\bpass(es|ed)?\b|is AI-generated|probability/i);
});

test('the same input gives the same report, whatever the row order says about reading order', () => {
  const boxes = board({ id: 'title', text: 'Quarterly results' }, { id: 'body', text: STRONG }, { id: 'foot', text: PLAIN });
  const a = creationFeedback(boxes, rules, doc);
  const b = creationFeedback(structuredClone(boxes), rules, structuredClone(doc));
  assert.deepEqual(a, b);
  assert.equal(JSON.stringify(a), JSON.stringify(creationFeedback(boxes, rules, doc)));
  // Reading order comes from geometry, so shuffling the rows leaves the text alone.
  const shuffled = [boxes[0], boxes[3], boxes[1], boxes[2]];
  assert.equal(designVisibleText(shuffled).text, designVisibleText(boxes).text);
  assert.deepEqual(designVisibleText(boxes).segments.map((s) => s.layerId), ['title', 'body', 'foot']);
});

test('hidden layers, hidden artboards and hidden groups are left out and counted', () => {
  const boxes = [
    ...board({ id: 'shown', text: PLAIN }, { id: 'draft', text: STRONG, hidden: true }, { id: 'stringy', text: 'Another draft', hidden: 'true' }),
    { id: 'a2', kind: 'frame', x: 2000, y: 0, w: 1920, h: 1080, hidden: true },
    { id: 'on-hidden-board', kind: 'text', frame: 'a2', x: 2100, y: 100, w: 600, h: 80, text: STRONG },
    { id: 'g1', kind: 'group', frame: 'a1', hidden: true },
    { id: 'in-hidden-group', kind: 'text', frame: 'a1', group: 'g1', x: 100, y: 900, w: 600, h: 80, text: STRONG },
  ];
  const read = designVisibleText(boxes);
  assert.equal(read.text, PLAIN);
  assert.equal(read.hidden, 4);
  // In reading order: the first artboard's layers, then the second's.
  assert.deepEqual(read.hiddenLayerIds, ['draft', 'stringy', 'in-hidden-group', 'on-hidden-board']);
  const report = creationFeedback(boxes, rules, doc);
  assert.notEqual(report.writing.band, 'strong', 'hidden drafts are not scored');
  assert.deepEqual(report.hidden, { layers: 4, layerIds: ['draft', 'stringy', 'in-hidden-group', 'on-hidden-board'] });
  assert.match(report.summary, /4 hidden layers with text were left out\./);
  // House rules leave hidden layers alone too.
  assert.ok(!report.houseRules.findings.some((f) => ['draft', 'stringy', 'on-hidden-board', 'in-hidden-group'].includes(f.layerId)));
});

test('with no rules, or no design system, the house-rule half says so and the writing score still runs', () => {
  const boxes = board({ id: 'body', text: PLAIN, align: 'center' });
  const none = creationFeedback(boxes, [], doc);
  assert.deepEqual(none.houseRules, { state: 'no-rules', checked: 0, findings: [], unknown: [] });
  assert.match(none.summary, /^The design system states no house rules for Design, so none were checked\./);
  assert.equal(none.writing.state, 'scored');

  const noSystem = creationFeedback(boxes, undefined, null);
  assert.equal(noSystem.houseRules.state, 'no-design-system');
  assert.match(noSystem.summary, /^No design system was given, so no house rules were checked\./);

  // Rules the Usage room's examples answer are not layer rules; an unknown kind is listed, never passed.
  const onlyExamples = creationFeedback(boxes, rules.filter((r) => r.kind === 'font-choices' || r.kind === 'color-choices'), doc);
  assert.equal(onlyExamples.houseRules.state, 'no-rules');
  const unknown = creationFeedback(boxes, [{ ...rules[0]!, id: 'clear-space', kind: 'clear-space' }], doc);
  assert.deepEqual(unknown.houseRules.unknown, ['clear-space']);
  assert.match(unknown.summary, /1 rule could not be checked in this build: clear-space\./);

  // Undefined rules read the design system's own.
  assert.deepEqual(creationFeedback(boxes, undefined, doc).houseRules, creationFeedback(boxes, rules, doc).houseRules);
});

test('a document with no visible text has a writing half that says there is nothing to score', () => {
  for (const boxes of [[], board(), board({ id: 'empty', text: '   ' }), [{ id: 'pic', kind: 'image', x: 0, y: 0, w: 10, h: 10, text: STRONG }]]) {
    const report = creationFeedback(boxes, rules, doc);
    assert.equal(report.writing.state, 'no-text');
    assert.equal(report.writing.score, 0);
    assert.equal(report.writing.band, 'none');
    assert.deepEqual(report.writing.phrases, []);
    assert.match(report.summary, /There is no visible text to score\./);
    assert.equal(checkFindingFromWritingScore(designWritingScore(boxes)), null, 'no finding without text');
  }
  assert.equal(creationFeedback('not boxes', rules, doc).writing.state, 'no-text');
});

test('markup is dropped, a composed story is read from the text document, and a long text is cut at whole layers', () => {
  const marked = designVisibleText(board({ id: 'm', text: 'A **bold** {w300|light} line\n- one item' }));
  assert.equal(marked.text, 'A bold light line\none item');
  const story = designVisibleText(board({ id: 's', textStory: 'story-1', text: '' }), {
    textDocument: JSON.stringify({ stories: [{ id: 'story-1', source: 'Words from the story\uFFFC.', frameIds: ['s'] }] }),
  });
  assert.equal(story.text, 'Words from the story.');
  const capped = designVisibleText(board({ id: 'one', text: 'a'.repeat(40) }, { id: 'two', text: 'b'.repeat(40) }), { maxChars: 60 });
  assert.equal(capped.text, 'a'.repeat(40));
  assert.equal(capped.truncated, true);
});

test('the delta names what changed on the touched layers only', () => {
  const before = creationFeedback(board({ id: 'title', text: 'Quarterly results' }, { id: 'body', text: PLAIN }), rules, doc);
  const after = creationFeedback(board({ id: 'title', text: 'Quarterly results', align: 'center' }, { id: 'body', text: STRONG, align: 'center' }), rules, doc);
  const delta = creationFeedbackDelta(before, after, ['body']);
  assert.ok(delta.findings.length > 0);
  assert.ok(delta.findings.every((f) => f.layerId === 'body'), 'findings on untouched layers stay out');
  assert.equal(delta.writing.band, 'strong');
  assert.equal(delta.writing.previousBand, before.writing.band);
  assert.equal(delta.writing.previousScore, before.writing.score);
  assert.ok(delta.phrases.every((p) => p.layerId === 'body'));
  assert.match(delta.summary, new RegExp(`^Writing signal: strong, ${after.writing.score}/100, was ${before.writing.score}\\.`));
  assert.match(delta.summary, /new house-rule findings? on the layers this change touched/);
  assert.match(delta.summary, /Guidance to act on, not a gate\.$/);

  // Undo the edit: the findings on body go away and the delta says so.
  const back = creationFeedbackDelta(after, before, ['body']);
  assert.equal(back.findings.length, 0);
  assert.ok(back.resolved > 0);
  assert.match(back.summary, /earlier findings? on those layers no longer appl/);

  // No previous read: the delta still answers, with no previous score.
  const fresh = creationFeedbackDelta(null, after, ['title']);
  assert.equal(fresh.writing.previousScore, undefined);
  assert.ok(fresh.findings.every((f) => f.layerId === 'title'));
});

test('the writing score maps to one verify finding: warn at strong, info below, never error', () => {
  const strong = designWritingScore(board({ id: 'body', text: STRONG }));
  const finding = checkFindingFromWritingScore(strong)!;
  assert.equal(finding.code, WRITING_SCORE_CODE);
  assert.equal(finding.family, 'verify');
  assert.equal(finding.severity, 'warn');
  assert.equal(finding.needs, 'review');
  assert.equal(finding.evidence?.layers, 'body');
  assert.equal(finding.message, `Writing signal (strong): ${strong.summary}`);
  for (const band of ['none', 'weak', 'notable'] as const) {
    const quiet = checkFindingFromWritingScore({ ...strong, band })!;
    assert.equal(quiet.severity, 'info', band);
    assert.equal(quiet.needs, undefined);
  }
  assert.equal(checkFindingFromWritingScore(designWritingScore(board({ id: 'body', text: PLAIN })))!.severity, 'info');
});
