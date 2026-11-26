// SPDX-License-Identifier: MPL-2.0
/**
 * The check every Node route runs before it hands over a locked file, against real
 * locked files: the web shell's own 40-bit writer, the AES-256 writer and the ZIP
 * framer. Where qpdf is installed it is the second reader, so this is not one module
 * agreeing with itself.
 *
 * Run: node --test tests/export-lock.test.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { buildEncryptedZip, crc32 } from '../engine/src/zip-crypto.ts';
import { assertExportLocked, exportPasswordRefusal, exposeExportPassword, readExportLock, standardPdfPasswordIsTypable } from '../packages/node-shell/src/export-lock.ts';
import { lockPdf } from '../packages/node-shell/src/pdf.ts';
import { exportUrl } from '../packages/node-shell/src/webshell-render.ts';
import { encryptPdfRc4 } from '../shells/web/src/bridge/export-pdf-rc4.ts';

const SECRET = 'Zq7-right-password';
const WRONG = 'not-the-password';

const hasQpdf = spawnSync('which', ['qpdf'], { encoding: 'utf8' }).status === 0;
const dir = await mkdtemp(join(tmpdir(), 'lolly-export-lock-'));
after(() => rm(dir, { recursive: true, force: true }));

async function plainPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]).drawText('locked words');
  return doc.save();
}

/** qpdf's answer for this file: encrypted, opens with the right password, refuses a wrong one. */
async function qpdfReads(bytes: Uint8Array, password: string): Promise<void> {
  const file = join(dir, `${Math.random().toString(36).slice(2)}.pdf`);
  await writeFile(file, bytes);
  assert.equal(spawnSync('qpdf', ['--is-encrypted', file]).status, 0, 'qpdf says encrypted');
  const right = spawnSync('qpdf', [`--password=${password}`, '--check', file], { encoding: 'utf8' });
  assert.ok(right.status === 0 || right.status === 3, `the right password opens the file: ${right.stderr}`);
  const wrong = spawnSync('qpdf', [`--password=${WRONG}`, '--check', file], { encoding: 'utf8' });
  assert.equal(wrong.status, 2, 'a wrong password does not open the file');
  assert.match(wrong.stderr, /invalid password/i);
}

test('a 40-bit PDF from the web shell\'s writer reads as locked, and only the right password opens it', async () => {
  const locked = await encryptPdfRc4(await plainPdf(), SECRET, ['print']);
  const reading = await readExportLock(locked, SECRET);
  assert.deepEqual(reading, { locked: true, opens: true, scheme: '40-bit RC4' });
  assert.equal((await readExportLock(locked, WRONG)).opens, false);
  if (hasQpdf) await qpdfReads(locked, SECRET);
});

test('an AES-256 PDF reads as locked, and only the right password opens it', async () => {
  const { bytes } = await lockPdf(await plainPdf(), SECRET);
  const reading = await readExportLock(bytes, SECRET);
  assert.deepEqual(reading, { locked: true, opens: true, scheme: 'AES-256' });
  assert.equal((await readExportLock(bytes, WRONG)).opens, false);
  if (hasQpdf) await qpdfReads(bytes, SECRET);
});

test('a PDF with no lock is not locked, whatever its text says', async () => {
  const doc = await PDFDocument.create();
  doc.addPage([200, 200]);
  doc.setTitle('/Encrypt 5 0 R');
  const bytes = await doc.save({ useObjectStreams: false });
  assert.equal((await readExportLock(bytes, SECRET)).locked, false);
});

test('a locked ZIP has every member flagged, and a plain ZIP does not', async () => {
  const member = (name: string, text: string) => { const bytes = new TextEncoder().encode(text); return { name, compressed: bytes, method: 0 as const, crc32: crc32(bytes), uncompressedSize: bytes.length }; };
  const entries = [member('a.txt', 'one'), member('b.txt', 'two')];
  const locked = await buildEncryptedZip(entries, { tier: 'standard', password: SECRET });
  assert.deepEqual(await readExportLock(locked, SECRET), { locked: true, opens: null, scheme: 'ZIP encryption' });
  const strong = await buildEncryptedZip(entries, { tier: 'strong', password: SECRET });
  assert.equal((await readExportLock(strong, SECRET)).locked, true);
  const { zipSync } = await import('fflate');
  const plain = zipSync({ 'a.txt': new TextEncoder().encode('one') });
  assert.equal((await readExportLock(plain, SECRET)).locked, false);
});

