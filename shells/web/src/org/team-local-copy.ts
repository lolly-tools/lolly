// SPDX-License-Identifier: MPL-2.0
/**
 * org/team-local-copy - copy shared work into the person's own projects (lolly plan
 * 299): one shared session, a selection of them, or a whole shared project with its
 * folders.
 *
 * Each session is fetched, the shared files it uses are restored onto the device and
 * then copied under new local ids, so the copy keeps working after the person signs
 * out or loses access, and it is saved as a new local session. The shared originals
 * never change. This is the reverse of org/team-folder-share.ts, which copies a local
 * folder into a new shared project.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { decodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import { createFolderStore, type FolderHost } from '../folders.ts';
import { collectSessionAssetRefs, rewriteSessionAssetRefs, type BeamAssetRecord } from '../lib/beam-pack.ts';
import { rebaseImportedAssetPins } from '../lib/session-asset-versions.ts';
import type { TeamSessionData } from '../lib/session-source.ts';
import { hasMethods } from '../lib/util/guards.ts';
import { fetchTeamSession, fetchTeamProjectSessions } from './session-source.ts';
import { listTeamFolders } from './team-folders.ts';
import { listTeamFiles, restoreTeamFile, restoreTeamFiles } from './team-files.ts';

interface AssetStore {
  _getUserRecord(id: string, version?: string): Promise<BeamAssetRecord | null>;
  _uploadUserAsset(record: BeamAssetRecord): Promise<unknown>;
  _listUserAssets?(): Promise<Array<{ id: string; meta?: Record<string, unknown> }>>;
}
type CopyHost = HostV1 & FolderHost & { state: { save(slot: string, data: Record<string, unknown>, thumb?: string | null): Promise<void> } };

export interface LocalCopyProgress { done: number; total: number }
export interface LocalCopyResult { folderId: string | null; copied: number; failed: number }

const isStore = (assets: unknown): assets is AssetStore => hasMethods(assets, ['_getUserRecord', '_uploadUserAsset']);

/**
 * One shared session as a local saved session: its inputs at the top level, its tool,
 * version and label under the reserved keys, and every shared file it uses copied
 * under a new local id. Exported for tests.
 */
export async function localSessionData(host: HostV1, data: TeamSessionData): Promise<Record<string, unknown>> {
  await restoreTeamFiles(host, data);
  const shared = collectSessionAssetRefs(data.inputs).user.filter((key) => decodeAssetVersion(key).id.startsWith('user/team/'));
  let inputs: Record<string, unknown> = data.inputs;
  if (shared.length) {
    const assets: unknown = host.assets;
    if (!isStore(assets)) throw new Error('This device cannot keep a copy of the shared files.');
    const rekey = new Map<string, string>();
    const records: BeamAssetRecord[] = [];
    for (const key of shared) {
      const dep = decodeAssetVersion(key);
      const record = await assets._getUserRecord(dep.id, dep.pin?.version);
      if (!record?.blob) throw new Error('A shared file could not be copied.');
      const id = `user/upload/${crypto.randomUUID()}`;
      const copy: BeamAssetRecord = { ...record, id };
      await assets._uploadUserAsset(copy);
      rekey.set(key, id);
      records.push(copy);
    }
    const mapped = rewriteSessionAssetRefs(inputs, rekey);
    if (mapped.unresolved.length) throw new Error('A shared file could not be copied.');
    inputs = rebaseImportedAssetPins(mapped.data, rekey, records);
  }
  const label = typeof data.meta?.label === 'string' ? data.meta.label : undefined;
  return {
    ...inputs, __toolId: data.toolId,
    ...(data.toolVersion ? { __toolVersion: data.toolVersion } : {}),
    ...(label ? { __label: label } : {}),
  };
}

/** One shared session as local session data, or null when it is gone. The asset
 *  picker places it as a render; nothing is saved. */
export async function teamSessionAsLocal(host: HostV1, sessionId: string): Promise<Record<string, unknown> | null> {
  const got = await fetchTeamSession(sessionId);
  return got.ok ? localSessionData(host, got.data) : null;
}

