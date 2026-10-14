// SPDX-License-Identifier: MPL-2.0
/** Identity trust for the Verify view, separate from its file intake and rendering. */
import { pemToDer, c2paTrustAnchors, type verifyC2pa } from '@lolly/engine';
import { CA_ROOT_PEM } from '../ca-root.ts';
import { configuredEnrollmentTrust, fetchEnrollmentCrl } from '../bridge/enrollment-policy.ts';

const ENROLLMENT_TRUST = configuredEnrollmentTrust();
// The pinned Lolly root and vendored C2PA roots recognise known signers. A
// self-signed on-device export remains intact-but-untrusted.
const PUBLIC_ROOTS = [...(CA_ROOT_PEM ? [pemToDer(CA_ROOT_PEM)] : []), ...c2paTrustAnchors()];

export async function configuredVerifyOptions(
  externalManifest?: Uint8Array,
  trust = ENROLLMENT_TRUST,
  readCrl = fetchEnrollmentCrl,
): Promise<NonNullable<Parameters<typeof verifyC2pa>[1]>> {
  const enrollmentCrls: Record<string, Uint8Array> = {};
  if (trust) for (const issuer of trust.issuers.keys()) {
    try { enrollmentCrls[issuer] = await readCrl(issuer, trust); }
    catch { /* Unavailable status keeps managed identities untrusted. */ }
  }
  return {
    trustAnchors: [...PUBLIC_ROOTS, ...(trust?.roots ?? [])],
    ...(externalManifest ? { externalManifest } : {}),
    ...(trust ? { enrollmentTrust: trust, enrollmentCrls } : {}),
  };
}
