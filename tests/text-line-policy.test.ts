// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { chooseParagraphBreaks, paragraphLineFit, type TextLineGraph } from '../engine/src/text-line-policy.ts';
import { createTextCompositionAPI } from '../packages/node-shell/src/text-composition.ts';
import { createTextStory } from '../engine/src/text-story-document.ts';
test('justified candidates admit bounded compression and Best prices spacing deviation', () => {
  const graph: TextLineGraph = { candidates: [0, 1, 2, 3].map(at => ({ at, hyphen: false, hyphenWidth: 0 })),
    settings: { composition: 'best', align: 'justify', wordSpacing: { min: .5, ideal: 1, max: 2 } },
    width: () => 100, measure: (a,b) => ({ '0:1': 95, '0:2': 103, '0:3': 155, '1:2': 8, '1:3': 60, '2:3': 52 } as Record<string,number>)[`${a}:${b}`]!,
    spaces: (a,b) => a === 0 && b === 2 ? 10 : 1, words: (a,b) => b-a };
  assert.equal(paragraphLineFit(graph, 0, 2, 100).fits, true);
  assert.equal(paragraphLineFit(graph, 0, 2, 97).fits, false);
  assert.deepEqual(chooseParagraphBreaks(graph, [1,3]).ends, [2,3]);
  graph.settings.wordSpacing!.min = 1;
  assert.deepEqual(chooseParagraphBreaks(graph, [1,3]).ends, [1,3]);
});
test('pathological break graphs have a deterministic finite fallback', () => {
  const graph: TextLineGraph = { candidates: Array.from({ length: 2049 }, (_,at) => ({ at, hyphen: false, hyphenWidth: 0 })),
    settings: { composition: 'best' }, width: () => 100, measure: (a,b) => b-a, words: (a,b) => b-a };
  assert.deepEqual(chooseParagraphBreaks(graph, [100,2048]), { ends: [100,2048], limited: true });
});
test('a justified line with no stretchable space is priced far above a loose line', () => {
  const graph: TextLineGraph = { candidates: [0, 1, 2].map(at => ({ at, hyphen: false, hyphenWidth: 0 })),
    settings: { composition: 'best', align: 'justify' }, width: () => 100,
    measure: (a,b) => (b-a) * 40, spaces: (a,b) => a === 0 && b === 1 ? 0 : 4, words: (a,b) => b-a };
  const lone = paragraphLineFit(graph, 0, 1, 100), loose = paragraphLineFit(graph, 1, 2, 100);
  assert.ok(lone.cost >= 1000, 'a lone word cannot stretch to the measure');
  assert.ok(loose.cost < lone.cost);
});
test('Best paragraph does not set the first word of an indented justified paragraph alone', async () => {
  const font = readFileSync('shells/web/public/fonts/SUSE[wght].ttf');
  const source = 'Jefferson was arguing that an idea is hard to own, because giving it away costs the giver nothing. He never saw software, and software makes his case more plainly than a candle does: a copy costs almost nothing to make, and whoever shares it still has the original.';
  const story = createTextStory('story', source, index => `p${index}`); story.defaultStyle = 'body'; story.frameIds = ['f'];
  const document = { version: 1 as const, stories: [story], fonts: [{ id: 'sans', family: 'SUSE', sha256: createHash('sha256').update(font).digest('hex'), faceIndex: 0, source: { kind: 'bundled' as const, path: '/fonts/SUSE[wght].ttf' } }],
    styles: [{ id: 'body', kind: 'paragraph' as const, name: 'Body', paragraph: { character: { font: 'sans', size: 13 }, lineHeight: 1.45, align: 'justify' as const, lastAlign: 'start' as const, firstIndent: 14, composition: 'best' as const, language: 'en-GB', hyphenation: { mode: 'auto' as const, minWord: 6, minBefore: 3, minAfter: 3, consecutive: 2 } } }] };
  const api = createTextCompositionAPI(async () => new Uint8Array(font));
  const layout = await api.layoutRuns({ document, storyId: 'story', frames: [{ id: 'f', storyId: 'story', width: 325, height: 400, mode: 'fixed', inset: { top: 0, right: 0, bottom: 0, left: 0 }, columns: { count: 1, gutter: 0, balance: false }, verticalAlign: 'top' }] });
  const first = source.slice(layout.lines[0]!.start, layout.lines[0]!.end).trim();
  assert.ok(first.split(/\s+/).length > 3, `first line was "${first}"`);
});
