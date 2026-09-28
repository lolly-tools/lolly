// SPDX-License-Identifier: MPL-2.0
/**
 * Brand logos - on-device USER ASSETS, mirroring user-fonts.ts. The canonical
 * matrix (orientation × treatment = 8 optional slots) still anchors the UI, but
 * a brand can also carry user-named CUSTOM VARIANTS ("icon", "crest") and whole
 * extra IDENTITIES (a second distinct logo with its own slots). Every mark is
 * one image asset plus a matching `asset.*` token recording which asset id
 * fills the slot - so the brand file carries them (see brand-transfer.ts) and
 * tools can reference them later.
 *
 * Id / token scheme (both are permanent contracts - existing installs only
 * know the default form):
 *   default identity   <ns>logo/<variant>              asset.logo.<variant>
 *   other identities   <ns>logo/<identity>/<variant>   asset.logo.<identity>.<variant>
 * In the token tree a default-identity variant is a TOKEN (has `$value`); an
 * identity is a GROUP (no `$value`) holding that identity's variant tokens.
 *
 * `<ns>` is the namespace of the design system the logo belongs to (plans/186):
 * `user/` for the default system, so a device that only ever had one system
 * keeps exactly the ids it always had, and `user/ds/<id>/` for a named one. A
 * mark is written to, listed from and removed from the ACTIVE system's
 * namespace, so two systems that fill the same slot hold two rows, and neither
 * upload can replace the other system's logo.
 *
 * The doc surgery (withLogoToken / logoGroupOf) is pure + testable; the blob I/O
 * rides the same bridge methods fonts use. Logos render as `<img src=blobURL>`,
 * so an uploaded SVG's markup is drawn, not executed.
 */

import { designMaterialOf, designSystemNamespace } from '../../../../engine/src/design-system.ts';
import { installUserTokens } from '../bridge/tokens.ts';
import { activeHeadId, activeMaterialSystem } from './design-system/active.ts';
import { ensureOwnLogos, withLogoHeadLock, type LogoOwnershipHost } from './design-system/logo-ownership.ts';
import { LEGACY_NS } from './design-system/namespace.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { t, tRaw } from '../i18n.ts';

/** Every logo asset id of the DEFAULT design system starts here (the legacy
 *  namespace, like USER_FONT_PREFIX). A named system's are `user/ds/<id>/logo/`,
 *  and a brand pack always carries this portable form. */
export const USER_LOGO_PREFIX = `${LEGACY_NS}logo/`;

/** The unnamed first identity - its ids/tokens carry NO identity segment. */
export const LOGO_DEFAULT_IDENTITY = 'default';

/** Custom variant and identity slugs: lowercase kebab, 1–40 chars, no leading
 *  dash. Every canonical variant key matches too, so one gate covers both. */
export const LOGO_SLUG_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;

// A canonical logo variant is TWO independent axes: an ORIENTATION (how the
// mark is laid out) × a TREATMENT (its colour form). Every combination is its
// own optional slot - you can supply a primary horizontal AND a reverse
// vertical AND a mono horizontal, etc. The variant key is
// `<orientation>-<treatment>`. Custom variants live beside these under any slug.
export const LOGO_ORIENTATIONS = ['horizontal', 'vertical'] as const;
// Each treatment is its own optional slot: full-colour and mono, each with a
// reverse (dark-background) form. So a brand can carry a primary-reverse and a
// mono-reverse in both orientations.
export const LOGO_TREATMENTS = ['primary', 'primary-reverse', 'mono', 'mono-reverse'] as const;
export type LogoOrientation = typeof LOGO_ORIENTATIONS[number];
export type LogoTreatment = typeof LOGO_TREATMENTS[number];
export type LogoVariant = `${LogoOrientation}-${LogoTreatment}`;

/** The full matrix of variant keys (orientation × treatment), in row order. */
export const LOGO_VARIANTS: readonly LogoVariant[] =
  LOGO_ORIENTATIONS.flatMap(o => LOGO_TREATMENTS.map(t => `${o}-${t}` as LogoVariant));

