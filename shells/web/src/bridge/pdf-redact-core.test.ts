// SPDX-License-Identifier: MPL-2.0
/**
 * The DOM-free core of PDF redaction, asserted in node.
 * Run directly:  node --test shells/web/src/bridge/pdf-redact-core.test.ts
 *
 * Covers the point→pixel bar mapping, the DPI clamp, the grayscale math, and - 
 * structurally - buildImagePdf: the rebuilt document is saved and RE-OPENED
 * (the pdf-structure.test.ts discipline; a graph asserted only in the memory
 * that built it proves nothing about what survives serialisation) and its raw
 * bytes are grepped. The canvas half of redaction (render page SVG → burn bars
 * → encode JPEG, in pdf.ts redactPdf) needs a real browser canvas and cannot
 * run under node - it is exercised manually in the web shell.
 *
 * The JPEG fixtures are hand-built: pdf-lib's JpegEmbedder reads only the SOF
 * header for dimensions/channels, so SOI + SOF0 + EOI embeds fine with no scan
 * data at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDpi, barToPixels, grayscaleInPlace, buildImagePdf,
  clampMaxPages, collectPages, PAGES_MAX_DEFAULT,
  REDACT_DPI_DEFAULT, REDACT_DPI_MIN, REDACT_DPI_MAX, BAR_INFLATE_PX,
  normaliseInk, inflateForRadius, stampLayout, REDACT_INK_FALLBACK,
} from './pdf-redact-core.ts';
import { scanPdfStructure } from './pdf-structure.ts';

// ─── DPI clamp ────────────────────────────────────────────────────────────────

test('clampDpi defaults and clamps', () => {
  assert.equal(clampDpi(undefined), REDACT_DPI_DEFAULT);
  assert.equal(clampDpi('nonsense'), REDACT_DPI_DEFAULT);
  assert.equal(clampDpi(NaN), REDACT_DPI_DEFAULT);
  assert.equal(clampDpi(10), REDACT_DPI_MIN);
  assert.equal(clampDpi(1200), REDACT_DPI_MAX);
  assert.equal(clampDpi(150), 150);
  assert.equal(clampDpi('250'), 250);
});

// ─── bar mapping ──────────────────────────────────────────────────────────────

test('barToPixels maps points to device pixels, snapped outward and inflated', () => {
  // dpi 144 → scale 2. Bar 72,36 / 72×18 pt → 144,72 / 144×36 px, then ±2 inflate.
  const r = barToPixels({ x: 72, y: 36, w: 72, h: 18 }, 144, 2000, 2000);
  assert.deepEqual(r, {
    x: 144 - BAR_INFLATE_PX,
    y: 72 - BAR_INFLATE_PX,
    w: 144 + 2 * BAR_INFLATE_PX,
    h: 36 + 2 * BAR_INFLATE_PX,
  });
});

test('barToPixels snaps fractional edges OUTWARD, never inward', () => {
  // 10.4..20.6 pt at 72 dpi (scale 1) → floor(10.4)=10, ceil(20.6)=21, then inflate.
  const r = barToPixels({ x: 10.4, y: 10.4, w: 10.2, h: 10.2 }, 72, 100, 100);
  assert.deepEqual(r, { x: 10 - BAR_INFLATE_PX, y: 10 - BAR_INFLATE_PX, w: 11 + 2 * BAR_INFLATE_PX, h: 11 + 2 * BAR_INFLATE_PX });
});

test('barToPixels clamps to the canvas', () => {
  // A bar hanging off the top-left corner clamps to 0,0 without shrinking the
  // covered in-page area.
  const a = barToPixels({ x: -5, y: -5, w: 10, h: 10 }, 72, 100, 100);
  assert.ok(a);
  assert.equal(a!.x, 0);
  assert.equal(a!.y, 0);
  assert.equal(a!.w, 5 + BAR_INFLATE_PX);
  // A bar hanging off the bottom-right clamps to the canvas edge.
  const b = barToPixels({ x: 90, y: 90, w: 50, h: 50 }, 72, 100, 100);
  assert.ok(b);
  assert.equal(b!.x + b!.w, 100);
  assert.equal(b!.y + b!.h, 100);
});

test('barToPixels rejects degenerate, non-finite and fully off-page bars', () => {
  assert.equal(barToPixels({ x: 10, y: 10, w: 0, h: 5 }, 200, 100, 100), null);
  assert.equal(barToPixels({ x: 10, y: 10, w: -3, h: 5 }, 200, 100, 100), null);
  assert.equal(barToPixels({ x: NaN, y: 10, w: 5, h: 5 }, 200, 100, 100), null);
  assert.equal(barToPixels({ x: 10, y: Infinity, w: 5, h: 5 }, 200, 100, 100), null);
  assert.equal(barToPixels({ x: 500, y: 10, w: 5, h: 5 }, 72, 100, 100), null); // past the right edge
  assert.equal(barToPixels({ x: 10, y: -50, w: 5, h: 5 }, 72, 100, 100), null); // above the top
});

// ─── page previews (host.pdf.pages) ───────────────────────────────────────────

test('clampMaxPages: whole numbers of at least 1 pass, everything else gets the default', () => {
  assert.equal(clampMaxPages(undefined), PAGES_MAX_DEFAULT);
  assert.equal(clampMaxPages('nonsense'), PAGES_MAX_DEFAULT);
  assert.equal(clampMaxPages(NaN), PAGES_MAX_DEFAULT);
  assert.equal(clampMaxPages(Infinity), PAGES_MAX_DEFAULT);
  assert.equal(clampMaxPages(0), PAGES_MAX_DEFAULT);
  assert.equal(clampMaxPages(-3), PAGES_MAX_DEFAULT);
  assert.equal(clampMaxPages(1), 1);
  assert.equal(clampMaxPages(7.9), 7);   // floors, never rounds up past the ask
  assert.equal(clampMaxPages('12'), 12);
  assert.equal(clampMaxPages(500), 500); // no upper clamp - the caller owns big asks
});

test('collectPages renders in order and reports truncation against the cap', async () => {
  const seen: number[] = [];
  const full = await collectPages(3, 40, async (i) => { seen.push(i); return i * 10; });
  assert.deepEqual(seen, [0, 1, 2]);
  assert.deepEqual(full, { pages: [0, 10, 20], truncated: false, failed: [] });

  const capped = await collectPages(5, 2, async (i) => i);
  assert.deepEqual(capped, { pages: [0, 1], truncated: true, failed: [] });

  // count == maxPages is NOT truncated - nothing was left behind.
  const exact = await collectPages(2, 2, async (i) => i);
  assert.deepEqual(exact, { pages: [0, 1], truncated: false, failed: [] });
});

test('collectPages SKIPS a page whose render throws, keeping the rest and NAMING the skip', async () => {
  const out = await collectPages(4, 40, async (i) => {
    if (i === 1) throw new Error('broken page');
    return { page: i + 1 };
  });
  assert.deepEqual(out.pages.map((p) => p.page), [1, 3, 4]);
  assert.equal(out.truncated, false);
  assert.deepEqual(out.failed, [2], 'the skipped page is reported, 1-based');
});

test('collectPages never renders past the cap, even when earlier pages fail', async () => {
  const seen: number[] = [];
  const out = await collectPages(10, 3, async (i) => { seen.push(i); throw new Error('all broken'); });
  assert.deepEqual(seen, [0, 1, 2]); // the cap bounds WORK, not successes
  assert.deepEqual(out, { pages: [], truncated: true, failed: [1, 2, 3] });
});

// ─── grayscale ────────────────────────────────────────────────────────────────

test('grayscaleInPlace applies Rec. 709 luminance and preserves alpha', () => {
  const px = new Uint8ClampedArray([
    255, 0, 0, 255, // pure red
    0, 255, 0, 128, // pure green, half alpha
    0, 0, 255, 255, // pure blue
    80, 80, 80, 255, // already gray
  ]);
  grayscaleInPlace(px);
  assert.deepEqual([...px.slice(0, 4)], [54, 54, 54, 255]);   // 0.2126*255 ≈ 54
  assert.deepEqual([...px.slice(4, 8)], [182, 182, 182, 128]); // 0.7152*255 ≈ 182
  assert.deepEqual([...px.slice(8, 12)], [18, 18, 18, 255]);   // 0.0722*255 ≈ 18
  assert.deepEqual([...px.slice(12, 16)], [80, 80, 80, 255]);  // gray is a fixed point
});

// ─── the rebuilt document ─────────────────────────────────────────────────────

/** SOI + SOF0 (baseline, 8-bit, 3 channels) + EOI - enough for pdf-lib's embedder. */
function fakeJpeg(w: number, h: number): Uint8Array {
  return new Uint8Array([
    0xff, 0xd8, // SOI
    0xff, 0xc0, 0x00, 0x11, 0x08, // SOF0, length 17, 8-bit
    (h >> 8) & 0xff, h & 0xff, (w >> 8) & 0xff, w & 0xff,
    0x03, // 3 components
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9, // EOI
  ]);
}

