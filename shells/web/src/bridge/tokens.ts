// SPDX-License-Identifier: MPL-2.0
/**
 * TokensAPI - design tokens for the host UI and token-aware tools.
 *
 * The canonical brand tokens live in the catalog as a `tokens`-type asset (a
 * DTCG document). Discovery is brand-agnostic: the bridge takes the first
 * `type: 'tokens'` asset that is not a published VERSION of another one - the
 * same rule the MCP server's tokens resource and the CLI apply (see
 * pickHeadAssetId, plans/97 section 6a) - rather than pinning a brand-specific id, so a
 * different brand profile's catalog supplies its own tokens with no shell
 * change. The document is handed to engine/src/tokens.js for resolution - so the
 * colour picker can source its swatches from tokens, brand-bound input values can
 * resolve their references, and a token-aware tool can read the whole tree.
 *
 * Versioning (plans/97 section 6a) is layered on top and costs an unversioned install
 * nothing: the head asset IS the edit head, and `forVersion(slug)` opens a
 * read-only surface over a published sibling `<headId>/<slug>`.
 *
 * THE DEFAULT READS ARE THE RENDER SURFACE, not the head. `get`/`colors`/
 * `resolve`/`themes` answer for whatever the section 6a ladder lands on - the `?designv=`
 * override on the current route, else the active version, else the head - because
 * every render on this shell reads them through `host.tokens`: the tool canvas's
 * brand vars, the picker swatches, the engine's token-bound inputs, the export
 * palette. Resolving the ladder at each of those sites instead would be a rule
 * some future call site forgets, and the shell would paint one design system
 * while the tools it frames painted another. `raw()` is the exception and stays
 * the HEAD: it is the document the studio edits and re-installs, and handing an
 * editor a frozen version to write back over the head would destroy the head.
 * With nothing published the ladder answers `latest` and the render surface reads
 * the head document, so an unversioned install resolves exactly as it always did.
 *
 * Loading is offline-safe and degrades gracefully. Discovery prefers the
 * synced asset metadata in IndexedDB (the service worker deliberately BYPASSES
 * /catalog/, so network fetches there fail offline), falling back to a fetch
 * of the catalog index for a cold first load; the document itself prefers the
 * core-prefetched blob in IndexedDB (cached at boot by catalog/sync.js) over a
 * direct fetch of the asset's file. If nothing resolves, an empty set is
 * returned - the picker quietly falls back to its built-in palette - and
 * nothing is memoised, so every subsequent call retries. A brand-ingest flow
 * that installs new tokens must call bust() so the next read re-discovers - 
 * installUserTokens (below) is the canonical write path: it stores the user's
 * own DTCG doc as the `user/tokens/brand` asset, which discovery returns ahead
 * of any catalog tokens (assets._findMetaByType checks the user store first).
 *
 * This is an *additive* v1 capability (HostV1.tokens?), like net/text - a shell
 * that doesn't provide it just doesn't offer token-driven swatches.
 */

// Loaded on demand, not statically: the engine's tokens module carries the colour cluster
// (css-color, brand-derive, color-faces - the whole `engine-util` chunk, 12.9 KB gz), and a
// static edge from this bridge module put all of it on the render-blocking boot payload for
// a resolution step nothing does before first paint (measured 2026-08-26, plans/155 WP-3).
// Both call sites below are already inside async functions, so nothing became more
// asynchronous than it was. Memoised, so the chunk is fetched at most once.
let tokensModPromise: Promise<typeof import('../../../../engine/src/tokens.ts')> | null = null;
const tokensMod = (): Promise<typeof import('../../../../engine/src/tokens.ts')> =>
  (tokensModPromise ??= import('../../../../engine/src/tokens.ts'));
// The versioned design-system model. The ENGINE leaf, not `@lolly/engine` and not
// lib/design-system/versions.ts (its studio re-export): this module is on the boot
// path, and both of those pull the barrel - the same rule the engine imports above
// and below already follow. See scripts/check-bundle-budget.ts.
import {
  DESIGN_VERSION_LATEST, applyPinnedAssets, isVersionSlug, pickHeadAssetId, readVersionIndex,
  resolveDesignVersion, versionAssetId,
} from '../../../../engine/src/design-version.ts';
import { instanceFetch, instancePath } from '../lib/instance.ts';
import type { DesignSystemSummary, TokensAPI, TokensSnapshot, TokenSet } from '@lolly-tools/core/host-v1';
// The design systems this device holds and which one is active (plans/186). A
// type-only import: the registry is handed in through the host slice, so a test's
// narrow stub (no registry) keeps the legacy discovery below byte for byte.
import type { DesignSystemRecord, DesignSystemRegistry } from '../lib/design-system/registry.ts';
import { DEFAULT_DESIGN_SYSTEM_ID, SHIPPED_DESIGN_SYSTEM_ID, designSystemHeadId, designSystemNamespace } from '../../../../engine/src/design-system.ts';
// The exclusion read lives in its own leaf module (not lib/brand-doc.ts, whose
// engine-barrel import would drag studio code into this bridge's boot graph).
import { getExcludedSwatches } from '../lib/brand-exclusions.ts';

