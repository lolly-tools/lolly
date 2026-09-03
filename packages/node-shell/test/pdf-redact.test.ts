// SPDX-License-Identifier: MPL-2.0
/**
 * PDF redaction in Node (plan 183 WS4).
 *
 * Run directly:  node --test packages/node-shell/test/pdf-redact.test.ts
 *
 * Nothing is mocked except the "no canvas installed" case, because the whole
 * value of this path is that the covered words are ACTUALLY gone from the bytes
 * someone is about to send. Every fixture is a real pdf-lib document with a real
 * content stream, and every assertion re-opens the OUTPUT and reads it back with
 * the same walk the inspection command uses - a graph asserted in the memory that
 * built it proves nothing (see the pdf-lib fixture notes: indirect references
 * only become PDFRefs after a round trip).
 *
 * The three properties that matter, in order:
 *   1. the covered text is not in the output, as text OR as raw bytes;
 *   2. the page count and the MediaBox sizes are the source's, exactly;
 *   3. the bar region is the SOLID ink it claimed to be, sampled from the
 *      rebuilt page image rather than trusted from the draw call.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { redactPdf, pdfPages, createNodePdfRedact } from '../src/pdf-redact.ts';
import { openPdfForRender, scanPdfPages } from '../src/pdf-pages.ts';
import { barToPixels, REDACT_INK_FALLBACK } from '../src/pdf-redact-core.ts';
import { decodeToCanvas } from '../src/canvas.ts';

const SECRET = 'ZQXJVWK-CONFIDENTIAL-4471';

/**
 * Two pages of real content: text (the thing a redaction is about), a filled
 * vector rectangle (so a "did anything render at all" check has something to
 * find), and different page sizes so a size assertion can actually fail.
 */
async function buildFixture(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle('Case file');
  doc.setAuthor('Records Office');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const p1 = doc.addPage([400, 200]);
  p1.drawText('Name: Alexandra Fitz', { x: 40, y: 150, size: 12, font });
  p1.drawText(SECRET, { x: 40, y: 120, size: 12, font });
  p1.drawRectangle({ x: 30, y: 60, width: 120, height: 30, color: rgb(0.2, 0.5, 0.9) });
  const p2 = doc.addPage([300, 500]);
  p2.drawText('Page two is public', { x: 20, y: 400, size: 14, font });
  return doc.save();
}

/** The bar over the secret line: PDF points, y from the TOP of a 200pt page. */
const SECRET_BAR = { page: 1, x: 35, y: 66, w: 220, h: 20 };
const DPI = 150;

/** Every text run the output still paints, read back through the engine's own
 *  interpreter rather than through a byte grep. */
async function textIn(bytes: Uint8Array): Promise<string> {
  const scan = await scanPdfPages(bytes);
  return scan.pages.flatMap((p) => p.nodes.filter((n) => n.kind === 'text').map((n) => n.text ?? '')).join(' ');
}

/** The rebuilt page's own image, decoded back to pixels. */
async function pageImage(bytes: Uint8Array, index: number): Promise<{ data: Uint8ClampedArray; width: number; height: number }> {
  const handle = await openPdfForRender(bytes);
  const svg = (await handle.pageToSvg(index)).svg;
  const m = /href="data:image\/[a-z]+;base64,([^"]+)"/.exec(svg);
  assert.ok(m, 'the rebuilt page should carry exactly one embedded image');
  const canvas = await decodeToCanvas(new Uint8Array(Buffer.from(m[1]!, 'base64')));
  assert.ok(canvas, 'the rebuilt page image should decode');
  const cx = canvas.getContext('2d');
  const img = cx.getImageData(0, 0, canvas.width, canvas.height);
  return { data: img.data, width: canvas.width, height: canvas.height };
}

