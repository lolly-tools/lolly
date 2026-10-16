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
 * Where the claim is that the PDF draws what the browser draws (a blend mode, a CSS
 * transform, markers), the case compares the PDF with Chromium's own screenshot of the
 * same page, box by box.
 *
 * Real Chromium, pdftoppm and pdftotext, self-skipping when any is missing, as
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
const SKIP = typeof browser === 'string' ? browser
  : !(await have('pdftoppm')) || !(await have('pdftotext')) ? 'no poppler binaries (needs pdftoppm and pdftotext)' : false;

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
  /** The PDF, rasterised by poppler at 96 dpi. */
  at(x: number, y: number): [number, number, number];
  /** Chromium's own screenshot of the same page, when asked for. */
  screen(x: number, y: number): [number, number, number];
  /** Mean colour difference between the PDF and the screen over a box, from 0 to 1. */
  diff(box?: { x: number; y: number; w: number; h: number }): number;
  /** Every indirect object's dictionary as text, read through pdf-lib (object streams included). */
  objects: string[];
  /** Every compressed stream decoded: the page content, forms and soft masks. */
  streams: string[];
  /** The text pdftotext reads out of the file. */
  text: string;
  width: number;
  height: number;
  bytes: Buffer;
}

interface PaintOptions {
  /** Set up the text host, so text is outlined as Convert paths outlines text. */
  outline?: boolean;
  /** Export options, such as { convertPaths: false } for live text. */
  exportOpts?: Record<string, unknown>;
  /** Export through the API's render() in this format instead of renderPdf. */
  format?: 'pdf' | 'pdf-cmyk';
  /** Page background, black unless set. */
  background?: string;
}

/** Decode a PNG screenshot through a canvas in the page, as RGB rows. */
async function pixelsOf(page: any, png: Buffer): Promise<Buffer> {
  const b64 = await page.evaluate(async (data: string) => {
    const im = new Image();
    im.src = `data:image/png;base64,${data}`;
    await im.decode();
    const c = document.createElement('canvas');
    c.width = im.width; c.height = im.height;
    const g = c.getContext('2d')!;
    g.drawImage(im, 0, 0);
    const rgba = g.getImageData(0, 0, im.width, im.height).data;
    let out = '';
    for (let i = 0; i < rgba.length; i += 4) out += String.fromCharCode(rgba[i]!, rgba[i + 1]!, rgba[i + 2]!);
    return btoa(out);
  }, png.toString('base64'));
  return Buffer.from(b64, 'base64');
}

