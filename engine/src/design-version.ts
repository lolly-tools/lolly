// SPDX-License-Identifier: MPL-2.0
/**
 * design-version.ts — the pure model behind versioned design systems (plans/97 §6a).
 *
 * The edit head (`user/tokens/brand`) is always `-latest`; a published version is
 * an immutable sibling asset `user/tokens/brand/<slug>`, and the head doc carries
 * the ledger of what was published at `$extensions[TOKEN_EXT].versions`.
 *
 * This lives in the ENGINE, not a shell, because three consumers have to resolve
 * a version identically — the web bridge, the CLI bridge and the MCP server. The
 * discovery-exclusion rule and the resolution ladder are contracts: a shell that
 * invents its own reading of them renders a different design system from the one
 * the author published, which is exactly the drift versioning exists to remove.
 *
 * Everything here is a pure function over plain objects — no DOM, no bridge, no
 * asset IO. Writing version assets, enforcing immutability at the install
 * chokepoint and copy-on-write asset preservation sit ON TOP of this, per shell.
 *
 * Two shape rules the rest of the feature depends on:
 *   - A slug is an asset-id SEGMENT, so it must satisfy `[a-z0-9][a-z0-9-]*` —
 *     the grammar `schemas/asset.schema.json` states for every id segment. A
 *     label ("Jupiter", "v2") is the team's own naming and is kept verbatim.
 *   - An unversioned doc stores nothing: withVersionIndex removes the key (and
 *     any container it emptied), so a system that never publishes is byte-identical
 *     to one written before this module existed.
 */

import { bytesToHex, sha256 } from './bytes.ts';
import { TOKEN_EXT } from './tokens.ts';

type Rec = Record<string, unknown>;

// Local, not lib/brand-doc.ts's: the engine may not import a shell, and this is
// the whole of what that helper is.
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * An asset a published version pins: the head id plus the exact bytes it meant.
 *
 * `frozenId` is set ONLY by a shell's copy-on-write hook, never at publish —
 * its presence means the head id's bytes have since changed and the version's
 * bytes were preserved under a content-keyed id (see frozenAssetId). Publishing
 * copies nothing, so an unchanged asset never grows one.
 */
export interface PinnedAsset { id: string; version: string; sha256: string; frozenId?: string }

/** One published version. `slug` addresses it (asset id segment), `label` is what
 *  the team calls it, `checksum` is docChecksum of the tokens doc it froze. */
export interface VersionEntry {
  slug: string;
  label: string;
  date: string;
  note?: string;
  checksum: string;
  assets?: PinnedAsset[];
}

/** The ledger: published versions in publish order, plus which one tools resolve
 *  against (`null` = nothing activated, so tools see the head). */
export interface VersionIndex { versions: VersionEntry[]; active: string | null }

/** The head. Never a slug — `resolveDesignVersion` returns it to mean "the doc
 *  being edited", and `?designv=latest` is the author's preview lever. Kept out
 *  of the slug space by `isVersionSlug`, at both the mint and the read. */
export const DESIGN_VERSION_LATEST = 'latest';

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;
/** Long enough for a date-stamped convention, short enough to stay an id segment. */
const SLUG_MAX = 48;

/**
 * A usable version slug: the id grammar, the length bound, and not the reserved
 * head.
 *
 * `latest` passes the grammar, so without this a version could be published
 * under a name `resolveDesignVersion` short-circuits — it would answer 'latest'
 * for it and every caller would render the head instead, while
 * `versionAssetId(head, 'latest')` minted an asset the ladder can never resolve.
 * A version id is a permanent contract, so the name is refused at the two doors
 * it can come through (minting and reading) rather than half-honoured.
 *
 * SLUG_MAX is enforced HERE, not only in `slugifyVersion`, because minting is
 * not the only door: an imported pack's `versions.json` reaches the install
 * chokepoint with a slug nobody in this process typed (brand-transfer.ts), and
 * a 300-character segment would become a permanent asset id.
 */
export const isVersionSlug = (slug: string): boolean =>
  slug !== DESIGN_VERSION_LATEST && slug.length <= SLUG_MAX && SLUG_RE.test(slug);

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

