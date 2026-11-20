// SPDX-License-Identifier: MPL-2.0
/**
 * A Design page's PNG with no browser (plan 371, M3a): the operations SVG with outlined
 * words, drawn by resvg and finished as the web shell finishes a PNG
 * (packages/node-shell/src/design-still.ts, wired into shells/cli/src/raster.ts).
 *
 * The route is taken when no browser render tier is available, where the export used to
 * fail, or when LOLLY_DESIGN_RASTER=resvg asks for this route. With a browser tier present and no
 * request, the browser tier keeps the page. A page the route would not draw as the
 * browser draws it goes to the browser tier with its reason in the log.
 *
 * Run with: node --test tests/design-still-no-browser.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { JSDOM } from 'jsdom';
import { embedC2pa, extractC2paStore, prepareC2paIngredientFromStore, verifyC2pa } from '@lolly/engine';
import { designRasterChoice, designStillDecision, designStillNote, designStillSize, drawDesignStill, premultipliedGradients, resvgRefusals, roundedFrameClips, designResvgRenderer } from '../packages/node-shell/src/design-still.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { uncomposedToolLinks } from '../shells/cli/src/raster.ts';
import { createCliBridge } from '../shells/cli/src/bridge.ts';
import { encodePng } from './helpers/studio3d-glb.ts';

const ROOT = repoRoot();
const boxes = [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 640, h: 400, bg: '#f4f1ea', order: 0 },
  { id: 'title', kind: 'text', x: 40, y: 40, w: 560, h: 120, text: 'Drawn **without** a browser', fontSize: 40, frame: 'cover' },
  { id: 'chip', kind: 'box', x: 40, y: 200, w: 200, h: 80, bg: '#1c7ed6', shape: 'rounded', radius: 16, stroke: '#0b7285', strokeW: 4, frame: 'cover' },
];

test('LOLLY_DESIGN_RASTER reads auto and resvg, and reports any other value', () => {
  assert.deepEqual(designRasterChoice({}), { choice: 'auto' });
  assert.deepEqual(designRasterChoice({ LOLLY_DESIGN_RASTER: ' Auto ' }), { choice: 'auto' });
  assert.deepEqual(designRasterChoice({ LOLLY_DESIGN_RASTER: 'RESVG' }), { choice: 'resvg' });
  assert.deepEqual(designRasterChoice({ LOLLY_DESIGN_RASTER: 'gpu' }), { choice: 'auto', ignored: 'gpu' });
});

test('the browser tier keeps a Design PNG unless none is here or the route is asked for', () => {
  const present = () => ({ available: true });
  const absent = () => ({ available: false, reason: 'no Chromium' });
  assert.equal(designStillDecision({}, present).draw, 'browser');
  assert.match(designStillDecision({}, present).because, /browser render tier is available/);
  assert.deepEqual(designStillDecision({}, absent), { draw: 'here', because: 'no browser render tier is available (no Chromium)' });
  assert.equal(designStillDecision({ LOLLY_DESIGN_RASTER: 'resvg' }, present).draw, 'here');
  assert.deepEqual(designStillDecision({ LOLLY_DESIGN_RASTER: 'gpu' }, present), { draw: 'browser', because: designStillDecision({}, present).because, ignored: 'gpu' });
});

test('the pixel box is the one the browser tier draws, and a size it would crop is refused', () => {
  const page = { width: 640, height: 400 };
  assert.deepEqual(designStillSize(page, {}), { width: 640, height: 400, dpi: 96 }, 'the page at its own size, 96 dpi');
  assert.deepEqual(designStillSize(page, { width: 1280, height: 800 }), { width: 1280, height: 800, dpi: 96 });
  assert.deepEqual(designStillSize(page, { width: 100, height: 62.5, unit: 'mm', dpi: 300 }), { width: 1181, height: 738, dpi: 300 }, 'measured on the browser tier: 1181 x 738 at 300 dpi');
  assert.deepEqual(designStillSize(page, { width: 100, height: 62.5, unit: 'mm' }), { width: 1181, height: 738, dpi: 300 }, 'a physical size with no dpi is drawn at 300');
  assert.match((designStillSize(page, { width: 1280 }) as { reason: string }).reason, /one side/);
  assert.match((designStillSize(page, { width: 400, height: 800 }) as { reason: string }).reason, /proportions \(the page is 640 x 400\)/);
  assert.match((designStillSize(page, { width: 1e308, height: 1e308, unit: 'in' }) as { reason: string }).reason, /over 16384 px a side/, 'an overflowing size is refused, never drawn at some other size');
  assert.match((designStillSize({ width: 20000, height: 100 }, {}) as { reason: string }).reason, /over 16384 px a side/);
});

test('resvg limits are refused by name: live text, HTML, pictures it does not decode or turn, an unknown blend', async () => {
  const wrap = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10">${body}</svg>`;
  const png = `data:image/png;base64,${Buffer.from(encodePng(2, 2, () => [200, 40, 40, 255])).toString('base64')}`;
  assert.deepEqual(resvgRefusals(wrap(`<rect width="10" height="10"/><image href="${png}" width="10" height="10"/><g style="mix-blend-mode:multiply"></g>`)), []);
  assert.match(resvgRefusals(wrap('<text x="0" y="8">Hi</text>')).join(), /live text/);
  assert.match(resvgRefusals(wrap('<foreignObject width="10" height="10"></foreignObject>')).join(), /HTML/);
  assert.match(resvgRefusals(wrap('<image href="data:image/webp;base64,UklGRg==" width="10" height="10"/>')).join(), /WebP/);
  assert.match(resvgRefusals(wrap('<image href="https://example.com/a.png" width="10" height="10"/>')).join(), /points outside the page/);
  assert.match(resvgRefusals(wrap('<g style="mix-blend-mode:plus-lighter"></g>')).join(), /plus-lighter/);
  // A vector picture of any kind: its edges are anti-aliased differently (the Lolly logo, 0.73% of its region over 24 levels).
  const asPicture = (markup: string) => `<image href="data:image/svg+xml;base64,${Buffer.from(markup).toString('base64')}" width="10" height="10"/>`;
  assert.match(resvgRefusals(wrap(asPicture('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 80"><path d="M0 0h1v1z"/></svg>'))).join(), /vector picture, whose edges/);
  const aliased = `<image xmlns:l="http://www.w3.org/1999/xlink" l:href="data:image/svg+xml;base64,${Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>').toString('base64')}" width="10" height="10"/>`;
  assert.match(resvgRefusals(wrap(aliased)).join(), /vector picture, whose edges/, 'under any namespace prefix');
  assert.match(resvgRefusals(wrap('<s:text xmlns:s="http://www.w3.org/2000/svg">Hi</s:text>')).join(), /live text/, 'a prefixed element is still found');
  let sharp: typeof import('sharp').default | undefined;
  try { sharp = (await import('sharp')).default; } catch { /* the Exif case needs sharp to write its JPEG */ }
  if (sharp) {
    const turned = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#ff0000' } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
    assert.match(resvgRefusals(wrap(`<image href="data:image/jpeg;base64,${turned.toString('base64')}" width="10" height="10"/>`)).join(), /Exif orientation/);
    const p3 = (format: 'png' | 'jpeg') => sharp!({ create: { width: 4, height: 2, channels: 3, background: '#ff0000' } }).withIccProfile('p3')[format]().toBuffer();
    assert.match(resvgRefusals(wrap(`<image href="data:image/png;base64,${(await p3('png')).toString('base64')}" width="10" height="10"/>`)).join(), /PNG picture with a colour profile other than sRGB/);
    assert.match(resvgRefusals(wrap(`<image href="data:image/jpeg;base64,${(await p3('jpeg')).toString('base64')}" width="10" height="10"/>`)).join(), /JPEG picture with a colour profile other than sRGB/);
    const srgb = (format: 'png' | 'jpeg') => sharp!({ create: { width: 4, height: 2, channels: 3, background: '#ff0000' } }).withIccProfile('srgb')[format]().toBuffer();
    assert.deepEqual(resvgRefusals(wrap(`<image href="data:image/png;base64,${(await srgb('png')).toString('base64')}" width="10" height="10"/>`)), [], 'an sRGB profile, read from its colorants and curves');
    assert.deepEqual(resvgRefusals(wrap(`<image href="data:image/jpeg;base64,${(await srgb('jpeg')).toString('base64')}" width="10" height="10"/>`)), []);
    const upright = await sharp({ create: { width: 4, height: 2, channels: 3, background: '#ff0000' } }).jpeg().toBuffer();
    assert.deepEqual(resvgRefusals(wrap(`<image href="data:image/jpeg;base64,${upright.toString('base64')}" width="10" height="10"/>`)), []);
  }
});

