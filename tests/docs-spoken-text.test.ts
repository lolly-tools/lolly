// SPDX-License-Identifier: MPL-2.0
/**
 * Spoken-text extraction (plans/docs-audio-listen.md §4.1/§5) — what a listener
 * hears, which blocks get which ids, and the staleness hash's invariances.
 * Also the parity tripwire: extraction duplicates docs/build.ts's headingId
 * (build.ts has no exports by design), so a drift between the two would point
 * page highlighting at anchors that no longer exist.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { extractSpokenText, spokenTextHash, headingId } from '../scripts/lib/docs-spoken-text.ts';

const MD = `# Quickstart

Lolly turns your **rules** into [tools](/info/tools.html) anyone can use.

![shot](/t/url-shot?url=%2F%23%2Fu&format=svg&filename=x)

## 1. Make it yours

Set it once and everything is on-brand.
Split across lines,
same paragraph.

- <!--i:palette--> **In the app:** drop it in.
- From the \`command line\`:

\`\`\`bash
npm run ingest:brand -- ./tokens.json
\`\`\`

The table of plans:

| a | b |
|---|---|
| 1 | 2 |
`;

test('speaks text, drops recipes/URLs/markup, announces code once', () => {
  const blocks = extractSpokenText(MD);
  const texts = blocks.map(b => b.text);
  assert.equal(texts[0], 'Quickstart');
  assert.equal(texts[1], 'Lolly turns your rules into tools anyone can use.');
  assert.ok(!texts.some(t => t.includes('url-shot')), 'shot recipes are never spoken');
  assert.ok(!texts.some(t => t.includes('/info/')), 'URLs are never spoken');
  assert.ok(texts.includes('In the app: drop it in.'), 'icon comment + bold stripped from the list item');
  assert.equal(texts.filter(t => t === 'Code example omitted.').length, 1, 'one omission line per fence');
  assert.ok(!texts.some(t => t.includes('ingest:brand')), 'code is never read aloud');
});

test('tables read their authored caption, or announce omission after a heading', () => {
  const withCaption = extractSpokenText(MD);
  assert.ok(withCaption.some(b => b.text === 'The table of plans:'), 'the caption line is the spoken form');
  assert.ok(!withCaption.some(b => b.text === 'Table omitted.'), 'a captioned table needs no omission line');
  const bare = extractSpokenText('## Rates\n\n| a | b |\n|---|---|\n');
  assert.ok(bare.some(b => b.text === 'Table omitted.'), 'a caption-less table is announced');
});

test('blockIds: headings use the build.ts slug rule, paragraphs count within their section', () => {
  const blocks = extractSpokenText(MD);
  const h = blocks.find(b => b.kind === 'heading' && b.level === 2)!;
  assert.equal(h.blockId, '1-make-it-yours');
  const para = blocks.find(b => b.blockId.startsWith('1-make-it-yours:'))!;
  assert.equal(para.blockId, '1-make-it-yours:p1');
  // pre-heading content anchors to the synthetic intro section
  assert.equal(blocks[1]!.blockId, 'quickstart:p1');
});

test('hash: invariant under reflow and chrome churn, changed by a wording edit', () => {
  const a = spokenTextHash(extractSpokenText(MD));
  const reflowed = MD.replace('Split across lines,\nsame paragraph.', 'Split across lines, same paragraph.');
  assert.equal(spokenTextHash(extractSpokenText(reflowed)), a, 'paragraph reflow must not re-render narration');
  const recipeChurn = MD.replace('filename=x', 'filename=y&dark=1');
  assert.equal(spokenTextHash(extractSpokenText(recipeChurn)), a, 'shot recipe churn must not re-render narration');
  const reworded = MD.replace('on-brand', 'always on-brand');
  assert.notEqual(spokenTextHash(extractSpokenText(reworded)), a, 'a wording change must');
});

test('a bare URL in prose speaks its host only', () => {
  const blocks = extractSpokenText('# T\n\nPoint the connector at https://mcp.lolly.tools/mcp and go.\n');
  assert.equal(blocks[1]!.text, 'Point the connector at mcp.lolly.tools and go.');
});

test('layout chrome is never spoken: ::: fences and horizontal rules', () => {
  const md = '# T\n\nBefore.\n\n---\n\n::: cols\n\n## Left\n\nLeft body.\n\n:::\n\nAfter.\n';
  const blocks = extractSpokenText(md);
  const texts = blocks.map(b => b.text);
  assert.ok(!texts.some(t => t.includes(':::')), 'directive fence markers are chrome');
  assert.ok(!texts.includes('---'), 'a horizontal rule is chrome');
  assert.ok(texts.includes('Left body.'), 'content inside a ::: block is still spoken');
  // and chrome must not bump the paragraph counters the player counts on the page
  assert.equal(blocks.find(b => b.text === 'After.')!.blockId, 'left:p2');
  const withoutHr = extractSpokenText(md.replace('\n---\n', '\n'));
  assert.equal(spokenTextHash(withoutHr), spokenTextHash(blocks), 'adding/removing an <hr> must not re-render narration');
});

test('parity tripwire: headingId matches the implementation inside docs/build.ts', () => {
  const src = readFileSync(fileURLToPath(new URL('../docs/build.ts', import.meta.url)), 'utf8');
  const m = /function headingId\(text: string, ordinal: number\): string \{\n([\s\S]*?)\n\}/.exec(src);
  assert.ok(m, 'docs/build.ts still defines headingId(text, ordinal)');
  // Evaluate the extracted body and compare behaviour across representative inputs.
  const theirs = new Function('text', 'ordinal', m![1]!) as (t: string, o: number) => string;
  for (const [text, ordinal] of [['1. Make it yours', 2], ['Verify — engineering', 3], ['中文標題', 4], ['  ', 5]] as const) {
    assert.equal(headingId(text, ordinal), theirs(text, ordinal), `divergence on ${JSON.stringify(text)}`);
  }
});

test('a real docs page extracts cleanly end to end', () => {
  const real = readFileSync(fileURLToPath(new URL('../docs/quickstart.md', import.meta.url)), 'utf8');
  const blocks = extractSpokenText(real);
  assert.ok(blocks.length > 20, 'a real page yields a real document');
  assert.ok(blocks.every(b => b.text.trim().length > 0), 'no empty blocks');
  assert.ok(blocks.every(b => !/https?:\/\//.test(b.text)), 'no URLs anywhere in spoken text');
  const ids = blocks.map(b => b.blockId);
  assert.equal(new Set(ids).size, ids.length, 'blockIds are unique across the page');
});
