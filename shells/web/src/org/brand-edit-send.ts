// SPDX-License-Identifier: MPL-2.0
/**
 * org/brand-edit-send - sending the connected instance an edit of its design system.
 * The instance compares the document with its mounted one and has the last word, so
 * a refusal arrives here as the sentence it wrote. Present only when org-config says
 * this caller may send one, so anyone else has no way in from the app.
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { BrandEditDocumentV1, BrandEditHostingV1, BrandEditPreviewV1, BrandEditSentV1 } from '../lib/brand-page-hosting.ts';

export interface BrandEditsCapability { maxDocumentBytes: number; approval: boolean }

const JSON_HEADERS = { 'content-type': 'application/json' };

async function digestOf(text: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  return [...digest].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** The answer's body, or the sentence the instance gave for refusing. */
async function answered<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null) as (T & { error?: { message?: string; code?: string } | string }) | null;
  if (!res.ok) {
    const failure = typeof body?.error === 'object' ? body.error : undefined;
    throw new Error(failure?.message || failure?.code || `HTTP ${res.status}`);
  }
  return body as T;
}

export function brandEditHosting(host: string, base: string, capability: BrandEditsCapability): BrandEditHostingV1 {
  return {
    host, base, approval: capability.approval === true, maxDocumentBytes: capability.maxDocumentBytes,
    read: async () => answered<BrandEditDocumentV1>(await instanceFetch(instancePath('/api/v1/brand/edits/document'))),
    preview: async ({ document, base: baseChecksum }) => answered<BrandEditPreviewV1>(await instanceFetch(instancePath('/api/v1/brand/edits/preview'), {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ document, digest: await digestOf(document), base: baseChecksum }),
    })),
    send: async ({ document, base: baseChecksum, revision, reviewToken }) => answered<BrandEditSentV1>(await instanceFetch(instancePath('/api/v1/brand/edits'), {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ document, digest: await digestOf(document), base: baseChecksum, revision, reviewToken }),
    })),
  };
}
