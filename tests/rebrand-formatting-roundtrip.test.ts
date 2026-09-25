// SPDX-License-Identifier: MPL-2.0
/**
 * Plan 275 section 7.2 step 8: the round trip that defines "formatting translates
 * through".
 *
 *   1. `tests/fixtures/rebrand/formatting.pptx` is planned and compiled onto the
 *      lolly-start master (the renovated path), lowered to a native .pptx through
 *      Design's node lowering (`compiledDeckToPptx`), and read back with
 *      `readPptx`: bullets, numbers and levels, and bold, italic, underline and
 *      strike per run, are the source's.
 *   2. The same source compiled faithfully keeps alignment and run colour too.
 *   3. A Design document with frames and no master (the path `export-pptx.ts`
 *      takes whenever `renderPptxFromDesign` returns null) goes through the tool's
 *      own deck model, `deckModelFor` in `community/design/hooks.js`, and reads
 *      back with no literal markers.
 *
 * Run with: node --test tests/rebrand-formatting-roundtrip.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import { unzipSync } from 'fflate';

import { readPptx, type PptxParts, type PptxReadPara, type PptxTextNode } from '../engine/src/pptx-read.ts';
import { compileFaithful } from '../engine/src/deck-compile.ts';
import { designTextOf } from '../engine/src/design-text.ts';
import { buildPptxParts, type PptxSlide } from '../engine/src/pptx.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { compiledDeckToPptx } from '../packages/node-shell/src/rebrand/index.ts';
import { designFramesToPptx } from '../packages/node-shell/src/design-pptx.ts';
import { deckSyncShape, emuOf } from '../packages/node-shell/src/pptx-deck.ts';
import type { DesignBoxRowV1 } from '../packages/core/src/rebrand-v1.ts';
import { runRebrandPipeline, STARTER_DESIGN_SYSTEM } from './helpers/rebrand-pipeline.ts';
import { baseHost } from './helpers/host.ts';

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document => domParser.parseFromString(xml, 'application/xml') as unknown as Document;

/** Every text paragraph of every slide, read back from a built package. */
function paragraphsOf(parts: PptxParts): PptxReadPara[][] {
  const deck = readPptx(parts, parseXml);
  return deck.slides.flatMap((slide) => slide.nodes.filter((n): n is PptxTextNode => n.type === 'text').map((n) => n.paras));
}

/** The plan 275 formatting fixture, read straight from the fixture folder. */
const formattingBytes = (): Uint8Array => new Uint8Array(readFileSync(new URL('./fixtures/rebrand/formatting.pptx', import.meta.url)));

const words = (para: PptxReadPara): string => para.runs.map((run) => run.text).join('');

/** The text body whose words include `needle`. */
function bodyWith(bodies: PptxReadPara[][], needle: string): PptxReadPara[] {
  const found = bodies.find((paras) => paras.some((para) => words(para).includes(needle)));
  assert.ok(found, `a text body reading "${needle}" was written`);
  return found;
}

/** The runs of one paragraph as [text, flags], blank runs left out. */
function flags(para: PptxReadPara | undefined): Array<[string, string]> {
  return (para?.runs ?? []).filter((run) => run.text.trim()).map((run) => [
    run.text.trim(),
    [run.bold ? 'b' : '', run.italic ? 'i' : '', run.underline ? 'u' : '', run.strike ? 's' : ''].join(''),
  ]);
}