/** Export `markup` on a W x H page and read the PDF back as pixels, objects and text. */
async function paint(markup: string, W = 200, H = 120, opts: PaintOptions = {}): Promise<Picture> {
  const { chromium } = browser as { chromium: any };
  const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-svg-'));
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  let pdf: Buffer;
  let screen: Buffer;
  try {
    const page = await b.newPage({ viewport: { width: W + 40, height: H + 40 } });
    // The wrapper keeps the page on the HTML walker, which is how an inline <svg> in a
    // tool or a Design box is drawn; a root whose first child is an <svg> is treated
    // as an SVG page instead. The routes answer in-process, so nothing listens.
    const body = `<!doctype html><meta charset="utf-8"><style>${FONT}</style><body style="margin:0"><div id="root" style="position:relative;width:${W}px;height:${H}px;background:${opts.background ?? '#000'}"><div style="position:absolute;inset:0">${markup}</div></div></body>`;
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
    screen = await pixelsOf(page, await page.locator('#root').screenshot());
    const b64 = await page.evaluate(async ({ outline, exportOpts, format }: any) => {
      const w = window as any;
      const api = outline || format ? w.__setup() : null;
      const root = document.getElementById('root');
      const blob = format ? await api.render(root, format, exportOpts) : await w.__pdf(root, exportOpts);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (const byte of buf) s += String.fromCharCode(byte);
      return btoa(s);
    }, { outline: Boolean(opts.outline), exportOpts: opts.exportOpts ?? {}, format: opts.format ?? null });
    pdf = Buffer.from(b64, 'base64');
  } finally { await b.close(); }
  const pdfPath = join(dir, 'p.pdf');
  await writeFile(pdfPath, pdf);
  await run('pdftoppm', ['-r', '96', '-singlefile', pdfPath, join(dir, 'p')]);
  const ppm = await readFile(join(dir, 'p.ppm'));
  const header = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(ppm.subarray(0, 64).toString('latin1'))!;
  const w = Number(header[1]), h = Number(header[2]);
  const px = ppm.subarray(header[0].length);
  const text = await run('pdftotext', [pdfPath, '-']).then(r => r.stdout, () => '');
  const lib = await import('pdf-lib') as any;
  const doc = await lib.PDFDocument.load(pdf, { updateMetadata: false });
  // A stream's dictionary is its `dict`; a plain dictionary prints itself.
  const all = [...doc.context.enumerateIndirectObjects()].map(([, obj]: [unknown, any]) => obj);
  const objects = all.map((obj: any) => String(obj instanceof lib.PDFStream ? obj.dict : obj));
  const streams = all
    .filter((obj: any) => obj instanceof lib.PDFRawStream && String(obj.dict.get(lib.PDFName.of('Filter'))) === '/FlateDecode')
    .map((obj: any) => { try { return inflateSync(Buffer.from(obj.contents)).toString('latin1'); } catch { return ''; } });
  const read = (buf: Buffer, x: number, y: number): [number, number, number] => {
    const o = (Math.min(h - 1, Math.max(0, Math.round(y))) * w + Math.min(w - 1, Math.max(0, Math.round(x)))) * 3;
    return [buf[o]!, buf[o + 1]!, buf[o + 2]!];
  };
  return {
    raw: pdf.toString('latin1'),
    at: (x, y) => read(px, x, y),
    screen: (x, y) => read(screen, x, y),
    diff: (box = { x: 0, y: 0, w, h }) => {
      let sum = 0, n = 0;
      for (let y = box.y; y < box.y + box.h; y++) for (let x = box.x; x < box.x + box.w; x++) {
        const a = read(px, x, y), c = read(screen, x, y);
        sum += (Math.abs(a[0] - c[0]) + Math.abs(a[1] - c[1]) + Math.abs(a[2] - c[2])) / 3;
        n++;
      }
      return sum / n / 255;
    },
    objects,
    streams,
    text,
    width: w,
    height: h,
    bytes: pdf,
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
    </svg>`, 200, 120, { outline: true });
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

// ── What the review of the first painter found silently dropped ─────────────────

/** Mesh Gradient's blend mode SVG, as community/gradient/hooks.js builds it with no blur or grain. */
function meshGradient(blend: string): string {
  const pts = [['#2a6cff', 20, 25], ['#ff5a8a', 75, 20], ['#ffd23f', 60, 80], ['#28c7a1', 15, 85]] as const;
  const R = (75 / 100) * 900;
  const defs = pts.map(([c, x, y], i) => `<radialGradient id="mg-g${i + 1}" gradientUnits="userSpaceOnUse" cx="${(x * 16).toFixed(1)}" cy="${(y * 9).toFixed(1)}" r="${R.toFixed(1)}">`
    + `<stop offset="0" stop-color="${c}"/><stop offset="0.5" stop-color="${c}" stop-opacity="0.55"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('');
  const blobs = pts.map((_, i) => `<g class="mg-blob" style="mix-blend-mode:${blend}"><rect x="-400" y="-500" width="2400" height="1900" fill="url(#mg-g${i + 1})"/></g>`);
  return `<svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 1600 900" preserveAspectRatio="none"><defs>${defs}</defs>`
    + `<g><rect x="-400" y="-500" width="2400" height="1900" fill="${pts[0][0]}"/>${blobs.slice(1).join('')}${blobs[0]}</g></svg>`;
}

test('a blend mode matches Chromium: Mesh Gradient\'s hard-light blobs', { skip: SKIP, timeout: 120_000 }, async () => {
  // The first painter dropped mix-blend-mode in silence, and Mesh Gradient came out at
  // 5.5% mean error against the screen instead of 0.3%.
  const pic = await paint(meshGradient('hard-light'));
  assert.ok(pic.objects.some(o => /\/BM\s*\/HardLight/.test(o)), 'the blobs are painted with the HardLight blend mode');
  assert.ok(!pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'the blend is drawn as vectors');
  const err = pic.diff();
  assert.ok(err < 0.015, `the PDF matches the screen: mean error ${(err * 100).toFixed(2)}%`);
});

test('a CSS transform is drawn about its transform-origin, and a style rule beats the attribute', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <style>.moved { transform: translate(20px, 10px) scale(1.5); }</style>
      <rect x="20" y="20" width="60" height="40" fill="#ff0000" style="transform: rotate(30deg); transform-origin: center; transform-box: fill-box"/>
      <rect class="moved" x="80" y="20" width="40" height="30" fill="#00ff00" transform="translate(-80 0)"/>
    </svg>`);
  const err = pic.diff();
  assert.ok(err < 0.01, `the PDF matches the screen: mean error ${(err * 100).toFixed(2)}%`);
  near(pic.at(50, 40), [255, 0, 0], 8, 'the centre of the rotated rect');
  near(pic.at(150, 50), [0, 255, 0], 8, 'the rect moved by its class rule, not by its attribute');
});

test('a CSS filter, a textPath or a foreignObject makes the SVG a picture', { skip: SKIP, timeout: 120_000 }, async () => {
  const cases = [
    `<rect x="40" y="30" width="120" height="60" fill="#ffff00" style="filter: blur(3px)"/>`,
    `<defs><path id="arc" d="M20 90 Q100 10 180 90"/></defs><text font-size="20" fill="#ffffff"><textPath href="#arc">along the curve</textPath></text>`,
    `<foreignObject x="20" y="20" width="160" height="80"><div xmlns="http://www.w3.org/1999/xhtml" style="color:#fff;font:20px sans-serif">HTML inside</div></foreignObject>`,
  ];
  for (const body of cases) {
    const pic = await paint(`<svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">${body}</svg>`);
    assert.ok(pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), `drawn as a picture: ${body.slice(0, 60)}`);
    const err = pic.diff();
    assert.ok(err < 0.02, `the picture matches the screen: mean error ${(err * 100).toFixed(2)}% for ${body.slice(0, 40)}`);
  }
});

/** Every form XObject's BBox as [x0, y0, x1, y1]. */
const formBoxes = (pic: Picture): number[][] => pic.objects
  .filter(o => /\/Subtype\s*\/Form/.test(o))
  .map(o => (/\/BBox\s*\[\s*([^\]]+)\]/.exec(o)?.[1] ?? '').trim().split(/\s+/).map(Number));

