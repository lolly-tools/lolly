// SPDX-License-Identifier: MPL-2.0
/** A composed tool image becomes an immutable project file before entering the live document. */
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { portableCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import { parseEmbedUrl } from '../../../../engine/src/embed.ts';
import { isRecord } from '../lib/util/guards.ts';
import { uploadTeamFile, type TeamFileTransfer } from './team-files.ts';

const MAX_RENDER_URL = Math.ceil(256 * 1024 * 1024 * 4 / 3) + 1024;

export async function shareCanvasToolImage(projectId: string, value: unknown, host: HostV1 | null,
  transfer: TeamFileTransfer): Promise<AssetRef | null> {
  if (!isRecord(value) || value.source !== 'remote') return null;
  const recipe = typeof value.id === 'string' ? value.id : '';
  const embed = parseEmbedUrl(recipe);
  if (!embed || (value.type !== 'vector' && value.type !== 'raster')) return null;
  // Read only a local render. A peer-supplied web URL is never fetched as image bytes.
  let renderUrl = value.url;
  if (typeof renderUrl !== 'string' || !/^(?:data:image\/|blob:)/.test(renderUrl)) {
    const fresh = await host?.compose?.renderUrl?.(recipe);
    if (!fresh) throw new Error('The tool image could not be rendered.');
    renderUrl = fresh.url;
  }
  if (typeof renderUrl !== 'string' || !/^(?:data:image\/|blob:)/.test(renderUrl)
    || renderUrl.length > MAX_RENDER_URL) throw new Error('The tool image is unavailable.');
  const response = await fetch(renderUrl, { signal: transfer.signal });
  if (!response.ok) throw new Error('The tool image is unavailable.');
  const name = isRecord(value.meta) && typeof value.meta.name === 'string' ? value.meta.name : embed.toolId;
  const file = await uploadTeamFile(projectId, await response.blob(), `${name}.${embed.format}`, transfer);
  const shared = portableCanvasAsset({ id: `user/team/${file.id}`, source: 'user',
    type: file.asset.type, format: file.asset.format, width: value.width, height: value.height,
    pin: { version: file.checksum, format: file.asset.format } });
  if (!shared) throw new Error('The rendered image cannot be shared in this canvas.');
  return { ...shared, meta: { toolUrl: recipe, name } };
}
