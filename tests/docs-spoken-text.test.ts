// SPDX-License-Identifier: MPL-2.0
/**
 * Spoken-text extraction (plans/40-docs-audio-listen.md section 4.1/section 5) - what a listener
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
import { headingId as pkgHeadingId } from '../packages/docs-render/src/index.ts';

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

test('a leading meta-title H1 is skipped when the page title is known', () => {
  // site.md's real shape: an H1 that is a filing label, not content.
  const md = '# Lolly - Landing page copy\n\nReal prose first.\n\n## Marketers\n\nBody.\n';
  const blocks = extractSpokenText(md, { pageTitle: 'Lolly' });
  assert.equal(blocks[0]!.text, 'Real prose first.', 'the spoken page opens with real prose');
  assert.equal(blocks[0]!.blockId, 'intro:p1', 'prose before the first narrated heading anchors to intro');
  assert.equal(blocks.find(b => b.kind === 'heading')!.blockId, 'marketers', 'later headings keep their anchors');
  // an exact title match is skipped too (the hub pages' "# Lolly for Creators" shape)
  const exact = extractSpokenText('# Lolly for Creators\n\nProse.\n', { pageTitle: 'Lolly for Creators' });
  assert.equal(exact[0]!.text, 'Prose.');
  // narrowness: an unrelated H1 speaks, no pageTitle means no skip, and only
  // the document's FIRST block is ever a candidate
  assert.equal(extractSpokenText('# Quickstart\n\nProse.\n', { pageTitle: 'Lolly' })[0]!.text, 'Quickstart');
  assert.equal(extractSpokenText(md)[0]!.text, 'Lolly - Landing page copy');
  const later = extractSpokenText('Opening para.\n\n# Lolly - Landing page copy\n\nBody.\n', { pageTitle: 'Lolly' });
  assert.ok(later.some(b => b.text === 'Lolly - Landing page copy'), 'a mid-page H1 is content, not a label');
  // and the skip moves the staleness hash - the narrated words changed
  assert.notEqual(spokenTextHash(blocks), spokenTextHash(extractSpokenText(md)));
});

test('parity tripwire: headingId matches @lolly-tools/docs-render (the copy build.ts uses)', () => {
  // build.ts's headingId now lives in the shared package (docs/build.ts imports it, and
  // the in-app docs view will too). This module keeps its own leaner copy because it runs
  // headingId on ALREADY-stripped spoken text; the package copy additionally strips
  // `<!--l:key-->` marks, which is a no-op on the (mark-free) text this module ever passes.
  // The two must still agree on real inputs, which is what this tripwire guards.
  for (const [text, ordinal] of [['1. Make it yours', 2], ['Verify - engineering', 3], ['中文標題', 4], ['  ', 5]] as const) {
    assert.equal(headingId(text, ordinal), pkgHeadingId(text, ordinal), `divergence on ${JSON.stringify(text)}`);
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
