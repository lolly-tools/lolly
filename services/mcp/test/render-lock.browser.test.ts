// SPDX-License-Identifier: MPL-2.0
/**
 * lolly_render's `password` on the browser tier, read back from the files a real web shell
 * hands over. This tier returned an unprotected PDF, silently, from v1.0.7 to v1.1.3: the
 * password reached the page's export panel defaults and never reached the export a link runs.
 * Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { readExportLock } from '@lolly-tools/node-shell/export-lock';
import { callTool } from '../src/tools.ts';
import { closeBrowser, closeWebShell } from '../src/render.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
const SECRET = 'Zq7-right-password';
const WRONG = 'not-the-password';
const hasQpdf = spawnSync('which', ['qpdf'], { encoding: 'utf8' }).status === 0;
const hasUnzip = spawnSync('which', ['unzip'], { encoding: 'utf8' }).status === 0;
const dir = await mkdtemp(join(tmpdir(), 'lolly-mcp-password-'));
after(async () => {
  await closeBrowser();
  await closeWebShell();
  await rm(dir, { recursive: true, force: true });
});

const CERT = { toolId: 'certificate', inputs: { firstname: 'Ana', awardtopic: 'Container Fundamentals' } };
const QR = { toolId: 'qr-code', inputs: { url: 'https://example.com' } };

interface Rendered { text: string; bytes: Buffer; everything: string }
async function renderOf(args: Record<string, unknown>): Promise<Rendered> {
  const result = await callTool('lolly_render', args);
  assert.ok(!result.isError, JSON.stringify(result.content).slice(0, 600));
  const text = result.content.filter(part => part.type === 'text').map(part => (part as { text: string }).text).join('\n');
  assert.match(text, /tier B\)/, 'this file is about the browser tier');
  const resource = result.content.find(part => part.type === 'resource');
  assert.ok(resource?.type === 'resource' && typeof resource.resource.blob === 'string');
  return { text, bytes: Buffer.from(resource.resource.blob as string, 'base64'), everything: JSON.stringify({ ...result, content: result.content.map(part => (part.type === 'resource' ? { ...part, resource: { ...part.resource, blob: undefined } } : part)) }) };
}

async function assertLockedPdf(bytes: Buffer): Promise<void> {
  const reading = await readExportLock(bytes, SECRET);
  assert.deepEqual(reading, { locked: true, opens: true, scheme: '40-bit RC4' });
  assert.equal((await readExportLock(bytes, WRONG)).opens, false);
  await assert.rejects(() => PDFDocument.load(bytes, { updateMetadata: false }), /encrypt/i, 'a PDF library refuses it without the password');
  if (!hasQpdf) return;
  const file = join(dir, `${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(file, bytes);
  assert.equal(spawnSync('qpdf', ['--is-encrypted', file]).status, 0, 'qpdf says encrypted');
  const right = spawnSync('qpdf', [`--password=${SECRET}`, '--check', file], { encoding: 'utf8' });
  assert.ok(right.status === 0 || right.status === 3, `the right password opens the file: ${right.stderr}`);
  const wrong = spawnSync('qpdf', [`--password=${WRONG}`, '--check', file], { encoding: 'utf8' });
  assert.equal(wrong.status, 2, 'a wrong password is refused');
  assert.match(wrong.stderr, /invalid password/i);
}

for (const [name, args] of [
  ['an HTML-laid-out tool', { ...CERT, format: 'pdf', password: SECRET }],
  ['a tool with an SVG root', { ...QR, format: 'pdf', password: SECRET }],
] as Array<[string, Record<string, unknown>]>) {
  test(`${name}: a PDF with a password opens only with that password, and the result says so`, { skip, timeout: 240_000 }, async () => {
    const { bytes, text, everything } = await renderOf(args);
    await assertLockedPdf(bytes);
    assert.match(text, /Password: this file opens with the password you gave, read back from the file \(40-bit RC4\)/);
    assert.match(text, /a deterrent, not protection for confidential files/);
    assert.ok(!everything.includes(SECRET), 'the result, its Edit link and its resource address never hold the password');
  });
}

test('a render with no password is still an ordinary, unencrypted PDF', { skip, timeout: 240_000 }, async () => {
  const { bytes, text } = await renderOf({ ...CERT, format: 'pdf', link: false });
  assert.equal((await readExportLock(bytes, SECRET)).locked, false);
  assert.doesNotMatch(text, /^Password:/m);
});

test('c2pa and a password: the file is locked, holds no credential, and the warning stays', { skip, timeout: 240_000 }, async () => {
  const { bytes, text } = await renderOf({ ...CERT, format: 'pdf', c2pa: '90', password: SECRET, link: false });
  await assertLockedPdf(bytes);
  assert.match(text, /On a PDF, c2pa cannot be combined with password/);
  assert.match(text, /Content Credentials: none in this file, though c2pa asked for 90 days/);
});

test('a ZIP with a password has every member locked', { skip, timeout: 240_000 }, async () => {
  const result = await callTool('lolly_render', { toolId: 'agenda', inputs: {}, format: 'zip', password: SECRET, link: false });
  assert.ok(!result.isError, JSON.stringify(result.content).slice(0, 600));
  const text = result.content.filter(part => part.type === 'text').map(part => (part as { text: string }).text).join('\n');
  assert.match(text, /Password: this file is encrypted, read back from the file \(ZIP encryption\)/);
  const resource = result.content.find(part => part.type === 'resource');
  assert.ok(resource?.type === 'resource' && typeof resource.resource.blob === 'string');
  const bytes = Buffer.from(resource.resource.blob as string, 'base64');
  assert.equal((await readExportLock(bytes, SECRET)).locked, true);
  if (!hasUnzip) return;
  const file = join(dir, 'locked.zip');
  await writeFile(file, bytes);
  assert.equal(spawnSync('unzip', ['-t', '-P', SECRET, file]).status, 0, 'the right password opens the ZIP');
  assert.notEqual(spawnSync('unzip', ['-t', '-P', WRONG, file]).status, 0, 'a wrong password does not');
});

test('a web shell that hands back an unlocked PDF gets no file delivered', { skip, timeout: 120_000 }, async () => {
  // An older or misbehaving shell at LOLLY_WEB_BASE: it opens, ignores the password and downloads a plain PDF.
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  const pdf = Buffer.from(await doc.save()).toString('base64');
  const server: Server = createServer((_req, res) => {
    res.setHeader('content-type', 'text/html');
    res.end(`<!doctype html><script>
      const bytes = Uint8Array.from(atob('${pdf}'), c => c.charCodeAt(0));
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      a.download = 'file.pdf';
      addEventListener('load', () => { document.body.append(a); a.click(); });
    </script>`);
  });
  await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  const previous = process.env.LOLLY_WEB_BASE;
  process.env.LOLLY_WEB_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    const result = await callTool('lolly_render', { ...CERT, format: 'pdf', password: SECRET, link: false });
    assert.equal(result.isError, true, 'the call fails');
    const text = result.content.filter(part => part.type === 'text').map(part => (part as { text: string }).text).join('\n');
    assert.match(text, /came back without its password, so it was not delivered/);
    assert.equal(result.content.some(part => part.type === 'resource'), false, 'no file comes back');
    assert.ok(!JSON.stringify(result).includes(SECRET));
  } finally {
    if (previous === undefined) delete process.env.LOLLY_WEB_BASE; else process.env.LOLLY_WEB_BASE = previous;
    await new Promise<void>(ok => server.close(() => ok()));
  }
});
