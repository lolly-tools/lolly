// SPDX-License-Identifier: MPL-2.0
/** The shared finishing pass preserves PDF-X identity and AES encrypt-last ordering. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDecipheriv, createHash } from 'node:crypto';
import { PDFDocument, PDFName, PDFDict, PDFHexString, PDFRawStream, PDFArray, decodePDFRawStream } from 'pdf-lib';
import { preparePassword, hashR6 } from '../engine/src/pdf-crypto-r6.ts';
import { extractC2paStore } from '@lolly/engine';
import { applyPdfX } from '../packages/node-shell/src/pdfx.ts';
import { applyPdfX as webApplyPdfX } from '../shells/web/src/bridge/export-pdfx.ts';
import { finishPdfX, encryptPdfStrong, provenanceLabels, drawPrintMarks, printGeometryForSize, labelsBeyondStandardFont } from '../packages/node-shell/src/pdf-finishing.ts';
import type { LabelPictureFn } from '../packages/node-shell/src/pdf-finishing.ts';

test('the web PDF-X facade uses the same implementation as Node', () => {
  assert.equal(webApplyPdfX, applyPdfX);
});

test('AES encrypts already-finished strings and metadata; decrypting them recovers the original producer and withheld PDF-X claim', async () => {
  const original = await PDFDocument.create();
  original.addPage([120, 80]);
  original.setTitle('Encrypted proof');
  // A previously claimed file must not carry that claim into an encrypted derivative.
  await applyPdfX(original, { meta: { software: 'Old writer', tool: 'Design' } }, 'srgb');
  const oldInfo = original.context.lookup(original.context.trailerInfo.Info, PDFDict);
  assert.ok(oldInfo.get(PDFName.of('GTS_PDFXVersion')));
  const password = 'test open password';
  const finished = await finishPdfX(await original.save(), {
    strongPassword: password, c2pa: true,
    meta: { software: 'Lolly', source: 'https://lolly.tools', tool: 'Design', author: '', contact: '', description: '' },
  });
  const encrypted = new Uint8Array(await (await encryptPdfStrong(finished, password)).arrayBuffer());
  assert.equal(extractC2paStore(encrypted), null, 'an encrypted document has no C2PA update');
  const doc = await PDFDocument.load(encrypted, { ignoreEncryption: true, updateMetadata: false });
  const enc = doc.context.lookup(doc.context.trailerInfo.Encrypt, PDFDict);
  assert.equal(String(enc.get(PDFName.of('V'))), '5');
  assert.equal(String(enc.get(PDFName.of('R'))), '6');
  const cf = enc.lookup(PDFName.of('CF'), PDFDict).lookup(PDFName.of('StdCF'), PDFDict);
  assert.equal(String(cf.get(PDFName.of('CFM'))), '/AESV3');
  const user = enc.lookup(PDFName.of('U'), PDFHexString).asBytes();
  const keyHash = await hashR6(preparePassword(password), user.subarray(40, 48));
  const wrappedKey = enc.lookup(PDFName.of('UE'), PDFHexString).asBytes();
  const keyCipher = createDecipheriv('aes-256-cbc', keyHash, new Uint8Array(16));
  keyCipher.setAutoPadding(false);
  const key = Buffer.concat([keyCipher.update(wrappedKey), keyCipher.final()]);
  const decrypt = (bytes: Uint8Array): Buffer => {
    const cipher = createDecipheriv('aes-256-cbc', key, bytes.subarray(0, 16));
    return Buffer.concat([cipher.update(bytes.subarray(16)), cipher.final()]);
  };
  const text = (bytes: Uint8Array): string => PDFHexString.of(decrypt(bytes).toString('hex')).decodeText();
  const info = doc.context.lookup(doc.context.trailerInfo.Info, PDFDict);
  assert.equal(text(info.lookup(PDFName.of('Producer'), PDFHexString).asBytes()), 'Lolly');
  assert.equal(text(info.lookup(PDFName.of('Title'), PDFHexString).asBytes()), 'Encrypted proof');
  assert.equal(info.get(PDFName.of('GTS_PDFXVersion')), undefined);
  const metadata = doc.catalog.lookup(PDFName.of('Metadata'));
  assert.ok(metadata instanceof PDFRawStream);
  const xml = decrypt(metadata.getContents()).toString('utf8');
  assert.match(xml, /<pdf:Producer>Lolly<\/pdf:Producer>/);
  assert.doesNotMatch(xml, /GTS_PDFXVersion/);
  assert.equal(doc.catalog.lookup(PDFName.of('OutputIntents'), PDFArray).size(), 1);
});

// The proof credit follows the description's rule (plans/319, decision 6): the tool's
// name gains the colourway's when the export records one, and never the design
// system's label; with no record the credit is the line it always was.
test('provenanceLabels: the proof credit gives the colourway beside the tool, never the design system', () => {
  const base = { software: 'Lolly', source: 'https://lolly.tools', tool: 'Chart', author: 'Andy Fitzsimon', contact: '', description: '' };
  const plain = provenanceLabels(base)!;
  assert.equal(plain.bottomLeftUp, 'Chart by Andy Fitzsimon');
  assert.equal(plain.topRight, 'Made with https://lolly.tools');
  const recorded = provenanceLabels({
    ...base, designSystem: { id: 'acme', label: 'Acme' },
    themes: [{ group: 'colourway', kind: 'colourway', id: 'persimmon', name: 'Persimmon' }],
  })!;
  assert.equal(recorded.bottomLeftUp, 'Chart (Persimmon colourway) by Andy Fitzsimon');
  assert.equal(JSON.stringify(recorded).includes('Acme'), false);
  // A non-colourway choice is in the record only; the credit keeps its plain form.
  assert.equal(provenanceLabels({ ...base, themes: [{ group: 'density', id: 'roomy', name: 'Roomy' }] })!.bottomLeftUp, 'Chart by Andy Fitzsimon');
  assert.equal(provenanceLabels({ ...base, tool: '' })!.bottomLeftUp, '', 'no tool name, no credit');
});

// ── Print mark labels beyond the mark font ──────────────────────────────────────
// The labels are set in Helvetica, whose encoding is WinAnsi. A name in Arabic,
// Chinese or Cyrillic, or with an emoji, used to stop the export inside pdf-lib with
// "WinAnsi cannot encode". Such a label is now a picture the shell makes, painted in
// the label's own ink; a label the font can set keeps the bytes it had.

const MARK_OPTS = { provenance: true, cropMarks: true, bleed: '3mm' };
const LATIN_LABELS = { topLeft: '2026-11-06 10:00', topRight: 'Made with https://lolly.tools', bottomLeftUp: 'Poster by José Núñez – “Café”' };

async function markedPage(space: 'rgb' | 'cmyk', labels: Record<string, string>, labelPicture?: LabelPictureFn) {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const geo = printGeometryForSize(400, 300, MARK_OPTS, undefined)!;
  const page = doc.addPage([geo.page.w, geo.page.h]);
  await drawPrintMarks(page, geo, { space, labels, labelPicture });
  const bytes = await doc.save({ useObjectStreams: false });
  const back = await PDFDocument.load(bytes, { updateMetadata: false });
  const contents = back.getPage(0).node.Contents();
  const streams = contents instanceof PDFArray ? contents.asArray().map((r) => back.context.lookup(r)) : [contents];
  const ops = streams.map((s) => Buffer.from(decodePDFRawStream(s as PDFRawStream).decode()).toString('latin1')).join('\n');
  return { geo, bytes, back, ops };
}

test('print mark labels the mark font can set keep their bytes', async () => {
  // Saved by main before this change, from the same page and labels.
  const golden = {
    rgb: '64d73840d9d28db9aeb327117bba76230bfd495338e9ccecac16568ccf772e5f',
    cmyk: '74a1e2a0e1bb7a2d8ada0c07a78573eea7a4bd1064d05d58f0a27050d19d077f',
  };
  let asked = 0;
  for (const space of ['rgb', 'cmyk'] as const) {
    const { bytes } = await markedPage(space, LATIN_LABELS, async () => { asked++; return null; });
    assert.equal(createHash('sha256').update(bytes).digest('hex'), golden[space], space);
  }
  assert.equal(asked, 0, 'no picture is asked for');
});

test('labelsBeyondStandardFont lists the labels the mark font cannot set', async () => {
  assert.deepEqual(await labelsBeyondStandardFont(LATIN_LABELS), []);
  assert.deepEqual(await labelsBeyondStandardFont(null), []);
  for (const name of ['مايا ليندكفيست', '林美雅', 'Мария Иванова', 'Maya 🎨']) {
    assert.deepEqual(await labelsBeyondStandardFont({ ...LATIN_LABELS, bottomLeftUp: `Poster by ${name}` }), [`Poster by ${name}`]);
  }
});

test('a label the mark font cannot set, with no picture to draw instead, says what to do', async () => {
  await assert.rejects(markedPage('rgb', { ...LATIN_LABELS, bottomLeftUp: 'Poster by 林美雅' }),
    (e: Error) => /cannot draw "Poster by 林美雅" in its print marks/.test(e.message) && !/WinAnsi/.test(e.message));
});

test('a label the mark font cannot set is a picture in the label\'s own ink, on its anchor', async () => {
  // A stand-in picture, 40 x 12 pixels over 20 x 6 points, the words starting 1 pt in.
  const pic = { coverage: new Uint8Array(40 * 12).fill(200), width: 40, height: 12, w: 20, h: 6, left: 1, advance: 18, baseline: 4.5 };
  const asked: Array<[string, number]> = [];
  const labels = { ...LATIN_LABELS, topRight: 'Made with 雨', bottomLeftUp: 'Poster by مايا' };
  for (const space of ['rgb', 'cmyk'] as const) {
    asked.length = 0;
    const { geo, back, ops } = await markedPage(space, labels, async (text, size) => { asked.push([text, size]); return pic; });
    assert.deepEqual(asked.map(([t]) => t), ['Made with 雨', 'Poster by مايا'], 'the date is still set as text');
    assert.ok(asked.every(([, size]) => size === 6));
    const xobjects = back.getPage(0).node.Resources()!.lookup(PDFName.of('XObject'), PDFDict);
    const images = xobjects.keys().map((k) => back.context.lookup(xobjects.get(k)) as PDFRawStream);
    assert.equal(images.length, 2);
    for (const image of images) {
      assert.equal(String(image.dict.get(PDFName.of('ColorSpace'))), space === 'cmyk' ? '/DeviceCMYK' : '/DeviceRGB');
      const ink = decodePDFRawStream(image).decode();
      assert.deepEqual([...ink.subarray(0, space === 'cmyk' ? 4 : 3)], space === 'cmyk' ? [0, 0, 0, 179] : [89, 89, 89], 'the ink a set label takes');
      const mask = back.context.lookup(image.dict.get(PDFName.of('SMask'))) as PDFRawStream;
      assert.equal(String(mask.dict.get(PDFName.of('ColorSpace'))), '/DeviceGray');
      assert.deepEqual(decodePDFRawStream(mask).decode(), pic.coverage, 'the words\' coverage is the mask');
    }
    assert.equal((ops.match(/ Tj/g) ?? []).length, 1, 'one label set as text');
    const at = (slot: string) => geo.primitives.labels.find((l) => l.slot === slot)!;
    const fy = (y: number) => geo.page.h - y;
    const cms = [...ops.matchAll(/([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) ([-\d.]+) cm\s+\/Label-\d+ Do/g)].map((m) => m.slice(1).map(Number));
    assert.equal(cms.length, 2);
    // Right-aligned and level: the words end on the anchor, the baseline on its line.
    const right = at('topRight');
    assert.deepEqual(cms[0]!.map((v) => +v.toFixed(3)), [20, 0, 0, 6, +(right.x - pic.advance - pic.left).toFixed(3), +(fy(right.y) - (pic.h - pic.baseline)).toFixed(3)]);
    // Turned a quarter, reading up: the picture turns about the anchor on its baseline.
    const up = at('bottomLeftUp');
    assert.deepEqual(cms[1]!.map((v) => +v.toFixed(3)), [0, 20, -6, 0, +(up.x + (pic.h - pic.baseline)).toFixed(3), +(fy(up.y) - pic.left).toFixed(3)]);
  }
});
