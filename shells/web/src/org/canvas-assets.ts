// SPDX-License-Identifier: MPL-2.0
/** Project-file transfers for an already-open canvas, bound to its original account. */
import type { AssetRef } from '@lolly-tools/core/host-v1';
import { encodeCanvasAsset, portableCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import type { CanvasAssetsCapability } from '../lib/canvas-assets.ts';
import { getHostRef } from '../lib/host-ref.ts';
import { getInstanceBase } from '../lib/instance.ts';
import { assetVersionPin } from '../../../../engine/src/asset-version.ts';
import { fetchTeamSession } from './session-source.ts';
import { restoreTeamFiles, shareTeamFiles } from './team-files.ts';
import { shareCanvasToolImage } from './canvas-tool-image.ts';

export function createWorkCanvasAssets(sessionId: string, principal: () => string | undefined): CanvasAssetsCapability {
  const account = principal(), base = getInstanceBase();
  const listeners = new Set<(value: { pending: number; message: string }) => void>();
  let closed = false, pending = 0, message = '', failure = '', retry: (() => void) | undefined;
  const controller = new AbortController();
  const session = async () => { const result = await fetchTeamSession(sessionId); if (!result.ok) throw new Error('The project session could not be read.'); return result.data; };
  const check = () => { if (closed || !account || principal() !== account || getInstanceBase() !== base) throw new Error('Project access changed.'); };
  const publish = () => { for (const fn of listeners) fn({ pending, message }); };
  async function transfer<T>(label: string, action: () => Promise<T>): Promise<T> {
    check(); pending++; message = label; failure = ''; retry = undefined; publish();
    try { const result = await action(); check(); return result; }
    catch (error) { failure = 'Image transfer failed. Your upload is still on this device.'; throw error; }
    finally { pending--; if (!pending) message = failure; publish(); }
  }
  async function resolve(ref: AssetRef): Promise<AssetRef> {
    check(); const host = getHostRef(); if (!host?.assets) throw new Error('Asset storage is unavailable.');
    const data = await session(); check();
    if (ref.source === 'user') await restoreTeamFiles(host, { ...data, inputs: { image: ref } });
    check(); const result = await host.assets.get(ref.id, ref.pin); check(); return { ...result, ...(ref.pin ? { pin: ref.pin } : {}) };
  }
  return {
    holdEdit() { check(); pending++; message = 'Uploading image…'; publish(); let released = false;
      return () => { if (!released) { released = true; pending--; if (!pending) message = failure; publish(); } }; },
    async prepare(ref) {
      failure = '';
      return transfer('Uploading image…', async () => {
        const existing = portableCanvasAsset(ref);
        if (existing) return resolve(existing);
        const data = await session(); check();
        if (!data.projectId) throw new Error('This session has no project.');
        const host = getHostRef();
        const toolImage = await shareCanvasToolImage(data.projectId, ref, host, { signal: controller.signal });
        check();
        if (toolImage) return { ...await resolve(toolImage), meta: toolImage.meta };
        let pinned = ref;
        if (ref && typeof ref === 'object' && 'source' in ref && ref.source === 'user' && 'id' in ref && typeof ref.id === 'string') {
          const current = await host?.assets.get(ref.id, assetVersionPin(ref)); check();
          if (!current?.version) throw new Error('The uploaded image has no stored version.');
          pinned = { ...ref, pin: { version: current.version, format: current.format } };
        }
        const shared = await shareTeamFiles(data.projectId, { image: pinned }, host, { signal: controller.signal });
        check(); const portable = portableCanvasAsset(shared.image);
        if (!portable || !encodeCanvasAsset(portable)) throw new Error('This image cannot be shared in a live canvas.');
        return resolve(portable);
      });
    },
    resolve: ref => transfer('Loading image…', () => resolve(ref)),
    status: { subscribe(fn) { listeners.add(fn); fn({ pending, message }); return () => { listeners.delete(fn); }; } },
    failed(action) { retry = action; publish(); },
    retry() { const action = retry; retry = undefined; failure = ''; message = ''; action?.(); },
    close() { closed = true; controller.abort(); retry = undefined; listeners.clear(); },
  };
}
