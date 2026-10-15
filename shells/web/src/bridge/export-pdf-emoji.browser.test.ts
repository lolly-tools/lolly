// SPDX-License-Identifier: MPL-2.0
/**
 * Emoji drawn from a chosen set reach a PDF as that set's own vector artwork (plan 252).
 *
 * The rendered pass replaces each emoji with an inline-block span holding the artwork
 * as a display:block <svg> (engine/src/emoji-dom.ts). The PDF walker's block loop skips
 * inline-block children and leaves them to the inline text pass, and that pass returned
 * at the <svg>, so every emoji was missing from every PDF while SVG export drew them.
 * Design users had to Convert to paths before a PDF showed them.
 *
 * The placements here come from the engine's real pass over the real browser DOM,
 * with the pinned Twemoji specimen, so the markup is what the canvas holds rather
 * than a hand-written imitation. The oracle is the PDF's own drawing operators: the
 * specimen's face is one yellow circle (#FFCC4D) and nothing else on the page uses
 * that colour, so a yellow fill inside a placement's box is the artwork arriving as
 * vector paths.
 *
 * Real Chromium, self-skipping when none is installed, as export-pdf-filter.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { inflateSync } from 'node:zlib';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixtureLocks, fixtureRoot, style } from '../../../../tests/helpers/emoji-fixtures.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const EXPORT_MODULE = fileURLToPath(new URL('./export.ts', import.meta.url));
const EXPORT_TEXT = fileURLToPath(new URL('./export-text.ts', import.meta.url));
const EMOJI_DOM = fileURLToPath(new URL('../../../../engine/src/emoji-dom.ts', import.meta.url));
const EMOJI_PACK = fileURLToPath(new URL('../../../../engine/src/emoji-pack.ts', import.meta.url));

async function chromiumOrSkip(): Promise<{ chromium: any } | string> {
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

let bundleCache: string | null = null;
async function bundle(): Promise<string> {
  if (bundleCache) return bundleCache;
  const { build } = await import('esbuild');
  const out = await build({
    stdin: {
      contents: `import { renderPdf, renderSvgFromHtml } from ${JSON.stringify(EXPORT_MODULE)};
                 import { pdfInlineNonText } from ${JSON.stringify(EXPORT_TEXT)};
                 import { applyEmojiToDom } from ${JSON.stringify(EMOJI_DOM)};
                 import { readEmojiPack } from ${JSON.stringify(EMOJI_PACK)};
                 const bytes = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
                 window.__pdf = renderPdf;
                 window.__svg = renderSvgFromHtml;
                 window.__inline = pdfInlineNonText;
                 window.__drawEmoji = async ({ manifest, pin, artwork, style }) => {
                   const read = await readEmojiPack(bytes(manifest), pin);
                   if (!read.ok) throw new Error(read.issue.message);
                   const io = {
                     loadArtwork: async () => bytes(artwork),
                     parseXml: (source) => new DOMParser().parseFromString(source, 'image/svg+xml'),
                   };
                   const result = await applyEmojiToDom(document.getElementById('root'), style, [read.pack], io);
                   return { replaced: result.replaced, unresolved: result.unresolved };
                 };`,
      resolveDir: HERE,
      loader: 'ts',
    },
    bundle: true, write: false, format: 'iife', platform: 'browser', logLevel: 'silent',
    // export.ts reaches a CSS side-effect import through a lazy chain (the durable
    // probe in format-support.ts); esbuild has no output path here, so drop the sheets.
    loader: { '.css': 'empty' },
  });
  bundleCache = out.outputFiles[0]!.text;
  return bundleCache;
}

const GRIN = '\u{1F600}';
const W = 480, H = 220;
/**
 * A Design text box (a block of text holding a placement beside a letter) and the
 * same glyph inside an inline wrapper, which is how other tools mark up rich text.
 */
const MARKUP = `<div id="root" style="position:relative;width:${W}px;height:${H}px;background:#fff">
  <div class="lolly-box-text" style="position:absolute;left:20px;top:16px;width:440px;font:700 64px/1.05 sans-serif;color:#202020;text-align:center">g${GRIN}</div>
  <p style="position:absolute;left:20px;top:120px;margin:0;font:400 40px/1.2 sans-serif;color:#202020">Hi <strong>${GRIN}</strong> there</p>
</div>`;

