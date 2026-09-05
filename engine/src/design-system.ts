// SPDX-License-Identifier: MPL-2.0
/**
 * design-system.ts - the identity and namespace rules for holding SEVERAL design
 * systems on one device (plans/186 section 6).
 *
 * A device used to hold exactly one design system, and it had no name of its own:
 * it was whatever asset answered to `user/tokens/brand`, with its fonts under
 * `user/fonts/*` and its logos under `user/logo/*`. Once a second one can exist,
 * two questions have to be answered the same way everywhere: what a design system
 * is called, and which system a given asset id belongs to.
 *
 * This lives in the ENGINE, not a shell, for the reason design-version.ts states:
 * the web bridge, the CLI bridge and the MCP server all resolve material against a
 * design system, and three private readings of the id grammar would each render a
 * different system from the one the author saved. The identity written INTO the
 * tokens document is the other half of that: a `.lolly` share, a pack or a plain
 * DTCG file then carries its own name with it, and no sidecar has to survive the
 * trip.
 *
 * Everything here is a pure function over plain objects - no DOM, no bridge, no
 * asset IO. The device's record store, switching, migration and every write of
 * actual bytes sit ON TOP of this, per shell.
 *
 * Three shape rules the rest of the feature depends on:
 *   - An id is an asset-id SEGMENT, so it must satisfy `[a-z0-9][a-z0-9-]*` -
 *     the grammar `schemas/asset.schema.json` states for every id segment - and it
 *     is what a namespace is built from. A label ("SUSE", "Acme 2026") is the
 *     team's own naming and is kept verbatim.
 *   - The migrated system keeps the legacy `user/` namespace FOREVER (plan 186
 *     decision 7). Saved sessions reference placed assets by id, so re-keying
 *     `user/logo/horizontal-primary` would break every session on the device.
 *     Every other system mints under `user/ds/<id>/`.
 *   - An un-identified doc stores nothing: withDesignSystemIdentity removes the
 *     key (and any container it emptied), so a doc written before this module
 *     existed round-trips byte-identically. Same rule as withVersionIndex.
 */

// The leaf, not tokens.ts: this module is reached from the shell's boot path with
// the same edge design-version.ts documents, and it needs one string from there.
import { TOKEN_EXT } from './token-ext.ts';

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);
const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

/** The id grammar: one asset-id segment, so a namespace built from it is a valid
 *  asset id. Deliberately the same pattern a version slug uses. */
export const DESIGN_SYSTEM_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/** Long enough for "acme-2026-rebrand", short enough to stay an id segment. */
export const DESIGN_SYSTEM_ID_MAX = 48;

/**
 * The system that owns the legacy `user/` namespace: whatever the device already
 * had before design systems could be told apart. Migration writes this record
 * when `user/tokens/brand` exists, and it keeps its namespace forever.
 */
export const DEFAULT_DESIGN_SYSTEM_ID = 'default';

/**
 * The build's own catalog tokens asset. Always present, never removable, and the
 * one a fresh install runs on. It is the only system with NO user namespace: its
 * material is the catalog's, not the person's, so nothing is ever minted under it.
 */
export const SHIPPED_DESIGN_SYSTEM_ID = 'shipped';

/**
 * A usable design-system id: the segment grammar and the length bound.
 *
 * Unlike a version slug, `latest` is not reserved here - it addresses no head and
 * short-circuits nothing, so a person may legitimately call a system that. The
 * length is enforced HERE rather than only in `slugifyDesignSystemId`, because
 * minting is not the only entry point: an imported pack or a backup arrives with
 * an id nobody in this process typed, and a 300-character segment would become a
 * permanent asset-id prefix.
 */
export function isDesignSystemId(v: unknown): v is string {
  return typeof v === 'string' && v.length <= DESIGN_SYSTEM_ID_MAX && DESIGN_SYSTEM_ID_RE.test(v);
}