export const ORIENTATION_META: Record<LogoOrientation, { label: string; hint: string }> = {
  horizontal: { label: t('Horizontal'), hint: t('Wordmark + symbol in a row - the default lockup.') },
  vertical: { label: t('Vertical'), hint: t('Stacked mark for square and tall spaces.') },
};
export const TREATMENT_META: Record<LogoTreatment, { label: string; hint: string }> = {
  primary: { label: t('Primary'), hint: t('Full-colour lockup.') },
  'primary-reverse': { label: t('Primary reverse'), hint: t('Full-colour, for dark backgrounds.') },
  mono: { label: t('Mono'), hint: t('One-colour mark.') },
  'mono-reverse': { label: t('Mono reverse'), hint: t('One-colour, for dark backgrounds.') },
};

/** True when `v` is one of the 8 matrix slots (vs a user-named custom slug). */
export function isCanonicalVariant(v: string): v is LogoVariant {
  return (LOGO_VARIANTS as readonly string[]).includes(v);
}

/** True when a treatment is a reverse (dark-background) form. */
export function isReverseTreatment(t: LogoTreatment): boolean { return t.endsWith('reverse'); }

/** Split a canonical variant key back into its two axes; a custom slug has no
 *  axes, so both come back null - callers must guard. */
export function splitVariant(v: string): { orientation: LogoOrientation | null; treatment: LogoTreatment | null } {
  if (!isCanonicalVariant(v)) return { orientation: null, treatment: null };
  const i = v.indexOf('-');
  return { orientation: v.slice(0, i) as LogoOrientation, treatment: v.slice(i + 1) as LogoTreatment };
}

/** A human name for a variant: the axis labels for a canonical key
 *  ("Horizontal · Reverse"), a prettified slug otherwise ("app-icon" → "App icon"). */