test('buildImagePdf: page count and MediaBox preserved, one %%EOF, nothing else in the file', async () => {
  const out = await buildImagePdf([
    { jpeg: fakeJpeg(1654, 2339), widthPt: 595.28, heightPt: 841.89 }, // A4
    { jpeg: fakeJpeg(1700, 2200), widthPt: 612, heightPt: 792 },       // US Letter
  ]);

  // Exactly one %%EOF - no prior revisions to roll back to.
  const text = new TextDecoder('latin1').decode(out);
  assert.equal(text.split('%%EOF').length - 1, 1);

  // None of the carriers redaction exists to destroy. Byte-level: these names
  // cannot appear even compressed-away, because nothing ever wrote them.
  for (const name of ['/EmbeddedFiles', '/JavaScript', '/OCProperties', '/Annots', '/AcroForm', '/Metadata']) {
    assert.ok(!text.includes(name), `rebuilt document must not contain ${name}`);
  }
  // The Info dictionary was emptied - pdf-lib's default Producer/Creator are gone,
  // and save() does not re-stamp them (the keys are absent, not just blank).
  assert.ok(!text.includes('pdf-lib'), 'rebuilt document must carry no Info values');
  for (const key of ['/Producer', '/Creator', '/CreationDate', '/ModDate']) {
    assert.ok(!text.includes(key), `rebuilt document must not contain ${key}`);
  }

  // Re-open the bytes - what a READER of the file finds.
  const { PDFDocument } = await import('pdf-lib');
  const doc = await PDFDocument.load(out, { ignoreEncryption: true, updateMetadata: false });
  assert.equal(doc.getPageCount(), 2);
  const s0 = doc.getPages()[0]!.getSize();
  const s1 = doc.getPages()[1]!.getSize();
  assert.ok(Math.abs(s0.width - 595.28) < 0.01 && Math.abs(s0.height - 841.89) < 0.01);
  assert.ok(Math.abs(s1.width - 612) < 0.01 && Math.abs(s1.height - 792) < 0.01);

  // The structural scanner agrees: nothing to report beyond the page count
  // (the same baseline pdf-structure.test.ts pins for an empty document).
  const findings = scanPdfStructure(doc);
  assert.deepEqual(findings.map((f) => f.label), ['Pages']);

  // Each page carries exactly one image XObject and no fonts.
  let images = 0;
  let fonts = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects() as unknown as Array<[unknown, { dict?: { get(k: unknown): unknown } }]>) {
    const d = obj && obj.dict;
    if (!d || typeof d.get !== 'function') continue;
    const { PDFName } = await import('pdf-lib');
    const sub = String(d.get(PDFName.of('Subtype')) ?? '');
    if (sub === '/Image') images++;
    if (sub.includes('Font')) fonts++;
  }
  assert.equal(images, 2);
  assert.equal(fonts, 0);
});

