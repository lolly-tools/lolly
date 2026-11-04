// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { InputValue } from '../engine/src/inputs.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { baseHost } from './helpers/host.ts';

// Brief, Email, Scorecard and Week: documents an assistant writes, laid out as
// pages. Their hooks read loose input (Markdown, pasted tables) into what the
// templates print, so these pin the reading.

const root = new URL('../community/', import.meta.url);
const tools = Object.fromEntries(await Promise.all(['brief', 'email', 'scorecard', 'week'].map(async (id) =>
  [id, await loadTool(id, p => readFile(new URL(p, root), 'utf8'))] as const)));

async function render(id: string, values: Record<string, InputValue>) {
  const runtime = await createRuntime(tools[id]!, baseHost(), values);
  const read = (expr: string): string => runtime.getHydratedString(expr);
  const html = runtime.getHydrated();
  runtime.destroy();
  return { read, html };
}

test('Brief reads an assistant-written brief into a title, labelled points and notes', async () => {
  const b = await render('brief', {
    body: '**Dana Reyes** · Head of Platforms · Example Port\n\n- **In the news:** [A tender opened](https://example.com/t) (21 Oct).\n- **Signal:** Asked for pricing.\n- Plain point with no label.\n\n**Not confirmed:** Who signs off.',
  });
  assert.equal(b.read('{{briefTitle}}'), 'Dana Reyes');
  assert.equal(b.read('{{briefMeta}}'), 'Head of Platforms · Example Port');
  assert.equal(b.read('{{#each points}}[{{label}}]{{/each}}'), '[In the news][Signal][]');
  assert.equal(b.read('{{#each notes}}{{label}}={{text}}{{/each}}'), 'Not confirmed=Who signs off.');
  assert.match(b.html, /<a href="https:\/\/example\.com\/t">A tender opened<\/a>/, 'Markdown links render');
  const sections = await render('brief', { body: '# Why now\nExample Port · Platforms\n\nThree reasons.\n\n## Cost\nRenewals rose.\n\n## Sovereignty\nData stays local.\n\n**Sources:** the port\'s annual report.' });
  assert.equal(sections.read('{{briefTitle}}'), 'Why now');
  assert.equal(sections.read('{{briefMeta}}'), 'Example Port · Platforms', 'a details line under a # title');
  assert.equal(sections.read('{{#each notes}}{{label}}{{/each}}'), 'Sources', 'a note after a section is a note');
  assert.equal(sections.read('{{#each intro}}{{this}}{{/each}}'), 'Three reasons.');
  assert.equal(sections.read('{{#each points}}[{{label}}: {{text}}]{{/each}}'), '[Cost: Renewals rose.][Sovereignty: Data stays local.]');
});

test('Brief reads a real assistant answer: a bold title line with its details, and a sources list', async () => {
  const b = await render('brief', { body: '**Example Port · Virtualisation**\n\n- **In the news:** A budget for renewal (October 2026).\n- **Next step:** Ask which platform they run.\n\nSources:\n- [News](https://example.com/news)\n- [Budget](https://example.com/budget)' });
  assert.equal(b.read('{{briefTitle}}'), 'Example Port');
  assert.equal(b.read('{{briefMeta}}'), 'Virtualisation');
  assert.equal(b.read('{{#each points}}[{{label}}]{{/each}}'), '[In the news][Next step]', 'the sources list is not a point');
  assert.equal(b.read('{{#each notes}}{{label}}: {{text}}{{/each}}'), 'Sources: [News](https://example.com/news) · [Budget](https://example.com/budget)');
});

test('Brief shows a label still being written as a label', async () => {
  const b = await render('brief', { body: '**Dana Reyes** · Head of Platforms\n\n- **Signal:** Asked for pricing.\n- **Acc' });
  assert.equal(b.read('{{#each points}}[{{label}}|{{text}}]{{/each}}'), '[Signal|Asked for pricing.][Acc|]');
  assert.doesNotMatch(b.html, /\*\*Acc/);
});

