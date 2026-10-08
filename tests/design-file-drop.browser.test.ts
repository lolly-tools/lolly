// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import type { Page } from 'playwright-core';
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

const savedRows = (page: Page, ids: unknown[]): Promise<unknown> =>
  page.waitForFunction(async (expectedIds) => {
    const slot = new URLSearchParams(location.hash.split('?')[1] ?? location.search).get('slot');
    if (!slot) return false;
    const request = indexedDB.open('lolly');
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    try {
      if (!db.objectStoreNames.contains('state')) return false;
      const read = db.transaction('state').objectStore('state').get(slot);
      const saved = await new Promise<{ data?: { boxes?: Array<{ id?: unknown }> } } | undefined>(
        (resolve, reject) => {
          read.onsuccess = () => resolve(read.result);
          read.onerror = () => reject(read.error);
        }
      );
      return JSON.stringify(saved?.data?.boxes?.map(box => box.id)) === JSON.stringify(expectedIds);
    } finally {
      db.close();
    }
  }, ids);

test('dropping image, video and audio adds objects, undoes together, and reopens with their media', {
  skip: origin ? false : 'no browser origin (set LOLLY_EXPORT_TEST_URL to a local web shell)',
  timeout: 300_000,
}, async () => {
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
  try {
    const page = await context.newPage();
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
    await page.locator('[data-topbar="undo"]').click();
    await settleEditor(page, 30_000);
    assert.equal((await rows(page)).length, 1);
    // Observe the durable undo before redo, so the earlier four-object drop
    // cannot satisfy the redo's persistence check while undo is still writing.
    await savedRows(page, seed.map(box => box.id));
    await page.locator('[data-topbar="redo"]').click();
    await settleEditor(page, 30_000);
    assert.equal((await rows(page)).length, 4);
    // Wait for automatic history to finish writing the document and its uploads.
    await savedRows(page, placed.map(box => box.id));
    const slot = await page.evaluate(() =>
      new URLSearchParams(location.hash.split('?')[1] ?? location.search).get('slot')
    );
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
    await diagnose(error);
    throw error;
  } finally {
    await context.close();
    await closeBrowser();
  }
});
