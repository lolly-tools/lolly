// SPDX-License-Identifier: MPL-2.0
/**
 * What a PDF does with text beyond the Latin its brand fonts cover, read back with Poppler.
 *
 * A run a font covers outlines, shaped and in the browser's order. A run no font covers
 * goes in as a picture from the browser's own text renderer, and the export says so.
 * Nothing prints as question marks. A left-to-right document whose letters print today
 * keeps its bytes: the goldens at the end were written by main before this work.
 *
 * Real Chromium, pdftoppm and pdftotext, self-skipping when any is missing, as
 * export-pdf-svg.browser.test.ts. Nothing here needs an Arabic font on the machine: with
 * none, the browser draws boxes on the page and in the picture alike.
 *
 * Regenerate the goldens: UPDATE_GOLDENS=1 node --test shells/web/src/bridge/export-pdf-text.browser.test.ts
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
const FONTS: Record<string, string> = {
  '/fonts/Outfit[wght].ttf': OUTFIT_TTF,
  '/fonts/Arabic.ttf': join(REPO, 'tests/fixtures/text-composition/fonts/notosansarabic/NotoSansArabic[wdth,wght].ttf'),
  '/fonts/Hebrew.ttf': join(REPO, 'tests/fixtures/text-composition/fonts/notosanshebrew/NotoSansHebrew[wdth,wght].ttf'),
  '/fonts/Devanagari.ttf': join(REPO, 'tests/fixtures/text-composition/fonts/notosansdevanagari/NotoSansDevanagari[wdth,wght].ttf'),
};
const FONT_CSS = `@font-face{font-family:Outfit;src:url('/fonts/Outfit[wght].ttf') format('truetype');font-weight:100 900}`
  + `@font-face{font-family:Arabic;src:url('/fonts/Arabic.ttf') format('truetype');font-weight:100 900}`
  + `@font-face{font-family:Hebrew;src:url('/fonts/Hebrew.ttf') format('truetype');font-weight:100 900}`
  + `@font-face{font-family:Devanagari;src:url('/fonts/Devanagari.ttf') format('truetype');font-weight:100 900}`;

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
      contents: `import { renderPdf, createExportAPI, _setExportNoticeSink } from ${JSON.stringify(EXPORT_MODULE)};
                 import { createTextAPI } from ${JSON.stringify(join(HERE, 'text.ts'))};
                 window.__notices = [];
                 _setExportNoticeSink((m) => window.__notices.push(m));
                 window.__setup = () => createExportAPI({ text: createTextAPI(), log: () => {} });
                 window.__pdf = renderPdf;`,
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
    shared.__page = await shared.newPage({ viewport: { width: 700, height: 300 } });
    await shared.__page.route('**/*', async (route: any) => {
      const p = decodeURIComponent(new URL(route.request().url()).pathname);
      if (FONTS[p]) return route.fulfill({ contentType: 'font/ttf', body: readFileSync(FONTS[p]!) });
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

interface Exported { bytes: Buffer; text: string; images: number; notices: string[]; agreement: number }

