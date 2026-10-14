// SPDX-License-Identifier: MPL-2.0
/** Build-distributed enrollment trust and bounded certificate status reads. */
import { enrollmentCertificateDer, equalDer, parseEnrollmentTrustBundle, validateEnrollmentChain, validateEnrollmentCrl, type EnrollmentTrustBundle } from '../../../../engine/src/enrollment.ts';
import { parseCertificate, signedBy } from '../../../../engine/src/x509-read.ts';
import { CA_ROOT_PEM } from '../ca-root.ts';

export const configuredEnrollmentTrust = (): EnrollmentTrustBundle | null => {
  const raw = import.meta.env?.VITE_CA_ENROLLMENT_TRUST_JSON;
  return raw ? parseEnrollmentTrustBundle(raw) : null;
};
export interface EnrollmentResponse {
  version?: number; issuerMode?: string; issuer?: string; chain?: string[]; cert?: string;
  identity?: { email?: string; provider?: string }; policyOid?: string; notBefore?: string; notAfter?: string;
}
export async function validateEnrollmentResponse(response: EnrollmentResponse, spki: Uint8Array, trust: EnrollmentTrustBundle | null, rootPem = CA_ROOT_PEM): Promise<Uint8Array[]> {
  if (!Array.isArray(response.chain) || response.chain.length < 2 || response.chain.length > 3 || typeof response.identity?.email !== 'string' || typeof response.identity?.provider !== 'string') throw new Error('Certificate enrollment response is invalid');
  const chain = response.chain.map(enrollmentCertificateDer);
  const parsed = parseCertificate(chain[0]!);
  if (response.notBefore !== parsed.notBefore.toISOString() || response.notAfter !== parsed.notAfter.toISOString() || !equalDer(parsed.spki, spki)) throw new Error('Certificate enrollment response does not match this device');
  if (trust) {
    const p = trust.providers[response.identity.provider];
    if (response.version !== 2 || response.issuerMode !== 'vault-pki' || !p || response.issuer !== p.issuer || response.policyOid !== p.policyOid || !p.domains.includes(response.identity.email.slice(response.identity.email.lastIndexOf('@') + 1).toLowerCase())) throw new Error('Certificate enrollment policy does not match this build');
    await validateEnrollmentChain(chain, { roots: trust.roots, issuer: trust.issuers.get(p.issuer)!, email: response.identity.email, policyOid: p.policyOid, spki, maxLifetimeSeconds: trust.maxLifetimeSeconds });
  } else {
    if (response.issuerMode === 'vault-pki' || chain.length !== 2 || !rootPem || !equalDer(chain[1]!, enrollmentCertificateDer(rootPem))) throw new Error('Certificate authority is not trusted by this build');
    const root = parseCertificate(chain[1]!);
    const now = Date.now();
    if (parsed.isCa || parsed.sanEmails.length !== 1 || parsed.sanEmails[0] !== response.identity.email || parsed.notBefore.getTime() > now || parsed.notAfter.getTime() <= now || root.notBefore.getTime() > now || root.notAfter.getTime() <= now || parsed.notAfter > root.notAfter || !root.isCa || !await signedBy(parsed, root)) throw new Error('Certificate enrollment chain does not verify');
  }
  return chain;
}
export async function fetchEnrollmentCrl(issuer: string, trust: EnrollmentTrustBundle, fetchImpl: typeof fetch = fetch): Promise<Uint8Array> {
  if (!trust.issuers.has(issuer)) throw new Error('Certificate issuer is not trusted');
  const response = await fetchImpl(`/api/ca/issuer/${encodeURIComponent(issuer)}/crl`, { redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !response.body || Number(response.headers.get('content-length')) > 1024 * 1024) throw new Error('Certificate status is unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 1024 * 1024) throw new Error('Certificate status exceeds its limit');
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  await validateEnrollmentCrl(bytes, trust.issuers.get(issuer)!, trust.crlMaxAgeSeconds);
  return bytes;
}