test('renovated: formatting.pptx to Design to a native pptx keeps bullets, numbers, levels, b, i, u and strike', async () => {
  const run = await runRebrandPipeline('formatting', formattingBytes(), { applyUnreviewed: true, applyNeedsAttention: true });
  const out = await compiledDeckToPptx({ compiled: run.compiled, media: new Map(), system: STARTER_DESIGN_SYSTEM, title: 'formatting', now: '2026-09-24T00:00:00.000Z' });
  const bodies = paragraphsOf(unzipSync(out.bytes) as unknown as PptxParts);
  const joined = bodies.flat().map(words).join('\n');
  assert.doesNotMatch(joined, /\*\*|\{[#us w0-9a-f ]+\||^- |^\d+\. /m, 'no Design marker reached the deck as a character');

  const body = bodyWith(bodies, 'First bullet with');
  const kinds = body.map((para) => [words(para).trim(), para.bullet ?? 'none', para.lvl ?? 0]);
  assert.deepEqual(kinds.slice(0, 4), [
    ['First bullet with bold inside', 'bullet', 0],
    ['Nested second level', 'bullet', 1],
    ['Numbered one', 'number', 0],
    ['Numbered two', 'number', 0],
  ]);
  for (const [text, kind] of kinds.slice(4)) assert.equal(kind, 'none', `${text} is not a list item`);
  assert.equal(body[0]?.bulletChar, '•');
  assert.equal(body[2]?.numberStyle, 'arabicPeriod');
  assert.deepEqual(flags(body[0]), [['First bullet with', ''], ['bold', 'b'], ['inside', '']], 'bold travels on its run only; the body is regular');

  const title = bodyWith(bodies, 'Plain');
  const byWord = new Map(flags(title[0]).map(([text, f]) => [text, f]));
  assert.match(byWord.get('Italic') ?? '', /i/);
  assert.match(byWord.get('Under') ?? '', /u/);
  assert.match(byWord.get('Strike') ?? '', /s/);

  const lists = bodyWith(bodies, 'Scope:');
  assert.deepEqual(lists.map((para) => [para.bullet ?? 'none', para.lvl ?? 0]).slice(0, 4), [['bullet', 0], ['bullet', 0], ['bullet', 1], ['bullet', 2]], 'a three-level list');
  assert.deepEqual(flags(lists[0]), [['Scope:', 'b'], ['what the renovation changes', '']], 'a bold lead-in stays bold');
  const citation = lists.find((para) => words(para).includes('Source:'));
  assert.deepEqual(flags(citation), [['Source: annual survey, page 12', 'i']], 'the citation stays italic');
});

test('faithful: the same source keeps its alignment and its run colour through the lowering', async () => {
  const run = await runRebrandPipeline('formatting', formattingBytes());
  const faithful = compileFaithful(run.deck);
  const frames = faithful.frames.map((frame) => ({
    row: frame.layers[0] as DesignBoxRowV1,
    layers: frame.layers.slice(1),
  }));
  const out = await designFramesToPptx({ frames });
  const parts = buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), now: '2026-09-24T00:00:00.000Z' });
  const bodies = paragraphsOf(parts);
  const title = bodyWith(bodies, 'Plain');
  assert.equal(title[0]?.align, 'center', 'the title was set centred');
  const red = title[0]?.runs.find((r) => r.text.includes('Red'));
  assert.equal(red?.color && 'hex' in red.color ? red.color.hex : undefined, 'C00000', 'the red run stays red');
  assert.deepEqual(flags(title[0]).map(([t, f]) => `${t}:${f}`), ['Plain:', 'Bold:b', 'Italic:i', 'Under:u', 'Strike:s', 'Red:', 'Small:']);
  const body = bodyWith(bodies, 'First bullet with');
  assert.deepEqual(body.map((p) => p.bullet ?? 'none'), ['bullet', 'bullet', 'number', 'number', 'none', 'none']);
});