/** Export `inner`, read the PDF back, and measure its ink against the live page's. */
async function exportPdf(inner: string, opts: Record<string, unknown> = {}): Promise<Exported> {
  const pg = await page();
  await pg.setContent(`<!doctype html><meta charset="utf-8"><style>${FONT_CSS}</style><body style="margin:0">`
    + `<div id="root" style="position:relative;width:${W}px;height:${H}px;background:#fff">${inner}</div></body>`);
  await pg.evaluate(async () => { await Promise.all([...(document as any).fonts].map((f: any) => f.load().catch(() => {}))); });
  await pg.addScriptTag({ content: await bundle(), type: 'module' });
  await pg.waitForFunction(() => !!(window as any).__pdf);
  const screen: Buffer = await pg.locator('#root').screenshot();
  const out = await pg.evaluate(async (o: Record<string, unknown>) => {
    const w = window as any;
    w.__notices.length = 0;
    w.__setup();
    const blob = await w.__pdf(document.getElementById('root'), o);
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
    return { b64: btoa(s), notices: [...w.__notices] };
  }, opts);
  const bytes = Buffer.from(out.b64, 'base64');
  const dir = await mkdtemp(join(tmpdir(), 'lolly-pdf-text-'));
  const file = join(dir, 'out.pdf');
  await writeFile(file, bytes);
  const { stdout: text } = await run('pdftotext', ['-layout', file, '-']);
  await run('pdftoppm', ['-png', '-singlefile', '-r', '96', file, join(dir, 'page')]);
  const png = await readFile(join(dir, 'page.png'));
  const { stdout: list } = await run('pdfimages', ['-list', file]).catch(() => ({ stdout: '' }));
  const images = list.split('\n').filter((l) => /^\s*\d+\s+\d+\s+image\b/.test(l)).length;
  const agreement: number = await pg.evaluate(async ([a, b]: string[]) => {
    const mask = async (data: string) => {
      const im = await createImageBitmap(await (await fetch(`data:image/png;base64,${data}`)).blob());
      const c = new OffscreenCanvas(im.width, im.height);
      const g = c.getContext('2d')!;
      g.fillStyle = '#fff'; g.fillRect(0, 0, im.width, im.height);
      g.drawImage(im, 0, 0);
      const d = g.getImageData(0, 0, im.width, im.height).data;
      const m = new Uint8Array(im.width * im.height);
      for (let i = 0; i < m.length; i++) m[i] = (d[i * 4]! + d[i * 4 + 1]! + d[i * 4 + 2]!) < 384 ? 1 : 0;
      return { m, w: im.width, h: im.height };
    };
    const A = await mask(a!), B = await mask(b!);
    const covered = (p: typeof A, q: typeof A) => {
      let ink = 0, hit = 0;
      for (let y = 0; y < p.h; y++) for (let x = 0; x < p.w; x++) {
        if (!p.m[y * p.w + x]) continue;
        ink++;
        search: for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
          const yy = y + dy, xx = x + dx;
          if (yy >= 0 && yy < q.h && xx >= 0 && xx < q.w && q.m[yy * q.w + xx]) { hit++; break search; }
        }
      }
      return ink ? hit / ink : 1;
    };
    return Math.min(covered(A, B), covered(B, A));
  }, [screen.toString('base64'), png.toString('base64')]);
  return { bytes, text, images, notices: out.notices, agreement };
}

const line = (t: string, style = 'font-family:Outfit;font-size:24px;margin:8px', attrs = ''): string => `<p ${attrs} style="${style}">${t}</p>`;
const AGREES = 0.88;

const NO_FONT: Array<[string, string, string, string]> = [
  ['Arabic', 'أفضل الأدوات تختفي، حتى يتحدث العمل.', 'dir="rtl"', 'Arabic'],
  ['Urdu', 'بہترین اوزار غائب ہو جاتے ہیں۔', 'dir="rtl"', 'Arabic'],
  ['Hebrew', 'הכלים הטובים ביותר נעלמים.', 'dir="rtl"', 'Hebrew'],
  ['Hindi', 'सबसे अच्छे उपकरण ग़ायब हो जाते हैं।', '', 'Devanagari'],
  ['Bengali', 'সেরা সরঞ্জাম অদৃশ্য হয়ে যায়।', '', 'B[ae]ng'],
  ['Thai', 'เครื่องมือที่ดีที่สุดจะหายไป', '', 'Thai'],
  ['Chinese', '最好的工具会消失,让工作说话。', '', 'Han'],
  ['Japanese', '最高の道具は姿を消し、仕事が語る。', '', 'Hiragana'],
  ['Korean', '최고의 도구는 사라지고 일이 말합니다.', '', 'Hangul'],
  ['Russian', 'Лучшие инструменты исчезают.', '', 'Cyrillic'],
  ['Greek', 'Τα καλύτερα εργαλεία εξαφανίζονται.', '', 'Greek'],
  ['Vietnamese', 'Những công cụ tốt nhất biến mất.', '', 'Latin'],
];

