// SPDX-License-Identifier: MPL-2.0
/**
 * A PDF prints what the page and the PNG show. Three things it used to leave out or move:
 *
 * - a `<canvas>`: the SVG walker draws its pixels, the PDF walker drew nothing (the WebGL
 *   globe in Timezone's PDFs);
 * - the fill and border of an inline-block, such as a `<button>`: the PDF's inline pass drew
 *   its text and not its box (the white label on Claim's button, on a page of the same green);
 * - a root whose box is not the page's shape: the raster draws it at the page's width and the
 *   page crops it, while the PDF moved every box by a different scale on each axis and kept the
 *   text at the width's scale, and the SVG squashed it (Redact's placeholder).
 *
 * Read back with Poppler and measured against the live page, as
 * export-pdf-text.browser.test.ts does. The goldens at the end pin documents these changes
 * must not touch; they were written by main before the change.
 *
 * Regenerate the goldens: UPDATE_GOLDENS=1 node --test shells/web/src/bridge/export-pdf-parity.browser.test.ts
 * on a checkout of main, because they exist to pin the bytes from before a change.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = fileURLToPath(new URL('../../../../', import.meta.url));
const EXPORT_MODULE = join(HERE, 'export.ts');
const OUTFIT_TTF = join(REPO, 'shells/web/public/fonts/Outfit[wght].ttf');
const HB_WASM = join(REPO, 'node_modules/harfbuzzjs/dist/harfbuzz.wasm');
const FONT_CSS = `@font-face{font-family:Outfit;src:url('/fonts/Outfit[wght].ttf') format('truetype');font-weight:100 900}`;

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
  : !(await have('pdftoppm')) || !(await have('pdfimages')) ? 'no poppler binaries (needs pdftoppm and pdfimages)' : false;

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderPdf, renderSvgFromHtml, createExportAPI } from ${JSON.stringify(EXPORT_MODULE)};
                 import { createTextAPI } from ${JSON.stringify(join(HERE, 'text.ts'))};
                 window.__setup = () => createExportAPI({ text: createTextAPI(), log: () => {} });
                 window.__pdf = renderPdf;
                 window.__svg = renderSvgFromHtml;`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'esnext', logLevel: 'silent',
    loader: { '.css': 'empty' },
    plugins: [{
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

let shared: any = null;
async function page(): Promise<any> {
  const { chromium } = browser as { chromium: any };
  if (!shared) {
    shared = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
    shared.__page = await shared.newPage({ viewport: { width: 700, height: 400 } });
    await shared.__page.route('**/*', async (route: any) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (p === '/fonts/Outfit[wght].ttf') return route.fulfill({ contentType: 'font/ttf', body: readFileSync(OUTFIT_TTF) });
      if (p.endsWith('.wasm')) return route.fulfill({ contentType: 'application/wasm', body: readFileSync(HB_WASM) });
      if (p === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: '<!doctype html><meta charset="utf-8"><body></body>' });
      return route.fulfill({ status: 404, body: '' });
    });
    await shared.__page.goto('http://localhost/');
  }
  return shared.__page;
}
test.after(async () => { if (shared) await shared.close(); });

const W = 600, H = 120;

/** Mount `inner` in a root of `w` x `h`, run `draw` in the page, and screenshot the root. */
async function mount(inner: string, w = W, h = H, draw = ''): Promise<{ pg: any; screen: Buffer }> {
  const pg = await page();
  await pg.setContent(`<!doctype html><meta charset="utf-8"><style>${FONT_CSS}</style><body style="margin:0">`
    + `<div id="root" style="position:relative;width:${w}px;height:${h}px;background:#fff;overflow:hidden;font-family:Outfit">${inner}</div></body>`);
  await pg.evaluate(async () => { await Promise.all([...(document as any).fonts].map((f: any) => f.load().catch(() => {}))); });
  if (draw) await pg.evaluate(draw);
  await pg.addScriptTag({ content: await bundle(), type: 'module' });
  await pg.waitForFunction(() => !!(window as any).__pdf);
  return { pg, screen: await pg.locator('#root').screenshot() };
}

