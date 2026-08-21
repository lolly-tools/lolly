// SPDX-License-Identifier: MPL-2.0
/**
 * The shared file-inspection module (@lolly-tools/node-shell/inspect) and its terminal
 * renderer. Run directly:  node --test tests/inspect-file.test.ts
 *
 * Every fixture here is REAL bytes, built in this file: a JPEG carrying a crafted EXIF
 * GPS IFD, a PDF whose text is covered by an opaque rectangle (drawn with pdf-lib, so
 * the content stream is a real one), a genuinely C2PA-signed file, and a corrupt file.
 * Nothing is mocked, because the whole value of this command is that its findings are
 * true of the actual bytes someone is about to send to someone else.
 *
 * The tests that matter most are not the "it found the thing" ones. They are:
 *   • the corrupt-file test, which pins DEGRADE-DON'T-CRASH: fewer findings plus an
 *     `errors` entry, never a throw;
 *   • the control-character test, which pins that a hostile document cannot inject ANSI
 *     into the report meant to be trustworthy about it;
 *   • the limits tests, which pin that the report always states what it did NOT check,
 *     including that no invisible/neural watermark detection ran at all.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { inspectBytes, hasShareRisk, ABSENCE_CAVEAT } from '../packages/node-shell/src/inspect.ts';
import { renderInspection, clean } from '../packages/node-shell/src/inspect-render.ts';
import { scanPdfPages } from '../packages/node-shell/src/pdf-pages.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';

// ─── fixtures ─────────────────────────────────────────────────────────────────

/** A little-endian TIFF: IFD0 {Make, GPS pointer} → a GPS IFD at 37°48'30"N 122°25'W. */
function buildExifTiff(): Uint8Array {
  const buf = new Uint8Array(148);
  const dv = new DataView(buf.buffer);
  const LE = true;
  const MAKE_OFF = 38, GPS_IFD = 46, LAT_OFF = 100, LON_OFF = 124;
  buf[0] = 0x49; buf[1] = 0x49;
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE);
  dv.setUint16(8, 2, LE);
  const entry = (off: number, tag: number, type: number, count: number): void => {
    dv.setUint16(off, tag, LE); dv.setUint16(off + 2, type, LE); dv.setUint32(off + 4, count, LE);
  };
  entry(10, 0x010F, 2, 8); dv.setUint32(18, MAKE_OFF, LE);
  entry(22, 0x8825, 4, 1); dv.setUint32(30, GPS_IFD, LE);
  dv.setUint32(34, 0, LE);
  'TestCam'.split('').forEach((c, i) => { buf[MAKE_OFF + i] = c.charCodeAt(0); });
  dv.setUint16(GPS_IFD, 4, LE);
  entry(48, 0x0001, 2, 2); buf[56] = 0x4E;
  entry(60, 0x0002, 5, 3); dv.setUint32(68, LAT_OFF, LE);
  entry(72, 0x0003, 2, 2); buf[80] = 0x57;
  entry(84, 0x0004, 5, 3); dv.setUint32(92, LON_OFF, LE);
  dv.setUint32(96, 0, LE);
  const rat = (off: number, n: number, d: number): void => { dv.setUint32(off, n, LE); dv.setUint32(off + 4, d, LE); };
  rat(LAT_OFF, 37, 1); rat(LAT_OFF + 8, 48, 1); rat(LAT_OFF + 16, 30, 1);
  rat(LON_OFF, 122, 1); rat(LON_OFF + 8, 25, 1); rat(LON_OFF + 16, 0, 1);
  return buf;
}

function concat(parts: Uint8Array[]): Uint8Array {
  let n = 0; for (const p of parts) n += p.length;
  const out = new Uint8Array(n); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

/** SOI + JFIF APP0 + an EXIF APP1 carrying the GPS TIFF + a token scan + EOI. */
function buildExifJpeg(extra: Uint8Array[] = []): Uint8Array {
  const tiff = buildExifTiff();
  const exifId = Uint8Array.from([0x45, 0x78, 0x69, 0x66, 0x00, 0x00]);
  const segLen = 2 + exifId.length + tiff.length;
  const app1 = new Uint8Array(4 + exifId.length + tiff.length);
  app1[0] = 0xFF; app1[1] = 0xE1; app1[2] = (segLen >> 8) & 0xFF; app1[3] = segLen & 0xFF;
  app1.set(exifId, 4); app1.set(tiff, 4 + exifId.length);
  return concat([
    Uint8Array.from([0xFF, 0xD8]),
    Uint8Array.from([0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00]),
    app1,
    Uint8Array.from([0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0xAA, 0xBB, 0xFF, 0xD9]),
    ...extra,
  ]);
}

const SECRET = 'Social Security 123-45-6789';

/**
 * The classic failed redaction: real text, then an opaque black rectangle drawn OVER it.
 * pdf-lib writes a genuine content stream, so this exercises the whole path - pdf-lib
 * walk, engine interpreter, paint-order geometry - not a hand-built node array.
 */
async function buildRedactedPdf(opts: { title?: string; cover?: boolean } = {}): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(opts.title ?? 'Case file');
  doc.setAuthor('Records Office');
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 200]);
  page.drawText('Name: Alexandra Fitz', { x: 40, y: 150, size: 12, font });
  page.drawText(SECRET, { x: 40, y: 120, size: 12, font });
  if (opts.cover !== false) {
    // Painted AFTER the text: a cover, not a highlight. That order is the whole test.
    // The bar covers the whole LINE box (the engine gives 12pt text a 24pt-tall box),
    // which is what a generous redaction looks like. The tight-bar case is pinned
    // separately below, because the default floor under-reports it.
    page.drawRectangle({ x: 36, y: 108, width: 220, height: 30, color: rgb(0, 0, 0) });
  }
  return doc.save();
}