/** The catalog-asset slice discovery needs: an id to read the cached blob by,
 *  the file URL to fall back to, and the `brandLock` flag (tokens assets only).
 *  Structurally satisfied both by the asset bridge's stored metadata records and
 *  by raw index.json entries. */
interface TokensAssetMeta {
  id: string;
  formats: Array<{ url: string }>;
  brandLock?: boolean;
}

/** The slice of the host this bridge reads: the asset store's synced metadata
 *  lookup and raw blob access. `catalogOnly` skips the user store - needed to
 *  read the SHIPPED brand's lock flag, which a user asset must not shadow. */
interface TokensHost {
  assets: {
    /** `fetchIfMissing` asks the asset bridge to fetch-and-cache a synced asset
     *  whose blob is not on device yet, instead of answering null - see
     *  readAssetDoc. Declared optional in shape (a stub may take one argument);
     *  every real caller passes it. */
    _getBlob(id: string, opts?: { fetchIfMissing?: boolean }): Promise<Blob | null>;
    _findMetaByType(type: string, opts?: { catalogOnly?: boolean }): Promise<TokensAssetMeta | null>;
  };
  /** Optional: the host log, used once per unreadable version (see forVersion).
   *  Optional so the narrow stub every test builds keeps satisfying this slice. */
  log?(level: string, message: string, ctx?: unknown): void;
  /** Optional: the device's design-system registry (plans/186). With it, the head
   *  is the ACTIVE record's head id; without it, discovery is the legacy
   *  user-first scan, so every existing caller and test is unchanged. */
  designSystems?: DesignSystemRegistry;
}

/** A document-shaped token surface: the HostV1 reads plus the raw document and
 *  the cache-buster. What `createTokensAPI` returns for the head, and what
 *  `forVersion` returns for a published version - one implementation, so a
 *  version can never resolve by different rules from the head. */
export type TokenDocSurface = TokensAPI & { raw(): Promise<unknown>; bust(): void };

/** The web shell's tokens surface: HostV1's TokensAPI plus the cache-buster, the
 *  brand-lock query and the version reads (plans/97 section 6a). */
export interface WebTokensAPI extends TokensAPI {
  /** Drop caches (e.g. after the user imports their own tokens). */
  bust(): void;
  /**
   * The raw effective DTCG document of the EDIT HEAD - the user install if
   * present, else the shipped catalog brand (a locked build always yields the
   * catalog doc). Handed back unresolved so the brand editor can mutate a colour
   * leaf's `$value` and re-install it. Null when no tokens are reachable yet.
   * Memoised alongside the token sets, so a bust() (after installUserTokens)
   * makes the next call re-load the new doc.
   *
   * Deliberately the head, NOT what get()/resolve() answer for: under an active
   * version those read the version (see the module header), and an editor that
   * wrote a frozen version back over the head would erase the head.
   */
  raw(): Promise<unknown>;
  /**
   * The asset id the head document was discovered at (`user/tokens/brand` for a
   * user install, `<ns>/tokens/brand` for a pack), or null when none is
   * reachable. A published version is addressed RELATIVE to it - the studio's
   * version IO reads `<headId>/<slug>`, which is not always a `user/` id.
   */
  headId(): Promise<string | null>;
  /**
   * True when the SHIPPED catalog brand declares itself authoritative
   * (`brandLock` on its tokens asset): the app resolves ITS colours/fonts and
   * ignores any user-installed brand, and the brand-customisation UI is
   * disabled. False for a customisable brand (e.g. lolly-start). Cached.
   */
  isLocked(): Promise<boolean>;
  /**
   * The version this page resolves against right now: the whole section 6a ladder - the
   * `?designv=` override on the current route, else the active version, else
   * `latest` (the head). This is what the default reads already answer for; it is
   * exposed so a caller can NAME the answer (a banner, a log line) without
   * re-deriving the rule. Nothing published and no override ⇒ always `latest`,
   * which is what makes an unversioned system behave exactly as it did before section 6a.
   */
  activeSlug(): Promise<string>;
  /**
   * A read-only surface over ONE named document. `latest` returns the head
   * surface, so a caller that resolved the ladder can use the answer
   * unconditionally without branching.
   *
   * Memoised per slug and cleared by bust(). Asset tokens are rewritten through
   * the version's pins at load (applyPinnedAssets), so `{asset.logo.x}` resolves
   * to the preserved bytes wherever the head's have since changed. A version
   * whose asset or bytes are unreadable falls back to the HEAD document and logs
   * once: a missing version must degrade to today's behaviour, never to a blank
   * render.
   */
  forVersion(slug: string): TokenDocSurface;
  /** The design systems on this device (plans/186). Without a registry, one entry
   *  describing the discovered head, so a caller never has to branch. */
  list(): Promise<DesignSystemSummary[]>;
  /** The active design system (plans/186); null only before anything resolves. */
  active(): Promise<DesignSystemSummary | null>;
  /** One immutable snapshot of the render context - render document, active system,
   *  resolved version, theme selection (plans/222). What the `.penpot` exporter
   *  carries so the file matches the render. Always present on the web shell. */
  snapshot(): Promise<TokensSnapshot>;
  /** The active record itself - the web shell's full shape, for the studio and the
   *  switcher. Null without a registry. */
  activeRecord(): Promise<DesignSystemRecord | null>;
  /** Drop caches. `lock: true` also drops the memoised build-lock verdict, which a
   *  plain bust keeps on purpose (a build fact) - a design-system SWITCH is the one
   *  event that must reset it. */
  bust(opts?: { lock?: boolean }): void;
}

