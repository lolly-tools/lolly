// SPDX-License-Identifier: MPL-2.0
/**
 * org/comment-notice - a comment notice's title, body and link in the app's language
 * (plan 76 milestone 4).
 *
 * A notice (`data.kind` `comment-mention` or `comment-reply`) carries the actor's
 * name, the document's name and a reply count in its payload. The instance's own
 * title and body are in English; every place that shows a notice (the notification
 * queue and its announcement in org/inbox.ts, the inbox sheet, the blocking banner)
 * builds the words here instead. The link is built from the payload's checked session
 * and thread ids, never from the instance's `cta.url`.
 *
 * A leaf: core and i18n only, so org/inbox.ts, org/inbox-sheet.ts and org/banner.ts
 * can all import it without a load cycle.
 */
import { commentId } from '@lolly-tools/core/canvas-review-v1';
import { tRaw } from '../i18n.ts';

/** The body the instance sends when the thread has no message by someone else left. */
const NOTICE_GONE = 'This comment is no longer available.';

/** The session id rule of org/team-link-shared.ts `teamLinkSessionId`, applied to the
 *  value as sent. Importing that module would put this file in org/index.ts's load
 *  cycle, so the rule is repeated here and a test keeps the two in step. */
const TEAM_SESSION_ID = /^[A-Za-z0-9._~-]{1,200}$/;

/** A mention or reply notice, read from its message's payload. */
export interface CommentNotice {
  kind: 'mention' | 'reply';
  /** The thread inside this app, `#/team/<sessionId>?thread=<threadId>`, or '' when
   *  either id fails its check. Never the instance's `cta.url`. */
  href: string;
  /** The person who wrote, as the instance gave the name when the inbox was read. */
  actorName: string;
  /** The document's name, as the instance gave it when the inbox was read. */
  label: string;
  /** How many replies the notice stands for: 1 to 1000. */
  count: number;
}

/** The comment notice a message carries, or null for any other message. Pure. */
export function commentNoticeOf(m: { data?: Readonly<Record<string, string>> }): CommentNotice | null {
  const d = m.data;
  const kind = d?.kind === 'comment-mention' ? 'mention' : d?.kind === 'comment-reply' ? 'reply' : null;
  if (!d || !kind) return null;
  const sessionId = d.sessionId ?? '';
  const threadId = d.threadId ?? '';
  const href = TEAM_SESSION_ID.test(sessionId) && commentId(threadId)
    ? `#/team/${encodeURIComponent(sessionId)}?thread=${encodeURIComponent(threadId)}`
    : '';
  const n = /^\d{1,7}$/.test(d.count ?? '') ? Number(d.count) : 1;
  return { kind, href, actorName: (d.actorName ?? '').trim(), label: (d.label ?? '').trim(), count: Math.min(Math.max(n, 1), 1000) };
}

/** A comment notice's title in the app's language. `fallback`, the instance's own
 *  title, only when the payload lacks the name or the document the title needs.
 *  Plain text, for textContent. */
export function commentNoticeTitle(n: CommentNotice, fallback: string): string {
  if (!n.label) return fallback;
  if (n.kind === 'reply' && n.count > 1) return tRaw('New replies in {document}: {count}', { document: n.label, count: n.count });
  if (!n.actorName) return fallback;
  return n.kind === 'mention'
    ? tRaw('{name} mentioned you in {document}', { name: n.actorName, document: n.label })
    : tRaw('{name} replied in {document}', { name: n.actorName, document: n.label });
}

/** A comment notice's body: the quoted message as sent, or, for a thread with nothing
 *  left to quote, that sentence in the app's language. Plain text, for textContent. */
export function commentNoticeBody(body: string | undefined): string | undefined {
  return body?.trim() === NOTICE_GONE ? tRaw('This comment is no longer available.') : body;
}

/** Any inbox message's title and body as shown: a comment notice's in the app's
 *  language, any other message's as the instance sent them. Plain text. */
export function messageWords(m: { title: string; body?: string; data?: Readonly<Record<string, string>> }): { title: string; body: string | undefined } {
  const notice = commentNoticeOf(m);
  return notice
    ? { title: commentNoticeTitle(notice, m.title), body: commentNoticeBody(m.body) }
    : { title: m.title, body: m.body };
}