test('a frames-without-master Design document lowers through deckModelFor with no literal markers', async () => {
  const community = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
  const tool = await loadTool('design', (path: string) => readFile(join(community, path), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), {
    boxes: [
      { id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff' },
      { id: 't', kind: 'text', frame: 'f', x: 80, y: 80, w: 1000, h: 400, fontSize: 32, weight: '400', align: 'left',
        text: '**Bold** lead and *italic* word\n- one {u|underlined}\n  - nested {s|struck}\n1. first\n2. second\nplain end' },
    ] as never,
  });
  const html = rt.getHydrated() as string;
  const script = new JSDOM(html).window.document.querySelector('[data-pptx-deck]');
  assert.ok(script, 'a frame document carries the native deck model');
  const deck = JSON.parse(script.textContent ?? '{}') as { slides: Array<{ elements: Array<Record<string, unknown>> }> };
  const slides = deck.slides.map((s) => ({ shapes: s.elements.map((el) => deckSyncShape(el)).filter(Boolean), media: [] })) as PptxSlide[];
  const parts = buildPptxParts(slides, { emuW: emuOf(1280), emuH: emuOf(720), now: '2026-09-24T00:00:00.000Z' });
  const paras = bodyWith(paragraphsOf(parts), 'lead');
  assert.deepEqual(paras.map(words), ['Bold lead and italic word', 'one underlined', 'nested struck', 'first', 'second', 'plain end'], 'no marker is a character');
  assert.deepEqual(paras.map((p) => [p.bullet ?? 'none', p.lvl ?? 0]), [['none', 0], ['bullet', 0], ['bullet', 1], ['number', 0], ['number', 0], ['none', 0]]);
  assert.deepEqual(flags(paras[0]), [['Bold', 'b'], ['lead and', ''], ['italic', 'i'], ['word', '']]);
  assert.deepEqual(flags(paras[1]), [['one', ''], ['underlined', 'u']]);
  assert.deepEqual(flags(paras[2]), [['nested', ''], ['struck', 's']]);
});

// ─── plan 275 review: lists through the DOM walk, outline levels, soft breaks ──

const HOOKS_SOURCE = readFileSync(new URL('../community/design/hooks.js', import.meta.url), 'utf8');
const designHooks = new Function('host', `${HOOKS_SOURCE}\nreturn { richText: richText };`)({}) as { richText(raw: string): string };

test('the web DOM walk reads the list markers Design draws: bullets, levels, numbers and the line after a soft break', async () => {
  const { pptxCollectRuns, pptxParasFromRuns } = await import('../shells/web/src/bridge/export-pptx.ts');
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const g = globalThis as { window?: unknown };
  const before = g.window;
  g.window = dom.window;
  try {
    const box = dom.window.document.createElement('div');
    box.setAttribute('style', 'white-space: pre-wrap');
    box.innerHTML = designHooks.richText('- a\n  - b\n1. c\n  continued\nplain  spaced');
    dom.window.document.body.appendChild(box);
    const paras = pptxParasFromRuns(pptxCollectRuns(box), 'l');
    const slides = [{ shapes: [{ kind: 'text', x: 0, y: 0, cx: emuOf(600), cy: emuOf(400), paras }], media: [] }] as unknown as PptxSlide[];
    const read = paragraphsOf(buildPptxParts(slides, { emuW: emuOf(1280), emuH: emuOf(720), now: '2026-09-24T00:00:00.000Z' }))[0] ?? [];
    assert.deepEqual(read.map(words), ['a', 'b', 'c', 'continued', 'plain  spaced'], 'no marker is a character, and the spaces the canvas draws stay');
    assert.deepEqual(read.map((p) => [p.bullet ?? 'none', p.lvl ?? 0]), [['bullet', 0], ['bullet', 1], ['number', 0], ['none', 1], ['none', 0]]);
  } finally {
    g.window = before;
  }
});

test('an outline paragraph with no marker and the line after a soft break keep their level in both lowerings', async () => {
  const text = 'Heading line\n  sub point\n    deeper point\n- item\n  after a soft break';
  // The node lowering, straight from Design rows.
  const rows = [
    { id: 't', kind: 'text', frame: 'f', x: 80, y: 80, w: 1000, h: 400, fontSize: 32, weight: '400', align: 'left', text },
    { id: 'n', kind: 'text', frame: 'f', x: 80, y: 500, w: 1000, h: 100, fontSize: 32, weight: '400', align: 'left', text: '5. fifth\n6. sixth' },
  ] as DesignBoxRowV1[];
  const out = await designFramesToPptx({ frames: [{ row: { id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720 } as DesignBoxRowV1, layers: rows }] });
  const parts = buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), now: '2026-09-24T00:00:00.000Z' });
  const paras = bodyWith(paragraphsOf(parts), 'Heading');
  assert.deepEqual(paras.map(words), ['Heading line', 'sub point', 'deeper point', 'item', 'after a soft break'], 'no leading spaces reach the deck');
  assert.deepEqual(paras.map((p) => [p.bullet ?? 'none', p.lvl ?? 0]), [['none', 0], ['none', 1], ['none', 2], ['bullet', 0], ['none', 1]]);
  assert.ok(out.notes.some((line) => /starts past 1/.test(line)), 'a list numbered from 5 is reported, since the deck numbers it from 1');

  // The tool's own deck model, the path a frames-without-master document takes.
  const community = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
  const tool = await loadTool('design', (path: string) => readFile(join(community, path), 'utf8'));
  const rt = await createRuntime(tool, baseHost(), {
    boxes: [{ id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff' }, rows[0]] as never,
  });
  const script = new JSDOM(rt.getHydrated() as string).window.document.querySelector('[data-pptx-deck]');
  const deck = JSON.parse(script?.textContent ?? '{}') as { slides: Array<{ elements: Array<Record<string, unknown>> }> };
  const slides = deck.slides.map((s) => ({ shapes: s.elements.map((el) => deckSyncShape(el)).filter(Boolean), media: [] })) as PptxSlide[];
  const hooked = bodyWith(paragraphsOf(buildPptxParts(slides, { emuW: emuOf(1280), emuH: emuOf(720), now: '2026-09-24T00:00:00.000Z' })), 'Heading');
  assert.deepEqual(hooked.map(words), ['Heading line', 'sub point', 'deeper point', 'item', 'after a soft break']);
  assert.deepEqual(hooked.map((p) => [p.bullet ?? 'none', p.lvl ?? 0]), [['none', 0], ['none', 1], ['none', 2], ['bullet', 0], ['none', 1]]);
});

