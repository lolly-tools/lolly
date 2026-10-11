// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import { stripSvgC2pa } from '../../packages/node-shell/src/lolly-file.ts';

/** A structural comparison only, not a credential-verification receipt. */
export function stripProbeCredential(bytes: Uint8Array, format: 'svg' | 'png'): Uint8Array {
  if (format === 'svg') return new TextEncoder().encode(stripSvgC2pa(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
  if (!signature.every((value, i) => bytes[i] === value)) throw new Error('Probe PNG has an invalid signature');
  const parts = [bytes.slice(0, 8)]; let offset = 8, ended = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('Truncated probe PNG');
    const length = new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0), end = offset + length + 12;
    if (end > bytes.length) throw new Error('Truncated probe PNG chunk');
    const type = new TextDecoder().decode(bytes.slice(offset + 4, offset + 8));
    if (type !== 'caBX') parts.push(bytes.slice(offset, end));
    offset = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || offset !== bytes.length) throw new Error('Probe PNG has missing IEND or trailing bytes');
  const result = new Uint8Array(parts.reduce((n, part) => n + part.length, 0)); let cursor = 0;
  for (const part of parts) { result.set(part, cursor); cursor += part.length; }
  return result;
}
export async function measureProbeBody(response: Response, stripC2pa?: 'svg' | 'png') {
  const hash = createHash('sha256'), chunks: Uint8Array[] = [], prefix = new Uint8Array(32);
  let size = 0, prefixSize = 0;
  const add = (bytes: Uint8Array) => {
    hash.update(bytes); size += bytes.length;
    const n = Math.min(bytes.length, prefix.length - prefixSize); if (n > 0) { prefix.set(bytes.slice(0, n), prefixSize); prefixSize += n; }
    if (stripC2pa) { if (size > 64 * 1024 * 1024) throw new Error('Credential comparison sample exceeds 64 MiB'); chunks.push(bytes); }
  };
  if (response.body) {
    const reader = response.body.getReader(); for (;;) { const item = await reader.read(); if (item.done) break; add(item.value); }
  } else add(new Uint8Array(await response.arrayBuffer()));
  let strippedSha256: string | undefined;
  if (stripC2pa) {
    const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    strippedSha256 = createHash('sha256').update(stripProbeCredential(bytes, stripC2pa)).digest('hex');
  }
  return { size, sha256: hash.digest('hex'), prefix: prefix.slice(0, prefixSize), strippedSha256 };
}