test('translucent shapes are grouped in tight boxes and a line is never filled', { skip: SKIP, timeout: 120_000 }, async () => {
  // Every group used to be as large as the page and a margin of the page all round,
  // and a translucent line counted its default black fill, so each one became a group.
  // Diagram Builder's grid of 94 such lines opened in 5.1 s.
  const lines = Array.from({ length: 30 }, (_, i) => `<line x1="${5 + i * 6}" y1="70" x2="${5 + i * 6}" y2="118" stroke="#ffffff" stroke-width="1" opacity="0.16"/>`).join('');
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <rect x="10" y="10" width="40" height="30" fill="#ff0000" stroke="#ffffff" stroke-width="4" opacity="0.5"/>
      <g opacity="0.5"><rect x="60" y="10" width="40" height="30" fill="#00ff00"/><rect x="80" y="20" width="40" height="30" fill="#0000ff"/></g>
      ${lines}
    </svg>`);
  const boxes = formBoxes(pic);
  assert.equal(boxes.length, 2, 'one group for the stroked rect and one for the faded pair; the lines need none');
  for (const [x0, y0, x1, y1] of boxes) {
    assert.ok(x1! - x0! < 70 && y1! - y0! < 50, `a group as large as what it paints, not the page: [${[x0, y0, x1, y1].join(' ')}]`);
  }
  near(pic.at(5, 100), [41, 41, 41], 10, 'a translucent grid line over black');
  near(pic.at(8, 100), BLACK, 6, 'between the grid lines');
  assert.ok(pic.diff() < 0.01, `the PDF matches the screen: mean error ${(pic.diff() * 100).toFixed(2)}%`);
});

test('a mirrored <svg> is mirrored once, whichever way the mirror arrives', { skip: SKIP, timeout: 120_000 }, async () => {
  const halves = '<rect width="50" height="50" fill="#ff0000"/><rect x="50" width="50" height="50" fill="#0000ff"/>';
  const pic = await paint(`
    <svg style="${at(0, 0)};transform:scaleX(-1)" width="100" height="50" viewBox="0 0 100 50">${halves}</svg>
    <svg style="${at(100, 0)};scale:-1 1" width="100" height="50" viewBox="0 0 100 50">${halves}</svg>
    <svg class="flip" style="${at(0, 60)};transform:scaleX(-1) rotate(4deg)" width="100" height="50" viewBox="0 0 100 50">${halves}</svg>
    <svg class="flip" style="${at(100, 60)}" width="100" height="50" viewBox="0 0 100 50">${halves}</svg>`);
  near(pic.at(25, 25), [0, 0, 255], 8, 'transform scaleX(-1): blue on the left');
  near(pic.at(125, 25), [0, 0, 255], 8, 'scale: -1 1: blue on the left');
  near(pic.at(25, 85), [0, 0, 255], 12, 'a mirror inside a rotation the walker draws itself: blue on the left');
  near(pic.at(125, 85), [255, 0, 0], 8, 'a .flip class with no transform is not a mirror: red on the left');
});

test('text with a list of x positions starts at the first one', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <text x="60 90 120" y="90" font-family="Outfit" font-weight="900" font-size="80" fill="#ffffff">II</text>
    </svg>`, 200, 120, { outline: true });
  const row = Array.from({ length: pic.width }, (_, x) => pic.at(x, 60));
  const firstInk = row.findIndex(c => c.some(v => v > 128));
  assert.ok(firstInk > 55 && firstInk < 75, `the run starts near x=60, not at 0: first ink at ${firstInk}`);
});

test('a clip path\'s transform applies after its bounding-box mapping, as in Chromium', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <defs><clipPath id="half" clipPathUnits="objectBoundingBox" transform="translate(20 0)"><rect width="0.5" height="1"/></clipPath></defs>
      <rect x="100" y="10" width="80" height="100" fill="#00ffff" clip-path="url(#half)"/>
    </svg>`);
  for (const x of [105, 125, 150, 165, 175]) {
    near(pic.at(x, 60), pic.screen(x, 60), 24, `as the screen shows at x=${x}`);
  }
});

test('an objectBoundingBox gradient turned by gradientTransform follows its box', { skip: SKIP, timeout: 120_000 }, async () => {
  // rotate(90) applies in bounding-box units, before the mapping onto the box; applied
  // after the mapping, it would turn the gradient about the user-space origin.
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <defs><linearGradient id="g" gradientTransform="rotate(90)"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
      <rect x="100" y="10" width="80" height="100" fill="url(#g)"/>
    </svg>`);
  near(pic.at(140, 13), [255, 0, 0], 24, 'red along the top');
  near(pic.at(140, 107), [0, 0, 255], 24, 'blue along the bottom');
  const err = pic.diff({ x: 100, y: 10, w: 80, h: 100 });
  assert.ok(err < 0.02, `the gradient matches the screen: mean error ${(err * 100).toFixed(2)}%`);
});

test('a print export keeps a spot colour inside a translucent group, with its colour space on the group', { skip: SKIP, timeout: 120_000 }, async () => {
  // A group has resources of its own; the CMYK pass writes the spot\'s colour space
  // and overprint state into the group\'s stream, so they must be on the group too.
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="200" height="120" viewBox="0 0 200 120">
      <g opacity="0.5"><rect x="10" y="10" width="80" height="60" fill="#ff0000"/><rect x="50" y="40" width="80" height="60" fill="#00ff00"/></g>
    </svg>`, 200, 120, { format: 'pdf-cmyk', exportOpts: { palette: [{ hex: '#ff0000', spot: { name: 'Brand Red' } }] } });
  const forms = pic.objects.filter(o => /\/Subtype\s*\/Form/.test(o) && /\/I\s+true/.test(o));
  assert.equal(forms.length, 1, 'the faded pair is one group');
  assert.ok(pic.streams.some(st => /\/CS\d+\s+cs\s+1\s+scn/.test(st)), 'the red is painted in the spot colour space');
  assert.match(forms[0]!, /\/ColorSpace\s*<<\s*\/CS\d+/, 'the group carries the spot colour space it paints with');
  assert.match(forms[0]!, /\/ExtGState\s*<<[^>]*\/GSf[ko]/, 'and the overprint state the swap selected');
});

// ── Markers, drawn as vectors ───────────────────────────────────────────────────

const MARKERS = `
  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#ffff00"/></marker>
    <marker id="dot" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5"><circle cx="5" cy="5" r="5" fill="#00ffff"/></marker>
    <marker id="user" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="8" refY="8" orient="auto"><rect width="16" height="16" fill="#ff00ff"/></marker>
  </defs>`;

/** Mean error between the PDF and the screen in a box around a point. */
const around = (pic: Picture, x: number, y: number, r = 14): number => pic.diff({ x: x - r, y: y - r, w: 2 * r, h: 2 * r });

test('markers are drawn as vectors: arrowheads on a line, auto-start-reverse and a curve end', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="300" height="160" viewBox="0 0 300 160">${MARKERS}
      <line x1="30" y1="30" x2="140" y2="30" stroke="#ffffff" stroke-width="3" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
      <path d="M30 100 C 70 40, 110 160, 150 100" fill="none" stroke="#ffffff" stroke-width="3" marker-end="url(#arrow)"/>
    </svg>`, 300, 160);
  assert.ok(!pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'the markers are vectors');
  for (const [x, y, what] of [[140, 30, 'the end arrow'], [30, 30, 'the reversed start arrow'], [150, 100, 'the arrow along the curve\'s end tangent']] as const) {
    const err = around(pic, x, y);
    assert.ok(err < 0.05, `${what} matches the screen: mean error ${(err * 100).toFixed(2)}%`);
  }
  near(pic.at(137, 30), pic.screen(137, 30), 40, 'the end arrow\'s colour at its tip');
  assert.ok(pic.diff() < 0.01, `the whole picture matches the screen: mean error ${(pic.diff() * 100).toFixed(2)}%`);
});