/** How much of each picture's ink the other has within 2 px (export-pdf-text.browser.test.ts). */
async function agreement(pg: any, a: Buffer, b: Buffer): Promise<number> {
  return pg.evaluate(async ([x, y]: string[]) => {
    const mask = async (data: string) => {
      const im = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const c = new OffscreenCanvas(im.width, im.height);
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, im.width, im.height);
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, im.width, im.height).data;
      const m = new Uint8Array(im.width * im.height);
      for (let i = 0; i < m.length; i++) m[i] = (d[i * 4]! + d[i * 4 + 1]! + d[i * 4 + 2]!) < 600 ? 1 : 0;
      return { m, w: im.width, h: im.height };
    };
    const A = await mask(x!), B = await mask(y!);
    if (A.w !== B.w || A.h !== B.h) return -1;
    const covered = (p: typeof A, q: typeof A) => {
      let ink = 0, hit = 0;
      for (let yy0 = 0; yy0 < p.h; yy0++) for (let xx0 = 0; xx0 < p.w; xx0++) {
        if (!p.m[yy0 * p.w + xx0]) continue;
        ink++;
        search: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const yy = yy0 + dy, xx = xx0 + dx;
          if (yy >= 0 && yy < q.h && xx >= 0 && xx < q.w && q.m[yy * q.w + xx]) { hit++; break search; }
        }
      }
      return ink ? hit / ink : 1;
    };
    return Math.min(covered(A, B), covered(B, A));
  }, [a.toString('base64'), b.toString('base64')]);
}

interface Pdf { bytes: Buffer; png: Buffer; images: number }

/** Export the mounted root as a PDF and read it back at 96 dpi with Poppler. */
async function pdfOf(pg: any, opts: Record<string, unknown> = {}): Promise<Pdf> {
  const b64: string = await pg.evaluate(async (o: Record<string, unknown>) => {
    const w = window as any;
    w.__setup();
    const blob = await w.__pdf(document.getElementById('root'), o);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return btoa(s);
  }, opts);
  const bytes = Buffer.from(b64, 'base64');
  const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-parity-'));
  const file = join(dir, 'out.pdf');
  await writeFile(file, bytes);
  await run('pdftoppm', ['-png', '-singlefile', '-r', '96', file, join(dir, 'page')]);
  const { stdout: list } = await run('pdfimages', ['-list', file]).catch(() => ({ stdout: '' }));
  return { bytes, png: await readFile(join(dir, 'page.png')), images: list.split('\n').filter((l) => /^\s*\d+\s+\d+\s+image\b/.test(l)).length };
}

/** Export the mounted root as an SVG, and the picture Chromium draws from that file. */
async function svgOf(pg: any, opts: Record<string, unknown>, w: number, h: number): Promise<{ text: string; png: Buffer }> {
  const text: string = await pg.evaluate(async (o: Record<string, unknown>) => {
    const win = window as any;
    win.__setup();
    return (await win.__svg(document.getElementById('root'), { rasterFallback: false, ...o })).text();
  }, opts);
  const ctx = await (shared as any).newContext({ viewport: { width: w, height: h } });
  const p2 = await ctx.newPage();
  await p2.setContent(`<!doctype html><body style="margin:0;background:#fff"><img id="i" src="data:image/svg+xml;base64,${Buffer.from(text).toString('base64')}" style="display:block;width:${w}px;height:${h}px"></body>`);
  await p2.evaluate(() => (document.getElementById('i') as HTMLImageElement).decode().catch(() => {}));
  const png = await p2.locator('#i').screenshot();
  await ctx.close();
  return { text, png };
}

/** The top `h` rows of a screenshot: what a raster export of a taller root at the same width keeps. */
async function topRows(pg: any, shot: Buffer, w: number, h: number): Promise<Buffer> {
  const b64: string = await pg.evaluate(async ([data, ww, hh]: [string, number, number]) => {
    const im = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
    const c = new OffscreenCanvas(ww, hh);
    c.getContext('2d')!.drawImage(im, 0, 0);
    const blob = await c.convertToBlob({ type: 'image/png' });
    const u = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
    return btoa(s);
  }, [shot.toString('base64'), w, h]);
  return Buffer.from(b64, 'base64');
}

const AGREES = 0.9;

// ── <canvas> ─────────────────────────────────────────────────────────────────

const DRAWN = `(() => { const c = document.querySelector('canvas'); const g = c.getContext('2d');
  g.fillStyle = '#123'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#9c9'; g.beginPath(); g.arc(c.width / 2, c.height / 2, c.height / 2 - 6, 0, Math.PI * 2); g.fill(); })()`;

