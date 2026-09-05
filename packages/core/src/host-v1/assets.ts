// SPDX-License-Identifier: MPL-2.0

import type { AssetRef } from './asset-ref.ts';

// ─── Assets ─────────────────────────────────────────────────────────────────

export interface AssetsAPI {
  /** Resolve a logical provider://scope/path ref. Null selects the normal fallback. */
  resolveProvider?(ref: {
    raw: string;
    provider: string;
    scope: string;
    path: string;
    query: Readonly<Record<string, string>>;
  }): Promise<AssetRef | null>;

  /**
   * Resolve a specific asset by id. Throws if not found and not in user uploads.
   *
   * 1.6.0: the id may carry an icon colour pairing - `<baseId>?theme=<themeId>`
   * (see engine icon-theme.js). Bridges resolve the BASE asset and, for a
   * themable two-colour icon, bake the pairing into the returned bytes; the
   * returned ref keeps the themed id (it is the persistent identity in URL
   * mode). An unknown theme resolves to the plain asset under the themed id.
   */
  get(id: string, opts?: { format?: string; version?: string }): Promise<AssetRef>;

  /** Query the catalog by filter. Returns a list of resolved AssetRefs. */
  query(filter: AssetQuery): Promise<AssetRef[]>;

  /**
   * Open a host-provided picker UI. Returns the chosen AssetRef, or null if cancelled.
   * This is what tools use for asset-typed inputs - the host owns the picker chrome.
   */
  pick(opts: AssetPickerOpts): Promise<AssetRef | null>;

  /** Check if an asset is available offline right now (for graceful degradation). */
  isAvailable(id: string): Promise<boolean>;

  /**
   * The stored Content Credentials of a user-uploaded asset, if it carried any
   * at ingest - kept as the raw C2PA manifest store (no pixels/EXIF, so nothing
   * the upload pipeline strips is re-hoarded). Used to preserve a placed asset's
   * provenance as an export ingredient (see engine prepareC2paIngredientFromStore
   * → embedC2pa). Optional (added v1.26): shells without credential capture omit
   * it, and the runtime simply skips ingredient preservation.
   */
  credential?(id: string): Promise<{ store: Uint8Array; format: string } | null>;
}

/**
 * A credentialed source asset's preserved provenance, carried into an export's
 * Content Credentials. The runtime gathers these from credentialed uploads used
 * in a design; the C2PA embedder copies their manifests into the export's store
 * and records a c2pa.ingredient assertion + c2pa.opened action (so an AI or
 * camera origin is never laundered away). Opaque to the shell - forwarded as-is.
 */
export interface IngredientCredential {
  manifestBoxes: Uint8Array[];
  activeLabel: string;
  title?: string;
  format?: string;
  relationship?: string;
  digitalSourceType?: string;
}

export interface AssetQuery {
  type?:
    | 'vector'
    | 'raster'
    | 'video'
    | 'audio'
    | 'lottie'
    | 'model'
    | 'lut'
    | 'palette'
    | 'tokens'
    | 'font'
    | 'profile'
    | 'ratecard'
    | 'text'
    | 'data';
  namespace?: string; // e.g. 'suse/logo' matches everything under it
  tags?: string[]; // AND across tags
  includeDeprecated?: boolean; // default false
  /** Widen a `type:'image'` query to also admit `video` (v1.154). A motion tool
   *  (an onFrame consumer) accepts catalog video in an image slot the same way it
   *  accepts a user's video upload; without it the catalog rail hid every video. */
  motion?: boolean;
}

export interface AssetPickerOpts extends AssetQuery {
  title?: string;
  allowUpload?: boolean;
  /** Pre-select this asset id if present in results. */
  current?: string;
}
