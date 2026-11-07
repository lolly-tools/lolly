// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI with an enrolled identity signs in Node, over the bytes the browser tier wrote,
 * so its credential takes the place of the web shell's. That credential is the record of
 * the pictures placed in the file, and it used to be lost: the browser was told to write
 * none. The browser now stamps first and the CLI carries the record into its own
 * credential, an AI-made picture included.
 *
 * Runs where a browser is named (LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH).
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { Resvg } from '@resvg/resvg-js';
import {
  derToPem, embedC2pa, generateCaRoot, issueLeafCert, verifyC2pa, CAPTURE_SOURCE_TYPE, GENERATED_SOURCE_TYPE,
} from '../engine/src/index.ts';
import { decodeCbor, parseC2paStore } from '../engine/src/c2pa-verify.ts';

const skip = process.env.LOLLY_BROWSER_CHANNEL || process.env.LOLLY_BROWSER_PATH ? false : 'set LOLLY_BROWSER_CHANNEL=chromium or LOLLY_BROWSER_PATH to render through the browser tier';
const dir = await mkdtemp(join(tmpdir(), 'lolly-cli-carry-'));
after(() => rm(dir, { recursive: true, force: true }));

const art = (fill: string): Uint8Array => new Uint8Array(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="100"><rect width="160" height="100" fill="${fill}"/></svg>`).render().asPng());
async function picture(title: string, digitalSourceType: string, fill: string): Promise<string> {
  const signed = await embedC2pa(art(fill), 'png', { title, claimGenerator: 'Camera or generator', actions: [{ action: 'c2pa.created', digitalSourceType }] });
  return `data:image/png;base64,${Buffer.from(signed).toString('base64')}`;
}

test('CLI with a signing identity: the credential is the identity\'s and keeps the pictures the web shell recorded', { skip, timeout: 300_000 }, async () => {
  const subtle = globalThis.crypto.subtle;
  const ca = await generateCaRoot({ commonName: 'Carry Test CA', organization: 'Lolly Test' });
  const pair = await subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']) as CryptoKeyPair;
  const leaf = await issueLeafCert({
    caCertDer: ca.certDer, caPrivateKey: ca.pkcs8Der, spkiDer: new Uint8Array(await subtle.exportKey('spki', pair.publicKey)),
    email: 'carry@example.test', organization: 'Lolly Test',
  });
  const key = join(dir, 'key.pem');
  const chain = join(dir, 'chain.pem');
  await writeFile(key, derToPem(new Uint8Array(await subtle.exportKey('pkcs8', pair.privateKey)), 'PRIVATE KEY'));
  await writeFile(chain, derToPem(leaf, 'CERTIFICATE') + derToPem(ca.certDer, 'CERTIFICATE'));

  const out = join(dir, 'signed.svg');
  const run = spawnSync(process.execPath, [
    'shells/cli/bin/lolly.ts', 'multi-page-pdf',
    `--coverLogo=${await picture('Harbour photo', CAPTURE_SOURCE_TYPE, '#2266aa')}`,
    `--coverImage=${await picture('Generated sky', GENERATED_SOURCE_TYPE, '#cc5522')}`,
    '--export=svg', `--sign-key=${key}`, `--sign-cert=${chain}`, `--output=${out}`,
  ], { encoding: 'utf8', env: { ...process.env, LOLLY_RENDERER: 'chromium' }, maxBuffer: 1 << 24 });
  assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);

  const bytes = new Uint8Array(await readFile(out));
  const report = await verifyC2pa(bytes, { trustAnchors: [ca.certDer] });
  assert.equal(report.state, 'valid');
  assert.equal(report.signer?.identity?.email, 'carry@example.test', 'signed with the identity, not the web shell\'s key');
  assert.equal((report.environment as Record<string, unknown>).surface, 'cli');
  const active = report.ingredients?.at(-1)?.manifest;
  assert.deepEqual((report.ingredients ?? []).filter((i) => i.manifest === active).map((i) => `${i.title}/${i.relationship}`).sort(),
    ['Generated sky/componentOf', 'Harbour photo/componentOf']);
  assert.ok(report.history!.some((s) => s.action === 'c2pa.placed' && s.digitalSourceType === GENERATED_SOURCE_TYPE), 'the AI source type travels');
  // The web shell's own credential is gone from the file: every manifest left is the CLI's
  // or belongs to inlined artwork, such as the brand logo.
  const surfaces = [...Buffer.from(bytes).toString('latin1').matchAll(/<c2pa:manifest[^>]*>([^<]*)<\/c2pa:manifest>/g)].map((m) => {
    const exported = parseC2paStore(new Uint8Array(Buffer.from(m[1]!, 'base64'))).assertions.find((a) => a.label === 'tools.lolly.export');
    return exported ? (decodeCbor(exported.content) as Map<string, unknown>).get('surface') : null;
  });
  assert.equal(surfaces.filter((s) => s === 'cli').length, 1, JSON.stringify(surfaces));
  assert.equal(surfaces.includes('web'), false, JSON.stringify(surfaces));
});
