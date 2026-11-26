// SPDX-License-Identifier: MPL-2.0
/**
 * An export root that moves on the page while a vector export walks its boxes.
 *
 * The PDF, SVG and PowerPoint walkers write each box at its offset from the export
 * root. The walk awaits text shaping, fonts and pictures, and the page keeps laying out
 * while it waits. On 2026-11-07 a command-line Print PDF of a Lolly Demo design came out
 * with every box after the first 170 px to the left, in one run of five: the Design
 * inspector had just docked, #view's margin was still sliding 340 px narrower
 * (lib/edge-dock.css), and the centred canvas moved 170 px between the walker's read of
 * the root and its reads of the boxes inside the root.
 *
 * This page has the same shape: a 400 x 200 root centred in a wide shell, holding two
 * text boxes and a filled box. The shell takes a 340 px inline-end reserve partway
 * through the walk, at the walker's first await (the first text shaping for PDF and
 * SVG, the first picture fetch for PowerPoint), so the root moves 170 px left at a
 * known point. Each file must be the same as the one the walker writes when nothing
 * moves. Before the fix the boxes read after the move were written 170 px to the left.
 *
 * The same root is also exported scaled and rotated. A walker takes a transformed root's
 * own transform off while it walks the subtree, and the origin must stay on the corner
 * the page shows: the first version of the fix followed the untransformed box, and a
 * centred `scale(0.5)` came out drawn from the middle of the page (review of #789). A
 * blue marker in the root's corner is found in each file and must sit where the page
 * shows the marker, measured from the root's own box, still and moving alike.
 *
 * Real Chromium and real HarfBuzz shaping, self-skipping by name where Playwright's
 * Chromium is not installed (`pnpm exec playwright install chromium`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));
const PPTX_MODULE = fileURLToPath(new URL('./export-pptx.ts', import.meta.url));
const TEXT_API = fileURLToPath(new URL('./text.ts', import.meta.url));
const OUTFIT_TTF = join(REPO_ROOT, 'shells/web/public/fonts/Outfit[wght].ttf');
const HB_WASM = join(REPO_ROOT, 'node_modules/harfbuzzjs/dist/harfbuzz.wasm');

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  if (!existsSync(OUTFIT_TTF)) return `missing ${OUTFIT_TTF}`;
  if (!existsSync(HB_WASM)) return 'harfbuzzjs wasm not installed';
  let chromium: any;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (pnpm exec playwright install chromium)';
  } catch { return 'no Chromium (pnpm exec playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const SKIP = typeof browser === 'string' ? browser : false;

async function bundle(): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      // createExportAPI assigns export.ts's `_host`; its text API is what outlines a run.
      contents: `import { renderPdf, renderSvgFromHtml, createExportAPI } from ${JSON.stringify(EXPORT_MODULE)};
                 import { renderPptx } from ${JSON.stringify(PPTX_MODULE)};
                 import { createTextAPI } from ${JSON.stringify(TEXT_API)};
                 const text = createTextAPI();
                 const toPath = text.toPath.bind(text);
                 const nativeFetch = window.fetch.bind(window);
                 // Armed for one export: the first shaping or picture fetch moves the root.
                 let armed = false;
                 const move = () => { if (!armed) return; armed = false; document.getElementById('shell').style.paddingInlineEnd = '340px'; };
                 text.toPath = (o) => { move(); return toPath(o); };
                 window.fetch = (...a) => { if (String(a[0]).includes('/mark.svg')) move(); return nativeFetch(...a); };
                 createExportAPI({ text, log: () => {} });
                 const bytes = async (blob) => { const b = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (const c of b) s += String.fromCharCode(c); return btoa(s); };
                 // Where the blue marker is in an SVG file drawn at 400 x 200, in px.
                 const svgMarker = async (blob) => {
                   const img = new Image(); img.src = URL.createObjectURL(blob); await img.decode();
                   const c = document.createElement('canvas'); c.width = 400; c.height = 200;
                   const g = c.getContext('2d'); g.drawImage(img, 0, 0, 400, 200);
                   const d = g.getImageData(0, 0, 400, 200).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
                   for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 128 && d[i] < 60 && Math.abs(d[i + 1] - 160) < 40 && d[i + 2] > 200) {
                     const x = (i / 4) % 400, y = Math.floor(i / 4 / 400);
                     x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
                   }
                   return x1 < 0 ? null : { x0, y0, x1, y1 };
                 };
                 window.__render = async (format, moving, transform = '') => {
                   const shell = document.getElementById('shell');
                   const root = document.getElementById('root');
                   shell.style.paddingInlineEnd = '0px';
                   root.style.transform = transform;
                   // The marker's box from the root's box, both as the page shows them.
                   const r = root.getBoundingClientRect(), m = document.getElementById('marker').getBoundingClientRect();
                   const shown = { x0: m.left - r.left, y0: m.top - r.top, x1: m.right - r.left, y1: m.bottom - r.top, w: r.width };
                   const before = root.getBoundingClientRect().left;
                   armed = moving;
                   const opts = { width: 400, height: 200, convertPaths: true };
                   const blob = format === 'pdf' ? await renderPdf(root, opts)
                     : format === 'svg' ? await renderSvgFromHtml(root, opts)
                     : await renderPptx(root, opts);
                   armed = false;
                   const after = root.getBoundingClientRect().left;
                   const marker = format === 'svg' ? await svgMarker(blob) : null;
                   root.style.transform = '';
                   return { file: await bytes(blob), movedBy: before - after, shown, marker };
                 };`,
      resolveDir: HERE,
      loader: 'ts',
    },
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'esnext', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain; drop the sheets.
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
  return out.outputFiles[0]!.text;
}

const FONT = `@font-face{font-family:Outfit;src:url('/fonts/Outfit[wght].ttf') format('truetype');font-weight:100 900}`;
const MARK = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#e3007a"/></svg>';
// The scene from the report: small text, a big word and a filled bar, in a frame that is
// the export root. The picture is first so that a PowerPoint walk fetches the picture
// before reaching the boxes under the picture.
const MARKUP = `<div id="shell" style="display:flex;justify-content:center;box-sizing:border-box;width:1200px;padding-top:40px">
  <div id="root" style="position:relative;flex:none;width:400px;height:200px;background:#fff">
    <div id="marker" style="position:absolute;left:0;top:0;width:40px;height:20px;background:#00a0ff"></div>
    <img src="/mark.svg" alt="" style="position:absolute;left:372px;top:8px;width:20px;height:20px">
    <div style="position:absolute;left:20px;top:16px;width:340px;height:40px;font:400 12px/1.2 Outfit;color:#000">Small black text at nine points</div>
    <div style="position:absolute;left:20px;top:56px;width:360px;height:70px;font:800 48px/1.1 Outfit;color:#000">Void 48</div>
    <div style="position:absolute;left:20px;top:140px;width:360px;height:44px;background:#000"></div>
  </div>
</div>`;

interface Box { x0: number; y0: number; x1: number; y1: number }
interface Rendered { file: Buffer; movedBy: number; shown: Box & { w: number }; marker: Box | null }
type Pair = { still: Rendered; moving: Rendered };
const TRANSFORMS = ['scale(0.5)', 'rotate(30deg)'] as const;

async function renderAll(): Promise<{ plain: Record<'pdf' | 'svg' | 'pptx', Pair>; transformed: Record<string, Pair> }> {
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  try {
    const page = await b.newPage({ viewport: { width: 1200, height: 400 } });
    await page.route('**/*', async (route: any) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (p === '/fonts/Outfit[wght].ttf') return route.fulfill({ contentType: 'font/ttf', body: readFileSync(OUTFIT_TTF) });
      if (p.endsWith('.wasm')) return route.fulfill({ contentType: 'application/wasm', body: readFileSync(HB_WASM) });
      if (p === '/mark.svg') return route.fulfill({ contentType: 'image/svg+xml', body: MARK });
      if (p === '/') return route.fulfill({ contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><style>${FONT}</style><body style="margin:0">${MARKUP}</body>` });
      return route.fulfill({ status: 404, body: '' });
    });
    await page.goto('http://localhost/');
    await page.evaluate(() => document.fonts.ready);
    await page.addScriptTag({ type: 'module', content: `${await bundle()}\nwindow.__ready = true;` });
    await page.waitForFunction(() => (window as any).__ready === true);
    const run = async (format: string, moving: boolean, transform = ''): Promise<Rendered> => {
      const out = await page.evaluate(({ format, moving, transform }: { format: string; moving: boolean; transform: string }) => (window as any).__render(format, moving, transform), { format, moving, transform });
      return { ...out, file: Buffer.from(out.file, 'base64') };
    };
    const plain = {} as Record<'pdf' | 'svg' | 'pptx', Pair>;
    for (const format of ['pdf', 'svg', 'pptx'] as const) {
      // A still run first, so fonts, the shaper and the picture are warm for both.
      await run(format, false);
      plain[format] = { still: await run(format, false), moving: await run(format, true) };
    }
    // PowerPoint takes no transform off a root (a rotated one becomes a picture), so the
    // transformed cases are the two walkers that do.
    const transformed: Record<string, Pair> = {};
    for (const transform of TRANSFORMS) for (const format of ['pdf', 'svg'] as const) {
      transformed[`${format} ${transform}`] = { still: await run(format, false, transform), moving: await run(format, true, transform) };
    }
    return { plain, transformed };
  } finally { await b.close(); }
}

/** Every page content stream of a PDF, decoded, which is where the geometry is. */
async function pdfContent(bytes: Buffer): Promise<string> {
  const lib = await import('pdf-lib') as any;
  const pdf = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  return pdf.getPages().map((page: any) => {
    const found = pdf.context.lookup(page.node.get(lib.PDFName.of('Contents')));
    const streams = found?.asArray ? found.asArray().map((r: unknown) => pdf.context.lookup(r)) : [found];
    return streams.map((s: any) => new TextDecoder('latin1').decode(inflateSync(Buffer.from(s.contents)))).join('\n');
  }).join('\n');
}

/**
 * The box of every point filled in the marker's blue on a PDF's first page, in page points
 * from the top left. The writer opens the page with a top-left, y-down basis
 * (`1 0 0 -1 0 H cm`); every later `cm` (a rotation, an SVG's viewBox) is applied, and a
 * rectangle contributes all four corners so a rotated one gives its true bounds.
 */
function pdfMarker(content: string): Box | null {
  type M = [number, number, number, number, number, number];
  const mul = (m: M, n: M): M => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  const stack: { rgb: number[]; m: M }[] = [];
  let rgb = [0, 0, 0];
  let m: M = [1, 0, 0, 1, 0, 0];
  let first = true;
  let nums: number[] = [];
  let points: number[] = [];
  const box: Box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
  const at = (x: number, y: number): void => { points.push(m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]); };
  const blue = (c: number[]): boolean => c.length === 3 && c[0]! < 0.05 && Math.abs(c[1]! - 0.63) < 0.03 && c[2]! > 0.95;
  for (const token of content.split(/\s+/)) {
    if (!token) continue;
    if (/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(token)) { nums.push(Number(token)); continue; }
    switch (token) {
      case 'rg': rgb = nums.slice(-3); break;
      case 'g': rgb = [nums.at(-1)!, nums.at(-1)!, nums.at(-1)!]; break;
      case 'q': stack.push({ rgb, m }); break;
      case 'Q': ({ rgb, m } = stack.pop() ?? { rgb, m }); break;
      case 'cm': if (first) first = false; else m = mul(m, nums.slice(-6) as M); break;
      case 'm': case 'l': case 'c': case 'v': case 'y':
        for (let i = 0; i + 1 < nums.length; i += 2) at(nums[i]!, nums[i + 1]!);
        break;
      case 're': {
        const [x, y, w, h] = nums.slice(-4) as [number, number, number, number];
        at(x, y); at(x + w, y); at(x, y + h); at(x + w, y + h);
        break;
      }
      case 'f': case 'f*': case 'F': case 'B': case 'B*': case 'b': case 'b*':
        if (blue(rgb)) for (let i = 0; i + 1 < points.length; i += 2) {
          box.x0 = Math.min(box.x0, points[i]!); box.x1 = Math.max(box.x1, points[i]!);
          box.y0 = Math.min(box.y0, points[i + 1]!); box.y1 = Math.max(box.y1, points[i + 1]!);
        }
        points = [];
        break;
      case 'n': case 'S': case 's': case 'W': case 'W*': points = []; break;
      default: break;
    }
    nums = [];
  }
  return Number.isFinite(box.x0) ? box : null;
}

/** Where the page shows the marker, scaled to a file `wide` units across the root's width. */
function expectedMarker(r: Rendered, wide: number): Box {
  const k = wide / r.shown.w;
  return { x0: r.shown.x0 * k, y0: r.shown.y0 * k, x1: r.shown.x1 * k, y1: r.shown.y1 * k };
}

function assertNear(found: Box | null, want: Box, tolerance: number, what: string): void {
  assert.ok(found, `${what}: no marker found`);
  for (const k of ['x0', 'y0', 'x1', 'y1'] as const) {
    assert.ok(Math.abs(found[k] - want[k]) <= tolerance, `${what}: marker ${k} is ${found[k].toFixed(2)}, the page shows ${want[k].toFixed(2)} (found ${JSON.stringify(found)})`);
  }
}

/** The slide XML of a PowerPoint file, which is where the shapes and their offsets are. */
function pptxSlides(bytes: Buffer): string {
  const files = unzipSync(new Uint8Array(bytes));
  return Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort()
    .map((name) => strFromU8(files[name]!)).join('\n');
}

const rendered = SKIP ? null : await renderAll();

for (const format of ['pdf', 'svg', 'pptx'] as const) {
  test(`the ${format.toUpperCase()} export draws every box in its place when the page moves the root during the walk`, { skip: SKIP, timeout: 180_000 }, async () => {
    const { still, moving } = rendered!.plain[format];
    // Premise: the root stood still for one run and moved 170 px left in the other.
    assert.equal(still.movedBy, 0, 'the still run must not move the root');
    assert.equal(moving.movedBy, 170, 'the moving run must move the root 170 px left during the walk');
    if (format === 'pdf') assert.equal(await pdfContent(moving.file), await pdfContent(still.file));
    else if (format === 'svg') assert.equal(moving.file.toString('utf8'), still.file.toString('utf8'));
    else assert.equal(pptxSlides(moving.file), pptxSlides(still.file));
  });
}

for (const transform of TRANSFORMS) for (const format of ['pdf', 'svg'] as const) {
  test(`the ${format.toUpperCase()} export draws a root with ${transform} where the page shows it, still and moving`, { skip: SKIP, timeout: 180_000 }, async () => {
    const { still, moving } = rendered!.transformed[`${format} ${transform}`]!;
    assert.equal(moving.movedBy, 170, 'the moving run must move the root 170 px left during the walk');
    // 400 px is the file's width in px for SVG, 300 pt for PDF; the marker is found to within a pixel.
    for (const [run, label] of [[still, 'still'], [moving, 'moving']] as const) {
      const found = format === 'svg' ? run.marker : pdfMarker(await pdfContent(run.file));
      assertNear(found, expectedMarker(run, format === 'svg' ? 400 : 300), format === 'svg' ? 1.5 : 1.2, `${format} ${transform} ${label}`);
    }
  });
}