const ASSET_INDEX_URL = '/catalog/assets/index.json';

/** The user-installed brand tokens' well-known asset id. Its presence flips
 *  discovery away from the catalog's tokens (e.g. `lolly/tokens/brand`) - the
 *  shell's branded/unbranded signal (plans/archive/brand-token-contract.md section 5). */
export const USER_TOKENS_ID = 'user/tokens/brand';

/** The host slice installUserTokens needs: the asset store's user-upload writer
 *  plus (when wired) this module's own live tokens instance, to bust its caches
 *  and honour the brand lock. The record parameter mirrors bridge/assets.ts's
 *  UserAssetRecord for the fields we set - the same contract the picker's
 *  uploads write. */
interface InstallTokensHost {
  assets: {
    _uploadUserAsset(record: {
      id: string;
      type: 'tokens';
      format: string;
      blob: Blob;
      version?: string;
      meta?: Record<string, unknown>;
    }, opts?: { skipQuota?: boolean }): Promise<void>;
    /** Required for a VERSION write, and only for that: immutability cannot be
     *  enforced without reading the ledger the head already carries. Optional so
     *  every existing (head-only) caller keeps satisfying this slice. */
    _getBlob?(id: string): Promise<Blob | null>;
    /** Read for its `meta.name` when a head write names no label - see the
     *  install below. Optional: a host without it just falls back to the default
     *  name, which is what every caller got before. */
    _getUserRecord?(id: string): Promise<{ meta?: Record<string, unknown> } | null>;
  };
  tokens?: TokensAPI & { bust?(): void; isLocked?(): Promise<boolean> };
  /** Optional: the design-system registry (plans/186). With it a head write goes
   *  to the ACTIVE system's head (or `opts.system`'s), and a first install while
   *  the shipped system is active creates the `default` record - which is what a
   *  first install always did, now with a record to show for it. */
  designSystems?: DesignSystemRegistry;
}

/** Thrown when a brand override is attempted on a locked (authoritative) brand.
 *  UI should gate on host.tokens.isLocked() so this stays a defence-in-depth
 *  backstop rather than a path users reach. */
export class BrandLockedError extends Error {
  constructor() {
    super('This build’s brand is fixed and can’t be changed.');
    this.name = 'BrandLockedError';
  }
}

/**
 * Thrown when a publish names a version the head's ledger already lists. A
 * published version is a permanent contract - the same rule the asset schema
 * states for every id - so the name is refused rather than the bytes replaced.
 *
 * The LEDGER is what makes a version permanent, not the asset: an orphan asset
 * left by a half-finished publish (the version written, the ledger write lost)
 * names nothing and is reclaimable, which is why this check reads the head.
 */
export class VersionExistsError extends Error {
  constructor(slug: string) {
    super(`A version named “${slug}” already exists, and a published version can’t be replaced.`);
    this.name = 'VersionExistsError';
  }
}

/**
 * Install the user's own brand tokens (plans/archive/brand-token-contract.md section 5):
 * validate + write the DTCG document as the well-known `user/tokens/brand`
 * asset, then bust the tokens caches so the very next get()/resolve() re-runs
 * discovery - which now returns the user asset ahead of the shipped brand.
 *
 * Refuses when the shipped brand is LOCKED (brandLock): a locked catalog eats
 * what it is given, so user brand tokens are never installed. This is the single
 * write chokepoint every override path funnels through (the #/start wizard,
 * brand-file import, and every set/add/remove-font action), so one guard here
 * covers them all.
 *
 * `versionSlug` switches to the VERSION path (plans/97 section 6a): the document is
 * written as the immutable sibling `user/tokens/brand/<slug>` instead of the
 * head. Immutability is enforced HERE, at the same chokepoint, because that is
 * the only place no caller can go around. Everything about the head write below
 * is unchanged, so a system that never publishes writes the same bytes it always
 * did.
 */
