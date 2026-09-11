// SPDX-License-Identifier: MPL-2.0
/** Device History is a paged index into existing stores, not another document or
 * file archive. No payload/preview reads occur while listing. */
import type { IDBPDatabase } from 'idb';
import type { RevisionEntry } from './revision-history.ts';
import type { StateRecord } from './state.ts';
import type { ExportEntry } from '../lib/export-history.ts';
import type { LocalFileOperation } from '../lib/file-operation-store.ts';
import type { LocalFileBatch } from '../lib/file-batch-store.ts';
import type { Folder } from '../folders.ts';
import { isHiddenSlot } from '../lib/batch-slots.ts';
import { fold, tokenize, scoreHaystack } from '../lib/search/match.ts';

export type AppHistoryView = 'recent' | 'changes' | 'milestones';
export interface AppHistoryRow {
  id: string; ref: string; kind: 'creation' | 'revision' | 'export' | 'operation' | 'batch';
  at: string; title: string; toolId: string; slot?: string; projectId?: string; project?: string;
  milestone?: string; format?: string; state?: string;
  counts?: { succeeded: number; partially_succeeded: number; failed: number; cancelled: number; pending: number };
}
export interface AppHistoryQuery {
  view?: AppHistoryView; project?: string; toolId?: string; search?: string;
  from?: string; to?: string; before?: string;
}
export interface AppHistoryContext { folders: readonly Folder[]; tools?: readonly { id: string; name: string }[] }
export interface AppHistoryPage { entries: AppHistoryRow[]; before?: string }
export interface AppHistoryAPI {
  list(query: AppHistoryQuery, context: AppHistoryContext): Promise<AppHistoryPage>;
  preview(row: AppHistoryRow): Promise<string | null>;
  reopenExport(id: string): Promise<string | null>;
}
type Position = [string, string];
const position = (row: AppHistoryRow): Position => [row.at, row.id];
const compare = (a: Position, b: Position): number => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0;
const PAGE = 30, SCAN = 500;
const iso = (at: number): string => new Date(at).toISOString();

/** Invalid cursors never silently restart at the latest page. */
function cursorPosition(value?: string): Position | undefined {
  if (!value) return;
  const cursor: unknown = JSON.parse(value);
  if (!Array.isArray(cursor) || cursor.length !== 2 || !cursor.every(x => typeof x === 'string')) throw new Error('Invalid history page. Refresh to start again.');
  return cursor as Position;
}

function contextFor(context: AppHistoryContext, query: AppHistoryQuery) {
  const folders = new Map(context.folders.map(folder => [folder.id, folder]));
  const owner = new Map<string, Folder>();
  for (const folder of context.folders) for (const item of folder.items) if (item.type === 'session') owner.set(item.ref, folder);
  const paths = new Map<string, Folder[]>();
  for (const folder of context.folders) {
    const path: Folder[] = [], seen = new Set<string>(); let current: Folder | undefined = folder;
    while (current && !seen.has(current.id)) { path.unshift(current); seen.add(current.id); current = current.parentId ? folders.get(current.parentId) : undefined; }
    paths.set(folder.id, path);
  }
  const tools = new Map(context.tools?.map(tool => [tool.id, tool.name]));
  const tokens = tokenize((query.search ?? '').slice(0, 200));
  return (row: AppHistoryRow): boolean => {
    if (row.slot && isHiddenSlot(row.slot)) return false;
    const folder = row.slot ? owner.get(row.slot) : undefined;
    const path = folder ? paths.get(folder.id)! : [];
    if (folder) { row.projectId = folder.id; row.project = path.map(part => part.name).join(' / '); }
    if (query.project && (query.project === '__loose__' ? !!folder || !row.slot : !path.some(part => part.id === query.project))) return false;
    if (query.toolId && row.toolId !== query.toolId) return false;
    return !tokens.length || scoreHaystack([{ weight: 1, text: fold([row.title, row.milestone, row.project, row.toolId, tools.get(row.toolId), row.format, row.kind, row.state].filter(Boolean).join(' ')) }], tokens) > 0;
  };
}

/** A bounded provider returns the oldest position it inspected when it has more
 * data. The merge only emits the time range inspected by EVERY provider. This
 * preserves exports/results between revision pages, including empty search pages. */
