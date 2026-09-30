// SPDX-License-Identifier: MPL-2.0
/**
 * site-policy - an organisation's rules for which sites Lolly may contact (plan 288,
 * lolly-work plan 58). A neutral seam in the lib/input-policy.ts shape: it knows nothing
 * about where a policy comes from. A deployment's optional org-config module sets it; the
 * standalone app and lolly.tools never do, so it stays empty and every question about a
 * site belongs to the person (the `open` behaviour).
 *
 * Modes (lolly-work plan 58 section 3.2):
 *   open            the organisation adds a block list and nothing else
 *   ask             the organisation's allowed sites are trusted and locked; the person
 *                   may still trust others, one at a time
 *   allowlist-only  only the organisation's allowed sites; the person's own list is
 *                   ignored and nothing asks
 *   none            no site at all. Lolly tool frames and Sandbox demos still run,
 *                   because they are this app's own origin.
 * A block always wins, over every allow.
 *
 * Fail closed: a governed instance whose policy cannot be read installs
 * `failClosedSitePolicy()`, so a gap in policy never opens egress. A malformed policy
 * becomes that too.
 *
 * `by` and each rule's `reason` arrive already localised from whoever set the policy,
 * so this file needs no i18n.
 */
import { normaliseTrustedSite } from '../../../../engine/src/trusted-sites.ts';

export type SiteMode = 'open' | 'ask' | 'allowlist-only' | 'none';

export interface SiteRule {
  entry: string;
  reason?: string;
}

export interface SitePolicy {
  mode: SiteMode;
  allow: readonly SiteRule[];
  block: readonly SiteRule[];
  /** Who set the policy, as data (an organisation's name). */
  by?: string;
  /** Why every site is refused, for the fail-closed stand-in ("Can't reach your
   *  organisation's settings"). Rules carry their own reasons. */
  reason?: string;
  /** `locked`: the person's own list stays in force but cannot be edited. */
  memberEntries?: 'allowed' | 'locked';
  /** `ignore`: the brand's shipped entries do not apply on this instance. */
  brandDefaults?: 'include' | 'ignore';
  /** True when the policy is the fail-closed stand-in, not one an organisation wrote. */
  failClosed?: boolean;
}

const MODES: ReadonlySet<string> = new Set(['open', 'ask', 'allowlist-only', 'none']);

let current: SitePolicy | null = null;
const listeners = new Set<() => void>();

function rulesOf(list: unknown): SiteRule[] {
  if (!Array.isArray(list)) return [];
  const out: SiteRule[] = [];
  for (const item of list) {
    const raw = typeof item === 'string' ? { entry: item } : item as { entry?: unknown; reason?: unknown } | null;
    const entry = normaliseTrustedSite(raw?.entry);
    if (!entry) continue;
    out.push(typeof raw?.reason === 'string' && raw.reason.trim() ? { entry, reason: raw.reason.trim().slice(0, 300) } : { entry });
  }
  return out;
}

/** The stand-in a governed instance installs while its real policy is unknown. */
export function failClosedSitePolicy(by?: string, reason?: string): SitePolicy {
  return { mode: 'none', allow: [], block: [], ...(by ? { by } : {}), ...(reason ? { reason } : {}), failClosed: true };
}

/**
 * Install an organisation's policy, or `null` to lift the policy. Anything that is not a
 * readable policy becomes the fail-closed stand-in rather than no policy at all.
 */
export function setSitePolicy(policy: unknown): void {
  if (policy === null) {
    current = null;
  } else {
    const p = policy as {
      mode?: unknown; allow?: unknown; block?: unknown; by?: unknown; reason?: unknown;
      memberEntries?: unknown; brandDefaults?: unknown; failClosed?: unknown;
    } | undefined;
    const text = (v: unknown, max: number): string | undefined => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined);
    const by = text(p?.by, 120);
    const reason = text(p?.reason, 300);
    current = p && typeof p === 'object' && typeof p.mode === 'string' && MODES.has(p.mode)
      ? {
        mode: p.mode as SiteMode, allow: rulesOf(p.allow), block: rulesOf(p.block),
        ...(by ? { by } : {}), ...(reason ? { reason } : {}),
        ...(p.memberEntries === 'locked' ? { memberEntries: 'locked' as const } : {}),
        ...(p.brandDefaults === 'ignore' ? { brandDefaults: 'ignore' as const } : {}),
        ...(p.failClosed === true ? { failClosed: true } : {}),
      }
      : failClosedSitePolicy(by, reason);
  }
  for (const cb of listeners) cb();
}

/** The installed policy, or null on an ungoverned install. */
export function sitePolicy(): SitePolicy | null {
  return current;
}

export function onSitePolicyChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
