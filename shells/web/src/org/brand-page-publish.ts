// SPDX-License-Identifier: MPL-2.0
/**
 * org/brand-page-publish - what the connected instance offers a brand page, read from
 * its org-config. `brandPages` is present only when the instance serves pages and this
 * caller may publish one, so its absence leaves Download as the way out. The instance
 * checks the bundle against its manifest and has the last word.
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { BrandPageHostingV1, BrandPagePublishedV1, ConnectedInstanceV1 } from '../lib/brand-page-hosting.ts';
import { artifactChecksum, sendApprovalFile } from './approval-artifact.ts';
import { brandEditHosting, type BrandEditsCapability } from './brand-edit-send.ts';

export interface BrandPagesCapability { maxBundleBytes: number; maxFileBytes?: number; partBytes: number; approval: boolean }

const JSON_HEADERS = { 'content-type': 'application/json' };

/** The instance's own address: the configured base, else this page's origin. */
function instanceOrigin(): string {
  return new URL(instancePath('/'), globalThis.location?.href ?? 'http://localhost/').origin;
}

/** Send one folder through the parts upload, then ask the instance to publish the folder. */
async function publishBundle(base: string, capability: BrandPagesCapability, bundle: Uint8Array): Promise<BrandPagePublishedV1> {
  const blob = new Blob([bundle as BlobPart], { type: 'application/zip' });
  const checksum = await artifactChecksum(blob);
  const uploadId = await sendApprovalFile({ blob, name: 'brand-page.zip' }, checksum, capability.partBytes, undefined, 'brand-page');
  const res = await instanceFetch(instancePath('/api/v1/brand-pages'), { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ uploadId, checksum }) });
  const body = await res.json().catch(() => null) as { page?: { slug?: string; url?: string }; unchanged?: boolean; approvalId?: string; error?: { message?: string; code?: string } | string } | null;
  if (!res.ok) {
    const failure = typeof body?.error === 'object' ? body.error : undefined;
    throw new Error(failure?.message || failure?.code || `HTTP ${res.status}`);
  }
  const slug = body?.page?.slug;
  if (!slug) throw new Error('The instance did not name the page.');
  return {
    // The instance's own answer first: its public address can differ from this shell's.
    url: body?.page?.url || `${base}/brand/${encodeURIComponent(slug)}/`,
    state: body?.approvalId ? 'pending' : body?.unchanged ? 'unchanged' : 'live',
  };
}

/** The report for the Design System Setup sheets. Null when no instance is connected. */
export function connectedInstanceFrom(config: { brandPages?: BrandPagesCapability | null; brandEdits?: BrandEditsCapability | null; can?: Record<string, boolean> | null } | null, connected: boolean): ConnectedInstanceV1 | null {
  if (!connected) return null;
  const base = instanceOrigin();
  const host = new URL(base).host;
  const capability = config?.brandPages;
  const brandPages: BrandPageHostingV1 | null = capability ? {
    host, base, approval: capability.approval === true, maxBundleBytes: capability.maxBundleBytes,
    publish: ({ bundle }) => publishBundle(base, capability, bundle),
  } : null;
  // The bit and the block together: an older server has neither, so nothing is offered.
  const edits = config?.can?.['brand.edit'] === true ? config.brandEdits : null;
  return { host, mcpUrl: `${base}/api/v1/mcp`, brandPages, brandEdits: edits ? brandEditHosting(host, base, edits) : null };
}
