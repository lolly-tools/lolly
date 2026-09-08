// SPDX-License-Identifier: MPL-2.0
/** Read-only Work revision adapter. Restore is intentionally coordinator-owned. */

import type { SavedStateData } from '../bridge/state.ts';
import { instanceFetch } from '../lib/instance.ts';
import type { CollabHistoryCapability, CollabHistoryEntry, CollabHistoryPage } from '../lib/collab-history.ts';

interface WireRevision {
  sessionId?: string; rev?: number; inputs?: Record<string, unknown>; meta?: Record<string, unknown>;
  actor?: string; at?: string;
}

export interface WorkHistoryFetch {
  (input: string | URL, init?: RequestInit): Promise<Response>;
}

/**
 * Adapts Work's bounded `/revisions` endpoint to the shell history contract.
 * The endpoint is read-only today: a restore must be a CAS update through the
 * Work coordinator so the current live room and its head cannot be bypassed.
 */
export function createWorkCollabHistory(sessionId: string, fetcher: WorkHistoryFetch = instanceFetch): CollabHistoryCapability {
  const id = encodeURIComponent(sessionId);
  let cache: WireRevision[] | null = null;
  const load = async (): Promise<WireRevision[]> => {
    if (cache) return cache;
    const response = await fetcher(`/api/v1/sessions/${id}/revisions`, { credentials: 'include' });
    if (!response.ok) throw new Error(`Work history request failed (${response.status})`);
    const body = await response.json() as { revisions?: unknown };
    cache = Array.isArray(body.revisions) ? body.revisions.filter((item): item is WireRevision => !!item && typeof item === 'object') : [];
    return cache;
  };
  const entry = (revision: WireRevision): CollabHistoryEntry => ({
    id: `${sessionId}:${revision.rev}`,
    documentId: sessionId,
    toolId: typeof revision.meta?.toolId === 'string' ? revision.meta.toolId : 'design',
    label: typeof revision.meta?.label === 'string' ? revision.meta.label : `Revision ${revision.rev ?? '?'}`,
    reason: 'checkpoint',
    actor: { id: typeof revision.actor === 'string' ? revision.actor : 'work' },
    at: typeof revision.at === 'string' ? revision.at : new Date(0).toISOString(),
    revision: typeof revision.rev === 'number' ? revision.rev : 0,
  });
  return {
    scope: 'shared', durability: 'durable', canRestore: false, canSaveCopy: true,
    async list(): Promise<CollabHistoryPage> { return { entries: (await load()).sort((a, b) => (b.rev ?? 0) - (a.rev ?? 0)).map(entry) }; },
    async read(revisionId: string): Promise<SavedStateData | null> {
      const revision = (await load()).find(item => `${sessionId}:${item.rev}` === revisionId);
      return revision?.inputs && typeof revision.inputs === 'object' ? revision.inputs as SavedStateData : null;
    },
    async saveCopy(revisionId: string): Promise<SavedStateData | null> { return this.read(revisionId); },
  };
}
