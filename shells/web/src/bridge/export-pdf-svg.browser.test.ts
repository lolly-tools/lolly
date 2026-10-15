// SPDX-License-Identifier: MPL-2.0
/**
 * The PDF SVG painter (export-pdf-svg.ts), one SVG feature per test, read back as pixels.
 *
 * Each case is an inline SVG on a black page, exported with the real walker and
 * rasterised by poppler (`pdftoppm`) at 96 dpi, so one CSS pixel is one output pixel.
 * A black page is the point for transparency: the previous painter mixed a translucent
 * paint with white, which a white page cannot tell from the truth. Where the claim is
 * about the file rather than the picture (a gradient as a vector shading, a picture for
 * a filter), the test reads the file's dictionaries too.
 *
 * Text that the export outlines runs with the export API created over the real
 * HarfBuzz text host and the Outfit face, as export-text-emission.test.ts does.
 *
 * Real Chromium and pdftoppm, self-skipping when either is missing, as
 * export-pdf-veil-opacity.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { inflateSync } from 'node:zlib';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));
const TEXT_API = fileURLToPath(new URL('./text.ts', import.meta.url));
const OUTFIT_TTF = fileURLToPath(new URL('../../public/fonts/Outfit[wght].ttf', import.meta.url));
const HB_WASM = fileURLToPath(new URL('../../../../node_modules/harfbuzzjs/dist/harfbuzz.wasm', import.meta.url));
const FONT = `@font-face{font-family:Outfit;src:url('/fonts/Outfit[wght].ttf') format('truetype');font-weight:100 900}`;

async function have(bin: string): Promise<boolean> {
  try { await run('which', [bin]); return true; } catch { return false; }
}

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  if (!existsSync(OUTFIT_TTF)) return `missing ${OUTFIT_TTF}`;
  if (!existsSync(HB_WASM)) return 'harfbuzzjs wasm not installed';
  let chromium: any;
  try { ({ chromium } = await import('playwright')); } catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : !(await have('pdftoppm')) ? 'no PDF rasteriser binary (needs pdftoppm)' : false;

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      // createExportAPI assigns export.ts's `_host`; without it no run is outlined.
      contents: `import { renderPdf, createExportAPI } from ${JSON.stringify(EXPORT_MODULE)};
                 import { createTextAPI } from ${JSON.stringify(TEXT_API)};
                 window.__setup = () => createExportAPI({ text: createTextAPI(), log: () => {} });
                 window.__pdf = renderPdf;`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'esnext', logLevel: 'silent',
    loader: { '.css': 'empty' },
    plugins: [{
      // harfbuzzjs asks for Node's `module` on a branch a browser never takes.
      name: 'stub-node-module',
      setup(b: any) {
        b.onResolve({ filter: /^module$/ }, () => ({ path: 'module', namespace: 'stub-node-module' }));
        b.onLoad({ filter: /.*/, namespace: 'stub-node-module' }, () => ({
          contents: 'export function createRequire(){ return () => ({}); }\nexport default { createRequire };',
          loader: 'js',
        }));
      },
    }],
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

interface Picture {
  raw: string;
  at(x: number, y: number): [number, number, number];
  /** Every indirect object's dictionary as text, read through pdf-lib (object streams included). */
  objects: string[];
  /** Every compressed stream decoded: the page content, forms and soft masks. */
  streams: string[];
  width: number;
}

/**
 * Export `svg` on a black W x H page and read the PDF back as pixels. `outline` sets up
 * the text host, so text is outlined as Convert paths outlines text.
 */
