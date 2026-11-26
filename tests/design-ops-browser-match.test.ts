// SPDX-License-Identifier: MPL-2.0
/**
 * Three places where a Design page drawn from the operations differed from the browser
 * tier (plan 371, M3a round 2), each now fixed where the operations are written:
 *
 *   1. A vector picture's own size. `imageDimensions` rounds an SVG's size to whole
 *      pixels, which the drawing read to place a picture, so a 44.725 by 19.706 logo was
 *      placed by a 45 by 20 aspect. `svgIntrinsicSize` reads the size unrounded, as the
 *      browser reads one, and the page drawing places by that.
 *   2. Gradient stops. The SVG writer wrote stop offsets and opacities to two places
 *      (whole percent) and CSS's farthest-corner radius as 0.71; the browser draws the
 *      CSS that `gradientSpecToCss` writes, with stops to a hundredth of a percent.
 *   3. Credentials. The web shell lists every credentialed catalog or uploaded picture
 *      the document places, on any page; a page drawn in Node listed only the pictures
 *      it drew. The Node host now lists the same set.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { embedC2pa, extractC2paStore, gradientSpecToCss, imageDimensions } from '@lolly/engine';
import { createRuntime } from '../engine/src/runtime.ts';
import { pictureRect } from '../engine/src/design-draw.ts';
import { designDrawPdf } from '../engine/src/design-draw-pdf.ts';
import { designPageDrawing, designPageSvg } from '../engine/src/design-page-svg.ts';
import { svgIntrinsicSize } from '../engine/src/penpot-file.ts';
import { deckSvgIntrinsicSize } from '../packages/node-shell/src/pptx-deck.ts';
import { designOpsSvgNode } from '../packages/node-shell/src/design-ops-svg.ts';
import { designOpsPdfNode } from '../packages/node-shell/src/design-ops-pdf.ts';
import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { createNodeTextShaper } from '../packages/node-shell/src/text-measure.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { encodePng } from './helpers/studio3d-glb.ts';

const ROOT = repoRoot();
const enc = (s: string) => new TextEncoder().encode(s);
const LOGO = enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44.725 19.706"><rect width="44.725" height="19.706" fill="#50c369"/></svg>');

// ── 1. a vector picture's own size ─────────────────────────────────────────────

test('an SVG picture keeps the size the browser reads: unrounded, from width and height, else the viewBox', () => {
  assert.deepEqual(svgIntrinsicSize(LOGO), { w: 44.725, h: 19.706, natural: false }, 'a viewBox alone gives the aspect, unrounded');
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="10.5" height="4.25"/>')), { w: 10.5, h: 4.25, natural: true });
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="100" viewBox="0 0 50 25"/>')), { w: 100, h: 50, natural: true }, 'one side and the viewBox aspect');
  assert.deepEqual(svgIntrinsicSize(enc('<svg height="30" viewBox="0 0 50 25"/>')), { w: 60, h: 30, natural: true });
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="50%" height="100%" viewBox="0 0 50 25"/>')), { w: 50, h: 25, natural: false }, 'a percentage is no size of its own');
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="2em" height="1in"/>')), { w: 32, h: 96, natural: true }, 'em at the initial 16 px');
  // em and rem follow the root's own font size, an inline style before the attribute.
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="2em" height="32" font-size="32" viewBox="0 0 2 1"/>')), { w: 64, h: 32, natural: true });
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="2rem" height="1em" font-size="24pt" style="font-size: 10px"/>')), { w: 20, h: 10, natural: true });
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="2em" height="1em" font-size="150%"/>')), { w: 48, h: 24, natural: true });
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="2em" height="32" viewBox="0 0 1 1" style="font-size:32px !important"/>')), { w: 64, h: 32, natural: true }, 'an important declaration');
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="1em" height="1em" style="font-size: 10px; font-size: 20px"/>')), { w: 20, h: 20, natural: true }, 'the last declaration wins');
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="1em" height="1em" style="font-size: 30px !important; font-size: 20px"/>')), { w: 30, h: 30, natural: true }, 'an important one beats a later plain one');
  assert.deepEqual(svgIntrinsicSize(enc('<svg width="2em" height="30" font-size="larger" viewBox="0 0 2 1"/>')), { w: 60, h: 30, natural: true },
    'a font size this reader cannot resolve leaves the em side to the viewBox aspect');
  assert.equal(svgIntrinsicSize(enc('<svg/>')), null);
  assert.equal(svgIntrinsicSize(enc('not markup')), null);

  // A caller that stores a pixel size keeps whole pixels, and a raster is read as before.
  assert.deepEqual(imageDimensions(LOGO, 'image/svg+xml'), { w: 45, h: 20 });
  assert.deepEqual(imageDimensions(encodePng(7, 3, () => [0, 0, 0, 255])), { w: 7, h: 3 });
  // The deck writer reads the same rule.
  assert.deepEqual(deckSvgIntrinsicSize(LOGO), svgIntrinsicSize(LOGO));
});

test('a contained SVG logo is placed by its exact aspect, as the browser places it', async () => {
  const values = { boxes: [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 400, h: 200, bg: '#ffffff', order: 0 },
    { id: 'logo', kind: 'image', frame: 'f', x: 50, y: 50, w: 300, h: 90, image: 'lolly/logo', fit: 'contain' },
  ] };
  const host = { shaper: createNodeTextShaper({ repoRoot: ROOT }), picture: async () => ({ bytes: LOGO }) };
  const { page } = await designPageDrawing(values, 'f', host);
  const op = page.ops.find((o) => o.id === 'logo')!;
  assert.deepEqual(op.picture!.natural, { width: 44.725, height: 19.706 });
  const exact = pictureRect(op.picture!, { width: 44.725, height: 19.706 });
  const rounded = pictureRect(op.picture!, { width: 45, height: 20 });
  // 90 px tall: 204.3 px wide in the browser, snapped to the pixel edges a replaced element takes.
  assert.equal(exact.w, 204);
  assert.equal(rounded.w, 202, 'what the rounded size placed');
  const svg = (await designPageSvg(values, 'f', host)).svg;
  const image = /<image x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/.exec(svg);
  assert.ok(image, 'the logo is drawn');
  assert.deepEqual(image.slice(1).map(Number), [exact.x, exact.y, exact.w, exact.h]);
});

// ── 2. gradient stops ───────────────────────────────────────────────────────────

test('gradient stops are written where the browser draws them: CSS percent to a hundredth, alpha to the byte', async () => {
  // OKLab by default: baking adds sRGB stops between the authored ones (12.5%, 37.5%, ...).
  const spec = 'lin_90_ff000080-0_0000ff-100';
  const values = { boxes: [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 360, h: 100, order: 0 },
    { id: 'g', kind: 'box', frame: 'f', x: 0, y: 0, w: 360, h: 100, grad: spec },
  ] };
  const host = { shaper: createNodeTextShaper({ repoRoot: ROOT }), picture: async () => null };
  const svg = (await designPageSvg(values, 'f', host)).svg;
  const written = [...svg.matchAll(/<stop offset="([^"]+)" stop-color="(#[0-9a-f]{6})"(?: stop-opacity="([^"]+)")?\/>/g)]
    .map((m) => ({ offset: Number(m[1]), color: m[2], opacity: m[3] === undefined ? 1 : Number(m[3]) }));
  const css = [...gradientSpecToCss(spec)!.matchAll(/#([0-9a-f]{6})([0-9a-f]{2})? ([0-9.]+)%/g)]
    .map((m) => ({ offset: Number(m[3]) / 100, color: `#${m[1]}`, alpha: m[2] === undefined ? 255 : Number.parseInt(m[2], 16) }));
  assert.ok(css.length > 2, 'the OKLab ramp is baked into extra stops');
  assert.ok(css.some((s) => Math.abs(s.offset * 100 - Math.round(s.offset * 100)) > 1e-9), 'a stop between whole percents');
  assert.equal(written.length, css.length);
  for (const [i, stop] of css.entries()) {
    assert.equal(written[i]!.offset, Math.round(stop.offset * 1e4) / 1e4, `stop ${i}: the CSS position`);
    assert.equal(written[i]!.color, stop.color);
    assert.equal(Math.round(written[i]!.opacity * 255), stop.alpha, `stop ${i}: the CSS alpha byte`);
  }
});

test('a radial gradient reaches the farthest corner at the square root of one half, in SVG and PDF', async () => {
  const values = { boxes: [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 130, h: 90, order: 0 },
    { id: 'r', kind: 'box', frame: 'f', x: 0, y: 0, w: 130, h: 90, grad: 'rad_0_ffffff-0_ffffff00-100' },
  ] };
  const host = { shaper: createNodeTextShaper({ repoRoot: ROOT }), picture: async () => null };
  const svg = (await designPageSvg(values, 'f', host)).svg;
  assert.match(svg, /<radialGradient id="[^"]+" cx="0\.5" cy="0\.5" r="0\.7071068">/);
  assert.doesNotMatch(svg, /r="0\.71"/);
  const { page } = await designPageDrawing(values, 'f', host);
  const pdf = new TextDecoder('latin1').decode(designDrawPdf([{ page, pictures: new Map(), size: { w: 130, h: 90 } }]));
  assert.match(pdf, /\/ShadingType 3 \/ColorSpace \/DeviceRGB \/Coords \[0 0 0 0 0 0\.7071\]/);
});

// ── 3. the document's credentialed pictures ────────────────────────────────────

/** A 4 by 4 PNG carrying its own credential, titled so a list reads back. */
const signedPng = (title: string, rgb: [number, number, number]) => embedC2pa(encodePng(4, 4, () => [...rgb, 255]), 'png', { title, claimGenerator: 'Lolly test' });

