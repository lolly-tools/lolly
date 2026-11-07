// SPDX-License-Identifier: MPL-2.0
/**
 * What `lolly_render`'s `c2pa` argument does to the file, read back from real bytes.
 *
 * The rule: an explicit "off" means the file holds no Content Credential, on every
 * format the argument reaches, and a number means this server's credential with that
 * lifetime. Either way the result states what the file holds, and any gap between that
 * and what was asked. With no `c2pa` and no intent nothing here changes the file by a
 * byte.
 *
 * Runs with nothing but node: the browser tier's bytes are built here with the same
 * library and the same embedder it uses. credential-setting.browser.test.ts holds the same
 * facts against a real web shell.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { embedC2pa, exportActionSteps, extractC2paStore, gzip, prepareC2paIngredientFromStore, verifyC2pa, CAPTURE_SOURCE_TYPE, GENERATED_SOURCE_TYPE } from '../../../engine/src/index.ts';
import { buildExportC2paOpts } from '../../../packages/node-shell/src/c2pa-opts.ts';
import { credentialAndRecord, credentialText, exportUrl, render } from '../src/render.ts';
import type { CredentialReadback, RenderOpts } from '../src/render.ts';
import { dispatch } from '../src/server.ts';
import type { JsonRpcResponse } from '../src/protocol.ts';

interface Result { isError?: boolean; content: Array<{ type: string; text?: string; data?: string; resource?: { blob?: string; text?: string } }> }

let nextId = 77_000;
async function call(name: string, args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, `protocol error: ${JSON.stringify(res?.error)}`);
  return res.result as Result;
}
function fileOf(result: Result): Buffer {
  const resource = result.content.find((c) => c.type === 'resource')?.resource;
  if (resource?.text !== undefined) return Buffer.from(resource.text);
  if (resource?.blob !== undefined) return Buffer.from(resource.blob, 'base64');
  const image = result.content.find((c) => c.type === 'image');
  assert.ok(image?.data, JSON.stringify(result.content.map((c) => c.type)));
  return Buffer.from(image.data, 'base64');
}
const lifetimeDays = (signer: { notBefore: string; notAfter: string } | undefined): number | null =>
  signer ? Math.round((Date.parse(signer.notAfter) - Date.parse(signer.notBefore)) / 86_400_000) : null;

const URL_OF = (fmt: string, o: RenderOpts, query = 'firstname=Sam'): URLSearchParams => {
  const url = exportUrl('http://shell.test', 'certificate', query, fmt, o);
  return new URLSearchParams(url.slice(url.indexOf('?') + 1));
};

test('with no c2pa and no intent, the address the browser opens does not change', () => {
  for (const fmt of ['pdf', 'png', 'svg', 'pdf-cmyk', 'mp4']) {
    const expected = `http://shell.test/#/tool/certificate?firstname=Sam&format=${fmt}&export=1`;
    assert.equal(exportUrl('http://shell.test', 'certificate', 'firstname=Sam', fmt, {}), expected);
    assert.equal(exportUrl('http://shell.test', 'certificate', 'firstname=Sam', fmt, { c2pa: null }), expected);
  }
});

test('"off" reaches the browser on every format, and with a lifetime the browser stamps first', () => {
  for (const fmt of ['pdf', 'pdf-cmyk', 'png', 'svg', 'jpg', 'webp', 'mp4', 'tiff']) {
    assert.equal(URL_OF(fmt, { c2pa: { on: false, days: null } }).get('c2pa'), 'off', fmt);
  }
  // This server's stamp takes the place of the browser's, whose record of the placed pictures
  // and songs it reads first, so the browser stamps on every format, a PDF included.
  for (const fmt of ['pdf', 'pdf-cmyk', 'png', 'svg', 'jpg', 'webp', 'mp4']) assert.equal(URL_OF(fmt, { c2pa: { on: true, days: 90 } }).get('c2pa'), '1', fmt);
  // A TIFF keeps a replaced credential as a second one, so there the browser writes none, and an
  // `off` that is not the caller's leaves inlined artwork alone.
  // A format this server cannot stamp keeps the web shell's own default, as it always did.
  assert.equal(URL_OF('pptx', { c2pa: { on: true, days: 90 } }).get('c2pa'), null);
  for (const fmt of ['tiff', 'cmyk-tiff']) {
    const p = URL_OF(fmt, { c2pa: { on: true, days: 90 } });
    assert.equal(p.get('c2pa'), 'off', fmt);
    assert.equal(p.get('_keepinlinedc2pa'), '1', fmt);
  }
  // A sample set is never stamped here, so the browser has to take the setting as given.
  assert.equal(URL_OF('pdf', { c2pa: { on: true, days: 90 } }, 'cuts=3').get('c2pa'), '90');
  assert.equal(URL_OF('png', { c2pa: { on: true, days: 90 } }, 'cuts=3').get('c2pa'), '90');
  assert.equal(URL_OF('png', { c2pa: { on: false, days: null } }, 'cuts=3').get('c2pa'), 'off');
  assert.equal(URL_OF('png', {}, 'cuts=3').get('c2pa'), 'off', 'as it always was');
});

// ── Files as the browser tier hands them back ────────────────────────────────

const MANIFEST = { id: 'certificate', name: 'Certificate', version: '1.0.0', inputs: [], render: { width: 100, height: 100, formats: ['pdf', 'svg', 'png'] } };
const stampedBy = (surface: string, format: string, days: number) => {
  const opts = buildExportC2paOpts({ surface: 'cli', manifest: MANIFEST, model: [], format, days });
  return { ...opts, environment: { ...(opts.environment as Record<string, unknown>), surface } };
};
const finish = (bytes: Uint8Array, format: string, merged: RenderOpts, tier = 'B', warnings: string[] = [], deliveredFormat = format) =>
  credentialAndRecord({ bytes, tier }, { fmt: format, exportFmt: format, deliveredFormat, manifest: MANIFEST as never, values: {}, merged, placed: [], recorded: null, sampled: false, warnings });

const LOGO = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="#ff0000"/></svg>';
const RDF = '<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Kept</dc:title></rdf:Description></rdf:RDF>';
/** An SVG the walker wrote: its own metadata, and an inlined logo that carries the logo's own credential. */
async function svgWithCredentialedLogo(): Promise<Uint8Array> {
  const logo = Buffer.from(await embedC2pa(new TextEncoder().encode(LOGO), 'svg', stampedBy('lolly.tools/catalog', 'svg', 800))).toString();
  assert.match(logo, /<c2pa:manifest>/);
  return new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Certificate</title><metadata>${RDF}</metadata>${logo}<text>Ana Kovač</text></svg>`);
}
/** A PDF saved as the browser saves one when told not to stamp: object streams, no classic table. */
async function pdfWithObjectStreams(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 100]);
  doc.setTitle('Certificate');
  return doc.save({ useObjectStreams: true });
}
/** A PDF as the browser saves one when it does stamp. */
async function browserStampedPdf(days = 30): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 100]);
  doc.setTitle('Certificate');
  return embedC2pa(await doc.save({ useObjectStreams: false }), 'pdf', stampedBy('web', 'pdf', days));
}

test('with no c2pa and no intent the finished file is the very bytes the export handed over', async () => {
  const files: Array<[string, Uint8Array]> = [
    ['svg', await svgWithCredentialedLogo()],
    ['pdf', await browserStampedPdf()],
    ['pdf', await pdfWithObjectStreams()],
  ];
  for (const [format, bytes] of files) {
    const before = Buffer.from(bytes);
    for (const c2pa of [undefined, null]) {
      const warnings: string[] = [];
      const out = await finish(bytes, format, { c2pa }, 'B', warnings);
      assert.equal(out.bytes, bytes, 'not a copy, the same bytes');
      assert.deepEqual(Buffer.from(out.bytes), before);
      assert.equal(out.credential, undefined);
      assert.deepEqual(warnings, []);
    }
  }
});

test('the public GET route, which forces c2pa off for its own reasons, keeps its bytes and is told nothing', async () => {
  const bytes = await svgWithCredentialedLogo();
  const out = await finish(bytes, 'svg', { c2pa: { on: false, days: null } }, 'A');
  assert.equal(out.bytes, bytes);
  assert.equal(out.credential, undefined);
});

test('an inlined logo\'s own credential reads as the file\'s, so "off" takes it out and nothing else', async () => {
  const bytes = await svgWithCredentialedLogo();
  assert.equal((await verifyC2pa(bytes)).state, 'invalid', 'the verifier finds it, and it cannot match this file');
  const warnings: string[] = [];
  const out = await finish(bytes, 'svg', { c2pa: { on: false, days: null }, c2paAsked: true }, 'B', warnings);
  const text = Buffer.from(out.bytes).toString();
  assert.equal((await verifyC2pa(out.bytes)).state, 'none');
  assert.equal(text.includes('c2pa'), false, text);
  assert.deepEqual(warnings, []);
  assert.deepEqual(out.credential, { asked: 'off', holds: 'none', days: null, selfSigned: false });
  // Everything that is not the credential is byte for byte where it was.
  const expected = Buffer.from(bytes).toString()
    .replace(/<c2pa:manifest>[^<]*<\/c2pa:manifest>/, '')
    .replace(/ xmlns:c2pa="[^"]*"/, '')
    .replace('<metadata></metadata>', '');
  assert.equal(text.replace('<metadata></metadata>', ''), expected);
  for (const kept of ['<title>Certificate</title>', '<dc:title>Kept</dc:title>', '<rect width="10"', '<text>Ana Kovač</text>']) assert.ok(text.includes(kept), kept);
});

test('a lifetime on an SVG goes where a reader looks: the root\'s metadata, and the inlined logo keeps its own credential', async () => {
  const before = await svgWithCredentialedLogo();
  const logoManifest = /<c2pa:manifest[^>]*>[^<]*<\/c2pa:manifest>/.exec(Buffer.from(before).toString())![0];
  const out = await finish(before, 'svg', { c2pa: { on: true, days: 90 }, c2paAsked: true });
  const text = Buffer.from(out.bytes).toString();
  assert.equal(text.match(/<c2pa:manifest/g)?.length, 2, 'this server\'s credential and the logo\'s');
  assert.ok(text.indexOf('<c2pa:manifest') < text.indexOf('<rect'), 'ahead of the inlined artwork');
  assert.ok(text.includes(logoManifest), 'the logo\'s, byte for byte');
  assert.ok(text.indexOf(logoManifest) > text.indexOf('<svg', 1), 'inside the logo\'s own markup');
  assert.equal(/<metadata>\s*<c2pa:manifest/.test(text), true, text.slice(0, 300));
  assert.deepEqual(out.credential, { asked: 90, holds: 'valid', days: 90, selfSigned: true });
  assert.ok(text.includes('<dc:title>Kept</dc:title>'));
  const report = await verifyC2pa(out.bytes);
  assert.equal((report.environment as Record<string, unknown>).surface, 'mcp');
  if (spawnSync('c2patool', ['--version']).status === 0) {
    const dir = mkdtempSync(join(tmpdir(), 'lolly-credential-setting-'));
    try {
      const path = join(dir, 'out.svg');
      writeFileSync(path, out.bytes);
      assert.match(execFileSync('c2patool', [path], { encoding: 'utf8' }), /active_manifest/, 'and c2patool reads it there');
    } finally { rmSync(dir, { recursive: true, force: true }); }
  }
});

test('a lifetime on a PDF the browser left unstamped works, for every lifetime', async () => {
  for (const days of [7, 30, 90, 365]) {
    const warnings: string[] = [];
    const out = await finish(await pdfWithObjectStreams(), 'pdf', { c2pa: { on: true, days }, c2paAsked: true }, 'B', warnings);
    assert.deepEqual(warnings, []);
    const report = await verifyC2pa(out.bytes);
    assert.equal(report.state, 'valid');
    assert.equal((report.environment as Record<string, unknown>).surface, 'mcp');
    assert.equal(lifetimeDays(report.signer), days);
    assert.deepEqual(out.credential, { asked: days, holds: 'valid', days, selfSigned: true });
    assert.equal((await PDFDocument.load(out.bytes, { updateMetadata: false })).getTitle(), 'Certificate', 'the metadata stays');
  }
});

test('when a web shell stamps anyway, the result does not pretend otherwise', async () => {
  // Off, and the file still holds one: a shell that does not read `c2pa=off`, or a tool that signs for itself.
  const stamped = await browserStampedPdf();
  const off = await finish(stamped, 'pdf', { c2pa: { on: false, days: null }, c2paAsked: true });
  assert.equal(off.credential?.holds, 'valid');
  assert.match(credentialText(off.credential), /c2pa: "off" could not be honoured\. This file still holds a credential\./);
  // A lifetime over the browser's own: its update comes off and this server's goes on, once.
  const warnings: string[] = [];
  const browser = await browserStampedPdf(30);
  const days = await finish(browser, 'pdf', { c2pa: { on: true, days: 90 }, c2paAsked: true }, 'B', warnings);
  assert.deepEqual(warnings, []);
  assert.deepEqual(days.credential, { asked: 90, holds: 'valid', days: 90, selfSigned: true });
  assert.equal((((await verifyC2pa(days.bytes)).environment) as Record<string, unknown>).surface, 'mcp');
  const count = (bytes: Uint8Array) => Buffer.from(bytes).toString('latin1').split('/AFRelationship /C2PA_Manifest').length - 1;
  assert.equal(count(days.bytes), 1, 'one credential, and no dead copy of the browser\'s');
  assert.equal((await PDFDocument.load(days.bytes, { updateMetadata: false })).getTitle(), 'Certificate');
});

// ── The pictures the browser recorded ────────────────────────────────────────

/** A placed picture with a credential of its own, as the browser carries one: its manifests, a component. */
async function placedPicture(title: string, sourceType: string) {
  const picture = await embedC2pa(PNG_1PX, 'png', { title, claimGenerator: 'Camera or generator', actions: [{ action: 'c2pa.created', digitalSourceType: sourceType }] });
  const found = extractC2paStore(picture)!;
  return { ...prepareC2paIngredientFromStore(found.store, found.format)!, relationship: 'componentOf' };
}
/** A file the browser stamped holding an uploaded photo and a picture declared AI-made. */
async function browserStampedWithPictures(bytes: Uint8Array, format: string): Promise<Uint8Array> {
  const opts = buildExportC2paOpts({ surface: 'cli', manifest: MANIFEST, model: [], format, days: 30 });
  const aiIngredients = [{ name: 'Generated sky', kind: 'full' as const }];
  return embedC2pa(bytes, format, {
    ...opts, environment: { ...(opts.environment as Record<string, unknown>), surface: 'web' },
    actions: exportActionSteps(format, { aiIngredients }), aiDisclosure: {},
    ingredients: [await placedPicture('Harbour photo', CAPTURE_SOURCE_TYPE), await placedPicture('Generated sky', GENERATED_SOURCE_TYPE)],
  });
}
const PNG_1PX = Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64'));

test('a lifetime keeps the pictures the browser recorded, the AI-made one included, on PNG, SVG and PDF', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 100]);
  const files: Array<[string, Uint8Array]> = [
    ['png', PNG_1PX],
    ['svg', new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>')],
    ['pdf', await doc.save({ useObjectStreams: false })],
  ];
  for (const [format, plain] of files) {
    const browser = await browserStampedWithPictures(plain, format);
    const warnings: string[] = [];
    const out = await finish(browser, format, { c2pa: { on: true, days: 90 }, c2paAsked: true }, 'B', warnings);
    assert.deepEqual(warnings, [], format);
    const report = await verifyC2pa(out.bytes);
    assert.equal(report.state, 'valid', format);
    assert.equal((report.environment as Record<string, unknown>).surface, 'mcp', `${format}: this server's credential`);
    assert.equal(lifetimeDays(report.signer), 90, format);
    const active = report.ingredients!.at(-1)!.manifest;
    assert.deepEqual(report.ingredients!.filter((i) => i.manifest === active).map((i) => [i.title, i.relationship, i.credentialed]),
      [['Harbour photo', 'componentOf', true], ['Generated sky', 'componentOf', true]], format);
    assert.ok(report.history!.some((s) => s.action === 'c2pa.placed' && s.digitalSourceType === GENERATED_SOURCE_TYPE), `${format}: the AI picture's source type`);
    assert.ok(report.history!.some((s) => s.description === 'Placed AI-declared ingredient: Generated sky (AI-generated)'), `${format}: the AI declaration`);
    assert.ok(report.aiDisclosure, `${format}: the AI disclosure`);
  }
});

