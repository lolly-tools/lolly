// SPDX-License-Identifier: MPL-2.0
/**
 * Sign with a Content Credential in one step, and nothing else changed.
 *
 * `host.pdf.stamp` saves the compact form of a PDF, whose cross-reference is a stream,
 * and the C2PA embedder extends a classic table. Sign (in Pages, and the older Sign tool)
 * asks the stamp for the classic form when the credential is on (`classic: true`, engine
 * 1.360), so `host.c2pa.sign` attaches. `host.c2pa.sign` is the engine's embedder as on
 * main: Embed still hands back a PDF with a cross-reference stream unchanged. The last
 * tests pin that, so the scope of the change cannot widen by accident.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { deflateSync } from 'node:zlib';
import { PDFDocument, PDFName, PDFRawStream, StandardFonts, decodePDFRawStream } from 'pdf-lib';
import { embedC2pa, generateSigner } from '../engine/src/c2pa.ts';
import { verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createPdfAPI } from '../shells/web/src/bridge/pdf.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const load = (id: string): Promise<any> => loadTool(id, (path) => readFile(join(ROOT, 'community', path), 'utf8'));
const fileRef = (bytes: Uint8Array, name: string): any => ({ __file: true, url: null, name, mime: 'application/pdf', size: bytes.length, bytes });
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };

async function aPdf(useObjectStreams: boolean): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const page = doc.addPage([612, 792]);
  page.drawText('Agreement', { x: 72, y: 700, font: await doc.embedFont(StandardFonts.Helvetica), size: 24 });
  return doc.save({ useObjectStreams });
}

/** A real 2 by 1 PNG, for the drawn signature the test host hands back. */
function tinyPng(): Uint8Array {
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b: Uint8Array): number => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type: string, data: Uint8Array): Uint8Array => {
    const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
    const out = new Uint8Array(8 + data.length + 4);
    new DataView(out.buffer).setUint32(0, data.length); out.set(body, 4); new DataView(out.buffer).setUint32(8 + data.length, crc(body));
    return out;
  };
  const ihdr = new Uint8Array(13); new DataView(ihdr.buffer).setUint32(0, 2); new DataView(ihdr.buffer).setUint32(4, 1); ihdr.set([8, 2, 0, 0, 0], 8);
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(new Uint8Array([0, 20, 20, 20, 20, 20, 20]))), chunk('IEND', new Uint8Array())];
  return new Uint8Array(parts.flatMap((p) => [...p]));
}

/**
 * The real stamp, and `c2pa.sign` as the engine's embedder with nothing put before it,
 * which is what both shells' `host.c2pa.sign` come down to for a PDF.
 */
async function realHost(seen: { stampOpts: any[]; signed: number }): Promise<any> {
  const signer = await generateSigner(DATES);
  const pdf = createPdfAPI();
  return {
    version: '1', log: () => {}, profile: { get: async () => ({ useDetails: false }) },
    pdf: {
      ...pdf,
      pages: async () => ({ pages: [{ page: 1, widthPt: 612, heightPt: 792, svg: '<svg viewBox="0 0 612 792" />' }], totalPages: 1 }),
      stamp: async (bytes: Uint8Array, opts: any) => { seen.stampOpts.push(opts); return pdf.stamp!(bytes, opts); },
    },
    raster: {
      decode: async () => ({ width: 600, height: 180, close: () => {} }),
      encode: async () => ({ bytes: tinyPng(), mime: 'image/png', width: 600, height: 180 }),
    },
    c2pa: {
      sign: async (bytes: Uint8Array, format: string, opts: any) => { seen.signed++; return embedC2pa(bytes, format, { claimGenerator: 'Lolly', generatorInfo: { name: 'Lolly', version: 'test' }, title: opts.title, dates: DATES, signer }); },
      readIngredients: async () => [],
    },
  };
}

const lastXrefIsClassic = (bytes: Uint8Array): boolean => {
  const text = Buffer.from(bytes).toString('latin1');
  const at = Number([...text.matchAll(/startxref\s+(\d+)/g)].at(-1)![1]);
  return text.slice(at, at + 16).trimStart().startsWith('xref');
};

/** What is on page 1: how many pictures it draws, and its content as text. */
async function pageOne(bytes: Uint8Array): Promise<{ pictures: number; content: string }> {
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const page = doc.getPage(0);
  const xobjects = page.node.Resources()?.lookup(PDFName.of('XObject')) as any;
  let pictures = 0;
  for (const [, ref] of xobjects?.entries?.() ?? []) if (String((doc.context.lookup(ref) as any)?.dict?.get(PDFName.of('Subtype'))) === '/Image') pictures++;
  let content = '';
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (object instanceof PDFRawStream && !object.dict.has(PDFName.of('Subtype')) && !object.dict.has(PDFName.of('Type'))) {
      try { content += Buffer.from(decodePDFRawStream(object).decode()).toString('latin1'); } catch { /* not page content */ }
    }
  }
  return { pictures, content };
}
const hex = (text: string): string => Buffer.from(text, 'latin1').toString('hex').toUpperCase();

