// SPDX-License-Identifier: MPL-2.0
/**
 * lib/collab-recovery-owner - who a recovery copy on this device belongs to, in one
 * place for the code that writes the copies and the code that must find them again.
 *
 * A live document that loses an edit keeps the interrupted work as a separate copy in a
 * `collab-recovery:<draft id>` Library slot (views/tool-collab-recovery.ts), tagged under
 * `__collabRecovery` with the workspace it came from, the account that made the edit and
 * when. That tag is what keeps one person's copies from the next person on a shared
 * device: the recovery notices list only the signed-in account's copies, Sign out offers
 * to download or discard them (org/account-chip.ts). Both read the tag here, so the key
 * and the account id can never drift apart again. The managed sign-in gate offers no
 * local backup, including copies or profile records whose custody is unknown.
 *
 * The account is the workspace's own id for the person (`OrgUser.sub`, the org
 * principal), which the shell knows whenever a member is signed in, in a room or not.
 * The origin is the workspace address with trailing slashes trimmed. Pure, apart from
 * {@link recoveryOwnerTag} reading the active workspace address.
 */
import { getInstanceBase } from './instance.ts';

/** The Library slot prefix of an interrupted-edit copy; the rest of the slot is the draft id. */
export const RECOVERY_SLOT_PREFIX = 'collab-recovery:';
/** The key under which each copy records who it belongs to. */
export const RECOVERY_OWNER_KEY = '__collabRecovery';

/** Who a recovery copy belongs to, and when it was written (an ISO time). */
export interface RecoveryOwner { origin: string; account: string; at: string }

/** A workspace address in one form: no surrounding space, no trailing slashes. Pure. */
export function recoveryOrigin(origin: string): string {
  return origin.trim().replace(/\/+$/, '');
}

/** The owner a saved copy records, or null when it records none (or a malformed one). Pure. */
export function recoveryOwner(data: unknown): RecoveryOwner | null {
  const value = data && typeof data === 'object' ? (data as Record<string, unknown>)[RECOVERY_OWNER_KEY] : undefined;
  if (!value || typeof value !== 'object') return null;
  const { origin, account, at } = value as Record<string, unknown>;
  return typeof origin === 'string' && typeof account === 'string' && typeof at === 'string' && Number.isFinite(Date.parse(at))
    ? { origin, account, at }
    : null;
}

/** Whether `data` is a copy `account` made on the workspace at `origin`. An empty account
 *  (a private pairing, no workspace member) owns nothing here. Pure. */
export function ownsRecoveryCopy(data: unknown, origin: string, account: string | undefined): boolean {
  const owner = recoveryOwner(data);
  return !!owner && !!account && owner.account === account && recoveryOrigin(owner.origin) === recoveryOrigin(origin);
}

/**
 * Who holds the copy already in a draft's slot, seen from `account` on the workspace at
 * `origin`:
 * - `this-account`: the copy is this account's on this workspace.
 * - `unbound`: written with no account (a private pairing, or a build from before copies
 *   recorded the account) while this account is known.
 * - `earlier-address`: written by this account under another workspace address.
 * - `saved-work`: no owner tag, because the person saved the copy as their own work or it
 *   was written before copies were tagged.
 * - `another-account`: another account's copy, or an owner tag that cannot be read.
 * Pure.
 */
export type RecoveryHolder = 'this-account' | 'unbound' | 'earlier-address' | 'saved-work' | 'another-account';
export function recoveryHolder(data: unknown, origin: string, account: string): RecoveryHolder {
  const owner = recoveryOwner(data);
  if (!owner) return data && typeof data === 'object' && RECOVERY_OWNER_KEY in data ? 'another-account' : 'saved-work';
  if (owner.account !== account) return owner.account === '' && account ? 'unbound' : 'another-account';
  return recoveryOrigin(owner.origin) === recoveryOrigin(origin) ? 'this-account' : 'earlier-address';
}

/** `data` bound to `account` on the workspace at `origin`. It keeps the time the copy was
 *  first written, so the 30-day limit still counts from then. Pure. */
export function rebindRecoveryCopy(data: Record<string, unknown>, origin: string, account: string): Record<string, unknown> {
  const at = recoveryOwner(data)?.at ?? new Date().toISOString();
  return { ...data, [RECOVERY_OWNER_KEY]: { origin: recoveryOrigin(origin), account, at } satisfies RecoveryOwner };
}

/** The tag a copy written now by `account` on the active workspace carries. */
export function recoveryOwnerTag(account: string, at: Date = new Date()): RecoveryOwner {
  const origin = getInstanceBase() || globalThis.location?.origin || '';
  return { origin: recoveryOrigin(origin), account, at: at.toISOString() };
}

/** A copy without its owner tag: what a download carries, so a file that leaves the
 *  device carries no workspace address and no account id. Pure. */
export function withoutRecoveryOwner(data: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(data).filter(([key]) => key !== RECOVERY_OWNER_KEY));
}
