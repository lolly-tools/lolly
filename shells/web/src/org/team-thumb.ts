// SPDX-License-Identifier: MPL-2.0
/** One shared session's preview, for the Projects view and the asset picker alike. */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getTool } from '../bridge/tool-loader.ts';
import { getInstanceBase } from '../lib/instance.ts';
import type { SessionSource } from '../lib/session-source.ts';
import { restoreTeamFiles } from './team-files.ts';

/**
 * Render a shared session from its current saved state. The render is cached per
 * workspace, person (`person`, the member's id or 'none') and project, so a preview
 * never crosses from one person to another on a shared device. `current` stops the
 * work early once nobody needs the picture.
 */
export async function sharedSessionThumb(source: SessionSource, host: HostV1, id: string, person: string, current: () => boolean = () => true): Promise<string | undefined> {
  const data = await source.fetchSession(id);
  if (!data || !current()) return;
  await restoreTeamFiles(host, data);
  if (!current()) return;
  const tool = await getTool(data.toolId);
  const { renderFeaturedVariant } = await import('../lib/featured-render.ts');
  const scope = `${getInstanceBase()}:${person}:${data.projectId}`;
  const thumb = await renderFeaturedVariant(host, data.toolId, tool.manifest.render?.formats, `${id}:${data.rev ?? data.updatedAt}`, data.inputs, `team:${scope}`);
  return current() ? thumb : undefined;
}
