// SPDX-License-Identifier: MPL-2.0
/**
 * share-links - making, remembering and switching off the links people create
 * after a Send.
 *
 * The provider drivers own the requests (a target's `share` and `revoke`). This
 * module owns what sits around them and is the same for every provider:
 *
 *   - Checking the request against what the target says it can do, before any
 *     request leaves the device.
 *   - Turning a refused audience into a plain result the UI can act on. It never
 *     retries a wider or narrower audience by itself: the person is told, then
 *     chooses.
 *   - The device-local "Links you've shared" list (profile store, one key). A
 *     record holds the link and the grant to remove, never a token, so it is safe
 *     to keep at rest and to sync later.
 *   - Remembering that sharing is unavailable for one connection (OneDrive, when
 *     the app-folder token is refused), so the UI stops offering what cannot work.
 */

import { openDB } from '../bridge/db.ts';
import { t } from '../i18n.ts';
import {
  SHARE_AUDIENCES, canShare, findSendTarget,
  ShareRefusedError, ShareUnavailableError,
  type ShareAudience, type ShareCapabilities, type ShareLinkOutcome, type ShareOptions,
  type SendTarget, type SharedLinkRecord,
} from './send-target.ts';

const LINKS_KEY = 'shared-links';
const UNAVAILABLE_KEY = 'share-unavailable';

/** Most links the list keeps; the oldest drop off, still live at the provider. */
export const SHARED_LINKS_MAX = 200;

// ── Pure helpers ──────────────────────────────────────────────────────────────

/** The audiences narrower than `from` that `caps` supports, widest first. */
export function narrowerAudiences(caps: ShareCapabilities, from: ShareAudience): ShareAudience[] {
  const at = SHARE_AUDIENCES.indexOf(from);
  return SHARE_AUDIENCES.filter((a, i) => i > at && caps.audiences.includes(a));
}

/** Already-localised name of an audience, for choosers and notices. */
export function audienceLabel(a: ShareAudience): string {
  return a === 'anyone' ? t('Anyone with the link')
    : a === 'organisation' ? t('People in my organisation')
    : t('Only the people I name');
}

/** Already-localised sentence naming who can open a link. */
export function audienceSentence(a: ShareAudience): string {
  return a === 'anyone' ? t('Anyone who has this link can open it, with no sign-in.')
    : a === 'organisation' ? t('Only people signed in to your organisation can open the link.')
    : t('Only the people you named can open the link.');
}

/** Why a request cannot go out, as a message; null when it is fine. */
export function checkShareOptions(caps: ShareCapabilities, o: ShareOptions): string | null {
  if (!caps.audiences.includes(o.audience)) return t('This provider cannot make that kind of link.');
  if (o.audience === 'people' && !o.people?.length) return t('Add at least one email address.');
  if (o.password && !caps.password) return t('This provider cannot put a password on a link.');
  if (o.expiresInDays !== undefined) {
    if (!caps.expiry) return t('This provider cannot set an expiry date on a link.');
    if (!(o.expiresInDays >= 1)) return t('Choose an expiry of at least one day.');
    if (caps.maxExpiryDays !== undefined && o.expiresInDays > caps.maxExpiryDays) {
      return t('This provider allows at most {n} days.', { n: caps.maxExpiryDays });
    }
  } else if (caps.expiryRequired) {
    return t('Choose when this link should stop working.');
  }
  return null;
}

/** ISO time `days` from `now`. */
export function expiryFromDays(days: number, now = Date.now()): string {
  return new Date(now + days * 86_400_000).toISOString();
}

// ── Device-local store ────────────────────────────────────────────────────────

let linksMemory: SharedLinkRecord[] | null = null;
const unavailable = new Set<string>();
let unavailableLoaded = false;

async function readKey<T>(key: string): Promise<T | undefined> {
  try { return (await (await openDB()).get('profile', key)) as T | undefined; } catch { return undefined; }
}
async function writeKey(key: string, value: unknown): Promise<void> {
  try { await (await openDB()).put('profile', value, key); } catch { /* no IDB - memory holds it */ }
}