async function paint(svg: string, W = 200, H = 120, outline = false): Promise<Picture> {
  const { chromium } = browser as { chromium: any };
  const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-svg-'));
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  let pdf: Buffer;
  try {
    const page = await b.newPage({ viewport: { width: W + 40, height: H + 40 } });
    // The wrapper keeps the page on the HTML walker, which is how an inline <svg> in a
    // tool or a Design box is drawn; a root whose first child is an <svg> is treated
    // as an SVG page instead. The routes answer in-process, so nothing listens.
    const body = `<!doctype html><meta charset="utf-8"><style>${FONT}</style><body style="margin:0"><div id="root" style="position:relative;width:${W}px;height:${H}px;background:#000"><div style="position:absolute;inset:0">${svg}</div></div></body>`;
    await page.route('**/*', async (route: any) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (p === '/fonts/Outfit[wght].ttf') return route.fulfill({ contentType: 'font/ttf', body: readFileSync(OUTFIT_TTF) });
      if (p.endsWith('.wasm')) return route.fulfill({ contentType: 'application/wasm', body: readFileSync(HB_WASM) });
      if (p === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://localhost/');
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ type: 'module', content: `${await bundle()}\nwindow.__ready = true;` });
    await page.waitForFunction(() => (window as any).__ready === true);
    const b64 = await page.evaluate(async (outlineText: boolean) => {
      if (outlineText) (window as any).__setup();
      const blob = await (window as any).__pdf(document.getElementById('root'), {});
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (const byte of buf) s += String.fromCharCode(byte);
      return btoa(s);
    }, outline);
    pdf = Buffer.from(b64, 'base64');
  } finally { await b.close(); }
  const pdfPath = join(dir, 'p.pdf');
  await writeFile(pdfPath, pdf);
  await run('pdftoppm', ['-r', '96', '-singlefile', pdfPath, join(dir, 'p')]);
  const ppm = await readFile(join(dir, 'p.ppm'));
  const header = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(ppm.subarray(0, 64).toString('latin1'))!;
  const w = Number(header[1]);
  const px = ppm.subarray(header[0].length);
  const lib = await import('pdf-lib') as any;
  const doc = await lib.PDFDocument.load(pdf, { updateMetadata: false });
  // A stream's dictionary is its `dict`; a plain dictionary prints itself.
  const all = [...doc.context.enumerateIndirectObjects()].map(([, obj]: [unknown, any]) => obj);
  const objects = all.map((obj: any) => String(obj instanceof lib.PDFStream ? obj.dict : obj));
  const streams = all
    .filter((obj: any) => obj instanceof lib.PDFRawStream && String(obj.dict.get(lib.PDFName.of('Filter'))) === '/FlateDecode')
    .map((obj: any) => { try { return inflateSync(Buffer.from(obj.contents)).toString('latin1'); } catch { return ''; } });
  return {
    raw: pdf.toString('latin1'),
    at: (x, y) => { const o = (Math.round(y) * w + Math.round(x)) * 3; return [px[o]!, px[o + 1]!, px[o + 2]!]; },
    objects,
    streams,
    width: w,
  };
}

/** Within `tol` of `want` on every channel. */
function near(got: [number, number, number], want: [number, number, number], tol: number, what: string): void {
  assert.ok(got.every((v, i) => Math.abs(v - want[i]!) <= tol), `${what}: read rgb(${got.join(', ')}), wanted about rgb(${want.join(', ')})`);
}

const BLACK: [number, number, number] = [0, 0, 0];
const at = (left: number, top: number) => `position:absolute;left:${left}px;top:${top}px`;

test('clip paths clip in a PDF: on a shape, on a group, through a <use> outline and with clip-rule', { skip: SKIP, timeout: 120_000 }, async () => {
  // The third clip has two outlines wound in opposite directions, the second with an
  // evenodd hole wound the same way as its outside: their union keeps the overlap and
  // the hole, which a single nonzero clip of both outlines would not.
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="100" height="100" viewBox="0 0 100 100">
      <defs><rect id="r" x="25" y="25" width="50" height="50"/><clipPath id="c"><use href="#r"/></clipPath></defs>
      <rect width="100" height="100" fill="#ff0000" clip-path="url(#c)"/>
    </svg>
    <svg style="${at(100, 0)}" width="100" height="100" viewBox="0 0 100 100">
      <defs><clipPath id="ring"><path clip-rule="evenodd" d="M10 10H90V90H10Z M40 40V60H60V40Z"/></clipPath></defs>
      <g clip-path="url(#ring)"><rect width="100" height="100" fill="#00ff00"/></g>
    </svg>
    <svg style="${at(200, 0)}" width="100" height="100" viewBox="0 0 100 100">
      <defs><clipPath id="two">
        <rect x="10" y="10" width="50" height="50"/>
        <path clip-rule="evenodd" d="M40 40V90H90V40Z M70 70V80H80V70Z"/>
      </clipPath></defs>
      <rect width="100" height="100" fill="#ffff00" clip-path="url(#two)"/>
    </svg>`, 300);
  near(pic.at(50, 50), [255, 0, 0], 8, 'inside the <use> clip');
  near(pic.at(10, 10), BLACK, 8, 'outside the <use> clip');
  near(pic.at(120, 20), [0, 255, 0], 8, 'the ring of the evenodd clip on a group');
  near(pic.at(150, 50), BLACK, 8, 'the hole of the evenodd clip');
  near(pic.at(195, 95), BLACK, 8, 'outside the group clip');
  near(pic.at(225, 25), [255, 255, 0], 8, 'the first outline of the two-outline clip');
  near(pic.at(250, 50), [255, 255, 0], 8, 'where the two outlines overlap');
  near(pic.at(265, 85), [255, 255, 0], 8, 'the second outline');
  near(pic.at(275, 75), BLACK, 8, 'the evenodd hole in the second outline');
  near(pic.at(285, 15), BLACK, 8, 'outside both outlines');
});

test('a <use> instance draws in the paint the <use> carries', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="100" height="100" viewBox="0 0 100 100">
      <defs><path id="p" d="M10 10H90V90H10Z"/></defs>
      <use href="#p" fill="#00ff00"/>
    </svg>`);
  near(pic.at(50, 50), [0, 255, 0], 8, 'the instance takes the <use> fill, not the black its definition inherits');
});