for (const [label, words, attrs, script] of NO_FONT) {
  test(`${label} no font covers prints as the page does, not as question marks`, { skip: SKIP }, async () => {
    const r = await exportPdf(line(words, undefined, attrs));
    assert.doesNotMatch(r.text, /\?/, 'no question marks in the text layer');
    assert.equal(r.images, 1, 'the line is one picture');
    assert.ok(r.agreement > AGREES, `the PDF's ink agrees with the page's on only ${(r.agreement * 100).toFixed(1)}%`);
    assert.equal(r.notices.length, 1, 'the export tells the person once');
    assert.match(r.notices[0]!, /cannot be selected or searched/);
    // Bengali's name depends on the ICU build: Bengali or Bangla.
    assert.match(r.notices[0]!, new RegExp(script), 'the notice gives the script');
  });
}

test('several lines and scripts make one notice', { skip: SKIP }, async () => {
  const r = await exportPdf(line('مرحبا بالعالم.', undefined, 'dir="rtl"') + line('最好的工具') + line('Plain Latin.'));
  assert.equal(r.notices.length, 1);
  assert.match(r.notices[0]!, /Arabic/);
  assert.match(r.notices[0]!, /Han/);
  assert.doesNotMatch(r.notices[0]!, /Latin/, 'Latin beside another script is not what is missing');
  assert.equal(r.images, 2, 'the Latin line stays vector');
});

test('a run a font covers outlines in the browser\'s order, with no picture and no notice', { skip: SKIP }, async () => {
  const r = await exportPdf(line('أفضل الأدوات تختفي، حتى يتحدث العمل.', 'font-family:Arabic;font-size:24px;margin:8px', 'dir="rtl"'));
  assert.equal(r.images, 0);
  assert.deepEqual(r.notices, []);
  assert.ok(r.agreement > 0.93, `agreement ${r.agreement}`);
});

test('"Convert paths" off still outlines a script live text cannot shape', { skip: SKIP }, async () => {
  for (const [family, words, attrs] of [['Arabic', 'مرحبا بالعالم.', 'dir="rtl"'], ['Hebrew', 'הכלים הטובים.', 'dir="rtl"'], ['Devanagari', 'क्ष्म्य संस्करण', '']] as const) {
    const r = await exportPdf(line(words, `font-family:${family};font-size:24px;margin:8px`, attrs), { convertPaths: false });
    assert.equal(r.images, 0, family);
    assert.ok(r.agreement > 0.93, `${family}: agreement ${r.agreement}`);
  }
});

test('Latin in a right-to-left paragraph keeps the page\'s order', { skip: SKIP }, async () => {
  const r = await exportPdf(line('Sketch of the Engine.', undefined, 'dir="rtl"'));
  assert.ok(r.agreement > 0.93, `agreement ${r.agreement}`);
  const split = await exportPdf(line('Hello <b>World</b> again.', undefined, 'dir="rtl"'));
  assert.ok(split.agreement > 0.93, `agreement ${split.agreement}`);
});

test('a hard text shadow on a pictured run does not print question marks', { skip: SKIP }, async () => {
  const r = await exportPdf(line('مرحبا بالعالم.', 'font-family:Outfit;font-size:24px;margin:8px;text-shadow:2px 2px 0 #888', 'dir="rtl"'));
  assert.doesNotMatch(r.text, /\?/);
  assert.equal(r.images, 1, 'the shadow is in the picture');
});

test('a pseudo-element no font covers is a picture too', { skip: SKIP }, async () => {
  const r = await exportPdf(`<style>.p{position:relative;height:60px;font-family:Outfit;font-size:24px;direction:rtl}.p::before{content:"مرحبا بالعالم.";position:absolute;right:12px;top:12px}</style><div class="p"></div>`);
  assert.doesNotMatch(r.text, /\?/);
  assert.equal(r.images, 1);
  assert.ok(r.agreement > AGREES, `agreement ${r.agreement}`);
});