/**
 * A user-typed label to an id: "SUSE 2026" becomes `suse-2026`.
 *
 * Diacritics fold to their base letter rather than vanishing, so "Ünivers" stays
 * readable as `univers`. Unlike `slugifyVersion` this never returns null: a design
 * system must exist under some addressable id, and an emoji-only label would
 * otherwise block creation outright, so the fallback `design-system` is used and
 * the caller is free to de-duplicate it against the ids already on the device.
 */
export function slugifyDesignSystemId(label: string): string {
  const folded = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const id = folded
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, DESIGN_SYSTEM_ID_MAX)
    .replace(/-+$/, '');
  return isDesignSystemId(id) ? id : 'design-system';
}

/**
 * The asset-id prefix a system's material is minted under, trailing slash included
 * so a caller can concatenate.
 *
 * `default` keeps the legacy `user/` (see the header). `shipped` has no user
 * namespace at all and returns the empty string: nothing is minted for it, and a
 * caller that tries to build an id from it gets a bare relative id it can spot.
 * Anything else is `user/ds/<id>/`.
 *
 * Throws on an id that fails the grammar. A namespace is the prefix of permanent
 * asset ids, so an unusable one must be refused at the mint rather than written
 * into rows that no validator would accept afterwards.
 */
export function designSystemNamespace(id: string): string {
  if (!isDesignSystemId(id)) {
    throw new Error(`designSystemNamespace: "${id}" is not a design-system id`);
  }
  if (id === SHIPPED_DESIGN_SYSTEM_ID) return '';
  if (id === DEFAULT_DESIGN_SYSTEM_ID) return 'user/';
  return `user/ds/${id}/`;
}

/**
 * The asset id of a system's edit head - the tokens doc the studio writes.
 *
 * Throws for `shipped`, whose head is an asset the BUILD ships in the catalog
 * under whatever id that catalog gave it. There is no rule that derives it, and
 * guessing one would send a reader to an id the catalog does not hold.
 */
export function designSystemHeadId(id: string): string {
  if (id === SHIPPED_DESIGN_SYSTEM_ID) {
    throw new Error('designSystemHeadId: the shipped system\'s head is the catalog\'s own tokens asset');
  }
  return `${designSystemNamespace(id)}tokens/brand`;
}

/** What kind of design material an id addresses. `version` is a published version
 *  of the tokens doc (the descendant rule in design-version.ts), the rest are the
 *  head, a font face and a logo variant. */
export type DesignMaterialKind = 'tokens' | 'version' | 'font' | 'logo';

/** Which system an asset id belongs to, and what it is to that system. */
export interface DesignMaterial { systemId: string; kind: DesignMaterialKind }

/**
 * The kind an id's segments AFTER its namespace address, or null when they address
 * no design material at all.
 *
 * Segment counts are exact on purpose. `user/tokens/brandx` is a different asset
 * from the head, `user/tokens/brand/a/b` is nothing the version rule can address,
 * and treating either as material would hand a system bytes that are not its own.
 */
function kindOfRest(rest: readonly string[]): DesignMaterialKind | null {
  if (rest.some(seg => !seg)) return null;
  const [head, second] = rest;
  if (head === 'tokens' && second === 'brand') {
    if (rest.length === 2) return 'tokens';
    return rest.length === 3 ? 'version' : null;
  }
  // user/fonts/<family-slug>/<n>: one face of one family.
  if (head === 'fonts') return rest.length === 3 ? 'font' : null;
  // user/logo/<variant> and user/logo/<identity>/<variant> both ship today.
  if (head === 'logo') return rest.length === 2 || rest.length === 3 ? 'logo' : null;
  return null;
}