test('a page drawn in Node lists every credentialed picture the document places, as the web shell lists them', async () => {
  const files: Record<string, { source: string; bytes: Uint8Array }> = {
    'pictures/cover': { source: 'library', bytes: await signedPng('Cover photo', [30, 140, 80]) },
    'pictures/second': { source: 'library', bytes: await signedPng('Second photo', [140, 30, 80]) },
    'user/upload/third': { source: 'user', bytes: await signedPng('Third photo', [80, 30, 140]) },
    'https://example.com/remote.png': { source: 'remote', bytes: await signedPng('Remote photo', [10, 10, 10]) },
    'pictures/plain': { source: 'library', bytes: encodePng(4, 4, () => [200, 200, 200, 255]) },
  };
  const rows = [
    { id: 'cover', kind: 'frame', x: 0, y: 0, w: 320, h: 200, bg: '#ffffff', order: 0 },
    { id: 'p1', kind: 'image', frame: 'cover', x: 20, y: 20, w: 100, h: 100, image: 'pictures/cover' },
    { id: 'second', kind: 'frame', x: 400, y: 0, w: 320, h: 200, bg: '#ffffff', order: 1 },
    { id: 'p2', kind: 'image', frame: 'second', x: 420, y: 20, w: 100, h: 100, image: 'pictures/second' },
    { id: 'p3', kind: 'image', frame: 'second', x: 540, y: 20, w: 100, h: 100, image: { id: 'user/upload/third', source: 'user' } },
    { id: 'p4', kind: 'image', frame: 'second', x: 420, y: 130, w: 50, h: 50, image: 'https://example.com/remote.png' },
    { id: 'p5', kind: 'image', frame: 'second', x: 480, y: 130, w: 50, h: 50, image: 'pictures/plain' },
    { id: 'p6', kind: 'image', frame: 'second', x: 540, y: 130, w: 50, h: 50, image: 'pictures/second' },
  ];
  const assets = {
    get: async (id: string) => {
      const file = files[id];
      if (!file) throw new Error(`no asset ${id}`);
      return { id, source: file.source, type: 'raster', format: 'png', url: `file:///${encodeURIComponent(id)}.png` };
    },
    bytes: async (ref: { id: string }) => files[ref.id]!.bytes,
  };
  const host = { text: createNodeTextAPI({ repoRoot: ROOT }), assets, log: () => {} } as unknown as HostV1;
  const titles = async (list: Array<{ activeLabel: string }>) => {
    const byLabel = new Map<string, string>();
    for (const [title, file] of Object.entries(files)) {
      const store = extractC2paStore(file.bytes);
      if (store) byLabel.set((await import('@lolly/engine')).prepareC2paIngredientFromStore(store.store, store.format)!.activeLabel, title);
    }
    return list.map((i) => byLabel.get(i.activeLabel));
  };

  // The web shell's list: the runtime's walk over the placed assets, read through `credential`.
  const rendered: Array<{ ingredients?: Array<{ activeLabel: string; relationship?: string }> }> = [];
  const web = {
    version: '1', profile: { get: async () => ({}) }, log: () => {},
    assets: {
      get: assets.get,
      credential: async (id: string) => { const s = extractC2paStore(files[id]!.bytes); return s ? { store: s.store, format: s.format } : null; },
    },
    export: { render: async (_n: unknown, _f: string, opts: never) => { rendered.push(opts); return {}; } },
  };
  const tool = {
    manifest: {
      id: 'design-ingredients-parity', name: 'Page', version: '1.0.0', engineVersion: '^1.0.0', status: 'official',
      render: { width: 10, height: 10, formats: ['png'] },
      inputs: [{ id: 'boxes', type: 'blocks', fields: [{ id: 'image', type: 'asset' }] }],
    },
    template: '<b>x</b>',
  };
  const runtime = await createRuntime(tool as never, web as never, { boxes: rows.filter((r) => r.image).map((r) => ({ image: { id: typeof r.image === 'string' ? r.image : r.image!.id } })) } as never);
  await runtime.export({} as never, 'png', {});
  const webList = await titles(rendered[0]!.ingredients ?? []);
  assert.deepEqual(webList, ['pictures/cover', 'pictures/second', 'user/upload/third'], 'the web shell: catalog and uploaded pictures on every page, once each');

  const svg = await designOpsSvgNode({ getAttribute: (n: string) => (n === 'data-frame-id' ? 'cover' : null) } as unknown as Element,
    { sourceDocument: { toolId: 'design', values: { boxes: rows } } } as never, host, { repoRoot: ROOT });
  assert.ok(svg && 'svg' in svg, svg && 'reason' in svg ? svg.reason : 'no page');
  assert.deepEqual(await titles(svg.ingredients), webList, 'SVG: the same list, the second page\'s pictures included');
  assert.ok(svg.ingredients.every((i) => i.relationship === 'componentOf'));

  const pages = { querySelectorAll: () => [{ getAttribute: () => 'cover' }] } as unknown as Element;
  const pdf = await designOpsPdfNode(pages, { sourceDocument: { toolId: 'design', values: { boxes: rows } }, convertPaths: true }, host, { repoRoot: ROOT });
  assert.ok(pdf && 'pdf' in pdf, pdf && 'reason' in pdf ? pdf.reason : 'no page');
  assert.deepEqual(await titles(pdf.ingredients), webList, 'PDF: the same list');

  // A pinned picture is read at the version the document holds, as the web shell reads one.
  const asked: Array<{ id: string; opts?: { version?: string } }> = [];
  const pinnedHost = { ...host, assets: { ...assets, get: async (id: string, opts?: { version?: string }) => { asked.push({ id, ...(opts ? { opts } : {}) }); return assets.get(id); } } } as unknown as HostV1;
  const pinned = rows.map((r) => (r.id === 'p2' ? { ...r, image: { id: 'pictures/second', pin: { version: 'v1' } } } : r));
  const atVersion = await designOpsSvgNode({ getAttribute: (n: string) => (n === 'data-frame-id' ? 'cover' : null) } as unknown as Element,
    { sourceDocument: { toolId: 'design', values: { boxes: pinned } } } as never, pinnedHost, { repoRoot: ROOT });
  assert.ok(atVersion && 'svg' in atVersion, atVersion && 'reason' in atVersion ? atVersion.reason : 'no page');
  assert.ok(asked.some((a) => a.id === 'pictures/second' && a.opts?.version === 'v1'), 'the pin travels to the asset read');
  assert.equal(new Set(atVersion.ingredients.map((i) => i.activeLabel)).size, atVersion.ingredients.length, 'the pinned and the unpinned reference are each read, and one manifest is listed once');

  // A picture only the page draws, from a link, is listed after the document's, as the web shell's page host adds one.
  const drawnRemote = rows.map((r) => (r.id === 'p1' ? { ...r, image: 'https://example.com/remote.png' } : r));
  const linked = await designOpsSvgNode({ getAttribute: (n: string) => (n === 'data-frame-id' ? 'cover' : null) } as unknown as Element,
    { sourceDocument: { toolId: 'design', values: { boxes: drawnRemote } } } as never, host, { repoRoot: ROOT });
  assert.ok(linked && 'svg' in linked, linked && 'reason' in linked ? linked.reason : 'no page');
  assert.deepEqual(await titles(linked.ingredients), ['pictures/second', 'user/upload/third', 'https://example.com/remote.png']);
});