test('markers go on every vertex of a polyline, at the ends of an arc only and in user units', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="300" height="160" viewBox="0 0 300 160">${MARKERS}
      <polyline points="20,20 70,70 120,20 170,70" fill="none" stroke="#ffffff" stroke-width="2" marker-start="url(#dot)" marker-mid="url(#dot)" marker-end="url(#dot)"/>
      <path d="M190 40 A 40 30 0 0 1 270 40" fill="none" stroke="#ffffff" stroke-width="2" marker-mid="url(#dot)" marker-end="url(#arrow)"/>
      <path d="M30 130 L 250 130" stroke="#ffffff" stroke-width="1" marker-end="url(#user)"/>
    </svg>`, 300, 160);
  for (const [x, y, what] of [[20, 20, 'the start dot'], [70, 70, 'a mid dot'], [120, 20, 'a mid dot'], [170, 70, 'the end dot'], [270, 40, 'the arrow at the arc end'], [250, 130, 'the user-unit square']] as const) {
    const err = around(pic, x, y);
    assert.ok(err < 0.05, `${what} matches the screen: mean error ${(err * 100).toFixed(2)}%`);
  }
  // An arc is one command, so it has no vertex in its middle, though the path reader
  // splits it into several curves.
  near(pic.at(230, 10), pic.screen(230, 10), 30, 'no mid marker at the top of the arc');
  assert.ok(pic.diff() < 0.01, `the whole picture matches the screen: mean error ${(pic.diff() * 100).toFixed(2)}%`);
});

test('markers keep a fixed angle, preserveAspectRatio, their viewport clip, context paint and their own inheritance', { skip: SKIP, timeout: 120_000 }, async () => {
  const fitted = (id: string, par: string) => `<marker id="${id}" markerUnits="userSpaceOnUse" markerWidth="30" markerHeight="30" viewBox="0 0 20 10" preserveAspectRatio="${par}"><rect width="20" height="10" fill="#ff00ff"/><rect width="5" height="10" fill="#00ff00"/></marker>`;
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="300" height="160" viewBox="0 0 300 160">
      <defs>
        <marker id="deg" viewBox="0 0 10 10" refY="5" markerWidth="8" markerHeight="8" orient="45"><path d="M0 0L10 5L0 10Z" fill="#ffff00"/></marker>
        <marker id="rad" viewBox="0 0 10 10" refY="5" markerWidth="8" markerHeight="8" orient="1.5708rad"><path d="M0 0L10 5L0 10Z" fill="#ffff00"/></marker>
        ${fitted('meet', 'xMaxYMax meet')}${fitted('none', 'none')}${fitted('slice', 'xMaxYMax slice')}
        <marker id="clip" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 0 10 10" refX="5" refY="5"><circle cx="10" cy="10" r="8" fill="#00ffff"/></marker>
        <marker id="noclip" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 0 10 10" refX="5" refY="5" style="overflow: visible"><circle cx="10" cy="10" r="8" fill="#00ffff"/></marker>
        <marker id="ctx" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="8" refY="8"><circle cx="8" cy="8" r="7" fill="context-stroke"/></marker>
        <marker id="ctxfill" markerUnits="userSpaceOnUse" markerWidth="16" markerHeight="16" refX="8" refY="8"><circle cx="8" cy="8" r="7" fill="context-fill"/></marker>
        <g fill="#00ff00"><marker id="inh" markerUnits="userSpaceOnUse" markerWidth="14" markerHeight="14" refX="7" refY="7"><rect width="14" height="14"/></marker></g>
      </defs>
      <line x1="60" y1="30" x2="20" y2="30" stroke="#ffffff" stroke-width="2" marker-end="url(#deg)"/>
      <line x1="80" y1="30" x2="110" y2="30" stroke="#ffffff" stroke-width="2" marker-end="url(#rad)"/>
      <path d="M140 20 h20" stroke="#ffffff" marker-start="url(#meet)"/>
      <path d="M180 20 h20" stroke="#ffffff" marker-start="url(#none)"/>
      <path d="M220 20 h20" stroke="#ffffff" marker-start="url(#slice)"/>
      <path d="M30 100 h30" stroke="#ffffff" marker-start="url(#clip)"/>
      <path d="M90 100 h30" stroke="#ffffff" marker-start="url(#noclip)"/>
      <path d="M150 100 h30" stroke="#ff8800" stroke-width="2" fill="none" marker-end="url(#ctx)"/>
      <polygon points="200,90 230,90 230,120" fill="#3355ff" stroke="#ffffff" marker-start="url(#ctxfill)"/>
      <line x1="250" y1="130" x2="280" y2="130" stroke="#ffffff" fill="#ff0000" marker-end="url(#inh)"/>
    </svg>`, 300, 160);
  assert.ok(!pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'the markers are vectors');
  const YELLOW: [number, number, number] = [255, 255, 0], GREEN: [number, number, number] = [0, 255, 0];
  const MAGENTA: [number, number, number] = [255, 0, 255], CYAN: [number, number, number] = [0, 255, 255];
  // Each point is read on the screen as well, so the case shows what Chromium draws and
  // not only what the painter draws.
  const points: [number, number, [number, number, number], string][] = [
    [28, 38, YELLOW, 'the arrow turned to a fixed 45 degrees, down and to the right'],
    [10, 30, BLACK, 'nothing where orient auto would point the arrow'],
    [110, 36, YELLOW, 'the arrow turned to a fixed angle given in radians'],
    [122, 30, BLACK, 'nothing where orient 0 would point that arrow'],
    [143, 27, GREEN, 'meet keeps the aspect ratio: the green end'],
    [160, 27, MAGENTA, 'meet keeps the aspect ratio: the rest'],
    [155, 42, BLACK, 'meet leaves the viewport below the content empty'],
    [183, 45, GREEN, 'none stretches the content to the viewport'],
    [265, 35, MAGENTA, 'slice fills the viewport'],
    [228, 35, BLACK, 'slice is cut to the viewport'],
    [32, 102, CYAN, 'the clipped circle inside its viewport'],
    [44, 114, BLACK, 'the clipped circle outside its viewport'],
    [104, 114, CYAN, 'overflow visible keeps the whole circle'],
    [180, 100, [255, 136, 0], 'context-stroke takes the line\'s stroke'],
    [200, 90, [51, 85, 255], 'context-fill takes the polygon\'s fill'],
    [280, 130, GREEN, 'marker content inherits from the marker\'s parent, not from the line'],
  ];
  for (const [x, y, want, what] of points) {
    near(pic.screen(x, y), want, 40, `${what} (screen)`);
    near(pic.at(x, y), want, 40, `${what} (PDF)`);
  }
  assert.ok(pic.diff() < 0.01, `the whole picture matches the screen: mean error ${(pic.diff() * 100).toFixed(2)}%`);
});

