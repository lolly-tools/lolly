// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFStream, StandardFonts } from 'pdf-lib';
import { stripMetadata, hasResidualMetadata } from '../engine/src/strip-metadata.ts';
import { extractFileMetadata } from '../engine/src/file-metadata.ts';
import { softwareOrigins } from '../engine/src/software-origin.ts';
import { embedC2pa } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { stripPdf } from '../packages/node-shell/src/pdf.ts';
import { scanPdfPages } from '../packages/node-shell/src/pdf-pages.ts';
import { analyzeTextSignals } from '../engine/src/text-signals.ts';
import { humanizeText } from '../engine/src/humanize.ts';
import { forensicReport } from '../engine/src/forensic.ts';

const encoder = new TextEncoder();
const png = new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),
  chunk('IHDR', new Uint8Array([0,0,0,1,0,0,0,1,8,2,0,0,0])),
  chunk('IDAT', deflateSync(new Uint8Array([0,255,0,0]))), chunk('IEND', new Uint8Array())]));
interface UtilityHooks {
  onInit(context: unknown): Promise<{ nothingFound: boolean; findings: { label: string }[] }>;
  exportFile(context: unknown): Promise<{ bytes: Uint8Array }>;
}
const utility = new Function(readFileSync(new URL('../community/strip-data/hooks.js', import.meta.url), 'utf8') + '\nreturn {onInit, exportFile};')() as UtilityHooks;
const context = (bytes: Uint8Array, name: string) => ({ model: [{ id: 'source', value: { bytes, name, size: bytes.length } }], host: {} });
function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = Buffer.concat([Buffer.from(type), data]); let crc = 0xffffffff;
  for (const byte of body) { crc ^= byte; for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1; }
  const prefix = Buffer.alloc(4), suffix = Buffer.alloc(4); prefix.writeUInt32BE(data.length); suffix.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([prefix, body, suffix]);
}
const addChunk = (type: string, bytes: Uint8Array) => new Uint8Array(Buffer.concat([png.subarray(0, 33), chunk(type, bytes), png.subarray(33)]));

test('engine and shipping utility remove real PNG credentials and preserve decoded pixels', async () => {
  const source = await embedC2pa(png, 'png', { title: 'Private fixture', claimGenerator: 'Regression fixture', author: { name: 'Private client' } });
  assert.equal((await verifyC2pa(source)).found, true);
  assert.match(hasResidualMetadata(source, 'png')!, /caBX/);
  const report = await utility.onInit(context(source, 'credential.png'));
  assert.equal(report.nothingFound, false); assert.ok(report.findings.some(f => f.label === 'Content credentials'));
  const clean = stripMetadata(source, 'png');
  assert.deepEqual((await utility.exportFile(context(source, 'credential.png'))).bytes, clean);
  assert.deepEqual(clean, png); assert.equal((await verifyC2pa(clean)).found, false);
  const sharp = (await import('sharp')).default;
  assert.deepEqual(await sharp(clean).raw().toBuffer(), await sharp(png).raw().toBuffer());
});

