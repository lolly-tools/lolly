// SPDX-License-Identifier: MPL-2.0
/**
 * What decides a preview render, and its key (plan 373, section 5.3).
 *
 * A cached picture is found by the hash of its recipe: the tool and its version,
 * the input values, the design-system context, the colourway, the poster frame and
 * the size class. Two views that draw the same look (a gallery cover, a template
 * preview and a published tile of one template) share one entry and one render.
 *
 * The design-system context is the same value the baked gallery covers are keyed
 * by (`coverContextHash` of `previewContextSignature`, lib/gallery-covers.ts), so a
 * baked manifest and the store agree by construction. Building that signature
 * reads every token, so its digest is kept per token set and computed once for a
 * gallery paint, not once for each tile.
 */
import type { HostV1, Profile } from '@lolly-tools/core/host-v1';

/** Raised when a render fault is fixed and pictures drawn before must not be reused.
 *  4 follows the `version: 3` the context signature still carries. */
export const RECIPE_VERSION = 4;

// Profile fields any tool currently binds via bindToProfile. The signature changes
// iff one of these changes, which is exactly when a personalized picture goes
// stale. (Headshot is intentionally absent - no tool binds it today.)
const SIGNATURE_FIELDS: ReadonlyArray<'firstname' | 'lastname' | 'email' | 'phone' | 'city' | 'country'> =
  ['firstname', 'lastname', 'email', 'phone', 'city', 'country'];

/**
 * A stable signature of the profile fields that affect personalized previews.
 * Returns '' when the person has not opted in, so opting out reverts cards to the
 * pictures everyone sees.
 */
export function profileSignature(profile: Profile | null | undefined): string {
  if (!profile?.useDetails) return '';
  return JSON.stringify(SIGNATURE_FIELDS.map((f) => profile[f] ?? ''));
}

/** The effective brand and opted-in profile an on-device preview renders with.
 *  The exact text the baked covers were hashed from: do not change its shape
 *  without baking the covers again. */
export async function previewContextSignature(host: Pick<HostV1, 'tokens' | 'profile'>): Promise<string> {
  const [set, active, profile, colors] = await Promise.all([
    host.tokens?.get(), host.tokens?.active?.(), host.profile?.get(), host.tokens?.colors?.(),
  ]);
  return signatureOf(set, active, profile, colors);
}

type TokenSet = Awaited<ReturnType<NonNullable<HostV1['tokens']>['get']>>;

function signatureOf(set: TokenSet | undefined, active: { id?: string } | null | undefined, profile: Profile | null | undefined, colors: unknown): string {
  const tokens = set?.query().map(({ path, type, value }) => [path, type, value])
    .sort((a, b) => String(a[0]).localeCompare(String(b[0]))) ?? [];
  return JSON.stringify({
    version: 3, // Regenerate SVG previews that previously depended on installed fonts.
    brand: active?.id ?? null,
    tokens,
    colors: colors ?? [],
    theme: typeof document === 'undefined' ? '' : document.documentElement.dataset.theme ?? '',
    details: profileSignature(profile),
  });
}

/** SHA-256 of text, first 16 bytes, hex. */
export async function shortHash(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Context digests kept per token set object, then per the cheap parts around the set. */
const digests = new WeakMap<object, Map<string, Promise<string>>>();
let digestComputations = 0;
/** How many times a context digest was actually computed (a test counts these). */
export function contextDigestComputations(): number { return digestComputations; }

/**
 * The design-system context of a preview, as a 32-hex digest: the same value
 * `coverContextHash(previewContextSignature(host))` gives, computed once per token
 * set and theme rather than once per tile.
 */
export async function previewContextDigest(host: Pick<HostV1, 'tokens' | 'profile'>): Promise<string> {
  const [set, active, profile, colors] = await Promise.all([
    host.tokens?.get(), host.tokens?.active?.(), host.profile?.get(), host.tokens?.colors?.(),
  ]);
  const theme = typeof document === 'undefined' ? '' : document.documentElement.dataset.theme ?? '';
  const around = JSON.stringify([active?.id ?? null, colors ?? [], theme, profileSignature(profile)]);
  const holder = (set && typeof set === 'object' ? set : digests) as object;
  let byAround = digests.get(holder);
  if (!byAround) { byAround = new Map(); digests.set(holder, byAround); }
  let digest = byAround.get(around);
  if (!digest) {
    digestComputations++;
    digest = shortHash(signatureOf(set, active, profile, colors));
    byAround.set(around, digest);
    digest.catch(() => byAround!.delete(around));
  }
  return digest;
}

/** Everything that decides what a cached preview looks like. */
export interface PreviewRecipe {
  tool: string;
  /** The tool's manifest version, or a digest of a sideloaded tool's files. */
  version?: string;
  /** The input values the look renders with. */
  values: unknown;
  /** previewContextDigest of the host. */
  context: string;
  /** The colourway selection, when there is one. */
  colourway?: unknown;
  /** Page index, artboard id or poster time in milliseconds. */
  frame?: string | number;
  /** Rendered at a per-look width and height instead of the tool's canvas. */
  size?: { width: number; height: number };
  /** A brand scope the render was made under beyond the design system (the template
   *  chooser's mounted brand slots). */
  scope?: string;
}

/** Canonical JSON: object keys sorted at every level, so equal recipes hash equal. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>).filter(([, v]) => v !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(',')}}`;
}

/** The key a cached preview is stored under: 32 hex characters. */
export function previewRecipeKey(recipe: PreviewRecipe): Promise<string> {
  return shortHash(canonicalJson({ v: RECIPE_VERSION, size: 'tile', ...recipe }));
}

/** The catalog version of a tool, when the index is in memory. */
export function catalogToolVersion(toolId: string): string | undefined {
  const tools = (globalThis as { __toolIndex?: { tools?: Array<{ id: string; version?: unknown }> } }).__toolIndex?.tools;
  const version = tools?.find(tool => tool.id === toolId)?.version;
  return typeof version === 'string' ? version : undefined;
}
