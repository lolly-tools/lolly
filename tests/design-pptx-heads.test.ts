// SPDX-License-Identifier: MPL-2.0
/**
 * Tier A PowerPoint parity for paths and text (plan 291 W5): the row lowering in
 * packages/node-shell/src/design-pptx.ts, which the CLI uses for frames bound to a slide
 * master, writes arrowheads as DrawingML line ends and line height as an exact pitch,
 * the same way the deck model (Tier B, tests/design-pptx.test.ts) already does.
 *
 * The frames are seeded from the public starter brand's master, like the plan 274 tests.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildPptxParts, type PptxPath, type PptxText } from '../engine/src/pptx.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { designFramesToPptx, hasMasterBindings } from '../packages/node-shell/src/design-pptx.ts';
import type { DesignBoxRowV1, SlideMasterFileV1, SlideMasterV1 } from '../packages/core/src/index.ts';
import { designPathPlacement } from '../engine/src/design-path-author.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER_FILE = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'slides', 'masters.json');
const master: SlideMasterV1 = (JSON.parse(readFileSync(MASTER_FILE, 'utf8')) as SlideMasterFileV1).masters[0]!;

/** One master-bound content frame carrying extra layers. */
function boundFrame(extra: DesignBoxRowV1[]): Array<{ row: DesignBoxRowV1; layers: DesignBoxRowV1[] }> {
  const seeded = seedFrame(master, 'content', { frameId: 'f1', x: 0, y: 0 });
  assert.ok(seeded, 'the starter master ships the content archetype');
  seeded!.frame.order = 0;
  return [{ row: seeded!.frame, layers: [...seeded!.layers, ...extra] }];
}

/** A path row from absolute points, the way an agent states one. */
function pathRow(id: string, points: Array<[number, number]>, paint: Record<string, string | number>, closed = false): DesignBoxRowV1 {
  const placed = designPathPlacement({ points, closed }, paint);
  return { id, kind: 'path', frame: 'f1', x: placed.x, y: placed.y, w: placed.w, h: placed.h, path: placed.path, bg: '', ...paint };
}

const pathsOf = (shapes: unknown[]): PptxPath[] => shapes.filter((s): s is PptxPath => (s as { kind?: string }).kind === 'path');