/** The kept links, newest first. */
export async function listSharedLinks(): Promise<SharedLinkRecord[]> {
  if (!linksMemory) linksMemory = (await readKey<SharedLinkRecord[]>(LINKS_KEY)) ?? [];
  return [...linksMemory].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

async function saveLinks(list: SharedLinkRecord[]): Promise<void> {
  linksMemory = list.slice(0, SHARED_LINKS_MAX);
  await writeKey(LINKS_KEY, linksMemory);
}

/** Keep a link in the list. */
export async function rememberSharedLink(rec: SharedLinkRecord): Promise<void> {
  const list = await listSharedLinks();
  await saveLinks([rec, ...list.filter((r) => r.id !== rec.id)]);
}

/** Drop a record without contacting the provider (a link that cannot be revoked,
 *  or one the person already removed there). */
export async function forgetSharedLink(id: string): Promise<void> {
  await saveLinks((await listSharedLinks()).filter((r) => r.id !== id));
}

/** Load which connections cannot share. Call once before reading `shareUnavailable`. */
export async function primeShareState(): Promise<void> {
  if (unavailableLoaded) return;
  unavailableLoaded = true;
  for (const k of (await readKey<string[]>(UNAVAILABLE_KEY)) ?? []) unavailable.add(k);
}

/** Has this connection been found unable to share? Synchronous, after primeShareState. */
export function shareUnavailable(kind: string): boolean { return unavailable.has(kind); }

export async function markShareUnavailable(kind: string): Promise<void> {
  unavailable.add(kind);
  await writeKey(UNAVAILABLE_KEY, [...unavailable]);
}

/** Forget the finding (a reconnect may carry different rights). */
export async function clearShareUnavailable(kind: string): Promise<void> {
  if (unavailable.delete(kind)) await writeKey(UNAVAILABLE_KEY, [...unavailable]);
}

/** TEST-ONLY: empty memory. */
export function resetSharedLinksForTests(): void {
  linksMemory = null;
  unavailable.clear();
  unavailableLoaded = false;
}

// ── Making and stopping ───────────────────────────────────────────────────────

export type ShareResult =
  | { ok: true; link: ShareLinkOutcome; record: SharedLinkRecord }
  | { ok: false; kind: 'refused'; audience: ShareAudience; message: string; narrower: ShareAudience[] }
  | { ok: false; kind: 'unavailable'; message: string; handoffUrl?: string };

/**
 * Ask a target for a link. Refusals come back as data: the caller shows the
 * message and the audiences that are still narrower, and the person picks. Any
 * other failure rejects with a presentable message.
 */
export async function createShareLink(
  target: SendTarget, ref: string, fileName: string, options: ShareOptions,
): Promise<ShareResult> {
  if (!canShare(target)) throw new Error(t('Share links are off for this provider.'));
  const caps = target.shareCapabilities!();
  const problem = checkShareOptions(caps, options);
  if (problem) throw new Error(problem);
  try {
    const link = await target.share!(ref, { ...options, name: fileName });
    const record: SharedLinkRecord = {
      id: crypto.randomUUID(),
      kind: target.kind,
      targetId: target.id ?? target.kind,
      providerLabel: target.label,
      fileName,
      ref,
      url: link.url,
      audience: link.audience,
      ...(link.expiresAt ? { expiresAt: link.expiresAt } : {}),
      ...(link.revokeRef ? { revokeRef: link.revokeRef } : {}),
      createdAt: new Date().toISOString(),
    };
    await rememberSharedLink(record);
    return { ok: true, link, record };
  } catch (e) {
    if (e instanceof ShareRefusedError) {
      return { ok: false, kind: 'refused', audience: e.audience, message: e.message, narrower: narrowerAudiences(caps, e.audience) };
    }
    if (e instanceof ShareUnavailableError) {
      return { ok: false, kind: 'unavailable', message: e.message, ...(e.handoffUrl ? { handoffUrl: e.handoffUrl } : {}) };
    }
    throw e;
  }
}

/** Is this record's link still worth showing (not past its expiry)? */
export function isExpired(rec: Pick<SharedLinkRecord, 'expiresAt'>, now = Date.now()): boolean {
  return !!rec.expiresAt && Date.parse(rec.expiresAt) <= now;
}

/** Can this record be switched off from here? */
export function canStopSharing(rec: SharedLinkRecord): boolean {
  const target = findSendTarget(rec.targetId);
  return !!target?.revoke && !!rec.revokeRef;
}

/** Switch a link off at the provider, then drop it from the list. A provider that
 *  says the grant is already gone counts as done. Rejects with a presentable
 *  message when the provider cannot be reached or refuses. */
export async function stopSharing(rec: SharedLinkRecord): Promise<void> {
  const target = findSendTarget(rec.targetId);
  if (!target?.revoke || !rec.revokeRef) throw new Error(t('This link cannot be switched off from here.'));
  await target.revoke({ ref: rec.ref, revokeRef: rec.revokeRef, url: rec.url });
  await forgetSharedLink(rec.id);
}
