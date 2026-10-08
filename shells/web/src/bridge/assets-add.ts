// SPDX-License-Identifier: MPL-2.0
/**
 * host.assets.add (v1.246): a tool saves a file the person made into their Assets.
 *
 * The file takes the ordinary upload ingest (views/picker.ts storeUserUpload, which
 * bridge/index.ts hands in as `store`, so this module imports nothing from views/),
 * so a `.rondo.json` becomes a song asset, a WAV becomes audio, and a duplicate of
 * something already in the library is offered back rather than stored twice.
 *
 * Three rules keep a tool from filling someone's library on its own:
 *   - the page must have had the person's action (sticky user activation): a save
 *     can follow a click by however long a render takes, so the transient window
 *     would refuse honest saves, but a page nobody touched never saves;
 *   - at most SAVE_BURST saves in SAVE_WINDOW_MS per page;
 *   - every save is said out loud: a toast gives the file name and offers Undo, which
 *     removes only an asset this call created, never one the duplicate prompt
 *     handed back.
 */
import type { AssetAddInput, AssetRef } from '@lolly-tools/core/host-v1';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';

const SAVE_BURST = 10;
const SAVE_WINDOW_MS = 60_000;
const MAX_BYTES = 512 * 1024 * 1024;
const recent: number[] = [];

export class AssetAddError extends Error {
  override name = 'AssetAddError';
  readonly code: string;
  constructor(message: string, code: string) {
    super(message);
    this.code = code;
  }
}

/** The two library calls a save needs: what is there already, and the Undo. */
export interface AddAssets {
  _listUserAssets(): Promise<AssetRef[]>;
  _deleteUserAsset(id: string): Promise<void>;
}

/** The upload ingest: one file in, the stored asset out. */
export type StoreUpload = (file: File) => Promise<AssetRef>;

const activated = (): boolean => {
  const ua = (globalThis.navigator as { userActivation?: { hasBeenActive: boolean } } | undefined)?.userActivation;
  return ua ? ua.hasBeenActive : true;
};

export async function addToAssets(assets: AddAssets, file: AssetAddInput, store: StoreUpload): Promise<AssetRef> {
  if (!file || typeof file.name !== 'string' || !file.name.trim() || !(file.bytes instanceof Uint8Array)) {
    throw new AssetAddError('assets.add needs a file name and its bytes.', 'assets.add.invalid');
  }
  if (file.bytes.byteLength === 0) throw new AssetAddError('assets.add was given an empty file.', 'assets.add.empty');
  if (file.bytes.byteLength > MAX_BYTES) throw new AssetAddError('That file is too large to save to Assets.', 'assets.add.size');
  if (!activated()) throw new AssetAddError('Saving to Assets needs the person to ask for it.', 'assets.add.no-gesture');
  const now = Date.now();
  while (recent.length && now - (recent[0] as number) > SAVE_WINDOW_MS) recent.shift();
  if (recent.length >= SAVE_BURST) throw new AssetAddError('Too many saves in a short time.', 'assets.add.rate');
  recent.push(now);

  const before = new Set((await assets._listUserAssets()).map((a) => a.id));
  const name = file.name.trim().replace(/[\\/]/g, '-').slice(0, 200);
  const ref = await store(new File([file.bytes as BlobPart], name, { type: file.mime ?? '' }));
  const created = !before.has(ref.id);
  const label = String(ref.meta?.name ?? name);
  const message = created
    ? tRaw('Saved “{name}” to your Assets.', { name: label })
    : tRaw('“{name}” is already in your Assets.', { name: label });
  announce(message);
  const { showUndoToast } = await import('../lib/undo-toast.ts');
  if (created) {
    showUndoToast({
      message,
      undo: () => { void assets._deleteUserAsset(ref.id).then(() => announce(t('Removed from your Assets.'))); },
    });
  } else {
    showUndoToast({ message, undo: () => {}, actionLabel: t('Dismiss') });
  }
  return ref;
}
