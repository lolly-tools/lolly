// SPDX-License-Identifier: MPL-2.0
import type { CommentAnchor, CommentThread } from '@lolly-tools/core/canvas-review-v1';
export interface CommentPermissions { userId: string; create: boolean; editOwn: boolean; resolveAny: boolean; deleteAny: boolean }
export interface CanvasCommentsCapability {
  list(): Promise<{ enabled: boolean; permissions: CommentPermissions; threads: CommentThread[] }>;
  create(anchor: CommentAnchor, body: string, id: string, messageId: string): Promise<CommentThread>;
  command(thread: CommentThread, action: 'reply' | 'resolve' | 'reopen' | 'edit' | 'delete', options?: { messageId?: string; body?: string }): Promise<CommentThread>;
  loadDraft(key: string): Promise<string>;
  saveDraft(key: string, body: string): Promise<void>;
}