test('a drawn canvas prints its pixels where the page shows them', { skip: SKIP }, async () => {
  const { pg, screen } = await mount('<canvas width="400" height="160" style="position:absolute;left:100px;top:10px;width:200px;height:80px"></canvas>', W, H, DRAWN);
  const pdf = await pdfOf(pg);
  assert.equal(pdf.images, 1, 'the canvas is one picture');
  const a = await agreement(pg, screen, pdf.png);
  assert.ok(a > AGREES, `the PDF's ink agrees with the page's on only ${(a * 100).toFixed(1)}%`);
});

test('a WebGL canvas copied into a 2-D canvas prints, as Timezone draws its globe', { skip: SKIP }, async () => {
  const draw = `(() => { const scratch = document.createElement('canvas'); scratch.width = 400; scratch.height = 160;
    const gl = scratch.getContext('webgl'); if (!gl) return;
    gl.clearColor(0.1, 0.5, 0.3, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    const c = document.querySelector('canvas'); c.getContext('2d').drawImage(scratch, 0, 0); })()`;
  const { pg, screen } = await mount('<canvas width="400" height="160" style="position:absolute;left:100px;top:10px;width:200px;height:80px"></canvas>', W, H, draw);
  const pdf = await pdfOf(pg);
  assert.equal(pdf.images, 1);
  const a = await agreement(pg, screen, pdf.png);
  assert.ok(a > AGREES, `the PDF's ink agrees with the page's on only ${(a * 100).toFixed(1)}%`);
});

test('a canvas with nothing drawn adds nothing to the file', { skip: SKIP }, async () => {
  const { pg } = await mount('<canvas width="400" height="160" style="position:absolute;left:100px;top:10px;width:200px;height:80px"></canvas>');
  assert.equal((await pdfOf(pg)).images, 0);
});

// ── inline-block boxes ───────────────────────────────────────────────────────

const BUTTON = '<div style="text-align:center;padding-top:30px"><button type="button" style="border:0;border-radius:10px;padding:10px 18px;font:600 16px Outfit;background:#033633;color:#fff">Choose files…</button></div>';

test('a button keeps its fill and its label stays on it', { skip: SKIP }, async () => {
  const { pg, screen } = await mount(BUTTON);
  const a = await agreement(pg, screen, (await pdfOf(pg)).png);
  assert.ok(a > AGREES, `the PDF's ink agrees with the page's on only ${(a * 100).toFixed(1)}%`);
});

test('an inline-block in a line of text keeps its border, and the line keeps its order', { skip: SKIP }, async () => {
  const { pg, screen } = await mount('<p style="font-size:20px;margin:30px 20px">Press <span style="display:inline-block;border:2px solid #333;border-radius:6px;padding:2px 8px">Enter</span> to <b style="display:inline-flex;background:#ddd;padding:2px 6px">go</b>.</p>');
  const a = await agreement(pg, screen, (await pdfOf(pg)).png);
  assert.ok(a > AGREES, `the PDF's ink agrees with the page's on only ${(a * 100).toFixed(1)}%`);
});

// ── a root that is not the page's shape ──────────────────────────────────────

const TALL = '<div style="position:absolute;left:20px;top:16px;font-size:28px;font-weight:600">Heading</div>'
  + '<div style="position:absolute;left:20px;top:64px;width:140px;height:40px;background:#1a85c4;border-radius:8px"></div>'
  + '<div style="position:absolute;left:20px;top:150px;font-size:20px">Below the page</div>';

test('a root taller than the page prints as the PNG does: at the page width, cropped', { skip: SKIP }, async () => {
  const { pg, screen } = await mount(TALL, W, 200);
  const expected = await topRows(pg, screen, W, H);
  const pdf = await pdfOf(pg, { width: W, height: H });
  const a = await agreement(pg, expected, pdf.png);
  assert.ok(a > AGREES, `the PDF's ink agrees with the PNG's on only ${(a * 100).toFixed(1)}%`);
});

test('a root taller than the page draws in SVG as the PNG does', { skip: SKIP }, async () => {
  const { pg, screen } = await mount(TALL, W, 200);
  const expected = await topRows(pg, screen, W, H);
  const svg = await svgOf(pg, { width: W, height: H }, W, H);
  const a = await agreement(pg, expected, svg.png);
  assert.ok(a > AGREES, `the SVG's ink agrees with the PNG's on only ${(a * 100).toFixed(1)}%`);
});

