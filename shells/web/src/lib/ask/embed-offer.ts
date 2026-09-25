// SPDX-License-Identifier: MPL-2.0
/**
 * Should the Ask "Better matching" chip offer the matching model here?
 *
 * The chip used to appear only when the build's precache.json had an embed group,
 * so on a dev server or `tauri dev` (no precache.json) it never appeared, even
 * though the model host serves the files. The answer now comes from
 * lib/model-parts.ts, the same facts Profile's Ask matching model row reads: the
 * policy allows it, the host serves it, and it is not on this device yet. The
 * manifest it returns has the embed group filled from the committed model listing
 * when precache.json lacks it, so downloadEmbedModel fetches the right files.
 */
import type { PrecacheManifest } from '../offline-manager.ts';

export interface EmbedOffer {
  /** The manifest to download from. */
  manifest: PrecacheManifest;
  /** The part's full size as Profile's row states it, when known. */
  bytes?: number;
}

/** What the chip offers when it should offer the model, else null. */
export async function embedModelOffer(): Promise<EmbedOffer | null> {
  const { modelPartInfo, modelPrecache, withModelFiles } = await import('../model-parts.ts');
  const precache = await modelPrecache().catch(() => null);
  const info = await modelPartInfo('ask', { precache });
  if (!info.allowed || !info.available || info.ready === true) return null;
  return { manifest: withModelFiles(precache).manifest, bytes: info.bytes };
}
