// SPDX-License-Identifier: MPL-2.0
/**
 * Recording an approval in a file's Content Credentials.
 *
 * One operation over bytes a person already reviewed: read the file's credential, add a
 * signed update with that credential as parent, recording {@link LOLLY_APPROVAL_ASSERTION},
 * then read the result back. It reports `recorded` only when the readback confirms the
 * credential is intact, the record says what was asked and the artwork outside the
 * credential is unchanged. Anything else is `not-recorded` with a reason, and the caller
 * keeps the reviewed bytes.
 *
 * The update adds the approval record and what any credential needs: the signer, the
 * signing time and the steps opened and published. Names, emails, groups, comments and
 * chain names have no way in, because the record's shape is closed in c2pa.ts.
 *
 * Pure, apart from the signature and the time it stamps: no network, no storage.
 */
import { embedC2pa, type C2paApprovalRecord, type EmbedOptions, type Signer } from './c2pa.ts';
import { prepareC2paIngredient, sniffFormat } from './c2pa-extract.ts';
import { verifyC2pa } from './c2pa-verify.ts';

/** The formats with a proved update route. Any other stays as reviewed, with the reason stated. */
export const APPROVAL_RECORD_FORMATS: readonly string[] = Object.freeze(['png', 'jpg', 'svg', 'pdf']);

export type ApprovalNotRecordedReason =
  /** This format has no proved update route. */
  | 'no-route'
  /** The reviewed file carries no credential, so there is nothing to update. */
  | 'no-credential'
  /** The writer refused or failed. The detail says why, for logs. */
  | 'write-failed'
  /** The result did not read back as an intact credential holding this record. */
  | 'readback-failed'
  /** Bytes outside the credential differ from the reviewed file. */
  | 'artwork-changed';

export type ApprovalRecordOutcome =
  | { status: 'recorded'; bytes: Uint8Array; sha256: string; record: C2paApprovalRecord }
  | { status: 'not-recorded'; reason: ApprovalNotRecordedReason; detail?: string };

const hex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return hex(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>)));
}
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, i) => value === b[i]);
const normalise = (format: string): string => { const f = String(format || '').toLowerCase(); return f === 'jpeg' ? 'jpg' : f; };

function pngWithoutCredential(bytes: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [bytes.subarray(0, 8)];
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let at = 8; at + 12 <= bytes.length; ) {
    const end = at + 12 + view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    if (type !== 'caBX') keep.push(bytes.subarray(at, end));
    at = end;
  }
  return concat(keep);
}

function jpegWithoutCredential(bytes: Uint8Array): Uint8Array {
  const keep: Uint8Array[] = [bytes.subarray(0, 2)];
  let at = 2;
  while (at + 4 <= bytes.length && bytes[at] === 0xff) {
    const marker = bytes[at + 1]!;
    if (marker === 0xda) break; // entropy-coded data follows; the rest is copied whole
    const end = at + 2 + ((bytes[at + 2]! << 8) | bytes[at + 3]!);
    const app11Jumbf = marker === 0xeb && bytes[at + 4] === 0x4a && bytes[at + 5] === 0x50; // 'JP'
    if (!app11Jumbf) keep.push(bytes.subarray(at, end));
    at = end;
  }
  keep.push(bytes.subarray(at));
  return concat(keep);
}

function svgWithoutCredential(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return text.replace(/(<c2pa:manifest[^>]*>)[^<]*(<\/c2pa:manifest>)/g, '$1$2');
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0));
  let at = 0;
  for (const part of parts) { out.set(part, at); at += part.length; }
  return out;
}

/**
 * Whether every byte outside the credential is the same in both files. PDF is an
 * incremental update, so the reviewed file must be an exact prefix of the approved one.
 * A JPEG holding a multi-picture index has that index rewritten when the credential's
 * length changes, so it reads as changed: the caller then keeps the reviewed bytes.
 */
export function artworkUnchanged(reviewed: Uint8Array, approved: Uint8Array, format: string): boolean {
  switch (normalise(format)) {
    case 'png': return sameBytes(pngWithoutCredential(reviewed), pngWithoutCredential(approved));
    case 'jpg': return sameBytes(jpegWithoutCredential(reviewed), jpegWithoutCredential(approved));
    case 'svg': return svgWithoutCredential(reviewed) === svgWithoutCredential(approved);
    case 'pdf': return approved.length > reviewed.length && sameBytes(reviewed, approved.subarray(0, reviewed.length));
    default: return false;
  }
}

export interface RecordApprovalOptions {
  /** The request that was decided, and when. */
  approvalId: string;
  decidedAt: string;
  /** The signing identity. Required: an approval is never self-signed with a throwaway key. */
  signer: Signer;
  claimGenerator?: string;
  /** Certificate dates for a generated signer, and the signing time. Tests pin them. */
  dates?: EmbedOptions['dates'];
}

/** Add a signed approval update to `reviewed`. Never throws for what a file holds. */
export async function recordApprovalInCredential(reviewed: Uint8Array, format: string, opts: RecordApprovalOptions): Promise<ApprovalRecordOutcome> {
  const fmt = normalise(format);
  if (!APPROVAL_RECORD_FORMATS.includes(fmt) || sniffFormat(reviewed) !== (fmt === 'jpg' ? 'jpeg' : fmt)) return { status: 'not-recorded', reason: 'no-route' };
  const ingredient = prepareC2paIngredient(reviewed);
  if (!ingredient) return { status: 'not-recorded', reason: 'no-credential' };
  const record: C2paApprovalRecord = { approvalId: opts.approvalId, decidedAt: opts.decidedAt, reviewedSha256: `sha256:${await sha256Hex(reviewed)}` };
  let bytes: Uint8Array;
  try {
    bytes = await embedC2pa(reviewed, fmt, {
      signer: opts.signer,
      ...(opts.claimGenerator ? { claimGenerator: opts.claimGenerator } : {}),
      ...(ingredient.title ? { title: ingredient.title } : {}),
      ...(opts.dates ? { dates: opts.dates } : {}),
      authorship: 'delivered',
      actions: [{ action: 'c2pa.published' }],
      ingredients: [{ ...ingredient, relationship: 'parentOf' }],
      approval: record,
    });
  } catch (error) {
    return { status: 'not-recorded', reason: 'write-failed', detail: (error as Error).message };
  }
  const readback = await verifyC2pa(bytes);
  const read = readback.approval;
  if (readback.state !== 'valid' || !read || read.approvalId !== record.approvalId || read.decidedAt !== record.decidedAt || read.reviewedSha256 !== record.reviewedSha256) {
    return { status: 'not-recorded', reason: 'readback-failed', detail: readback.reason ?? readback.checks.filter((c) => !c.ok).map((c) => c.code).join(', ') };
  }
  if (!artworkUnchanged(reviewed, bytes, fmt)) return { status: 'not-recorded', reason: 'artwork-changed' };
  return { status: 'recorded', bytes, sha256: await sha256Hex(bytes), record };
}