test('the last check throws for an unlocked file, a wrong password and bytes that are neither format, and never repeats the password', async () => {
  const unlocked = await plainPdf();
  const locked = await encryptPdfRc4(unlocked, SECRET, ['print']);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  await assert.rejects(() => assertExportLocked(unlocked, 'pdf', SECRET), (e: Error) => /without its password/.test(e.message) && !e.message.includes(SECRET));
  await assert.rejects(() => assertExportLocked(locked, 'pdf', WRONG), (e: Error) => /different password/.test(e.message) && !e.message.includes(WRONG));
  await assert.rejects(() => assertExportLocked(png, 'png', SECRET), (e: Error) => /without its password/.test(e.message) && !e.message.includes(SECRET));
  await assert.rejects(() => assertExportLocked(new TextEncoder().encode('%PDF-1.7 torn'), 'pdf', SECRET), (e: Error) => !e.message.includes(SECRET));
  assert.equal((await assertExportLocked(locked, 'pdf', SECRET)).opens, true);
});

test('only pdf and zip can carry the password, and print finishing and other alphabets are refused by name', () => {
  assert.equal(exportPasswordRefusal('pdf', { password: SECRET }), null);
  assert.equal(exportPasswordRefusal('PDF', { password: SECRET }), null);
  assert.equal(exportPasswordRefusal('zip', { password: SECRET }), null);
  assert.equal(exportPasswordRefusal('zip', { password: 'пароль123' }), null, 'a ZIP password is its bytes, and unzip reads them');
  for (const format of ['png', 'svg', 'jpg', 'html', 'cmyk-tiff', 'mp4']) {
    assert.match(exportPasswordRefusal(format, { password: SECRET })!, new RegExp(`"${format}" file cannot carry a password`));
  }
  assert.match(exportPasswordRefusal('pdf-cmyk', { password: SECRET })!, /cannot lock a "pdf-cmyk"/);
  assert.match(exportPasswordRefusal('pdf', { password: SECRET, bleed: '3mm' })!, /bleed or print marks/);
  assert.match(exportPasswordRefusal('pdf', { password: SECRET, marks: 'crop' })!, /bleed or print marks/);
  assert.match(exportPasswordRefusal('pdf', { password: 'пароль123' })!, /plain ASCII/);
  for (const words of [exportPasswordRefusal('png', { password: SECRET }), exportPasswordRefusal('pdf', { password: 'пароль123' })]) {
    assert.ok(!words!.includes(SECRET) && !words!.includes('пароль123'), 'a refusal never repeats the password');
  }
  assert.equal(standardPdfPasswordIsTypable('plain ascii ~1!'), true);
  assert.equal(standardPdfPasswordIsTypable('café'), false, 'readers disagree about this one: qpdf opens it and Poppler does not');
});

test('the CLI and TUI address never carries the password, even one left in the query', () => {
  const url = exportUrl('http://127.0.0.1:5000', 'report', 'title=Quarterly&password=query-secret', 'pdf', { password: 'option-secret' });
  assert.doesNotMatch(url, /query-secret|option-secret|password=/);
  assert.match(url, /title=Quarterly/);
});

test('the binding yields the password once', async () => {
  let binding: ((source: unknown, kind: unknown) => unknown) | undefined;
  const clear = await exposeExportPassword({ exposeBinding: async (_name: string, callback: (s: unknown, k: unknown) => unknown) => { binding = callback; } } as never, SECRET);
  assert.equal(binding?.({}, 'other'), null);
  assert.equal(binding?.({}, 'pdf-password'), SECRET);
  assert.equal(binding?.({}, 'pdf-password'), null);
  clear();
});
