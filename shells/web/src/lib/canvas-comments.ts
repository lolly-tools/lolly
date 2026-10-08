// SPDX-License-Identifier: MPL-2.0
import type { CommentAnchor, CommentThread } from '@lolly-tools/core/canvas-review-v1';
export interface CommentPermissions { userId: string; create: boolean; editOwn: boolean; resolveAny: boolean; deleteAny: boolean }
/** A person the comments panel may offer as a mention. Names never carry an email address. */
export interface CommentPerson { id: string; name: string }
/** One comments list. Every field past `threads` is optional: absent means the host lacks that feature. */
export interface CommentListResult {
  enabled: boolean; permissions: CommentPermissions; threads: CommentThread[];
  /** Per-thread read marks (thread id to ISO time) for the signed-in person. */
  reads?: Record<string, string>;
  /** Threads with no newer activity than this ISO time count as read. */
  readFloor?: string;
  /** Thread ids with an unacknowledged inbox notice for the signed-in person. */
  notices?: string[];
  features?: { mentions?: boolean; reads?: boolean; events?: boolean; thread?: boolean };
}
/**
 * Comments supplied by a collaboration host. Every optional member is a feature a host
 * may lack; a caller checks for the member before using it and never assumes it exists.
 */
export interface CanvasCommentsCapability {
  list(): Promise<CommentListResult>;
  /** One thread by id, or null when it is gone. */
  get?(threadId: string): Promise<CommentThread | null>;
  create(anchor: CommentAnchor, body: string, id: string, messageId: string, mentions?: string[]): Promise<CommentThread & { notified?: boolean }>;
  command(thread: CommentThread, action: 'reply' | 'resolve' | 'reopen' | 'edit' | 'delete',
    options?: { messageId?: string; body?: string; mentions?: string[] }): Promise<CommentThread & { notified?: boolean }>;
  loadDraft(key: string): Promise<string>;
  saveDraft(key: string, body: string): Promise<void>;
  /** People who can open this document and match `query`, for `@` mentions. */
  suggest?(query: string): Promise<{ people: CommentPerson[]; truncated: boolean }>;
  markRead?(threadIds: string[], at?: string): Promise<void>;
  /** A link to one thread. A link grants nothing: only people who can open the document can follow the link. */
  link?(threadId: string): string;
  /** A thread a link or notification asked for, taken once. */
  pendingTarget?(): string | undefined;
  onTarget?(fn: (threadId: string) => void): () => void;
  /** Saved comment writes announced by the host; carries ids and a revision only. */
  changes?: { subscribe(fn: (event: { threadId: string; revision: number }) => void): () => void };
}
