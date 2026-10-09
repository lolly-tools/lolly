// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { errors, type Page } from 'playwright-core';
import { packPng } from '../engine/src/png.ts';
import { packWav } from '../engine/src/wav.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { settleEditor } from '../packages/node-shell/src/open-session.ts';
import type { CanvasCommitEl } from '../shells/web/src/lib/canvas-commit.ts';
import { journeyDiagnostics } from './helpers/journey-diagnostics.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
const rows = (page: Page): Promise<Array<Record<string, unknown>>> =>
  page.evaluate(
    () =>
      (document.querySelector('#tool-canvas') as CanvasCommitEl).__lollyModel!().find(
        (input) => input.id === 'boxes'
      )!.value as Array<Record<string, unknown>>
  );

interface MediaPersistenceDiagnostic {
  selection: {
    route: 'design-path' | 'design-hash' | 'other';
    source: 'hash' | 'search';
    slot: string | null;
    rememberedSlot: string | null;
    rememberedTool: 'design' | 'other' | null;
  };
  live: { count: number; ids: Array<string | null>; truncated: boolean } | null;
  durable: { count: number; ids: Array<string | null>; truncated: boolean } | null;
  revision: {
    status: 'absent-store' | 'absent-record' | 'read-error' | 'present' | 'not-read';
    head: string | null;
    version: string | null;
    workingHash: string | null;
  };
}

interface MediaPersistenceRead {
  // Used only by the existing navigation, never forwarded to diagnostic output.
  navigationSlot: string | null;
  diagnostic: MediaPersistenceDiagnostic;
}

async function mediaPersistenceRead({ expectedIds, durable }: {
  expectedIds?: unknown[];
  durable: boolean;
}): Promise<MediaPersistenceRead | false> {
  const safeId = (value: unknown): string | null =>
    typeof value === 'string' && /^(?:page|[0-9A-HJKMNP-TV-Z]{26})$/.test(value) ? value : null;
  const safeUuid = (value: unknown): string | null =>
    typeof value === 'string' && /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value) ? value : null;
  const safeSlot = (value: unknown): string | null =>
    typeof value === 'string' && /^design:(?:[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}|\d{10,17})$/i.test(value)
      ? value : null;
  const rowIds = (value: unknown): MediaPersistenceDiagnostic['live'] => {
    if (!Array.isArray(value)) return null;
    return { count: value.length, ids: value.slice(0, 16).map((row) => safeId(row?.id)), truncated: value.length > 16 };
  };
  const source = location.hash.split('?')[1] === undefined ? 'search' : 'hash';
  const slot = new URLSearchParams(location.hash.split('?')[1] ?? location.search).get('slot');
  const remembered = window.history.state?.lollyHistory;
  const canvas = document.querySelector('#tool-canvas') as CanvasCommitEl | null;
  let live: MediaPersistenceDiagnostic['live'] = null;
  try {
    live = rowIds(canvas?.__lollyModel?.().find((input) => input.id === 'boxes')?.value);
  } catch {
    // An unavailable live model must not change the durable-read predicate.
  }
  const diagnostic: MediaPersistenceDiagnostic = {
    selection: {
      route: location.pathname === '/t/design' ? 'design-path'
        : /^#\/(?:t\/)?design(?:[/?]|$)/.test(location.hash) ? 'design-hash' : 'other',
      source,
      slot: safeSlot(slot),
      rememberedSlot: safeSlot(remembered?.slot),
      rememberedTool: remembered?.toolId === 'design' ? 'design' : remembered?.toolId ? 'other' : null,
    },
    live,
    durable: null,
    revision: { status: 'not-read', head: null, version: null, workingHash: null },
  };
  if (durable && slot) {
    const request = indexedDB.open('lolly');
    if (expectedIds === undefined) {
      // Failure observation may precede app setup; never create a database.
      request.onupgradeneeded = () => request.transaction?.abort();
    }
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!db.objectStoreNames.contains('state')) return expectedIds ? false : { navigationSlot: slot, diagnostic };
      const hasRevisions = db.objectStoreNames.contains('revision-documents');
      const transaction = db.transaction(hasRevisions ? ['state', 'revision-documents'] : ['state']);
      const read = transaction.objectStore('state').get(slot);
      const revisionRead = hasRevisions ? transaction.objectStore('revision-documents').get(slot) : null;
      const revision = revisionRead
        ? new Promise<{ head?: unknown; version?: unknown; workingHash?: unknown } | undefined | 'read-error'>((resolve) => {
          revisionRead.onsuccess = () => resolve(revisionRead.result);
          revisionRead.onerror = (event) => {
            event.preventDefault();
            resolve('read-error');
          };
        }) : Promise.resolve(undefined);
      const saved = await new Promise<{ data?: { boxes?: Array<{ id?: unknown }> } } | undefined>(
        (resolve, reject) => {
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        }
      );
      const matches = JSON.stringify(saved?.data?.boxes?.map(box => box.id)) === JSON.stringify(expectedIds);
      if (expectedIds && !matches) return false;
      const current = await revision;
      diagnostic.durable = rowIds(saved?.data?.boxes);
      diagnostic.revision = {
        status: !hasRevisions ? 'absent-store' : current === 'read-error' ? 'read-error' : current ? 'present' : 'absent-record',
        head: current && current !== 'read-error' ? safeUuid(current.head) : null,
        version: current && current !== 'read-error' ? safeUuid(current.version) : null,
        workingHash: current && current !== 'read-error' && typeof current.workingHash === 'string'
          && /^(?:[\da-f]{64})?$/.test(current.workingHash) ? current.workingHash : null,
      };
    } finally {
      db.close();
    }
  } else if (expectedIds) return false;
  return { navigationSlot: slot, diagnostic };
}

