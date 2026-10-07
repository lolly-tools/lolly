// SPDX-License-Identifier: MPL-2.0
/**
 * org/source-files - the files half of the workspace's session source (lolly plan 299
 * X8): shared folders and files for the asset picker, copies of them onto this device,
 * and their pictures. Each piece loads on first use, so the boot path carries none.
 *
 * org/index.ts hands this to createInstanceSessionSource, which keeps
 * org/session-source.ts free of the modules below; several of them read the session
 * source themselves.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { getHostRef } from '../lib/host-ref.ts';
import { getSessionSource, type SessionSourceFiles } from '../lib/session-source.ts';
import type { TeamFile } from './team-files.ts';

/** The largest image fetched only to show its picture. */
const PREVIEW_BYTES = 8 * 1024 * 1024;

function deviceHost(): HostV1 {
  const host = getHostRef();
  if (!host) throw new Error('The app is still starting. Try again in a moment.');
  return host;
}

/** `person` names whoever is signed in (their member id, or 'none'), which keeps one
 *  person's cached previews from another's on a shared device. */
export function createSourceFiles(person: () => string): SessionSourceFiles {
  const listed = new Map<string, TeamFile[]>();
  return {
    async listFolders(projectId) {
      const { listTeamFolders } = await import('./team-folders.ts');
      return (await listTeamFolders(projectId)).map(f => ({ id: f.id, name: f.name, parentId: f.parentId, items: f.items }));
    },
    async listFiles(projectId) {
      const { listTeamFiles } = await import('./team-files.ts');
      const files = (await listTeamFiles(projectId)).files.filter(f => f.ready);
      listed.set(projectId, files);
      return files.map(f => ({ id: f.id, name: f.name, size: f.size, type: typeof f.asset.type === 'string' ? f.asset.type : 'data' }));
    },
    async copyFile(projectId, fileId) {
      return (await import('./team-local-copy.ts')).copyTeamFileToLocal(deviceHost(), projectId, fileId);
    },
    async localSession(sessionId) {
      return (await import('./team-local-copy.ts')).teamSessionAsLocal(deviceHost(), sessionId);
    },
    async sessionPreview(sessionId) {
      const source = getSessionSource();
      return source ? (await import('./team-thumb.ts')).sharedSessionThumb(source, deviceHost(), sessionId, person()) : undefined;
    },
    // An image file listed a moment ago, small enough to fetch for its picture. It is
    // kept on the device under its shared id, as opening a session that uses it would.
    async filePreview(projectId, fileId) {
      const file = listed.get(projectId)?.find(f => f.id === fileId);
      if (!file || file.size > PREVIEW_BYTES || (file.asset.type !== 'raster' && file.asset.type !== 'svg')) return undefined;
      const host = deviceHost();
      const id = await (await import('./team-files.ts')).restoreTeamFile(host, projectId, file);
      return (await host.assets.get(id)).url;
    },
  };
}
