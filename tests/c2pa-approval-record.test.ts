// SPDX-License-Identifier: MPL-2.0
/**
 * Recording an approval in Content Credentials (plan 350 W1c). The reviewed bytes stay
 * as they were, and the approved file is those bytes plus a signed update naming the
 * reviewed credential as parent. These tests prove the artwork did not change, that the
 * record holds only what Andy approved, and that a readback is what decides "recorded".
 * Cross-checked with c2patool where it is installed; skipped by name where it is not.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';
import { embedC2pa, generateSigner, LOLLY_APPROVAL_ASSERTION, LOLLY_EXPORT_ASSERTION, type C2paApprovalRecord } from '../engine/src/c2pa.ts';
import { APPROVAL_RECORD_FORMATS, artworkUnchanged, recordApprovalInCredential } from '../engine/src/c2pa-approval.ts';
import { extractC2paStore, parseC2paStore, prepareC2paIngredient, verifyC2pa } from '../engine/src/c2pa-verify.ts';
import { decodeCbor } from '../engine/src/c2pa-extract.ts';

const hasC2patool = spawnSync('c2patool', ['--version']).status === 0;
const DATES = { notBefore: new Date(Date.now() - 60_000), notAfter: new Date(Date.now() + 86_400_000) };
const ORIGIN = { claimGenerator: 'Lolly', generatorInfo: { name: 'Lolly', version: 'test' }, title: 'Launch card', environment: { tool: 'qr-code', format: 'x', inputs: { size: '640', heading: `sha256:${'a'.repeat(64)}` } }, dates: DATES };
const APPROVAL = { approvalId: 'apr_abc12345', decidedAt: '2026-11-05T10:15:00.000Z' };
const te = new TextEncoder();
const SVG = te.encode('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="48" viewBox="0 0 64 48"><rect width="64" height="48" fill="#123456"/><circle cx="32" cy="24" r="16" fill="#f4c20d"/></svg>');

function buildPdf(): Uint8Array {
  let out = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
  const offsets: number[] = [];
  const push = (s: string): void => { offsets.push(out.length); out += s; };
  push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  push('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  push('3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\n');
  const xrefOff = out.length;
  out += 'xref\n0 4\n0000000000 65535 f \n';
  for (const o of offsets) out += `${String(o).padStart(10, '0')} 00000 n \n`;
  out += `trailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n${xrefOff}\n%%EOF\n`;
  return Uint8Array.from(out, (c) => c.charCodeAt(0));
}

async function plain(format: string): Promise<Uint8Array> {
  if (format === 'svg') return SVG;
  if (format === 'pdf') return buildPdf();
  const png = new Uint8Array(new Resvg(new TextDecoder().decode(SVG), { font: { loadSystemFonts: false } }).render().asPng());
  if (format === 'png') return png;
  return new Uint8Array(await sharp(png).jpeg({ quality: 90 }).toBuffer());
}

async function reviewedFile(format: string, signer: Awaited<ReturnType<typeof generateSigner>>): Promise<Uint8Array> {
  return embedC2pa(await plain(format), format, { ...ORIGIN, signer });
}

const signerFor = (): ReturnType<typeof generateSigner> => generateSigner(DATES);
const activeAssertion = (file: Uint8Array, label: string): Uint8Array | undefined => {
  const parts = parseC2paStore(extractC2paStore(file)!.store);
  return parts.assertions.find((a) => a.label === label)?.content;
};

function c2patoolReport(bytes: Uint8Array, ext: string): { state: string; beyondTrust: string[]; manifests: number } {
  const file = join(mkdtempSync(join(tmpdir(), 'lolly-approval-')), `out.${ext}`);
  writeFileSync(file, bytes);
  const r = spawnSync('c2patool', [file], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 });
  assert.equal(r.status, 0, `c2patool exited ${r.status}: ${r.stderr}`);
  const report = JSON.parse(r.stdout) as { validation_state?: string; validation_status?: { code: string }[]; manifests?: Record<string, unknown> };
  return {
    state: report.validation_state ?? '(none)',
    beyondTrust: (report.validation_status ?? []).map((s) => s.code).filter((code) => code !== 'signingCredential.untrusted'),
    manifests: Object.keys(report.manifests ?? {}).length,
  };
}

for (const format of APPROVAL_RECORD_FORMATS) {
  test(`${format}: the update records the approval over the reviewed credential, and the reader reports it`, async () => {
    const signer = await signerFor();
    const reviewed = await reviewedFile(format, signer);
    const outcome = await recordApprovalInCredential(reviewed, format, { ...APPROVAL, signer, claimGenerator: 'Lolly Work', dates: DATES });
    assert.equal(outcome.status, 'recorded', JSON.stringify(outcome));
    if (outcome.status !== 'recorded') return;
    const sha = createSha(reviewed);
    assert.deepEqual(outcome.record, { ...APPROVAL, reviewedSha256: `sha256:${await sha}` });

    const report = await verifyC2pa(outcome.bytes);
    assert.equal(report.state, 'valid');
    assert.deepEqual(report.approval, outcome.record);
    // The reviewed credential is the parent, opened first, then published.
    const parent = report.ingredients?.find((i) => i.relationship === 'parentOf');
    assert.ok(parent?.credentialed, 'the reviewed credential is the parent ingredient');
    assert.deepEqual(report.claim?.actions.map((a) => a.action), ['c2pa.opened', 'c2pa.published']);
    assert.equal(report.delivered, true, 'the update never claims to have created the work');
    // What the export recorded still reads through the update.
    assert.equal(report.environment?.tool, 'qr-code');
    assert.equal(report.environment?.inputs?.size, '640');
    assert.equal(activeAssertion(outcome.bytes, LOLLY_EXPORT_ASSERTION), undefined, 'the update does not restate the export');
  });
}

async function createSha(bytes: Uint8Array): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)), (b) => b.toString(16).padStart(2, '0')).join('');
}

test('the record holds only the approval id, the decided time and the reviewed digest', async () => {
  const signer = await signerFor();
  const outcome = await recordApprovalInCredential(await reviewedFile('png', signer), 'png', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  const map = decodeCbor(activeAssertion(outcome.bytes, LOLLY_APPROVAL_ASSERTION)!) as Map<string, unknown>;
  assert.deepEqual([...map.keys()].sort(), ['approvalId', 'decidedAt', 'reviewedSha256', 'version']);
  assert.equal(map.get('version'), 1);
});

test('the writer refuses any field the record does not name, so it cannot be widened by a caller', async () => {
  const signer = await signerFor();
  const reviewed = await reviewedFile('png', signer);
  const ingredient = prepareC2paIngredient(reviewed)!;
  const good: C2paApprovalRecord = { ...APPROVAL, reviewedSha256: `sha256:${'b'.repeat(64)}` };
  for (const extra of [{ approver: 'Bruno Marques' }, { email: 'a@example.com' }, { chain: 'Legal' }, { comment: 'fine' }, { groups: ['brand'] }]) {
    await assert.rejects(
      embedC2pa(reviewed, 'png', { signer, ingredients: [ingredient], approval: { ...good, ...extra } as C2paApprovalRecord }),
      /an approval record cannot carry/,
    );
  }
  await assert.rejects(embedC2pa(reviewed, 'png', { signer, ingredients: [ingredient], approval: { ...good, reviewedSha256: 'nope' } }), /reviewedSha256/);
  await assert.rejects(embedC2pa(reviewed, 'png', { signer, ingredients: [ingredient], approval: { ...good, decidedAt: 'soon' } }), /decidedAt/);
  await assert.rejects(embedC2pa(reviewed, 'png', { signer, ingredients: [ingredient], approval: { ...good, approvalId: 'x y' } }), /approvalId/);
});

test('an approval is an update: the writer refuses one with no credentialed parent', async () => {
  const signer = await signerFor();
  await assert.rejects(
    embedC2pa(await plain('png'), 'png', { signer, approval: { ...APPROVAL, reviewedSha256: `sha256:${'b'.repeat(64)}` } }),
    /needs a credentialed parentOf ingredient/,
  );
});

test('a credential with no approval option is byte-for-byte what it always was: no assertion is added', async () => {
  const signer = await signerFor();
  const file = await embedC2pa(await plain('png'), 'png', { ...ORIGIN, signer });
  assert.equal(activeAssertion(file, LOLLY_APPROVAL_ASSERTION), undefined);
  assert.equal((await verifyC2pa(file)).approval, undefined);
});

test('png: decoded pixels are identical after the update', async () => {
  const signer = await signerFor();
  const reviewed = await reviewedFile('png', signer);
  const outcome = await recordApprovalInCredential(reviewed, 'png', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  const [a, b] = await Promise.all([sharp(reviewed).raw().toBuffer(), sharp(outcome.bytes).raw().toBuffer()]);
  assert.ok(a.length > 0 && a.equals(b), 'the same pixels decode from both files');
  assert.ok(artworkUnchanged(reviewed, outcome.bytes, 'png'));
});

test('jpg: decoded pixels are identical after the update', async () => {
  const signer = await signerFor();
  const reviewed = await reviewedFile('jpg', signer);
  const outcome = await recordApprovalInCredential(reviewed, 'jpg', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  const [a, b] = await Promise.all([sharp(reviewed).raw().toBuffer(), sharp(outcome.bytes).raw().toBuffer()]);
  assert.ok(a.length > 0 && a.equals(b), 'the same pixels decode from both files');
  assert.ok(artworkUnchanged(reviewed, outcome.bytes, 'jpg'));
});

test('svg: every byte outside the manifest element is identical after the update', async () => {
  const signer = await signerFor();
  const reviewed = await reviewedFile('svg', signer);
  const outcome = await recordApprovalInCredential(reviewed, 'svg', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  const strip = (bytes: Uint8Array): string => new TextDecoder().decode(bytes).replace(/(<c2pa:manifest[^>]*>)[^<]*(<\/c2pa:manifest>)/, '$1$2');
  assert.equal(strip(reviewed), strip(outcome.bytes));
  assert.notEqual(new TextDecoder().decode(reviewed), new TextDecoder().decode(outcome.bytes));
});

test('pdf: the reviewed file is an exact prefix of the approved one, and the update is read as the current credential', async () => {
  const signer = await signerFor();
  const reviewed = await reviewedFile('pdf', signer);
  const outcome = await recordApprovalInCredential(reviewed, 'pdf', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  assert.ok(outcome.bytes.length > reviewed.length);
  assert.deepEqual(outcome.bytes.subarray(0, reviewed.length), reviewed, 'nothing the reviewer saw moved');
  const text = String.fromCharCode(...outcome.bytes.subarray(reviewed.length));
  assert.match(text, /\/Names << \/EmbeddedFiles << \/Names \[\(manifest\.c2pa\) \d+ 0 R\] >>/);
  assert.match(text, /\/Prev \d+/);
  assert.equal(text.match(/\/Type \/Catalog/g)?.length, 1, 'one new catalog revision');
});

test('pdf: another attachment is not this writer\'s to touch, so the update refuses and nothing is recorded', async () => {
  const signer = await signerFor();
  let reviewed = await reviewedFile('pdf', signer);
  const text = String.fromCharCode(...reviewed);
  const edited = text.replace(/\(manifest\.c2pa\) (\d+ 0 R)/, '(someone-elses.txt) 9 0 R (manifest.c2pa) $1');
  assert.notEqual(edited, text);
  reviewed = Uint8Array.from(edited, (c) => c.charCodeAt(0));
  const outcome = await recordApprovalInCredential(reviewed, 'pdf', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'not-recorded');
  assert.equal(outcome.status === 'not-recorded' && outcome.reason, 'write-failed');
});

test('a file with no credential has nothing to update, and is not given a first one', async () => {
  const signer = await signerFor();
  for (const format of APPROVAL_RECORD_FORMATS) {
    const outcome = await recordApprovalInCredential(await plain(format), format, { ...APPROVAL, signer, dates: DATES });
    assert.deepEqual(outcome, { status: 'not-recorded', reason: 'no-credential' }, format);
  }
});

test('a format with no proved route says so, and a file that is not what it claims is refused', async () => {
  const signer = await signerFor();
  const png = await reviewedFile('png', signer);
  assert.deepEqual(await recordApprovalInCredential(png, 'mp4', { ...APPROVAL, signer }), { status: 'not-recorded', reason: 'no-route' });
  assert.deepEqual(await recordApprovalInCredential(png, 'webp', { ...APPROVAL, signer }), { status: 'not-recorded', reason: 'no-route' });
  assert.deepEqual(await recordApprovalInCredential(png, 'svg', { ...APPROVAL, signer }), { status: 'not-recorded', reason: 'no-route' });
  assert.equal((await recordApprovalInCredential(png, 'jpeg', { ...APPROVAL, signer })).status, 'not-recorded');
});

test('a bad id is a write failure the caller can report, never a recording', async () => {
  const signer = await signerFor();
  const outcome = await recordApprovalInCredential(await reviewedFile('png', signer), 'png', { ...APPROVAL, approvalId: 'has space', signer, dates: DATES });
  assert.equal(outcome.status, 'not-recorded');
  assert.equal(outcome.status === 'not-recorded' && outcome.reason, 'write-failed');
});

test('a changed approval record fails like any other tampered assertion', async () => {
  const signer = await signerFor();
  const outcome = await recordApprovalInCredential(await reviewedFile('svg', signer), 'svg', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  // Rewrite one character of the approval id inside the base64 store, keeping its length.
  const text = new TextDecoder().decode(outcome.bytes);
  const open = /<c2pa:manifest[^>]*>/.exec(text)!;
  const start = open.index + open[0].length;
  const end = text.indexOf('</c2pa:manifest>', start);
  const store = Uint8Array.from(atob(text.slice(start, end)), (c) => c.charCodeAt(0));
  const id = te.encode(APPROVAL.approvalId);
  const at = store.findIndex((_, i) => id.every((b, k) => store[i + k] === b));
  assert.ok(at > 0, 'found the id in the store');
  store[at + id.length - 1] = 0x39;
  const forged = te.encode(text.slice(0, start) + btoa(String.fromCharCode(...store)) + text.slice(end));
  const report = await verifyC2pa(forged);
  assert.equal(report.state, 'invalid');
  assert.ok(report.checks.some((c) => !c.ok && c.code === 'assertion.hashedURI.mismatch'));
});

test('a changed parent manifest fails on the hash the update signed, and its facts are not read', async () => {
  const signer = await signerFor();
  const outcome = await recordApprovalInCredential(await reviewedFile('svg', signer), 'svg', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  const text = new TextDecoder().decode(outcome.bytes);
  const open = /<c2pa:manifest[^>]*>/.exec(text)!;
  const start = open.index + open[0].length;
  const end = text.indexOf('</c2pa:manifest>', start);
  const store = Uint8Array.from(atob(text.slice(start, end)), (c) => c.charCodeAt(0));
  const tool = te.encode('qr-code');
  const at = store.findIndex((_, i) => tool.every((b, k) => store[i + k] === b));
  assert.ok(at > 0, 'found the parent export record');
  store[at] = 0x7a; // 'zr-code'
  const forged = te.encode(text.slice(0, start) + btoa(String.fromCharCode(...store)) + text.slice(end));
  const report = await verifyC2pa(forged);
  assert.equal(report.state, 'invalid');
  assert.ok(report.checks.some((c) => !c.ok && c.code === 'ingredient.manifest.mismatch'));
  assert.equal(report.environment, undefined, 'facts from a parent that fails its hash are not surfaced');
});

test('a changed pixel after the update fails the hard binding, and the approval is not a verdict the reader hides', async () => {
  const signer = await signerFor();
  const outcome = await recordApprovalInCredential(await reviewedFile('svg', signer), 'svg', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  const edited = te.encode(new TextDecoder().decode(outcome.bytes).replace('#f4c20d', '#000000'));
  const report = await verifyC2pa(edited);
  assert.equal(report.state, 'invalid');
  assert.deepEqual(report.approval, outcome.record, 'the record is still reported, beside the failed state, so a viewer can warn');
});

test('an AI declaration in the reviewed credential still reads after the update', async () => {
  const signer = await signerFor();
  const reviewed = await embedC2pa(await plain('png'), 'png', { ...ORIGIN, signer, aiDisclosure: { modelName: 'Test model' } });
  const outcome = await recordApprovalInCredential(reviewed, 'png', { ...APPROVAL, signer, dates: DATES });
  assert.equal(outcome.status, 'recorded');
  if (outcome.status !== 'recorded') return;
  assert.equal((await verifyC2pa(outcome.bytes)).aiDisclosure?.modelName, 'Test model');
});

for (const [format, ext] of [['png', 'png'], ['jpg', 'jpg'], ['svg', 'svg'], ['pdf', 'pdf']] as const) {
  test(`c2patool reads the ${format} update as one chain with no failure beyond trust`, { skip: hasC2patool ? false : 'c2patool not installed (brew install c2patool)' }, async () => {
    const signer = await signerFor();
    const outcome = await recordApprovalInCredential(await reviewedFile(format, signer), format, { ...APPROVAL, signer, dates: DATES });
    assert.equal(outcome.status, 'recorded');
    if (outcome.status !== 'recorded') return;
    const report = c2patoolReport(outcome.bytes, ext);
    assert.equal(report.manifests, 2, 'the parent and the update');
    assert.deepEqual(report.beyondTrust, []);
  });
}