function pollMediaPersistence(read: () => Promise<MediaPersistenceRead | false>): Promise<MediaPersistenceRead> {
  return new Promise((resolve, reject) => {
    let stopped = false;
    let next: ReturnType<typeof setTimeout> | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const finish = (settle: () => void) => {
      if (stopped) return;
      stopped = true;
      clearTimeout(deadline);
      clearTimeout(next);
      settle();
    };
    const fail = (error: unknown) => finish(() => reject(error));
    const poll = () => {
      if (stopped) return;
      Promise.resolve().then(read).then((value) => {
        if (stopped) return;
        if (value === false) {
          next = setTimeout(poll, 100);
          return;
        }
        if (!value || typeof value !== 'object' || Array.isArray(value)
          || typeof value.navigationSlot !== 'string' || !value.diagnostic
          || !Array.isArray(value.diagnostic.durable?.ids)) {
          fail(new Error('The durable media query returned an invalid snapshot.'));
          return;
        }
        finish(() => resolve(value));
      }, fail);
    };
    // Async reads must finish and match, including when the page query stalls.
    deadline = setTimeout(() => fail(new errors.TimeoutError('Durable media rows did not match within 30000ms.')), 30_000);
    poll();
  });
}

const savedRows = (page: Page, ids: unknown[]): Promise<MediaPersistenceRead> =>
  pollMediaPersistence(() => page.evaluate(mediaPersistenceRead, { expectedIds: ids, durable: true }));