/**
 * Which design system an asset id belongs to, read STRUCTURALLY from the id.
 *
 * No record list is needed, and that is the point: the id itself says which system
 * minted it, so a guard deep in a bridge can answer the question without loading
 * the device's records first. This is the one reading of the rule for every place
 * that used to test a literal prefix.
 *
 * Returns null for everything that is not design material, which is most of the
 * `user/` namespace: personal uploads (`user/raster/<ms>-…`), the headshot, saved
 * profiles and the content-keyed frozen bytes, which stay GLOBAL because two
 * systems pinning identical bytes share one row. Catalog ids belong to a catalog,
 * not to a user system, so they are null too.
 */
export function designMaterialOf(id: string): DesignMaterial | null {
  const segs = id.split('/');
  if (segs[0] !== 'user' || segs.length < 2) return null;
  // The namespaced form: user/ds/<id>/… . `ds` cannot collide with the legacy
  // second segments below, all of which name a material kind.
  if (segs[1] === 'ds') {
    const systemId = segs[2];
    if (!isDesignSystemId(systemId)) return null;
    const kind = kindOfRest(segs.slice(3));
    return kind ? { systemId, kind } : null;
  }
  const kind = kindOfRest(segs.slice(1));
  return kind ? { systemId: DEFAULT_DESIGN_SYSTEM_ID, kind } : null;
}

/** A design system as its own tokens document names it. The device's record is the
 *  local index; this is the portable truth that travels with the file. */
export interface DesignSystemIdentity { id: string; label: string }

/** The doc root's vendor extension object, or null. */
function extOf(doc: unknown): Rec | null {
  if (!isRec(doc)) return null;
  const ext = isRec(doc.$extensions) ? (doc.$extensions as Rec)[TOKEN_EXT] : null;
  return isRec(ext) ? ext : null;
}

/**
 * The identity `doc` carries, tolerant of absence and of garbage.
 *
 * An id that fails the grammar reads as no identity at all rather than as a
 * half-identity: it could not name a namespace, so a caller acting on it would
 * mint ids no catalog can carry. A missing or empty label falls back to the id, so
 * the returned label is always something a list can print.
 */
export function readDesignSystemIdentity(doc: unknown): DesignSystemIdentity | null {
  const ext = extOf(doc);
  const raw = ext ? ext.designSystem : null;
  if (!isRec(raw)) return null;
  const id = str(raw.id);
  if (!isDesignSystemId(id)) return null;
  return { id, label: str(raw.label) || id };
}

/**
 * `doc` with `identity` written into its vendor extension - a deep clone, so the
 * input is never touched and any other `$extensions` key rides along untouched.
 *
 * `null` (and an identity whose id fails the grammar, which is the same thing to a
 * reader) removes the key and prunes the containers it emptied, so a doc that was
 * never given an identity is byte-identical to one written before this module
 * existed. A non-record `doc` yields a fresh doc holding only the identity, so a
 * caller building a system from nothing has a starting point.
 */
export function withDesignSystemIdentity(doc: unknown, identity: DesignSystemIdentity | null): unknown {
  const next: Rec = isRec(doc) ? (clone(doc) as Rec) : {};
  const id = identity && isDesignSystemId(identity.id) ? identity.id : null;

  if (!id) {
    const ext = isRec(next.$extensions) ? (next.$extensions as Rec) : null;
    const ns = ext && isRec(ext[TOKEN_EXT]) ? (ext[TOKEN_EXT] as Rec) : null;
    if (ns) {
      delete ns.designSystem;
      if (Object.keys(ns).length === 0) delete (ext as Rec)[TOKEN_EXT];
      if (ext && Object.keys(ext).length === 0) delete next.$extensions;
    }
    return next;
  }
  const ext = (isRec(next.$extensions) ? next.$extensions : (next.$extensions = {} as Rec)) as Rec;
  const ns = (isRec(ext[TOKEN_EXT]) ? ext[TOKEN_EXT] : (ext[TOKEN_EXT] = {} as Rec)) as Rec;
  ns.designSystem = { id, label: (identity && str(identity.label)) || id };
  return next;
}
