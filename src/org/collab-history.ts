// SPDX-License-Identifier: MPL-2.0
/** Read-only Work revision adapter. Restore is intentionally coordinator-owned. */

import type { SavedStateData } from '../bridge/state.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';
import type { CollabHistoryCapability, CollabHistoryEntry, CollabHistoryPage } from '../lib/collab-history.ts';

interface WireRevision {
  sessionId?: string; rev?: number; inputs?: Record<string, unknown>; meta?: Record<string, unknown>;
  actor?: string; at?: string;
}

export type WorkHistoryFetch = (input: string | URL, init?: RequestInit) => Promise<Response>;

/**
 * Adapts Work's bounded `/revisions` endpoint to the shell history contract.
 * The endpoint is read-only today: a restore must be a CAS update through the
 * Work coordinator so the current live room and its head cannot be bypassed.
 */
export function createWorkCollabHistory(sessionId: string, fetcher: WorkHistoryFetch = instanceFetch): CollabHistoryCapability {
  const id = encodeURIComponent(sessionId);
  const instance = getInstanceBase();
  const endpoint = instancePath(`/api/v1/sessions/${id}`);
  const assertInstance = (): void => {
    if (getInstanceBase() !== instance) throw new Error('The Work instance changed. Reopen this collaboration to view its history.');
  };
  const request = async (url: string): Promise<Record<string, unknown>> => {
    assertInstance();
    const response = await fetcher(url, { credentials: 'include', cache: 'no-store' });
    assertInstance();
    if (!response.ok) throw new Error(`Work history request failed (${response.status})`);
    const body: unknown = await response.json();
    assertInstance();
    if (!record(body)) throw new Error('Work returned invalid history.');
    return body;
  };
  // The existing server endpoint returns its last twenty full snapshots. Do not
  // cache those across actions: list must refresh and copy must recheck access.
  // Session metadata supplies the tool identity older revision rows lack.
  const load = async (): Promise<{ revisions: WireRevision[]; toolId: string }> => {
    const session = await request(endpoint);
    if (typeof session.toolId !== 'string' || !session.toolId) throw new Error('Work history is missing its tool identity.');
    const body = await request(`${endpoint}/revisions`);
    if (!Array.isArray(body.revisions)) throw new Error('Work returned invalid history.');
    const revisions = body.revisions.filter((item): item is WireRevision => record(item)
      && Number.isSafeInteger(item.rev) && Number(item.rev) >= 0
      && (item.sessionId === undefined || item.sessionId === sessionId))
      .sort((a, b) => b.rev! - a.rev!);
    return { revisions, toolId: session.toolId };
  };
  const entry = (revision: WireRevision, toolId: string): CollabHistoryEntry => ({
    id: `${sessionId}:${revision.rev}`,
    documentId: sessionId,
    toolId: typeof revision.meta?.toolId === 'string' && revision.meta.toolId ? revision.meta.toolId : toolId,
    label: typeof revision.meta?.label === 'string' ? revision.meta.label : `Revision ${revision.rev ?? '?'}`,
    reason: 'checkpoint',
    actor: { id: typeof revision.actor === 'string' ? revision.actor : 'work' },
    at: typeof revision.at === 'string' ? revision.at : new Date(0).toISOString(),
    revision: typeof revision.rev === 'number' ? revision.rev : 0,
  });
  return {
    scope: 'shared', durability: 'durable', canRestore: false, canSaveCopy: true,
    async list(query): Promise<CollabHistoryPage> {
      const { revisions, toolId } = await load();
      const before = query?.before;
      const index = before ? revisions.findIndex(item => `${sessionId}:${item.rev}` === before) : -1;
      const rows = before ? (index < 0 ? [] : revisions.slice(index + 1)) : revisions;
      const limit = Number.isFinite(query?.limit) ? Math.max(1, Math.min(200, Math.floor(query!.limit!))) : 30;
      const page = rows.slice(0, limit).map(item => entry(item, toolId));
      return { entries: page, before: page.length < rows.length ? page.at(-1)?.id : undefined };
    },
    async read(revisionId: string): Promise<SavedStateData | null> {
      const { revisions, toolId } = await load();
      const revision = revisions.find(item => `${sessionId}:${item.rev}` === revisionId);
      if (!revision || !record(revision.inputs)) return null;
      const identity = entry(revision, toolId);
      return { ...revision.inputs, __toolId: identity.toolId, __label: identity.label,
        ...(typeof revision.meta?.toolVersion === 'string' ? { __toolVersion: revision.meta.toolVersion } : {}) };
    },
    async saveCopy(revisionId: string): Promise<SavedStateData | null> { return this.read(revisionId); },
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
