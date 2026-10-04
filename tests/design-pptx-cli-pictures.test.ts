// SPDX-License-Identifier: MPL-2.0
/**
 * Pictures in the CLI's Tier A deck (plan 291 M3b).
 *
 * `lolly run design --document=... --export=pptx` lowers a master-bound Design document
 * with no browser (shells/cli/src/raster.ts `renderDesignPptx`). Its picture reader
 * used to answer only `/catalog/...` paths, so a layer naming a bare catalog id
 * (`lolly/logo/primary`, which is what compose writes for every logo row) or a
 * resolved `data:` URL came out as "a picture was left out", and no SVG picture could
 * travel at all because no rasteriser was passed for its PNG fallback. These cases pin:
 *
 *   - a bare catalog id, a catalog path and a `data:` URL all read their bytes;
 *   - an id the catalog cannot answer alone (an upload, a themed id) goes to the
 *     bridge's own resolver;
 *   - the deck carries the logo as an SVG with a PNG fallback, at the mark's own aspect.
 *
 * Public: the starter brand's own logo and master, under the lolly-start profile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by tests/jsdom.d.ts (no @types/jsdom exists)
import { unzipSync, strFromU8 } from 'fflate';

process.env.LOLLY_PROFILE = 'lolly-start';

import { packPng } from '../engine/src/png.ts';
import { seedFrame } from '../engine/src/slide-master.ts';
import { catalogAssetBytes, dataUrlBytes, renderDesignPptx } from '../shells/cli/src/raster.ts';
import type { DesignBoxRowV1, SlideMasterFileV1 } from '../packages/core/src/index.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const START_MASTERS = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'slides', 'masters.json');
const START_LOGO = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly', 'logo', 'primary.svg');

test('dataUrlBytes: base64 and percent-encoded bodies, and not a data: URL', () => {
  const b64 = dataUrlBytes(`data:image/png;base64,${Buffer.from([1, 2, 3]).toString('base64')}`);
  assert.deepEqual(b64 && [...b64.bytes], [1, 2, 3]);
  assert.equal(b64?.mime, 'image/png');
  const plain = dataUrlBytes(`data:image/svg+xml;charset=utf-8,${encodeURIComponent('<svg viewBox="0 0 1 1"/>')}`);
  assert.equal(plain && new TextDecoder().decode(plain.bytes), '<svg viewBox="0 0 1 1"/>');
  assert.equal(plain?.mime, 'image/svg+xml');
  assert.equal(dataUrlBytes('/catalog/x.png'), null);
  assert.equal(dataUrlBytes('data:image/png;base64,'), null, 'an empty body is no picture');
});

test('catalogAssetBytes: a bare catalog id reads the entry\'s vector, a catalog path its file', async (t) => {
  if (!existsSync(START_LOGO)) { t.skip('brands/lolly-start is not checked out'); return; }
  const want = new Uint8Array(readFileSync(START_LOGO));
  const byId = await catalogAssetBytes('lolly/logo/primary');
  assert.equal(byId?.mime, 'image/svg+xml', 'the vector format is taken first');
  assert.deepEqual(byId?.bytes, want);
  const byPath = await catalogAssetBytes('/catalog/assets/lolly/logo/primary.svg');
  assert.deepEqual(byPath?.bytes, want);
});

test('catalogAssetBytes: a data: URL decodes; an upload or a themed id goes to the bridge', async () => {
  const data = await catalogAssetBytes(`data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff]).toString('base64')}`);
  assert.deepEqual(data && [...data.bytes], [0xff, 0xd8, 0xff]);
  const asked: string[] = [];
  const bridge = async (ref: string) => {
    asked.push(ref);
    return { bytes: new Uint8Array([9]), mime: 'image/png' };
  };
  assert.deepEqual((await catalogAssetBytes('user/media/abc', bridge))?.bytes, new Uint8Array([9]));
  await catalogAssetBytes('lolly/logo/primary?theme=dark', bridge);
  assert.deepEqual(asked, ['user/media/abc', 'lolly/logo/primary?theme=dark']);
  assert.equal(await catalogAssetBytes('user/media/abc'), null, 'with no bridge, an unknown id is a miss');
});

/** A starter-master deck whose logo row gives the bare catalog id, plus one uploaded photo. */
function deckCanvas(): Element {
  const master = (JSON.parse(readFileSync(START_MASTERS, 'utf8')) as SlideMasterFileV1).masters[0]!;
  const seeded = seedFrame(master, 'content', { frameId: 'f0', x: 0, y: 0 });
  assert.ok(seeded, 'the starter master seeds a content frame');
  seeded!.frame.order = 0;
  const logo = seeded!.layers.find((l) => typeof l.furniture === 'string' && String(l.furniture).startsWith('logo'));
  assert.ok(logo, 'the content archetype carries a logo row');
  logo!.image = 'lolly/logo/primary';
  const photo: DesignBoxRowV1 = { id: 'f0.photo', kind: 'image', frame: 'f0', x: 100, y: 200, w: 400, h: 300, image: 'user/media/photo', fit: 'contain', order: 50 };
  const dom = new JSDOM('<!doctype html><html><body><div id="c"></div></body></html>');
  const canvas = dom.window.document.getElementById('c')!;
  const script = dom.window.document.createElement('script');
  script.setAttribute('type', 'application/json');
  script.setAttribute('data-penpot-doc', '');
  script.textContent = JSON.stringify({ boxes: [seeded!.frame, ...seeded!.layers, photo] });
  canvas.appendChild(script);
  return canvas as unknown as Element;
}

