// SPDX-License-Identifier: MPL-2.0
/**
 * org/canvas-comments - the Work host's comments capability (lib/canvas-comments.ts).
 *
 * Every call is bound to the instance, the account and the session it was created for,
 * and refuses with 403 once the instance or the account changes. A rate limit (429)
 * starts a local cooldown for that kind of call, so a poll or a retry cannot become a
 * storm of requests. The optional review features (plan 76 milestone 4) follow the
 * newest list: a feature the server did not report is off, and its member makes no
 * request.
 */
import { COMMENT_BODY_LIMIT, COMMENT_THREAD_LIMIT, commentId, readCommentThread, type CommentAnchor, type CommentThread } from '@lolly-tools/core/canvas-review-v1';
import { interactionKey } from '@lolly-tools/core/canvas-interaction-v1';
import type { CanvasCommentsCapability, CommentListResult, CommentPerson } from '../lib/canvas-comments.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import { onReviewTarget, takeReviewTarget } from '../lib/review-target.ts';

export class CommentAccessError extends Error {
  readonly status: number;
  /** Seconds before this kind of call is tried again; set for 429 only. */
  readonly retryAfter?: number;
  constructor(status: number, retryAfter?: number) {
    super(status === 409 ? 'The thread changed. Your reply is kept. Refresh and send again.'
      : status === 429 ? 'You are commenting too quickly. Try again in a moment.'
      : status === 401 || status === 403 || status === 410 ? 'Comment access ended. Your unsent reply is kept on this device.' : 'Comments could not be loaded. Try again.');
    this.status = status;
    if (status === 429 && retryAfter !== undefined) this.retryAfter = retryAfter;
  }
}

/** Mentions per message the server accepts (core `COMMENT_MENTION_LIMIT`). */
const MENTION_LIMIT = 10;
/** People one suggestion answer may hold, and the longest query (lolly-work `comment-people`). */
const PEOPLE_LIMIT = 20, QUERY_LIMIT = 64;
/** Threads one `comment-reads` request may name. */
const READ_BATCH = 100;
/** Cooldown when a 429 gives no usable wait, and the longest one honoured, in seconds. */
const DEFAULT_WAIT = 10, MAX_WAIT = 300;

export interface WorkCommentsOptions {
  /** Saved comment writes in the live room (org/collab-provider.ts `reviewEvents`). */
  changes?: CanvasCommentsCapability['changes'];
}

const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const time = (value: unknown): value is string => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value));
/** A display name the panel may show. A name shaped like an email address is refused: names never carry one. */
const personName = (value: unknown): value is string => typeof value === 'string' && value.length >= 1 && value.length <= 256 && !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(value);

/** Mention ids as the server takes them: valid, distinct and at most ten. Undefined stays undefined. */
export function mentionIds(ids: readonly unknown[] | undefined): string[] | undefined {
  return Array.isArray(ids) ? [...new Set(ids.filter(interactionKey))].slice(0, MENTION_LIMIT) : undefined;
}

/** `Retry-After` in seconds (a number or an HTTP date), clamped to 1..300. */
export function retryAfterSeconds(header: string | null, now = Date.now()): number {
  const value = header?.trim() ?? '';
  const seconds = /^\d+$/.test(value) ? Number(value) : Number.isFinite(Date.parse(value)) ? Math.ceil((Date.parse(value) - now) / 1000) : DEFAULT_WAIT;
  return Math.min(MAX_WAIT, Math.max(1, seconds));
}

/** The optional list fields, read leniently: anything malformed is left out, which means the feature is off. */
function listExtras(value: Record<string, unknown>): Omit<CommentListResult, 'enabled' | 'permissions' | 'threads'> {
  const out: Omit<CommentListResult, 'enabled' | 'permissions' | 'threads'> = {};
  if (object(value.reads)) {
    // No prototype, so a thread id such as `toString` never reads an inherited member.
    const reads: Record<string, string> = Object.create(null);
    for (const [id, at] of Object.entries(value.reads).slice(0, COMMENT_THREAD_LIMIT * 2)) if (commentId(id) && time(at)) reads[id] = at;
    out.reads = reads;
  }
  if (time(value.readFloor)) out.readFloor = value.readFloor;
  if (Array.isArray(value.notices)) out.notices = [...new Set(value.notices.filter(commentId))].slice(0, COMMENT_THREAD_LIMIT);
  if (object(value.features)) {
    const f = value.features;
    out.features = { mentions: f.mentions === true, reads: f.reads === true, events: f.events === true, thread: f.thread === true };
  }
  return out;
}