test('native <text> no font covers is a picture on its own anchor', { skip: SKIP }, async () => {
  const svg = (t: string) => `<div style="position:absolute;inset:0"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;direction:rtl">${t}</svg></div>`;
  const r = await exportPdf(svg(`<text x="580" y="40" font-family="Outfit" font-size="24">مرحبا بالعالم.</text><text x="20" y="90" text-anchor="end" font-family="Outfit" font-size="24">שלום עולם.</text>`));
  assert.doesNotMatch(r.text, /\?/);
  assert.equal(r.images, 2);
  assert.ok(r.agreement > AGREES, `agreement ${r.agreement}`);
  assert.equal(r.notices.length, 1);
});

test('native <text> a font covers outlines with text-anchor read against its direction', { skip: SKIP }, async () => {
  const svg = (t: string) => `<div style="position:absolute;inset:0"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block;direction:rtl">${t}</svg></div>`;
  const r = await exportPdf(svg(`<text x="580" y="40" font-family="Arabic" font-size="24">مرحبا بالعالم.</text><text x="20" y="90" text-anchor="end" font-family="Arabic" font-size="24">مرحبا بالعالم.</text>`));
  assert.equal(r.images, 0);
  assert.ok(r.agreement > 0.93, `agreement ${r.agreement}`);
});

test('a run in a gradient keeps the gradient as a picture', { skip: SKIP }, async () => {
  const r = await exportPdf(line('مرحبا بالعالم.', 'font-family:Outfit;font-size:30px;margin:8px;background:linear-gradient(90deg,#f00,#00f);-webkit-background-clip:text;background-clip:text;color:transparent', 'dir="rtl"'));
  assert.equal(r.images, 1);
  assert.ok(r.agreement > 0.7, `agreement ${r.agreement}`);
});

test('Print PDF draws the same words', { skip: SKIP }, async () => {
  const pg = await page();
  await exportPdf(line('مرحبا بالعالم.', undefined, 'dir="rtl"'));
  const out = await pg.evaluate(async () => {
    const w = window as any;
    w.__notices.length = 0;
    const api = w.__setup();
    const blob = await api.render(document.getElementById('root'), 'pdf-cmyk', {});
    return { size: blob.size, notices: [...w.__notices] };
  });
  assert.ok(out.size > 1000);
  assert.equal(out.notices.length, 1);
});

test('each page of a multi-page PDF draws its own script', { skip: SKIP }, async () => {
  const r = await exportPdf(`<div data-pdf-page style="width:${W}px;height:60px">${line('مرحبا بالعالم.', undefined, 'dir="rtl"')}</div><div data-pdf-page style="width:${W}px;height:60px">${line('最好的工具')}</div>`);
  assert.doesNotMatch(r.text, /\?/);
  assert.equal(r.images, 2);
  assert.equal(r.notices.length, 1, 'one notice for the document');
});

test('with raster fallback off, text no font covers stops the export with a message', { skip: SKIP }, async () => {
  await assert.rejects(exportPdf(line('مرحبا بالعالم.', undefined, 'dir="rtl"'), { rasterFallback: false }), /This PDF cannot draw "مرحبا بالعالم\."/);
});

test('Latin in a stack with no font file stays live text in the base font', { skip: SKIP }, async () => {
  const r = await exportPdf(line('Serif stack, no file.', `font-family:'No Such Family',serif;font-size:24px;margin:8px`));
  assert.match(r.text, /Serif stack, no file\./);
  assert.equal(r.images, 0);
  assert.deepEqual(r.notices, []);
});