test('buildImagePdf refuses an empty page list', async () => {
  await assert.rejects(() => buildImagePdf([]), /no pages/i);
});

// ─── the branded mark (v1.90 additive opts) ──────────────────────────────────

test('normaliseInk: colour is neutral, translucency is not', () => {
  // Colour is security-neutral - any fully opaque fill destroys the pixels under
  // it equally - which is what lets a bar carry a brand. Alpha is NOT neutral,
  // and neither is an unreadable string: assigning one to a canvas fillStyle is
  // a silent no-op, and the previous fill in the page rebuild is the opaque
  // white background, so an unvalidated colour would paint white-on-white bars
  // that redact nothing at all.
  assert.equal(normaliseInk('#0C322C'), '#0c322c');
  assert.equal(normaliseInk('  #ABC  '), '#aabbcc');
  assert.equal(normaliseInk('#0c322cff'), '#0c322c');
  assert.equal(normaliseInk('#abcf'), '#aabbcc');
  for (const bad of ['#0c322ccc', '#abc8', '#0c322c00', 'rgba(12,50,44,.5)', 'black', 'oklch(19% .02 275)', '', '#12345', null, 7, {}]) {
    assert.equal(normaliseInk(bad as unknown), null, String(bad));
  }
  assert.equal(normaliseInk(REDACT_INK_FALLBACK), REDACT_INK_FALLBACK, 'the fallback is itself a valid ink');
});

