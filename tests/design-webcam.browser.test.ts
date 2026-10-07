// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { ViteDevServer } from 'vite';

test('Design webcam starts explicitly, keeps its feed across edits and captures a portable poster', { timeout: 180_000 }, async t => {
  let server: ViteDevServer | undefined;
  let origin = process.env.LOLLY_EXPORT_TEST_URL;
  if (!origin) {
    const { createServer } = await import('vite');
    server = await createServer({ root: fileURLToPath(new URL('../shells/web', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen(); origin = server.resolvedUrls!.local[0]!;
  }
  t.after(async () => { await server?.close(); });
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
    ...(process.env.LOLLY_CAMERA_CHROME ? { channel: 'chrome' } : {}) });
  t.after(async () => { await browser.close(); });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(() => {
    for (const key of ['lolly-welcome-dismissed', 'lolly-tips-dismissed', 'lolly-privacy-ack']) localStorage.setItem(key, '1');
    const state = window as unknown as { cameraCalls: number; cameraStream?: MediaStream };
    state.cameraCalls = 0;
    const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async constraints => {
      state.cameraCalls++; state.cameraStream = await original(constraints); return state.cameraStream;
    };
  });
  const boxes = [{ id: 'cam', kind: 'webcam', x: 100, y: 100, w: 640, h: 360, bg: '#071b16' }];
  await page.goto(`${origin}/t/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}&_sel=cam&w=1000&h=700`);
  await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls), 0);
  await page.getByRole('button', { name: 'Start camera', exact: true }).click();
  await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>('[data-live-camera-video]')?.videoWidth ?? 0) > 0);
  const freeze = await page.evaluate(async () => {
    const path = '/src/bridge/export-motion-snapshot.ts';
    const { snapshotMotion } = await import(path);
    const canvas = document.querySelector('#tool-canvas')!;
    const video = canvas.querySelector<HTMLVideoElement>('[data-live-camera-video]')!;
    const restore = snapshotMotion(canvas, 'video[data-live-camera-video]');
    const still = canvas.querySelector<HTMLImageElement>('[data-motion-still]');
    const frozen = !!still?.src.startsWith('data:image/png') && video.style.display === 'none';
    restore();
    return { frozen, restored: video.style.display !== 'none' && !canvas.querySelector('[data-motion-still]') };
  });
  assert.deepEqual(freeze, { frozen: true, restored: true });
  await page.getByRole('button', { name: 'Capture frame', exact: true }).click();
  await page.waitForFunction(() => {
    const canvas = document.querySelector('#tool-canvas') as HTMLElement & { __lollyModel: () => { id: string; value: unknown }[] };
    return (canvas.__lollyModel().find(input => input.id === 'boxes')!.value as { image?: { url?: string } }[])[0]!.image?.url;
  });
  assert.equal(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls), 1);
  await page.waitForFunction(() => (document.querySelector<HTMLVideoElement>('[data-live-camera-video]')?.videoWidth ?? 0) > 0);
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole('button', { name: 'Stop camera', exact: true }).waitFor();
    const bounds = await page.locator('.live-camera-controls').boundingBox(); assert.ok(bounds);
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width + 1, JSON.stringify(bounds));
  }
  await page.getByRole('button', { name: 'Stop camera', exact: true }).click();
  await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => (window as unknown as { cameraStream: MediaStream }).cameraStream.getVideoTracks()[0]!.readyState), 'ended');
  assert.equal(await page.locator('[data-live-camera-video]').count(), 0);
  await page.reload();
  await page.getByRole('button', { name: 'Start camera', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls), 0);
  assert.equal(await page.locator('[data-live-camera-video]').count(), 0);
  await page.waitForFunction(() => (document.querySelector<HTMLImageElement>('[data-live-camera] img')?.naturalWidth ?? 0) > 0);
  assert.deepEqual(errors, []);
});
