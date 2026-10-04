// SPDX-License-Identifier: MPL-2.0
/**
 * org/identities - the signed-in person's linked sign-ins on the instance: which
 * providers they can sign in with, removing one, and the address that links another.
 *
 * Pure data, no DOM, like org/session-source.ts. Every call resolves, never throws.
 * Server contract (lolly-work plan 74):
 *   GET    /api/v1/me/identities                      -> { identities: [...] }
 *   DELETE /api/v1/me/identities/:idp/:subjectHash    -> 204 (never the last one)
 * Each identity row carries `subjectHash` (the key the remove route takes) and, when it
 * cannot be removed, `unlinkBlocked`: 'account' for the sign-in the account was
 * created with, 'last' for the only one left. A refused remove answers 409 with
 * `{ error: { code: 'ACCOUNT_SIGN_IN' | 'LAST_SIGN_IN' } }`.
 *   GET    /api/auth/config                           -> { providers: [{ id, name, kind, loginPath }] }
 *   GET    /api/auth/link?idp=<id>&returnTo=<path>    (a page navigation, not a fetch)
 */
import { instanceFetch, instancePath } from '../lib/instance.ts';
import { safeHref } from '../utils.ts';

export interface LinkedIdentity {
  idp: string;
  /** The provider's name for a person to read ("Google", "GitHub"). */
  displayName: string;
  email?: string;
  linkedAt?: string;
  lastLoginAt?: string;
  /** The instance's own word on whether this one may be removed (never the last). */
  canUnlink: boolean;
  /** The key the remove route takes. Absent: this sign-in cannot be removed from here. */
  subjectHash?: string;
  /** Why the instance keeps this one: the sign-in the account was created with, or the last. */
  unlinkBlocked?: 'account' | 'last';
}

export interface SignInProvider {
  id: string;
  name: string;
  /** 'oidc', 'github' or 'password', when the instance says. */
  kind?: string;
}

/** A failure keeps the HTTP status (0: no answer) and the instance's error code, if any. */
export type IdentitiesGot<T> = { ok: true; data: T } | { ok: false; status: number; code?: string };

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

/** One identity row, or null when the row gives no provider. Pure. */
export function identityFromRow(row: unknown): LinkedIdentity | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const idp = str(r.idp);
  if (!idp) return null;
  const email = str(r.email);
  const linkedAt = str(r.linkedAt);
  const lastLoginAt = str(r.lastLoginAt);
  const subjectHash = str(r.subjectHash);
  const blocked = r.unlinkBlocked === 'account' || r.unlinkBlocked === 'last' ? r.unlinkBlocked : undefined;
  return {
    idp,
    displayName: str(r.displayName) ?? idp,
    canUnlink: r.canUnlink === true && !!subjectHash,
    ...(email ? { email } : {}),
    ...(linkedAt ? { linkedAt } : {}),
    ...(lastLoginAt ? { lastLoginAt } : {}),
    ...(subjectHash ? { subjectHash } : {}),
    ...(blocked ? { unlinkBlocked: blocked } : {}),
  };
}

/** The sign-in providers an auth config lists, or [] for none. Pure. */
export function providersFromConfig(body: unknown): SignInProvider[] {
  const raw = (body as { providers?: unknown } | null)?.providers;
  if (!Array.isArray(raw)) return [];
  const out: SignInProvider[] = [];
  for (const p of raw) {
    if (!p || typeof p !== 'object') continue;
    const id = str((p as Record<string, unknown>).id);
    if (!id || out.some((x) => x.id === id)) continue;
    const kind = str((p as Record<string, unknown>).kind);
    out.push({ id, name: str((p as Record<string, unknown>).name) ?? id, ...(kind ? { kind } : {}) });
  }
  return out;
}

/** The providers a signed-in person can link to their account. Not email and password:
 *  that sign-in comes from a link an admin sends, so there is nothing to link from
 *  here, and the instance refuses the attempt. Pure. */
export function linkableProviders(providers: readonly SignInProvider[]): SignInProvider[] {
  return providers.filter((p) => p.kind !== 'password');
}

/** The address that links another sign-in to this account and comes back to
 *  `returnTo` (a path in this app), or null when it would not be a safe link. Pure. */
export function linkSignInHref(idp: string, returnTo: string): string | null {
  const back = returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : '/';
  const href = instancePath(`/api/auth/link?idp=${encodeURIComponent(idp)}&returnTo=${encodeURIComponent(back)}`);
  return safeHref(href) ? href : null;
}

async function getJson(path: string): Promise<{ status: number; body: unknown }> {
  try {
    const res = await instanceFetch(instancePath(path), { cache: 'no-store' });
    if (!res.ok) return { status: res.status, body: null };
    try { return { status: res.status, body: await res.json() }; } catch { return { status: 0, body: null }; }
  } catch {
    return { status: 0, body: null };
  }
}

/** The sign-ins linked to the signed-in person. */
export async function listIdentities(): Promise<IdentitiesGot<LinkedIdentity[]>> {
  const got = await getJson('/api/v1/me/identities');
  const raw = (got.body as { identities?: unknown } | null)?.identities;
  if (!Array.isArray(raw)) return { ok: false, status: got.status === 200 ? 0 : got.status };
  return { ok: true, data: raw.map(identityFromRow).filter((x): x is LinkedIdentity => !!x) };
}

/** The providers this instance signs people in with ([] when it says none, or no answer). */
export async function listSignInProviders(): Promise<SignInProvider[]> {
  return providersFromConfig((await getJson('/api/auth/config')).body);
}

/** Remove one linked sign-in. The instance refuses the last one. */
export async function unlinkIdentity(identity: Pick<LinkedIdentity, 'idp' | 'subjectHash'>): Promise<IdentitiesGot<null>> {
  if (!identity.subjectHash) return { ok: false, status: 400 };
  let res: Response;
  try {
    res = await instanceFetch(instancePath(`/api/v1/me/identities/${encodeURIComponent(identity.idp)}/${encodeURIComponent(identity.subjectHash)}`), { method: 'DELETE' });
  } catch {
    return { ok: false, status: 0 };
  }
  if (res.ok) return { ok: true, data: null };
  let code: string | undefined;
  try { code = str(((await res.json()) as { error?: { code?: unknown } } | null)?.error?.code); } catch { /* no body */ }
  return { ok: false, status: res.status, ...(code ? { code } : {}) };
}