interface Fill { rgb: number[]; box: { x0: number; y0: number; x1: number; y1: number } }

/**
 * Every filled path in a page content stream, with the fill colour it was painted in
 * and the box of its points. The writer opens each page with a top-left, y-down basis
 * (`1 0 0 -1 0 H cm`), and this fixture has no rotation, so the coordinates are page
 * points measured from the top left.
 */
function fills(content: string): Fill[] {
  const out: Fill[] = [];
  const stack: number[][] = [];
  let rgb = [0, 0, 0];
  let nums: number[] = [];
  let points: number[] = [];
  const flush = () => { points = []; };
  for (const token of content.split(/\s+/)) {
    if (!token) continue;
    if (/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(token)) { nums.push(Number(token)); continue; }
    switch (token) {
      case 'rg': rgb = nums.slice(-3); break;
      case 'g': rgb = [nums.at(-1)!, nums.at(-1)!, nums.at(-1)!]; break;
      case 'q': stack.push(rgb); break;
      case 'Q': rgb = stack.pop() ?? rgb; break;
      case 'm': case 'l': case 'c': case 'v': case 'y': points.push(...nums); break;
      case 're': {
        const [x, y, w, h] = nums.slice(-4) as [number, number, number, number];
        points.push(x, y, x + w, y + h);
        break;
      }
      case 'f': case 'f*': case 'F': case 'B': case 'B*': case 'b': case 'b*': {
        if (points.length >= 2) {
          const xs = points.filter((_, i) => i % 2 === 0), ys = points.filter((_, i) => i % 2 === 1);
          out.push({ rgb, box: { x0: Math.min(...xs), y0: Math.min(...ys), x1: Math.max(...xs), y1: Math.max(...ys) } });
        }
        flush();
        break;
      }
      case 'n': case 'S': case 's': flush(); break;
      default: break;
    }
    nums = [];
  }
  return out;
}

/** The page's decoded content and the raw file as latin1 text for its dictionaries. */
async function readPdf(bytes: Uint8Array): Promise<{ content: string; raw: string; size: { width: number; height: number } }> {
  const lib = await import('pdf-lib') as any;
  const pdf = await lib.PDFDocument.load(bytes, { updateMetadata: false });
  const page = pdf.getPage(0);
  const ref = page.node.get(lib.PDFName.of('Contents'));
  const found = pdf.context.lookup(ref);
  const streams = found?.asArray ? found.asArray().map((r: unknown) => pdf.context.lookup(r)) : [found];
  const content = streams.map((s: any) => new TextDecoder('latin1').decode(inflateSync(Buffer.from(s.contents)))).join('\n');
  return { content, raw: new TextDecoder('latin1').decode(bytes), size: page.getSize() };
}

interface Rendered {
  placed: { replaced: number; unresolved: number };
  /** Each placement's box in CSS px, relative to #root. */
  boxes: Array<{ x: number; y: number; w: number; h: number }>;
  /** What the PDF inline pass decided for each part of the first placement, and what it drew. */
  decisions: Record<'hidden' | 'artwork' | 'span' | 'direct', boolean> & { drawn: string[] };
  pdf: Uint8Array;
  svg: string;
}

