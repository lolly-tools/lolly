// SPDX-License-Identifier: MPL-2.0
/**
 * The browser-free raster route's admission (src/resvg-admission.ts): each feature resvg
 * was measured to draw unlike the browser is refused with a reason, the rewrites that
 * match the browser are applied, and the PNG carries the browser's chunks.
 *
 * Run with: node --test packages/node-shell/test/resvg-admission.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { JSDOM } from 'jsdom';
import {
  admitForResvg, isResvgRefusal, layoutAdmission, MAX_PICTURE_SHRINK, placeSvg, readLayout,
  ResvgRefusedError, resvgRefusalSentence, routeRefusals, svgPlacement, toolAdmission,
} from '../src/resvg-admission.ts';
import { finishTierAPng, rasterizeSvgToRgba } from '../src/raster.ts';

const svgDoc = (body: string, attrs = 'viewBox="0 0 100 100"'): string => `<svg xmlns="http://www.w3.org/2000/svg" ${attrs}>${body}</svg>`;
const b64 = (s: string | Uint8Array): string => Buffer.from(s).toString('base64');
const codes = async (svg: string, w = 100, h = 100): Promise<string[]> => (await admitForResvg(svg, w, h)).refusals.map((r) => r.code);

/** A PNG of `w` x `h` opaque grey pixels, with an iCCP chunk when one is given. */
function png(w: number, h: number, icc?: Uint8Array): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Uint8Array): Buffer => {
    const body = Buffer.concat([Buffer.from(type, 'latin1'), Buffer.from(data)]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.alloc((w * 3 + 1) * h, 128); for (let y = 0; y < h; y++) raw[y * (w * 3 + 1)] = 0;
  return new Uint8Array(Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr),
    ...(icc ? [chunk('iCCP', new Uint8Array(Buffer.concat([Buffer.from('x\0\0', 'latin1'), deflateSync(icc)])))] : []),
    chunk('IDAT', deflateSync(raw)), chunk('IEND', new Uint8Array()),
  ]));
}
const chunkTypes = (bytes: Uint8Array): string[] => {
  const out: string[] = [];
  for (let at = 8; at + 8 <= bytes.length;) { const len = Buffer.from(bytes.subarray(at, at + 4)).readUInt32BE(); out.push(Buffer.from(bytes.subarray(at + 4, at + 8)).toString('latin1')); at += 12 + len; }
  return out;
};

test('plain vector drawing is admitted', async () => {
  assert.deepEqual(await codes(svgDoc('<rect width="50" height="50" fill="#123456"/><path d="M0 0L10 10" stroke="#000"/>')), []);
});

test('a CSS variable inside a vector picture takes its fallback, as the browser draws a picture as its own document', async () => {
  const inner = svgDoc('<rect width="10" height="10" fill="var(--brand-primary, #008657)"/>', 'viewBox="0 0 10 10" width="10" height="10"');
  const out = await admitForResvg(svgDoc(`<image href="data:image/svg+xml;base64,${b64(inner)}" width="100" height="100"/>`), 100, 100);
  assert.deepEqual(out.refusals, []);
  const href = /href="data:image\/svg\+xml;base64,([^"]+)"/.exec(out.svg)![1]!;
  assert.match(Buffer.from(href, 'base64').toString(), /fill="#008657"/);
  // Drawn, the square is the fallback green, where resvg reads the raw var() as black.
  const { data } = await rasterizeSvgToRgba(out.svg, 10, 10);
  assert.deepEqual([...data.subarray(0, 3)], [0, 0x86, 0x57]);
});

test('a variable the picture declares itself, or one left in the page, is refused', async () => {
  const declared = svgDoc('<style>:root{--c:#f00}</style><rect width="10" height="10" fill="var(--c, #0f0)"/>', 'viewBox="0 0 10 10"');
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/svg+xml;base64,${b64(declared)}" width="10" height="10"/>`)), ['css-variable']);
  assert.deepEqual(await codes(svgDoc('<rect width="10" height="10" style="fill:var(--brand-ink)"/>')), ['css-variable']);
});