// ─── the killer feature: text present but not visible ─────────────────────────

test('a PDF with text under an opaque bar reports it as present but not visible', async () => {
  const r = await inspectBytes(await buildRedactedPdf(), { path: 'case.pdf' });
  assert.equal(r.format, 'pdf');
  assert.ok(r.hiddenText, 'the hidden-text pass ran');
  assert.equal(r.hiddenText!.findings.length, 1);
  const f = r.hiddenText!.findings[0]!;
  assert.equal(f.text, SECRET, 'the words themselves are still in the file');
  assert.equal(f.page, 0);
  assert.ok(f.coverage > 0.85, `covered (${f.coverage})`);
  // Wording: an observation, never an accusation of intent.
  assert.match(r.hiddenText!.summary, /present in the file, not visible on the page/);
  assert.doesNotMatch(r.hiddenText!.summary, /redact|conceal|hid(e|ing)|cover-?up/i);
  assert.equal(hasShareRisk(r), true);
});

test('the same PDF without the bar reports nothing hidden', async () => {
  const r = await inspectBytes(await buildRedactedPdf({ cover: false }), { path: 'clean.pdf' });
  assert.equal(r.hiddenText!.findings.length, 0);
  assert.equal(r.hiddenText!.summary, '');
  assert.equal(hasShareRisk(r), false);
  // …and it still says the check is narrow, rather than implying the file is clean.
  assert.ok(r.limits.some((l) => /invisible render mode/.test(l)));
});

test('a bar that covers only the glyphs is UNDER-reported at the default floor', async () => {
  // Not a wish-list test: a pin on a real gap. `interpretPdfPage` gives one line of 12pt
  // text a 24pt-tall box, so a bar drawn tightly around the glyphs covers ~0.65 of it and
  // falls under the engine's 0.7 reporting floor. Somebody tuning either number should
  // see this fail rather than discover it on a leaked document. `minCoverage` is the
  // caller's lever until the geometry is reconciled upstream.
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([400, 200]);
  page.drawText(SECRET, { x: 40, y: 120, size: 12, font });
  page.drawRectangle({ x: 36, y: 114, width: 220, height: 20, color: rgb(0, 0, 0) });
  const bytes = await doc.save();

  const missed = await inspectBytes(bytes, { path: 'tight.pdf' });
  assert.equal(missed.hiddenText!.findings.length, 0, 'the default floor does not report it');

  const found = await inspectBytes(bytes, { path: 'tight.pdf', minCoverage: 0.6 });
  assert.equal(found.hiddenText!.findings.length, 1);
  assert.equal(found.hiddenText!.findings[0]!.text, SECRET);
});

test('the rendered report names the finding, quotes it, and refuses to guess why', async () => {
  const r = await inspectBytes(await buildRedactedPdf(), { path: 'case.pdf' });
  const out = renderInspection(r, { color: false });
  assert.match(out, /Text present in the file but not visible on the page/);
  assert.ok(out.includes(SECRET), 'the hidden text is quoted back so the user can judge it');
  assert.match(out, /A failed redaction and a layering/);
  assert.match(out, /page 1/);
});

// ─── PDF structure ────────────────────────────────────────────────────────────

test('PDF structure: pages, fonts, document info, extractable text', async () => {
  const r = await inspectBytes(await buildRedactedPdf({ title: 'Case file' }), { path: 'case.pdf', text: true });
  const p = r.pdf!;
  assert.equal(p.pageCount, 1);
  assert.equal(p.pagesScanned, 1);
  assert.equal(p.encrypted, false);
  assert.equal(p.info.title, 'Case file');
  assert.equal(p.info.author, 'Records Office');
  assert.deepEqual(p.pages[0]!.fonts, ['Helvetica']);
  assert.equal(p.pages[0]!.width, 400);
  assert.ok(p.pages[0]!.textChars > 0);
  assert.ok(p.text && p.text.includes('Alexandra Fitz'), 'the text a recipient can copy out');
});