test('a gradient that blends through transparency is rewritten so resvg blends it as the browser does', () => {
  const svg = (stops: string) => `<svg xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="g" x1="0" y1="0" x2="100" y2="0">${stops}</linearGradient></defs></svg>`;
  const opaque = svg('<stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/>');
  assert.deepEqual(premultipliedGradients(opaque), { svg: opaque }, 'opaque stops blend the same either way');
  const fade = svg('<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/>');
  assert.deepEqual(premultipliedGradients(fade), { svg: fade }, 'one colour fading out blends the same either way');
  const rewritten = premultipliedGradients(svg('<stop offset="0" stop-color="#ff0000" stop-opacity="0"/><stop offset="1" stop-color="#0000ff"/>'));
  assert.ok('svg' in rewritten);
  const stops = [...rewritten.svg.matchAll(/<stop offset="([\d.]+)" stop-color="(#[0-9a-f]{6})"(?: stop-opacity="([\d.]+)")?\/>/g)];
  assert.equal(stops.length, 33);
  assert.ok(stops.every((s) => s[2] === '#0000ff'), 'a transparent stop takes the colour it blends towards, as premultiplying does');
  assert.deepEqual([stops[16]![1], stops[16]![3]], ['0.5', '0.5']);
  assert.deepEqual(premultipliedGradients(svg('<stop offset="0" stop-color="red" stop-opacity="0"/><stop offset="1" stop-color="#0000ff"/>')), { reason: 'a gradient whose stop colours this route cannot read' });
});