export async function queryAppHistory(db: IDBPDatabase, query: AppHistoryQuery, context: AppHistoryContext): Promise<AppHistoryPage> {
  const view = query.view ?? 'recent', before = cursorPosition(query.before);
  const from = query.from ?? '', to = query.to ?? '\uffff';
  if (from > to) return { entries: [] };
  const matches = contextFor(context, query);
  const eligible = (row: AppHistoryRow): boolean => row.at >= from && row.at <= to && (!before || compare(position(row), before) < 0);
  const candidates: AppHistoryRow[] = [], boundaries: Position[] = [];
  const end = before && before[0] < to ? before[0] : to;
  if (end < from) return { entries: [] };
  const indexed = async (store: 'state' | 'exports' | 'revisions'): Promise<void> => {
    const records = db.transaction(store).store;
    const prefix = store === 'state' ? 'creation:' : store === 'exports' ? 'export:' : 'revision:';
    let upper: IDBValidKey[] = [end, []];
    if (before && before[0] <= to) {
      if (before[1].startsWith(prefix)) upper = [end, before[1].slice(prefix.length), []];
      else if (prefix > before[1]) upper = [end];
    }
    const range = IDBKeyRange.bound([from], upper);
    const metadata = store !== 'revisions';
    const index = records.index(metadata ? 'history' : 'time');
    // Key cursors intentionally exclude .value for saved canvases and exports.
    let cursor = metadata ? await index.openKeyCursor(range, 'prev') : await index.openCursor(range, 'prev');
    let scanned = 0, found = 0, last: AppHistoryRow | undefined;
    while (cursor && scanned++ < SCAN && found < PAGE) {
      if (metadata) {
        const [at, ref, toolId, title, extra, slot] = cursor.key as string[];
        last = store === 'state'
          ? { id: `creation:${ref}`, ref: ref!, kind: 'creation', at: at!, title: title || extra || toolId || 'Untitled', toolId: toolId!, slot: ref }
          : { id: `export:${ref}`, ref: ref!, kind: 'export', at: at!, title: title!, toolId: toolId!, format: extra, slot: slot || undefined };
      } else {
        const entry = (cursor as unknown as { value: RevisionEntry }).value;
        last = { id: `revision:${entry.id}`, ref: entry.id, kind: 'revision', at: entry.at, title: entry.label,
          toolId: entry.toolId, slot: entry.slot, milestone: entry.milestone };
      }
      if (eligible(last) && (view !== 'milestones' || !!last.milestone) && matches(last)) { candidates.push(last); found++; }
      cursor = await cursor.continue();
    }
    if (cursor && last) boundaries.push(position(last));
  };
  if (view === 'recent') await indexed('state');
  else {
    await indexed('revisions');
    if (view === 'changes') {
      await indexed('exports');
      // Existing stores cap reports to 100 operations and 100 batches / 4 MiB.
      // No result Blob or source file is read here. Batch members appear once.
      const tx = db.transaction(['file-operations', 'file-batches']);
      const operations = await tx.objectStore('file-operations').getAll() as LocalFileOperation[];
      const batches = await tx.objectStore('file-batches').getAll() as LocalFileBatch[];
      const members = new Set(batches.flatMap(batch => batch.members.map(member => member.operationId)));
      for (const op of operations) if (!members.has(op.id)) {
        const row: AppHistoryRow = { id: `operation:${op.id}`, ref: op.id, kind: 'operation', at: iso(op.createdAt),
          title: op.outputName || op.input.name, toolId: 'convert', format: op.request.target,
          state: op.state === 'running' && op.leaseUntil <= Date.now() ? 'interrupted' : op.state };
        if (eligible(row) && matches(row)) candidates.push(row);
      }
      const operationById = new Map(operations.map(op => [op.id, op]));
      for (const batch of batches) {
        const counts = { succeeded: 0, partially_succeeded: 0, failed: 0, cancelled: 0, pending: 0 };
        for (const member of batch.members) {
          const op = operationById.get(member.operationId);
          const state = member.report?.state ?? (op?.state === 'succeeded' || op?.state === 'failed' || op?.state === 'cancelled' ? op.state : undefined);
          if (state) counts[state]++;
          else if (batch.leaseUntil <= Date.now() && (!op || op.leaseUntil <= Date.now())) counts.failed++;
          else counts.pending++;
        }
        const row: AppHistoryRow = { id: `batch:${batch.id}`, ref: batch.id, kind: 'batch', at: iso(batch.createdAt),
          title: `${batch.members[0]?.source.facts.name ?? 'Batch'}${batch.members.length > 1 ? ` + ${batch.members.length - 1}` : ''}`,
          toolId: 'convert', format: batch.request.target, counts };
        if (eligible(row) && matches(row)) candidates.push(row);
      }
    }
  }
  const boundary = boundaries.sort(compare).at(-1);
  const known = candidates.filter(row => !boundary || compare(position(row), boundary) >= 0).sort((a, b) => compare(position(b), position(a)));
  const entries = known.slice(0, PAGE);
  const next = known.length > PAGE ? position(entries.at(-1)!) : boundary;
  return { entries, ...(next ? { before: JSON.stringify(next) } : {}) };
}

export async function appHistoryPreview(db: IDBPDatabase, row: AppHistoryRow): Promise<string | null> {
  if (row.kind === 'revision') return await db.get('revision-previews', row.ref) ?? null;
  if (row.kind === 'creation') return (await db.get('state', row.ref) as StateRecord | undefined)?.thumb ?? null;
  if (row.kind === 'export') return (await db.get('exports', row.ref) as ExportEntry | undefined)?.thumb ?? null;
  return null;
}

export async function appHistoryExportHref(db: IDBPDatabase, id: string): Promise<string | null> {
  const entry = await db.get('exports', id) as ExportEntry | undefined;
  return entry ? (await import('../lib/export-history.ts')).exportReopenHref(entry) : null;
}