test('the page cap is enforced AND reported, so nothing is claimed about unread pages', async () => {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 4; i++) {
    const pg = doc.addPage([200, 200]);
    pg.drawText(`page ${i + 1}`, { x: 20, y: 100, size: 12, font });
  }
  const r = await inspectBytes(await doc.save(), { path: 'many.pdf', maxPages: 2 });
  assert.equal(r.pdf!.pageCount, 4);
  assert.equal(r.pdf!.pagesScanned, 2);
  assert.ok(r.limits.some((l) => /Only 2 of 4 pages were examined/.test(l)), r.limits.join('\n'));
  assert.equal(r.hiddenText!.pagesScanned, 2);
});

// ─── metadata ─────────────────────────────────────────────────────────────────

test('an EXIF JPEG reports its GPS fix, flags it as a share risk, and offers a clean copy', async () => {
  const r = await inspectBytes(buildExifJpeg(), { path: 'photo.jpg' });
  assert.equal(r.format, 'jpg');
  const m = r.metadata!;
  assert.equal(m.format, 'JPEG');
  assert.ok(m.gps, 'GPS decoded');
  assert.equal(Math.round(m.gps!.lat * 1000) / 1000, 37.808);
  assert.ok(m.gps!.lon < 0, 'west of Greenwich');
  assert.ok(m.sensitiveCount > 0);
  assert.equal(m.strippable, true);
  assert.match(m.residual!, /APP1/, 'a strip pass has something real to remove');
  assert.equal(hasShareRisk(r), true);
  const out = renderInspection(r, { color: false });
  assert.match(out, /Location recorded/);
  assert.match(out, /37\.80833/);
});

test('bytes appended past a JPEG EOI are reported with their size and offset', async () => {
  const payload = Uint8Array.from('PK\u0003\u0004hidden-zip-payload'.split('').map((c) => c.charCodeAt(0)));
  const r = await inspectBytes(buildExifJpeg([payload]), { path: 'polyglot.jpg' });
  const a = r.metadata!.appended!;
  assert.equal(a.bytes, payload.length);
  assert.ok(a.offset > 0);
  assert.equal(hasShareRisk(r), true, 'undeclared appended bytes are a share risk');
  assert.match(renderInspection(r, { color: false }), /ride after the JPEG ends/);
});

// ─── credentials ──────────────────────────────────────────────────────────────

test('a genuinely signed file resolves to a credential state; an unsigned one to none', async () => {
  const svg = Uint8Array.from(
    '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="8" height="8" fill="#0c322c"/></svg>',
    (c) => c.charCodeAt(0) & 0xff,
  );
  const signed = await embedC2pa(svg, 'svg', { title: 'signed.svg', claimGenerator: 'Lolly lolly.tools' });

  const r = await inspectBytes(signed, { path: 'signed.svg', credential: {} });
  assert.ok(r.credential, 'the credential section is present when asked for');
  assert.ok(['lolly', 'trusted', 'valid'].includes(r.credential!.state), `state was ${r.credential!.state}`);
  assert.match(renderInspection(r, { color: false }), /Content Credentials/);

  const plain = await inspectBytes(svg, { path: 'plain.svg', credential: {} });
  assert.equal(plain.credential!.state, 'none');
  assert.match(renderInspection(plain, { color: false }), /No Content Credentials found/);
});

test('credentials are NOT checked unless asked - the caller decides who verifies', async () => {
  const r = await inspectBytes(buildExifJpeg(), { path: 'photo.jpg' });
  assert.equal(r.credential, null);
  assert.ok(!r.checked.some((c) => /Content Credentials/.test(c)));
});

// ─── degrade, don't crash ─────────────────────────────────────────────────────

test('a corrupt PDF degrades to fewer findings plus an error, and never throws', async () => {
  const junk = concat([
    Uint8Array.from('%PDF-1.7\n'.split('').map((c) => c.charCodeAt(0))),
    Uint8Array.from({ length: 512 }, (_, i) => (i * 37) % 256),
  ]);
  const r = await inspectBytes(junk, { path: 'broken.pdf' });
  assert.equal(r.format, 'pdf');
  assert.ok(r.errors.length > 0, 'the failure is reported, not swallowed');
  assert.equal(r.pdf!.pageCount, 0);
  assert.equal(r.hiddenText, null, 'no pages read means no hidden-text claim in either direction');
  assert.ok(r.limits.some((l) => /the hidden-text pass did not run/.test(l)));
  const out = renderInspection(r, { color: false });
  assert.match(out, /this report is incomplete/);
});