// ── Gradient text that stays text ───────────────────────────────────────────────

/** The first and last inked columns of a row, read a little way in. */
function ends(pic: Picture, y: number): { first: [number, number, number]; last: [number, number, number] } {
  const row = Array.from({ length: pic.width }, (_, x) => pic.at(x, y));
  const inked = row.map((c, x) => (c.some(v => v > 60) ? x : -1)).filter(x => x >= 0);
  assert.ok(inked.length > 20, `the letters are drawn on row ${y}`);
  return { first: row[inked[0]! + 2]!, last: row[inked.at(-1)! - 2]! };
}

test('SVG text with a gradient fill stays live text filled through a shading pattern', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="300" height="120" viewBox="0 0 300 120">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
      <text x="10" y="90" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="80" fill="url(#g)">WIDE</text>
    </svg>`, 300, 120, { exportOpts: { convertPaths: false } });
  assert.ok(pic.objects.some(o => /\/PatternType\s+2/.test(o)), 'a shading pattern');
  assert.ok(pic.streams.some(st => /\/Pattern\s+cs\s+\/P\d+\s+scn/.test(st) && /\bTj\b/.test(st)), 'the text is set with Tj in the Pattern colour space');
  assert.match(pic.text, /WIDE/, 'pdftotext reads the word');
  const { first, last } = ends(pic, 60);
  assert.ok(first[0] > 150 && first[2] < 100, `the first letter is red: read rgb(${first.join(', ')})`);
  assert.ok(last[0] < 100 && last[2] > 150, `the last letter is blue: read rgb(${last.join(', ')})`);
});

const CLIPPED_TEXT = `<p style="${at(0, 0)};margin:0;font:bold 64px Helvetica,Arial,sans-serif;line-height:100px;width:300px;`
  + `background:linear-gradient(90deg,#ff0000,#0000ff);-webkit-background-clip:text;background-clip:text;color:transparent">WIDE</p>`;

/** How many text-showing operators the PDF's streams hold: each is a word copy and search can find. */
const showOps = (pic: Picture): number => pic.streams.reduce((n, st) => n + (st.match(/\bTj\b/g) ?? []).length, 0);

test('HTML text with background-clip: text is live text filled with its background', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(CLIPPED_TEXT, 300, 120, { exportOpts: { convertPaths: false } });
  assert.ok(pic.streams.some(st => /7 Tr[\s\S]*\bTj\b[\s\S]*ET[\s\S]*\bsh\b/.test(st)), 'the glyphs are a clip (render mode 7) that a shading paints through');
  assert.equal(showOps(pic), 1, 'the word is set once, so copy and search find it once');
  assert.match(pic.text, /WIDE/, 'pdftotext reads the word');
  near(pic.at(290, 50), BLACK, 8, 'the box behind the text is not filled with the gradient');
  near(pic.at(150, 110), BLACK, 8, 'nor below the text');
  const { first, last } = ends(pic, 50);
  assert.ok(first[0] > 150 && first[2] < 110, `the first letter is red: read rgb(${first.join(', ')})`);
  assert.ok(last[0] < 160 && last[2] > 100, `the last letter is bluer: read rgb(${last.join(', ')})`);
  assert.ok(!pic.streams.some(st => /0 g\s+1 0 0 -1/.test(st)), 'the transparent text colour is not drawn in black');
});

test('outlined HTML text with background-clip: text takes the gradient as a shading', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(CLIPPED_TEXT.replace('Helvetica,Arial,sans-serif', 'Outfit'), 300, 120, { outline: true });
  assert.ok(!pic.streams.some(st => /\bTj\b/.test(st)), 'the text is outlined');
  assert.ok(pic.streams.some(st => /W n[\s\S]*\bsh\b/.test(st)), 'the outlines clip a shading');
  near(pic.at(290, 50), BLACK, 8, 'the box behind the text is not filled with the gradient');
  const { first, last } = ends(pic, 50);
  assert.ok(first[0] > 150 && first[2] < 110, `the first letter is red: read rgb(${first.join(', ')})`);
  assert.ok(last[0] < 160 && last[2] > 100, `the last letter is bluer: read rgb(${last.join(', ')})`);
});