function readPinnedAssets(v: unknown): PinnedAsset[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: PinnedAsset[] = [];
  for (const raw of v) {
    if (!isRec(raw)) continue;
    const id = str(raw.id), version = str(raw.version), sha256 = str(raw.sha256);
    if (!id || !version || !sha256) continue;
    // Only ever a KEY when there are preserved bytes: a present-but-undefined
    // frozenId is a different object to a deepEqual comparison, and a pin that
    // claims a frozen copy it doesn't have would send resolution to a dead id.
    const frozenId = str(raw.frozenId);
    out.push(frozenId ? { id, version, sha256, frozenId } : { id, version, sha256 });
  }
  return out.length ? out : undefined;
}

/** One stored entry → a VersionEntry, or null when the slug can't address an
 *  asset (an entry we could not resolve is worse than no entry: it would name a
 *  version nothing can load). */
function readEntry(v: unknown): VersionEntry | null {
  if (!isRec(v)) return null;
  const slug = str(v.slug);
  if (!slug || !isVersionSlug(slug)) return null;
  const entry: VersionEntry = {
    slug,
    label: str(v.label) || slug,
    date: str(v.date) ?? '',
    checksum: str(v.checksum) ?? '',
  };
  const note = str(v.note);
  if (note) entry.note = note;
  const assets = readPinnedAssets(v.assets);
  if (assets) entry.assets = assets;
  return entry;
}

/** The doc root's vendor extension object, or null. */
function extOf(doc: unknown): Rec | null {
  if (!isRec(doc)) return null;
  const ext = isRec(doc.$extensions) ? (doc.$extensions as Rec)[TOKEN_EXT] : null;
  return isRec(ext) ? ext : null;
}

/**
 * The version ledger carried by `doc`, tolerant of absence and of garbage.
 *
 * Canonical storage is `{ list, active }`; a bare array (hand-edited, or a doc
 * written before the object form) is read as the list with `active` taken from
 * the extension namespace. Entries that fail the slug grammar or name the
 * reserved head are dropped, a repeated slug keeps its first occurrence, and an
 * `active` naming no known slug reads as null (so `active: 'latest'` on a
 * hand-edited doc falls back to the head) — a caller never has to re-validate
 * what it gets back.
 */