test('a soft line break in a title and in a bullet reaches Design and the deck as a line of its own', async () => {
  const title = designTextOf([{ runs: [{ text: 'Two line' }, { text: '\n' }, { text: 'title' }] }]).text;
  const bullets = designTextOf([
    { runs: [{ text: 'First', bold: true }, { text: '\n' }, { text: 'continues' }], bullet: 'bullet' },
    { runs: [{ text: 'Second' }], bullet: 'bullet' },
  ]).text;
  const rows = [
    { id: 'a', kind: 'text', frame: 'f', x: 80, y: 80, w: 1000, h: 200, fontSize: 40, weight: '400', align: 'left', text: title },
    { id: 'b', kind: 'text', frame: 'f', x: 80, y: 300, w: 1000, h: 300, fontSize: 28, weight: '400', align: 'left', text: bullets },
  ] as DesignBoxRowV1[];
  const out = await designFramesToPptx({ frames: [{ row: { id: 'f', kind: 'frame', x: 0, y: 0, w: 1280, h: 720 } as DesignBoxRowV1, layers: rows }] });
  const bodies = paragraphsOf(buildPptxParts(out.slides, { emuW: emuOf(out.size.w), emuH: emuOf(out.size.h), now: '2026-09-24T00:00:00.000Z' }));
  assert.deepEqual(bodyWith(bodies, 'Two line').map(words), ['Two line', 'title'], 'the title keeps its two lines');
  const list = bodyWith(bodies, 'First');
  assert.deepEqual(list.map((p) => [words(p), p.bullet ?? 'none', p.lvl ?? 0]), [['First', 'bullet', 0], ['continues', 'none', 1], ['Second', 'bullet', 0]]);
  assert.deepEqual(flags(list[0]), [['First', 'b']]);
});