test('a print export turns gradient shadings to CMYK, so the PDF/X colour checks pass', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="300" height="120" viewBox="0 0 300 120">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient></defs>
      <rect x="10" y="10" width="100" height="40" fill="url(#g)"/>
      <g opacity="0.5"><rect x="120" y="10" width="60" height="40" fill="#00ff00"/><rect x="150" y="30" width="60" height="40" fill="#ffffff"/></g>
      <text x="10" y="110" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="50" fill="url(#g)">WIDE</text>
    </svg>`, 300, 120, { format: 'pdf-cmyk', exportOpts: { convertPaths: false } });
  const shadings = pic.objects.filter(o => /\/ShadingType\s+[23]/.test(o));
  assert.ok(shadings.length > 0, 'the gradients are shadings');
  assert.ok(shadings.every(o => !/DeviceRGB/.test(o)), 'and none is left in DeviceRGB');
  assert.match(pic.text, /WIDE/, 'the gradient text is still text');
  const lib = await import('pdf-lib') as any;
  const { shadingCsOk, groupCsOk } = await import('../../../../packages/node-shell/src/pdfx.ts');
  const doc = await lib.PDFDocument.load(pic.bytes, { updateMetadata: false });
  assert.ok(shadingCsOk(doc, lib.PDFName), 'no shading paints in unmanaged RGB');
  assert.ok(groupCsOk(doc, lib.PDFName), 'no transparency group blends in RGB');
});

// ── Text the PDF sets wider than the browser ────────────────────────────────────

/** The first and last columns with ink between two rows, read through `px`, or null when the band is empty. */
function inkSpan(px: (x: number, y: number) => [number, number, number], width: number, y0: number, y1: number, ink = (c: [number, number, number]) => c.some(v => v > 60)): [number, number] | null {
  let first = -1, last = -1;
  for (let x = 0; x < width; x++) {
    for (let y = y0; y <= y1; y++) {
      if (ink(px(x, y))) { if (first < 0) first = x; last = x; break; }
    }
  }
  return first < 0 ? null : [first, last];
}

/** The four fixtures the second review found cut short, each in a group and then alone. */
const GROUPED_TEXT = [
  ['a condensed face', 'x="10" font-family="Avenir Next Condensed, Arial Narrow, sans-serif" font-size="44"', 'Condensed headline'],
  ['text-anchor end', 'x="510" text-anchor="end" font-family="Avenir Next Condensed, Arial Narrow, sans-serif" font-size="44"', 'Right aligned label'],
  ['letter-spacing -6', 'x="10" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="48" letter-spacing="-6"', 'Tight tracking'],
  ['textLength', 'x="10" font-family="Helvetica, Arial, sans-serif" font-weight="bold" font-size="40" textLength="150" lengthAdjust="spacingAndGlyphs"', 'Squeezed words'],
] as const;

/** Each fixture in a translucent group with a mark of its own, then alone at the same opacity 60 px lower. */
function groupedText(family?: string): string {
  return GROUPED_TEXT.map(([, attrs, words], i) => {
    const y = 120 * i;
    const a = family ? attrs.replace(/font-family="[^"]*"/, `font-family="${family}"`) : attrs;
    return `<g opacity="0.7"><rect x="255" y="${y + 2}" width="10" height="4" fill="#ff0000"/><text y="${y + 48}" ${a} fill="#ffffff">${words}</text></g>`
      + `<text y="${y + 108}" ${a} fill="#ffffff" fill-opacity="0.7">${words}</text>`;
  }).join('');
}

test('text in a translucent group is drawn in full, however much wider the PDF sets it than the browser', { skip: SKIP, timeout: 120_000 }, async () => {
  // The group's box used to be the browser's box for the text, and the PDF sets text in
  // its own font, with no letter-spacing or textLength, so what ran past the box was cut.
  for (const outline of [false, true]) {
    const pic = await paint(`<svg style="${at(0, 0)}" width="520" height="480" viewBox="0 0 520 480">${groupedText(outline ? 'Outfit' : undefined)}</svg>`,
      520, 480, outline ? { outline: true } : { exportOpts: { convertPaths: false } });
    assert.ok(formBoxes(pic).length >= 4, 'each grouped fixture is a transparency group');
    GROUPED_TEXT.forEach(([what], i) => {
      const grouped = inkSpan(pic.at, pic.width, 120 * i + 10, 120 * i + 60), alone = inkSpan(pic.at, pic.width, 120 * i + 70, 120 * i + 119);
      assert.ok(grouped && alone, `${what}: both rows are drawn`);
      assert.ok(Math.abs(grouped![0] - alone![0]) <= 2 && Math.abs(grouped![1] - alone![1]) <= 2,
        `${what}, ${outline ? 'outlined' : 'live'}: the grouped text spans ${grouped!.join(' to ')}, as the text alone spans ${alone!.join(' to ')}`);
    });
  }
});

test('a bare text node between tspans moves the pen by its own width', { skip: SKIP, timeout: 120_000 }, async () => {
  // It used to move by the whole <text>'s length, which sent "beta" 360 px along.
  const pic = await paint(`<svg style="${at(0, 0)}" width="400" height="100" viewBox="0 0 400 100"><text x="10" y="60" font-family="Helvetica, Arial, sans-serif" font-size="32" fill="#ffffff">Alpha <tspan fill="#00ff00">beta</tspan> gamma</text></svg>`,
    400, 100, { exportOpts: { convertPaths: false } });
  assert.match(pic.text.replace(/\s+/g, ' '), /Alpha beta gamma/, 'the words read in order, a space apart');
  const pdf = inkSpan(pic.at, pic.width, 20, 80), screen = inkSpan(pic.screen, pic.width, 20, 80);
  assert.ok(pdf && screen && Math.abs(pdf[1] - screen[1]) <= 8, `the line ends where the browser ends the line: ${pdf?.[1]} against ${screen?.[1]}`);
  const green = inkSpan(pic.at, pic.width, 20, 80, c => c[1] > 150 && c[0] < 100), greenOnScreen = inkSpan(pic.screen, pic.width, 20, 80, c => c[1] > 150 && c[0] < 100);
  assert.ok(green && greenOnScreen && Math.abs(green[0] - greenOnScreen[0]) <= 6, `"beta" starts at the browser's x: ${green?.[0]} against ${greenOnScreen?.[0]}`);
});