test('Brief escapes what it is given', async () => {
  const b = await render('brief', { body: '- **Signal:** <img src=x onerror=alert(1)> tag' });
  assert.doesNotMatch(b.html, /<img src=x/);
  assert.match(b.html, /&lt;img src=x/);
});

test('Email takes its subject and recipients from header lines when the fields are empty', async () => {
  const e = await render('email', { from: 'frank.flymore@example.com', to: '', heading: '', body: '**Subject:** Your platform in 2027\nTo: Thijs Bosman <thijs@example.org>\n\nHi Thijs,\n\nThree questions.', status: 'sent', attachments: 'Plan.pdf, Deck.pptx' });
  assert.equal(e.read('{{subjectText}}'), 'Your platform in 2027');
  assert.equal(e.read('{{toText}}'), 'Thijs Bosman');
  assert.equal(e.read('{{senderName}}'), 'Frank Flymore');
  assert.equal(e.read('{{initials}}'), 'FF');
  assert.equal(e.read('{{statusLabel}}'), 'Sent');
  assert.equal(e.read('{{#each files}}{{ext}} {{/each}}'), 'PDF PPTX ');
  assert.doesNotMatch(e.read('{{message}}'), /Subject:|To:/, 'header lines leave the message');
  const kept = await render('email', { heading: 'Set already', body: 'Subject: stays in the body\n\nHello' });
  assert.equal(kept.read('{{subjectText}}'), 'Set already');
  assert.match(kept.read('{{message}}'), /^Subject: stays in the body/);
});

test('Scorecard reads scores in any form and averages the known ones', async () => {
  const s = await render('scorecard', {
    criteria: { columns: ['Criterion', 'Score', 'Evidence'], rows: [['Metrics', '0.8', 'A'], ['Champion', '60%', 'B'], ['Paper process', '', 'C'], ['Pain', '4/5', 'D']] },
    scale: '1',
  });
  assert.equal(s.read('{{#each rows}}{{initial}}:{{scoreText}} {{/each}}'), 'M:80% C:60% P:Not yet P:80% ');
  assert.equal(s.read('{{overallText}}'), '73%');
  assert.equal(s.read('{{knownText}}'), '3 of 4 scored');
  assert.match(s.html, /qs-row is-unknown/);
  const tens = await render('scorecard', { criteria: { columns: ['Criterion', 'Score'], rows: [['Fit', '7']] }, scale: '10' });
  assert.equal(tens.read('{{#each rows}}{{scoreText}}{{/each}}'), '7/10');
});

test('Week places events by day and time, and names the booked slot', async () => {
  const w = await render('week', {
    events: { columns: ['Day', 'Start', 'End', 'Title', 'Status'], rows: [['Thursday', '10:00', '11:00', 'Intro', 'booked'], ['Tue', '2pm', '3pm', 'Call', 'declined'], ['2026-11-11', '9.30', '10', 'Stand-up', ''], ['Sun', '9', '10', 'Out of range', 'busy']] },
    weekOf: '2026-11-12', days: '5', fromHour: 8, toHour: 18,
  });
  assert.equal(w.read('{{#each weekDays}}{{label}}{{date}} {{/each}}'), 'Mon9 Tue10 Wed11 Thu12 Fri13 ');
  assert.equal(w.read('{{#each weekDays}}{{#each events}}{{title}}@{{top}}+{{height}} {{/each}}{{/each}}'), 'Call@60%+10% Stand-up@15%+5% Intro@20%+10% ');
  assert.equal(w.read('{{bookedText}}'), 'Thu 12, 10:00');
  assert.match(w.html, /qw-event is-declined/);
  assert.match(w.html, /qw-event is-busy/, 'an empty status reads as busy');
});

test('The four tools need no host APIs and their hooks are free of realm globals', async () => {
  for (const id of ['brief', 'email', 'scorecard', 'week']) {
    assert.deepEqual(tools[id]!.manifest.requires ?? [], [], id);
    assert.ok(analyseIsolation(await readFile(new URL(`${id}/hooks.js`, root), 'utf8')).clean, id);
  }
});