type Kind = 'list' | 'thread' | 'write' | 'reads' | 'people';

export function createWorkComments(sessionId: string, principal: () => string | undefined, options: WorkCommentsOptions = {}): CanvasCommentsCapability {
  const base = getInstanceBase(), person = principal(), scope = `${base}\n${person ?? ''}\n${sessionId}`;
  const root = `/api/v1/sessions/${encodeURIComponent(sessionId)}`;
  // org/team-save.ts `teamLinkUrl`, built here so a comments panel does not load the Share
  // dialog's module and everything it imports. A test pins the two to the same address.
  const sessionLink = () => `${(base || globalThis.location?.origin || '').replace(/\/+$/, '')}/#/team/${encodeURIComponent(sessionId)}`;
  const source = options.changes;
  const cooldown = new Map<Kind, number>();
  let cached: { etag: string; value: CommentListResult } | undefined;
  let features: NonNullable<CommentListResult['features']> = {};
  let mentionsOff = false;
  const valid = (): boolean => !!person && principal() === person && getInstanceBase() === base;
  function check(): void { if (!valid()) throw new CommentAccessError(403); }
  async function send(kind: Kind, tail: string, init: { body?: object; etag?: string } = {}): Promise<Response> {
    check();
    const wait = (cooldown.get(kind) ?? 0) - Date.now();
    if (wait > 0) throw new CommentAccessError(429, Math.ceil(wait / 1000));
    const response = await instanceFetch(instancePath(root + tail), {
      headers: { 'content-type': 'application/json', ...(init.etag ? { 'if-none-match': init.etag } : {}) },
      ...(init.body ? { method: 'POST', body: JSON.stringify(init.body) } : {}) });
    check();
    if (response.status === 429) {
      const seconds = retryAfterSeconds(response.headers.get('retry-after'));
      cooldown.set(kind, Date.now() + seconds * 1000);
      throw new CommentAccessError(429, seconds);
    }
    return response;
  }
  async function read(response: Response): Promise<Record<string, unknown>> {
    if (!response.ok) throw new CommentAccessError(response.status);
    const value: unknown = await response.json(); if (!object(value)) throw new CommentAccessError(422); return value;
  }
  const thread = (value: unknown) => { const result = readCommentThread(value); if (!result || result.sessionId !== sessionId) throw new CommentAccessError(422); return result; };
  const saved = (value: Record<string, unknown>): CommentThread & { notified?: boolean } => {
    const result = thread(value.thread);
    return typeof value.notified === 'boolean' ? Object.assign(result, { notified: value.notified }) : result;
  };
  /** A copy for the caller, with the features this device can actually use. */
  function present(value: CommentListResult): CommentListResult {
    const out: CommentListResult = { ...value, threads: [...value.threads] };
    if (value.features) out.features = { ...value.features, mentions: value.features.mentions === true && !mentionsOff, events: value.features.events === true && !!source };
    return out;
  }
  async function draftKey(key: string): Promise<string> {
    check();
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}\n${key}`));
    return `comment-draft:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return {
    async list() {
      const response = await send('list', '/comments', cached ? { etag: cached.etag } : {});
      if (response.status === 304 && cached) return present(cached.value);
      const value = await read(response);
      if (typeof value.enabled !== 'boolean' || !object(value.permissions) || !Array.isArray(value.threads) || value.threads.length > COMMENT_THREAD_LIMIT) throw new CommentAccessError(422);
      const p = value.permissions;
      if (typeof p.userId !== 'string' || ['create', 'editOwn', 'resolveAny', 'deleteAny'].some(key => typeof p[key] !== 'boolean')) throw new CommentAccessError(422);
      const result: CommentListResult = { enabled: value.enabled, permissions: { userId: p.userId, create: p.create === true, editOwn: p.editOwn === true, resolveAny: p.resolveAny === true, deleteAny: p.deleteAny === true },
        threads: value.threads.map(thread), ...listExtras(value) };
      const etag = response.headers.get('etag');
      cached = etag && etag.length <= 256 ? { etag, value: result } : undefined;
      features = result.features ?? {};
      return present(result);
    },
    async get(threadId) {
      check();
      if (!commentId(threadId)) return null;
      // A server without the single-thread route says nothing; the caller lists instead.
      if (features.thread !== true) throw new CommentAccessError(404);
      const response = await send('thread', `/comments/${encodeURIComponent(threadId)}`);
      if (response.status === 404) return null;
      const result = thread((await read(response)).thread);
      if (result.id !== threadId) throw new CommentAccessError(422);
      return result;
    },
    async create(anchor: CommentAnchor, body: string, id: string, messageId: string, mentions?: string[]) {
      const ids = mentionIds(mentions);
      return saved(await read(await send('write', '/comments', { body: { anchor, body, id, messageId, ...(ids ? { mentions: ids } : {}) } })));
    },
    async command(value, action, { mentions, ...rest } = {}) {
      const ids = action === 'reply' || action === 'edit' ? mentionIds(mentions) : undefined;
      return saved(await read(await send('write', `/comments/${encodeURIComponent(value.id)}`,
        { body: { revision: value.revision, action, ...rest, ...(ids ? { mentions: ids } : {}) } })));
    },
    async suggest(query) {
      check();
      if (mentionsOff || features.mentions !== true) throw new CommentAccessError(404);
      const response = await send('people', `/comment-people?q=${encodeURIComponent(query.trim().slice(0, QUERY_LIMIT))}`);
      // A server without the route has no mentions; the next list reports them off, so the panel hides `@`.
      if (response.status === 404) { mentionsOff = true; throw new CommentAccessError(404); }
      const value = await read(response);
      if (!Array.isArray(value.people)) throw new CommentAccessError(422);
      const people: CommentPerson[] = [], seen = new Set<string>();
      for (const entry of value.people) {
        if (people.length === PEOPLE_LIMIT) break;
        if (!object(entry) || !interactionKey(entry.id) || !personName(entry.name) || entry.id === person || seen.has(entry.id)) continue;
        seen.add(entry.id); people.push({ id: entry.id, name: entry.name });
      }
      return { people, truncated: value.truncated === true || value.people.length > PEOPLE_LIMIT };
    },
    async markRead(threadIds, at) {
      check();
      if (features.reads !== true) return;
      const ids = [...new Set(threadIds.filter(commentId))], when = time(at) ? new Date(Date.parse(at)).toISOString() : undefined;
      for (let i = 0; i < ids.length; i += READ_BATCH) {
        await read(await send('reads', '/comment-reads', { body: { threadIds: ids.slice(i, i + READ_BATCH), ...(when ? { at: when } : {}) } }));
      }
    },
    link(threadId) {
      check();
      return commentId(threadId) ? `${sessionLink()}?thread=${encodeURIComponent(threadId)}` : sessionLink();
    },
    pendingTarget() { return valid() ? takeReviewTarget(sessionId) : undefined; },
    onTarget(fn) {
      // Only this session's targets, only for the same account, and each one taken so it is acted on once.
      return onReviewTarget((target, threadId) => { if (target === sessionId && valid() && takeReviewTarget(target) === threadId) fn(threadId); });
    },
    ...(source ? { changes: { subscribe: (fn: (event: { threadId: string; revision: number }) => void) => source.subscribe(event => {
      if (valid() && commentId(event.threadId) && Number.isSafeInteger(event.revision) && event.revision >= 1) fn({ threadId: event.threadId, revision: event.revision });
    }) } } : {}),
    async loadDraft(key) {
      const { openDB } = await import('../bridge/db.ts'), slot = await draftKey(key);
      const value: unknown = await (await openDB()).get('profile', slot);
      check(); return typeof value === 'string' && value.length <= COMMENT_BODY_LIMIT ? value : '';
    },
    async saveDraft(key, body) {
      const { openDB } = await import('../bridge/db.ts'), slot = await draftKey(key); check();
      const db = await openDB(); if (body) await db.put('profile', body.slice(0, COMMENT_BODY_LIMIT), slot); else await db.delete('profile', slot);
    },
  };
}
