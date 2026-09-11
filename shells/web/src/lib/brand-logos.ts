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
 *   default identity   user/logo/<variant>              asset.logo.<variant>
 *   other identities   user/logo/<identity>/<variant>   asset.logo.<identity>.<variant>
 * In the token tree a default-identity variant is a TOKEN (has `$value`); an
 * identity is a GROUP (no `$value`) holding that identity's variant tokens.
 *
 * The doc surgery (withLogoToken / logoGroupOf) is pure + testable; the blob I/O
 * rides the same bridge methods fonts use. Logos render as `<img src=blobURL>`,
 * so an uploaded SVG's markup is drawn, not executed.
 */

import { installUserTokens } from '../bridge/tokens.ts';
import { activeHeadId } from './design-system/active.ts';
import type { UserFontsHost } from '../user-fonts.ts';
import { t, tRaw } from '../i18n.ts';

/** Every logo asset id starts here (fixed namespace, like USER_FONT_PREFIX). */
export const USER_LOGO_PREFIX = 'user/logo/';

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

/** The asset id for a slot - the default identity keeps the original two-segment
 *  form so pre-identity installs stay valid. */
export function logoAssetId(variant: string, identity: string = LOGO_DEFAULT_IDENTITY): string {
  return identity === LOGO_DEFAULT_IDENTITY
    ? USER_LOGO_PREFIX + variant
    : `${USER_LOGO_PREFIX}${identity}/${variant}`;
}

/** Parse a logo asset id back into identity + variant, or null when it isn't a
 *  well-formed logo id (wrong prefix, extra segments, invalid slugs). */
export function parseLogoAssetId(id: string): { identity: string; variant: string } | null {
  if (!id.startsWith(USER_LOGO_PREFIX)) return null;
  const segs = id.slice(USER_LOGO_PREFIX.length).split('/');
  const [identity, variant] = segs.length === 1
    ? [LOGO_DEFAULT_IDENTITY, segs[0]!]
    : segs.length === 2 ? [segs[0]!, segs[1]!] : [null, null];
  if (!identity || !variant || !LOGO_SLUG_RE.test(variant)) return null;
  if (identity !== LOGO_DEFAULT_IDENTITY && !LOGO_SLUG_RE.test(identity)) return null;
  return { identity, variant };
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

/** The `asset.logo` token group in a doc (layered or plain), or null. Pass an
 *  identity to get that identity's nested group instead (null when absent).
 *  NOTE the default group holds BOTH the default identity's variant tokens
 *  (entries with `$value`) and any identity subgroups (entries without). */
export function logoGroupOf(doc: unknown, identity: string = LOGO_DEFAULT_IDENTITY): Rec | null {
  if (!isRec(doc)) return null;
  const layered = Array.isArray(doc.$themes) && doc.$themes.length > 0;
  const holder = layered
    ? (['base', ...Object.keys(doc).filter(k => !k.startsWith('$'))]
      .map(k => doc[k])
      .find(v => isRec(v) && isRec((v as Rec).asset) && isRec(((v as Rec).asset as Rec).logo)) as Rec | undefined)
    : doc;
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

// ── Bridge-backed I/O ─────────────────────────────────────────────────────────
type LogoHost = UserFontsHost;

/** The user's installed tokens doc, or an empty doc when none is installed yet.
 *  Read at the ACTIVE design system's head (plans/186 section 3.3), which is the
 *  same asset installUserTokens writes back to below. */
async function userDoc(host: LogoHost): Promise<Rec> {
  try {
    const blob = await host.assets._getBlob(await activeHeadId(host));
    if (blob) { const parsed = JSON.parse(await blob.text()); if (isRec(parsed)) return parsed; }
  } catch { /* no/corrupt doc - start from empty, same as the font path */ }
  return {};
}

/** Every stored logo - canonical AND custom, all identities - each with a fresh
 *  object URL for preview. Identity + variant come from the id (existing
 *  installs never wrote them into meta); only malformed slugs are skipped. */
export async function listLogos(host: LogoHost): Promise<LogoSlot[]> {
  const records = await host.assets._exportUserAssets().catch(() => []);
  const out: LogoSlot[] = [];
  for (const r of records) {
    if (!r.id.startsWith(USER_LOGO_PREFIX) || !r.blob) continue;
    const parsed = parseLogoAssetId(r.id);
    if (!parsed) continue;
    const { identity, variant } = parsed;
    const metaLabel = r.meta?.label;
    out.push({
      variant, identity,
      label: typeof metaLabel === 'string' && metaLabel ? metaLabel : variantLabel(variant),
      custom: !isCanonicalVariant(variant),
      assetId: r.id, url: URL.createObjectURL(r.blob),
      format: (r.meta?.format as string) || '', bytes: r.blob.size,
    });
  }
  return out;
}

/** Store `file` as the given variant (replacing any existing) + record the
 *  token. `opts.identity` targets a named identity; `opts.label` names a
 *  custom variant in the UI (canonical slots label themselves). */
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
  // asset.logo.<key> is ONE namespace shared by default-identity variants and
  // identity groups - refuse a write whose key currently holds the OTHER shape,
  // instead of letting withLogoToken silently destroy it.
  {
    const cur = logoGroupOf(await userDoc(host))?.[identity !== LOGO_DEFAULT_IDENTITY ? identity : variant];
    if (isRec(cur)) {
      if (identity !== LOGO_DEFAULT_IDENTITY && '$value' in cur) {
        throw new Error(tRaw('“{identity}” is already a mark’s name - pick a different name for the identity.', { identity }));
      }
      if (identity === LOGO_DEFAULT_IDENTITY && !('$value' in cur) && !isCanonicalVariant(variant)) {
        throw new Error(tRaw('“{variant}” is already a logo’s name - pick a different name for the mark.', { variant }));
      }
    }
  }
  const id = logoAssetId(variant, identity);
  const format = EXT[file.type] || 'png';
  // Store under a real catalogue asset type (the schema enum has no 'image'):
  // an SVG mark is vector, everything else raster - so it shows in the catalog.
  const type = format === 'svg' ? 'vector' : 'raster';
  const label = opts.label?.trim();
  await host.assets._uploadUserAsset({
    id, type, format, blob: file,
    meta: { format, variant, identity, ...(label ? { label } : {}), kind: 'logo' },
  });
  const doc = withLogoToken(await userDoc(host), variant, id, identity);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
}

/** Remove a slot's asset + clear its token (pruning an emptied identity group). */
export async function removeLogo(
  host: LogoHost, variant: string, identity: string = LOGO_DEFAULT_IDENTITY,
): Promise<void> {
  await host.assets._deleteUserAsset(logoAssetId(variant, identity)).catch(() => {});
  const doc = withLogoToken(await userDoc(host), variant, null, identity);
  await installUserTokens(host as Parameters<typeof installUserTokens>[0], doc, { label: 'My brand' });
}
