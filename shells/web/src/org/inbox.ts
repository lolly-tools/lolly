// SPDX-License-Identifier: MPL-2.0
/**
 * org/inbox - a member's inbox on a Lolly Work instance, kept current while the app
 * is open (lolly-work plans/75, plan 74 invite spec 5.1).
 *
 * One list for the whole tab. org/banner.ts shows one message from the list at a time
 * and org/inbox-sheet.ts shows all of them; both read the list here and listen for
 * changes, so a message dismissed in one place goes from the other too.
 *
 * Fetching:
 *  - `GET /api/v1/inbox` with the last ETag in `If-None-Match`; a 304 keeps the list.
 *    A browser fetch across origins sends no conditional header (lib/instance.ts
 *    usesBrowserCors): it would force a preflight the instance may not answer.
 *  - The first fetch runs at once when org-config reported unread messages, and
 *    otherwise on the first focus or visibility event.
 *  - Focus, the tab becoming visible and coming back online fetch again, never sooner
 *    than a minute after the last fetch. A visible tab also polls about once a minute
 *    (a random 10 seconds either way, so tabs opened together do not poll together).
 *    A hidden tab does not poll.
 *  - A 401 stops everything: the session has ended. A 403 or a 404 stops too: this
 *    member has no inbox here. No answer or a 5xx backs off, doubling up to 10 minutes.
 *
 * New messages (not seen in this tab before) are announced politely, one per fetch.
 * A "<person> shared <project> with you" message whose project is already open is
 * acked instead of listed (org/opened-projects.ts).
 *
 * Lazy-loaded by org/index.ts for members only, so a plain deployment never loads
 * this file. Nothing here touches the DOM beyond the window and document events it
 * listens to; titles and bodies are data, rendered by the two views through
 * textContent or escape().
 */
import { announce } from '../a11y.ts';
import { t, tRaw } from '../i18n.ts';
import { instanceFetch, instancePath, usesBrowserCors, getInstanceBase } from '../lib/instance.ts';
import { registerNotificationSource, notificationsChanged } from '../lib/notifications.ts';
import { safeHref } from '../utils.ts';
import { openedProjects } from './opened-projects.ts';

export type Severity = 'info' | 'action' | 'blocking';

export interface InboxMessage {
  id: string;
  kind: string;
  severity: Severity;
  title: string;
  body?: string;
  cta?: { label: string; url: string };
  /** Machine-readable payload for a system-generated message, so the shell can act
   *  on it rather than parse the copy: a collab invite's `sessionId`, an access
   *  request's `requestId`, `requestKind` and `role`, and `at`, the time the message
   *  was written. String values only; a routing hint, never a document. */
  data?: Record<string, string>;
  dismissible: boolean;
}

/** How often a visible tab polls, and the most a focus or visibility event may add. */
export const POLL_MS = 60_000;
const JITTER_MS = 10_000;
/** The longest wait between tries while the instance is not answering. */
export const MAX_BACKOFF_MS = 10 * 60_000;

const SEVERITY_RANK: Record<Severity, number> = { info: 1, action: 2, blocking: 3 };

/**
 * The single message to show first: the highest severity (blocking, then action,
 * then info), ties broken by input order. Pure.
 */
export function pickMessage(messages: readonly InboxMessage[]): InboxMessage | null {
  let best: InboxMessage | null = null;
  for (const m of messages) {
    if (!m || !SEVERITY_RANK[m.severity]) continue;
    if (!best || SEVERITY_RANK[m.severity] > SEVERITY_RANK[best.severity]) best = m;
  }
  return best;
}

/** The team project a share message points at, or '' for any other message. Pure. */
export function sharedProjectOf(m: Pick<InboxMessage, 'data'> | null | undefined): string {
  const d = m?.data;
  return d && d.kind === 'project-share' && typeof d.projectId === 'string' ? d.projectId : '';
}

/** Split messages into those still to show and share messages whose project is
 *  already open (done, to be acked). Pure. */
export function splitOpenedShares(messages: readonly InboxMessage[], opened: ReadonlySet<string>): { keep: InboxMessage[]; done: InboxMessage[] } {
  const keep: InboxMessage[] = [];
  const done: InboxMessage[] = [];
  for (const m of messages) (opened.has(sharedProjectOf(m)) ? done : keep).push(m);
  return { keep, done };
}

const text = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v : undefined);

/** One message from the instance's answer, or null when it cannot be shown (no id,
 *  no title, a severity this shell does not know). Pure. */
