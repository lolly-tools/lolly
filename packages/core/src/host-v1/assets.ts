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
   *
   * 1.244: a `<baseId>?treatment=<lookId>` id may name a photo look whose definition
   * carries theme variants. `tokenSelection` is the document's theme choice (the
   * runtime passes it when the document has one), so a bridge bakes the variant of
   * that theme. A bridge that ignores it bakes the base look.
   */
  get(id: string, opts?: { format?: string; version?: string; tokenSelection?: Readonly<Record<string, string>> }): Promise<AssetRef>;

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
   * The bytes behind an AssetRef, or behind a url a previous `get`/`pick`/
   * `compose.render` handed back (v1.183). This is the portable replacement
   * for a hook calling the global `fetch(ref.url)`: that works in a page, is
   * refused by a strict Worker, and does not exist in a headless shell - so
   * the same tool rendered three different ways. Shells resolve their own url
   * shapes (`blob:` and same-origin in a browser, `data:` and `file:` in
   * Node); an http(s) url goes through the tool's `host.net` allowlist, never
   * an open fetch. Optional and additive: a hook feature-detects it and may
   * keep `fetch` as its fallback.
   * For a prepared image, bytes(ref) reads ref.original; bytes(ref.url)
   * reads the derived display image.
   */
  bytes?(target: AssetRef | string): Promise<Uint8Array>;

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
  /** `parentOf` (the export derives from it, recorded as `c2pa.opened`) or
   *  `componentOf` (the export is composed of it, recorded as `c2pa.placed`).
   *  Defaults to `parentOf`; a manifest may carry only one parentOf ingredient. */
  relationship?: string;
  digitalSourceType?: string;
}

/**
 * The rights Lolly read for a source it used (v1.194): who made it, under what
 * licence, how to credit it, where the exact bytes came from and what Lolly
 * changed. Carried into the export's Content Credentials as Lolly's own
 * `tools.lolly.rights` assertion, bound to the source's ingredient, and into
 * readable credits. These are Lolly's observations of the source's notices,
 * never the upstream author's signature and never the composition's own licence.
 */
export interface RightsRecord {
  /** The creator(s) or attribution party the source designates. */
  creator: string;
  /** SPDX-style identifier of the source licence, e.g. `CC-BY-4.0`. */
  license: string;
  licenseUrl: string;
  /** The attribution sentence the source asks for, verbatim. */
  attribution: string;
  /** Where the exact source bytes were obtained (a stable public locator). */
  sourceUrl: string;
  /** Upstream revision (release tag or commit) when known. */
  revision?: string;
  /** Every change made to the source, upstream ones included; empty when unmodified. */
  modifications: string[];
  /** `sha256:<hex>` of the source bytes as obtained. */
  sourceHash: string;
  /** `sha256:<hex>` of the modified form actually used, when it differs. */
  usedHash?: string;
}

/**
 * A creative source used in an export that carries NO Content Credential of
 * its own (v1.194): an upstream SVG, a CC BY illustration, a stock element.
 * Distinguished from {@link IngredientCredential} by `credential: 'none'`. The
 * engine writes it as a `c2pa.ingredient.v3` assertion without `activeManifest`
 * or `validationResults` (section 18.16 of C2PA 2.4), binds the bytes through
 * the ingredient's external hashed URI (`url` + sha256 `hash`) when a public
 * locator exists, and records `rights` in `tools.lolly.rights`. Lolly asserts
 * what it observed; it never fabricates an upstream manifest.
 */
export interface SourceIngredient {
  credential: 'none';
  /** Human-readable name of the work (dc:title). */
  title: string;
  /** Format key (`svg`, `png`, ...) or an IANA media type (dc:format). */
  format?: string;
  /** `componentOf` records a `c2pa.placed` step; `parentOf` a `c2pa.opened` one. */
  relationship: 'componentOf' | 'parentOf';
  /** Public http(s) locator of the exact bytes; give `hash` with it. */
  url?: string;
  /** sha256 (32 bytes) of the bytes served at `url`. */
  hash?: Uint8Array;
  /** Byte length of those bytes. */
  size?: number;
  /** A stable identifier for this instance of the work (instanceID). */
  instanceId?: string;
  /** Free text for viewers that read no rights record (attribution sentence, changes). */
  description?: string;
  /** A page about the work or its terms (informationalURI). */
  informationalUri?: string;
  /** IPTC digital source type of the work, when known. */
  digitalSourceType?: string;
  rights?: RightsRecord;
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
  /** Optional v1.191: accept several catalog types in one picker. Overrides type. */
  types?: Array<NonNullable<AssetQuery['type']>>;
  title?: string;
  allowUpload?: boolean;
  /** Pre-select this asset id if present in results. */
  current?: string;
}
