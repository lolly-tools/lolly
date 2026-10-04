// SPDX-License-Identifier: MPL-2.0
/**
 * A translucent gradient on a wide box keeps its full height in a PDF (plan 291 M4).
 *
 * A gradient with see-through stops cannot be a PDF shading, so the walker draws it to
 * a PNG and places that over the box. The PNG's size is capped per axis
 * (MAX_RASTER_PX), so on a box wider than the cap allows the PNG is no longer the
 * box's shape. The SVG it is drawn from must then stretch to the PNG: with the default
 * `preserveAspectRatio` it was letterboxed instead, and once the PNG was stretched back
 * over the box the gradient sat in a band across the middle with see-through strips
 * above and below. A full-slide photo scrim (`lin_0_…`) showed as a hard-edged band
 * over the lower third of the slide.
 *
 * The page is rendered by Chromium, exported with the real walker, and the PDF is
 * rasterised by poppler (`pdftoppm`); the test reads one column of pixels.
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

// Wide enough that the raster cap bites on the width only (the walker rasterises at 200 dpi).
const W = 1600, H = 400;

test('a translucent gradient on a box wider than the raster cap fills the whole box in a PDF', { skip: SKIP, timeout: 120_000 }, async () => {
  const { chromium } = browser as { chromium: any };
  const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-gradient-'));
  const b = await chromium.launch({ args: ['--force-color-profile=srgb'] });
  let pdf: Buffer;
  try {
    const page = await b.newPage({ viewport: { width: W, height: H } });
    await page.setContent(`<!doctype html><body style="margin:0"><div id="root" style="width:${W}px;height:${H}px;background:#fff"><div style="width:${W}px;height:${H}px;background:linear-gradient(0deg, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 30%, rgba(0,0,0,0) 62%)"></div></div></body>`);
    await page.addScriptTag({ content: await bundle() });
    const b64 = await page.evaluate(async () => {
      const blob = await (window as any).__pdf(document.getElementById('root'), {});
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (const byte of buf) s += String.fromCharCode(byte);
      return btoa(s);
    });
    pdf = Buffer.from(b64, 'base64');
  } finally { await b.close(); }
  const pdfPath = join(dir, 'g.pdf');
  await writeFile(pdfPath, pdf);
  // Greyscale PGM, one byte a pixel, so one column reads without a PNG decoder.
  await run('pdftoppm', ['-gray', '-scale-to-x', String(W / 4), '-scale-to-y', String(H / 4), '-singlefile', pdfPath, join(dir, 'g')]);
  const pgm = await readFile(join(dir, 'g.pgm'));
  const header = /^P5\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(pgm.subarray(0, 64).toString('latin1'))!;
  const w = Number(header[1]), h = Number(header[2]);
  const px = pgm.subarray(header[0].length);
  const at = (fy: number): number => px[Math.min(h - 1, Math.round(fy * h)) * w + Math.round(w / 2)]!;
  // CSS: 0deg runs bottom to top, so the bottom edge is the 0.9 stop and the top is clear.
  assert.ok(at(0.98) < 60, `the bottom edge is dark (0.9 black over white), read ${at(0.98)}`);
  assert.ok(Math.abs(at(0.7) - 255 * (1 - 0.6)) < 40, `30% up the box reads the 0.6 stop, read ${at(0.7)}`);
  assert.ok(at(0.2) > 235, `the top of the box is clear, read ${at(0.2)}`);
  assert.ok(at(0.98) < at(0.85) && at(0.85) < at(0.6), 'the gradient brightens steadily from the bottom');
});