// ── bytes that must not move ─────────────────────────────────────────────────

const GOLDEN = join(HERE, '__fixtures__/export-pdf-parity.golden.json');
const UPDATE = process.env.UPDATE_GOLDENS === '1';
const committed: Record<string, string> = existsSync(GOLDEN) ? JSON.parse(readFileSync(GOLDEN, 'utf8')) : {};
const regenerated: Record<string, string> = {};
test.after(() => {
  if (!UPDATE) return;
  if (SKIP) assert.fail(`UPDATE_GOLDENS=1 but the suite cannot run here (${SKIP})`);
  mkdirSync(dirname(GOLDEN), { recursive: true });
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(regenerated).sort()) sorted[key] = regenerated[key]!;
  writeFileSync(GOLDEN, `${JSON.stringify(sorted, null, 2)}\n`);
});

/** Every object of the file in object order, without the XMP and the dates (export-pdf-text). */
async function contentHash(bytes: Buffer): Promise<string> {
  const { PDFDocument, PDFName, PDFRawStream, decodePDFRawStream } = await import('pdf-lib');
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const hash = createHash('sha256');
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      if (String(obj.dict.get(PDFName.of('Type'))) === '/Metadata') continue;
      hash.update(ref.toString()).update(decodePDFRawStream(obj).decode());
      continue;
    }
    const text = obj.toString();
    if (/\/(CreationDate|ModDate)\b/.test(text)) continue;
    hash.update(ref.toString()).update(text);
  }
  return hash.digest('hex');
}

const PLAIN_INLINE = '<p style="font-size:20px;margin:30px 20px">Press <span style="display:inline-block">Enter</span> to <b style="display:inline-flex">go</b>.</p>';
const SAME: Record<string, { inner: string; w?: number; h?: number; draw?: string; opts?: Record<string, unknown>; svg?: boolean }> = {
  // An inline-block that paints no box of its own is drawn by the inline pass, as before.
  'inline-block-unpainted': { inner: PLAIN_INLINE },
  // A canvas the page has not drawn on.
  'canvas-blank': { inner: '<p style="margin:10px;font-size:20px">Text</p><canvas width="200" height="80"></canvas>' },
  // A root the page's shape: pixels, and millimetres whose pixel box rounds.
  'page-shape': { inner: TALL, opts: { width: W, height: H }, svg: true },
  'page-shape-mm': { inner: TALL, w: 567, h: 113, opts: { width: '150mm', height: '30mm' }, svg: true },
  // A root a pixel off the page's shape, within the rounding the export panel's canvas carries.
  'page-shape-rounded': { inner: TALL, w: 600, h: 121, opts: { width: W, height: H }, svg: true },
};

// A line of several inline runs leans on the platform font backend for each run's advance,
// so its bytes hold on the macOS the goldens were generated on (export-pdf-text.browser.test.ts
// keeps its own `inline` golden the same way).
const GENERATED_PLATFORM_ONLY = new Set(['inline-block-unpainted']);

for (const [name, c] of Object.entries(SAME)) {
  if (GENERATED_PLATFORM_ONLY.has(name) && process.platform !== 'darwin') continue;
  test(`golden: ${name} keeps its PDF bytes${c.svg ? ' and its SVG' : ''}`, { skip: SKIP }, async () => {
    const { pg } = await mount(c.inner, c.w ?? W, c.h ?? H, c.draw ?? '');
    const hash = await contentHash((await pdfOf(pg, c.opts ?? {})).bytes);
    assert.equal(await contentHash((await pdfOf(pg, c.opts ?? {})).bytes), hash, 'two renders agree');
    const svgHash = c.svg ? createHash('sha256').update((await svgOf(pg, c.opts ?? {}, W, H)).text).digest('hex') : '';
    if (UPDATE) {
      regenerated[name] = hash;
      if (c.svg) regenerated[`${name}.svg`] = svgHash;
      return;
    }
    assert.equal(hash, committed[name], `the PDF bytes of ${name} moved`);
    if (c.svg) assert.equal(svgHash, committed[`${name}.svg`], `the SVG of ${name} moved`);
  });
}
