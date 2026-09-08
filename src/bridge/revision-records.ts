// SPDX-License-Identifier: MPL-2.0
import type { IDBPTransaction } from 'idb';
import type { SavedStateData, StateRecord } from './state.ts';

export const REVISION_STORES = ['state', 'revision-documents', 'revisions', 'revision-payloads', 'revision-previews', 'revision-usage', 'revision-recovery', 'revision-recovery-payloads'];
export interface DocumentHead {
  slot: string;
  documentId: string;
  head: string | null;
  hash: string | null;
  /** Each successful current-state write changes this token, including recovery. */
  version?: string;
  workingHash?: string;
}
export interface RevisionCursor { head: string | null; version: string | null }
export function documentVersion(doc?: DocumentHead): string | null { return doc?.version ?? doc?.head ?? null; }
export type RevisionTransaction = IDBPTransaction<unknown, string[], 'readwrite'>;

export async function writeCurrentState(tx: RevisionTransaction, record: StateRecord, data: SavedStateData, documentId: string): Promise<void> {
  const state = tx.objectStore('state');
  const prior = await state.get(record.slot) as StateRecord | undefined;
  await state.put({ ...record, data, thumb: null, documentId, createdAt: prior?.createdAt ?? record.createdAt });
}
