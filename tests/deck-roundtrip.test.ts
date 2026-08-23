// SPDX-License-Identifier: MPL-2.0
/**
 * THE ROUND-TRIP CONTRACT (plans/139 WP2): a .pptx read-model serialised by
 * `engine/src/deck-md.ts` must parse back through Deck Studio's OWN markdown
 * parser. Serialiser and parser live in different repos (engine here,
 * community/deck-studio as tool data), so without this test the dialect is a
 * coincidence rather than an agreement.
 *
 * The deck is mounted the way tests/deck-studio-pptx.test.ts mounts it - real
 * tool, real hooks, real runtime - and the markdown is fed in through the `spec`
 * input, which is the input `parseSpec` reads. The assertions read the emitted
 * `[data-pptx-deck]` model, which is what the .pptx writer lowers.
 *
 * THE PARSER IS THE AUTHORITY. Where the pinned dialect and `parseSpec` disagree,
 * the serialiser follows the parser and the reason is written down beside the
 * assertion.
 *
 * Run with: node --test tests/deck-roundtrip.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { deckToMarkdown } from '../engine/src/deck-md.ts';
import type { PptxDeckRead } from '../engine/src/pptx-read.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// ─── the deck-studio loader (same pattern as tests/deck-studio-pptx.test.ts) ──

const PACK_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(PACK_DIR, path), 'utf8');

assert.ok(existsSync(join(PACK_DIR, 'deck-studio', 'tool.json')),
  'community/deck-studio/tool.json is missing - the tool was renamed or deleted');

const tool: any = await loadTool('deck-studio', fetchFile);

async function parseThroughDeckStudio(spec: string): Promise<any> {
  const rt = await createRuntime(tool, baseHost(), { spec } as never);
  assert.deepEqual(rt.hookErrors ?? [], [], 'no hook errors');
  const doc = new JSDOM(rt.getHydrated() as string).window.document;
  const el = doc.querySelector('[data-pptx-deck]');
  assert.ok(el, 'deck model present');
  return JSON.parse(el!.textContent ?? '');
}

const runsOf = (slide: any): any[] =>
  slide.elements.filter((e: any) => e.t === 'text').flatMap((e: any) => e.paras.flatMap((p: any) => p.runs));
const textsOf = (slide: any): string[] => runsOf(slide).map((r: any) => r.text);
const parasOf = (slide: any): any[] =>
  slide.elements.filter((e: any) => e.t === 'text').flatMap((e: any) => e.paras);

// ─── the fixture read-model ──────────────────────────────────────────────────
// Three slides, hand-built the way `readPptx` would report them: a title and
// subtitle, bullets at two outline levels with a bold run and an image, and a
// pipe-worthy table. Slide 1 also carries a footer placeholder, which is
// furniture the branded writers regenerate and the serialiser must skip.

const DECK: PptxDeckRead = {
  widthEmu: 12_192_000,
  heightEmu: 6_858_000,
  theme: { colors: {} },
  slides: [
    {
      index: 0,
      notes: 'Open warmly. The arrow --> must not close the comment.',
      nodes: [
        {
          type: 'text', xEmu: 600_000, yEmu: 2_400_000, cxEmu: 8_000_000, cyEmu: 900_000,
          ph: { type: 'subTitle', idx: 1 },
          paras: [{ runs: [{ text: 'One round trip, measured' }] }],
        },
        {
          type: 'text', xEmu: 600_000, yEmu: 1_000_000, cxEmu: 8_000_000, cyEmu: 1_200_000,
          ph: { type: 'ctrTitle' },
          paras: [{ runs: [{ text: 'Rebrand this deck' }] }],
        },
        {
          type: 'text', xEmu: 600_000, yEmu: 6_200_000, cxEmu: 3_000_000, cyEmu: 300_000,
          ph: { type: 'ftr', idx: 11 },
          paras: [{ runs: [{ text: 'Confidential 2026' }] }],
        },
      ],
    },
    {
      index: 1,
      notes: 'Mention the media handoff.',
      nodes: [
        {
          type: 'text', xEmu: 400_000, yEmu: 300_000, cxEmu: 8_000_000, cyEmu: 700_000,
          ph: { type: 'title' },
          paras: [{ runs: [{ text: 'Why it works' }] }],
        },
        {
          type: 'text', xEmu: 400_000, yEmu: 1_200_000, cxEmu: 5_000_000, cyEmu: 3_000_000,
          ph: { type: 'body', idx: 1 },
          paras: [
            { runs: [{ text: 'The read model keeps positions' }] },
            { lvl: 1, runs: [{ text: 'Titles stop being ' }, { text: 'guesswork', bold: true }] },
            { runs: [{ text: 'Notes ride along' }] },
          ],
        },
        {
          type: 'pic', xEmu: 6_000_000, yEmu: 1_200_000, cxEmu: 3_000_000, cyEmu: 2_000_000,
          embed: 'rId4', media: 'ppt/media/image7.png',
        },
      ],
    },
    {
      index: 2,
      nodes: [
        {
          type: 'text', xEmu: 400_000, yEmu: 300_000, cxEmu: 8_000_000, cyEmu: 700_000,
          ph: { type: 'title' },
          paras: [{ runs: [{ text: 'Numbers' }] }],
        },
        {
          type: 'table', xEmu: 400_000, yEmu: 1_500_000, cxEmu: 8_000_000, cyEmu: 2_000_000,
          rows: [
            ['Metric', 'Value'],
            ['Uptime | SLA', '99.9%'],
            ['Cost', '1.2M'],
          ],
        },
      ],
    },
  ],
};

const OUT = deckToMarkdown(DECK);

// ─── the serialiser side ─────────────────────────────────────────────────────

test('the markdown never opens with --- (deck-studio would eat it as frontmatter)', () => {
  assert.ok(!OUT.markdown.startsWith('---'), 'a leading --- block is stripped as YAML frontmatter');
  assert.equal(OUT.markdown.split('\n')[0], '# Rebrand this deck');
});

test('titles are ph-classified headings: # for slide one, ## after it', () => {
  const headings = OUT.markdown.split('\n').filter((l) => /^#{1,6}\s/.test(l));
  assert.deepEqual(headings, ['# Rebrand this deck', '## Why it works', '## Numbers']);
});

test('footer/slide-number/date placeholders are furniture and never serialise', () => {
  assert.ok(!OUT.markdown.includes('Confidential 2026'));
});

test('media is handed over as a manifest keyed to the emitted name', () => {
  assert.deepEqual(OUT.media, [{ path: 'ppt/media/image7.png', name: 'media/1.png' }]);
  assert.ok(OUT.markdown.includes('![](media/1.png)'));
});

test('a pipe inside a table cell is escaped per GFM', () => {
  assert.ok(OUT.markdown.includes('Uptime \\| SLA'));
});

test('a literal --> inside a note cannot close the comment early', () => {
  const comments = OUT.markdown.match(/<!--[\s\S]*?-->/g) ?? [];
  assert.equal(comments.length, 2, 'one note comment per slide that has notes');
  assert.ok(comments[0]!.includes('The arrow -> must not close'));
  assert.equal(comments[0]!.indexOf('-->'), comments[0]!.length - 3, 'the only --> is the closer');
});

test('deckToMarkdown never throws on a sparse or hostile model', () => {
  assert.deepEqual(deckToMarkdown({} as unknown as PptxDeckRead), { markdown: '', media: [] });
  assert.deepEqual(deckToMarkdown(null as unknown as PptxDeckRead), { markdown: '', media: [] });
  const junk = {
    slides: [null, { nodes: null }, { nodes: [{ type: 'text' }, { type: 'table', rows: [null, 3] }] }],
  } as unknown as PptxDeckRead;
  assert.doesNotThrow(() => deckToMarkdown(junk));
});

// ─── the parser side: what deck-studio actually makes of it ──────────────────

test('the round trip preserves slide count, titles, bullets, table and notes', async () => {
  const deck = await parseThroughDeckStudio(OUT.markdown);
  assert.equal(deck.slides.length, 3, 'three slides in, three slides out');

  // Slide 1: title text survives. DIALECT NOTE: the subtitle is emitted as a
  // plain paragraph, so parseSpec puts it in the BODY, not the subtitle field.
  // A second heading would bind to `subtitle`, but a single-slide deck has no
  // `---` and parseMarkdownDeck then splits before every #/## heading, which
  // would turn one slide into two. The paragraph is safe in both readings.
  assert.ok(textsOf(deck.slides[0]).includes('Rebrand this deck'));
  assert.ok(textsOf(deck.slides[0]).includes('One round trip, measured'));
  assert.ok(deck.slides[0].notes.includes('Open warmly'), 'speaker notes survive the comment round trip');
  assert.ok(!textsOf(deck.slides[0]).some((t: string) => t.includes('notes:')),
    'the notes comment is stripped from the body, never rendered as a bullet');

  // Slide 2: bullets at two levels, with the bold run intact.
  const s2 = deck.slides[1];
  assert.ok(textsOf(s2).includes('The read model keeps positions'));
  assert.ok(runsOf(s2).some((r: any) => r.text === 'guesswork' && r.bold === true), 'a bold run round-trips');
  assert.ok(parasOf(s2).some((p: any) => p.level === 1), 'two spaces of indent read back as outline level 1');
  assert.ok(s2.elements.some((e: any) => e.t === 'image' && e.src === 'media/1.png'), 'the image reference survives');
  assert.ok(s2.notes.includes('media handoff'));

  // Slide 3: the pipe table.
  const table = deck.slides[2].elements.find((e: any) => e.t === 'table');
  assert.ok(table, 'a GFM pipe table becomes a native table');
  assert.deepEqual(table.rows[0].cells.map((c: any) => c.text), ['Metric', 'Value'], 'first row is the header');
  assert.ok(table.rows.some((r: any) => r.cells.some((c: any) => c.text === '1.2M')));
  assert.equal(deck.slides[2].notes, undefined, 'a slide with no notes emits none');
});

test('deck-studio does not honour the GFM pipe escape (known, and why the escape stays)', async () => {
  // deck-builder's splitRow honours `\|`; deck-studio's parseTableSrc splits on a
  // bare `|`, so an escaped cell splits on re-import. The serialiser keeps the GFM
  // escape anyway: the markdown is a deliverable of its own (#/convert, plan 139
  // WP3), and un-escaping would corrupt every other reader. Pinned so a future fix
  // in parseTableSrc has to update this assertion deliberately.
  const deck = await parseThroughDeckStudio(OUT.markdown);
  const table = deck.slides[2].elements.find((e: any) => e.t === 'table');
  const cells = table.rows.flatMap((r: any) => r.cells.map((c: any) => c.text));
  assert.ok(cells.includes('Uptime \\'), 'the escaped pipe splits the cell today');
});

test('an all-bold title emits a plain heading, never # **Title** (WP6 bench finding)', () => {
  // A heading is already emphatic; strong marks inside it are markup noise that
  // deck-studio would re-import as literal asterisk-wrapped title text. Body
  // runs keep their emphasis - only the title/subtitle heading line goes plain.
  const deck = {
    slideWidth: 9144000,
    slideHeight: 6858000,
    slides: [{
      nodes: [{
        type: 'text', x: 0, y: 0, w: 100, h: 100,
        ph: { type: 'title' },
        paras: [{ runs: [{ text: 'Bold Title', bold: true }] }],
      }, {
        type: 'text', x: 0, y: 200, w: 100, h: 100,
        paras: [{ runs: [{ text: 'bold body', bold: true }] }],
      }],
    }],
  } as unknown as PptxDeckRead;
  const out = deckToMarkdown(deck);
  assert.ok(out.markdown.includes('# Bold Title'), 'title is a plain heading');
  assert.ok(!out.markdown.includes('# **'), 'no strong marks inside the heading');
  assert.ok(out.markdown.includes('**bold body**'), 'body emphasis is untouched');
});