export async function installUserTokens(
  host: InstallTokensHost, doc: unknown,
  opts: {
    label?: string; versionSlug?: string; allowVersionWrite?: boolean;
    /** Which design system to write (plans/186). Default: the active one. */
    system?: string;
    /**
     * Skip the quota guard on this write. For ONE caller: the copy-on-write
     * preserver repointing pins while a delete is in flight
     * (bridge/version-assets.ts). That write is a few KB of JSON replacing a few
     * KB of JSON at the same id, inside an operation that is net-freeing space - 
     * charging it full size lets a near-full device refuse the delete, which
     * leaves the user unable to free the storage the refusal is about.
     */
    skipQuota?: boolean;
  } = {},
): Promise<void> {
  if (await host.tokens?.isLocked?.()) throw new BrandLockedError();
  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new Error('installUserTokens: expected a DTCG token document (a plain object)');
  }
  const target = await writeTarget(host, opts.system, opts.label);
  const headId = target.headId;

  if (!opts.versionSlug) {
    await host.assets._uploadUserAsset({
      id: headId,
      type: 'tokens',
      format: 'json',
      blob: new Blob([JSON.stringify(doc)], { type: 'application/json' }),
      version: '1.0.0',
      meta: { name: await headName(host, headId, opts.label ?? target.label) },
    }, { skipQuota: opts.skipQuota });
    if (target.record && opts.label && opts.label !== target.record.label) {
      await host.designSystems?.put({ ...target.record, label: opts.label }).catch(() => { /* label is cosmetic */ });
    }
    // The web tokens API memoises the doc + per-theme sets (see createTokensAPI);
    // bust so nothing keeps serving the outgoing brand. Optional-chained: a host
    // without the tokens capability just installs for the next boot.
    host.tokens?.bust?.();
    return;
  }

  const slug = opts.versionSlug;
  // Publishing is deliberate, so it has to be asked for in words: a caller that
  // merely passed a slug through from somewhere cannot mint a permanent version.
  if (!opts.allowVersionWrite) {
    throw new Error('installUserTokens: a version write must be explicit (allowVersionWrite)');
  }
  if (!isVersionSlug(slug)) {
    throw new Error(`installUserTokens: “${slug}” is not a usable version name`);
  }
  // Fail closed. Without a read there is no ledger, and without the ledger this
  // write could silently replace a published version - the one thing versioning
  // promises it never does.
  if (!host.assets._getBlob) {
    throw new Error('installUserTokens: a version write needs assets._getBlob to check the ledger');
  }
  const headDoc = await readJsonBlob(await host.assets._getBlob(headId).catch(() => null));
  if (readVersionIndex(headDoc).versions.some(v => v.slug === slug)) throw new VersionExistsError(slug);
  // A version is a leaf of the head's history and never carries a ledger of its
  // own - a stale copy of the list would be a second source of truth the moment
  // the next version lands. Callers pass stripVersionIndex output.
  if (readVersionIndex(doc).versions.length) {
    throw new Error('installUserTokens: a version payload must not carry a version ledger');
  }

  await host.assets._uploadUserAsset({
    id: versionAssetId(headId, slug),
    type: 'tokens',
    format: 'json',
    blob: new Blob([JSON.stringify(doc)], { type: 'application/json' }),
    version: '1.0.0',
    meta: { name: opts.label ?? slug, kind: 'design-version', slug },
  });
  // No bust(): the head document is untouched, so every cache still holds what
  // the app is actually rendering. The ledger write that follows busts.
}

/**
 * What a head write should call the design system.
 *
 * A caller's own `label` wins. With none, the name already on the record is kept
 * rather than reset: every head write is a read-modify-write of the SAME asset,
 * and the machinery that writes it for its own reasons (copy-on-write pin
 * repointing, publish, activate, restore) has no business renaming a system
 * somebody called "Acme". 'Brand tokens' is only the name of a system that never
 * had one - which is exactly what an unlabelled write produced before, so a
 * first install is unchanged.
 */
async function headName(host: InstallTokensHost, headId: string, label?: string): Promise<string> {
  if (label) return label;
  try {
    const prev = (await host.assets._getUserRecord?.(headId))?.meta?.name;
    if (typeof prev === 'string' && prev) return prev;
  } catch { /* unreadable store - fall through to the default */ }
  return 'Brand tokens';
}

/**
 * Where a head write goes (plans/186 section 3.3). Without a registry: the legacy
 * id, as always. With one: `opts.system`'s head, else the active record's - and
 * when the active record is the SHIPPED system (nothing of the person's yet),
 * the `default` record is created and activated first, which is exactly what a
 * first install used to mean when it shadowed the catalog. A record whose
 * material is read-only (the material lock, section 3.5) refuses the write.
 */
async function writeTarget(
  host: InstallTokensHost, system: string | undefined, label: string | undefined,
): Promise<{ headId: string; label?: string; record: DesignSystemRecord | null }> {
  const reg = host.designSystems;
  if (!reg) return { headId: USER_TOKENS_ID, record: null };
  let record = system ? await reg.get(system) : await reg.active();
  if (system && !record) throw new Error(`installUserTokens: no design system “${system}” on this device`);
  if (!record || record.source.kind === 'shipped') {
    if (system) throw new Error('installUserTokens: the shipped design system is read-only');
    const existing = await reg.get(DEFAULT_DESIGN_SYSTEM_ID);
    const now = Date.now();
    record = existing ?? {
      id: DEFAULT_DESIGN_SYSTEM_ID,
      label: label || 'My design system',
      ns: designSystemNamespace(DEFAULT_DESIGN_SYSTEM_ID),
      headId: designSystemHeadId(DEFAULT_DESIGN_SYSTEM_ID),
      source: { kind: 'local' },
      locked: false,
      createdAt: now,
      lastUsedAt: now,
    };
    if (!existing) await reg.put(record);
    await reg.setActive(record.id);
  }
  // The material lock guards the ACTIVE-system write path - the studio's, which
  // names no system. A write that names its target is the import, the sync or
  // the copy bringing a system's own material down, and those are how a locked
  // system gets its bytes in the first place.
  if (record.locked && !system) throw new BrandLockedError();
  return { headId: record.headId, label: record.label, record };
}