test('CLI Tier A: the logo travels as an SVG with a PNG fallback at its own aspect, and an upload resolves through the bridge', async (t) => {
  if (!existsSync(START_MASTERS) || !existsSync(START_LOGO)) { t.skip('brands/lolly-start is not checked out'); return; }
  const photo = packPng(new Uint8Array(40 * 30 * 4).fill(120), { width: 40, height: 30 });
  const bytes = await renderDesignPptx({
    canvas: deckCanvas(), toolId: 'design', brandVar: () => '',
    now: '2026-10-03T00:00:00.000Z',
    assets: {
      get: async (id: string) => (id === 'user/media/photo'
        ? { url: `data:image/png;base64,${Buffer.from(photo).toString('base64')}` }
        : null),
    },
  });
  assert.ok(bytes, 'a master-bound document takes Tier A');
  const zip = unzipSync(bytes!);
  const media = Object.keys(zip).filter((n) => n.startsWith('ppt/media/'));
  assert.ok(media.some((n) => n.endsWith('.svg')), `the logo's vector is in the package: ${media}`);
  assert.equal(media.filter((n) => n.endsWith('.png')).length, 2, `a PNG fallback and the uploaded photo: ${media}`);
  const slide = strFromU8(zip['ppt/slides/slide1.xml']!);
  const pics = [...slide.matchAll(/<p:pic>[\s\S]*?<\/p:pic>/g)].map((m) => m[0]);
  assert.equal(pics.length, 2, 'the logo and the photo are both on the slide');
  const logo = pics.find((p) => /svgBlip/.test(p));
  assert.ok(logo, 'the logo carries an svgBlip');
  const ext = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(logo!)!;
  const svgText = readFileSync(START_LOGO, 'utf8');
  const vb = /viewBox="[\d.\s-]*?([\d.]+)\s+([\d.]+)"/.exec(svgText)!;
  const aspect = Number(vb[1]) / Number(vb[2]);
  assert.ok(Math.abs(Number(ext[1]) / Number(ext[2]) - aspect) < 0.02, `the logo keeps its ${aspect.toFixed(3)} aspect (${ext[1]}x${ext[2]})`);
  const shot = pics.find((p) => !/svgBlip/.test(p))!;
  const photoExt = /<a:ext cx="(\d+)" cy="(\d+)"\/>/.exec(shot)!;
  assert.ok(Math.abs(Number(photoExt[1]) / Number(photoExt[2]) - 4 / 3) < 0.01, 'the uploaded 4:3 photo keeps its aspect in its 4:3 box');
});