/**
 * Copy one shared file into the person's own uploads (an asset picker pick) and
 * resolve the local id. The copy records which project file and version it came
 * from, so picking the same version again reuses it rather than adding a duplicate.
 */
export async function copyTeamFileToLocal(host: HostV1, projectId: string, fileId: string): Promise<string> {
  const assets: unknown = host.assets;
  if (!isStore(assets)) throw new Error('This device cannot keep a copy of the shared files.');
  const file = (await listTeamFiles(projectId)).files.find(f => f.id === fileId && f.ready);
  if (!file) throw new Error('A shared file could not be copied.');
  const copiedFrom = `${projectId}/${file.id}@${file.checksum}`;
  const earlier = (await assets._listUserAssets?.().catch(() => []))?.find(a => a.meta?.copiedFrom === copiedFrom);
  if (earlier) return earlier.id;
  const record = await assets._getUserRecord(await restoreTeamFile(host, projectId, file), file.checksum);
  if (!record?.blob) throw new Error('A shared file could not be copied.');
  const id = `user/upload/${crypto.randomUUID()}`;
  await assets._uploadUserAsset({ ...record, id, meta: { ...record.meta, copiedFrom } });
  return id;
}

async function saveCopy(host: CopyHost, sessionId: string): Promise<string | null> {
  const got = await fetchTeamSession(sessionId);
  if (!got.ok) return null;
  try {
    const data = await localSessionData(host, got.data);
    const slot = `${got.data.toolId}:${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
    await host.state.save(slot, data, null);
    return slot;
  } catch (error) {
    host.log?.('warn', 'team copy: a session could not be copied', { sessionId, error: String(error) });
    return null;
  }
}

/** Copy shared sessions into one of the person's folders, or the top of Projects
 *  when `folderId` is null. */
export async function copyTeamSessionsToLocal(
  host: CopyHost, sessionIds: readonly string[], folderId: string | null,
  onProgress?: (p: LocalCopyProgress) => void,
): Promise<LocalCopyResult & { folderId: string | null }> {
  const store = createFolderStore(host);
  let copied = 0, failed = 0;
  for (const [i, id] of sessionIds.entries()) {
    const slot = await saveCopy(host, id);
    if (slot) { if (folderId) await store.addItem(folderId, { type: 'session', ref: slot }); copied++; } else failed++;
    onProgress?.({ done: i + 1, total: sessionIds.length });
  }
  return { folderId, copied, failed };
}

/**
 * Copy a whole shared project into a new local folder with the same name, keeping its
 * folders as local subfolders. Sessions outside any folder land at the top.
 */
export async function copyTeamProjectToLocal(
  host: CopyHost, project: { id: string; name: string }, parentId: string | null = null,
  onProgress?: (p: LocalCopyProgress) => void,
): Promise<LocalCopyResult> {
  const [sessions, folders] = await Promise.all([fetchTeamProjectSessions(project.id), listTeamFolders(project.id).catch(() => [])]);
  if (!sessions.ok) throw new Error('The shared project could not be read.');
  const store = createFolderStore(host);
  const root = await store.create(project.name, parentId);
  const local = new Map<string, string>();
  const ensure = async (folderId: string | null, seen = new Set<string>()): Promise<string> => {
    if (!folderId) return root.id;
    const made = local.get(folderId);
    if (made) return made;
    const shared = folders.find((f) => f.id === folderId);
    if (!shared || seen.has(folderId)) return root.id;
    seen.add(folderId);
    const parent = await ensure(shared.parentId, seen);
    const folder = await store.create(shared.name, parent);
    local.set(folderId, folder.id);
    return folder.id;
  };
  for (const f of folders) await ensure(f.id);
  const home = new Map<string, string | null>();
  for (const f of folders) for (const item of f.items) if (item.kind === 'session') home.set(item.ref, f.id);
  let copied = 0, failed = 0;
  for (const [i, session] of sessions.sessions.entries()) {
    const slot = await saveCopy(host, session.id);
    if (slot) { await store.addItem(await ensure(home.get(session.id) ?? null), { type: 'session', ref: slot }); copied++; } else failed++;
    onProgress?.({ done: i + 1, total: sessions.sessions.length });
  }
  return { folderId: root.id, copied, failed };
}