export function messageFromRow(row: unknown): InboxMessage | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const id = text(r.id);
  const title = text(r.title);
  const severity = typeof r.severity === 'string' && Object.hasOwn(SEVERITY_RANK, r.severity) ? r.severity as Severity : null;
  if (!id || !title || !severity) return null;
  const body = text(r.body);
  const cta = r.cta && typeof r.cta === 'object' ? r.cta as Record<string, unknown> : null;
  const label = text(cta?.label);
  const url = text(cta?.url);
  let data: Record<string, string> | undefined;
  if (r.data && typeof r.data === 'object' && !Array.isArray(r.data)) {
    data = {};
    for (const [k, v] of Object.entries(r.data as Record<string, unknown>)) if (typeof v === 'string') data[k] = v;
  }
  return {
    id, kind: typeof r.kind === 'string' ? r.kind : '', severity, title,
    ...(body ? { body } : {}),
    ...(label && url ? { cta: { label, url } } : {}),
    ...(data ? { data } : {}),
    dismissible: r.dismissible === true,
  };
}

/** The messages in an inbox answer, or null when the answer is not one. Pure. */
export function messagesFromBody(body: unknown): InboxMessage[] | null {
  const list = (body as { messages?: unknown } | null)?.messages;
  if (!Array.isArray(list)) return null;
  return list.map(messageFromRow).filter((m): m is InboxMessage => !!m);
}

/** The wait before the next poll: a minute give or take 10 seconds, or after
 *  `failures` failed fetches in a row, a minute doubled once per failure, at most 10
 *  minutes. `random` is in [0, 1), passed in for tests. Pure. */
export function nextPollDelay(failures: number, random: number): number {
  if (failures > 0) return Math.min(POLL_MS * 2 ** failures, MAX_BACKOFF_MS);
  return POLL_MS + Math.round((random * 2 - 1) * JITTER_MS);
}

// ── State ────────────────────────────────────────────────────────────────────

let messages: InboxMessage[] = [];
let etag = '';
/** A fetch has answered with a list at least once. */
let loaded = false;
let started = false;
/** The instance said this member has no inbox (401, 403, 404): no more fetching. */
let stopped = false;
let lastFetchAt = 0;
let failures = 0;
let inflight: Promise<boolean> | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
let detach: (() => void) | null = null;
let detachNotifications: (() => void) | null = null;
/** Every message this tab has listed, so a message is announced once. */
const seen = new Set<string>();
/** Messages dismissed here. A fetch that was already on its way may still carry one,
 *  and the instance's own retirement of an answered request can lag. */
const dropped = new Set<string>();
const listeners = new Set<(msgs: readonly InboxMessage[]) => void>();

/** The messages to show now, in the instance's order. */
export function inboxMessages(): readonly InboxMessage[] {
  return messages;
}

/** True once a fetch has answered with a list (the list may be empty). */
export function inboxLoaded(): boolean {
  return loaded;
}