test('a row a rounded frame clips along its curve sends the page to the browser tier', () => {
  const frame = { id: 'board', kind: 'frame', x: 0, y: 0, w: 640, h: 400, shape: 'rounded', radius: 48, stroke: '#364fc7', strokeW: 10 };
  const on = (row: Record<string, unknown>) => ({ frame: 'board', kind: 'box', ...row });
  assert.deepEqual(roundedFrameClips([frame, on({ id: 'edge', x: -30, y: 300, w: 200, h: 140 })], 'board'), ['edge'], 'over the bottom left curve');
  assert.deepEqual(roundedFrameClips([frame, on({ id: 'side', x: 200, y: 300, w: 200, h: 140 })], 'board'), [], 'over a straight edge only');
  assert.deepEqual(roundedFrameClips([frame, on({ id: 'inside', x: 240, y: 120, w: 160, h: 160 })], 'board'), [], 'well inside the curves');
  assert.deepEqual(roundedFrameClips([{ ...frame, radius: 0 }, on({ id: 'edge', x: -30, y: 300, w: 200, h: 140 })], 'board'), [], 'square corners clip with straight edges');
  assert.deepEqual(roundedFrameClips([{ ...frame, shape: 'rect' }, on({ id: 'edge', x: -30, y: 300, w: 200, h: 140 })], 'board'), [], 'a rect frame keeps square corners whatever its radius');
  assert.deepEqual(roundedFrameClips([frame, on({ id: 'near', x: 60, y: 20, w: 20, h: 20, stroke: '#000000', strokeW: 30 })], 'board'), ['near'], 'a border that reaches the curve counts');
  const thin = { ...frame, radius: 30, w: 100, h: 100, strokeW: 40, strokeTop: '2', strokeRight: '2', strokeBottom: '2', strokeLeft: '2' };
  assert.deepEqual(roundedFrameClips([thin, on({ id: 'tl', x: 0, y: 0, w: 30, h: 30 })], 'board'), ['tl'], 'per-side borders set the inner curve');
  assert.deepEqual(roundedFrameClips([{ ...frame, clipChildren: false }, on({ id: 'edge', x: -30, y: 300, w: 200, h: 140 })], 'board'), [], 'a frame that does not clip');
  assert.deepEqual(roundedFrameClips([{ ...frame, shape: 'ellipse' }, on({ id: 'disc', x: 20, y: 20, w: 80, h: 80 })], 'board'), ['disc'], 'an ellipse frame curves everywhere');
});

