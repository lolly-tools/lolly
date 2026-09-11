// SPDX-License-Identifier: MPL-2.0
/**
 * version-assets.ts - copy-on-write preservation for pinned assets (plans/97 section 6a).
 *
 * A published design-system version records the assets its tokens document named
 * as `{id, version, sha256}`. Publishing copies NO bytes: the overwhelmingly
 * common case is that a logo published in v1 is still the logo, and paying for a
 * second copy of every file at every publish would make versioning a storage tax
 * rather than a safety net.
 *
 * Bytes are copied at the one moment they would otherwise be lost. Whenever
 * something is about to replace, restamp, re-import or delete the bytes at a user
 * asset id, the bridge calls this preserver first (the four chokepoint methods in
 * bridge/assets.ts, and nowhere else). If any published version pins those exact
 * bytes, they are written to a content-keyed frozen id and the version's pin
 * learns where they went. The version ASSET and its checksum are never touched - 
 * that is what keeps "a published version is immutable" literally true.
 *
 * The cost of all this on a system that never published is one head-document
 * read - memoised by the tokens bridge, so a property read after the first - and
 * then step 3 returns before any IndexedDB read or hashing. On an install with no
 * tokens document at all the bridge deliberately does not memoise (it retries),
 * so the ABSENCE is memoised here instead; see NO_HEAD_TTL_MS.
 *
 * Fonts are recorded in a version's manifest but never frozen - see step 6a for
 * why bytes nothing can resolve are not worth the user's storage.
 *
 * Re-entrancy terminates by construction: upload(logo) → preserve → upload(frozen)
 * returns at step 1 → installUserTokens → upload(user/tokens/brand) returns at
 * step 1.
 */

import {
  frozenAssetId, readVersionIndex, sha256Hex, withVersionIndex,
} from '../../../../engine/src/design-version.ts';
import type { PinnedAsset, VersionEntry } from '../../../../engine/src/design-version.ts';
import { designMaterialOf } from '../../../../engine/src/design-system.ts';
import { installUserTokens } from './tokens.ts';

/** Where preserved bytes live. Machine-owned: hidden from the user's library
 *  listing (bridge/assets.ts) but counted in their storage total. */
export const FROZEN_PREFIX = 'user/frozen/';

/** One stored user asset, as much of it as a faithful frozen copy needs. */
interface PreservableRecord {
  id: string;
  type: string;
  format: string;
  blob?: Blob;
  version?: string;
  meta?: Record<string, unknown>;
}

/** The slice of the assembled web host this preserver drives. Everything is
 *  optional-shaped at the call sites it can't rely on, so a partial test host
 *  (or a bridge built before versions existed) degrades to doing nothing. */
export interface PinPreserverHost {
  assets: {
    _getUserRecord(id: string): Promise<PreservableRecord | null>;
    _getBlob(id: string): Promise<Blob | null>;
    _uploadUserAsset(record: {
      id: string; type: string; format: string; blob: Blob;
      version?: string; meta?: Record<string, unknown>;
    }, opts?: { skipQuota?: boolean }): Promise<void>;
  };
  tokens?: { raw?(): Promise<unknown>; bust?(): void; isLocked?(): Promise<boolean> };
  log?(level: string, message: string, ctx?: unknown): void;
}

/**
 * How long a "there is no design system on this device" answer is trusted.
 *
 * The head read is not memoised by the tokens bridge when it comes back null (by
 * design: a document that was not synced yet must be retried), so a bulk restore
 * would re-run full discovery - an IndexedDB miss and a `cache: 'no-store'` index
 * fetch - once per asset, on exactly the installs that get nothing from
 * versioning. A null head provably has no ledger and therefore no pins, so the
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
export function createPinPreserver(
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

    // 6a. A FONT is recorded in a version's manifest but never frozen. Version
    //     -scoped indirection is a document rewrite of `$type: 'asset'` leaves
    //     (applyPinnedAssets); a face is resolved by FAMILY out of the user font
    //     store, which no `user/frozen/*` id can join. A frozen copy would be
    //     bytes nothing can read, billed to the user under a line that says they
    //     buy fidelity - so the pin stays a truthful record of what the version
    //     used and falls back to the live face, which is what the panel says.
    if (rec.type === 'font') return;

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

    // 9. Point the pins at the copy. Only the head's LEDGER learns where the
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
    // ledger is a few KB replacing a few KB inside an operation that frees space.
    await installUserTokens(
      host as Parameters<typeof installUserTokens>[0],
      withVersionIndex(head, { versions, active: index.active }),
      { skipQuota: !!opts.reclaiming },
    );
  };
}