test('dropping image, video and audio adds objects, undoes together, and reopens with their media', {
  skip: origin ? false : 'no browser origin (set LOLLY_EXPORT_TEST_URL to a local web shell)',
  timeout: 300_000,
}, async (t) => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin!).hostname));
  const seed = [
    { id: 'page', kind: 'frame', name: 'Page', x: 0, y: 0, w: 800, h: 600, bg: '#ffffff' },
  ];
  const image = packPng(new Uint8Array(64 * 32 * 4).fill(255), {
    width: 64,
    height: 32,
    channels: 4,
  });
  const audio = packWav({ channels: [new Float32Array(8000)], sampleRate: 8000 });
  const browser = await getBrowser();
  const context = await browser.newContext({
    serviceWorkers: 'block',
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  const diagnose = journeyDiagnostics(context, 'design-file-drop');
  let page: Page | undefined;
  const report = (stage: string, snapshot: MediaPersistenceRead) =>
    t.diagnostic(`[design-media-reopen] ${JSON.stringify({ stage, ...snapshot.diagnostic })}`);
  try {
    page = await context.newPage();
    page.setDefaultTimeout(30_000);
    const root = new URL(origin!).origin;
    await page.goto(
      `${root}/t/design?boxes=${encodeURIComponent(JSON.stringify(seed))}&w=800&h=600`,
      { waitUntil: 'load' }
    );
    await settleEditor(page, 120_000);
    await page.locator('dialog.view-loading[open]').waitFor({ state: 'hidden' });
    assert.equal((await rows(page)).length, 1);
    await page.evaluate(
      async ({ image, audio }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 32;
        canvas.getContext('2d')!.fillRect(0, 0, 64, 32);
        const stream = canvas.captureStream(10);
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        const parts: Blob[] = [];
        recorder.ondataavailable = (event) => parts.push(event.data);
        const video = new Promise<Blob>((resolve) => {
          recorder.onstop = () => resolve(new Blob(parts, { type: 'video/webm' }));
        });
        recorder.start();
        await new Promise((resolve) => setTimeout(resolve, 300));
        recorder.stop();
        const clip = await video;
        for (const track of stream.getTracks()) track.stop();
        const transfer = new DataTransfer();
        transfer.items.add(
          new File([new Uint8Array(image)], 'dropped-photo.png', { type: 'image/png' })
        );
        transfer.items.add(new File([clip], 'dropped-video.webm'));
        transfer.items.add(new File([new Uint8Array(audio)], 'dropped-audio.wav'));
        // The editor root covers drops on its controls as well as the canvas.
        const target = document.querySelector('[data-topbar="name"]')!;
        target.dispatchEvent(
          new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: transfer })
        );
        target.dispatchEvent(
          new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer })
        );
        target.dispatchEvent(
          new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer: transfer,
            clientX: 10,
            clientY: 10,
          })
        );
      },
      { image: Array.from(image), audio: Array.from(audio) }
    );
    await page.waitForFunction(() => {
      const canvas = document.querySelector('#tool-canvas') as CanvasCommitEl;
      const boxes = canvas?.__lollyModel?.().find((input) => input.id === 'boxes')?.value;
      return Array.isArray(boxes) && boxes.length === 4;
    });
    await settleEditor(page, 30_000);
    const placed = await rows(page);
    assert.deepEqual(
      placed.slice(1).map((box) => (box.image as { type: string }).type),
      ['raster', 'video', 'audio']
    );
    assert.equal(Number(placed[1]!.w) / Number(placed[1]!.h), 2);
    assert.equal(placed[3]!.kind, 'audio');
    assert.equal(placed[3]!.dur, 1);
    assert.ok(placed.slice(1).every((box) => box.frame === 'page'));
    assert.equal(await page.locator('#tool-canvas.is-file-dragover').count(), 0);
    report('durable-drop', await savedRows(page, placed.map(box => box.id)));
    await page.locator('[data-topbar="undo"]').click();
    await settleEditor(page, 30_000);
    assert.equal((await rows(page)).length, 1);
    // Observe the durable undo before redo, so the earlier four-object drop
    // cannot satisfy the redo's persistence check while undo is still writing.
    report('durable-undo', await savedRows(page, seed.map(box => box.id)));
    await page.locator('[data-topbar="redo"]').click();
    await settleEditor(page, 30_000);
    assert.equal((await rows(page)).length, 4);
    // Wait for automatic history to finish writing the document and its uploads.
    const redo = await savedRows(page, placed.map(box => box.id));
    report('durable-redo', redo);
    const selection = await page.evaluate(mediaPersistenceRead, { durable: false });
    if (selection) {
      t.diagnostic(`[design-media-reopen] ${JSON.stringify({
        stage: 'before-navigation', ...selection.diagnostic,
        lastDurable: { stage: 'durable-redo', slot: redo.diagnostic.selection.slot,
          rows: redo.diagnostic.durable, revision: redo.diagnostic.revision },
      })}`);
    }
    const slot = selection ? selection.navigationSlot : null;
    assert.ok(slot);
    await page.goto(`${root}/t/design?slot=${encodeURIComponent(slot)}`, { waitUntil: 'load' });
    await settleEditor(page, 120_000);
    const reopened = await rows(page);
    assert.deepEqual(
      reopened.map((box) => box.id),
      placed.map((box) => box.id)
    );
    for (const box of reopened.slice(1)) {
      const asset = box.image as { id: string; url: string };
      assert.match(asset.id, /^user\/upload\//);
      assert.ok(
        await page.evaluate(async (url) => (await (await fetch(url)).blob()).size > 0, asset.url)
      );
    }
  } catch (error) {
    if (page && !page.isClosed()) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const snapshot = await Promise.race([
          page.evaluate(mediaPersistenceRead, { durable: true }),
          new Promise<false>((resolve) => { timer = setTimeout(() => resolve(false), 2000); }),
        ]);
        if (snapshot) report('failure', snapshot);
        else t.diagnostic('[design-media-reopen] failure snapshot unavailable');
      } catch {
        t.diagnostic('[design-media-reopen] failure snapshot unavailable');
      } finally {
        clearTimeout(timer);
      }
    }
    await diagnose(error);
    throw error;
  } finally {
    await context.close();
    await closeBrowser();
  }
});