async function render(opts: Record<string, unknown>): Promise<Rendered> {
  const lock = fixtureLocks.find((entry) => entry.directory === 'twemoji')!;
  const manifest = await readFile(new URL('twemoji/manifest.json', fixtureRoot));
  const artwork = await readFile(new URL('twemoji/1f600.svg', fixtureRoot));
  const { chromium } = browser as { chromium: any };
  const b = await chromium.launch();
  try {
    const page = await b.newPage({ viewport: { width: 640, height: 320 } });
    // Pack admission hashes with WebCrypto, which needs a secure context; about:blank
    // is not one, and localhost is. The route answers in-process, so nothing listens.
    await page.route('http://localhost/', (route: any) => route.fulfill({
      contentType: 'text/html; charset=utf-8', body: `<!doctype html><meta charset="utf-8"><body style="margin:0">${MARKUP}</body>`,
    }));
    await page.goto('http://localhost/');
    await page.addScriptTag({ content: await bundle() });
    const out = await page.evaluate(async ({ input, exportOpts }: any) => {
      const w = window as any;
      const placed = await w.__drawEmoji(input);
      const root = document.getElementById('root')!;
      const origin = root.getBoundingClientRect();
      const boxes = [...root.querySelectorAll('.lolly-emoji')].map((el) => {
        const r = el.getBoundingClientRect();
        return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
      });
      const block = root.querySelector('.lolly-box-text')!;
      const span = block.querySelector('.lolly-emoji')!;
      const direct = block.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
      const drawn: string[] = [];
      const drawBox = async (el: Element) => { drawn.push(el.parentElement === span ? 'artwork' : el.tagName); };
      const decisions = {
        hidden: await w.__inline(span.querySelector('.lolly-emoji-text'), block, drawBox),
        artwork: await w.__inline(span.querySelector('svg'), block, drawBox),
        span: await w.__inline(span, block, drawBox),
        direct: await w.__inline(direct, block, drawBox),
        drawn,
      };
      direct.remove();
      const blob = await w.__pdf(root, exportOpts);
      const buf = new Uint8Array(await blob.arrayBuffer());
      let pdf = ''; for (const byte of buf) pdf += String.fromCharCode(byte);
      const svg = await (await w.__svg(root, exportOpts)).text();
      return { placed, boxes, decisions, pdf: btoa(pdf), svg };
    }, {
      input: { manifest: manifest.toString('base64'), pin: lock.pin, artwork: artwork.toString('base64'), style: style(lock.pin) },
      exportOpts: opts,
    });
    return { ...out, pdf: new Uint8Array(Buffer.from(out.pdf, 'base64')) };
  } finally { await b.close(); }
}

/** The specimen face's #FFCC4D, as the writer's two-decimal operands give it back. */
const isFaceYellow = (rgb: number[]): boolean =>
  rgb.length === 3 && Math.abs(rgb[0]! - 1) < 0.011 && Math.abs(rgb[1]! - 0.8) < 0.011 && Math.abs(rgb[2]! - 0.3) < 0.011;

for (const [mode, opts] of [['live text', {}], ['text converted to paths', { convertPaths: true }]] as const) {
  test(`emoji placements reach the PDF as vector artwork in their own boxes (${mode})`, { skip: SKIP, timeout: 120_000 }, async () => {
    const out = await render(opts);
    assert.deepEqual(out.placed, { replaced: 2, unresolved: 0 }, 'premise: the engine pass drew both emoji from the pinned set');
    assert.equal(out.boxes.length, 2);

    const { content, raw, size } = await readPdf(out.pdf);
    const pt = size.width / W;
    const yellow = fills(content).filter((f) => isFaceYellow(f.rgb));
    // One face per placement: before the fix there were none, because the walker never
    // drew an <svg> nested inside inline flow.
    assert.equal(yellow.length, out.boxes.length, `expected one yellow face per placement, found ${yellow.length}`);
    for (const box of out.boxes) {
      const inside = yellow.find(({ box: f }) =>
        f.x0 >= box.x * pt - 1 && f.y0 >= box.y * pt - 1 && f.x1 <= (box.x + box.w) * pt + 1 && f.y1 <= (box.y + box.h) * pt + 1
        && f.x1 - f.x0 > box.w * pt * 0.6);
      assert.ok(inside, `no yellow face inside the placement at ${JSON.stringify(box)}`);
    }
    // Paths, not a picture of them: the specimen has no gradient, so nothing rasterises.
    assert.doesNotMatch(raw, /\/Subtype\s*\/Image/, 'the artwork must stay vector');

    // SVG export already drew the artwork; both walkers must agree.
    assert.equal((out.svg.match(/#ffcc4d|rgb\(255, 204, 77\)/gi) ?? []).length >= 2, true, 'the SVG export carries both faces too');
  });
}

test('the PDF inline pass skips the hidden characters and hands nested artwork to the element painter', { skip: SKIP, timeout: 120_000 }, async () => {
  const { decisions } = await render({});
  assert.deepEqual(decisions, {
    hidden: true,    // never painted: the artwork stands in for these characters
    artwork: true,   // drawn through drawBox, the walker's element painter
    span: false,     // an inline wrapper the pass descends into for its text
    direct: false,   // a block's own <svg> child belongs to the block loop
    drawn: ['artwork'],
  });
});
