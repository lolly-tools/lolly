// SPDX-License-Identifier: MPL-2.0
/**
 * Creation feedback rows in the export panel's "Before you export" card: house-rule
 * findings name their layer and read as a warning for a required rule and a note for an
 * advisory one, the writing line carries the band and the engine's own summary with a
 * link into Verify, and nothing in the rows can gate Download or record an exception.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { creationFeedbackRows, readCreationFeedback, type CreationFeedbackSource } from './creation-feedback.ts';
import { preflightBodyHtml, preflightView } from '../views/export-preflight.ts';

const TOKENS = JSON.parse(readFileSync(new URL('../../../../tests/fixtures/design-brief/tokens.json', import.meta.url), 'utf8'));
const STRONG =
  "In today's fast-paced world, it's important to delve into the rich tapestry of innovation. As an AI language model, I hope this helps! " +
  'Let me know if you have any other questions. This is a testament to our commitment, and it underscores the pivotal, transformative role we play in the ever-evolving landscape.';

const board = (...layers: Record<string, unknown>[]): Record<string, unknown>[] => [
  { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
  ...layers.map((l, i) => ({ frame: 'a1', kind: 'text', x: 100, y: 100 + i * 120, w: 1600, h: 100, fontSize: 28, weight: '400', align: 'left', fg: '#13294b', ...l })),
];
const source = (boxes: unknown, doc: unknown = TOKENS, catalog?: CreationFeedbackSource['catalog']): CreationFeedbackSource => ({
  model: () => [{ id: 'boxes', value: boxes }, { id: 'background', value: '#ffffff' }],
  snapshot: async () => (doc ? { document: doc, system: null, version: 'latest', selection: {} } : undefined) as never,
  ...(catalog ? { catalog } : {}),
});

test('house-rule findings name the layer under one checked line: required rules warn, advisory rules note', async () => {
  // A 400 centred headline breaks the required headline weight and the advisory alignment.
  const read = await readCreationFeedback(source(board({ id: 'title', name: 'Headline', text: 'Quarterly results', align: 'center', fontSize: 72 })));
  const rows = creationFeedbackRows(read);
  assert.equal(rows[0]!.id, 'house-rules.checked');
  assert.equal(rows[0]!.tone, 'note');
  assert.match(rows[0]!.text, /^House rules checked \(\d+\)\. Every finding below says which layer it is about\.$/);
  const findings = rows.filter((r) => r.id.startsWith('house-rule.'));
  assert.deepEqual(findings.map((f) => [f.id, f.tone]), [['house-rule.0.headline-weight', 'warn'], ['house-rule.1.align-left', 'note']]);
  for (const f of findings) {
    const engine = read.report.houseRules.findings.find((h) => h.message === f.text);
    assert.ok(engine, 'the message is the engine finding verbatim');
    assert.equal(f.tone, engine.requirement === 'required' ? 'warn' : 'note');
    assert.equal(f.title, '“Headline”', 'the layer is named by its name');
    assert.equal(f.action, undefined, 'no ignore or exception control');
  }
  // Unknown rule kinds are said, never passed.
  assert.ok(rows.some((r) => r.id === 'house-rules.unknown' && r.tone === 'gap' && /clear-space/.test(r.text)));
  // Only the required finding counts toward the card's "to fix" total.
  const view = preflightView(null, { formatLabel: 'PNG', sizeText: '', additionalRows: rows });
  assert.equal(view.tone, 'fix');
  assert.match(view.verdict, /^1 to fix,/);
});

test('an advisory finding alone leaves nothing to fix', async () => {
  const read = await readCreationFeedback(source(board({ id: 'body', name: 'Body copy', text: 'Revenue grew in every region this quarter.', align: 'center' })));
  const rows = creationFeedbackRows(read);
  assert.deepEqual(rows.filter((r) => r.id.startsWith('house-rule.')).map((r) => [r.id, r.tone]), [['house-rule.0.align-left', 'note']]);
  const view = preflightView(null, { formatLabel: 'PNG', sizeText: '', additionalRows: rows });
  assert.equal(view.tone, 'know');
  assert.doesNotMatch(view.verdict, /to fix/);
});

test('catalog facts name the logos in a logo finding, and a catalog that cannot be read leaves the ids', async () => {
  const logos = [
    { id: 'a1', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#13294b' },
    { id: 'mark', name: 'Logo', kind: 'image', frame: 'a1', x: 100, y: 100, w: 200, h: 60, image: 'tidewater/logo/positive' },
  ];
  const message = async (catalog?: CreationFeedbackSource['catalog']) =>
    (await readCreationFeedback(source(logos, TOKENS, catalog))).report.houseRules.findings.find((f) => f.ruleId === 'logo-surface')!;
  let calls = 0;
  const named = await message(async () => {
    calls++;
    return { assets: [{ id: 'tidewater/logo/positive', name: 'Tidewater Positive' }, { id: 'tidewater/logo/reverse', name: 'Tidewater Reverse' }] };
  });
  assert.equal(calls, 1, 'read once per report');
  assert.match(named.message, /The logo “Tidewater Positive” sits on a dark surface; use “Tidewater Reverse”\.$/);
  assert.deepEqual([named.value, named.expected], ['tidewater/logo/positive', 'tidewater/logo/reverse'], 'agents keep the ids');
  const broken = await message(async () => { throw new Error('offline'); });
  assert.match(broken.message, /The logo tidewater\/logo\/positive sits on a dark surface; use tidewater\/logo\/reverse\.$/);
  assert.equal((await message()).message, broken.message, 'no catalog reads the same as one that failed');
  // The advisory logo rule is a note on the card.
  const rows = creationFeedbackRows(await readCreationFeedback(source(logos, TOKENS)));
  assert.deepEqual(rows.filter((r) => r.id.startsWith('house-rule.')).map((r) => [r.id, r.tone]), [['house-rule.0.logo-surface', 'note']]);
});

test('the writing line carries the band, the engine summary and a link into Verify', async () => {
  const read = await readCreationFeedback(source(board({ id: 'body', name: 'Body copy', text: STRONG })));
  let handed = '';
  const rows = creationFeedbackRows(read, { openVerify: (text) => { handed = text; } });
  const writing = rows.find((r) => r.id === 'writing.score')!;
  assert.equal(writing.tone, 'warn', 'strong reads as a warning, as Verify tones it');
  assert.equal(writing.title, 'Writing signal: Strong');
  assert.equal(writing.text, read.report.writing.summary, 'the engine sentence, verbatim');
  assert.match(writing.text, /Signal score \d+\/100/);
  assert.ok(writing.details!.length > 0 && writing.details!.length <= 3);
  assert.ok(writing.details!.every((d) => d.endsWith('in “Body copy”')));
  assert.equal(writing.link!.href, '#/verify');
  assert.equal(writing.link!.label, 'Open the text in Verify');
  writing.link!.prepare!();
  assert.equal(handed, STRONG, 'Verify gets the visible text');
  assert.doesNotMatch(JSON.stringify(rows), /AI-generated text\.|\bpasses\b|ignore|exception/i);

  const calm = creationFeedbackRows(await readCreationFeedback(source(board({ id: 'body', text: 'Revenue grew in every region this quarter.' })))).find((r) => r.id === 'writing.score')!;
  assert.equal(calm.tone, 'note');
  assert.equal(calm.details, undefined, 'no phrases listed at the none band');
});

test('no design system, no rules, no text and hidden layers each read as what they are', async () => {
  const noSystem = creationFeedbackRows(await readCreationFeedback(source(board({ id: 'body', text: 'Plain words.' }), null)));
  assert.ok(!noSystem.some((r) => r.id.startsWith('house-rule')), 'the brand rows already say the design system could not be read');
  const noRules = creationFeedbackRows(await readCreationFeedback(source(board({ id: 'body', text: 'Plain words.' }), { color: {} })));
  assert.deepEqual(noRules.filter((r) => r.id.startsWith('house-rules')).map((r) => [r.id, r.tone]), [['house-rules.none', 'gap']]);
  const noText = creationFeedbackRows(await readCreationFeedback(source(board())));
  assert.ok(!noText.some((r) => r.id === 'writing.score'), 'nothing to score, so no writing line');
  const hidden = creationFeedbackRows(await readCreationFeedback(source(board({ id: 'shown', text: 'Plain words.' }, { id: 'draft', text: STRONG, hidden: true }))));
  assert.equal(hidden.find((r) => r.id === 'writing.score')!.tone, 'note', 'the hidden draft is not scored');
  assert.deepEqual(hidden.filter((r) => r.id === 'creation.hidden').map((r) => r.tone), ['gap']);
});

test('the card renders the rows with escaped details and a plain link, and never gates anything', async () => {
  const read = await readCreationFeedback(source(board({ id: 'body', name: '<b>x</b>', text: STRONG })));
  const view = preflightView(null, { formatLabel: 'PDF', sizeText: '', additionalRows: creationFeedbackRows(read) });
  const html = preflightBodyHtml(view);
  assert.match(html, /<ul class="preflight-finding-details"><li>/);
  assert.match(html, /<a class="preflight-finding-link" href="#\/verify" data-preflight-link="writing.score">Open the text in Verify<\/a>/);
  assert.ok(!html.includes('<b>x</b>'), 'layer names are escaped');
  assert.doesNotMatch(html, /disabled|data-preflight-fix/, 'no control that gates or dismisses');
  assert.equal(view.show, true);
});