test('inflateForRadius: the requested rect stays entirely inside the rounded shape', () => {
  // A rounded rectangle does not cover the corners of the box it is inscribed
  // in. Inflating by the radius first puts each arc centre exactly on a corner
  // of the requested rect, so containment follows by construction.
  const inShape = (s: ReturnType<typeof inflateForRadius>, x: number, y: number): boolean => {
    if (x < s.x || x > s.x + s.w || y < s.y || y > s.y + s.h) return false;
    const [tl, tr, br, bl] = s.radii;
    const corner = (cx: number, cy: number, r: number, insideX: boolean, insideY: boolean): boolean => {
      if (!r) return true;
      if (insideX ? x > cx : x < cx) return true;
      if (insideY ? y > cy : y < cy) return true;
      return Math.hypot(x - cx, y - cy) <= r + 1e-9;
    };
    return corner(s.x + tl, s.y + tl, tl, true, true)
      && corner(s.x + s.w - tr, s.y + tr, tr, false, true)
      && corner(s.x + s.w - br, s.y + s.h - br, br, false, false)
      && corner(s.x + bl, s.y + s.h - bl, bl, true, false);
  };
  for (const r of [{ x: 40, y: 40, w: 100, h: 22 }, { x: 4, y: 4, w: 20, h: 8 }]) {
    for (const radius of [0, 1, 4, 9]) {
      const s = inflateForRadius(r, radius, 400, 200);
      for (const [x, y] of [[r.x, r.y], [r.x + r.w, r.y], [r.x, r.y + r.h], [r.x + r.w, r.y + r.h]] as [number, number][]) {
        assert.ok(inShape(s, x, y), `corner (${x},${y}) uncovered at radius ${radius}`);
      }
      assert.ok(s.x <= r.x && s.y <= r.y && s.x + s.w >= r.x + r.w && s.y + s.h >= r.y + r.h);
    }
  }
});

test('inflateForRadius: a corner clamped to the canvas edge is painted square', () => {
  // The clamp drags the arc centre inward, where it would cut back into the very
  // rectangle the inflation exists to protect.
  const s = inflateForRadius({ x: 0, y: 0, w: 50, h: 20 }, 4, 400, 200);
  assert.deepEqual(s.radii, [0, 0, 4, 0]);
  assert.deepEqual([s.x, s.y, s.w, s.h], [0, 0, 54, 24]);
  // Radius 0 is the untouched rect.
  const flat = inflateForRadius({ x: 10, y: 10, w: 5, h: 5 }, 0, 400, 200);
  assert.deepEqual(flat, { x: 10, y: 10, w: 5, h: 5, radii: [0, 0, 0, 0] });
  // A clamp on all four sides leaves no rounding at all.
  const boxed = inflateForRadius({ x: 0, y: 0, w: 400, h: 200 }, 6, 400, 200);
  assert.deepEqual(boxed.radii, [0, 0, 0, 0]);
});

test('stampLayout: a bar too small for the label goes unstamped rather than squeezed', () => {
  const wide = stampLayout({ x: 0, y: 0, w: 300, h: 40 }, 'Records office', 20);
  assert.ok(wide);
  assert.equal(wide!.cx, 150);
  assert.equal(wide!.cy, 20);
  assert.ok(wide!.size > 0 && wide!.size <= 20);
  assert.equal(stampLayout({ x: 0, y: 0, w: 300, h: 10 }, 'Records office', 20), null, 'too short');
  assert.equal(stampLayout({ x: 0, y: 0, w: 40, h: 40 }, 'Records office', 20), null, 'too narrow');
  assert.equal(stampLayout({ x: 0, y: 0, w: 300, h: 40 }, '   ', 20), null, 'nothing to say');
});