test('dominant-baseline and keyword weights are drawn as the browser draws them', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="400" height="140" viewBox="0 0 400 140">
      <defs><linearGradient id="g"><stop offset="0" stop-color="#223"/><stop offset="1" stop-color="#335"/></linearGradient></defs>
      <rect width="400" height="140" fill="url(#g)"/>
      <text x="10" y="40" dominant-baseline="middle" font-family="Outfit" font-size="28" fill="#ffffff">middle</text>
      <text x="140" y="40" dominant-baseline="hanging" font-family="Outfit" font-size="28" fill="#ffffff">hanging</text>
      <text x="280" y="40" dominant-baseline="central" font-family="Outfit" font-size="28" fill="#ffffff">central</text>
      <text x="10" y="120" font-family="Outfit" font-size="28" font-weight="bold" fill="#ffffff">bold keyword</text>
    </svg>`, 400, 140, { outline: true });
  assert.ok(!pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'the SVG stays vector');
  // Each word's box against the screen: about 2 to 3% here, 13 to 20% with every word on
  // the alphabetic baseline and the bold one regular.
  for (const [x, y, w, what] of [[10, 10, 110, 'middle'], [140, 30, 120, 'hanging'], [280, 15, 110, 'central'], [10, 90, 190, 'bold keyword']] as const) {
    const err = pic.diff({ x, y, w, h: 45 });
    assert.ok(err < 0.05, `${what} sits where the browser sets the word: mean error ${(err * 100).toFixed(2)}%`);
  }
});

test('a baseline shift, vertical text or a per-glyph rotate makes the SVG a picture', { skip: SKIP, timeout: 120_000 }, async () => {
  const one = (left: number, body: string) => `<svg style="${at(left, 0)}" width="120" height="120" viewBox="0 0 120 120"><rect width="120" height="120" fill="#223"/>${body}</svg>`;
  const pic = await paint(
    one(0, '<text x="10" y="70" font-family="Outfit" font-size="28" fill="#fff">E=mc<tspan baseline-shift="super" font-size="16">2</tspan></text>')
    + one(140, '<text x="60" y="10" font-family="Outfit" font-size="22" fill="#fff" writing-mode="vertical-rl">縦書き</text>')
    + one(280, '<text x="20" y="70" font-family="Outfit" font-size="28" fill="#fff" rotate="20">tilt</text>'),
    400, 120, { outline: true });
  assert.ok(pic.objects.filter(o => /\/Subtype\s*\/Image/.test(o)).length >= 3, 'each of the three is a picture');
  for (const [x, what] of [[0, 'the superscript'], [140, 'the vertical text'], [280, 'the rotated letters']] as const) {
    const err = pic.diff({ x, y: 0, w: 120, h: 120 });
    assert.ok(err < 0.03, `${what} matches the screen: mean error ${(err * 100).toFixed(2)}%`);
  }
});

// ── background-clip: text that is not one gradient ─────────────────────────────

const CLIP_TEXT = '-webkit-background-clip:text;background-clip:text';
const para = (top: number, style: string, words: string) => `<p style="${at(0, top)};margin:0;font:bold 56px Helvetica,Arial,sans-serif;line-height:80px;width:400px;${style}">${words}</p>`;
const STRIPES = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><rect width="10" height="20" fill="#ff00ff"/><rect x="10" width="10" height="20" fill="#00ffff"/></svg>')}`;
/** How many pixels in a band match `test`. */
const countIn = (pic: Picture, y0: number, y1: number, test: (c: [number, number, number]) => boolean): number => {
  let n = 0;
  for (let y = y0; y <= y1; y++) for (let x = 0; x < pic.width; x++) if (test(pic.at(x, y))) n++;
  return n;
};

test('text clipped to an image or a repeating gradient shows that background through its glyphs and stays searchable', { skip: SKIP, timeout: 120_000 }, async () => {
  // Neither background is one gradient, so the glyphs used to vanish.
  const pic = await paint(
    para(0, `background:url('${STRIPES}');${CLIP_TEXT};color:transparent`, 'Image fill')
    + para(80, `background:repeating-linear-gradient(90deg,#ff0000 0 20px,#00ff00 20px 40px);${CLIP_TEXT};color:transparent`, 'Stripes'),
    400, 160, { exportOpts: { convertPaths: false } });
  assert.match(pic.text, /Image fill/, 'pdftotext reads the first run');
  assert.match(pic.text, /Stripes/, 'and the second');
  assert.equal(showOps(pic), 2, 'each run is set once, as the clip its background shows through');
  assert.ok(pic.objects.some(o => /\/Subtype\s*\/Image/.test(o)), 'the backgrounds are pictures');
  const magenta = countIn(pic, 0, 79, c => c[0] > 180 && c[2] > 180 && c[1] < 90), cyan = countIn(pic, 0, 79, c => c[1] > 180 && c[2] > 180 && c[0] < 90);
  const red = countIn(pic, 80, 159, c => c[0] > 180 && c[1] < 90), green = countIn(pic, 80, 159, c => c[1] > 180 && c[0] < 90);
  assert.ok(magenta > 300 && cyan > 300, `the image's stripes show through the glyphs: ${magenta} magenta and ${cyan} cyan pixels`);
  assert.ok(red > 300 && green > 300, `so do the gradient's: ${red} red and ${green} green pixels`);
  assert.equal(countIn(pic, 0, 159, c => c.every(v => v > 200)), 0, 'and no glyph is drawn in white');
});

test('transparent text stays searchable and a translucent colour is painted once at its alpha', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(
    `<div style="${at(0, 0)};width:400px;height:60px;background:#ccddee"></div><p style="${at(10, 10)};margin:0;font:32px Helvetica,Arial,sans-serif;color:transparent">Searchable overlay</p>`
    + para(60, `background:linear-gradient(90deg,#ff0000,#0000ff);${CLIP_TEXT};color:rgba(255,255,255,0.3)`, 'Visible ink'),
    400, 140, { exportOpts: { convertPaths: false } });
  assert.match(pic.text, /Searchable overlay/, 'the transparent overlay is read');
  assert.ok(pic.streams.some(st => /3 Tr/.test(st)), 'as invisible text, render mode 3');
  assert.equal(showOps(pic), 2, 'each run is set once, so copy and search find it once');
  // White at 30% over the gradient on a black page: never the opaque white the run used to print in.
  const white = countIn(pic, 60, 139, c => c.every(v => v > 235));
  const tinted = countIn(pic, 60, 139, c => c[0] > 200 && c[1] > 60 && c[1] < 140);
  assert.ok(white < 50 && tinted > 200, `the run is the gradient lightened by its own colour: ${tinted} tinted and ${white} white pixels`);
});

test('a transparent stop under background-clip: text fades to the page, not to black', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(para(0, `background:linear-gradient(90deg,#ff0000,transparent);${CLIP_TEXT};color:transparent`, 'Fade out'),
    400, 80, { background: '#ffffff', exportOpts: { convertPaths: false } });
  assert.match(pic.text, /Fade out/, 'pdftotext reads the run');
  // The fade runs to the white page, so the end of the word is pale; a fade to black is dark red there.
  const end = inkSpan(pic.at, pic.width, 10, 70, c => c.some(v => v < 230))!;
  let darkest = 255;
  for (let y = 10; y <= 70; y++) for (let x = end[1] - 25; x <= end[1]; x++) darkest = Math.min(darkest, pic.at(x, y)[1]);
  assert.ok(darkest > 90, `the faded end of the word is pale: its darkest green channel is ${darkest}`);
});

