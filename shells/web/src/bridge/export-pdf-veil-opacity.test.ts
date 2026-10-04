// SPDX-License-Identifier: MPL-2.0
/**
 * A translucent box over a photo stays translucent in a PDF (plan 291 M4).
 *
 * The PDF walker has no group-opacity primitive, so it applies an element's partial
 * opacity as an alpha on that element's own draws, and only for a leaf, since a
 * per-draw alpha mis-composites overlapping descendants. A Design box is a div with an
 * empty text child, so a veil (a navy box at 55% over a full-slide photo) was not a leaf
 * and was painted opaque: the slide came out flat navy, and the photo did not show.
 * A box whose children paint nothing now counts as a leaf.
 *
 * The page is rendered by Chromium, exported with the real walker, and the PDF is
 * rasterised by poppler (`pdftoppm`); the test reads pixels from the middle of the box.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));

async function have(bin: string): Promise<boolean> {
  try { await run('which', [bin]); return true; } catch { return false; }
}

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
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

async function bundle(): Promise<string> {
  const { build } = await import('esbuild');
  const out = await build({
    stdin: { contents: `import { renderPdf } from ${JSON.stringify(EXPORT_MODULE)}; window.__pdf = renderPdf;`, resolveDir: HERE, loader: 'ts' },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    loader: { '.css': 'empty' },
  });
  return out.outputFiles[0]!.text;
}

const W = 800, H = 448;

test('a translucent Design box over a picture keeps its opacity in a PDF', { skip: SKIP, timeout: 120_000 }, async () => {
  const { chromium } = browser as { chromium: any };
  const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-veil-'));
  const b = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  let pdf: Buffer;
  try {
    const page = await b.newPage({ viewport: { width: W, height: H } });
    // A white picture under the veil: the box's own markup is the Design renderer's,
    // a div with an empty .lolly-box-text child.
    await page.setContent(`<!doctype html><body style="margin:0"><div id="root" style="position:relative;width:${W}px;height:${H}px;background:#000">
      <img id="photo" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px" alt="">
      <div class="lolly-box" style="position:absolute;left:0;top:0;width:${W}px;height:${H}px;background:#13294b;opacity:0.55;display:flex"><div class="lolly-box-text" style="color:#fff"></div></div>
    </div></body>`);
    await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 32; c.height = 18;
      const ctx = c.getContext('2d')!;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, 32, 18);
      const img = document.getElementById('photo') as HTMLImageElement;
      img.src = c.toDataURL('image/png');
      await img.decode();
    });
    await page.addScriptTag({ content: await bundle() });
    const b64 = await page.evaluate(async () => {
      const blob = await (window as any).__pdf(document.getElementById('root'), {});
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (const byte of buf) s += String.fromCharCode(byte);
      return btoa(s);
    });
    pdf = Buffer.from(b64, 'base64');
  } finally { await b.close(); }
  const pdfPath = join(dir, 'v.pdf');
  await writeFile(pdfPath, pdf);
  await run('pdftoppm', ['-gray', '-scale-to-x', String(W / 4), '-scale-to-y', String(H / 4), '-singlefile', pdfPath, join(dir, 'v')]);
  const pgm = await readFile(join(dir, 'v.pgm'));
  const header = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(pgm.subarray(0, 64).toString('latin1'))!;
  const w = Number(header[1]), h = Number(header[2]);
  const px = pgm.subarray(header[0].length);
  const mid = px[Math.round(h / 2) * w + Math.round(w / 2)]!;
  // Navy at 55% over white reads about 0.45 * 255 + 0.55 * 38, near 136; opaque navy reads near 38.
  assert.ok(mid > 100 && mid < 175, `the photo shows through the 55% veil, read ${mid}`);
});
