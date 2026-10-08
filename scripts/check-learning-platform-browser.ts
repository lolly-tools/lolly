// SPDX-License-Identifier: MPL-2.0
/** Exercise folder course exports and website progress in a real browser. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { unzipSync, strFromU8 } from 'fflate';

const url = process.argv.find((a) => a.startsWith('--url='))?.slice(6) || 'http://127.0.0.1:5179';
const temp = await mkdtemp(join(tmpdir(), 'lolly-course-platform-'));
const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
let files: Record<string, Uint8Array> = {};
const server = createServer((request, response) => {
  const path = (request.url || '/').replace(/^\/course\//, '').split('?')[0] || 'index.html';
  const data = files[path];
  if (!data) {
    response.writeHead(404);
    response.end();
    return;
  }
  const ext = path.split('.').at(-1)!;
  response.setHeader(
    'Content-Type',
    (
      {
        html: 'text/html',
        js: 'text/javascript',
        css: 'text/css',
        png: 'image/png',
        woff2: 'font/woff2',
        woff: 'font/woff',
        ttf: 'font/ttf',
        otf: 'font/otf',
        json: 'application/json',
      } as Record<string, string>
    )[ext] || 'application/octet-stream'
  );
  response.end(data);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const port = (server.address() as { port: number }).port;
try {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`${url}/#/p`);
  await page.locator('.projects').waitFor();
  const folderId = await page.evaluate(async () => {
    const bridgePath = '/src/bridge/index.ts',
      folderPath = '/src/folders.ts';
    const host = await (await import(/* @vite-ignore */ bridgePath)).createBridge();
    const store = (await import(/* @vite-ignore */ folderPath)).createFolderStore(host);
    const folder = await store.create('Platform training');
    const child = await store.create('Practice', folder.id);
    await host.state.save('qr-code:course-fixture', {
      __toolId: 'qr-code',
      __label: 'Open the guide',
      url: 'https://example.test/guide',
    });
    await host.state.save('strip-data:course-fixture', {
      __toolId: 'strip-data',
      __label: 'Unfinished utility',
    });
    await host.state.save('__batch__:course-fixture', {
      __batch: true,
      __label: 'Partner links',
      format: 'png',
      rows: [
        {
          toolId: 'qr-code',
          values: { url: 'https://example.test/practice' },
          filename: 'Practice link',
        },
      ],
    });
    const id = 'user/course-fixture-image';
    const bytes = Uint8Array.from(
      atob(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aRZ8AAAAASUVORK5CYII='
      ),
      (c) => c.charCodeAt(0)
    );
    await host.assets._uploadUserAsset({
      id,
      type: 'raster',
      format: 'png',
      blob: new Blob([bytes], { type: 'image/png' }),
      meta: { name: 'Diagram' },
    });
    await store.addItem(folder.id, { type: 'session', ref: 'qr-code:course-fixture' });
    await store.addItem(folder.id, { type: 'session', ref: 'strip-data:course-fixture' });
    await store.addItem(folder.id, { type: 'image', ref: id });
    await store.addItem(child.id, { type: 'session', ref: '__batch__:course-fixture' });
    return folder.id;
  });
  await page.goto(`${url}/#/p/${folderId}`);
  await page.reload();
  await page.locator('[data-course-folder]').click();
  const review = page.getByRole('dialog', { name: 'Review course content' });
  await review.getByText('4 selected, 0 excluded.', { exact: false }).waitFor();
  assert.equal(await review.locator('li').count(), 4);
  assert.equal(await review.locator('[data-course-create]').isEnabled(), false);
  await review
    .locator('li')
    .filter({ hasText: 'cannot provide a saved course rendition' })
    .locator('input[type=checkbox]')
    .uncheck();
  await review.locator('li').last().getByRole('button', { name: 'Move up', exact: true }).click();
  await review.locator('[data-course-create]').click();
  await page.getByLabel('Course title', { exact: true }).waitFor();
  assert.equal(
    await page.getByRole('dialog', { name: 'Export course', exact: true }).count(),
    0,
    'new courses open in the editor'
  );
  await page.getByRole('button', { name: 'Export course', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Export course', exact: true });
  await dialog.getByLabel('Delivery format').selectOption('static');
  await dialog.getByLabel('Upload limit (MB, optional)').fill('0.000001');
  await dialog.getByRole('button', { name: 'Review course', exact: true }).click();
  await dialog.locator('[data-delivery-check]').click();
  await dialog
    .locator('[data-delivery-status]')
    .filter({ hasText: 'above the' })
    .waitFor({ timeout: 120000 });
  assert.equal(await dialog.locator('[data-delivery-save]').count(), 0);
  await dialog.locator('[data-delivery-step="0"]').click();
  await dialog.getByLabel('Upload limit (MB, optional)').fill('20');
  await dialog.getByRole('button', { name: 'Review course', exact: true }).click();
  await dialog.locator('[data-delivery-check]').click();
  await dialog.locator('[data-delivery-cancel]').click();
  await dialog.locator('[data-delivery-status]').filter({ hasText: 'cancelled' }).waitFor();
  assert.equal(await dialog.locator('[data-delivery-save]').count(), 0);
  await dialog.locator('[data-delivery-check]').click();
  await dialog.locator('[data-delivery-save]:enabled').waitFor({ timeout: 120000 });
  const downloadEvent = page.waitForEvent('download');
  await dialog.locator('[data-delivery-save]').click();
  const download = await downloadEvent;
  const path = join(temp, 'course.zip');
  await download.saveAs(path);
  const bytes = new Uint8Array(await readFile(path));
  files = unzipSync(bytes);
  assert.equal(files['imsmanifest.xml'], undefined);
  const course = JSON.parse(strFromU8(files['content.json']!));
  assert.equal(course.lessons.length, 3);
  assert.equal(course.lessons[1].title, 'Practice link');
  assert.equal(course.lessons[2].blocks[0].kind, 'image');
  assert.equal(course.lessons[1].blocks[0].kind, 'slides');
  assert.ok(Object.keys(files).filter((p) => p.startsWith('media/')).length >= 2);
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));

  const learner = await browser.newPage();
  const hosted = `http://127.0.0.1:${port}/course/index.html`;
  const external: string[] = [];
  learner.on('request', (request) => {
    if (!request.url().startsWith(`http://127.0.0.1:${port}/`)) external.push(request.url());
  });
  await learner.addInitScript(() => {
    const observations: unknown[] = [];
    Object.assign(window, { courseObservations: observations });
    window.addEventListener('lolly:learning-progress', (event) =>
      observations.push((event as CustomEvent).detail)
    );
  });
  await learner.goto(hosted);
  await learner.locator('main').waitFor();
  assert.equal(
    await learner.evaluate(async () => {
      await document.fonts.ready;
      return document.fonts.check('16px SUSE');
    }),
    true
  );
  assert.ok(JSON.parse(strFromU8(files['content.json']!)).presentation.fonts.length);

  await learner.getByRole('button', { name: 'Complete lesson and continue', exact: true }).click();
  await learner.getByRole('status').filter({ hasText: 'Progress saved in this browser' }).waitFor();
  await learner.reload();
  await learner.getByRole('status').filter({ hasText: 'Progress stays in this browser' }).waitFor();
  assert.match(await learner.locator('[aria-label="Lessons"]').innerText(), /Complete|✓/);
  for (let i = 1; i < 3; i++) {
    await learner
      .getByRole('button', {
        name: i === 2 ? 'Complete lesson' : 'Complete lesson and continue',
        exact: true,
      })
      .click();
    await learner
      .getByRole('status')
      .filter({ hasText: 'Progress saved in this browser' })
      .waitFor();
  }
  await learner.getByRole('button', { name: 'Finish', exact: true }).click();
  await learner.getByRole('status').filter({ hasText: 'Module completed' }).waitFor();
  assert.equal(
    await learner.evaluate(
      () =>
        (
          window as unknown as { courseObservations: Array<{ completed: boolean }> }
        ).courseObservations.at(-1)?.completed
    ),
    true
  );
  await learner.reload();
  assert.equal(
    await learner.getByRole('button', { name: 'Finish', exact: true }).isEnabled(),
    false
  );
  assert.deepEqual(external, []);

  // Use actual IndexedDB transactions to verify conflict and release isolation.
  const storage = await page.evaluate(
    async (path) => {
      const { createLearningTracking } = await import(/* @vite-ignore */ path);
      const a = await createLearningTracking(window, 'static', 'test-conflict', 'one');
      const b = await createLearningTracking(window, 'static', 'test-conflict', 'one');
      await a.read();
      await b.read();
      await a.save('first', false, '');
      let conflict = false;
      try {
        await b.save('second', false, '');
      } catch {
        conflict = true;
      }
      const other = await createLearningTracking(window, 'static', 'test-conflict', 'two');
      return { conflict, other: await other.read() };
    },
    `/@fs${resolve('packages/learning-player/src/tracking.ts')}`
  );
  assert.equal(storage.conflict, true);
  assert.equal(storage.other, '');
  const sourcePage = await context.newPage();
  await sourcePage.goto(`${url}/#/tool/qr-code?slot=qr-code%3Acourse-fixture`);
  await sourcePage.getByRole('button', { name: 'Export options', exact: true }).click();
  await sourcePage.locator('[data-course-export]').click();
  await sourcePage.locator('.learning-entry li').waitFor();
  assert.equal(await sourcePage.locator('.learning-entry li').count(), 1);
  await sourcePage.locator('[data-course-close]').click();
  const motion = await sourcePage.evaluate(async () => {
    const bridgePath = '/src/bridge/index.ts',
      renderPath = '/src/lib/learning-render.ts';
    const host = await (await import(/* @vite-ignore */ bridgePath)).createBridge();
    const { resolveLearningBlock } = await import(/* @vite-ignore */ renderPath);
    const values = {
      boxes: [
        {
          id: 'page',
          kind: 'frame',
          x: 0,
          y: 0,
          w: 640,
          h: 360,
          bg: '#123456',
          lane: 'seq',
          start: 0,
          dur: 0.5,
        },
        {
          id: 'title',
          kind: 'text',
          x: 40,
          y: 70,
          w: 560,
          h: 90,
          frame: 'page',
          text: 'Course motion',
          fg: '#ffffff',
          fontSize: 40,
          start: 0,
          dur: 0.5,
          enter: 'fade',
        },
      ],
    };
    const parts = await resolveLearningBlock(host, {
      id: 'motion',
      kind: 'video',
      source: { kind: 'session', toolId: 'design', values },
    });
    const part = parts[0];
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(new Blob([part.bytes], { type: part.mime }));
    video.src = objectUrl;
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = resolve;
      video.onerror = reject;
    });
    const result = {
      mime: part.mime,
      width: video.videoWidth,
      height: video.videoHeight,
      duration: video.duration,
      bytes: part.bytes.length,
    };
    URL.revokeObjectURL(objectUrl);
    return result;
  });
  assert.match(motion.mime, /^video\//);
  assert.equal(motion.width, 640);
  assert.equal(motion.height, 360);
  assert.ok(motion.duration >= 0.4 && motion.bytes > 100);
  assert.deepEqual(errors, []);
  console.log(
    'Platform checks passed: recursive folder review, batch rows, explicit exclusions, ordering, media rendering, upload limits, cancellation, static package, phone dialog, browser resume, completion, event contract and storage conflicts, tool handoff and silent Design motion at authored dimensions.'
  );
} finally {
  await browser.close();
  server.close();
  await rm(temp, { recursive: true, force: true });
}
