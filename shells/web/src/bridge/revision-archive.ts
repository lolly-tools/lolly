// SPDX-License-Identifier: MPL-2.0
import type { IDBPDatabase } from 'idb';
import { indexSavedWork } from './history-index.ts';
import type { RevisionEntry } from './revision-history.ts';
import type { RecoveryEntry } from './revision-recovery.ts';
import { MAX_RECOVERY_BYTES, MAX_REVISION_BYTES, MAX_REVISION_PREVIEWS, MAX_REVISION_ARCHIVE_BYTES } from './revision-limits.ts';
import { canonicalRevisionData } from './revision-snapshot.ts';
import { REVISION_STORES, type DocumentHead, type RevisionTransaction } from './revision-records.ts';
import { validateRevisionArchive, type RevisionArchive, type RevisionArchiveAPI } from './revision-archive-format.ts';
import type { StateRecord } from './state.ts';

const same = (a: object, b: object): boolean => JSON.stringify(canonicalRevisionData({ ...a })) === JSON.stringify(canonicalRevisionData({ ...b }));
const conflict = (label: string): never => { throw new Error(`History backup conflicts with “${label}” on this device. Its existing work was kept. Restore the backup on a separate install to open it as a copy.`); };

export function createRevisionArchive(db: IDBPDatabase): RevisionArchiveAPI {
  return {
    async export() {
      // A single read transaction pairs each current session with its exact head
      // and draft generation, even while another tab continues editing.
      const tx = db.transaction(REVISION_STORES);
      const usage = await tx.objectStore('revision-usage').get('total') ?? { bytes: 0, previews: 0 };
      let bytes = usage.bytes + usage.previews + (await tx.objectStore('revision-usage').get('recovery') ?? 0);
      const archive: RevisionArchive = { version: 1, documents: [], revisions: [], recoveries: [] };
      for (const document of await tx.objectStore('revision-documents').getAll() as DocumentHead[]) {
        const state = await tx.objectStore('state').get(document.slot) as StateRecord | undefined;
        if (!state) throw new Error('A history document is missing its current state. Keep this device and repair it before backing up.');
        bytes += new TextEncoder().encode(JSON.stringify(state)).byteLength;
        if (bytes > MAX_REVISION_ARCHIVE_BYTES) throw new Error('Complete revision history exceeds the 384 MiB backup limit. No partial history backup was created.');
        archive.documents.push({ document, state });
      }
      let cursor = await tx.objectStore('revisions').openCursor();
      while (cursor) {
        const entry = cursor.value as RevisionEntry;
        const data = await tx.objectStore('revision-payloads').get(entry.id);
        const preview = await tx.objectStore('revision-previews').get(entry.id) as string | undefined;
        archive.revisions.push({ entry, data, ...(preview ? { preview } : {}) }); cursor = await cursor.continue();
      }
      let drafts = await tx.objectStore('revision-recovery').openCursor();
      while (drafts) {
        const entry = drafts.value as RecoveryEntry;
        archive.recoveries.push({ ...entry, data: await tx.objectStore('revision-recovery-payloads').get(entry.id) });
        drafts = await drafts.continue();
      }
      await tx.done;
      return validateRevisionArchive(archive);
    },
    async restore(value) {
      const archive = await validateRevisionArchive(value);
      const tx = db.transaction(REVISION_STORES, 'readwrite'); void tx.done.catch(() => {});
      try {
        await checkDocuments(tx, archive);
        const usage = await tx.objectStore('revision-usage').get('total') ?? { bytes: 0, previews: 0 };
        for (const row of archive.revisions) {
          const existing = await tx.objectStore('revisions').get(row.entry.id) as RevisionEntry | undefined;
          if (existing && (!same({ ...existing, assetRefs: row.entry.assetRefs, reason: 'save' }, { ...row.entry, reason: 'save' }) || !same(await tx.objectStore('revision-payloads').get(row.entry.id), row.data))) conflict(row.entry.label);
          if (!existing) {
            usage.bytes += row.entry.bytes;
            await tx.objectStore('revisions').add(row.entry);
            await tx.objectStore('revision-payloads').add(row.data, row.entry.id);
          } else if (row.entry.reason === 'save' && existing.reason === 'automatic') await tx.objectStore('revisions').put({ ...existing, reason: 'save' });
          if (row.preview && !await tx.objectStore('revision-previews').get(row.entry.id)) {
            usage.previews += row.preview.length;
            await tx.objectStore('revision-previews').put(row.preview, row.entry.id);
          }
        }
        let recoveryBytes = await tx.objectStore('revision-usage').get('recovery') ?? 0;
        for (const { data, ...entry } of archive.recoveries) {
          const existing = await tx.objectStore('revision-recovery').get(entry.id) as RecoveryEntry | undefined;
          if (existing && (!same(existing, entry) || !same(await tx.objectStore('revision-recovery-payloads').get(entry.id), data))) conflict(entry.label);
          if (!existing) {
            recoveryBytes += entry.bytes;
            await tx.objectStore('revision-recovery').add(entry);
            await tx.objectStore('revision-recovery-payloads').add(data, entry.id);
          }
        }
        if (usage.bytes > MAX_REVISION_BYTES || usage.previews > MAX_REVISION_PREVIEWS || recoveryBytes > MAX_RECOVERY_BYTES) throw new Error('There is not enough history space for this backup. Existing history was kept; nothing from this history archive was restored.');
        for (const row of archive.documents) if (!await tx.objectStore('revision-documents').get(row.document.slot)) {
          await tx.objectStore('revision-documents').add(row.document);
          const preview = row.document.head ? await tx.objectStore('revision-previews').get(row.document.head) : null;
          await tx.objectStore('state').put(indexSavedWork({ ...row.state, thumb: row.document.hash === row.document.workingHash ? preview ?? null : null }));
        }
        await tx.objectStore('revision-usage').put(usage, 'total');
        await tx.objectStore('revision-usage').put(recoveryBytes, 'recovery');
        await tx.done;
        return { revisions: archive.revisions.length, recoveryDrafts: archive.recoveries.length };
      } catch (error) { try { tx.abort(); } catch { /* already aborted */ } throw error; }
    },
  };
}

async function checkDocuments(tx: RevisionTransaction, archive: RevisionArchive): Promise<void> {
  const docs = tx.objectStore('revision-documents');
  const current = await docs.getAll() as DocumentHead[];
  const byId = new Map(current.map(doc => [doc.documentId, doc]));
  for (const { document, state } of archive.documents) {
    const existing = await docs.get(document.slot) as DocumentHead | undefined;
    const sameId = byId.get(document.documentId);
    const saved = await tx.objectStore('state').get(document.slot) as StateRecord | undefined;
    if (sameId && sameId.slot !== document.slot || existing && (existing.documentId !== document.documentId || existing.head !== document.head) || saved && !same(saved.data, state.data)) conflict(state.label || state.slot);
  }
}
