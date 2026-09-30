// SPDX-License-Identifier: MPL-2.0
/** Copy-on-write preservation, loaded before an asset mutation starts. */
import {
  frozenAssetId, readVersionIndex, sha256Hex, withVersionIndex,
} from '../../../../engine/src/design-version.ts';
import type { PinnedAsset, VersionEntry } from '../../../../engine/src/design-version.ts';
import { designMaterialOf } from '../../../../engine/src/design-system.ts';
import { installUserTokens } from './tokens.ts';

import { FROZEN_PREFIX, type PinPreserverHost } from './version-assets-contract.ts';

/**
 * How long a "there is no design system on this device" answer is trusted.
 *
 * The head read is not memoised by the tokens bridge when it comes back null (by
 * design: a document that was not synced yet must be retried), so a bulk restore
 * would re-run full discovery - an IndexedDB miss and a `cache: 'no-store'` index
 * fetch - once per asset, on exactly the installs that get nothing from
 * versioning. A null head provably has no version index and therefore no pins, so the
 * only thing this window can miss is a design system becoming READABLE inside it;
 * any design system that is WRITTEN clears it immediately (step 1 below), which
 * covers every path on this device that creates one.
 */
const NO_HEAD_TTL_MS = 1500;

/**
 * Build the `preservePinned` hook bridge/assets.ts calls before it destroys the
 * bytes at a user asset id.
 *
 * Throwing refuses the write, which is the right trade in exactly one direction:
 * a user can retry a replacement, but nothing can recover a version's bytes once
 * they are gone. A version whose pinned bytes have ALREADY drifted (they changed
 * before this hook existed) is warned about and left alone - inventing a frozen
 * copy of the wrong bytes would be worse than an honest gap.
 */
export function createPinPreserverWriter(
  host: PinPreserverHost,
): (id: string, opts?: { reclaiming?: boolean }) => Promise<void> {
  /** When the last "no head document at all" answer expires (see NO_HEAD_TTL_MS). */
  let noHeadUntil = 0;

  return async function preservePinned(id: string, opts: { reclaiming?: boolean } = {}): Promise<void> {
    // 1. Ids that can never be pinned, cheapest first. `user/tokens/…` is the
    //    design system itself (the head and its versions), which versioning
    //    manages directly; a frozen row is already a preserved copy. A write
    //    there is also the one event that can turn "no design system" into one,
    //    so it retires the negative answer below.
    const material = designMaterialOf(id);
    if (material && (material.kind === 'tokens' || material.kind === 'version')) { noHeadUntil = 0; return; }
    if (!id.startsWith('user/') || id.startsWith(FROZEN_PREFIX)) return;

    // 2. The head document. Memoised in the tokens bridge whenever there IS one,
    //    so after the first call this is a property read; when there is none the
    //    bridge deliberately retries, so the absence is what gets a short memo.
    if (Date.now() < noHeadUntil) return;
    const head = await host.tokens?.raw?.().catch(() => null) ?? null;
    if (!head) { noHeadUntil = Date.now() + NO_HEAD_TTL_MS; return; }

    // 3. THE byte-identity gate: nothing published ⇒ no IndexedDB read, no
    //    hashing, no write. An install that never versions pays only for this.
    const index = readVersionIndex(head);
    if (!index.versions.length) return;

    // 4. Which pins name this id and have not already been preserved.
    const pins: PinnedAsset[] = [];
    for (const entry of index.versions) {
      for (const pin of entry.assets ?? []) if (pin.id === id && !pin.frozenId) pins.push(pin);
    }
    if (!pins.length) return;

    // 5-6. The bytes about to be lost, and what they actually are.
    const rec = await host.assets._getUserRecord(id);
    if (!rec?.blob) return;

    // Legacy font pins without face descriptors remain record-only. New font
    // pins are read by the release resolver and need copy-on-write preservation.
    if (rec.type === 'font' && !pins.some(p => p.font)) return;

    const hex = await sha256Hex(new Uint8Array(await rec.blob.arrayBuffer()));

    // 7. Only pins that meant THESE bytes. A pin whose checksum no longer
    //    matches drifted before this hook could see it; freezing the current
    //    bytes under its name would fabricate history.
    const live = pins.filter(p => p.sha256 === hex);
    if (!live.length) {
      host.log?.('warn',
        `assets: “${id}” is pinned by a published design-system version, but its bytes already differ from what was published`);
      return;
    }

    // 8. Content-keyed, so two versions pinning identical bytes share one copy.
    //    `skipQuota` on the DELETE path only: there the preserved copy takes the
    //    place of bytes being released in the same operation, so charging for it
    //    would let a near-full device refuse the delete that frees the space.
    const frozenId = frozenAssetId(hex);
    if (!await host.assets._getBlob(frozenId)) {
      await host.assets._uploadUserAsset({
        id: frozenId,
        type: rec.type,
        format: rec.format,
        blob: rec.blob,
        version: rec.version ?? '1.0.0',
        meta: { ...rec.meta, kind: 'frozen', originalId: id, sha256: hex },
      }, { skipQuota: !!opts.reclaiming });
    }

    // 9. Point the pins at the copy. Only the head's VERSION INDEX learns where the
    //    bytes went - the version asset and its checksum are untouched, which is
    //    what keeps a published version immutable.
    const versions: VersionEntry[] = index.versions.map(entry => {
      if (!entry.assets?.some(p => p.id === id && p.sha256 === hex && !p.frozenId)) return entry;
      return {
        ...entry,
        assets: entry.assets.map(p =>
          p.id === id && p.sha256 === hex && !p.frozenId ? { ...p, frozenId } : p),
      };
    });
    // No label: this write repoints pins and nothing else. The chokepoint keeps
    // whatever the system is already called (installUserTokens → headName), so a
    // design system named "Acme" is not silently renamed by a logo replacement.
    // `skipQuota` on the delete path for the same reason step 8 has it: the
    // version index is a few KB replacing a few KB inside an operation that frees space.
    await installUserTokens(
      host as Parameters<typeof installUserTokens>[0],
      withVersionIndex(head, { versions, active: index.active }),
      { skipQuota: !!opts.reclaiming },
    );
  };
}
