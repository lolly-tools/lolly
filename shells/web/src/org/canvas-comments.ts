// SPDX-License-Identifier: MPL-2.0
import { COMMENT_BODY_LIMIT, COMMENT_THREAD_LIMIT, readCommentThread, type CommentAnchor } from '@lolly-tools/core/canvas-review-v1';
import type { CanvasCommentsCapability } from '../lib/canvas-comments.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';

export class CommentAccessError extends Error {
  readonly status: number;
  constructor(status: number) { super(status === 409 ? 'The thread changed. Your reply is kept. Refresh and send again.'
    : status === 401 || status === 403 || status === 410 ? 'Comment access ended. Your unsent reply is kept on this device.' : 'Comments could not be loaded. Try again.'); this.status = status; }
}
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
export function createWorkComments(sessionId: string, principal: () => string | undefined): CanvasCommentsCapability {
  const base = getInstanceBase(), person = principal(), scope = `${base}\n${person ?? ''}\n${sessionId}`;
  const path = `/api/v1/sessions/${encodeURIComponent(sessionId)}/comments`;
  function check(): void { if (!person || principal() !== person || getInstanceBase() !== base) throw new CommentAccessError(403); }
  async function request(tail = '', body?: object): Promise<Record<string, unknown>> {
    check();
    const response = await instanceFetch(instancePath(path + tail), { headers: { 'content-type': 'application/json' },
      ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}) });
    check(); if (!response.ok) throw new CommentAccessError(response.status);
    const value: unknown = await response.json(); if (!object(value)) throw new CommentAccessError(422); return value;
  }
  const thread = (value: unknown) => { const result = readCommentThread(value); if (!result || result.sessionId !== sessionId) throw new CommentAccessError(422); return result; };
  async function draftKey(key: string): Promise<string> {
    check();
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${scope}\n${key}`));
    return `comment-draft:${Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  }
  return {
    async list() {
      const value = await request();
      if (typeof value.enabled !== 'boolean' || !object(value.permissions) || !Array.isArray(value.threads) || value.threads.length > COMMENT_THREAD_LIMIT) throw new CommentAccessError(422);
      const p = value.permissions;
      if (typeof p.userId !== 'string' || ['create', 'editOwn', 'resolveAny', 'deleteAny'].some(key => typeof p[key] !== 'boolean')) throw new CommentAccessError(422);
      return { enabled: value.enabled, permissions: { userId: p.userId, create: p.create === true, editOwn: p.editOwn === true, resolveAny: p.resolveAny === true, deleteAny: p.deleteAny === true }, threads: value.threads.map(thread) };
    },
    async create(anchor: CommentAnchor, body: string, id: string, messageId: string) { return thread((await request('', { anchor, body, id, messageId })).thread); },
    async command(value, action, options = {}) { return thread((await request(`/${encodeURIComponent(value.id)}`, { revision: value.revision, action, ...options })).thread); },
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