test('an SVG and a nested <svg> clip at their viewport edge', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(20, 10)}" width="80" height="80" viewBox="0 0 80 80">
      <rect x="-40" y="-40" width="160" height="160" fill="#0000ff"/>
    </svg>
    <svg style="${at(110, 10)}" width="80" height="80" viewBox="0 0 80 80">
      <svg x="20" y="20" width="40" height="40" viewBox="0 0 10 10"><rect x="-10" y="-10" width="30" height="30" fill="#00ffff"/></svg>
    </svg>`);
  near(pic.at(60, 50), [0, 0, 255], 8, 'inside the root viewport');
  near(pic.at(10, 50), BLACK, 8, 'left of the root viewport');
  near(pic.at(60, 100), BLACK, 8, 'below the root viewport');
  near(pic.at(150, 50), [0, 255, 255], 8, 'inside the nested viewport');
  near(pic.at(120, 20), BLACK, 8, 'outside the nested viewport');
});

test('fill, stroke and group opacity stay translucent over a dark page', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <rect x="0" y="0" width="60" height="60" fill="#ffffff" fill-opacity="0.5"/>
      <rect x="10" y="80" width="40" height="20" fill="none" stroke="#ffffff" stroke-width="10" stroke-opacity="0.5"/>
      <g opacity="0.5"><rect x="80" y="0" width="60" height="60" fill="#ff0000"/><rect x="110" y="30" width="60" height="60" fill="#0000ff"/></g>
    </svg>`);
  near(pic.at(30, 30), [128, 128, 128], 12, 'white at 50% fill opacity over black');
  near(pic.at(30, 80), [128, 128, 128], 12, 'white at 50% stroke opacity over black');
  near(pic.at(90, 10), [128, 0, 0], 12, 'red alone in the faded group');
  // One picture faded as a whole: the blue covers the red where they overlap.
  near(pic.at(125, 45), [0, 0, 128], 12, 'the overlap inside the faded group');
});

test('an <svg> the walker fades is faded as one picture', { skip: SKIP, timeout: 120_000 }, async () => {
  // The walker sets the opacity of an <svg> of a few shapes as an alpha around the
  // picture, which the previous painter applied to each shape on its own, so the red
  // showed through the blue where they overlap.
  const pic = await paint(`
    <svg style="${at(0, 0)};opacity:0.5" width="200" height="120" viewBox="0 0 200 120">
      <rect x="0" y="0" width="120" height="120" fill="#ff0000"/><rect x="80" y="0" width="120" height="120" fill="#0000ff"/>
    </svg>`);
  near(pic.at(40, 60), [128, 0, 0], 12, 'red alone, at half strength');
  near(pic.at(100, 60), [0, 0, 128], 12, 'the overlap shows the blue on top, at half strength');
  near(pic.at(160, 60), [0, 0, 128], 12, 'blue alone, at half strength');
});

test('an SVG in an <img> the page fades keeps its own translucency under that fade', { skip: SKIP, timeout: 120_000 }, async () => {
  // PDF sets alpha rather than multiplying, so an alpha the painter set used to replace
  // the walker's fade of the <img> instead of combining with that fade.
  const inner = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50">'
    + '<rect width="50" height="50" fill="#ff0000" fill-opacity="0.5"/><rect x="50" width="50" height="50" fill="#00ff00"/></svg>';
  const pic = await paint(`<img style="${at(0, 0)};opacity:0.5" width="100" height="50" src="data:image/svg+xml;base64,${Buffer.from(inner).toString('base64')}">`);
  near(pic.at(25, 25), [64, 0, 0], 12, 'red at 50% inside an image at 50%');
  near(pic.at(75, 25), [0, 128, 0], 12, 'opaque green inside an image at 50%');
});