export function variantLabel(v: string): string {
  const { orientation, treatment } = splitVariant(v);
  if (orientation && treatment) return `${ORIENTATION_META[orientation].label} · ${TREATMENT_META[treatment].label}`;
  const words = v.replace(/-+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** The asset id for a slot in the design system whose namespace is `ns` (the
 *  default system's legacy `user/` when omitted). The default identity keeps the
 *  original two-segment form so pre-identity installs stay valid. */
export function logoAssetId(variant: string, identity: string = LOGO_DEFAULT_IDENTITY, ns: string = LEGACY_NS): string {
  const prefix = `${ns}logo/`;
  return identity === LOGO_DEFAULT_IDENTITY ? prefix + variant : `${prefix}${identity}/${variant}`;
}

/**
 * Parse a logo asset id back into the design system it belongs to, its identity
 * and its variant, or null when it isn't a well-formed logo id (not a logo,
 * extra segments, invalid slugs). Both shapes parse: the default system's
 * `user/logo/…` and a named system's `user/ds/<id>/logo/…`; which system owns
 * the id is the engine's structural reading (`designMaterialOf`).
 */
export function parseLogoAssetId(id: string): { identity: string; variant: string; systemId: string } | null {
  const material = designMaterialOf(id);
  if (material?.kind !== 'logo') return null;
  const ns = designSystemNamespace(material.systemId);
  const prefix = `${ns}logo/`;
  if (!ns || !id.startsWith(prefix)) return null;
  const segs = id.slice(prefix.length).split('/');
  const [identity, variant] = segs.length === 1
    ? [LOGO_DEFAULT_IDENTITY, segs[0]!]
    : segs.length === 2 ? [segs[0]!, segs[1]!] : [null, null];
  if (!identity || !variant || !LOGO_SLUG_RE.test(variant)) return null;
  if (identity !== LOGO_DEFAULT_IDENTITY && !LOGO_SLUG_RE.test(identity)) return null;
  return { identity, variant, systemId: material.systemId };
}

export interface LogoSlot {
  variant: string;
  identity: string;
  /** meta.label ?? the canonical axis label ?? the prettified slug. */
  label: string;
  assetId: string;
  /** Object URL for an <img> preview (revoke when the panel re-renders). */
  url: string;
  format: string;
  bytes: number;
  /** True for a user-named variant (not one of the 8 matrix slots). */
  custom: boolean;
}

// PNG / JPEG / SVG / WebP, up to 4 MB - a logo, not a hero photo.
const ACCEPT = /^image\/(png|jpeg|svg\+xml|webp)$/;
const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp',
};
const MAX_BYTES = 4 * 1024 * 1024;

// ── Doc surgery (pure) ────────────────────────────────────────────────────────
type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
/** Non-$ keys - what "empty" means when pruning DTCG groups. */
const named = (r: Rec): number => Object.keys(r).filter(k => !k.startsWith('$')).length;

/** Which set to write the `asset` group into - `base` on a layered doc, else root. */
function assetTargetOf(out: Rec): Rec {
  const layered = Array.isArray(out.$themes) && out.$themes.length > 0;
  if (!layered) return out;
  return (isRec(out.base) ? out.base : (out.base = {} as Rec)) as Rec;
}

/** The record whose `asset.logo` is the doc's logo group: the root of a plain
 *  doc, the first set carrying one on a layered doc (`base` first). */
function logoHolderOf(doc: Rec): Rec | undefined {
  const layered = Array.isArray(doc.$themes) && doc.$themes.length > 0;
  return layered
    ? (['base', ...Object.keys(doc).filter(k => !k.startsWith('$'))]
      .map(k => doc[k])
      .find(v => isRec(v) && isRec((v as Rec).asset) && isRec(((v as Rec).asset as Rec).logo)) as Rec | undefined)
    : doc;
}

/** The `asset.logo` token group in a doc (layered or plain), or null. Pass an
 *  identity to get that identity's nested group instead (null when absent).
 *  NOTE the default group holds BOTH the default identity's variant tokens
 *  (entries with `$value`) and any identity subgroups (entries without). */
export function logoGroupOf(doc: unknown, identity: string = LOGO_DEFAULT_IDENTITY): Rec | null {
  if (!isRec(doc)) return null;
  const holder = logoHolderOf(doc);
  const asset = holder && isRec(holder.asset) ? holder.asset as Rec : null;
  const logo = asset && isRec(asset.logo) ? asset.logo as Rec : null;
  if (!logo || identity === LOGO_DEFAULT_IDENTITY) return logo;
  const group = logo[identity];
  return isRec(group) && !('$value' in group) ? group as Rec : null;
}

/**
 * Merge (or clear, with null) a slot's token into a tokens doc, on a copy - 
 * `asset.logo.<variant>` for the default identity, `asset.logo.<identity>.<variant>`
 * otherwise. Pure; exported for tests. `$type:'asset'` + `$value` = the user
 * asset id. Clearing prunes empty groups all the way up (identity → logo → asset).
 */
export function withLogoToken(
  doc: unknown, variant: string, assetId: string | null, identity: string = LOGO_DEFAULT_IDENTITY,
): Rec {
  const out = structuredClone(isRec(doc) ? doc : {}) as Rec;
  const target = assetTargetOf(out);
  const asset = isRec(target.asset) ? target.asset as Rec : {};
  const logo = isRec(asset.logo) ? asset.logo as Rec : {};
  if (identity === LOGO_DEFAULT_IDENTITY) {
    if (assetId) logo[variant] = { $type: 'asset', $value: assetId };
    else delete logo[variant];
  } else {
    // A token at the identity key (a default-identity variant of the same name)
    // is replaced by the group - installLogo rejects such identities up front.
    const cur = logo[identity];
    const group = isRec(cur) && !('$value' in cur) ? cur as Rec : {};
    if (assetId) { group[variant] = { $type: 'asset', $value: assetId }; logo[identity] = group; }
    else { delete group[variant]; if (named(group)) logo[identity] = group; else delete logo[identity]; }
  }
  if (named(logo)) { asset.logo = logo; target.asset = asset; }
  else { delete asset.logo; if (!named(asset)) delete target.asset; }
  return out;
}

/** `set`'s `asset.logo` group replaced by `group` (a copy), or removed with
 *  null, pruning an `asset` group it empties. Mutates `set`. */
function setLogoGroup(set: Rec, group: Rec | null): void {
  const asset = isRec(set.asset) ? set.asset as Rec : null;
  if (group) {
    const into = asset ?? {};
    into.logo = structuredClone(group);
    set.asset = into;
  } else if (asset) {
    delete asset.logo;
    if (!named(asset)) delete set.asset;
  }
}

/**
 * `target` with its logo tokens replaced by `source`'s, on a copy: every
 * `asset.logo` group (every identity included) is taken from `source`, and
 * `target` keeps everything else. On two layered docs the swap is made set by
 * set, so per-theme logo groups stay in the sets that hold them. Pure; exported
 * for tests.
 *
 * The Logos room writes its tokens straight into the stored head, while the
 * brand studio edits a copy of that document it read when it opened. Its next
 * save grafts the stored logo groups on first (saveWithStoredLogos), so a
 * colour edit made after an upload cannot put back the logo tokens the studio
 * opened with.
 */
export function withLogoGroupFrom(target: unknown, source: unknown): Rec {
  const out = structuredClone(isRec(target) ? target : {}) as Rec;
  const src: Rec = isRec(source) ? source : {};
  const layered = (d: Rec): boolean => Array.isArray(d.$themes) && d.$themes.length > 0;
  const groupIn = (set: unknown): Rec | null =>
    (isRec(set) && isRec(set.asset) && isRec((set.asset as Rec).logo) ? (set.asset as Rec).logo as Rec : null);
  if (layered(out) && layered(src)) {
    const sets = new Set([...Object.keys(out), ...Object.keys(src)].filter(k => !k.startsWith('$')));
    for (const key of sets) {
      const from = groupIn(src[key]);
      if (isRec(out[key])) setLogoGroup(out[key] as Rec, from);
      // A set the studio no longer has only comes back for `base`, which is
      // where every logo write goes.
      else if (from && key === 'base') out.base = { asset: { logo: structuredClone(from) } };
    }
    return out;
  }
  const holder = logoHolderOf(out);
  if (holder) setLogoGroup(holder, null);
  const incoming = logoGroupOf(src);
  if (incoming) setLogoGroup(assetTargetOf(out), incoming);
  return out;
}

/** One logo token of a doc: the slot it fills and the asset id it names. */
export interface LogoTokenRef { identity: string; variant: string; id: string }

/**
 * Every logo token in a doc's logo group, in document order: the default
 * identity's variants, then each named identity's. Keys that are not slugs, and
 * values that are not plain ids (aliases), are skipped. Pure; exported for tests.
 */
export function logoTokensOf(doc: unknown): LogoTokenRef[] {
  const group = logoGroupOf(doc);
  if (!group) return [];
  const out: LogoTokenRef[] = [];
  const idOf = (leaf: unknown): string | null => {
    const value = isRec(leaf) ? leaf.$value : null;
    return typeof value === 'string' && value && !value.startsWith('{') ? value : null;
  };
  for (const [key, node] of Object.entries(group)) {
    if (key.startsWith('$') || !isRec(node) || !LOGO_SLUG_RE.test(key)) continue;
    if ('$value' in node) {
      const id = idOf(node);
      if (id) out.push({ identity: LOGO_DEFAULT_IDENTITY, variant: key, id });
      continue;
    }
    for (const [variant, leaf] of Object.entries(node)) {
      const id = !variant.startsWith('$') && LOGO_SLUG_RE.test(variant) ? idOf(leaf) : null;
      if (id) out.push({ identity: key, variant, id });
    }
  }
  return out;
}

// ── Bridge-backed I/O ─────────────────────────────────────────────────────────
type LogoHost = UserFontsHost;

/**
 * The active design system's stored head document, or null when it has none yet.
 * Read at the ACTIVE design system's head (plans/186 section 3.3), which is the
 * same asset installUserTokens writes back to.
 */
export async function readActiveHeadDoc(host: { assets: { _getBlob(id: string): Promise<Blob | null> }; tokens?: unknown }): Promise<Rec | null> {
  try {
    const blob = await host.assets._getBlob(await activeHeadId(host));
    if (blob) { const parsed = JSON.parse(await blob.text()); if (isRec(parsed)) return parsed; }
  } catch { /* no/corrupt doc - the caller starts from empty */ }
  return null;
}

/** The user's installed tokens doc, or an empty doc when none is installed yet. */
async function userDoc(host: LogoHost): Promise<Rec> {
  return await readActiveHeadDoc(host) ?? {};
}

/**
 * The brand studio's save: `doc` with the STORED head's logo groups grafted on,
 * handed to `write`, as one step in the same queue the Logos room's writes use
 * (logo-ownership.ts `withLogoHeadLock`). Reading the head and writing it
 * separately let an upload written in between be overwritten.
 */
export function saveWithStoredLogos(
  host: { assets: { _getBlob(id: string): Promise<Blob | null> }; tokens?: unknown },
  doc: unknown, write: (doc: Rec) => Promise<void>,
): Promise<void> {
  return withLogoHeadLock(async () => {
    const head = await readActiveHeadDoc(host);
    await write(head ? withLogoGroupFrom(doc, head) : structuredClone(isRec(doc) ? doc : {}) as Rec);
  });
}

/** The repair pass (design-system/logo-ownership.ts) over this module's host slice. */
const ownLogos = (host: LogoHost): Promise<number> => ensureOwnLogos(host as LogoOwnershipHost);

/** One Logos-room tile's data from a stored row. */
function slotOf(
  r: { id: string; blob?: Blob; meta?: Record<string, unknown> }, identity: string, variant: string, blob: Blob,
): LogoSlot {
  const metaLabel = r.meta?.label;
  return {
    variant, identity,
    label: typeof metaLabel === 'string' && metaLabel ? metaLabel : variantLabel(variant),
    custom: !isCanonicalVariant(variant),
    assetId: r.id, url: URL.createObjectURL(blob),
    format: (r.meta?.format as string) || '', bytes: blob.size,
  };
}

/**
 * The ACTIVE design system's logos - canonical AND custom, all identities -
 * each with a fresh object URL for preview. Marks in the Trash are left out, as
 * a brand pack leaves them out.
 *
 * What the system DRAWS comes first: every logo token in its head points at the row
 * that fills that slot, and the slot comes from the token, not from the row's id
 * (a mark copied in by the repair pass, or restored with a published version,
 * can sit at an id of another shape). Then the system's own rows that no token
 * names, at the slot their id spells, where that slot is still empty: an upload
 * whose token was lost still shows, so it can be replaced or removed. Rows the
 * repair pass kept beside a slot (`meta.kept`) only ever show through a token.
 * Another system's rows never show on their own account.
 */
export async function listLogos(host: LogoHost): Promise<LogoSlot[]> {
  await ownLogos(host);
  const system = await activeMaterialSystem(host);
  const head = await readActiveHeadDoc(host);
  const records = await host.assets._exportUserAssets().catch(() => []);
  const byId = new Map(records.map(r => [r.id, r]));
  const out: LogoSlot[] = [];
  const filled = new Set<string>();
  const drawn = new Set<string>();
  for (const ref of logoTokensOf(head)) {
    const r = byId.get(ref.id);
    const key = `${ref.identity}/${ref.variant}`;
    if (!r?.blob || r.trashedAt || filled.has(key) || designMaterialOf(ref.id)?.kind !== 'logo') continue;
    filled.add(key);
    drawn.add(ref.id);
    out.push(slotOf(r, ref.identity, ref.variant, r.blob));
  }
  for (const r of records) {
    if (!r.blob || r.trashedAt || drawn.has(r.id) || r.meta?.kept) continue;
    const parsed = parseLogoAssetId(r.id);
    if (!parsed || parsed.systemId !== system.id) continue;
    const key = `${parsed.identity}/${parsed.variant}`;
    if (filled.has(key)) continue;
    filled.add(key);
    out.push(slotOf(r, parsed.identity, parsed.variant, r.blob));
  }
  return out;
}

/** Store `file` as the given variant of the ACTIVE design system (replacing
 *  that system's existing mark, never another system's) + record the token.
 *  `opts.identity` targets a named identity; `opts.label` names a custom
 *  variant in the UI (canonical slots label themselves). */
export async function installLogo(
  host: LogoHost, variant: string, file: File,
  opts: { identity?: string; label?: string } = {},
): Promise<void> {
  if (!LOGO_SLUG_RE.test(variant)) {
    throw new Error(t('Name the variant in lowercase letters, numbers and dashes (up to 40 characters).'));
  }
  const identity = opts.identity || LOGO_DEFAULT_IDENTITY;
  if (opts.identity === LOGO_DEFAULT_IDENTITY) {
    // 'default' is the UNNAMED identity's reserved key - naming a second logo
    // "default" would silently merge it into the primary one.
    throw new Error(t('“default” is reserved - pick a different name for the identity.'));
  }
  if (identity !== LOGO_DEFAULT_IDENTITY) {
    if (!LOGO_SLUG_RE.test(identity)) {
      throw new Error(t('Name the identity in lowercase letters, numbers and dashes (up to 40 characters).'));
    }
    // An identity named after a matrix slot would shadow that slot's token
    // (asset.logo.<key> can't be a token AND a group).
    if (isCanonicalVariant(identity)) {
      throw new Error(tRaw('“{identity}” is a variant name - pick a different name for the identity.', { identity }));
    }
  }
  if (!ACCEPT.test(file.type)) throw new Error(t('Use a PNG, JPEG, SVG or WebP image.'));
  if (file.size > MAX_BYTES) throw new Error(t('That logo is {size} MB - the limit is 4 MB.', { size: (file.size / 1024 / 1024).toFixed(1) }));
  // The head read below, and the token written into it, must be this system's
  // own: any mark it still borrows from another system's rows is copied first.
  await ownLogos(host);
  const { ns } = await activeMaterialSystem(host);
  await withLogoHeadLock(async () => {
    const doc = await userDoc(host);
    // asset.logo.<key> is ONE namespace shared by default-identity variants and
    // identity groups - refuse a write whose key currently holds the OTHER shape,
    // instead of letting withLogoToken silently destroy that group or token.
    const cur = logoGroupOf(doc)?.[identity !== LOGO_DEFAULT_IDENTITY ? identity : variant];
    if (isRec(cur)) {
      if (identity !== LOGO_DEFAULT_IDENTITY && '$value' in cur) {
        throw new Error(tRaw('“{identity}” is already a mark’s name - pick a different name for the identity.', { identity }));
      }
      if (identity === LOGO_DEFAULT_IDENTITY && !('$value' in cur) && !isCanonicalVariant(variant)) {
        throw new Error(tRaw('“{variant}” is already a logo’s name - pick a different name for the mark.', { variant }));
      }
    }
    const id = logoAssetId(variant, identity, ns);
    const format = EXT[file.type] || 'png';
    // Store under a real catalogue asset type (the schema enum has no 'image'):
    // an SVG mark is vector, everything else raster - so it shows in the catalog.
    const type = format === 'svg' ? 'vector' : 'raster';
    const label = opts.label?.trim();
    await host.assets._uploadUserAsset({
      id, type, format, blob: file,
      meta: { format, variant, identity, ...(label ? { label } : {}), kind: 'logo' },
    });
    // No label: placing a mark is not a rename. A label here renamed whichever
    // system was active to "My brand" on every upload.
    await installUserTokens(host as Parameters<typeof installUserTokens>[0], withLogoToken(doc, variant, id, identity));
  });
}

/**
 * Empty a slot of the ACTIVE design system: clear its token (pruning an emptied
 * identity group), then delete the rows that filled it - the row the token
 * named and the slot's own row - when they are this system's own and no other
 * token of the head still points at them. Another system's row is never deleted
 * here, even when this system was drawing that mark.
 */
export async function removeLogo(
  host: LogoHost, variant: string, identity: string = LOGO_DEFAULT_IDENTITY,
): Promise<void> {
  await ownLogos(host);
  const system = await activeMaterialSystem(host);
  await withLogoHeadLock(async () => {
    const doc = await userDoc(host);
    const drawnId = logoTokensOf(doc).find(ref => ref.identity === identity && ref.variant === variant)?.id;
    const next = withLogoToken(doc, variant, null, identity);
    await installUserTokens(host as Parameters<typeof installUserTokens>[0], next);
    const stillNamed = new Set(logoTokensOf(next).map(ref => ref.id));
    for (const id of new Set([drawnId, logoAssetId(variant, identity, system.ns)])) {
      if (!id || stillNamed.has(id)) continue;
      const owner = designMaterialOf(id);
      if (owner?.kind !== 'logo' || owner.systemId !== system.id) continue;
      await host.assets._deleteUserAsset(id).catch(() => {});
    }
  });
}
