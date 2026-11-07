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
                 window.__render = async (format, moving) => {
                   const shell = document.getElementById('shell');
                   const root = document.getElementById('root');
                   shell.style.paddingInlineEnd = '0px';
                   const before = root.getBoundingClientRect().left;
                   armed = moving;
                   const opts = { width: 400, height: 200, convertPaths: true };
                   const blob = format === 'pdf' ? await renderPdf(root, opts)
                     : format === 'svg' ? await renderSvgFromHtml(root, opts)
                     : await renderPptx(root, opts);
                   armed = false;
                   const after = root.getBoundingClientRect().left;
                   return { file: await bytes(blob), movedBy: before - after };
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
    <img src="/mark.svg" alt="" style="position:absolute;left:372px;top:8px;width:20px;height:20px">
    <div style="position:absolute;left:20px;top:16px;width:340px;height:40px;font:400 12px/1.2 Outfit;color:#000">Small black text at nine points</div>
    <div style="position:absolute;left:20px;top:56px;width:360px;height:70px;font:800 48px/1.1 Outfit;color:#000">Void 48</div>
    <div style="position:absolute;left:20px;top:140px;width:360px;height:44px;background:#000"></div>
  </div>
</div>`;

interface Rendered { file: Buffer; movedBy: number }

async function renderAll(): Promise<Record<'pdf' | 'svg' | 'pptx', { still: Rendered; moving: Rendered }>> {
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
    const run = async (format: string, moving: boolean): Promise<Rendered> => {
      const out = await page.evaluate(({ format, moving }: { format: string; moving: boolean }) => (window as any).__render(format, moving), { format, moving });
      return { file: Buffer.from(out.file, 'base64'), movedBy: out.movedBy };
    };
    const result = {} as Record<'pdf' | 'svg' | 'pptx', { still: Rendered; moving: Rendered }>;
    for (const format of ['pdf', 'svg', 'pptx'] as const) {
      // A still run first, so fonts, the shaper and the picture are warm for both.
      await run(format, false);
      result[format] = { still: await run(format, false), moving: await run(format, true) };
    }
    return result;
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

/** The slide XML of a PowerPoint file, which is where the shapes and their offsets are. */
function pptxSlides(bytes: Buffer): string {
  const files = unzipSync(new Uint8Array(bytes));
  return Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name)).sort()
    .map((name) => strFromU8(files[name]!)).join('\n');
}

const rendered = SKIP ? null : await renderAll();

for (const format of ['pdf', 'svg', 'pptx'] as const) {
  test(`the ${format.toUpperCase()} export draws every box in its place when the page moves the root during the walk`, { skip: SKIP, timeout: 180_000 }, async () => {
    const { still, moving } = rendered![format];
    // Premise: the root stood still for one run and moved 170 px left in the other.
    assert.equal(still.movedBy, 0, 'the still run must not move the root');
    assert.equal(moving.movedBy, 170, 'the moving run must move the root 170 px left during the walk');
    if (format === 'pdf') assert.equal(await pdfContent(moving.file), await pdfContent(still.file));
    else if (format === 'svg') assert.equal(moving.file.toString('utf8'), still.file.toString('utf8'));
    else assert.equal(pptxSlides(moving.file), pptxSlides(still.file));
  });
}