export function readVersionIndex(doc: unknown): VersionIndex {
  const ext = extOf(doc);
  const empty: VersionIndex = { versions: [], active: null };
  if (!ext) return empty;
  const raw = ext.versions;
  const listRaw = Array.isArray(raw)
    ? raw
    : isRec(raw)
      ? (Array.isArray(raw.list) ? raw.list : Array.isArray(raw.versions) ? raw.versions : null)
      : null;
  if (!listRaw) return empty;
  const versions: VersionEntry[] = [];
  const seen = new Set<string>();
  for (const item of listRaw) {
    const entry = readEntry(item);
    if (!entry || seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    versions.push(entry);
  }
  const activeRaw = isRec(raw) ? str(raw.active) : str(ext.active);
  return { versions, active: activeRaw && seen.has(activeRaw) ? activeRaw : null };
}

/**
 * `doc` with `index` written into its vendor extension — a deep clone, so the
 * input is never touched and any other `$extensions` key rides along untouched.
 *
 * An empty index removes the key and prunes the containers it emptied (see the
 * byte-identity rule at the top). A non-record `doc` yields a fresh doc holding
 * only the ledger, so a caller building a system from nothing has a starting point.
 */
export function withVersionIndex(doc: unknown, index: VersionIndex): unknown {
  const next: Rec = isRec(doc) ? (clone(doc) as Rec) : {};
  const versions: VersionEntry[] = [];
  const seen = new Set<string>();
  for (const item of index.versions ?? []) {
    const entry = readEntry(item);
    if (!entry || seen.has(entry.slug)) continue;
    seen.add(entry.slug);
    versions.push(entry);
  }
  const active = index.active && seen.has(index.active) ? index.active : null;

  if (!versions.length) {
    const ext = isRec(next.$extensions) ? (next.$extensions as Rec) : null;
    const ns = ext && isRec(ext[TOKEN_EXT]) ? (ext[TOKEN_EXT] as Rec) : null;
    if (ns) {
      delete ns.versions;
      if (Object.keys(ns).length === 0) delete (ext as Rec)[TOKEN_EXT];
      if (ext && Object.keys(ext).length === 0) delete next.$extensions;
    }
    return next;
  }
  const ext = (isRec(next.$extensions) ? next.$extensions : (next.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  ns.versions = { list: versions, active };
  return next;
}

/**
 * `doc` with its ledger removed — the exact payload a version asset stores.
 *
 * A version never carries a ledger: it is a leaf of the head's history, and a
 * copy of the list as it stood at publish time would be a second, stale source
 * of truth the moment the next version lands. `restoreLatestFrom` puts the
 * head's own (live) ledger back when a version becomes the head again.
 */
export function stripVersionIndex(doc: unknown): unknown {
  return withVersionIndex(doc, { versions: [], active: null });
}

/**
 * A user-typed name → an asset-id segment, or null when nothing survives (an
 * emoji-only name has no addressable form; the caller asks for another).
 * Diacritics fold to their base letter rather than vanishing, so "Jüpiter"
 * stays readable as `jupiter`. "Latest" is the other null: it folds onto the
 * reserved head, and a version nothing can address is worse than a rename.
 */
export function slugifyVersion(label: string): string | null {
  const folded = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const slug = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, SLUG_MAX)
    .replace(/-+$/, '');
  return slug && isVersionSlug(slug) ? slug : null;
}

/**
 * The next label in whatever convention the last publish established — `v1` → `v2`,
 * `2` → `3`, zero padding preserved. A name with no trailing number ("jupiter")
 * has no successor to guess, and neither does an empty ledger: both return '' so
 * the field starts blank and naming stays free.
 */
export function suggestNextLabel(index: VersionIndex): string {
  const last = index.versions[index.versions.length - 1];
  if (!last) return '';
  const m = /^(.*?)(\d+)$/.exec(last.label || last.slug);
  if (!m) return '';
  const digits = m[2] as string;
  const next = String(Number(digits) + 1);
  return (m[1] as string) + (digits.startsWith('0') ? next.padStart(digits.length, '0') : next);
}

/** The asset id a published version lives at: the head id plus one slug segment. */
export function versionAssetId(headId: string, slug: string): string {
  return `${headId.replace(/\/+$/, '')}/${slug}`;
}

/**
 * True when `id` is a published version OF `headId` — the discovery-exclusion
 * predicate of §6a: default tokens discovery skips descendants of a head id, so
 * `user/tokens/brand/jupiter` can never be picked as "the design system", while
 * an unrelated `user/tokens/brandx` is untouched (segment boundary, not prefix).
 */
export function isVersionAssetId(id: string, headId: string): boolean {
  const head = headId.replace(/\/+$/, '');
  return id.length > head.length + 1 && id.startsWith(`${head}/`);
}

/**
 * The first id in `ids` that is not a proper descendant of another id in `ids` —
 * "the design system", as opposed to one of its published versions.
 *
 * Order-preserving on purpose: with zero or one tokens asset (every install that
 * never published, which is nearly all of them) this returns exactly what a bare
 * `.find(...)` returned before the rule existed, and with two UNRELATED tokens
 * assets it still returns the first. It differs only where one id is a proper
 * descendant of another — the versions case, which was undefined behaviour.
 */
export function pickHeadAssetId(ids: readonly string[]): string | null {
  for (const id of ids) {
    if (!ids.some(other => other !== id && isVersionAssetId(id, other))) return id;
  }
  return null;
}

/**
 * The §6a resolution ladder: explicit override → manifest pin → active version →
 * the head. A slug that names no known version falls through to the next rung
 * rather than failing the render — a tool pinned to a version the user never
 * imported still draws, against the next-best system. `latest` is reserved for
 * the head and short-circuits wherever it appears.
 */
export function resolveDesignVersion(
  opts: { override?: string | null; pin?: string | null; index: VersionIndex },
): string {
  const known = new Set(opts.index.versions.map(v => v.slug));
  for (const want of [opts.override, opts.pin]) {
    if (!want) continue;
    if (want === DESIGN_VERSION_LATEST) return DESIGN_VERSION_LATEST;
    if (known.has(want)) return want;
  }
  const active = opts.index.active;
  return active && known.has(active) ? active : DESIGN_VERSION_LATEST;
}

/**
 * SHA-256 of raw bytes as lowercase hex — the digest a pinned asset records, the
 * one `frozenAssetId` keys a preserved copy on, and the one `docChecksum` below
 * takes over a document's canonical JSON.
 *
 * Re-exported rather than written again: one spelling of that contract exists in
 * the engine, and it is the `bytes.ts` leaf. It used to be sourced from
 * `catalog-integrity.ts` (its original home, which still re-exports it, so the
 * barrel surface is unchanged) — but this module is on the web shell's FIRST-PAINT
 * graph via `bridge/assets.ts`, and that edge dragged catalog-integrity + `x509.ts`
 * + `der-read.ts` (~3.6 KB gz of boot chunks) along for a two-line helper, to serve
 * a catalog-signature feature that is inert unless a build pins a public key.
 * Import the leaf, not the module that happens to re-export from it.
 */
export { sha256Hex } from './bytes.ts';

/** How much of the digest names a frozen copy. 48 bits of content key: short
 *  enough to read in a listing, far past any collision a personal library can
 *  reach, and a mismatch is a validator error rather than a silent swap. */
const FROZEN_KEY_LEN = 12;

/**
 * The content-keyed id preserved bytes live at: `<ns>/frozen/<first 12 hex>`.
 * `ns` is 'user' on device and the pack namespace in a catalog.
 *
 * Content-keyed so two versions pinning identical bytes share ONE preserved copy
 * — the storage cost of versioning is what actually diverged, nothing more.
 * Satisfies `schemas/asset.schema.json`'s `^[a-z0-9]+(/[a-z0-9][a-z0-9-]*)+$`.
 *
 * Throws on anything that is not a digest, or on a namespace that is not one plain
 * segment. Both would mint an id no catalog can carry, and a preserved copy at an
 * unloadable id is a version whose bytes are gone with nothing saying so.
 */
export function frozenAssetId(sha256hex: string, ns = 'user'): string {
  const digest = sha256hex.trim().toLowerCase();
  if (!new RegExp(`^[0-9a-f]{${FROZEN_KEY_LEN},}$`).test(digest)) {
    throw new Error(`frozenAssetId: "${sha256hex}" is not a sha-256 hex digest`);
  }
  if (!/^[a-z0-9]+$/.test(ns)) {
    throw new Error(`frozenAssetId: namespace "${ns}" is not a single lowercase id segment`);
  }
  return `${ns}/frozen/${digest.slice(0, FROZEN_KEY_LEN)}`;
}

/** Walk every DTCG leaf (a node carrying `$value`), deepest-first path included.
 *  Stops AT the leaf: a `$value` object's internals are a value, not more tokens. */
function walkLeaves(doc: unknown, visit: (leaf: Rec, path: string[]) => void): void {
  const walk = (node: unknown, path: string[]): void => {
    if (!isRec(node)) return;
    if ('$value' in node) { visit(node, path); return; }
    for (const k of Object.keys(node)) {
      if (k.startsWith('$')) continue;
      walk(node[k], [...path, k]);
    }
  };
  walk(doc, []);
}

/**
 * Every `$type: 'asset'` leaf: its dotted path and the asset id it names.
 *
 * Deliberately generic rather than a walk of `asset.logo.*`: that is simply
 * where the shipped studio puts logos today, and a manifest that only knew that
 * one group would silently stop pinning the moment a doc named an asset anywhere
 * else. An alias `$value` (`{some.ref}`) is not an id and is skipped.
 */
export function collectAssetTokens(doc: unknown): Array<{ path: string; id: string }> {
  const out: Array<{ path: string; id: string }> = [];
  walkLeaves(doc, (leaf, path) => {
    if (leaf.$type !== 'asset') return;
    const id = str(leaf.$value);
    if (!id || id.startsWith('{')) return;
    out.push({ path: path.join('.'), id });
  });
  return out;
}

/**
 * Every family named by a `$type: 'fontFamily'` leaf, flattened and de-duped in
 * first-seen order (a DTCG `$value` may be one family or a fallback array).
 * Feeds the font half of a version's asset manifest, which is why it returns
 * NAMES: a font is addressed by family, and the id behind it is a device fact
 * the caller resolves against its own store.
 */
export function collectFontFamilies(doc: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  walkLeaves(doc, leaf => {
    if (leaf.$type !== 'fontFamily') return;
    const list = Array.isArray(leaf.$value) ? leaf.$value : [leaf.$value];
    for (const raw of list) {
      const family = str(raw)?.replace(/^['"]|['"]$/g, '').trim();
      if (!family || family.startsWith('{')) continue;
      const key = family.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(family);
    }
  });
  return out;
}

/**
 * A copy of `doc` with each `$type: 'asset'` `$value` rewritten to its pin's
 * `frozenId`, where one exists — the ONE place version-scoped asset indirection
 * happens, shared by every shell.
 *
 * Rewriting the DOCUMENT rather than intercepting asset lookups is what keeps
 * this cheap and total: `{asset.logo.x}` resolves to a real, immutable id, so
 * the engine's resolveAssetRefs, the export path and a saved session all see
 * bytes that cannot move under them, with no further plumbing anywhere.
 * Unpinned ids (and pins whose bytes never changed) pass through untouched.
 */
export function applyPinnedAssets(doc: unknown, pins: readonly PinnedAsset[]): unknown {
  const frozen = new Map<string, string>();
  for (const p of pins) if (p.frozenId) frozen.set(p.id, p.frozenId);
  if (!frozen.size || !isRec(doc)) return doc;
  const next = clone(doc) as Rec;
  walkLeaves(next, leaf => {
    if (leaf.$type !== 'asset') return;
    const id = str(leaf.$value);
    const to = id ? frozen.get(id) : undefined;
    if (to) leaf.$value = to;
  });
  return next;
}

/** Key-sorted deep copy — the canonical form both docChecksum and the leaf diff
 *  compare, so a doc rewritten by a different serializer still matches. */
function canonical(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(canonical);
  if (!isRec(v)) return v;
  const out: Rec = {};
  for (const k of Object.keys(v).sort()) {
    const cv = canonical(v[k]);
    if (cv !== undefined) out[k] = cv;
  }
  return out;
}

const canonicalJson = (v: unknown): string => JSON.stringify(canonical(v)) ?? 'null';

/** SHA-256 hex of the doc's canonical JSON — stable under key reordering, so an
 *  identical system re-serialized still matches its published version's checksum.
 *  Web Crypto is present in any browser and in modern Node, so the headless tests
 *  digest for real; where it is absent this throws rather than storing a
 *  placeholder, because a version entry whose checksum is a guess can never be
 *  checked for drift again. */
export async function docChecksum(doc: unknown): Promise<string> {
  return bytesToHex(await sha256(new TextEncoder().encode(canonicalJson(doc))));
}

/** Dotted paths of every leaf holding `$value`, with the leaf's canonical value.
 *  The path keeps its set prefix (`light.color.semantic.primary`) because the same
 *  role exists once per theme set and a diff must tell those apart. */
function tokenLeaves(doc: unknown): Map<string, string> {
  const out = new Map<string, string>();
  walkLeaves(doc, (leaf, path) => { out.set(path.join('.'), canonicalJson(leaf.$value)); });
  return out;
}

/**
 * The compat diff behind publishing: which token paths `b` adds, changes, and
 * drops relative to `a`. Only `$value` is compared — a `$description` edit is not
 * a compatibility event. `removed` is the breaking set (a rename reads as one
 * removal plus one addition, which is exactly how it breaks a tool that named the
 * old path). All three are sorted so a diff renders in a stable order.
 */
export function diffTokenDocs(a: unknown, b: unknown): { added: string[]; changed: string[]; removed: string[] } {
  const prev = tokenLeaves(a), next = tokenLeaves(b);
  const added: string[] = [], changed: string[] = [], removed: string[] = [];
  for (const [path, value] of next) {
    if (!prev.has(path)) added.push(path);
    else if (prev.get(path) !== value) changed.push(path);
  }
  for (const path of prev.keys()) if (!next.has(path)) removed.push(path);
  return { added: added.sort(), changed: changed.sort(), removed: removed.sort() };
}
