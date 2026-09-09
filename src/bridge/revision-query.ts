// SPDX-License-Identifier: MPL-2.0
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry, RevisionPage } from './revision-history.ts';
import type { DocumentHead } from './revision-records.ts';

export interface RevisionQuery {
  slot?: string; toolId?: string; search?: string; from?: string; to?: string;
  milestones?: boolean; before?: string; limit?: number;
}
const folded = (value: string): string => value.normalize('NFKC').toLocaleLowerCase();

/** Reads metadata only. Date/tool/document ranges are indexed; free-text scans
 * at most 500 candidates per page and returns a continuation even with no hit. */
export async function queryRevisions(db: IDBPDatabase, query: RevisionQuery = {}): Promise<RevisionPage> {
  const tx = db.transaction(['revision-documents', 'revisions']);
  const doc = query.slot ? await tx.objectStore('revision-documents').get(query.slot) as DocumentHead | undefined : undefined;
  if (query.slot && !doc) return { entries: [] };
  const records = tx.objectStore('revisions');
  const toolIndex = !doc && query.toolId && records.indexNames.contains('toolTime');
  const prefix = doc ? [doc.documentId] : toolIndex ? [query.toolId!] : [];
  const index = records.index(doc ? 'documentTime' : toolIndex ? 'toolTime' : 'time');
  const from = query.from ?? '', to = query.to ?? '\uffff';
  if (from > to) return { entries: [] };
  let end = [to, '\uffff'];
  if (query.before) {
    const cursor: unknown = JSON.parse(query.before);
    if (!Array.isArray(cursor) || cursor.length !== 2 || !cursor.every(value => typeof value === 'string')) throw new Error('Invalid history page. Refresh to start again.');
    if (cursor[0]! < from) return { entries: [] };
    if (cursor[0]! <= to) end = cursor;
  }
  const range = IDBKeyRange.bound([...prefix, from, ''], [...prefix, ...end], false, !!query.before);
  const limit = Number.isFinite(query.limit) ? Math.max(1, Math.min(100, Math.floor(query.limit!))) : 30;
  const term = folded((query.search ?? '').slice(0, 200));
  const entries: RevisionEntry[] = [];
  let cursor = await index.openCursor(range, 'prev'), scanned = 0, last: RevisionEntry | undefined;
  while (cursor && entries.length < limit && scanned++ < 500) {
    last = cursor.value as RevisionEntry;
    if ((query.slot || !last.slot.startsWith('__trash__:')) && (!query.toolId || query.toolId === last.toolId)
      && (!query.milestones || !!last.milestone)
      && (!term || folded(`${last.label} ${last.milestone ?? ''} ${last.toolId}`).includes(term))) entries.push(last);
    cursor = await cursor.continue();
  }
  return { entries, ...(cursor && last ? { before: JSON.stringify([last.at, last.id]) } : {}) };
}