/** Parse a JSON blob, or null when there is nothing readable there. */
/**
 * The user's own design system as a document, with its name - for a `.lolly` share file
 * to carry (lib/lolly-pack.ts `designSystem`). Null when this device has installed none:
 * the brand pack's tokens are the pack's to travel, not the file's.
 */
export async function readUserDesignSystem(
  host: {
    assets: { _getBlob(id: string): Promise<Blob | null>; _getUserRecord?(id: string): Promise<{ meta?: { name?: unknown } } | null> };
    designSystems?: DesignSystemRegistry;
  },
): Promise<{ doc: Record<string, unknown>; label?: string; id?: string; source?: { kind: string; instance?: string } } | null> {
  const record = await host.designSystems?.active().catch(() => null) ?? null;
  if (record && record.source.kind === 'shipped') return null;
  const headId = record?.headId || USER_TOKENS_ID;
  const doc = await readJsonBlob(await host.assets._getBlob(headId).catch(() => null));
  if (!doc || typeof doc !== 'object') return null;
  const name = record?.label || (await host.assets._getUserRecord?.(headId).catch(() => null))?.meta?.name;
  // The identity a share file carries (plans/186 section 3.8): the id, and for a
  // hosted system where it came from, so a recipient can add it by link.
  const source = record
    ? { kind: record.source.kind, ...(record.source.kind === 'hosted' ? { instance: record.source.instance } : {}) }
    : undefined;
  return {
    doc: doc as Record<string, unknown>,
    ...(typeof name === 'string' && name ? { label: name } : {}),
    ...(record ? { id: record.id } : {}),
    ...(source ? { source } : {}),
  };
}

async function readJsonBlob(blob: Blob | null): Promise<unknown> {
  if (!blob) return null;
  try { return JSON.parse(await blob.text()); } catch { return null; }
}

/**
 * The read surface over ONE document loader: get/colors/resolve/themes/raw/bust.
 *
 * Factored out so the head and a published version cannot drift - the per-theme
 * memo, the never-cache-an-empty-set rule and the swatch-exclusion filter are
 * written once and both surfaces get them. `loadDoc` is called at most once per
 * successful load; a null result is not memoised, so a document that was not
 * reachable yet (boot sync still running) is retried on the next call.
 */
function tokenSurface(loadDoc: () => Promise<unknown>): TokenDocSurface {
  const setByTheme = new Map<string, TokenSet>(); // theme key ('' = default) → token set, cached once non-empty
  let docPromise: Promise<unknown> | null = null;

  async function doc(): Promise<unknown> {
    // Memoise a successful load; clear on failure so the next call retries
    // (e.g. after boot sync finishes caching the blob).
    if (!docPromise) docPromise = loadDoc().then(d => { if (!d) docPromise = null; return d; });
    return docPromise;
  }

  async function ensure(theme?: string): Promise<TokenSet> {
    const key = theme ?? '';
    if (setByTheme.has(key)) return setByTheme.get(key)!;
    const { createTokenSet } = await tokensMod();
    const set = createTokenSet(await doc(), { theme });
    if (set.size > 0) setByTheme.set(key, set); // don't cache an empty (failed) load
    return set;
  }

  return {
    /** The resolved token set for the active (or named) theme. */
    get: (opts = {}) => ensure(opts.theme),
    /** Colour tokens as picker-ready swatches ({ ref, value, name, group, cmyk }).
     *  Swatches on the doc's exclusion list (a "deleted" derived ramp step - 
     *  the studio hides it, the token keeps resolving) are filtered here so
     *  every picker honours the exclusion without each caller re-reading it. */
    colors: async (opts = {}) => {
      const list = (await ensure(opts.theme)).colors();
      const excluded = new Set(getExcludedSwatches(await doc()));
      if (!excluded.size) return list;
      const { aliasPath } = await tokensMod();
      // Exclusion keys are brand-doc keys, which ALWAYS carry a `color.` root
      // (brand-doc.ts prepends one when a doc's colour leaves live under some
      // other top-level group) - the engine's token paths for such docs don't.
      // Match both forms so an exclusion written against the prefixed key
      // still hides that swatch here.
      return list.filter(c => {
        const p = aliasPath(c.ref) ?? c.ref;
        return !excluded.has(p) && !excluded.has(p.startsWith('color.') ? p : `color.${p}`);
      });
    },
    /** Resolve a `{path}` alias (or bare path) to its value. */
    resolve: async (ref, opts = {}) => (await ensure(opts.theme)).resolve(ref),
    /** The raw effective DTCG document (see WebTokensAPI.raw). */
    raw: () => doc(),
    /** Theme names declared in the document. */
    themes: async () => (await ensure()).themes(),
    /** Drop the memoised document and per-theme sets. */
    bust() { setByTheme.clear(); docPromise = null; },
  };
}

