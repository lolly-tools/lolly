// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { designFrames, designPageSvg, type DesignPageSvgHost } from '../engine/src/design-page-svg.ts';
import type { TextShaperV1 } from '../engine/src/design-text-measure.ts';

/** Fixed advances: half the size per character, a quarter for a space. */
const shaper: TextShaperV1 = async (run) => {
  const advances = [...run.text].map((ch) => (ch === ' ' ? run.size / 4 : run.size / 2) + run.tracking);
  return { advances, total: advances.reduce((a, b) => a + b, 0), font: { file: `/fonts/${run.family}.ttf`, variations: { wght: run.weight }, metrics: { upem: 1000, ascent: 980, descent: 280 } } };
};
const host = (extra: Partial<DesignPageSvgHost> = {}): DesignPageSvgHost => ({
  shaper,
  picture: async (ref) => (ref === 'pics/one' ? { info: { width: 40, height: 20 }, href: 'data:image/png;base64,AAAA' } : ref === 'pics/clip' ? { info: { width: 10, height: 10, media: 'motion' }, href: 'data:video/mp4;base64,AAAA' } : null),
  ...extra,
});

const doc = {
  boxes: [
    { id: 'second', kind: 'frame', x: 900, y: 0, w: 300, h: 200, order: 1 },
    { id: 'first', kind: 'frame', x: 500, y: 0, w: 400.4, h: 300, order: 0, name: 'Cover', bg: '#eeeeee' },
    { id: 'gone', kind: 'frame', x: 0, y: 0, w: 100, h: 100, hidden: 'yes' },
    { id: 'pic', kind: 'image', x: 510, y: 10, w: 100, h: 50, frame: 'first', image: { source: 'library', id: 'pics/one', type: 'raster' } },
    { id: 'words', kind: 'text', x: 520, y: 100, w: 200, h: 60, frame: 'first', text: 'Hello', fontSize: 20 },
    { id: 'loose', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: '#000000' },
    { id: 'clip', kind: 'box', x: 910, y: 10, w: 50, h: 50, frame: 'second', image: 'pics/clip' },
  ],
};

test('frames come in page order with their own rows, and hidden frames and loose rows stay out', () => {
  const frames = designFrames(doc);
  assert.deepEqual(frames.map((f) => [f.id, f.width, f.height, f.rows.map((r) => r.id)]), [
    ['first', 400, 300, ['first', 'pic', 'words']],
    ['second', 300, 200, ['second', 'clip']],
  ]);
  assert.deepEqual(designFrames({ boxes: [{ kind: 'frame', w: 10, h: 10 }, { kind: 'box', frame: '0' }] }).map((f) => [f.id, f.rows.length]), [['0', 2]], 'a frame with no id is known by its index, as the renderer knows it');
});

test('a page is the first frame unless one is asked for, drawn from its operations with its pictures embedded', async () => {
  const page = await designPageSvg(doc, undefined, host());
  assert.equal(page.id, 'first');
  assert.match(page.svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="400" height="300" viewBox="0 0 400 300" role="img" aria-label="Cover">/);
  assert.ok(page.svg.includes('href="data:image/png;base64,AAAA" preserveAspectRatio="none"'), 'an asset reference resolves through the host and is embedded at its fitted size');
  assert.ok(page.svg.includes('>Hello</tspan>'), 'without an outliner the words stay live text');
  assert.deepEqual(page.findings, []);
  await assert.rejects(designPageSvg(doc, 'gone', host()), /no visible frame "gone"/);
  await assert.rejects(designPageSvg({ boxes: [] }, undefined, host()), /no frame/);
});

test('a page reports what its operations do not carry, and outlines its words when the host can', async () => {
  const second = await designPageSvg(doc, 'second', host());
  assert.deepEqual(second.findings, [{ id: 'clip', feature: 'image-motion' }], 'a video is reported, not drawn as a still');
  const outlined = await designPageSvg(doc, 'first', host({ toPath: async ({ text }) => ({ d: `M0 0H${text.length}` }) }));
  assert.ok(outlined.svg.includes('d="M0 0H5"') && !outlined.svg.includes('<tspan'), 'outlined words need no font');
});
