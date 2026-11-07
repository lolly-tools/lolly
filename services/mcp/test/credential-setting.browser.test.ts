// SPDX-License-Identifier: MPL-2.0
/**
 * What `lolly_render`'s `c2pa` argument does on the browser tier, read back from the files a
 * real web shell hands over. This tier is where the setting used to be ignored: the shell
 * stamped its own credential whatever `c2pa` said, and a PDF could not take a second one.
 * Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { verifyC2pa } from '../../../engine/src/index.ts';
import { callTool } from '../src/tools.ts';
import { closeBrowser, closeWebShell } from '../src/render.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
after(async () => {
  await closeBrowser();
  await closeWebShell();
});

const CERT = { toolId: 'certificate', inputs: { firstname: 'Ana', awardtopic: 'Container Fundamentals' }, link: false };
const INTENT = { version: 1, purpose: 'recognise', surfaces: [{ id: 'a4-landscape' }], content: { firstname: 'Ana', awardtopic: 'Container Fundamentals' } };

async function renderOf(args: Record<string, unknown>): Promise<{ header: string; bytes: Buffer; state: string; surface: unknown; days: number | null; hasIntent: boolean }> {
  const result = await callTool('lolly_render', args);
  assert.ok(!result.isError, JSON.stringify(result.content));
  const header = result.content.find((part) => part.type === 'text')?.text ?? '';
  assert.match(header, /tier B\)/, 'this file is about the browser tier');
  const resource = result.content.find((part) => part.type === 'resource');
  const image = result.content.find((part) => part.type === 'image');
  const bytes = resource?.type === 'resource'
    ? (typeof resource.resource.blob === 'string' ? Buffer.from(resource.resource.blob, 'base64') : Buffer.from(resource.resource.text ?? ''))
    : Buffer.from(image?.type === 'image' ? image.data : '', 'base64');
  assert.ok(bytes.length > 0);
  const report = await verifyC2pa(bytes);
  const signer = report.signer;
  return {
    header, bytes, state: report.state,
    surface: (report.environment as Record<string, unknown> | null | undefined)?.surface ?? null,
    days: signer ? Math.round((Date.parse(signer.notAfter) - Date.parse(signer.notBefore)) / 86_400_000) : null,
    hasIntent: !!report.intent,
  };
}

test('certificate PDF: the default keeps the web shell\'s credential, "off" removes it and nothing else, a lifetime is honoured', { skip, timeout: 300_000 }, async () => {
  const plain = await renderOf({ ...CERT, format: 'pdf' });
  assert.equal(plain.state, 'valid');
  assert.equal(plain.surface, 'web', 'the render nobody configured is as it was');
  assert.equal(plain.days, 30);
  assert.equal(/Content Credentials/.test(plain.header), false, plain.header);

  const off = await renderOf({ ...CERT, format: 'pdf', c2pa: 'off' });
  assert.equal(off.state, 'none');
  assert.match(off.header, /Content Credentials: none in this file, as asked\./);
  assert.equal(off.bytes.includes('manifest.c2pa'), false);
  const [a, b] = await Promise.all([plain.bytes, off.bytes].map((bytes) => PDFDocument.load(bytes, { updateMetadata: false })));
  assert.equal(b!.getPageCount(), a!.getPageCount());
  for (const read of ['getTitle', 'getAuthor', 'getSubject', 'getKeywords', 'getCreator', 'getProducer'] as const) {
    assert.equal(b![read](), a![read](), read);
  }

  const ninety = await renderOf({ ...CERT, format: 'pdf', c2pa: '90' });
  assert.equal(ninety.state, 'valid');
  assert.equal(ninety.surface, 'mcp');
  assert.equal(ninety.days, 90);
  assert.equal(/not attached/.test(ninety.header), false, ninety.header);
  assert.match(ninety.header, /Content Credentials: in this file, self-signed, valid for 90 days\./);
});

test('certificate PDF with an intent: the server\'s credential holds the record, and "off" means none', { skip, timeout: 300_000 }, async () => {
  const recorded = await renderOf({ ...CERT, format: 'pdf', intent: INTENT });
  assert.equal(recorded.state, 'valid');
  assert.equal(recorded.surface, 'mcp');
  assert.equal(recorded.hasIntent, true);

  const off = await renderOf({ ...CERT, format: 'pdf', intent: INTENT, c2pa: 'off' });
  assert.equal(off.state, 'none');
  assert.equal(off.hasIntent, false);
  assert.match(off.header, /The intent was not recorded/);
  assert.match(off.header, /Content Credentials: none in this file, as asked\./);
});

test('certificate SVG: "off" leaves no credential at all, the inlined logo\'s included', { skip, timeout: 300_000 }, async () => {
  const off = await renderOf({ ...CERT, format: 'svg', c2pa: 'off' });
  assert.equal(off.state, 'none');
  assert.equal(off.bytes.includes('<c2pa:manifest'), false);
  assert.ok(off.bytes.includes('<title>Certificate</title>'));
  assert.match(off.header, /Content Credentials: none in this file, as asked\./);

  const ninety = await renderOf({ ...CERT, format: 'svg', c2pa: '90' });
  assert.equal(ninety.state, 'valid');
  assert.equal(ninety.surface, 'mcp');
  assert.equal(ninety.days, 90);
  // This server's credential in the root's metadata, and the inlined logo's own in the logo.
  const text = ninety.bytes.toString();
  assert.equal(text.match(/<c2pa:manifest/g)?.length, 2);
  assert.ok(text.indexOf('<c2pa:manifest') < text.indexOf('<svg', text.indexOf('<svg') + 4), 'the file\'s comes ahead of the inlined artwork');
});

test('certificate PNG and qr-code PDF: "off" means none, and a lifetime is this server\'s', { skip, timeout: 300_000 }, async () => {
  const pngOff = await renderOf({ ...CERT, format: 'png', c2pa: 'off' });
  assert.equal(pngOff.state, 'none');
  assert.equal(pngOff.bytes.includes('caBX'), false);
  const pngNinety = await renderOf({ ...CERT, format: 'png', c2pa: '90' });
  assert.equal(pngNinety.state, 'valid');
  assert.equal(pngNinety.surface, 'mcp');
  assert.equal(pngNinety.days, 90);

  const qr = { toolId: 'qr-code', inputs: { url: 'https://example.com/spring' }, link: false, format: 'pdf' };
  assert.equal((await renderOf({ ...qr, c2pa: 'off' })).state, 'none');
  const qrSeven = await renderOf({ ...qr, c2pa: '7' });
  assert.equal(qrSeven.state, 'valid');
  assert.equal(qrSeven.days, 7);
});