for (const [id, values] of [['pages', { operation: 'sign', signatureDate: true }], ['sign', { date: true }]] as const) {
  for (const useObjectStreams of [true, false]) {
    test(`${id}: one download signs a PDF ${useObjectStreams ? 'saved with object streams' : 'with a classic table'}, and the credential verifies`, async () => {
      const seen = { stampOpts: [] as any[], signed: 0 };
      const source = await aPdf(useObjectStreams);
      const runtime = await createRuntime(await load(id), await realHost(seen), { ...values, source: id === 'pages' ? [fileRef(source, 'agreement.pdf')] : fileRef(source, 'agreement.pdf'), signatureInk: 'M10,10L100,80', seal: true } as never);
      try {
        const result = await runtime.exportFile() as any;
        const signed = new Uint8Array(result.bytes);
        assert.equal(result.filename, 'agreement-signed.pdf');
        assert.equal(seen.signed, 1, 'the credential went on in the one download');
        assert.equal(seen.stampOpts.at(-1).classic, true, 'the stamp was asked for the classic form');
        assert.equal((await verifyC2pa(signed)).state, 'valid');
        // The visible signature and the date are on the page.
        const page = await pageOne(signed);
        assert.equal(page.pictures, 1, 'the drawn signature is a picture on page 1');
        const today = seen.stampOpts.at(-1).texts[0].text as string;
        assert.match(today, /^\d{4}-\d\d-\d\d$/);
        assert.ok(page.content.toUpperCase().includes(hex(today)) || page.content.includes(`(${today})`), 'the date is set on the page');
        assert.match(page.content, /Agreement|41677265656D656E74/i, 'the page still holds what it held');
      } finally { runtime.destroy(); }
    });
  }
}

test('with the credential off the stamp is saved as before, in the compact form', async () => {
  const seen = { stampOpts: [] as any[], signed: 0 };
  const runtime = await createRuntime(await load('pages'), await realHost(seen), { operation: 'sign', source: [fileRef(await aPdf(false), 'agreement.pdf')], signatureInk: 'M10,10L100,80', seal: false } as never);
  try {
    const result = await runtime.exportFile() as any;
    assert.equal(seen.signed, 0);
    assert.equal(seen.stampOpts.at(-1).classic, false);
    assert.equal(lastXrefIsClassic(new Uint8Array(result.bytes)), false, 'a cross-reference stream, as on main');
  } finally { runtime.destroy(); }
});

test('the stamp saves a classic table only when asked', async () => {
  const pdf = createPdfAPI();
  const source = await aPdf(true);
  const marks = { images: [], texts: [{ page: 1, text: 'signed', x: 72, y: 600, size: 12 }] };
  assert.equal(lastXrefIsClassic((await pdf.stamp!(source, marks)).bytes), false);
  assert.equal(lastXrefIsClassic((await pdf.stamp!(source, { ...marks, classic: false })).bytes), false);
  assert.equal(lastXrefIsClassic((await pdf.stamp!(source, { ...marks, classic: true })).bytes), true);
});

const cli = (args: string[], dir: string) => spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', ...args], {
  cwd: ROOT, encoding: 'utf8', env: { ...process.env, LOLLY_STATE_DIR: join(dir, 'state') }, timeout: 120_000,
});

test('the CLI signs an object-stream PDF with a credential in one run', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-sign-classic-'));
  try {
    const source = join(dir, 'agreement.pdf'), output = join(dir, 'signed.pdf');
    await writeFile(source, await aPdf(true));
    const run = cli(['pages', '--operation=sign', `--source=${source}`, '--signatureInk=M10,10L100,100', '--seal=true', `--output=${output}`], dir);
    assert.equal(run.status, 0, run.stderr);
    assert.equal((await verifyC2pa(new Uint8Array(await readFile(output)))).state, 'valid');
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('Embed is as on main: a PDF with a cross-reference stream comes back unchanged, and one with a classic table takes the credential', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-embed-scope-'));
  try {
    // host.c2pa.sign refuses the cross-reference stream, and Embed delivers the file as it came.
    const streamed = await aPdf(true);
    const source = join(dir, 'streamed.pdf'), output = join(dir, 'streamed-out.pdf');
    await writeFile(source, streamed);
    const refused = cli(['claim', `--files=${source}`, '--creator=Sam Rivera', `--output=${output}`], dir);
    assert.equal(refused.status, 0, refused.stderr);
    assert.match(refused.stderr + refused.stdout, /Could not stamp "streamed\.pdf" - C2PA embed: PDF uses a cross-reference stream \(PDF 1\.5\+\); cannot attach; delivering it unchanged/);
    assert.deepEqual(new Uint8Array(await readFile(output)), streamed, 'not one byte of the file changed');
    // A classic table is extended in place: the original bytes stay as the start of the file.
    const classic = await aPdf(false);
    const source2 = join(dir, 'classic.pdf'), output2 = join(dir, 'classic-out.pdf');
    await writeFile(source2, classic);
    assert.equal(cli(['claim', `--files=${source2}`, '--creator=Sam Rivera', `--output=${output2}`], dir).status, 0);
    const out = new Uint8Array(await readFile(output2));
    assert.equal((await verifyC2pa(out)).state, 'valid');
    assert.deepEqual(out.subarray(0, classic.length), classic);
  } finally { await rm(dir, { recursive: true, force: true }); }
});

test('neither shell saves a PDF again inside host.c2pa.sign', async () => {
  for (const file of ['shells/web/src/bridge/index.ts', 'shells/web/src/bridge/export.ts', 'shells/cli/src/bridge.ts']) {
    assert.doesNotMatch(await readFile(join(ROOT, file), 'utf8'), /pdf-classic|classicPdfForStamp/, file);
  }
});
