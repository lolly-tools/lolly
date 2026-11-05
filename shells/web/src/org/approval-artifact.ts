// SPDX-License-Identifier: MPL-2.0
/**
 * org/approval-artifact - the file an approval request carries: its digest, a local
 * preview for the requester's dialog, and the upload to the instance in its
 * fixed-size parts, each part retried a few times. A failed upload deletes its
 * unfinished file, so nothing half-sent holds the requester's budget until it
 * expires. The bytes are exactly what the export made; nothing here changes them.
 *
 * Comments describe a generic "instance" capability, never a specific product.
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { ApprovalArtifact } from '../lib/approval-request.ts';

const JSON_HEADERS = { 'content-type': 'application/json' };

/** Waits before each retry of one part: three retries, further apart each time.
 *  Exported so tests can shorten them. */
export const ARTIFACT_RETRY_DELAYS_MS = [500, 1500, 4000];

/** A refusal from the instance, with its stable code when it sent one. */
export class ApprovalArtifactError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  constructor(status: number, code?: string) {
    super(code ?? `HTTP ${status}`);
    this.status = status;
    this.code = code;
  }
}

async function digest(bytes: BufferSource): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), n => n.toString(16).padStart(2, '0')).join('');
}

/** The file's SHA-256, for the dialog and the upload. */
export const artifactChecksum = async (blob: Blob): Promise<string> => digest(await blob.arrayBuffer());

/** The format the instance is told: the file's own extension, which the export chose
 *  from what it actually wrote (a multi-page still is a `.zip`). */
export function artifactFormat(name: string): string {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  return /^[a-z0-9][a-z0-9+.-]{0,23}$/.test(ext) ? ext : 'bin';
}

async function errorCode(res: Response): Promise<string | undefined> {
  try {
    const body = (await res.json()) as { error?: { code?: string } | string; code?: string };
    return typeof body.error === 'object' ? body.error?.code : body.error ?? body.code;
  } catch { return undefined; }
}

async function send(path: string, init: RequestInit): Promise<Response> {
  const res = await instanceFetch(instancePath(path), init);
  if (!res.ok) throw new ApprovalArtifactError(res.status, await errorCode(res));
  return res;
}

async function putPart(path: string, body: Blob): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      await send(path, { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body });
      return;
    } catch (error) {
      const status = error instanceof ApprovalArtifactError ? error.status : 0;
      const passing = status === 0 || status === 429 || status >= 500;
      const wait = ARTIFACT_RETRY_DELAYS_MS[attempt];
      if (!passing || wait === undefined) throw error;
      await new Promise(resolve => setTimeout(resolve, wait));
    }
  }
}

/** Send the file in parts and finish the upload. Returns the upload id the request
 *  refers to. `onProgress` reports bytes sent so far. */
export async function sendApprovalFile(
  artifact: ApprovalArtifact, checksum: string, partBytes: number, onProgress?: (sent: number, total: number) => void,
): Promise<string> {
  const { blob, name } = artifact;
  const parts: Array<{ size: number; checksum: string }> = [];
  for (let at = 0; at < blob.size; at += partBytes) {
    const part = blob.slice(at, at + partBytes);
    parts.push({ size: part.size, checksum: await digest(await part.arrayBuffer()) });
  }
  const contentType = blob.type.split(';')[0] || 'application/octet-stream';
  const begun = await send('/api/v1/uploads', {
    method: 'POST', headers: JSON_HEADERS,
    body: JSON.stringify({ scope: 'approval-artifact', name, contentType, size: blob.size, checksum, parts }),
  });
  const { upload } = (await begun.json()) as { upload: { id: string } };
  const at = `/api/v1/uploads/${encodeURIComponent(upload.id)}`;
  let finalizing = false;
  try {
    let sent = 0;
    onProgress?.(0, blob.size);
    for (let n = 0; n < parts.length; n++) {
      await putPart(`${at}/parts/${n}`, blob.slice(sent, sent + parts[n]!.size));
      sent += parts[n]!.size;
      onProgress?.(sent, blob.size);
    }
    finalizing = true;
    await send(`${at}/finalize`, { method: 'POST', headers: JSON_HEADERS, body: '{}' });
    return upload.id;
  } catch (error) {
    // Finalize may have worked with its answer lost, so a failure there leaves the
    // upload to expire rather than deleting something finished.
    if (!finalizing) await instanceFetch(instancePath(at), { method: 'DELETE' }).catch(() => undefined);
    throw error;
  }
}