test('redactPdf: the covered text is gone from the rebuilt document', async () => {
  const src = await buildFixture();
  // Read the SOURCE back through the same interpreter first: pdf-lib saves with
  // object streams, so a byte grep would say "clean" about a document that is not.
  assert.match(await textIn(src), new RegExp(SECRET), 'the fixture must actually carry the secret');

  const res = await redactPdf(src, { bars: [SECRET_BAR], dpi: DPI });

  assert.equal(await textIn(res.bytes), '', 'an image-only rebuild has no text layer at all');
  assert.equal(Buffer.from(res.bytes).includes(SECRET), false, 'and the secret is not in the bytes either');
  // The UNCOVERED text is gone too, and that is what this transform honestly does:
  // rasterise-and-rebuild destroys the text layer, it does not redact selectively.
  assert.equal(Buffer.from(res.bytes).includes('Alexandra Fitz'), false);
});

test('redactPdf: page count and MediaBox sizes are the source\'s, exactly', async () => {
  const src = await buildFixture();
  const res = await redactPdf(src, { bars: [SECRET_BAR], dpi: DPI });

  assert.equal(res.pages, 2);
  assert.equal(res.warnings, undefined, 'a page that renders cleanly reports no warning');

  const scan = await scanPdfPages(res.bytes);
  assert.equal(scan.pageCount, 2);
  assert.deepEqual(scan.pages.map((p) => [p.width, p.height]), [[400, 200], [300, 500]]);
});

test('redactPdf: the page raster is exactly wPt*dpi/72 and the bar region is solid ink', async () => {
  const src = await buildFixture();
  const res = await redactPdf(src, { bars: [SECRET_BAR], dpi: DPI });
  const img = await pageImage(res.bytes, 0);

  // The web half computes the same two numbers from the same MediaBox, so this
  // pins the geometry both shells must agree on.
  assert.equal(img.width, Math.round((400 * DPI) / 72));
  assert.equal(img.height, Math.round((200 * DPI) / 72));

  const r = barToPixels(SECRET_BAR, DPI, img.width, img.height);
  assert.ok(r, 'the bar must map onto the page raster');
  const want = [0x14, 0x16, 0x1a];
  const at = (x: number, y: number): number[] => {
    const o = (y * img.width + x) * 4;
    return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!, img.data[o + 3]!];
  };
  // A 3x3 grid inset from the edges - the inflation absorbs codec ringing at the
  // boundary, so anything short of solid inside this window is a real failure.
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const px = Math.round(r.x + 3 + ((r.w - 7) * sx) / 2);
      const py = Math.round(r.y + 3 + ((r.h - 7) * sy) / 2);
      const [cr, cg, cb, ca] = at(px, py);
      assert.equal(ca, 255, `bar pixel ${px},${py} must be fully opaque`);
      const off = Math.max(Math.abs(cr! - want[0]!), Math.abs(cg! - want[1]!), Math.abs(cb! - want[2]!));
      assert.ok(off <= 20, `bar pixel ${px},${py} is ${cr},${cg},${cb}, not ${REDACT_INK_FALLBACK} (off by ${off})`);
    }
  }
  // …and the page around it still carries the document: the blue rectangle sits at
  // 30..150 x 110..140 in top-origin points, which is real content, not paper.
  const [br, bg, bb] = at(Math.round((80 * DPI) / 72), Math.round((125 * DPI) / 72));
  assert.ok(bb! > 150 && br! < 120, `the vector artwork should still render (got ${br},${bg},${bb})`);
});

test('redactPdf: a bar the caller colours honestly is the colour that gets burned', async () => {
  const src = await buildFixture();
  // A fully opaque brand tone, and a translucent one that must be REFUSED back to
  // the neutral ink rather than painted (see normaliseInk: colour is neutral,
  // alpha is not).
  const opaque = await redactPdf(src, { bars: [SECRET_BAR], dpi: 72, color: '#0000ff' });
  const sheer = await redactPdf(src, { bars: [SECRET_BAR], dpi: 72, color: '#0000ff80' });
  const pick = async (bytes: Uint8Array): Promise<number[]> => {
    const img = await pageImage(bytes, 0);
    const r = barToPixels(SECRET_BAR, 72, img.width, img.height)!;
    const o = ((r.y + Math.floor(r.h / 2)) * img.width + r.x + Math.floor(r.w / 2)) * 4;
    return [img.data[o]!, img.data[o + 1]!, img.data[o + 2]!];
  };
  const [, , ob] = await pick(opaque.bytes);
  const [sr, sg, sb] = await pick(sheer.bytes);
  assert.ok(ob! > 200, `an opaque #0000ff bar should burn blue (got blue=${ob})`);
  assert.ok(sr! < 60 && sg! < 60 && sb! < 60, `a translucent fill falls back to the neutral ink (got ${sr},${sg},${sb})`);
});

