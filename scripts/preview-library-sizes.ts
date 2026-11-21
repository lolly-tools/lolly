#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Sizes of a real library of saved work, read in the browser that holds it, for
 * plan 373 (one preview store). SIZES ONLY: counts and byte totals by kind. It
 * never reads out a label, a slot, a tool's values or a picture.
 *
 *   node scripts/preview-library-sizes.ts
 *
 * prints a snippet. Open Lolly in the browser whose library you want measured,
 * open the developer console on that tab, paste the snippet and press Enter. It
 * reads the `lolly` IndexedDB one record at a time (a large library is never held
 * whole) and prints one JSON object. Nothing is written, nothing is sent anywhere.
 */

/** Runs in the page. Kept as a plain function so its source is the snippet. */
async function measureLibrary(): Promise<unknown> {
  const pct = (values: number[], p: number): number => {
    if (!values.length) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!;
  };
  const summary = (values: number[]) => ({ count: values.length, total: values.reduce((a, b) => a + b, 0), median: pct(values, 0.5), p90: pct(values, 0.9), max: pct(values, 1) });
  const kindOf = (thumb: unknown): string => {
    if (typeof thumb !== 'string' || !thumb) return 'none';
    const m = /^data:image\/([a-z+]+)(;base64)?,/i.exec(thumb);
    if (!m) return 'other';
    return m[1] === 'svg+xml' ? (m[2] ? 'svg-base64' : 'svg-percent') : m[1]!.toLowerCase();
  };
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('lolly');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => { request.transaction?.abort(); reject(new Error('No Lolly library in this browser.')); };
  });
  const walk = (store: string, visit: (value: unknown, key: IDBValidKey) => void): Promise<void> => new Promise((resolve, reject) => {
    if (!db.objectStoreNames.contains(store)) { resolve(); return; }
    const request = db.transaction(store).objectStore(store).openCursor();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) { resolve(); return; }
      visit(cursor.value, cursor.key);
      cursor.continue();
    };
  });
  const textBytes = (value: unknown): number => (typeof value === 'string' ? value.length : value == null ? 0 : JSON.stringify(value).length);
  const sessions = { record: [] as number[], data: [] as number[], byKind: {} as Record<string, number[]>, withReference: 0 };
  await walk('state', (value) => {
    const record = value as { data?: unknown; thumb?: unknown; preview?: unknown };
    sessions.record.push(textBytes(record));
    sessions.data.push(textBytes(record.data));
    (sessions.byKind[kindOf(record.thumb)] ??= []).push(textBytes(record.thumb));
    if (record.preview) sessions.withReference++;
  });
  const revisionPreviews: number[] = [];
  await walk('revision-previews', (value) => { revisionPreviews.push(textBytes(value)); });
  const generated: number[] = [];
  await walk('generated-previews', (value) => { const row = value as { thumb?: unknown; sig?: unknown }; generated.push(textBytes(row.thumb) + textBytes(row.sig)); });
  const exportsThumbs: number[] = [];
  await walk('exports', (value) => { exportsThumbs.push(textBytes((value as { thumb?: unknown }).thumb)); });
  const storedPictures: number[] = [];
  await walk('preview-blobs', (value) => { storedPictures.push((value as { size?: number }).size ?? 0); });
  const estimate = await navigator.storage?.estimate?.().catch(() => undefined);
  db.close();
  return {
    measuredAt: new Date().toISOString(),
    databaseVersion: db.version,
    sessions: {
      count: sessions.record.length,
      wholeRecordChars: summary(sessions.record),
      documentChars: summary(sessions.data),
      pictureCharsByKind: Object.fromEntries(Object.entries(sessions.byKind).map(([kind, sizes]) => [kind, summary(sizes)])),
      withPictureReference: sessions.withReference,
    },
    historyPreviewChars: summary(revisionPreviews),
    oldRenderCacheChars: summary(generated),
    exportLogPictureChars: summary(exportsThumbs),
    previewStoreBytes: summary(storedPictures),
    storageEstimate: estimate ? { usage: estimate.usage, quota: estimate.quota } : null,
  };
}

const snippet = `(${measureLibrary.toString()})().then(r => console.log(JSON.stringify(r, null, 2)), e => console.error(e));`;
console.log('Paste this into the developer console of a Lolly tab (sizes only; nothing is written or sent):\n');
console.log(snippet);
