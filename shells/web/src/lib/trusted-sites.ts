// SPDX-License-Identifier: MPL-2.0
/**
 * Trusted sites (plan 288 section 5.3): may Lolly contact this site without asking?
 * One answer for the Sandbox's fetch-and-inline and for a Design web page box's frame.
 *
 * Three sources, merged here and nowhere else:
 *   you           `Profile.trustedSites`, written by "Always trust" and by /profile
 *   brand         the catalog's `defaultTrustedSites`, merged until the person first
 *                 edits their list (the hidden-tools seeding pattern), so a removal sticks
 *   organisation  lib/site-policy.ts, which only a governed deployment sets
 * What an entry covers is the engine's call (engine/src/trusted-sites.ts).
 *
 * Trust removes a question. It never widens the app's Content-Security-Policy: a trusted
 * site the hosted web refuses to frame or fetch is still refused, and the UI says so
 * separately from "not trusted yet".
 */
import type { Profile } from '@lolly-tools/core/host-v1';
import { DEFAULT_REFERENCE_SITES, matchTrustedSite, normaliseTrustedSite, normaliseTrustedSites } from '../../../../engine/src/trusted-sites.ts';
import { sitePolicy, type SiteRule } from './site-policy.ts';

export type TrustSource = 'you' | 'brand' | 'organisation' | 'default';

export interface SiteVerdict {
  /** `trusted`: contact it without asking. `ask`: nobody has decided. `blocked`: an
   *  organisation rule forbids it, and no question will change that. */
  state: 'trusted' | 'ask' | 'blocked';
  /** The entry that decided, when one did. */
  entry?: string;
  source?: TrustSource;
  /** An organisation rule's own reason, and who set the policy. */
  reason?: string;
  by?: string;
}

export interface TrustedSiteRow {
  entry: string;
  source: TrustSource;
  /** An organisation's entry, which the person cannot remove. */
  locked: boolean;
  reason?: string;
}

/** The web bridge's profile API; `set` is web-shell-only, so it is optional here. */
interface ProfileHost {
  profile: { get(): Promise<Profile>; set?(p: Profile): Promise<void> };
}

let host: ProfileHost | null = null;
let profile: Profile | null = null;
let brandDefaults: string[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const cb of listeners) cb();
}

/** Read the person's list once at boot, and keep the host for later writes. */
export async function initTrustedSites(profileHost: ProfileHost): Promise<void> {
  host = profileHost;
  try { profile = await profileHost.profile.get(); } catch { profile = null; }
  emit();
}

/** The brand's shipped entries, from the catalog asset index (catalog/sync.ts). */
export function setBrandTrustedSites(list: unknown): void {
  brandDefaults = normaliseTrustedSites(list);
  emit();
}

/** The brand's entries, unless an organisation turned them off on this instance. */
function brandList(): string[] {
  return sitePolicy()?.brandDefaults === 'ignore' ? [] : brandDefaults;
}

function personalList(p: Profile | null = profile): string[] {
  const stored = normaliseTrustedSites(p?.trustedSites);
  const brand = [...referenceList(), ...brandList()];
  return p?.trustedSitesSeeded || !brand.length ? stored : normaliseTrustedSites([...brand, ...stored]);
}

function referenceList(): readonly string[] {
  return sitePolicy()?.brandDefaults === 'ignore' ? [] : DEFAULT_REFERENCE_SITES;
}

function sourceOf(entry: string): TrustSource {
  return brandList().includes(entry) ? 'brand' : referenceList().includes(entry) ? 'default' : 'you';
}

function firstRule(rules: readonly SiteRule[], urls: readonly string[]): SiteRule | null {
  for (const url of urls) {
    for (const rule of rules) if (matchTrustedSite(url, [rule.entry])) return rule;
  }
  return null;
}