test('pictures resvg draws unlike the browser are refused by name', async () => {
  const webp = new Uint8Array([...Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1'), ...new Uint8Array(20)]);
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/webp;base64,${b64(webp)}" width="10" height="10"/>`)), ['picture-type']);
  const animated = svgDoc('<style>@keyframes s{to{transform:rotate(1turn)}}.a{animation:s 3s infinite}</style><rect class="a" width="9" height="9"/>', 'viewBox="0 0 10 10"');
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/svg+xml;base64,${b64(animated)}" width="10" height="10"/>`)), ['css-animation']);
  assert.deepEqual(await codes(svgDoc('<image href="https://example.com/a.png" width="10" height="10"/>')), ['picture-outside']);
  // Snapped edges inside a vector picture: where they land on the output is not read, so refused.
  const crisp = svgDoc('<rect x="0.3" width="3" height="9" shape-rendering="crispEdges"/>', 'viewBox="0 0 10 10"');
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/svg+xml;base64,${b64(crisp)}" width="10" height="10"/>`)), ['crisp-edges']);
  // Animated rasters: an APNG's acTL chunk, a looping GIF.
  const apng = Buffer.from(png(4, 4)); const ihdrEnd = 8 + 25;
  const actl = Buffer.concat([Buffer.from([0, 0, 0, 8]), Buffer.from('acTL'), Buffer.from([0, 0, 0, 2, 0, 0, 0, 0]), Buffer.from([0, 0, 0, 0])]);
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/png;base64,${b64(Buffer.concat([apng.subarray(0, ihdrEnd), actl, apng.subarray(ihdrEnd)]))}" width="4" height="4"/>`, 'viewBox="0 0 4 4"'), 4, 4), ['css-animation']);
  const gif = Buffer.concat([Buffer.from('GIF89a'), Buffer.from([4, 0, 4, 0, 0, 0, 0]), Buffer.from('\x21\xffNETSCAPE2.0', 'latin1'), Buffer.from([0x3b])]);
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/gif;base64,${b64(gif)}" width="4" height="4"/>`, 'viewBox="0 0 4 4"'), 4, 4), ['css-animation']);
  const profiled = png(4, 4, new Uint8Array(200).fill(7));
  assert.deepEqual(await codes(svgDoc(`<image href="data:image/png;base64,${b64(profiled)}" width="4" height="4"/>`)), ['picture-colour']);
});

test('live text, HTML, noise filters and fading gradients are refused', async () => {
  assert.deepEqual(await codes(svgDoc('<text x="0" y="10">🎨</text>')), ['live-text']);
  assert.deepEqual(await codes(svgDoc('<text x="0" y="10"> </text>')), [], 'an empty run draws nothing');
  assert.deepEqual(await codes(svgDoc('<foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>')), ['html']);
  assert.deepEqual(await codes(svgDoc('<switch><foreignObject requiredExtensions="http://ns.adobe.com/AdobeIllustrator/10.0/" width="1" height="1"/><g><rect width="9" height="9"/></g></switch>')), [],
    'a branch that asks for an extension is drawn by neither renderer');
  assert.deepEqual(await codes(svgDoc('<filter id="n"><feTurbulence baseFrequency="0.6"/></filter><rect width="9" height="9" filter="url(#n)"/>')), ['noise-filter']);
  // Crisp rects between whole pixels are refused; on whole pixels, or a crisp path, they are not.
  const bars = (x: number) => svgDoc(`<g shape-rendering="crispEdges"><rect x="${x}" y="0" width="3" height="9"/></g>`, 'viewBox="0 0 351 100"');
  assert.deepEqual(await codes(bars(6), 600, 171), ['crisp-edges'], 'a scale of 1.71 puts the bar edges between pixels');
  assert.deepEqual(await codes(bars(6), 702, 200), [], 'a scale of 2 puts them on whole pixels');
  assert.deepEqual(await codes(svgDoc('<path style="shape-rendering:crispEdges" d="M72.73 72.73H90.91V90.91H72.73Z"/>', 'viewBox="0 0 600 600"'), 777, 777), []);
  const grad = (stop: string) => svgDoc(`<radialGradient id="g"><stop offset="0" stop-color="#033633"/><stop offset="1" ${stop}/></radialGradient><rect width="99" height="99" fill="url(#g)"/>`);
  assert.deepEqual(await codes(grad('stop-color="#033633" stop-opacity="0"')), ['gradient-opacity']);
  assert.deepEqual(await codes(grad('stop-color="#03363380"')), ['gradient-opacity']);
  assert.deepEqual(await codes(grad('stop-color="#0336337f"')), ['gradient-opacity'], 'an alpha ending in f is still below one');
  assert.deepEqual(await codes(grad('stop-color="#033633ff"')), []);
  assert.deepEqual(await codes(grad('stop-color="#ffffff"')), []);
  // A fade set by the stylesheet is read from resvg's own tree.
  assert.deepEqual(await codes(svgDoc('<style>.fade{stop-opacity:0}</style><linearGradient id="g"><stop offset="0" stop-color="#033633"/><stop class="fade" offset="1" stop-color="#033633"/></linearGradient><rect width="99" height="99" fill="url(#g)"/>')), ['gradient-opacity']);
});

test('a blend mode is refused inside a filtered group, and admitted outside one', async () => {
  const blob = '<g style="mix-blend-mode:hard-light"><rect width="50" height="50" fill="#f80"/></g>';
  assert.deepEqual(await codes(svgDoc(`<filter id="b"><feGaussianBlur stdDeviation="3"/></filter><g filter="url(#b)">${blob}</g>`)), ['blend-in-filter']);
  assert.deepEqual(await codes(svgDoc(blob)), []);
});

test('a picture shrunk past the measured limit is refused, through every transform', async () => {
  const pic = `data:image/png;base64,${b64(png(400, 400))}`;
  // 400 px drawn in a 100-unit box on a 100 px page: a shrink of 4.
  assert.deepEqual(await codes(svgDoc(`<image href="${pic}" width="100" height="100"/>`)), ['picture-downscale']);
  // The same box on a 400 px page is 1:1.
  assert.deepEqual(await codes(svgDoc(`<image href="${pic}" width="100" height="100"/>`), 400, 400), []);
  // A group scale counts: 400 px in 50 units, scaled by 4, on a 100 px page is 1:2, the limit.
  assert.equal(MAX_PICTURE_SHRINK, 2);
  assert.deepEqual(await codes(svgDoc(`<g transform="scale(4)"><image href="${pic}" width="50" height="50"/></g>`), 100, 100), []);
  assert.deepEqual(await codes(svgDoc(`<g transform="scale(0.5)"><image href="${pic}" width="300" height="300"/></g>`), 100, 100), ['picture-downscale']);
});

test('the render facts refuse on their own, and a tool its record does not admit is refused', () => {
  const fact = (browserFree: boolean, extra: { untrusted?: boolean; stale?: string } = {}) => ({ id: 'qr-code', browserFree, untrusted: !!extra.untrusted, ...(extra.stale ? { stale: extra.stale } : {}) });
  assert.deepEqual(routeRefusals({ tool: fact(true) }), []);
  assert.match(routeRefusals({ tool: fact(false) })[0]!.reason, /has not been measured inside the fidelity bands on this route \(no browser-free\.json admits it\)/);
  assert.match(routeRefusals({ tool: fact(false, { stale: 'the tool\'s files changed since the record was measured' }) })[0]!.reason, /browser-free record no longer describes it .*run scripts\/tool-browser-free\.ts again/);
  // A tool with no record is not admitted, and trust is the shell's: a sideloaded or remote
  // tool is never admitted, whatever its folder holds, as with `isolate`.
  assert.deepEqual(toolAdmission({ manifest: { id: 'no-such-tool-here', version: '1.0.0' } }), { id: 'no-such-tool-here', browserFree: false, untrusted: false });
  for (const trustClass of ['sideloaded-consented', 'remote-untrusted']) {
    assert.deepEqual(toolAdmission({ manifest: { id: 'qr-code', version: '2.8.0' }, trustClass }), { id: 'qr-code', browserFree: false, untrusted: true });
    assert.match(routeRefusals({ tool: fact(false, { untrusted: true }) })[0]!.reason, /sideloaded or remote, and such a tool cannot admit itself/);
  }
  assert.deepEqual(routeRefusals({ tool: fact(false), paged: true, draftMark: true, canvasPixels: true, fallbackFaces: true }).map((r) => r.code),
    ['unmeasured', 'paged', 'draft-mark', 'canvas-pixels', 'fallback-faces']);
  const err = new ResvgRefusedError(routeRefusals({ draftMark: true }), 'bmp');
  assert.ok(isResvgRefusal(err));
  assert.ok(isResvgRefusal({ code: 'RESVG_REFUSED' }), 'recognised by its code across a realm');
  assert.match(err.message, /^The browser-free renderer \(resvg\) was not used because this experimental tool marks its exports DRAFT/);
  assert.match(err.message, /This BMP needs the browser render tier\.$/);
  assert.equal(resvgRefusalSentence([{ code: 'paged', reason: 'a' }, { code: 'paged', reason: 'a' }]), 'The browser-free renderer (resvg) was not used because a.');
});

test('placement follows the page: CSS height:auto is drawn from the top, a full box fills', () => {
  const dom = new JSDOM('<!DOCTYPE html><div id="canvas"><svg class="s" viewBox="0 0 200 100"></svg></div>');
  const doc = dom.window.document, canvas = doc.getElementById('canvas')!, svg = doc.querySelector('svg')!;
  const style = (el: Element) => dom.window.getComputedStyle(el);
  // No size anywhere: an inline <svg> is as wide as its container, its height from the viewBox.
  assert.deepEqual(svgPlacement(svg, 400, 400, style), { kind: 'top' });
  // The tool's stylesheet sets a full box (Signature's .sg-svg): the SVG's own aspect rule places the drawing.
  assert.deepEqual(readLayout(canvas, svg, 400, 400, '.s{width:100%;height:100%}'), { placement: { kind: 'fill' }, refusals: [] });
  assert.equal(doc.querySelectorAll('style').length, 0, 'the stylesheet is taken out again');
  svg.setAttribute('style', 'width:100%;height:auto;max-height:100%');
  assert.deepEqual(svgPlacement(svg, 400, 100, style), { kind: 'fill' }, 'a drawing taller than the canvas is capped at it');
  svg.setAttribute('style', 'width:50px;height:20px');
  assert.equal(svgPlacement(svg, 400, 400, style).kind, 'unknown');
});

test('a wrapper that paints a ground under an uncovered band, or a stylesheet ground on the drawing, is refused', () => {
  const dom = new JSDOM('<!DOCTYPE html><div id="canvas"><div class="wrap"><svg viewBox="0 0 200 100" style="width:100%;height:auto"></svg></div></div>');
  const doc = dom.window.document, canvas = doc.getElementById('canvas')!, svg = doc.querySelector('svg')!;
  assert.deepEqual(readLayout(canvas, svg, 400, 400, '.wrap{background:var(--brand-surface, #f7f7f5)}').refusals.map((r) => r.code), ['layout']);
  assert.deepEqual(readLayout(canvas, svg, 400, 400, '').refusals, [], 'no ground: the band is transparent in the browser too');
  assert.deepEqual(readLayout(canvas, svg, 400, 400, 'svg{background:#fff}').refusals.map((r) => r.code), ['layout']);
  const style = (el: Element) => dom.window.getComputedStyle(el);
  assert.deepEqual(layoutAdmission(canvas, svg, 400, 200, style).refusals, [], 'a drawing that covers the canvas leaves no band');
});

test('placeSvg draws a top placement from the top, where the default centres it', async () => {
  const svg = svgDoc('<rect width="200" height="100" fill="#000"/>', 'viewBox="0 0 200 100" width="200" height="100"');
  assert.match(placeSvg(svg, 200, 200, { kind: 'top' }), /^<svg xmlns="http:\/\/www.w3.org\/2000\/svg" width="200" height="200" viewBox="0 0 200 200"><svg [^>]*viewBox="0 0 200 100" x="0" y="0" width="200" height="100">/);
  const top = await rasterizeSvgToRgba(svg, 200, 200, { kind: 'top' });
  const centred = await rasterizeSvgToRgba(svg, 200, 200);
  const alphaAt = (d: Uint8Array, y: number) => d[(y * 200 + 100) * 4 + 3];
  assert.equal(alphaAt(top.data, 10), 255);
  assert.equal(alphaAt(top.data, 150), 0);
  assert.equal(alphaAt(centred.data, 10), 0);
  assert.equal(alphaAt(centred.data, 100), 255);
  // The drawing stays its own viewport: a 100% rect keeps the drawing's height, and what
  // lies past its bottom edge stays clipped, as in the browser.
  const full = svgDoc('<rect width="100%" height="100%" fill="#000"/><rect y="100" width="200" height="50" fill="#f00"/>', 'viewBox="0 0 200 100" width="200" height="100"');
  const placed = await rasterizeSvgToRgba(full, 200, 200, { kind: 'top' });
  assert.equal(alphaAt(placed.data, 99), 255);
  assert.equal(alphaAt(placed.data, 120), 0, 'nothing below the drawing: the 100% rect did not grow and the overflow stayed clipped');
});

test('the PNG carries the browser\'s chunks, in its order: profile, XMP, text, pHYs', async () => {
  const meta = { software: 'Lolly', source: 'https://lolly.tools/t/qr-code', description: 'Made with https://lolly.tools : QR Code' };
  const finished = await finishTierAPng(png(4, 4), {}, { meta: meta as never });
  assert.deepEqual(chunkTypes(finished), ['IHDR', 'iCCP', 'iTXt', 'iTXt', 'iTXt', 'iTXt', 'pHYs', 'IDAT', 'IEND']);
  const phys = Buffer.from(finished).subarray(Buffer.from(finished).indexOf('pHYs') + 4, Buffer.from(finished).indexOf('pHYs') + 13);
  assert.equal(phys.readUInt32BE(0), 3780, 'pixels are written at 96 DPI, as CSS pixels are');
  const mm = await finishTierAPng(png(4, 4), { unit: 'mm', dpi: 150 }, { colorProfile: 'none' });
  assert.deepEqual(chunkTypes(mm), ['IHDR', 'pHYs', 'IDAT', 'IEND']);
  assert.equal(Buffer.from(mm).subarray(Buffer.from(mm).indexOf('pHYs') + 4).readUInt32BE(0), 5906);
});