test('SVG linked PNG and percent-encoded JPEG are cleaned inside artwork by both paths', async () => {
  const dirtyPng = await embedC2pa(addChunk('tEXt', encoder.encode('Author\0Private client')), 'png', { title: 'Private fixture', claimGenerator: 'Regression fixture' });
  const jpeg = new Uint8Array([255,216,255,254,0,9,...encoder.encode('Private'),255,218,0,8,1,1,0,0,63,0,42,255,217]);
  const encodedJpeg = Array.from(jpeg, byte => `%${byte.toString(16).padStart(2,'0')}`).join('');
  const source = encoder.encode(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="20" height="10" fill="red"/><image href="data&#58;image/png;base64,${Buffer.from(dirtyPng).toString('base64')}"/><image href='data:image/jpeg,${encodedJpeg}'/></svg>`);
  assert.ok(hasResidualMetadata(source, 'svg'));
  assert.ok((await utility.onInit(context(source, 'embedded.svg'))).findings.some(f => f.label === 'Embedded Content credentials'));
  const clean = stripMetadata(source, 'svg'); assert.equal(hasResidualMetadata(clean, 'svg'), null);
  assert.deepEqual((await utility.exportFile(context(source, 'embedded.svg'))).bytes, clean);
  const text = new TextDecoder().decode(clean); assert.ok(text.includes('<rect width="20" height="10" fill="red"/>'));
  const images = [...text.matchAll(/data:image\/(png|jpeg);base64,([^"']+)/g)]; assert.equal(images.length, 2);
  assert.deepEqual(new Uint8Array(Buffer.from(images[0]![2]!, 'base64')), png);
  assert.deepEqual(new Uint8Array(Buffer.from(images[1]![2]!, 'base64')), stripMetadata(jpeg, 'jpeg'));
});

test('invalid embedded image and aggregate image budget fail without a clean download', async () => {
  for (const text of ['<svg><image href="data:image/png;base64,AA=="/></svg>', '<svg>' + ('<image href="data:image/png;base64,' + Buffer.from(png).toString('base64') + '"/>').repeat(129) + '</svg>']) {
    const source = encoder.encode(text);
    assert.throws(() => stripMetadata(source, 'svg'), /embedded|Embedded/);
    await assert.rejects(utility.exportFile(context(source, 'invalid.svg')), /embedded|Embedded/);
  }
});

test('PDF rewrite purges orphaned and page XMP while retaining pages, fonts and attachments', async () => {
  const document = await PDFDocument.create(); const page = document.addPage([240,160]);
  page.drawText('Visible artwork', { font: await document.embedFont(StandardFonts.Helvetica), x: 20, y: 60 });
  document.setAuthor('Private author'); document.setTitle('Private title');
  const metadata = () => document.context.register(document.context.stream(encoder.encode('Private XMP packet'), { Type: 'Metadata', Subtype: 'XML' }));
  document.catalog.set(PDFName.of('Metadata'), metadata()); page.node.set(PDFName.of('Metadata'), metadata());
  metadata(); await document.attach(encoder.encode('Retained attachment'), 'notes.txt');
  const clean = (await stripPdf(await document.save({ useObjectStreams: false }))).bytes;
  const restored = await PDFDocument.load(clean, { updateMetadata: false });
  assert.equal(restored.context.trailerInfo.Info, undefined);
  assert.equal(restored.getAuthor(), undefined); assert.equal(restored.getTitle(), undefined);
  assert.equal(restored.catalog.has(PDFName.of('Metadata')), false);
  assert.equal(restored.getPages()[0]!.node.has(PDFName.of('Metadata')), false);
  assert.deepEqual(restored.getPages().map(p => p.getSize()), [{ width: 240, height: 160 }]);
  assert.ok(restored.getPages()[0]!.node.Resources()); assert.ok(restored.catalog.has(PDFName.of('Names')));
  for (const [, object] of restored.context.enumerateIndirectObjects()) if (object instanceof PDFStream)
    assert.equal(Buffer.from(object.getContents()).includes(Buffer.from('Private XMP packet')), false);
  assert.equal(Buffer.from(clean).includes(Buffer.from('Private XMP packet')), false);
  assert.ok((await scanPdfPages(clean)).pages[0]!.nodes.some(node => node.kind === 'text' && node.text === 'Visible artwork'));
});

test('PNG compressed generator fields are unsigned hints and narrative mentions stay descriptions', () => {
  for (const [keyword, value, expected] of [
    ['Creator','ChatGPT','ChatGPT'], ['parameters','Steps: 20, Sampler: DPM++, Model: SDXL base 1.0','Stable Diffusion'],
    ['Comment','An article discussing ChatGPT',null], ['parameters','Prompt: discuss SDXL and ChatGPT',null],
    ['Creator','Alice who writes about ChatGPT',null],
  ] as const) {
    const source = addChunk('zTXt', Buffer.concat([Buffer.from(keyword + '\0'), Buffer.from([0]), deflateSync(Buffer.from(value))]));
    const metadata = extractFileMetadata(source), origins = softwareOrigins(metadata.fields);
    assert.equal(origins[0]?.name ?? null, expected); assert.equal(metadata.ai, undefined);
    if (expected) assert.equal(origins[0]!.evidence[0]!.kind, 'hint');
  }
});

test('Unicode orthography and emoji retain zero forensic evidence and survive cleanup', async () => {
  for (const text of ['\u{1f3f4}\u{e0067}\u{e0062}\u{e0073}\u{e0063}\u{e0074}\u{e007f}', '葛\u{e0100}', 'ಕ್\u200dಷ', 'می\u200cروم', '👩🏽‍💻', '\ue000', 'ᠠ\u180b']) {
    assert.equal(analyzeTextSignals(text, { source:'digital' }).score, 0, text);
    assert.equal(humanizeText(text).text, text);
    const report = await forensicReport(encoder.encode(text), [{ id:'1',width:0,height:0,text,source:'digital',complete:true,lines:[],shapes:[] }], [], [], [], [], 'text');
    assert.equal(report.evidence.score, 0); assert.equal(report.likelihood.state, 'unavailable');
  }
});

test('unexpected Unicode carriers retain exact UTF-16 spans and are cleaned contextually', () => {
  for (const char of ['\ufe0f','\u034f','\u3164','\u2065','\u{e0080}','\ufdd0','\u200d','\u{e0061}']) {
    const text = '😀a' + char + 'b', report = analyzeTextSignals(text, { source:'digital' });
    assert.ok(report.findings.some(f => f.tier === 'artifact' && f.spans?.some(span => span.index === 3 && text.slice(span.index,span.index+span.length) === char)));
    assert.equal(humanizeText(text).text, '😀ab');
  }
});

test('dense mixed Unicode carriers clean completely and remain idempotent', () => {
  const source = '😀a\u200b\u{e0061}\ufe0fb'.repeat(4096), expected = '😀ab'.repeat(4096);
  const clean = humanizeText(source);
  assert.equal(clean.text, expected);
  assert.equal(clean.changes.filter(change => ['invisible', 'tag-char', 'variation'].includes(change.kind)).reduce((count, change) => count + change.count, 0), 3 * 4096);
  assert.deepEqual(humanizeText(clean.text), { text: expected, changes: [] });
});
