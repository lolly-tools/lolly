// SPDX-License-Identifier: MPL-2.0
import { interactionKey } from './canvas-interaction-v1.ts';

export const COMMENT_THREAD_LIMIT = 100;
export const COMMENT_MESSAGE_LIMIT = 50;
export const COMMENT_BODY_LIMIT = 4_000;
export const COMMENT_THREAD_BYTES = 64_000;
export const COMMENT_MENTION_LIMIT = 10;
export interface CommentMention { id: string; name: string }
export type CommentAnchor = { surface: string; x: number; y: number } & (
  | { kind: 'canvas' }
  // `at`: the document-space point where the pin was placed (±1e6), kept so a
  // thread whose object was deleted can still be shown where it was.
  | { kind: 'object'; collection: string; objectId: string; at?: { x: number; y: number } }
);
export interface CommentMessage {
  id: string; authorId: string; authorName: string; body: string; createdAt: string;
  editedAt?: string; deletedAt?: string;
  /** People mentioned in this message. Names are set by the server from its own records. */
  mentions?: CommentMention[];
}
export interface CommentThread {
  id: string; sessionId: string; anchor: CommentAnchor; authorId: string; authorName: string;
  revision: number; createdAt: string; updatedAt: string; resolvedAt?: string; resolvedBy?: string;
  messages: CommentMessage[];
}
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const date = (value: unknown): value is string => typeof value === 'string' && value.length <= 32 && Number.isFinite(Date.parse(value));
export const commentId = (value: unknown): value is string => interactionKey(value) && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
const documentCoordinate = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e6;
/** Rebuild mentions as `{ id, name }`, dropping invalid or repeated people; never a reason to reject a message. */
function readCommentMentions(value: unknown): CommentMention[] {
  const mentions: CommentMention[] = [];
  if (!Array.isArray(value)) return mentions;
  for (const entry of value) {
    if (mentions.length >= COMMENT_MENTION_LIMIT) break;
    if (!record(entry) || !interactionKey(entry.id) || typeof entry.name !== 'string' || !entry.name.length || entry.name.length > 256
      || mentions.some(mention => mention.id === entry.id)) continue;
    mentions.push({ id: entry.id, name: entry.name });
  }
  return mentions;
}
export function readCommentAnchor(value: unknown): CommentAnchor | null {
  if (!record(value) || !interactionKey(value.surface) || !['canvas', 'object'].includes(String(value.kind))
    || typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  if (value.kind === 'object') {
    if (!interactionKey(value.collection) || !interactionKey(value.objectId) || value.x < 0 || value.x > 1 || value.y < 0 || value.y > 1) return null;
    const at = record(value.at) && documentCoordinate(value.at.x) && documentCoordinate(value.at.y) ? { x: value.at.x, y: value.at.y } : undefined;
    return { kind: 'object', collection: value.collection, objectId: value.objectId, surface: value.surface, x: value.x, y: value.y, ...(at ? { at } : {}) };
  }
  if (Math.abs(value.x) > 1e6 || Math.abs(value.y) > 1e6) return null;
  return { kind: 'canvas', surface: value.surface, x: value.x, y: value.y };
}
export function readCommentThread(value: unknown): CommentThread | null {
  if (!record(value)) return null;
  const anchor = readCommentAnchor(value.anchor);
  if (!anchor || !commentId(value.id) || !interactionKey(value.sessionId) || !interactionKey(value.authorId)
    || typeof value.authorName !== 'string' || value.authorName.length > 256 || !date(value.createdAt) || !date(value.updatedAt)
    || typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 1
    || !Array.isArray(value.messages) || !value.messages.length || value.messages.length > COMMENT_MESSAGE_LIMIT
    || JSON.stringify(value).length > COMMENT_THREAD_BYTES) return null;
  const messages: CommentMessage[] = [];
  for (const message of value.messages) {
    if (!record(message) || !commentId(message.id) || !interactionKey(message.authorId) || typeof message.authorName !== 'string'
      || message.authorName.length > 256 || typeof message.body !== 'string' || message.body.length > COMMENT_BODY_LIMIT
      || (!message.deletedAt && !message.body.trim()) || !date(message.createdAt)
      || (message.editedAt !== undefined && !date(message.editedAt)) || (message.deletedAt !== undefined && !date(message.deletedAt))) return null;
    const mentions = readCommentMentions(message.mentions);
    messages.push({ id: message.id, authorId: message.authorId, authorName: message.authorName, body: message.body, createdAt: message.createdAt,
      ...(date(message.editedAt) ? { editedAt: message.editedAt } : {}), ...(date(message.deletedAt) ? { deletedAt: message.deletedAt } : {}),
      ...(mentions.length ? { mentions } : {}) });
  }
  if (new Set(messages.map(message => message.id)).size !== messages.length
    || (value.resolvedAt !== undefined && !date(value.resolvedAt)) || (value.resolvedBy !== undefined && !interactionKey(value.resolvedBy))) return null;
  return { id: value.id, sessionId: value.sessionId, anchor, authorId: value.authorId, authorName: value.authorName,
    revision: value.revision, createdAt: value.createdAt, updatedAt: value.updatedAt, messages,
    ...(date(value.resolvedAt) ? { resolvedAt: value.resolvedAt } : {}), ...(interactionKey(value.resolvedBy) ? { resolvedBy: value.resolvedBy } : {}) };
}
