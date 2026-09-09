// SPDX-License-Identifier: MPL-2.0
/**
 * Shadow fidelity for the PDF walker: does the exported PDF actually LOOK like the
 * browser? The SVG-side twin of this is export-shadow-fidelity.test.ts.
 *
 * ## The renderer matters
 *
 * The PDF is rasterised by **Quartz** - the renderer Preview and every macOS app use
 * - via a ~30-line CoreGraphics program (`scripts/lib/pdfrender.swift`), compiled on
 * demand and cached. poppler is the fallback when Swift is unavailable, but it is a
 * strictly worse oracle here and the thresholds below are Quartz's: on the same
 * bytes, poppler reports 0.39% mean on plain text where Quartz reports 0.11%, and
 * 12.5% worst-pixel on a shadow where Quartz reports 7.8%. That gap is poppler's own
 * error, and it is largest in exactly the areas shadow work touches - transparency
 * groups, soft masks, blend modes. Measuring against it would have meant chasing
 * error that was never in our output.
 *
 * ## Read every row against a control
 *
 * `CONTROL: no-shadow box` (0.03% / 9.7%) is the geometry floor and
 * `CONTROL: plain text` (0.11% / 45.5%) the text floor - glyph rasterisation differs
 * between Chromium and Quartz, and no shadow row can beat that.
 *
 * ## What this caught
 *
 *   - `drop-shadow()`: the raster escape hatch captured the element at exactly its
 *     rect, shearing off a shadow that by definition paints outside it (2.9% → 0.17%)
 *   - inset shadows: not drawn at all (1.03% → 0.13%)
 *   - `text-shadow`: not drawn at all (blurred 0.62% → 0.16%, hard 0.50% → 0.10%)
 *
 * PDF has no blur operator, but box shadows no longer bake: the blur of an edge IS
 * the Gaussian CDF, so they are drawn as concentric bands at computed alphas - pure
 * vector, 4.9x smaller, and still editable. Only blurred TEXT shadows bake, because
 * offsetting a glyph outline needs a path-offsetting algorithm we do not have.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));
const SWIFT_SRC = fileURLToPath(new URL('../../../../scripts/lib/pdfrender.swift', import.meta.url));

async function have(bin: string): Promise<boolean> {
  try { await run('which', [bin]); return true; } catch { return false; }
}

/** Quartz if Swift can build it, else poppler, else null. */
async function pickRenderer(cacheDir: string): Promise<{ kind: 'quartz' | 'poppler'; bin: string } | null> {
  if (await have('swiftc')) {
    const bin = join(cacheDir, 'pdfrender');
    try {
      await run('swiftc', ['-O', '-o', bin, SWIFT_SRC], { timeout: 120_000 });
      if (existsSync(bin)) return { kind: 'quartz', bin };
    } catch { /* fall through */ }
  }
  if (await have('pdftoppm')) return { kind: 'poppler', bin: 'pdftoppm' };
  return null;
}

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
  let chromium: any;
  try { ({ chromium } = await import('playwright')); }
  catch { return 'playwright not installed'; }
  try {
    const p = chromium.executablePath();
    if (!p || !existsSync(p)) return 'no Chromium (npx playwright install chromium)';
  } catch { return 'no Chromium (npx playwright install chromium)'; }
  return { chromium };
}

const browser = await chromiumOrSkip();
const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-shadow-'));
const renderer = typeof browser === 'string' ? null : await pickRenderer(dir);
const SKIP = typeof browser === 'string' ? browser
  : !renderer ? 'no PDF rasteriser binary (needs swiftc or pdftoppm)'
  : false;