test('a page drawn on this route says so in a note, with the way to the browser\'s own render', () => {
  assert.match(designStillNote({ draw: 'here', because: 'LOLLY_DESIGN_RASTER=resvg asks for this route' }), /drawn without a browser.*Unset it for the browser's own render/);
  assert.match(designStillNote({ draw: 'here', because: 'no browser render tier is available (no Chromium)' }), /drawn without a browser.*lolly install-browser/);
});

test('a picture made by another tool that this shell could not compose keeps its page off the route', () => {
  const link = { id: 'https://lolly.tools/tool/chart.svg?chartType=bar' };
  const rows = (image: unknown) => [{ id: 'a', kind: 'frame' }, { id: 'pic', kind: 'image', frame: 'a', image }, { id: 'far', kind: 'image', frame: 'b', image }];
  const model = [{ id: 'boxes', type: 'blocks', value: rows(null), fields: [{ id: 'image', type: 'asset' }] }];
  assert.deepEqual(uncomposedToolLinks(model, { boxes: rows(link) }, 'a'), ['pic'], 'the empty slot on this page');
  assert.deepEqual(uncomposedToolLinks(model, { boxes: rows(link) }, 'c'), [], 'a slot on another page does not count');
  assert.deepEqual(uncomposedToolLinks(model, { boxes: rows(null) }, 'a'), [], 'a slot left empty by its author is not a dropped link');
});

/** PNG chunk types in order, runs of IDAT folded into one. */
function chunkOrder(png: Uint8Array): string[] {
  const out: string[] = [];
  const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
  for (let at = 8; at + 8 <= png.length;) {
    const type = String.fromCharCode(...png.subarray(at + 4, at + 8));
    if (type !== 'IDAT' || out.at(-1) !== 'IDAT') out.push(type);
    at += 12 + view.getUint32(at);
  }
  return out;
}

/** The CLI with no browser tier at all, unless `env` lends one; the route's own log lines on stderr. */
function cli(dir: string, args: string[], env: Record<string, string> = {}) {
  const base: Record<string, string | undefined> = {
    ...process.env, LOLLY_PROFILE: 'lolly-demo', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1',
    // No web build and no desktop app: success can only be this route.
    LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_RENDERER: 'chromium',
  };
  delete base.LOLLY_WEB_BASE; delete base.LOLLY_DESIGN_RASTER; delete base.LOLLY_EXPORT_ROUTE;
  return spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', ...args, '--export=png'], { cwd: ROOT, encoding: 'utf8', timeout: 60_000, env: { ...base, ...env } });
}

test('with no browser tier the CLI writes the page itself, finished and credentialed as the browser tier finishes one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-still-'));
  try {
    const out = join(dir, 'cover.png');
    const run = cli(dir, [`--boxes=${JSON.stringify(boxes)}`, '--s=cover', `--output=${out}`]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /Design PNG export: drawn from the drawing operations \(design-draw-v\d+\+resvg-js-[\d.]+\) because no browser render tier is available/);
    assert.match(run.stderr, /640 x 400 px, with no browser/);
    assert.match(run.stderr, /Note: This Design page was drawn without a browser, by resvg from its drawing operations, because no browser render tier is available here/);
    const png = new Uint8Array(await readFile(out));
    const view = new DataView(png.buffer, png.byteOffset);
    assert.deepEqual([view.getUint32(16), view.getUint32(20)], [640, 400], 'the page at its own size, as the browser tier draws it');
    // The browser tier's PNG, measured on 2026-11-19: IHDR caBX iCCP iTXt(XMP) iTXt(text...) pHYs IDAT IEND.
    const order = chunkOrder(png);
    assert.deepEqual(order.slice(0, 3), ['IHDR', 'caBX', 'iCCP']);
    assert.deepEqual(order.slice(-3), ['pHYs', 'IDAT', 'IEND']);
    assert.ok(order.filter((c) => c === 'iTXt').length >= 2, 'the XMP packet and the provenance text');
    const credential = await verifyC2pa(png);
    assert.equal(credential.state, 'valid');
    assert.equal(credential.environment?.route, 'operations');
    assert.equal(credential.environment?.renderer, designResvgRenderer());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a credentialed picture on the page is recorded as an ingredient, as the SVG route records it', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-still-pic-'));
  try {
    const signed = await embedC2pa(encodePng(32, 32, () => [30, 140, 80, 255]), 'png', { title: 'Source picture', claimGenerator: 'Lolly test' });
    const picture = `data:image/png;base64,${Buffer.from(signed).toString('base64')}`;
    const out = join(dir, 'picture.png');
    const run = cli(dir, [`--boxes=${JSON.stringify([...boxes, { id: 'pic', kind: 'image', x: 300, y: 200, w: 100, h: 100, image: picture, frame: 'cover' }])}`, '--s=cover', `--output=${out}`]);
    assert.equal(run.status, 0, run.stderr);
    const credential = await verifyC2pa(new Uint8Array(await readFile(out)));
    assert.ok((credential.ingredients ?? []).some((i) => i.relationship === 'componentOf'), JSON.stringify(credential.ingredients));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a page drawn here lists every credentialed picture the document places, the other pages\' too, as the web shell lists them', async () => {
  // The rule and the list of tests/design-ops-browser-match.test.ts (engine 1.349), through this route.
  const signedPng = (title: string, rgb: [number, number, number]) => embedC2pa(encodePng(4, 4, () => [...rgb, 255]), 'png', { title, claimGenerator: 'Lolly test' });
  const files: Record<string, { source: string; bytes: Uint8Array }> = {
    'pictures/cover': { source: 'library', bytes: await signedPng('Cover photo', [30, 140, 80]) },
    'pictures/second': { source: 'library', bytes: await signedPng('Second photo', [140, 30, 80]) },
    'user/upload/third': { source: 'user', bytes: await signedPng('Third photo', [80, 30, 140]) },
  };
  const rows = [
    { id: 'cover', kind: 'frame', x: 0, y: 0, w: 320, h: 200, bg: '#ffffff', order: 0 },
    { id: 'p1', kind: 'image', frame: 'cover', x: 20, y: 20, w: 100, h: 100, image: 'pictures/cover' },
    { id: 'second', kind: 'frame', x: 400, y: 0, w: 320, h: 200, bg: '#ffffff', order: 1 },
    { id: 'p2', kind: 'image', frame: 'second', x: 420, y: 20, w: 100, h: 100, image: 'pictures/second' },
    { id: 'p3', kind: 'image', frame: 'second', x: 540, y: 20, w: 100, h: 100, image: { id: 'user/upload/third', source: 'user' } },
  ];
  const dom = new JSDOM('<div data-frame-id="cover"><span>page</span><span>chrome</span></div>');
  try {
    const bridge = await createCliBridge({ dom: dom as never });
    bridge.assets = {
      ...bridge.assets,
      get: async (id: string) => ({ id, source: files[id]!.source, type: 'raster', format: 'png', url: `file:///${encodeURIComponent(id)}.png` }),
      bytes: async (ref: { id: string }) => files[ref.id]!.bytes,
    } as never;
    const page = dom.window.document.querySelector('[data-frame-id]')!;
    const result = await drawDesignStill({
      exportSvg: (node, opts) => bridge.export.render(node, 'svg', { ...opts, sourceDocument: { toolId: 'design', values: { boxes: rows } } } as never),
      meta: () => null, page: page as unknown as Element, rows, dims: {},
    });
    assert.ok('drawn' in result, 'refused' in result ? result.refused.join('; ') : '');
    const label = (bytes: Uint8Array) => { const store = extractC2paStore(bytes)!; return prepareC2paIngredientFromStore(store.store, store.format)!.activeLabel; };
    assert.deepEqual(result.drawn.ingredients.map((i) => i.activeLabel), ['pictures/cover', 'pictures/second', 'user/upload/third'].map((id) => label(files[id]!.bytes)));
    assert.ok(result.drawn.ingredients.every((i) => i.relationship === 'componentOf'));
  } finally {
    dom.window.close();
  }
});

