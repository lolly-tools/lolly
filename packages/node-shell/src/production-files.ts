// SPDX-License-Identifier: MPL-2.0
import { open } from 'node:fs/promises';
import { parseProductionSpec } from '@lolly/engine';
export async function productionFile(path: string, maxBytes: number): Promise<Uint8Array> {
  const file = await open(path, 'r');
  try {
    const size = (await file.stat()).size;
    if (size > maxBytes) throw new Error('Production file exceeds its byte budget.');
    const buffer = new Uint8Array(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) { const { bytesRead } = await file.read(buffer, length, buffer.length - length, null); if (!bytesRead) break; length += bytesRead; }
    if (length > maxBytes) throw new Error('Production file exceeds its byte budget.');
    return buffer.slice(0, length);
  } finally { await file.close(); }
}
export async function productionContractFile(path: string) {
  return parseProductionSpec(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(await productionFile(path, 128 * 1024))));
}