test('a browser-free render and a browser credential with no pictures carry nothing in', async () => {
  // Tier A: there is no browser credential to read, so a file with one is not read for pictures.
  const browser = await browserStampedWithPictures(PNG_1PX, 'png');
  const tierA = await verifyC2pa((await finish(browser, 'png', { c2pa: { on: true, days: 30 }, c2paAsked: true }, 'A')).bytes);
  assert.equal(tierA.ingredients, undefined);
  // A browser credential with none: this server's credential holds none.
  const plain = await embedC2pa(PNG_1PX, 'png', stampedBy('web', 'png', 30));
  const carried = await verifyC2pa((await finish(plain, 'png', { c2pa: { on: true, days: 30 }, c2paAsked: true })).bytes);
  assert.equal(carried.ingredients, undefined);
  assert.equal(carried.aiDisclosure, undefined);
});

test('a format with nowhere to put one, a PDF with a password and an archive each get a plain answer', async () => {
  const warnings: string[] = [];
  const emf = await finish(new Uint8Array([1, 2, 3, 4]), 'emf', { c2pa: { on: true, days: 30 }, c2paAsked: true }, 'A', warnings);
  assert.match(warnings.join(' '), /Format "emf" cannot carry Content Credentials/);
  assert.match(credentialText(emf.credential), /none in this file, though c2pa asked for 30 days\. The warnings above say why\./);

  const locked: string[] = [];
  const pdf = await finish(await pdfWithObjectStreams(), 'pdf', { c2pa: { on: true, days: 30 }, c2paAsked: true, password: 'secret' }, 'B', locked);
  assert.match(locked.join(' '), /On a PDF, c2pa cannot be combined with password/);
  assert.equal(pdf.credential?.holds, 'none');

  const zip = await credentialAndRecord({ bytes: new Uint8Array([0x50, 0x4b, 3, 4]), tier: 'B' }, {
    fmt: 'png', exportFmt: 'png', deliveredFormat: 'zip', manifest: MANIFEST as never, values: {}, merged: { c2pa: { on: false, days: null }, c2paAsked: true }, placed: [], recorded: null, sampled: true, warnings: [],
  });
  assert.equal(zip.credential?.holds, 'unread');
  assert.match(credentialText(zip.credential), /told to write none, and this file was not read back/);
});