/** Hear every change to the list. Returns the way to stop listening. */
export function onInboxChange(fn: (msgs: readonly InboxMessage[]) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function notify(): void {
  notificationsChanged();
  for (const fn of [...listeners]) {
    try { fn(messages); } catch { /* one broken view must not stop the others */ }
  }
}

/** Fire-and-forget ack. A failed ack never brings the message back on screen. */
function ack(id: string): void {
  void instanceFetch(instancePath(`/api/v1/inbox/${encodeURIComponent(id)}/ack`), { method: 'POST' })
    .catch(() => { /* best-effort: the message is already gone from the list */ });
}

/** Ack a message and drop the message from the list here. */
export function dismissMessage(id: string): void {
  if (!id || dropped.has(id)) return;
  dropped.add(id);
  ack(id);
  const next = messages.filter((m) => m.id !== id);
  if (next.length === messages.length) return;
  messages = next;
  notify();
}

/** Take a fetched list in: drop what was dismissed here, ack shares for open projects,
 *  announce what is new and tell the views when anything changed. */
function apply(list: InboxMessage[]): void {
  const { keep, done } = splitOpenedShares(list.filter((m) => !dropped.has(m.id)), openedProjects());
  for (const m of done) { dropped.add(m.id); ack(m.id); }
  const fresh = keep.filter((m) => !seen.has(m.id));
  for (const m of keep) seen.add(m.id);
  const changed = JSON.stringify(keep) !== JSON.stringify(messages);
  messages = keep;
  const first = pickMessage(fresh);
  if (first) announce(tRaw('New message: {title}', { title: first.title }));
  if (changed) notify();
}

function stop(): void {
  stopped = true;
  clearTimer();
  messages = []; notify();
}

/** One fetch. True when the list is current afterwards (a 200 or a 304). */
async function fetchInbox(): Promise<boolean> {
  lastFetchAt = Date.now();
  const url = instancePath('/api/v1/inbox');
  const conditional = etag && !usesBrowserCors(url);
  let res: Response | null;
  try {
    res = await instanceFetch(url, conditional ? { headers: { 'if-none-match': etag } } : undefined);
  } catch {
    res = null;
  }
  if (res?.status === 304 && loaded) { failures = 0; return true; }
  if (res && (res.status === 401 || res.status === 403 || res.status === 404)) { stop(); return false; }
  if (!res?.ok) { failures++; return false; }
  let list: InboxMessage[] | null = null;
  try { list = messagesFromBody(await res.json()); } catch { list = null; }
  if (!list) { failures++; return false; }
  failures = 0;
  // A list after a refusal (a [Try again] once the person signed in again elsewhere)
  // means the inbox is back.
  stopped = false;
  etag = res.headers.get('etag') ?? '';
  loaded = true;
  apply(list);
  return true;
}

/**
 * Fetch the inbox now. Without `force`, a fetch less than a minute after the last
 * one is skipped (the list stays as it is). A fetch already on its way is shared.
 * Resolves true when the list is current: this fetch answered, or the skipped one
 * would have found the list already loaded.
 */
export function refreshInbox(opts: { force?: boolean } = {}): Promise<boolean> {
  if (inflight) return inflight;
  if (!opts.force && (stopped || Date.now() - lastFetchAt < POLL_MS)) return Promise.resolve(loaded && !stopped);
  inflight = fetchInbox().finally(() => {
    inflight = null;
    schedule();
  });
  return inflight;
}

function visible(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible';
}

function clearTimer(): void {
  if (timer !== null) clearTimeout(timer);
  timer = null;
}

/** Set the next poll, counted from now. Only a started, visible, signed-in tab polls. */
function schedule(): void {
  clearTimer();
  if (!started || stopped || !visible()) return;
  timer = setTimeout(() => {
    timer = null;
    void refreshInbox({ force: true });
  }, nextPollDelay(failures, Math.random()));
  // A browser's handle is a number. Under Node (the unit tests drive org/index.ts with
  // a visible document) a pending poll would hold the process open after the last
  // test, so the poll does not keep Node running on its own.
  if (typeof timer === 'object' && timer && 'unref' in timer && typeof timer.unref === 'function') timer.unref();
}

/**
 * Start keeping the inbox current, and show it: the banner loads beside this module
 * and draws from the list. Members only (org/index.ts decides). Calling again does
 * nothing.
 */
export function startInbox(opts: { initialUnread: number; principal?: string; review?(): void }): void {
  if (started || typeof window === 'undefined' || typeof document === 'undefined') return;
  started = true;
  const scope = `${getInstanceBase()}:${opts.principal ?? ''}`;
  detachNotifications = registerNotificationSource('workspace', () => messages.map(m => ({
    id: `workspace:${scope}:${m.id}`, title: m.title, body: m.body,
    tone: m.severity === 'blocking' ? 'warning' as const : m.severity === 'action' ? 'action' as const : 'info' as const,
    dismissible: m.dismissible, onDismiss: () => { if (messages.find(row => row.id === m.id)?.dismissible) dismissMessage(m.id); },
    ...(m.data?.kind === 'access-request' || m.kind === 'collab' || m.data?.kind === 'collab-invite' || m.data?.kind === 'comment-mention' || m.data?.kind === 'comment-reply'
      ? { action: { label: t('Review'), run: () => { if (messages.some(row => row.id === m.id)) opts.review?.(); } } }
      : m.cta && safeHref(m.cta.url) ? { action: { label: m.cta.label, href: m.cta.url } } : {}),
  })));
  // A wake-up is the moment a person looks again: fetch when the last fetch is a
  // minute old, else make sure a poll is due. A poll already due keeps its time, so
  // switching back and forth between windows never pushes the poll back.
  const wake = (): void => {
    if (!visible()) return;
    if (!inflight && Date.now() - lastFetchAt >= POLL_MS) void refreshInbox();
    else if (timer === null && !inflight) schedule();
  };
  const onVisibility = (): void => {
    if (visible()) wake();
    else clearTimer();
  };
  window.addEventListener('focus', wake);
  window.addEventListener('online', wake);
  document.addEventListener('visibilitychange', onVisibility);
  detach = () => {
    window.removeEventListener('focus', wake);
    window.removeEventListener('online', wake);
    document.removeEventListener('visibilitychange', onVisibility);
  };
  if (opts.initialUnread > 0) void refreshInbox({ force: true });
  else schedule();
}

/** TEST-ONLY: forget everything and stop listening. */
export function _resetInboxForTests(): void {
  detachNotifications?.(); detachNotifications = null;
  detach?.();
  detach = null;
  clearTimer();
  messages = [];
  etag = '';
  loaded = false;
  started = false;
  stopped = false;
  lastFetchAt = 0;
  failures = 0;
  inflight = null;
  seen.clear();
  dropped.clear();
  listeners.clear();
}