test('a truncated PDF (valid header, cut mid-body) is survivable too', async () => {
  const whole = await buildRedactedPdf();
  const r = await inspectBytes(whole.slice(0, Math.floor(whole.length / 2)), { path: 'cut.pdf' });
  assert.ok(r.errors.length > 0 || (r.pdf && r.pdf.pagesScanned < r.pdf.pageCount),
    'either it failed to load or it read fewer pages - both are honest');
  renderInspection(r, { color: false }); // must not throw
});

test('empty and tiny inputs are handled', async () => {
  for (const bytes of [new Uint8Array(0), Uint8Array.from([0x25, 0x50])]) {
    const r = await inspectBytes(bytes, { path: 'tiny' });
    assert.equal(r.pdf, null);
    assert.ok(r.limits.length > 0);
    renderInspection(r, { color: false });
  }
});

test('scanPdfPages itself never throws on rubbish', async () => {
  const scan = await scanPdfPages(Uint8Array.from([1, 2, 3, 4, 5]));
  assert.equal(scan.pageCount, 0);
  assert.equal(scan.pages.length, 0);
  assert.equal(scan.errors.length, 1);
});

// ─── the report cannot be forged by the file it describes ─────────────────────

test('control characters in file-supplied strings never reach the terminal', async () => {
  const evil = 'Quarterly \u001b[2K\u001b[31mVERIFIED BY LOLLY\u001b[0m report\u0007';
  const r = await inspectBytes(await buildRedactedPdf({ title: evil }), { path: 'evil.pdf' });
  assert.ok(r.pdf!.info.title!.includes('\u001b'), 'the raw value keeps the ESC - scrubbing is the RENDERER’s job');
  const out = renderInspection(r, { color: false });
  assert.ok(!out.includes('\u001b'), 'no escape sequence survives into the rendered report');
  assert.ok(!out.includes('\u0007'));
  assert.ok(out.includes('VERIFIED BY LOLLY'), 'the text is shown, defanged, not deleted');
  assert.match(out, /Quarterly {2}\[2K/, 'the ESC became a space; the rest of the payload is visible as text');
});

test('clean() strips C0 and C1 control characters and nothing else', () => {
  assert.equal(clean('a\u001bb\u0000c\u009fd'), 'a b c d');
  assert.equal(clean('héllo - ok ✓'), 'héllo - ok ✓');
});

// ─── the honesty contract ─────────────────────────────────────────────────────

test('every report states that it ran no invisible-watermark detection', async () => {
  for (const bytes of [buildExifJpeg(), await buildRedactedPdf(), new Uint8Array([0])]) {
    const r = await inspectBytes(bytes);
    const watermark = r.limits.find((l) => /watermark/i.test(l));
    assert.ok(watermark, 'the watermark limit is always stated');
    assert.match(watermark!, /SynthID is not detected by Lolly at all/);
    assert.equal(r.limits.at(-1), ABSENCE_CAVEAT);
  }
});

test('nothing anywhere claims to detect SynthID or an invisible watermark', async () => {
  const r = await inspectBytes(await buildRedactedPdf(), { path: 'case.pdf' });
  const out = renderInspection(r, { color: false });
  // The only permitted mention is the disclaimer that it is NOT detected.
  for (const line of out.split('\n').filter((l) => /synthid|watermark/i.test(l))) {
    assert.match(line, /not detected|need a browser/i, `unqualified watermark claim: ${line}`);
  }
});

test('the rendered report always ends with what was not checked', async () => {
  const out = renderInspection(await inspectBytes(buildExifJpeg()), { color: false });
  const lines = out.trimEnd().split('\n');
  assert.ok(out.includes('Not checked:'));
  assert.match(lines.at(-1)!, /Nothing found is not the same as nothing there/);
});

test('`checked` names each pass that ran, so "nothing found" has a scope', async () => {
  const r = await inspectBytes(await buildRedactedPdf(), { path: 'case.pdf' });
  assert.ok(r.checked.some((c) => /embedded metadata/.test(c)));
  assert.ok(r.checked.some((c) => /PDF structure and text \(1 of 1 page\)/.test(c)));
  assert.ok(r.checked.some((c) => /covered by an opaque shape/.test(c)));
});

test('a non-PDF says plainly that the PDF-only passes did not run', async () => {
  const r = await inspectBytes(buildExifJpeg(), { path: 'photo.jpg' });
  assert.ok(r.limits.some((l) => /run on PDF only.*This file is jpg/.test(l)), r.limits.join('\n'));
});

test('the result is JSON-serialisable, since --json emits it verbatim', async () => {
  const r = await inspectBytes(await buildRedactedPdf(), { path: 'case.pdf', text: true });
  const round = JSON.parse(JSON.stringify(r));
  assert.equal(round.hiddenText.findings[0].text, SECRET);
  assert.equal(round.pdf.info.title, 'Case file');
});