// poppler's own error swamps several rows, so it can check that nothing CRASHED but
// not that the output is right. Thresholds below are Quartz's.
const LOOSE = renderer?.kind === 'poppler' ? 4 : 1;

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderPdf } from ${JSON.stringify(EXPORT_MODULE)};
                 window.__pdf = renderPdf;`,
      resolveDir: HERE, loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { ".css": "empty" },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

const W = 300, H = 160;

async function pixelDiff(inner: string): Promise<[number, number]> {
  const { chromium } = browser as { chromium: any };
  // srgb pin: screenshot-vs-canvas pixel comparison, as in export-shadow-fidelity.
  const b = await chromium.launch({ args: ['--force-color-profile=srgb', '--font-render-hinting=none'] });
  try {
    const page = await b.newPage({ viewport: { width: W, height: H } });
    await page.setContent(`<!doctype html><body style="margin:0"><div id="root" style="width:${W}px;height:${H}px;background:#fff;font:600 22px/1.4 sans-serif;display:flex;align-items:center;justify-content:center">${inner}</div></body>`);
    const ref = (await page.locator('#root').screenshot()).toString('base64');
    await page.addScriptTag({ content: await bundle() });
    const pdfB64 = await page.evaluate(async () => {
      const blob = await (window as any).__pdf(document.getElementById('root'), {});
      const buf = new Uint8Array(await blob.arrayBuffer());
      let s = ''; for (const byte of buf) s += String.fromCharCode(byte);
      return btoa(s);
    });
    const pdfPath = join(dir, 'a.pdf');
    await writeFile(pdfPath, Buffer.from(pdfB64, 'base64'));

    let png: Buffer;
    if (renderer!.kind === 'quartz') {
      await run(renderer!.bin, [pdfPath, join(dir, 'q.png'), String(W), String(H)]);
      png = await readFile(join(dir, 'q.png'));
    } else {
      await run('pdftoppm', ['-png', '-r', '96', '-scale-to-x', String(W), '-scale-to-y', String(H), pdfPath, join(dir, 'out')]);
      png = await readFile(join(dir, 'out-1.png'));
    }

    return await page.evaluate(async ({ ourB64, refB64, w, h }: any) => {
      const load = (src: string) => new Promise<HTMLImageElement>((ok, no) => {
        const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = src;
      });
      const a = await load('data:image/png;base64,' + ourB64);
      const r = await load('data:image/png;base64,' + refB64);
      // White page under both: the PDF render has no alpha, so compositing the
      // reference the same way keeps the comparison to colour rather than coverage.
      const mk = () => { const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d')!; x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); return x; };
      const x1 = mk(), x2 = mk();
      x1.drawImage(a, 0, 0, w, h); x2.drawImage(r, 0, 0, w, h);
      const d1 = x1.getImageData(0, 0, w, h).data, d2 = x2.getImageData(0, 0, w, h).data;
      let sum = 0, worst = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const e = (Math.abs(d1[i]! - d2[i]!) + Math.abs(d1[i + 1]! - d2[i + 1]!) + Math.abs(d1[i + 2]! - d2[i + 2]!)) / 3;
        sum += e; if (e > worst) worst = e;
      }
      return [sum / (d1.length / 4) / 255, worst / 255];
    }, { ourB64: png.toString('base64'), refB64: ref, w: W, h: H });
  } finally { await b.close(); }
}

interface Row { name: string; markup: string; maxMean: number; maxWorst: number }
const box = (css: string) => `<div style="width:140px;height:70px;border-radius:10px;${css}"></div>`;

const ROWS: Row[] = [
  // ── controls: the floors every other row is read against ────────────────────
  { name: 'CONTROL: no-shadow box', markup: box('background:#4a90d9'),
    maxMean: 0.002, maxWorst: 0.15 },                       // Quartz 0.03% / 9.7%
  { name: 'CONTROL: plain text', markup: `<span style="color:#222">Plain</span>`,
    maxMean: 0.004, maxWorst: 0.55 },                       // Quartz 0.11% / 45.5%

  // ── outer box-shadow: vector Gaussian bands ─────────────────────────────────
  // These read HIGHER than the bitmap bake they replaced (0.02% → 0.11%) and that is
  // the accepted trade: a tenth of a percent of mean error - invisible - for output
  // that is 4.9x smaller and still editable vector. See section 13 in the plan.
  { name: 'soft outer shadow', markup: box('background:#fff;box-shadow:0 6px 16px rgba(0,0,0,0.35)'),
    maxMean: 0.004, maxWorst: 0.14 },                       // Quartz 0.11% / 7.1%
  { name: 'hard outer shadow', markup: box('background:#fff;box-shadow:0 4px 0 rgba(0,0,0,0.5)'),
    maxMean: 0.003, maxWorst: 0.16 },                       // Quartz 0.01% / 11.0%  (pure vector, no bands)
  { name: 'shadow with spread', markup: box('background:#fff;box-shadow:0 0 10px 6px rgba(0,0,0,0.4)'),
    maxMean: 0.005, maxWorst: 0.14 },                       // Quartz 0.17% / 7.5%
  { name: 'outer shadow under a translucent background', markup: box('background:rgba(255,255,255,0.35);box-shadow:0 6px 16px rgba(0,0,0,0.55)'),
    maxMean: 0.005, maxWorst: 0.18 },                       // Quartz 0.15% / 12.5%

  // ── the three gaps this round closed ────────────────────────────────────────
  // Was not drawn at all: parseBoxShadow dropped inset entries.
  { name: 'inset shadow', markup: box('background:#eee;box-shadow:inset 0 4px 12px rgba(0,0,0,0.5)'),
    maxMean: 0.005, maxWorst: 0.15 },                       // 1.03% → 0.13% / 9.0% (vector rings)
  // The raster hatch captured the element at exactly its rect, shearing off a shadow
  // that by definition paints outside it.
  { name: 'drop-shadow', markup: box('background:#4a90d9;filter:drop-shadow(0 6px 12px rgba(0,0,0,0.5))'),
    maxMean: 0.005, maxWorst: 0.15 },                       // 2.94% → 0.17% / 9.3%
  { name: 'text-shadow, blurred', markup: `<span style="color:#222;text-shadow:0 2px 4px rgba(0,0,0,0.6)">Shadowed</span>`,
    maxMean: 0.006, maxWorst: 0.55 },                       // 0.62% → 0.16% / 36.1%
  { name: 'text-shadow, hard offset', markup: `<span style="color:#fff;text-shadow:2px 2px 0 #d33">Shadowed</span>`,
    maxMean: 0.005, maxWorst: 0.55 },                       // 0.50% → 0.10% / 37.0%

  // ── plan 104 P1d: filter: blur() / drop-shadow() reaching PDF at all ─────────
  // These are the pixel half of the P1d proof; export-pdf-filter.test.ts is the
  // structural half (it counts the embedded image objects). Both are needed: an image
  // object of the correct size can still be the wrong picture, and a good pixel score
  // says nothing about which of the two defects below produced it.
  //
  // The blur was not merely inaccurate, it was ABSENT - detectUnsupportedCss declared
  // any parseable filter supported for every caller, so the PDF walker, which has no
  // filter branch, dropped it in silence. Guards the vectorCaps.cssFilter split: with
  // the cap wrongly declared here the box draws sharp and this row reads 1.62%.
  { name: 'layer blur', markup: box('background:#4a90d9;filter:blur(6px)'),
    maxMean: 0.005, maxWorst: 0.08 },                       // absent → 0.14% / 2.4%
  // The mixed chain, which is what design emits for a blurred box carrying a
  // depth shadow. This one ALWAYS rasterised (parseCssFilter cannot tokenise the nested
  // rgba(), so it fell to the hatch by accident) - what it guards is the SPILL: measured
  // whole-value it came out at zero padding, the capture was sized to the bare box, and
  // the shadow sheared off at the edge for 3.12%. Per-function measurement is the fix.
  { name: 'layer blur + drop-shadow', markup: box('background:#4a90d9;filter:blur(4px) drop-shadow(0 8px 16px rgba(0,0,0,0.5))'),
    maxMean: 0.005, maxWorst: 0.08 },                       // 3.12% → 0.11% / 1.6%
  // Two owners, one ring of pixels. The box-shadow is drawn as vector bands BEFORE the
  // hatch fires, and the hatch's pad - which exists to hold the filter's spill - reaches
  // into exactly the ring those bands occupy, so the shadow was painted twice and came
  // out twice as dark. Neutralising box-shadow for the capture gives each pixel one
  // owner: 0.93% doubled, 0.45% with the blur simply dropped (what shipped before P1d),
  // 0.27% now - so the combination ends up MORE faithful than it was, not less.
  { name: 'layer blur over a box-shadow', markup: box('background:#fff;box-shadow:0 6px 16px rgba(0,0,0,0.35);filter:blur(3px)'),
    maxMean: 0.005, maxWorst: 0.14 },                       // 0.93% doubled → 0.27% / 7.1%
];

for (const row of ROWS) {
  test(`pdf shadow fidelity: ${row.name}`, { skip: SKIP }, async () => {
    const [mean, worst] = await pixelDiff(row.markup);
    assert.ok(mean <= row.maxMean * LOOSE,
      `mean error ${(mean * 100).toFixed(2)}% exceeds ${(row.maxMean * LOOSE * 100).toFixed(2)}% (${renderer?.kind})`);
    assert.ok(worst <= row.maxWorst * LOOSE,
      `worst-pixel error ${(worst * 100).toFixed(1)}% exceeds ${(row.maxWorst * LOOSE * 100).toFixed(1)}% (${renderer?.kind})`);
  });
}
