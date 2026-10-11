// SPDX-License-Identifier: MPL-2.0
/** One ephemeral leaf under the public catalog's pinned credential authority. */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { issueLeafCert, pemToDer } from '../engine/src/x509.ts';
import { ENGINE_VERSION } from '../engine/src/index.ts';
import type { EmbedOptions } from '../engine/src/c2pa.ts';
import sharp from 'sharp';

const fingerprint = (der: Uint8Array) => createHash('sha256').update(der).digest('hex');
export async function catalogRenditionSigner(root: string, env: NodeJS.ProcessEnv = process.env): Promise<{
  version: string; signing: Pick<EmbedOptions, 'signer' | 'dates' | 'claimGenerator'>;
}> {
  const pin = readFileSync(resolve(root, 'shells/web/src/ca-root.ts'), 'utf8').match(/-----BEGIN CERTIFICATE-----[\s\S]*?-----END CERTIFICATE-----/);
  if (!pin || !env.CA_ROOT_CERT_PEM || !env.CA_ROOT_KEY_PEM) throw new Error('Pinned catalog credential authority is required');
  const caCertDer = pemToDer(env.CA_ROOT_CERT_PEM), digest = fingerprint(caCertDer);
  if (digest !== fingerprint(pemToDer(pin[0]))) throw new Error('Catalog credential authority does not match the verifier pin');
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const signedAt = new Date(Date.now() - 60_000);
  const leaf = await issueLeafCert({ caCertDer, caPrivateKey: pemToDer(env.CA_ROOT_KEY_PEM),
    spkiDer: new Uint8Array(await crypto.subtle.exportKey('spki', pair.publicKey)),
    email: 'credentials@lolly.tools', commonName: 'Lolly Content Credentials', organization: 'Lolly',
    notBefore: signedAt, notAfter: new Date(Date.now() + 800 * 86_400_000),
  });
  return { version: `ca:${digest}:engine:${ENGINE_VERSION}:sharp:${sharp.versions.sharp}:rendition:1`,
    signing: { dates: { signedAt }, signer: { privateKey: pair.privateKey, chain: [leaf] }, claimGenerator: `Lolly/${ENGINE_VERSION}` } };
}