/**
 * The `?designv=` render override on the current route, or null.
 *
 * Top rung of the section 6a ladder and the author's testing lever ("check against
 * `latest`, fix, then publish"). It is read HERE, in the bridge, rather than
 * threaded from the view that mounted a tool, for the same reason the rest of
 * the ladder lives here: a render reads `host.tokens`, and a rule applied at
 * each mount site is a rule the next mount site forgets. The reserved name is
 * the engine's (`RESERVED` in url-mode.ts, documented in docs/url-mode.md).
 *
 * A plain hand-written string read, not `parseUrlState`: this is on the boot
 * path, the engine's URL parser wants a manifest it has no business having, and
 * the common answer has to cost an `indexOf` - which is what the `includes`
 * guard buys, since a URL with no `designv` in it never builds a params object.
 * Reading the raw query also cannot miss a packed (`z=`) link, because
 * `serializeUrlState` never writes `designv` into one: a version belongs to the
 * design system it was published in, not to whoever opens the link.
 */
function urlDesignVersion(): string | null {
  try {
    const hash = typeof location === 'undefined' ? '' : (location.hash || '');
    if (!hash.includes('designv=')) return null;
    const q = hash.indexOf('?');
    if (q < 0) return null;
    return new URLSearchParams(hash.slice(q + 1)).get('designv') || null;
  } catch { return null; }   // sandboxed / no location - the head, as always
}

/** What `list()`/`active()` answer WITHOUT a registry: one entry for the discovered
 *  head - `default` for a user install, `shipped` for the catalog - so a caller
 *  written against plans/186 works on a host that predates it. */
function legacySummary(headId: string | null): DesignSystemSummary {
  const user = !!headId && headId.startsWith('user/');
  return {
    id: user ? DEFAULT_DESIGN_SYSTEM_ID : SHIPPED_DESIGN_SYSTEM_ID,
    label: user ? 'My design system' : 'Lolly',
    source: user ? 'local' : 'shipped',
    active: true,
    locked: false,
    headId,
  };
}

/** The active theme selection a render document declares of itself: its
 *  `$metadata.activeThemes`/`activeSets`. This IS the selection that produced the
 *  canvas (the render surface resolves against the doc's own active theme), so an
 *  exporter carries it verbatim rather than reading the chrome light/dark toggle,
 *  which is a different thing (plans/222). Empty when the doc names none. */
function readActiveSelection(doc: unknown): { activeThemes?: string[]; activeSets?: string[] } {
  const meta = doc && typeof doc === 'object' && !Array.isArray(doc)
    ? (doc as { $metadata?: unknown }).$metadata : null;
  if (!meta || typeof meta !== 'object') return {};
  const m = meta as { activeThemes?: unknown; activeSets?: unknown };
  const strs = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : undefined;
  const out: { activeThemes?: string[]; activeSets?: string[] } = {};
  const themes = strs(m.activeThemes); if (themes?.length) out.activeThemes = themes;
  const sets = strs(m.activeSets); if (sets?.length) out.activeSets = sets;
  return out;
}