test('a page the route does not draw goes to the browser tier with its reason, and nothing is written without one', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-still-refused-'));
  try {
    const cases: Array<{ args: string[]; reason: RegExp }> = [
      { args: [`--boxes=${JSON.stringify(boxes.map((b) => (b.id === 'title' ? { ...b, fitText: true } : b)))}`, '--s=cover'], reason: /fit-text \(title\)/ },
      { args: [`--boxes=${JSON.stringify(boxes)}`], reason: /not a single frame/ },
      { args: [`--boxes=${JSON.stringify(boxes.map((b) => (b.id === 'cover' ? { ...b, layout: 'flex' } : b)))}`, '--s=cover'], reason: /lays out cover with flex or grid/ },
      { args: [`--boxes=${JSON.stringify([...boxes.map((b) => (b.id === 'cover' ? { ...b, shape: 'rounded', radius: 48 } : b)), { id: 'corner', kind: 'box', x: -30, y: 300, w: 200, h: 140, bg: '#f76707', frame: 'cover' }])}`, '--s=cover'], reason: /rounded edge clips corner/ },
      { args: [`--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--width=400', '--height=800'], reason: /changes the page's proportions/ },
      { args: [`--boxes=${JSON.stringify(boxes)}`, '--s=cover', '--durable'], reason: /durable credential/ },
    ];
    for (const { args, reason } of cases) {
      const out = join(dir, 'refused.png');
      const run = cli(dir, [...args, `--output=${out}`]);
      assert.notEqual(run.status, 0, `${reason}: no renderer can take the page here`);
      assert.match(run.stderr, /Design PNG export: handed to the browser render tier because/, reason.source);
      assert.match(run.stderr, reason);
      assert.equal(existsSync(out), false, `${reason}: nothing written`);
    }
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('with a browser tier present the page stays there unless LOLLY_DESIGN_RASTER=resvg asks for this route', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-design-still-optin-'));
  try {
    // A browser tier that is configured but cannot answer: present to the decision, so the
    // default run reaches it (and fails there), while the opt-in never asks it at all.
    const tier = { LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_BROWSER_PATH: join(dir, 'no-chromium') };
    const args = [`--boxes=${JSON.stringify(boxes)}`, '--s=cover'];
    const kept = cli(dir, [...args, `--output=${join(dir, 'kept.png')}`], tier);
    assert.notEqual(kept.status, 0);
    assert.match(kept.stderr, /handed to the browser render tier because a browser render tier is available and LOLLY_DESIGN_RASTER=resvg was not given/);
    const out = join(dir, 'asked.png');
    const asked = cli(dir, [...args, `--output=${out}`], { ...tier, LOLLY_DESIGN_RASTER: 'resvg' });
    assert.equal(asked.status, 0, asked.stderr);
    assert.match(asked.stderr, /drawn from the drawing operations \(design-draw-v\d+\+resvg-js-[\d.]+\) because LOLLY_DESIGN_RASTER=resvg asks for this route/);
    assert.ok(existsSync(out));
    assert.match(asked.stderr, /Note: This Design page was drawn without a browser.*Unset it for the browser's own render/);
    assert.doesNotMatch(kept.stderr, /drawn without a browser/, 'no note when the browser tier takes the page');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