test('every sentence the result can print, and none where nothing was asked', () => {
  const said = (r: Partial<CredentialReadback> & Pick<CredentialReadback, 'asked' | 'holds'>): string => credentialText({ days: null, selfSigned: false, ...r });
  assert.equal(credentialText(undefined), '');
  assert.equal(said({ asked: 'off', holds: 'none' }), 'Content Credentials: none in this file, as asked.');
  assert.match(said({ asked: 'off', holds: 'invalid' }), /could not be honoured/);
  assert.equal(said({ asked: 30, holds: 'valid', days: 30, selfSigned: true }), 'Content Credentials: in this file, self-signed, valid for 30 days.');
  assert.equal(said({ asked: 30, holds: 'valid', days: 30 }), 'Content Credentials: in this file, valid for 30 days.');
  assert.match(said({ asked: 30, holds: 'invalid', days: 30 }), /does not verify/);
  assert.match(said({ asked: 30, holds: 'unread' }), /told to write them for 30 days, and this file was not read back/);
});

// ── The browser-free route, through dispatch ─────────────────────────────────

const QR = { toolId: 'qr-code', inputs: { url: 'https://example.com/spring' }, link: false };

for (const format of ['svg', 'png']) {
  test(`qr-code ${format}: no argument and "off" are the same bytes, and only "off" gets a line`, async () => {
    const plain = await call('lolly_render', { ...QR, format });
    const again = await call('lolly_render', { ...QR, format });
    const off = await call('lolly_render', { ...QR, format, c2pa: 'off' });
    assert.ok(!plain.isError && !off.isError);
    assert.deepEqual(fileOf(plain), fileOf(again), 'a default render does not change between runs');
    assert.deepEqual(fileOf(off), fileOf(plain));
    assert.equal(/credential/i.test(plain.content[0]!.text!), false, plain.content[0]!.text!);
    assert.match(off.content[0]!.text!, /Content Credentials: none in this file, as asked\./);
    assert.equal((await verifyC2pa(fileOf(off))).state, 'none');
  });

  test(`qr-code ${format}: a lifetime gives this server's credential at that lifetime`, async () => {
    const stamped = await call('lolly_render', { ...QR, format, c2pa: '90' });
    assert.match(stamped.content[0]!.text!, /Content Credentials: in this file, self-signed, valid for 90 days\./);
    const report = await verifyC2pa(fileOf(stamped));
    assert.equal(report.state, 'valid');
    assert.equal((report.environment as Record<string, unknown>).surface, 'mcp');
    assert.equal(lifetimeDays(report.signer), 90);
  });
}

