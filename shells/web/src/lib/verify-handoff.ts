// SPDX-License-Identifier: MPL-2.0
/**
 * A one-shot, in-memory handoff of files to the Verify view (#/verify). The catalog
 * details "Check credentials" action prepares an asset's bytes here, then navigates to
 * Verify, which picks them up on mount and runs the same on-device C2PA check as a drop.
 *
 * In-memory (real File bytes, not a URL) so it works for user uploads whose object URLs
 * are ephemeral, and survives the hash navigation without leaking anything into the URL.
 * A `note` rides along to explain provenance the file itself can't (e.g. that Lolly
 * re-encoded the image on import, so a captured credential no longer binds byte-for-byte).
 */

import { C2PA_FORMATS, attachC2paStore, extractC2paStore } from '@lolly/engine';
import type { AssetRef, HostV1 } from '@lolly-tools/core/host-v1';
import { t } from '../i18n.ts';

export interface VerifyHandoff {
  files: File[];
  /** Optional context banner shown above the report (e.g. re-encoded-on-import caveat). */
  note?: string;
}

let pending: VerifyHandoff | null = null;

export function setPendingVerify(handoff: VerifyHandoff): void {
  pending = handoff;
}

/** Consume the pending handoff (single use - cleared on read). */
export function takePendingVerify(): VerifyHandoff | null {
  const p = pending;
  pending = null;
  return p;
}

/**
 * Prepare an asset's bytes for the Verify check - shared by the catalog's "Check
 * credentials" action (which then hands off in memory and navigates) and the
 * `#/verify?asset=<id>` deep link (plan 171), so a warm hop and a cold link run
 * the SAME preparation and reach the same verdict. The stored copy is the source
 * of truth: bytes still carrying a Content Credential are checked verbatim; a TTS
 * clip saved before the wav embed shipped is healed first (shouldHealTts refuses
 * anything without the stored recipe, so recorded/uploaded audio is never
 * stamped); and where ingest re-encoded the file and dropped the in-file
 * manifest, the credential captured at ingest is re-attached with a note saying
 * the binding no longer reads byte-for-byte. Returns null when the bytes can't
 * be fetched; `healed` tells the catalog to refresh its grid ref (the record now
 * serves a fresh object URL).
 */
export async function prepareAssetForVerify(
  host: HostV1,
  ref: AssetRef,
): Promise<(VerifyHandoff & { healed: boolean }) | null> {
  try {
    const name = String(ref.meta?.name ?? ref.id);
    const resp = await fetch(ref.url);
    let bytes: Uint8Array = new Uint8Array(await resp.arrayBuffer());
    let note: string | undefined;
    let healed = false;
    const fmt = String(ref.format ?? '').toLowerCase();
    if (ref.source === 'user') {
      try {
        const { shouldHealTts, healTtsProvenance } = await import('./tts-provenance.ts');
        if (shouldHealTts(ref, bytes)) {
          // The web shell's real assets bridge always carries the internal
          // _restampUserAsset - the structural cast is the established idiom for
          // internal methods that aren't on the public HostV1 surface.
          const fresh = await healTtsProvenance(host as import('./tts-provenance.ts').TtsHealHost, ref, bytes);
          if (fresh) {
            bytes = new Uint8Array(await fresh.arrayBuffer());
            healed = true;
          }
        }
      } catch { /* heal is additive - the plain bytes still get checked */ }
    }
    if (!extractC2paStore(bytes)) {
      // Stored file has no embedded credential - fall back to the one captured at ingest.
      let cred: { store: Uint8Array; format: string } | null = null;
      try { cred = (await host.assets.credential?.(ref.id)) ?? null; } catch { cred = null; }
      if (cred?.store && C2PA_FORMATS.includes(fmt)) {
        try {
          bytes = attachC2paStore(bytes, fmt, cred.store);
          note = t('This Content Credential was captured when the file was imported. Lolly re-encoded the image on import, so it no longer binds to the stored copy byte-for-byte - the credential reads as "modified", but the provenance claims below are intact.');
        } catch { /* re-attach failed - hand over the plain bytes and let Verify report */ }
      }
    }
    const file = new File([bytes as BlobPart], name, { type: resp.headers.get('content-type') || undefined });
    return { files: [file], note, healed };
  } catch {
    return null;
  }
}