// ── An SVG in an <img> ───────────────────────────────────────────────────────────

test('an SVG in an <img> keeps its blend modes inside the picture, as Chromium composites an image', { skip: SKIP, timeout: 120_000 }, async () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 100"><rect width="200" height="100" fill="#0055ff"/><rect x="100" width="260" height="100" fill="#ff0066" style="mix-blend-mode:multiply"/></svg>';
  const pic = await paint(`<div style="${at(0, 0)};width:400px;height:120px;background:#ffcc00"></div><img style="${at(20, 10)}" width="360" height="100" src="data:image/svg+xml,${encodeURIComponent(svg)}">`, 400, 120);
  near(pic.at(330, 60), [255, 0, 102], 12, 'beyond the blue the multiplied rect blends with nothing in the image, not with the yellow page');
  near(pic.at(170, 60), pic.screen(170, 60), 12, 'over the blue it multiplies as on screen');
  assert.ok(pic.diff() < 0.01, `the whole picture matches the screen: mean error ${(pic.diff() * 100).toFixed(2)}%`);
});

// ── More markers and mirrors ─────────────────────────────────────────────────────

test('markers scale with a non-scaling stroke, take the context shape\'s gradient, clip only for hidden overflow and mark a lone vertex', { skip: SKIP, timeout: 120_000 }, async () => {
  const pic = await paint(`
    <svg style="${at(0, 0)}" width="320" height="200" viewBox="0 0 320 200">
      <defs>
        <marker id="a" viewBox="0 0 20 10" refX="10" refY="5" markerWidth="12" markerHeight="6" orient="auto"><path d="M0 2H14V0L20 5L14 10V8H0Z" fill="#ffff00"/><path d="M14 0L20 5L14 10Z" fill="#ff0000"/></marker>
        <linearGradient id="g"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient>
        <marker id="cf" markerUnits="userSpaceOnUse" markerWidth="30" markerHeight="30" refX="15" refY="15"><circle cx="15" cy="15" r="14" fill="context-fill"/></marker>
        <marker id="cs" markerUnits="userSpaceOnUse" markerWidth="30" markerHeight="30" refX="15" refY="15"><circle cx="15" cy="15" r="14" fill="context-stroke"/></marker>
        <marker id="auto" markerUnits="userSpaceOnUse" markerWidth="20" markerHeight="20" viewBox="0 0 10 10" refX="5" refY="5" overflow="auto"><circle cx="10" cy="10" r="8" fill="#00ffff"/></marker>
        <marker id="s" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4"><circle cx="5" cy="5" r="5" fill="#ff00ff"/></marker>
        <marker id="e" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="4" markerHeight="4"><circle cx="5" cy="5" r="5" fill="#00ff00"/></marker>
      </defs>
      <g transform="scale(4)"><path d="M5 8 L30 8" fill="none" stroke="#ffffff" stroke-width="1" vector-effect="non-scaling-stroke" marker-end="url(#a)"/></g>
      <polygon points="160,20 300,20 300,50 160,50" fill="url(#g)" marker-start="url(#cf)" marker-mid="url(#cf)"/>
      <path d="M30 90 H140" stroke="url(#g)" stroke-width="6" fill="none" marker-start="url(#cs)" marker-end="url(#cs)"/>
      <path d="M20 150 h40" stroke="#ffffff" marker-end="url(#auto)"/>
      <path d="M130 150" stroke="#ffffff" stroke-width="3" marker-start="url(#s)" marker-end="url(#e)"/>
      <path d="M200 150 h60 h-60" stroke="#ffffff" stroke-width="2" fill="none" marker-mid="url(#a)"/>
    </svg>`, 320, 200);
  for (const [x, y, what] of [
    [120, 32, 'a non-scaling stroke\'s arrow, a quarter of its unscaled size'],
    [160, 20, 'context-fill sampled from the polygon\'s gradient at the polygon\'s corner'],
    [300, 50, 'and at the far corner'],
    [85, 90, 'nothing where a zero-height path lends its gradient'],
    [74, 164, 'overflow auto does not clip the circle'],
    [130, 150, 'a lone moveto takes its start and end markers'],
    [260, 140, 'where the path doubles back the mid arrow points up'],
  ] as const) {
    const err = around(pic, x, y);
    assert.ok(err < 0.05, `${what}: mean error ${(err * 100).toFixed(2)}%`);
  }
  near(pic.at(130, 150), [0, 255, 0], 40, 'the end marker on top of the start, as Chromium draws a lone vertex');
  near(pic.at(260, 141), pic.screen(260, 141), 60, 'the doubled-back arrow has its red tip above the vertex, as on screen');
  assert.ok(pic.diff() < 0.01, `the whole picture matches the screen: mean error ${(pic.diff() * 100).toFixed(2)}%`);
});

test('an inline <svg> is mirrored or turned however the mirror arrives: rotateY, rotateX, scaleY or the scale property', { skip: SKIP, timeout: 120_000 }, async () => {
  const quads = '<rect width="50" height="25" fill="#ff0000"/><rect x="50" width="50" height="25" fill="#0000ff"/><rect y="25" width="50" height="25" fill="#00ff00"/><rect x="50" y="25" width="50" height="25" fill="#ffff00"/>';
  const ways = ['transform:rotateY(180deg)', 'transform:rotateX(180deg)', 'transform:scaleY(-1)', 'scale:-1', 'scale:1 -1', 'transform:rotate(180deg)', 'transform:scaleX(-1)', 'scale:-1 1'];
  const pic = await paint(ways.map((w, i) => `<svg style="${at((i % 4) * 110, Math.floor(i / 4) * 60)};${w}" width="100" height="50" viewBox="0 0 100 50">${quads}</svg>`).join(''), 440, 120);
  ways.forEach((w, i) => {
    const l = (i % 4) * 110, t = Math.floor(i / 4) * 60;
    near(pic.at(l + 20, t + 10), pic.screen(l + 20, t + 10), 24, `${w}: the top left as on screen`);
    near(pic.at(l + 80, t + 40), pic.screen(l + 80, t + 40), 24, `${w}: the bottom right as on screen`);
  });
});