test('the public route\'s render still draws what it drew, with no answer attached', async () => {
  const out = await render('qr-code', 'url=https%3A%2F%2Fexample.com', { format: 'svg', c2pa: { on: false, days: null }, noBrowser: true });
  assert.equal(out.credential, undefined);
  assert.equal((await verifyC2pa(out.bytes)).state, 'none');
});

test('tools/list says what c2pa does on each route', async () => {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/list' })) as JsonRpcResponse;
  const tools = (res.result as { tools: Array<{ name: string; inputSchema: { properties: Record<string, { description?: string }> } }> }).tools;
  const description = tools.find((t) => t.name === 'lolly_render')!.inputSchema.properties.c2pa!.description!;
  assert.match(description, /"off": none, on every format/);
  assert.match(description, /browser-tier render .* keeps the one the web shell stamps/);
  assert.match(description, /read back from the file/);
});

test('"off" on a gzipped SVG holds too, because a verifier reads through the wrapper', async () => {
  const zipped = gzip(await svgWithCredentialedLogo());
  assert.equal((await verifyC2pa(zipped)).state, 'invalid');
  const out = await finish(zipped, 'svgz', { c2pa: { on: false, days: null }, c2paAsked: true }, 'B', []);
  assert.equal((await verifyC2pa(out.bytes)).state, 'none');
  assert.deepEqual(out.credential, { asked: 'off', holds: 'none', days: null, selfSigned: false });
});