test('Tier A: arrowheads on a master-bound frame become line ends, with the deck model map', async () => {
  const stroke = { stroke: '#123456', strokeW: 6 };
  const frames = boundFrame([
    pathRow('arrow', [[100, 600], [160, 600]], { ...stroke, headEnd: 'open' }),
    pathRow('both', [[100, 650], [160, 650]], { ...stroke, headStart: 'circle', headEnd: 'triangle' }),
    pathRow('diamond', [[100, 700], [160, 700]], { ...stroke, headStart: 'diamond' }),
    pathRow('loop', [[300, 600], [360, 600], [360, 660]], { ...stroke, headEnd: 'open' }, true),
    pathRow('unstroked', [[300, 700], [360, 700]], { headEnd: 'open' }),
  ]);
  assert.ok(hasMasterBindings({ boxes: frames.flatMap((f) => [f.row, ...f.layers]) } as never), 'the frame is bound, so the CLI routes it through Tier A');
  const out = await designFramesToPptx({ frames, master });
  const [arrow, both, diamond, loop, unstroked] = pathsOf(out.slides[0]!.shapes);
  assert.deepEqual([arrow!.line?.head, arrow!.line?.tail], [undefined, 'arrow'], 'an open head is an arrow at the far end');
  assert.deepEqual([both!.line?.head, both!.line?.tail], ['oval', 'triangle']);
  assert.deepEqual([diamond!.line?.head, diamond!.line?.tail], ['diamond', undefined]);
  assert.equal(loop!.line?.tail, undefined, 'a closed contour has no ends to decorate');
  assert.equal(unstroked!.line, undefined, 'no stroke, no line, so no ends');

  const parts = buildPptxParts(out.slides, { theme: out.theme, layouts: out.layouts, now: '2026-10-03T00:00:00.000Z' });
  const xml = parts['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:tailEnd type="arrow"\/>/);
  assert.match(xml, /<a:headEnd type="oval"\/><a:tailEnd type="triangle"\/><\/a:ln>/);
  assert.match(xml, /<a:headEnd type="diamond"\/>/);
});

test('Tier A: a bar head has no line end, and the notes say so', async () => {
  const frames = boundFrame([pathRow('bar', [[100, 600], [160, 600]], { stroke: '#123456', strokeW: 4, headEnd: 'bar' })]);
  const out = await designFramesToPptx({ frames, master });
  const [bar] = pathsOf(out.slides[0]!.shapes);
  assert.ok(bar!.line, 'the line is kept');
  assert.equal(bar!.line!.tail, undefined);
  assert.ok(out.notes.some((n) => /bar arrowhead has no PowerPoint line end/.test(n)), `notes: ${out.notes.join(' | ')}`);
});

test('Tier A: an inherited key is not a head', async () => {
  const frames = boundFrame([pathRow('odd', [[100, 600], [160, 600]], { stroke: '#123456', strokeW: 4 })]);
  frames[0]!.layers[frames[0]!.layers.length - 1]!.headEnd = 'constructor';
  const out = await designFramesToPptx({ frames, master });
  assert.equal(pathsOf(out.slides[0]!.shapes)[0]!.line!.tail, undefined);
});

test('Tier A: line height travels as an exact pitch in points, defaulting to the canvas 1.12', async () => {
  const frames = boundFrame([
    { id: 'tall', kind: 'text', frame: 'f1', x: 10, y: 10, w: 400, h: 200, text: 'One\nTwo', fontSize: 40, lineHeight: 1.5, weight: '400' },
    { id: 'plain', kind: 'text', frame: 'f1', x: 10, y: 300, w: 400, h: 200, text: 'Three', fontSize: 40, weight: '400' },
    { id: 'texty', kind: 'text', frame: 'f1', x: 10, y: 500, w: 400, h: 200, text: 'Four', fontSize: '30' as never, lineHeight: '1.3' as never, weight: '400' },
  ]);
  const out = await designFramesToPptx({ frames, master });
  const texts = out.slides[0]!.shapes.filter((s): s is PptxText => s.kind === 'text');
  const byText = (t: string): PptxText => texts.find((s) => s.paras.some((p) => p.runs.some((r) => r.text === t)))!;
  assert.deepEqual(byText('One').paras.map((p) => p.lineSpacingPt), [45, 45], '1.5 x 40px = 60px = 45pt, on every paragraph');
  assert.equal(byText('Three').paras[0]!.lineSpacingPt, 33.6, '1.12 x 40px = 44.8px = 33.6pt');
  assert.equal(byText('Four').paras[0]!.lineSpacingPt, 29.25, 'numeric strings read as numbers: 1.3 x 30px = 29.25pt');
  const xml = buildPptxParts(out.slides, { theme: out.theme, layouts: out.layouts, now: '2026-10-03T00:00:00.000Z' })['ppt/slides/slide1.xml'] as string;
  assert.match(xml, /<a:lnSpc><a:spcPts val="4500"\/><\/a:lnSpc>/);
});

test('Tier A through the CLI: a master-bound frame with an arrow writes a:tailEnd', async () => {
  const arrow = designPathPlacement({ points: [[945, 400], [995, 400]] }, { stroke: '#123456', strokeW: 6, headEnd: 'open' });
  const bx = JSON.stringify([
    { id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0, bg: '#ffffff', master: master.id, archetype: 'title' },
    { id: 't1', kind: 'text', frame: 'f1', x: 60, y: 200, w: 900, h: 200, text: 'Arrows', fontSize: 64, role: 'title', master: master.id, order: 1 },
    { id: 'a1', kind: 'path', frame: 'f1', x: arrow.x, y: arrow.y, w: arrow.w, h: arrow.h, path: arrow.path, bg: '', stroke: '#123456', strokeW: 6, headEnd: 'open', order: 2 },
  ]);
  const dir = mkdtempSync(join(tmpdir(), 'lolly-heads-cli-'));
  const out = join(dir, 'deck.pptx');
  execFileSync(process.execPath, [join(REPO, 'shells', 'cli', 'bin', 'lolly.ts'), 'design', '--export=pptx', `--bx=${bx}`, `--output=${out}`], {
    cwd: REPO,
    env: { ...process.env, LOLLY_PROFILE: 'lolly-start' },
    stdio: 'ignore',
    timeout: 120_000,
  });
  const { unzipSync } = await import('fflate');
  const entries = unzipSync(new Uint8Array(readFileSync(out)));
  assert.ok(entries['ppt/slideLayouts/slideLayout1.xml'], 'Tier A wrote the master layouts');
  const slide1 = new TextDecoder().decode(entries['ppt/slides/slide1.xml']!);
  assert.match(slide1, /<a:custGeom>/, 'the path is custom geometry');
  assert.match(slide1, /<a:tailEnd type="arrow"\/>/, 'and its open head is the line end');
});

test('Tier A: every supported open-path end retains exact DrawingML at both ends', async () => {
  const ends = { triangle: 'triangle', open: 'arrow', circle: 'oval', diamond: 'diamond' } as const;
  const rows = Object.keys(ends).flatMap((end, index) => [
    pathRow(`start-${end}`, [[100.125, 100.375 + index * 40], [160.625, 130.875 + index * 40]], { stroke: '#12345680', strokeW: 1.125, headStart: end }),
    pathRow(`end-${end}`, [[300.125, 100.375 + index * 40], [360.625, 130.875 + index * 40]], { stroke: '#12345680', strokeW: 1.125, headEnd: end }),
    pathRow(`both-${end}`, [[500.125, 100.375 + index * 40], [560.625, 130.875 + index * 40]], { stroke: '#12345680', strokeW: 1.125, headStart: end, headEnd: end, flipH: 'true', flipV: 'true' }),
  ]);
  const out = await designFramesToPptx({ frames: boundFrame(rows), master }), shapes = pathsOf(out.slides[0]!.shapes);
  assert.equal(shapes.length, rows.length);
  Object.values(ends).forEach((end, index) => {
    assert.deepEqual(shapes.slice(index * 3, index * 3 + 3).map(shape => [shape.line?.head, shape.line?.tail]), [[end, undefined], [undefined, end], [end, end]]);
  });
  for (const shape of shapes) assert.equal(shape.paths[0]!.d.includes('Z'), false);
  const xml = buildPptxParts(out.slides, { theme: out.theme, layouts: out.layouts, now: '2026-10-03T00:00:00.000Z' })['ppt/slides/slide1.xml'] as string;
  assert.equal((xml.match(/<a:headEnd /g) ?? []).length, 8); assert.equal((xml.match(/<a:tailEnd /g) ?? []).length, 8);
  for (const end of Object.values(ends)) {
    assert.ok(xml.includes(`<a:ln w="10716"><a:solidFill><a:srgbClr val="123456"><a:alpha val="50200"/></a:srgbClr></a:solidFill><a:headEnd type="${end}"/><a:tailEnd type="${end}"/></a:ln>`), end);
  }
});