export function createTokensAPI(host: TokensHost): WebTokensAPI {
  let catalogMetaPromise: Promise<TokensAssetMeta | null> | null = null;

  /** The first catalog asset with `type: 'tokens'`, or null if there is none
   *  reachable. Synced metadata first - present and offline-safe once boot
   *  sync ran - then the network index (cold first load, before sync).
   *  `catalogOnly` reads the SHIPPED brand (skips the user store) - used to read
   *  the un-shadowable `brandLock` flag. */
  async function findTokensAsset(catalogOnly = false): Promise<TokensAssetMeta | null> {
    try {
      const meta = await host.assets._findMetaByType('tokens', { catalogOnly });
      if (meta) return meta;
    } catch { /* IDB unavailable / not synced yet - fall through to the index */ }
    try {
      // The catalog index carries only shipped assets, so it is catalog-only by
      // construction - the right cold-load source for both callers.
      const resp = await instanceFetch(instancePath(ASSET_INDEX_URL));
      if (resp.ok) {
        const idx = await resp.json() as { assets?: Array<TokensAssetMeta & { type?: string }> };
        // The SAME descendant-exclusion rule _findMetaByType applies (plans/97
        // section 6a): a pack that ships published versions puts several `type:'tokens'`
        // entries in this index, and index order must never decide which of them
        // is the design system. This reader also supplies the un-shadowable
        // brandLock flag, so a mis-pick here would be a mis-picked LOCK too.
        const tokens = (idx.assets ?? []).filter(a => a.type === 'tokens');
        const headId = pickHeadAssetId(tokens.map(a => a.id));
        return tokens.find(a => a.id === headId) ?? null;
      }
    } catch { /* offline with nothing synced */ }
    return null;
  }

  /** The SHIPPED brand's tokens asset (never a user install). Memoised - its
   *  brandLock flag is a build fact that doesn't change within a session. */
  function catalogTokensAsset(): Promise<TokensAssetMeta | null> {
    if (!catalogMetaPromise) {
      catalogMetaPromise = findTokensAsset(true).then(m => { if (!m) catalogMetaPromise = null; return m; });
    }
    return catalogMetaPromise;
  }

  /** Read + parse one tokens asset's DTCG document (cached blob first, then a
   *  direct fetch of its file). Null when neither is reachable yet. */
  async function readAssetDoc(asset: TokensAssetMeta): Promise<unknown> {
    // 1) The core-prefetched blob - present and offline-safe once boot sync ran.
    //    Read the bytes directly; minting/fetching an object URL just to re-parse
    //    in-memory JSON would pin an unused URL in the asset bridge's cache.
    //    `fetchIfMissing`: on a COLD load this read runs before the idle core
    //    prefetch, so the blob is not there yet. Letting the asset bridge fetch it
    //    means the bytes are checksum-verified and stored under the key that
    //    prefetch checks, so the prefetch skips the file instead of downloading it
    //    again - the duplicate brand.json fetch scripts/check-first-load.ts caught
    //    on 2026-09-12. Step 2 below stays for the case this cannot serve: an asset
    //    whose metadata has not synced yet (nothing to fetch BY), or no IndexedDB.
    try {
      const blob = await host.assets._getBlob(asset.id, { fetchIfMissing: true });
      if (blob) return JSON.parse(await blob.text());
    } catch { /* not cached, or the fetch/checksum failed - fall through */ }
    // 2) Direct fetch of the asset's file - first load, before the blob is cached.
    try {
      const url = asset.formats[0]?.url;
      if (url) {
        // instancePath: cold-load metas come from the raw network index, whose
        // format URLs are root-relative (synced metas are already absolute).
        const resp = await instanceFetch(instancePath(url), { cache: 'no-store' });
        if (resp.ok) return await resp.json();
      }
    } catch { /* offline and not yet prefetched */ }
    return null;
  }

  /** The tokens asset the app resolves against - the HEAD of the design system.
   *  Split out of the document load because a version asset is addressed
   *  relative to it (`<headId>/<slug>`), so both readers need the same answer. */
  async function headAsset(): Promise<TokensAssetMeta | null> {
    // A LOCKED brand is authoritative: resolve the shipped catalog doc and
    // ignore any user install (which the guard in installUserTokens also
    // prevents from ever being written - but a leftover from an earlier,
    // unlocked profile must still be shadowed here).
    const catalog = await catalogTokensAsset();
    if (catalog?.brandLock) return catalog;
    // With a registry (plans/186) the head is the ACTIVE record's, no scan: the
    // shipped record means the catalog, any other record means its own head id.
    // A record whose head bytes are gone (a half-finished remove) falls back to
    // the catalog rather than rendering nothing.
    const reg = host.designSystems;
    if (reg) {
      const record = await reg.active().catch(() => null);
      if (record && record.source.kind !== 'shipped' && record.headId) {
        const blob = await host.assets._getBlob(record.headId).catch(() => null);
        if (blob) return { id: record.headId, formats: [] };
      }
      return catalog;
    }
    // Unlocked: a USER install wins. _findMetaByType is user-first AND IDB-only
    // (the index fallback lives here in the bridge, not in it), so consult it for
    // a user asset and otherwise reuse the catalog asset already resolved above - 
    // this avoids a second index fetch on a cold boot.
    let userMeta: TokensAssetMeta | null = null;
    try { userMeta = await host.assets._findMetaByType('tokens'); } catch { /* IDB unavailable */ }
    if (userMeta && userMeta.id.startsWith('user/')) return userMeta;
    return catalog; // no tokens anywhere → empty set, retried next call
  }

  async function loadHeadDoc(): Promise<unknown> {
    const asset = await headAsset();
    return asset ? readAssetDoc(asset) : null;
  }

  const head = tokenSurface(loadHeadDoc);
  /** slug → surface. Cleared by bust(), so a republish/import can't be served
   *  stale. Empty for the whole life of an install that never publishes. */
  const versionSurfaces = new Map<string, TokenDocSurface>();
  /** Slugs already reported unreadable - one warning each, not one per read. */
  const warned = new Set<string>();

  /** The published version's document, with its pinned assets applied. Falls
   *  back to the HEAD document (with a single warning) whenever the version is
   *  not readable: an author's pin to a version this device never imported must
   *  still draw something honest, and the head is the next rung of the ladder. */
  async function loadVersionDoc(slug: string): Promise<unknown> {
    const headDoc = await head.raw();
    const fallback = (why: string): unknown => {
      if (!warned.has(slug)) {
        warned.add(slug);
        host.log?.('warn', `tokens: design version “${slug}” ${why} - rendering the current design system instead`);
      }
      return headDoc;
    };
    const entry = readVersionIndex(headDoc).versions.find(v => v.slug === slug);
    if (!entry) return fallback('is not published on this device');
    const asset = await headAsset();
    if (!asset) return fallback('has no design system to belong to');
    let doc: unknown = null;
    try { doc = await readJsonBlob(await host.assets._getBlob(versionAssetId(asset.id, slug))); }
    catch { /* IDB unavailable - treated as unreadable below */ }
    if (!doc) return fallback('could not be read');
    return applyPinnedAssets(doc, entry.assets ?? []);
  }

  /** A memoised read surface over one published version. */
  function versionSurface(slug: string): TokenDocSurface {
    let surface = versionSurfaces.get(slug);
    if (!surface) {
      surface = tokenSurface(() => loadVersionDoc(slug));
      versionSurfaces.set(slug, surface);
    }
    return surface;
  }

  /**
   * The section 6a ladder over an already-loaded head document. No `pin` rung: a
   * manifest pin belongs to ONE mounted tool, and this bridge is the whole page's.
   */
  const ladder = (headDoc: unknown): string =>
    resolveDesignVersion({ override: urlDesignVersion(), index: readVersionIndex(headDoc) });

  /**
   * The document every RENDER on this page reads.
   *
   * Both branches go through a memo that already exists - the head surface's, or
   * the named version's - so nothing is loaded twice however many surfaces a
   * caller holds. An unversioned install therefore loads exactly one document and
   * pays one extra `readVersionIndex` over an object already in memory.
   */
  async function loadRenderDoc(): Promise<unknown> {
    const headDoc = await head.raw();
    if (!headDoc) return null;
    const slug = ladder(headDoc);
    return slug === DESIGN_VERSION_LATEST ? headDoc : versionSurface(slug).raw();
  }
  const render = tokenSurface(loadRenderDoc);

  /** Which `?designv=` the memoised render surface was built for. The bridge
   *  outlives any one route, so navigating off a `designv` link (or onto one) has
   *  to drop that memo - and only that one, since the head never moved. */
  let builtFor: string | null = urlDesignVersion();
  function syncOverride(): void {
    const now = urlDesignVersion();
    if (now === builtFor) return;   // the overwhelmingly common case: both null
    builtFor = now;
    render.bust();
  }

  /** The active design system summary, shared by `active()` and `snapshot()`. */
  async function activeSummary(): Promise<DesignSystemSummary | null> {
    const reg = host.designSystems;
    if (reg) {
      const record = await reg.active().catch(() => null);
      return record ? reg.summary(record, record.id) : null;
    }
    return legacySummary((await headAsset())?.id ?? null);
  }

  const api: WebTokensAPI = {
    // The DEFAULT reads are the render surface, not the head - see the module
    // header. Written out rather than spread so the split is visible here.
    get: async (opts = {}) => { syncOverride(); return render.get(opts); },
    colors: async (opts = {}) => { syncOverride(); return render.colors(opts); },
    resolve: async (ref, opts = {}) => { syncOverride(); return render.resolve(ref, opts); },
    themes: async () => { syncOverride(); return render.themes(); },
    /** The EDIT HEAD's document (see WebTokensAPI.raw). */
    raw: () => head.raw(),
    /** The id the head was discovered at (see WebTokensAPI.headId). */
    async headId() { return (await headAsset())?.id ?? null; },
    /** True when the shipped brand is locked (see WebTokensAPI.isLocked). */
    async isLocked() { return !!(await catalogTokensAsset())?.brandLock; },
    /** The version this page resolves against (see WebTokensAPI.activeSlug). */
    async activeSlug() {
      syncOverride();
      return ladder(await head.raw().catch(() => null));
    },
    /** A read-only surface over one named document (see WebTokensAPI.forVersion). */
    forVersion(slug: string): TokenDocSurface {
      // The head surface itself, not a copy: `latest` means the head, and a
      // second surface over the same document would re-read and re-resolve it.
      return slug === DESIGN_VERSION_LATEST ? head : versionSurface(slug);
    },
    /** The device's design systems (see WebTokensAPI.list). */
    async list() {
      const reg = host.designSystems;
      if (reg) {
        const [records, activeId] = await Promise.all([reg.list(), reg.activeId()]);
        return records.map(r => reg.summary(r, activeId));
      }
      const id = (await headAsset())?.id ?? null;
      return [legacySummary(id)];
    },
    /** The active design system (see WebTokensAPI.active). */
    async active() { return activeSummary(); },
    /**
     * One immutable snapshot of the effective render context (plans/222): the raw
     * RENDER-version document (not the edit head - so gap #2's head/version mix
     * cannot happen), the active design system, the version the ladder resolved,
     * and the theme selection the doc declares of itself. What the `.penpot`
     * exporter carries so the file opens on the theme the canvas was rendered with.
     */
    async snapshot(): Promise<TokensSnapshot> {
      syncOverride();
      const [document, system] = await Promise.all([render.raw(), activeSummary()]);
      const version = ladder(await head.raw().catch(() => null));
      return { document: document ?? null, system, version, selection: readActiveSelection(document) };
    },
    async activeRecord() {
      return host.designSystems ? (await host.designSystems.active().catch(() => null)) : null;
    },
    /** Drop caches (e.g. after the user imports their own tokens). The lock is a
     *  build fact, not user state, so its cache survives a plain bust - but every
     *  version surface goes, since a fresh ledger may repoint or retire one. A
     *  design-system switch passes `lock: true` (see WebTokensAPI.bust). */
    bust(opts: { lock?: boolean } = {}) {
      head.bust();
      render.bust();
      versionSurfaces.clear();
      warned.clear();
      if (opts.lock) catalogMetaPromise = null;
      host.designSystems?.bust();
    },
  };
  return api;
}