/**
 * The verdict for the URL Lolly would contact. `alsoBlock` is the link the person gave
 * when it differs (a YouTube page played from youtube-nocookie.com): an organisation's
 * block on either one applies, while trust is only ever read for the host contacted.
 */
export function siteVerdict(url: string, alsoBlock?: string): SiteVerdict {
  const policy = sitePolicy();
  if (policy) {
    const by = policy.by ? { by: policy.by } : {};
    const blocked = firstRule(policy.block, alsoBlock ? [url, alsoBlock] : [url]);
    if (blocked) return { state: 'blocked', entry: blocked.entry, source: 'organisation', ...(blocked.reason ? { reason: blocked.reason } : {}), ...by };
    if (policy.mode === 'none') return { state: 'blocked', source: 'organisation', ...(policy.reason ? { reason: policy.reason } : {}), ...by };
    const allowed = firstRule(policy.allow, [url]);
    if (allowed) return { state: 'trusted', entry: allowed.entry, source: 'organisation', ...by };
    if (policy.mode === 'allowlist-only') return { state: 'blocked', source: 'organisation', ...by };
  }
  const hit = matchTrustedSite(url, personalList());
  if (hit) return { state: 'trusted', entry: hit, source: sourceOf(hit) };
  return { state: 'ask' };
}

/** Whether the person may change their own list: not under `allowlist-only` or `none`,
 *  and not when an organisation locks the list. */
export function canTrustMore(): boolean {
  const policy = sitePolicy();
  return policy?.mode !== 'allowlist-only' && policy?.mode !== 'none' && policy?.memberEntries !== 'locked';
}

/** Every entry in force, for /profile: the organisation's first (locked), then the
 *  person's own list with the brand's entries marked. */
export function trustedSiteRows(): TrustedSiteRow[] {
  const policy = sitePolicy();
  const rows: TrustedSiteRow[] = (policy?.allow ?? []).map((r) => ({ entry: r.entry, source: 'organisation', locked: true, ...(r.reason ? { reason: r.reason } : {}) }));
  const orgEntries = new Set(rows.map((r) => r.entry));
  if (policy?.mode === 'allowlist-only' || policy?.mode === 'none') return rows;
  for (const entry of personalList()) {
    if (!orgEntries.has(entry)) rows.push({ entry, source: sourceOf(entry), locked: policy?.memberEntries === 'locked' });
  }
  return rows;
}

/** The organisation's blocked entries, for /profile to show beside the list. */
export function blockedSiteRows(): SiteRule[] {
  return [...(sitePolicy()?.block ?? [])];
}

async function writeList(edit: (list: string[]) => string[]): Promise<boolean> {
  if (!host || !canTrustMore()) return false;
  // The bridge hands out its cached record; read it again so a write made elsewhere
  // since boot (another view, a restore) is the one edited.
  try { profile = await host.profile.get(); } catch { /* keep the one read at boot */ }
  if (!profile) return false;
  profile.trustedSites = normaliseTrustedSites(edit(personalList(profile)));
  profile.trustedSitesSeeded = true;
  try { await host.profile.set?.(profile); } catch { /* storage off or full: kept for this session */ }
  emit();
  return true;
}

/** "Always trust": add one entry to the person's list. The stored entry, or null when
 *  the text is not an entry or an organisation keeps the list closed. */
export async function trustSite(input: string): Promise<string | null> {
  const entry = normaliseTrustedSite(input);
  if (!entry || !canTrustMore()) return null;
  const ok = await writeList((list) => (list.includes(entry) ? list : [...list, entry]));
  return ok ? entry : null;
}

/** Remove one entry from the person's list. A brand entry removed here stays removed. */
export async function untrustSite(entry: string): Promise<void> {
  await writeList((list) => list.filter((e) => e !== entry));
}

export function onTrustedSitesChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Test seam: forget the host, the profile and the brand entries. */
export function resetTrustedSitesForTest(): void {
  host = null;
  profile = null;
  brandDefaults = [];
}
