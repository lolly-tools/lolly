// SPDX-License-Identifier: MPL-2.0
/**
 * "Download as .lolly file" for a shared session (plan 296): a portable copy saved to
 * disk, for another device or for keeping. "Copy to my projects" (org/team-local-copy.ts)
 * is the other route, which makes a working local session in the app.
 *
 * The file carries this one session. The shared files it uses are fetched onto this
 * device first (org/team-files.ts restoreTeamFiles, as opening the session does), and
 * only the uploads the session refers to are handed to the builder. Catalog bytes go
 * through the same redistribution answer as the Share dialog's file
 * (views/tool-lolly-vehicle.ts lollyLibraryResolver), with nothing licensed included:
 * a held-back work travels as a reference and CREDITS.txt says why.
 */
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { ENGINE_VERSION, decodeAssetVersion } from '@lolly/engine';
import { ensureSceneManifest } from '../bridge/asset-dependencies.ts';
import { collectSessionAssetRefs, type BeamAssetRecord } from '../lib/beam-pack.ts';
import type { LollyBuildInput } from '../lib/lolly-pack.ts';
import { tRaw } from '../i18n.ts';
import { hasMethods } from '../lib/util/guards.ts';
import { fetchTeamSession } from '../org/session-source.ts';
import { restoreTeamFiles } from '../org/team-files.ts';
import { lollyLibraryResolver, type LollyAssetsSlice } from './tool-lolly-vehicle.ts';

const isLollyAssets = (assets: unknown): assets is LollyAssetsSlice => hasMethods(assets, ['get', '_getBlob', '_exportUserAssets']);

/** The session's own upload records, and no others. */
export async function sessionUserRecords(assets: LollyAssetsSlice, session: unknown): Promise<BeamAssetRecord[]> {
  // A 3D scene keeps its uploads inside a query only its manifest can read; prime it
  // first, exactly as the builder does, so the two walks find the same references.
  await ensureSceneManifest();
  const ids = [...new Set(collectSessionAssetRefs(session).user.map(key => decodeAssetVersion(key).id))];
  if (!ids.length) return [];
  if (assets._getUserRecord) {
    const read = assets._getUserRecord.bind(assets);
    return (await Promise.all(ids.map(id => read(id).catch(() => null)))).filter((record): record is BeamAssetRecord => !!record);
  }
  const wanted = new Set(ids);
  return (await assets._exportUserAssets()).filter(record => wanted.has(record.id));
}

/** Build the `.lolly` input for one shared session. Exported for tests. */
export async function teamSessionLollyInput(host: HostV1, sessionId: string, name: string): Promise<LollyBuildInput> {
  const got = await fetchTeamSession(sessionId);
  if (!got.ok) throw new Error(tRaw('This session is unavailable. Refresh and try again.'));
  const data = got.data, assets: unknown = host.assets;
  if (!isLollyAssets(assets)) throw new Error(tRaw('This app cannot save a session file here.'));
  await restoreTeamFiles(host, data);
  const session = { ...data.inputs, __toolId: data.toolId, ...(data.toolVersion ? { __toolVersion: data.toolVersion } : {}), __label: name };
  const { creatorFromProfile } = await import('../lib/lolly-pack.ts');
  const profile = await host.profile.get().catch(() => null);
  const appVersion = `Lolly ${ENGINE_VERSION}`;
  return {
    session, toolId: data.toolId, name,
    ...(data.toolVersion ? { toolVersion: data.toolVersion } : {}),
    userAssets: await sessionUserRecords(assets, session),
    ...(assets._getUserRecord ? { resolveUser: assets._getUserRecord.bind(assets) } : {}),
    resolveLibrary: lollyLibraryResolver(assets),
    includeLicensed: false,
    creator: creatorFromProfile(profile, { appVersion }), appVersion, engineVersion: ENGINE_VERSION,
  };
}

/** Save one shared session to disk as a `.lolly` file. */
export async function downloadTeamSessionFile(host: HostV1, sessionId: string, name: string, current: () => boolean): Promise<void> {
  const input = await teamSessionLollyInput(host, sessionId, name);
  if (!current()) return;
  const { buildLollyFile } = await import('../lib/lolly-pack.ts');
  const { blob, filename } = await buildLollyFile(input);
  if (current()) await host.export.download(blob, filename);
}