test('redactPdf: a bar aimed off the page is skipped, and the rebuild still happens', async () => {
  const src = await buildFixture();
  const res = await redactPdf(src, {
    bars: [SECRET_BAR, { page: 9, x: 0, y: 0, w: 50, h: 50 }, { page: 1, x: 5000, y: 5000, w: 10, h: 10 }],
    dpi: 72,
  });
  assert.equal(res.pages, 2);
  assert.equal(await textIn(res.bytes), '');
});

test('pdfPages: one self-contained SVG per page, viewBox in points, origin top-left', async () => {
  const src = await buildFixture();
  const res = await pdfPages(src);

  assert.equal(res.pages.length, 2);
  assert.equal(res.truncated, false);
  assert.equal(res.failed, undefined);
  assert.deepEqual(res.pages.map((p) => [p.widthPt, p.heightPt]), [[400, 200], [300, 500]]);
  assert.match(res.pages[0]!.svg, /^<svg\b/);
  assert.match(res.pages[0]!.svg, /viewBox="0 0 400 200"/);
  // The preview keeps the words - it is what a person draws their bars against.
  assert.match(res.pages[0]!.svg, new RegExp(SECRET));
});

test('pdfPages: the cap truncates and says so', async () => {
  const src = await buildFixture();
  const res = await pdfPages(src, { maxPages: 1 });
  assert.equal(res.pages.length, 1);
  assert.equal(res.truncated, true);
});

test('redactPdf refuses bytes it cannot read, in one sentence a person can act on', async () => {
  const junk = new TextEncoder().encode('%PDF-1.7\nthis is not a document\n');
  // Whichever way pdf-lib gives up - the load or the page-tree walk - the message
  // is ours, not a raw "Cannot read properties of undefined".
  await assert.rejects(() => redactPdf(junk, { bars: [] }), /could not be read.*damaged|damaged.*read/i);
});

test('createNodePdfRedact returns null when the canvas package is not installed', () => {
  // The contract makes redact/pages optional PER METHOD so a shell can honestly
  // lack them; this pins that "lean install" is that state and not a stub that
  // throws on every call. Resolution is what the availability probe asks about,
  // so resolution is what gets denied.
  const mod = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
  const real = mod._resolveFilename;
  mod._resolveFilename = function patched(req: string, ...rest: unknown[]): string {
    if (req === '@napi-rs/canvas') {
      throw Object.assign(new Error("Cannot find module '@napi-rs/canvas'"), { code: 'MODULE_NOT_FOUND' });
    }
    return real.call(this, req, ...rest);
  };
  try {
    assert.equal(createNodePdfRedact(), null);
  } finally {
    mod._resolveFilename = real;
  }
  // …and it comes back the moment the package is resolvable again.
  assert.notEqual(createNodePdfRedact(), null);
});

test('redactPdf says what it needs when there is no canvas, instead of shipping bars-free bytes', async () => {
  const src = await buildFixture();
  const mod = Module as unknown as { _resolveFilename: (req: string, ...rest: unknown[]) => string };
  const real = mod._resolveFilename;
  mod._resolveFilename = function patched(req: string, ...rest: unknown[]): string {
    if (req === '@napi-rs/canvas') {
      throw Object.assign(new Error("Cannot find module '@napi-rs/canvas'"), { code: 'MODULE_NOT_FOUND' });
    }
    return real.call(this, req, ...rest);
  };
  try {
    await assert.rejects(() => redactPdf(src, { bars: [SECRET_BAR] }), /needs a canvas/i);
  } finally {
    mod._resolveFilename = real;
  }
});