test('with "Convert paths" off, Latin in an embeddable face stays selectable live text', { skip: SKIP }, async () => {
  const r = await exportPdf(line('Plain Latin words.', 'font-family:Devanagari;font-size:24px;margin:8px'), { convertPaths: false });
  assert.match(r.text, /Plain Latin words\./);
  assert.equal(r.images, 0);
  assert.deepEqual(r.notices, []);
  assert.ok(r.agreement > 0.93, `agreement ${r.agreement}`);
});

test('an embedded face with no glyph for a character means a picture, not a box', { skip: SKIP }, async () => {
  const r = await exportPdf(line('Plain Ω words.', 'font-family:Devanagari;font-size:24px;margin:8px'), { convertPaths: false });
  assert.equal(r.images, 1);
  assert.equal(r.notices.length, 1);
});

test('quotes and dashes in the base font\'s encoding stay live text', { skip: SKIP }, async () => {
  const r = await exportPdf(line('“Quoted” — €5, café.', `font-family:'No Such Family',serif;font-size:24px;margin:8px`));
  assert.match(r.text, /Quoted/);
  assert.equal(r.images, 0);
  assert.deepEqual(r.notices, []);
});

// ── left-to-right bytes ──────────────────────────────────────────────────────

const GOLDEN = join(HERE, '__fixtures__/export-pdf-text.golden.json');
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

/**
 * Every object of the file, referenced or not, in object order: each stream decoded and
 * each dictionary as text, leaving out the XMP and the info dictionary with their dates.
 */
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

const LTR: Record<string, [string, Record<string, unknown>]> = {
  'card': [line('Plain Latin words, and a comma.'), {}],
  'inline': ['<div style="font-family:Outfit;font-size:22px;width:300px;margin:8px;letter-spacing:.5px;text-decoration:underline">Plain words with a <b>bold</b> run, wrapped over two lines of the box.</div>', {}],
  'paths-off': [line('Plain Latin words, and a comma.'), { convertPaths: false }],
  'latin-ext': [line('Łódź, Ñandú, Šibenik.'), {}],
  // Live text in an embedded face: this face holds Latin and sits at its default weight,
  // so with "Convert paths" off the words stay selectable.
  'embedded-live': [line('Plain Latin words.', 'font-family:Devanagari;font-size:24px;margin:8px'), { convertPaths: false }],
  'shadow': [line('Shadowed', 'font-family:Outfit;font-size:24px;margin:8px;text-shadow:2px 2px 0 #888'), {}],
  'gradient': [line('Gradient', 'font-family:Outfit;font-size:30px;margin:8px;background:linear-gradient(90deg,#f00,#00f);-webkit-background-clip:text;background-clip:text;color:transparent'), {}],
  'pseudo': ['<style>.p{position:relative;height:60px;font-family:Outfit;font-size:24px}.p::before{content:"Marker";position:absolute;left:12px;top:12px}</style><div class="p"></div>', {}],
  'native-text': [`<div style="position:absolute;inset:0"><svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" style="display:block"><text x="10" y="40" font-family="Outfit" font-size="24">Native</text><text x="590" y="90" text-anchor="end" font-family="Outfit" font-size="24">Anchored</text></svg></div>`, {}],
};

// Inline runs lean on the platform font backend for each run's advance, so that file's bytes
// hold on the macOS the goldens were generated on (export-format-golden.test.ts has the same).
const GENERATED_PLATFORM_ONLY = new Set(['inline']);

for (const [name, [inner, opts]] of Object.entries(LTR)) {
  const skip = SKIP || (GENERATED_PLATFORM_ONLY.has(name) && process.platform !== 'darwin' ? 'generated on macOS; another font backend moves inline runs' : false);
  test(`golden: a left-to-right ${name} PDF keeps its bytes`, { skip }, async () => {
    const hash = await contentHash((await exportPdf(inner, opts)).bytes);
    assert.equal(await contentHash((await exportPdf(inner, opts)).bytes), hash, 'two renders agree');
    if (UPDATE) { regenerated[name] = hash; return; }
    assert.equal(hash, committed[name], `the bytes of ${name} moved`);
  });
}
