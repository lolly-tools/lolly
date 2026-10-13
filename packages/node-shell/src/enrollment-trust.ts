// SPDX-License-Identifier: MPL-2.0
/** Operator-distributed managed identity trust and CRL files for Node shells. */
import { readFile } from 'node:fs/promises';
import { parseEnrollmentTrustBundle, type EnrollmentTrustBundle } from '@lolly/engine';
import { pemToDer } from '../../../engine/src/x509.ts';
import { expandHome } from './trust-anchors.ts';

export async function loadEnrollmentTrust(env: Record<string, string | undefined> = process.env): Promise<{ trust: EnrollmentTrustBundle; crls: Record<string, Uint8Array> } | null> {
  const path = env.LOLLY_ENROLLMENT_TRUST;
  if (!path) return null;
  const bytes = await readFile(expandHome(path));
  if (bytes.length > 200_000) throw new Error('Managed identity trust file exceeds its limit');
  const trust = parseEnrollmentTrustBundle(bytes.toString('utf8'));
  const files = JSON.parse(env.LOLLY_ENROLLMENT_CRLS || '{}') as Record<string, unknown>;
  if (!files || typeof files !== 'object' || Array.isArray(files)) throw new Error('Managed identity CRL configuration is invalid');
  const crls: Record<string, Uint8Array> = Object.create(null);
  for (const [issuer, path] of Object.entries(files)) {
    if (!trust.issuers.has(issuer) || typeof path !== 'string' || !path.length) throw new Error('Managed identity CRL configuration is invalid');
    const bytes = await readFile(expandHome(path));
    if (bytes.length > 1500 * 1024) throw new Error('Managed identity CRL file exceeds its limit');
    crls[issuer] = bytes.includes('-----BEGIN X509 CRL-----') ? pemToDer(bytes.toString('utf8')) : new Uint8Array(bytes);
  }
  return { trust, crls };
}
