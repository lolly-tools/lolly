// SPDX-License-Identifier: MPL-2.0
/**
 * An approved file kept in this person's own library, so it can sit in a project and
 * show in Assets. The bytes are stored verbatim and the record keeps the request they
 * came from. It is a personal upload like any other: nothing here reaches an
 * organisation catalog.
 */
import { recordType, renderKindForFormat } from './save-render.ts';

/** The request a kept file came from, on the asset's own record. */
export interface ApprovedAssetLink {
  /** The request's id on its own instance. */
  id: string;
  /** The instance, so another workspace never reads this id as its own. */
  instance: string;
  /** The digest the request recorded for these exact bytes. */
  sha256: string;
  decidedAt: string;
}

export interface ApprovedAssetHost {
  assets: {
    _uploadUserAsset(record: {
      id: string; type: string; format: string; blob: Blob; version: string; checksum?: string;
      width?: number; height?: number; meta: Record<string, unknown>;
    }): Promise<void>;
    _listUserAssets(): Promise<ReadonlyArray<{ id: string }>>;
  };
}

/** The asset id for a request's file: one request, one kept copy. Pure. */
export const approvedAssetId = (approvalId: string): string => `user/approved/${approvalId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

/** The approval a stored asset's record carries, or null. Pure. */
export function approvalLinkOf(meta: Readonly<Record<string, unknown>> | undefined): ApprovedAssetLink | null {
  const link = meta?.approval as Partial<ApprovedAssetLink> | undefined;
  return link && typeof link.id === 'string' && typeof link.instance === 'string' && typeof link.decidedAt === 'string'
    ? { id: link.id, instance: link.instance, sha256: typeof link.sha256 === 'string' ? link.sha256 : '', decidedAt: link.decidedAt }
    : null;
}

/** Keep the file, once. Returns its asset id. */
export async function storeApprovedFile(host: ApprovedAssetHost, input: {
  blob: Blob; name: string; format: string; toolId: string; width?: number; height?: number; link: ApprovedAssetLink;
}): Promise<string> {
  const id = approvedAssetId(input.link.id);
  const held = await host.assets._listUserAssets().catch(() => [] as ReadonlyArray<{ id: string }>);
  if (held.some(asset => asset.id === id)) return id;
  await host.assets._uploadUserAsset({
    id,
    type: recordType(renderKindForFormat(input.format), input.format),
    format: input.format,
    blob: input.blob,
    version: '1.0.0',
    ...(input.link.sha256 ? { checksum: input.link.sha256 } : {}),
    ...(input.width ? { width: input.width } : {}),
    ...(input.height ? { height: input.height } : {}),
    meta: { name: input.name, tags: ['approved'], toolId: input.toolId, format: input.format, approval: input.link },
  });
  return id;
}