test('linear and radial gradients go in as vector shadings, with stop opacity as a soft mask', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <defs>
        <linearGradient id="lg"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient>
        <radialGradient id="rg" gradientUnits="userSpaceOnUse" cx="0" cy="0" r="25" gradientTransform="translate(150 30)">
          <stop offset="0" stop-color="#00ff00"/><stop offset="1" stop-color="#000000"/>
        </radialGradient>
        <linearGradient id="fade" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>
      </defs>
      <rect x="0" y="0" width="100" height="60" fill="url(#lg)"/>
      <rect x="100" y="0" width="100" height="60" fill="url(#rg)"/>
      <rect x="0" y="60" width="100" height="60" fill="url(#fade)"/>
    </svg>`);
  near(pic.at(2, 30), [255, 0, 0], 16, 'the linear gradient starts red');
  near(pic.at(98, 30), [0, 0, 255], 16, 'and ends blue');
  near(pic.at(150, 30), [0, 255, 0], 16, 'the transformed radial gradient centre');
  near(pic.at(105, 5), BLACK, 16, 'beyond the radial gradient');
  near(pic.at(50, 62), [255, 255, 255], 20, 'the top of the fading gradient');
  near(pic.at(50, 118), BLACK, 20, 'the bottom of the fading gradient, through its soft mask');
  assert.ok(!pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'the gradients are drawn, not rasterised');
  assert.ok(pic.objects.some(o => /\/ShadingType\s+2/.test(o)), 'an axial shading');
  assert.ok(pic.objects.some(o => /\/ShadingType\s+3/.test(o)), 'a radial shading');
  assert.ok(pic.objects.some(o => /\/SMask\s*<<[^>]*\/S\s*\/Luminosity/.test(o)), 'a luminosity soft mask for the stop opacities');
});

test('a gradient stroke and outlined gradient text are vector shadings too', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <defs>
        <linearGradient id="sg" gradientUnits="userSpaceOnUse" x1="10" y1="0" x2="190" y2="0"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient>
        <linearGradient id="tg"><stop offset="0" stop-color="#ffff00"/><stop offset="1" stop-color="#00ffff"/></linearGradient>
      </defs>
      <path d="M10 15H190" fill="none" stroke="url(#sg)" stroke-width="16"/>
      <text x="10" y="110" font-family="Outfit" font-weight="900" font-size="80" fill="url(#tg)">HH</text>
    </svg>`, 200, 120, true);
  near(pic.at(14, 15), [255, 0, 0], 24, 'the stroke starts red');
  near(pic.at(186, 15), [0, 0, 255], 24, 'and ends blue');
  near(pic.at(100, 34), BLACK, 8, 'below the stroke, inside the bounds the shading fills through the stroke mask');
  // The letters' first and last inked columns on one row take the two ends of the gradient.
  const row = Array.from({ length: pic.width }, (_, x) => pic.at(x, 85));
  const inked = row.map((c, x) => (c.some(v => v > 60) ? x : -1)).filter(x => x >= 0);
  assert.ok(inked.length > 20, 'the outlined letters are drawn');
  const first = row[inked[0]! + 2]!, last = row[inked.at(-1)! - 2]!;
  assert.ok(first[0] > 180 && first[2] < 110, `the first letter starts yellow: read rgb(${first.join(', ')})`);
  assert.ok(last[0] < 110 && last[2] > 180, `the last letter ends cyan: read rgb(${last.join(', ')})`);
  assert.ok(!pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'no picture: the stroke used to rasterise the whole SVG');
  assert.ok(!pic.streams.some(st => /\bT[jJ]\b/.test(st)), 'the text is outlined, not set as live text');
});

test('an SVG with a filter is still drawn as a picture', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="100" height="100" viewBox="0 0 100 100">
      <defs><filter id="b"><feGaussianBlur stdDeviation="2"/></filter></defs>
      <rect x="20" y="20" width="60" height="60" fill="#ffff00" filter="url(#b)"/>
    </svg>`);
  near(pic.at(50, 50), [255, 255, 0], 16, 'the blurred square');
  assert.ok(pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'a filter is beyond the painter, so the SVG is a picture');
});

test('an SVG clipped to text is drawn as a picture, clipped', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="100" viewBox="0 0 200 100">
      <defs><clipPath id="t"><text x="10" y="80" font-family="sans-serif" font-weight="900" font-size="90">II</text></clipPath></defs>
      <rect width="200" height="100" fill="#ff00ff" clip-path="url(#t)"/>
    </svg>`);
  near(pic.at(190, 10), BLACK, 16, 'outside the letters');
  assert.ok(pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'text in a clip path is beyond the painter, so the SVG is a picture');
});
