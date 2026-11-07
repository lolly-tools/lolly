// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { chromium } from 'playwright';
import { studioAlphaReport } from './helpers/studio3d-alpha.ts';
import { pollPage } from './helpers/page-poll.ts';

const origin = process.env.STUDIO_SHELL_URL;
const collectionPath =
  '/@fs' + fileURLToPath(new URL('../engine/src/studio3d-collection.ts', import.meta.url));
const step = (message: string) => {
  if (process.env.STUDIO_DEBUG) console.log(message);
};

test('3D Studio imports, reopens a portable model and exports through editor and batch', {
  skip: !origin && 'Set STUDIO_SHELL_URL to a running web shell.',
  timeout: 900_000,
}, async (t) => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.STUDIO_NATIVE
      ? { executablePath: chromium.executablePath(), args: ['--use-angle=metal'] }
      : {}),
  });
  const errors: string[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
    });
    page.setDefaultTimeout(90000);
    await page.routeWebSocket(/127\.0\.0\.1/, (socket) => socket.close());
    page.on('pageerror', (e) => errors.push(e.message));
    step('studio: browser ready');
    // imprint=0: the alpha checks below read the renderer's own pixels, and the pixel
    // watermark (on by default) moves RGB at the silhouette by up to 16 levels by design.
    // With it off, the exported PNG matched the renderer's frame exactly (2026-09-16).
    await page.goto(
      `${origin}/t/3d-studio?source=model&samples=8&outputMode=object-shadow&camera.azimuth=42&camera.elevation=20&camera.fov=35&camera.zoom=1.4&c2pa=0&imprint=0&width=360&height=360`
    );
    step('studio: page loaded');
    await page.locator('[data-input-id="modelAsset"]').click();
    step('studio: model choice clicked');
    const upload = page.locator('input[type="file"][accept*=".glb"]');
    step('studio: picker opened');
    await upload.setInputFiles({
      name: 'duck.glb',
      mimeType: 'model/gltf-binary',
      buffer: await readFile('community/3d/assets/duck.glb'),
    });
    // The SUSE overlay opens on Geeko, so "ready" alone is satisfied before the upload
    // arrives; wait for the uploaded model to be the one in the scene.
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      const id = marker && JSON.parse(marker.dataset.lollyStudio!).values.modelAsset?.id;
      return marker?.dataset.studioState === 'ready' && typeof id === 'string' && id.startsWith('user/upload/');
    });
    const values = await page
      .locator('[data-lolly-studio]')
      .evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values);
    assert.match(values.modelAsset.id, /^user\/upload\//);
    await page.locator('[data-input-id="controls"]').selectOption('expert');
    await page.locator('[data-studio-state="ready"]').waitFor();
    assert.equal(await page.locator('[data-input-id="projection"]').count(), 1);
    await page.locator('[data-input-id="controls"]').selectOption('guided');
    await page.locator('[data-studio-state="ready"]').waitFor();
    assert.equal(await page.locator('[data-input-id="projection"]').count(), 0);
    const after = await page
      .locator('[data-lolly-studio]')
      .evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values);
    assert.deepEqual(after.camera, values.camera);

    const cameraState = () =>
      page
        .locator('[data-lolly-studio]')
        .evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.camera);
    const waitCamera = async (expected: Record<string, unknown>) => {
      await page.waitForFunction((expected) => {
        const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
        const camera = marker && JSON.parse(marker.dataset.lollyStudio!).values.camera;
        return (
          marker?.dataset.studioState === 'ready' &&
          camera &&
          Object.entries(expected).every(([key, value]) => camera[key] === value)
        );
      }, expected);
    };
    const waitValue = async (key: string, value: unknown) =>
      page.waitForFunction(
        ({ key, value }) => {
          const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
          return (
            marker?.dataset.studioState === 'ready' &&
            JSON.parse(marker.dataset.lollyStudio!).values[key] === value
          );
        },
        { key, value }
      );
    await page.getByRole('button', { name: 'Fit object', exact: true }).click();
    await page.waitForFunction((camera) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        JSON.stringify(JSON.parse(marker.dataset.lollyStudio!).values.camera) !==
          JSON.stringify(camera)
      );
    }, values.camera);
    const fitted = await cameraState();
    assert.notDeepEqual(fitted, values.camera);
    await page.keyboard.press('ControlOrMeta+z');
    await waitCamera(values.camera);
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await waitCamera(fitted);
    await page.getByRole('button', { name: 'Reset camera', exact: true }).click();
    await waitCamera({ azimuth: 25 });
    await page.keyboard.press('ControlOrMeta+z');
    await waitCamera(fitted);
    await page.keyboard.press('ControlOrMeta+z');
    await waitCamera(values.camera);
    const preview = page.locator('.lolly-studio-canvas');
    await preview.focus();
    await preview.press('ArrowRight');
    await waitCamera({ azimuth: Number(values.camera.azimuth) + 2 });
    assert.equal(await preview.evaluate(el => document.activeElement === el), true);
    await preview.press('ArrowRight');
    await waitCamera({ azimuth: Number(values.camera.azimuth) + 4 });
    await page.keyboard.press('ControlOrMeta+z');
    await waitCamera({ azimuth: Number(values.camera.azimuth) + 2 });
    await page.keyboard.press('ControlOrMeta+z');
    await waitCamera(values.camera);
    await page.evaluate(() =>
      (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('depthOfField', true)
    );
    await waitValue('depthOfField', true);
    await page.getByRole('button', { name: 'Pick focus', exact: true }).click();
    await preview.click({
      position: {
        x: (await preview.boundingBox())!.width / 2,
        y: (await preview.boundingBox())!.height / 2,
      },
    });
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        JSON.parse(marker.dataset.lollyStudio!).values.focusDistance > 0
      );
    });
    await page.keyboard.press('ControlOrMeta+z');
    await waitValue('focusDistance', 0);
    await page.evaluate(() =>
      (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('depthOfField', false)
    );
    await waitValue('depthOfField', false);
    step('studio: fit, reset, separate keyboard undo, redo and focus picking passed');

    const download = page.locator('[data-action="download"]');
    // The Download button is laid out below the fold while the export panel is closed, so
    // it reads as visible either way; the panel is closed while this opener is present,
    // and it stays open after a download.
    const opener = page.getByRole('button', { name: 'Export options', exact: true });
    const exportPng = async () => {
      if (await opener.count()) await opener.click();
      const downloading = page.waitForEvent('download');
      await download.click();
      const bytes = await readFile((await (await downloading).path())!);
      assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
      assert.ok(bytes.length > 10_000);
      // Decoded through a 2D canvas, which un-premultiplies, as the renderer suites read frames.
      return page.evaluate(async (bytes) => {
        const image = await createImageBitmap(
          new Blob([new Uint8Array(bytes)], { type: 'image/png' })
        );
        const canvas = document.createElement('canvas');
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(image, 0, 0);
        image.close();
        const pixels = Array.from(ctx.getImageData(0, 0, canvas.width, canvas.height).data);
        return { pixels, width: canvas.width, height: canvas.height };
      }, Array.from(bytes));
    };
    const shadowPng = await exportPng();
    step('studio: export opened and downloaded');
    const alpha = { clear: 0, solid: 0, partial: 0 };
    for (let i = 3; i < shadowPng.pixels.length; i += 4) {
      if (shadowPng.pixels[i] === 0) alpha.clear++;
      else if (shadowPng.pixels[i] === 255) alpha.solid++;
      else alpha.partial++;
    }
    assert.ok(alpha.clear > 100 && alpha.solid > 100 && alpha.partial > 100, JSON.stringify(alpha));
    // The exported cutouts pass the renderer suite's alpha checks (plan 265, D2.1). Each
    // object mask comes from an object export of the same view. The lit export asserts clear
    // outside and the shadow bound and reports the halo measure, because lit silhouettes are
    // shaded; a flat-lit pair (one constant colour, shadows kept) also asserts the halo check,
    // so a fringe added by the export path itself would fail (tests/studio3d-quality-alpha).
    type EditorCanvas = HTMLElement & {
      __lollyCommit(id: string, value: unknown): void;
      __lollyModel(): { id: string; value: unknown }[];
    };
    // Commit values, then wait until the studio shows the model's own copy of each and is ready.
    const settle = async (changes: Record<string, unknown>) => {
      const expected = await page.evaluate((changes) => {
        const canvas = document.querySelector('[data-lolly-canvas]') as EditorCanvas;
        for (const [id, value] of Object.entries(changes)) canvas.__lollyCommit(id, value);
        const model = new Map(canvas.__lollyModel().map((input) => [input.id, input.value]));
        return Object.fromEntries(Object.keys(changes).map((id) => [id, model.get(id)]));
      }, changes);
      await page.waitForFunction((expected) => {
        const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
        const current = marker && JSON.parse(marker.dataset.lollyStudio!).values;
        return (
          marker?.dataset.studioState === 'ready' &&
          Object.entries(expected).every(
            ([id, value]) => JSON.stringify(current[id]) === JSON.stringify(value)
          )
        );
      }, expected);
    };
    const checkCutout = (
      label: string,
      shadow: typeof shadowPng,
      object: typeof shadowPng,
      halo: boolean
    ) => {
      const report = studioAlphaReport(shadow, object, 'object-shadow', 0.4);
      const detail = `${label}: ${JSON.stringify(report)}`;
      t.diagnostic(`exported cutout, ${detail}`);
      assert.ok(report.objectPixels > 1000, detail);
      assert.equal(report.strayAlpha, 0, `clear outside, ${detail}`);
      assert.ok(report.shadowPixels > 100, detail);
      assert.ok(report.shadowAlpha <= report.shadowLimit, `shadow bound, ${detail}`);
      assert.ok(report.haloChecked > 50, detail);
      const alone = studioAlphaReport(object, object, 'object', 0.4);
      const aloneDetail = `${label} object output: ${JSON.stringify(alone)}`;
      t.diagnostic(`exported cutout, ${aloneDetail}`);
      assert.equal(alone.borderAlpha, 0, aloneDetail);
      if (halo) {
        assert.ok((report.haloWorst?.excess ?? 0) <= 8, `no halo, ${detail}`);
        assert.ok((alone.haloWorst?.excess ?? 0) <= 8, `no halo, ${aloneDetail}`);
      }
    };
    await settle({ outputMode: 'object' });
    checkCutout('lit', shadowPng, await exportPng(), false);
    // The glow halo is off: it draws colour outside the silhouette on purpose.
    const flat: Record<string, unknown> = {
      materialMode: 'pair',
      finishA: 'glow',
      finishB: 'glow',
      glow: 0,
      studio: 'custom',
      lights: [
        {
          kind: 'directional',
          color: '#ffffff',
          x: -3,
          y: 6,
          z: 4,
          intensity: 0,
          size: 1.5,
          shadows: true,
        },
      ],
      environmentIntensity: 0,
    };
    const saved = await page.evaluate((ids) => {
      const canvas = document.querySelector('[data-lolly-canvas]') as EditorCanvas;
      const model = new Map(canvas.__lollyModel().map((input) => [input.id, input.value]));
      return Object.fromEntries(ids.map((id) => [id, model.get(id)]));
    }, Object.keys(flat));
    await settle(flat);
    const flatObject = await exportPng();
    await settle({ outputMode: 'object-shadow' });
    checkCutout('flat', await exportPng(), flatObject, true);
    await settle(saved);

    step('studio: downloaded');
    const packed = await page.evaluate(async () => {
      const bridgePath = '/src/bridge/index.ts',
        packPath = '/src/lib/lolly-pack.ts',
        rowPath = '/src/pro/render-export.ts';
      const [{ createBridge }, { buildLollyFile }, { renderRowToBlob }] = await Promise.all([
        import(bridgePath),
        import(packPath),
        import(rowPath),
      ]);
      const host = await createBridge();
      const canvas = document.querySelector('[data-lolly-canvas]') as Element & {
        __lollyModel?: () => { id: string; value: unknown }[];
      };
      if (!canvas?.__lollyModel) throw new Error('The editor did not publish its input model.');
      const values = Object.fromEntries(
        canvas.__lollyModel().map((input) => [input.id, input.value])
      );
      await host.state.save('studio-test', { ...values, __toolId: '3d-studio' });
      const session = await host.state.load('studio-test');
      const file = await buildLollyFile({
        session,
        toolId: '3d-studio',
        userAssets: await host.assets._exportUserAssets(),
      });
      const result = await renderRowToBlob({ toolId: '3d-studio', values }, host, {
        format: 'png',
        width: 360,
        height: 360,
        watermark: false,
        embedMeta: false,
        c2pa: false,
      });
      return {
        file: Array.from(new Uint8Array(await file.blob.arrayBuffer())),
        image: Array.from(new Uint8Array(await result.blob.arrayBuffer())),
      };
    });
    assert.ok(packed.image.length > 10_000);
    step('studio: packed and batch rendered');
    const reader = await browser.newPage({
      viewport: { width: 900, height: 700 },
      serviceWorkers: 'block',
    });
    reader.setDefaultTimeout(90000);
    await reader.routeWebSocket(/127\.0\.0\.1/, (socket) => socket.close());
    reader.on('pageerror', (e) => errors.push(e.message));
    await reader.goto(`${origin}/`);
    await reader
      .getByRole('button', { name: 'Open a file - import a .lolly, design or image', exact: true })
      .waitFor({ state: 'attached' });
    const reopened = await reader.evaluate(async (bytes) => {
      const bridgePath = '/src/bridge/index.ts',
        packPath = '/src/lib/lolly-pack.ts',
        rowPath = '/src/pro/render-export.ts';
      const [{ createBridge }, { ingestLollyFile }, { renderRowToBlob }] = await Promise.all([
        import(bridgePath),
        import(packPath),
        import(rowPath),
      ]);
      const host = await createBridge();
      const imported = await ingestLollyFile(new Uint8Array(bytes), host);
      const result = await renderRowToBlob(
        { toolId: '3d-studio', values: imported.session },
        host,
        { format: 'png', width: 360, height: 360, watermark: false, embedMeta: false, c2pa: false }
      );
      return {
        imported: imported.imported,
        image: Array.from(new Uint8Array(await result.blob.arrayBuffer())),
      };
    }, packed.file);
    assert.equal(reopened.imported, 1);
    assert.deepEqual(reopened.image, packed.image);
    step('studio: portable file reopened');
    await page.evaluate(async () => {
      const bridgePath = '/src/bridge/index.ts';
      const { createBridge } = await import(bridgePath);
      const host = await createBridge();
      const values = await host.state.load('studio-test');
      await host.state.save('studio-test-two', { ...values, __label: 'Second view' });
    });
    await page.goto(`${origin}/multi?s=studio-test,studio-test-two`);
    await page.locator('[data-me-cell="0"]').press('Enter');
    await page.locator('#me-c0 [data-studio-state="ready"]').waitFor();
    const firstCanvas = page.locator('#me-c0 canvas');
    const box = (await firstCanvas.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 10);
    await page.mouse.up();
    await page.waitForFunction((azimuth) => {
      const marker = document.querySelector<HTMLElement>('#me-c0 [data-lolly-studio]');
      return marker && JSON.parse(marker.dataset.lollyStudio!).values.camera.azimuth !== azimuth;
    }, values.camera.azimuth);
    await page.locator('#me-c0 [data-studio-state="ready"]').waitFor();
    const changedCamera = await page
      .locator('#me-c0 [data-lolly-studio]')
      .evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.camera);
    assert.notEqual(changedCamera.azimuth, values.camera.azimuth);
    await page.locator('[data-me-cell="1"]').press('Enter');
    await page.locator('#me-c1 [data-studio-state="ready"]').waitFor();
    assert.equal(await firstCanvas.count(), 0);
    assert.equal(await page.locator('#me-c0 img.me-preview').count(), 1);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#me-c1 canvas').count(), 0);
    step('studio: live multi-edit cells and freeze passed');
    await page.goto(
      `${origin}/t/3d-studio?source=collection&samples=8&collectionSize.width=180&collectionSize.height=180&c2pa=0`
    );
    await page.locator('[data-studio-state="ready"]').waitFor();
    await page.evaluate(async () => {
      const path = '/src/bridge/index.ts';
      const { createBridge } = await import(path);
      const host = await createBridge();
      const saved = await host.state.load('studio-test');
      const el = document.querySelector('[data-lolly-canvas]') as any;
      el.__lollyCommit('subjects', [
        { name: 'Uploaded duck', kind: 'model', asset: saved.modelAsset.id },
        { name: 'Badge', kind: 'primitive', primitive: 'badge' },
        {
          name: 'Box',
          kind: 'primitive',
          primitive: 'box',
          ownFraming: true,
          azimuth: 45,
          elevation: 20,
          fov: 29,
          zoom: 1,
        },
      ]);
    });
    await page.waitForFunction(() =>
      document.querySelector('[data-studio-item-label]')?.textContent?.includes('Uploaded duck')
    );
    await page.locator('[data-studio-state="ready"]').waitFor();
    await page.getByRole('button', { name: 'Review collection', exact: true }).click();
    step('studio: collection review opened');
    const review = page.getByRole('dialog', { name: 'Review studio collection', exact: true });
    await review
      .locator('[data-studio-collection-status]')
      .filter({ hasText: '3 previews ready' })
      .waitFor();
    step('studio: collection preview ready');
    const firstShot = await review
      .locator('img')
      .first()
      .evaluate(async (img) =>
        Array.from(new Uint8Array(await (await fetch((img as HTMLImageElement).src)).arrayBuffer()))
      );
    await review.locator('[data-input-id="studio"]').selectOption('warm');
    step('studio: shared lighting changed');
    await review
      .locator('[data-studio-collection-status]')
      .filter({ hasText: '3 previews ready' })
      .waitFor();
    const changedShot = await review
      .locator('img')
      .first()
      .evaluate(async (img) =>
        Array.from(new Uint8Array(await (await fetch((img as HTMLImageElement).src)).arrayBuffer()))
      );
    assert.notDeepEqual(changedShot, firstShot);
    const collectionState = await page
      .locator('[data-lolly-canvas]')
      .evaluate((el: any) =>
        Object.fromEntries(el.__lollyModel().map((item: any) => [item.id, item.value]))
      );
    assert.equal(collectionState.studio, 'warm');
    assert.equal(collectionState.subjects[2].azimuth, 45);
    assert.equal(collectionState.subjects[2].ownFraming, true);
    const setDownload = page.waitForEvent('download');
    await review.getByRole('button', { name: 'Export PNG set', exact: true }).click();
    step('studio: collection export started');
    const set = await setDownload;
    const archive = unzipSync(await readFile((await set.path())!));
    const images = Object.keys(archive).filter((name) => name.endsWith('.png'));
    assert.equal(images.length, 3, images.join('\n'));
    for (const name of ['01-uploaded-duck.png', '02-badge.png', '03-box.png'])
      assert.ok(
        images.some((path) => path.endsWith(name)),
        images.join('\n')
      );
    await review.getByRole('button', { name: 'Edit Box', exact: true }).click();
    await page.locator('[data-studio-state="ready"]').waitFor();
    await page.getByRole('button', { name: 'Use shared framing', exact: true }).click();
    await page.waitForFunction(
      () =>
        !document.querySelector('[data-studio-item-label]')?.textContent?.includes('own framing')
    );
    step('studio: collection shared edits, named PNG set and framing reset passed');
    await pollPage(page, async () => {
      const path = '/src/lib/batch-job.ts';
      return !(await import(path)).isBatchRunActive();
    }, undefined, { message: 'the batch run to finish' });
    const collectionPack = await page.evaluate(
      async ({ values, collectionPath }) => {
        const bridgePath = '/src/bridge/index.ts',
          packPath = '/src/lib/lolly-pack.ts',
          renderPath = '/src/pro/render-export.ts';
        const [
          { createBridge },
          { buildLollyFile },
          { renderRowToBlob },
          { studioCollectionRows },
        ] = await Promise.all([
          import(bridgePath),
          import(packPath),
          import(renderPath),
          import(collectionPath),
        ]);
        const host = await createBridge();
        const file = await buildLollyFile({
          session: { ...values, __toolId: '3d-studio' },
          toolId: '3d-studio',
          userAssets: await host.assets._exportUserAssets(),
        });
        const rows = studioCollectionRows(values);
        const rendered = await renderRowToBlob(
          { toolId: '3d-studio', values: rows[0].values },
          host,
          {
            format: 'png',
            width: 180,
            height: 180,
            watermark: false,
            embedMeta: false,
            c2pa: false,
          }
        );
        return {
          file: Array.from(new Uint8Array(await file.blob.arrayBuffer())),
          image: Array.from(new Uint8Array(await rendered.blob.arrayBuffer())),
        };
      },
      { values: collectionState, collectionPath }
    );
    const collectionReader = await browser.newPage({ serviceWorkers: 'block' });
    await collectionReader.routeWebSocket(/127\.0\.0\.1/, (socket) => socket.close());
    collectionReader.on('pageerror', (e) => errors.push(e.message));
    await collectionReader.goto(`${origin}/`);
    await collectionReader
      .getByRole('button', { name: 'Open a file - import a .lolly, design or image', exact: true })
      .waitFor({ state: 'attached' });
    const restored = await collectionReader.evaluate(
      async ({ bytes, collectionPath }) => {
        const bridgePath = '/src/bridge/index.ts',
          packPath = '/src/lib/lolly-pack.ts',
          renderPath = '/src/pro/render-export.ts';
        const [
          { createBridge },
          { ingestLollyFile },
          { renderRowToBlob },
          { studioCollectionRows },
        ] = await Promise.all([
          import(bridgePath),
          import(packPath),
          import(renderPath),
          import(collectionPath),
        ]);
        const host = await createBridge();
        const restored = await ingestLollyFile(new Uint8Array(bytes), host);
        const rows = studioCollectionRows(restored.session);
        const image = await renderRowToBlob({ toolId: '3d-studio', values: rows[0].values }, host, {
          format: 'png',
          width: 180,
          height: 180,
          watermark: false,
          embedMeta: false,
          c2pa: false,
        });
        return {
          imported: restored.imported,
          count: rows.length,
          angle: rows[2].values.camera.azimuth,
          studio: rows[2].values.studio,
          image: Array.from(new Uint8Array(await image.blob.arrayBuffer())),
        };
      },
      { bytes: collectionPack.file, collectionPath }
    );
    assert.equal(restored.imported, 1);
    assert.equal(restored.count, 3);
    assert.equal(restored.angle, 45);
    assert.equal(restored.studio, 'warm');
    assert.deepEqual(restored.image, collectionPack.image);
    await collectionReader.close();
    step('studio: portable collection reopened with framing and a byte-identical model image');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('3D Studio arranges several objects: click selects, drags move, keys nudge, undo restores', {
  skip: !origin && 'Set STUDIO_SHELL_URL to a running web shell.',
  timeout: 600_000,
}, async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.STUDIO_NATIVE
      ? { executablePath: chromium.executablePath(), args: ['--use-angle=metal'] }
      : {}),
  });
  const errors: string[] = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1000 },
      serviceWorkers: 'block',
    });
    page.setDefaultTimeout(90000);
    await page.routeWebSocket(/127\.0\.0\.1/, (socket) => socket.close());
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(
      `${origin}/t/3d-studio?source=arrangement&samples=8&outputMode=object-shadow&c2pa=0&width=360&height=360`
    );
    await page.locator('[data-studio-state="ready"]').waitFor();
    const objects = () =>
      page
        .locator('[data-lolly-studio]')
        .evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.objects);
    const waitObjects = (check: string) =>
      page.waitForFunction((check) => {
        const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
        if (marker?.dataset.studioState !== 'ready') return false;
        const values = JSON.parse(marker.dataset.lollyStudio!).values;
        return new Function('objects', 'active', `return ${check}`)(values.objects, values.activeObject);
      }, check);
    const initial = await objects();
    assert.equal(initial.length, 3);
    assert.match(await page.locator('[data-studio-object-label]').textContent() ?? '', /1 of 3: Badge/);
    step('arrangement: three default objects mounted');

    // Adding several sources is one gesture: the Objects list takes a pile of files.
    // Each becomes a row whose kind follows the file, named after it and placed beside
    // the others; a sample-shape row shows no picker, an artwork row does.
    const list = page.locator('.blocks-input[data-input-id="objects"]');
    await list.locator('.blocks-drop-hint').waitFor({ state: 'attached' });
    assert.equal(await list.locator('[data-block-asset="objects:0:asset"]').count(), 0, 'a sample shape has no file');
    await list.locator('input[type="file"][multiple]').setInputFiles([
      { name: 'lock icon.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><path fill="#30ba78" d="M20 1a19 19 0 1 1 0 38a19 19 0 1 1 0-38M20 6a14 14 0 1 0 0 28a14 14 0 1 0 0-28"/><path fill="#0c322c" d="M21 8L11 24h7v9l12-17h-9z"/></svg>') },
      { name: 'duck.glb', mimeType: 'model/gltf-binary', buffer: await readFile('community/3d/assets/duck.glb') },
    ]);
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      const rows = marker && JSON.parse(marker.dataset.lollyStudio!).values.objects;
      return marker?.dataset.studioState === 'ready' && rows?.length === 5 && rows[4].kind === 'model' && rows[3].name === 'lock icon';
    });
    const added = await objects();
    assert.equal(added[3].kind, 'artwork');
    assert.equal(added[4].name, 'duck');
    assert.notEqual(added[3].x, added[4].x, 'dropped objects take different places');
    assert.equal(added[0].x, initial[0].x, 'typed positions stay put');
    assert.match(await page.locator('[data-studio-info]').textContent() ?? '', /5 of 5 objects visible/);
    assert.equal(await list.locator('[data-block-asset="objects:3:asset"]').count(), 1, 'an artwork row shows its file');
    step('arrangement: two dropped files became placed objects');
    await page.evaluate((rows) =>
      (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('objects', rows), initial);
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.objects.length === 3;
    });

    // Frame all fits the whole footprint; undo restores the saved camera.
    const camera = () =>
      page
        .locator('[data-lolly-studio]')
        .evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.camera);
    const before = await camera();
    await page.getByRole('button', { name: 'Frame all', exact: true }).click();
    await page.waitForFunction((camera) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        JSON.stringify(JSON.parse(marker.dataset.lollyStudio!).values.camera) !== JSON.stringify(camera)
      );
    }, before);
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction((camera) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        JSON.stringify(JSON.parse(marker.dataset.lollyStudio!).values.camera) === JSON.stringify(camera)
      );
    }, before);
    step('arrangement: frame all and undo passed');

    // The frame offers the library flow and a grouped toolbar; Orbit reads pressed at rest.
    assert.equal(await page.getByRole('button', { name: 'Add objects', exact: true }).count(), 1);
    assert.equal(await page.locator('[data-studio-orbit]').getAttribute('aria-pressed'), 'true');
    // A plain click on the sphere selects it while orbiting; a drag still orbits.
    const preview = page.locator('.lolly-studio-canvas');
    const box = (await preview.boundingBox())!;
    // The default sphere sits right of centre at the default camera.
    const hitSphere = { x: box.width * 0.68, y: box.height * 0.6 };
    await preview.click({ position: hitSphere });
    await waitObjects('active === 2');
    assert.match(await page.locator('[data-studio-object-label]').textContent() ?? '', /2 of 3: Sphere/);
    await page.evaluate(() =>
      (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('activeObject', 1)
    );
    await waitObjects('active === 1');
    step('arrangement: orbit click selected the sphere');
    // Move mode: a click on the sphere selects it; a drag on it moves it on the stage.
    await page.getByRole('button', { name: 'Move objects', exact: true }).click();
    assert.equal(await preview.getAttribute('data-move-object'), 'true');
    assert.equal(await page.locator('[data-studio-orbit]').getAttribute('aria-pressed'), 'false');
    await preview.click({ position: hitSphere });
    await waitObjects('active === 2');
    assert.match(await page.locator('[data-studio-object-label]').textContent() ?? '', /2 of 3: Sphere/);
    step('arrangement: click selected the sphere');
    const from = (await objects())[1];
    await page.mouse.move(box.x + hitSphere.x, box.y + hitSphere.y);
    await page.mouse.down();
    await page.mouse.move(box.x + hitSphere.x - 40, box.y + hitSphere.y - 10, { steps: 6 });
    await page.mouse.move(box.x + hitSphere.x - 80, box.y + hitSphere.y - 20, { steps: 6 });
    await page.mouse.up();
    await waitObjects(`objects[1].x !== ${JSON.stringify(from.x)}`);
    const dragged = (await objects())[1];
    assert.notEqual(dragged.x, from.x);
    assert.equal((await objects())[0].x, initial[0].x, 'the badge did not move');
    step('arrangement: drag moved the sphere');
    await page.keyboard.press('ControlOrMeta+z');
    await waitObjects(`objects[1].x === ${JSON.stringify(from.x)}`);
    step('arrangement: undo restored the sphere');

    // Keyboard: arrow nudges, comma turns, bracket selects; each is one undo step.
    await preview.focus();
    await preview.press('ArrowRight');
    await waitObjects(`Math.abs(objects[1].x - (${JSON.stringify(from.x)} + 0.1)) < 1e-6`);
    await preview.press('Shift+ArrowUp');
    await waitObjects(`Math.abs(objects[1].z - (${JSON.stringify(from.z ?? 0)} - 0.5)) < 1e-6`);
    await preview.press('.');
    await waitObjects('objects[1].rotY === 5');
    await preview.press(']');
    await waitObjects('active === 3');
    assert.match(await page.locator('[data-studio-object-label]').textContent() ?? '', /3 of 3: Box/);
    await page.keyboard.press('ControlOrMeta+z');
    await waitObjects('active === 2');
    await page.keyboard.press('ControlOrMeta+z');
    await waitObjects('!objects[1].rotY');
    step('arrangement: keyboard nudges, turn, select and undo passed');

    // Escape leaves move mode and the arrow keys orbit the camera again.
    await preview.press('Escape');
    assert.equal(await preview.getAttribute('data-move-object'), 'false');
    const orbitBefore = await camera();
    await preview.press('ArrowLeft');
    await page.waitForFunction((azimuth) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        JSON.parse(marker.dataset.lollyStudio!).values.camera.azimuth === azimuth - 2
      );
    }, Number(orbitBefore.azimuth));
    step('arrangement: escape returned to orbit');

    // A hidden object is reported and Fit selected frames only the selection.
    await page.evaluate(() =>
      (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('activeObject', 1)
    );
    await waitObjects('active === 1');
    const wide = await camera();
    await page.getByRole('button', { name: 'Fit selected', exact: true }).click();
    await page.waitForFunction((camera) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        JSON.stringify(JSON.parse(marker.dataset.lollyStudio!).values.camera) !== JSON.stringify(camera)
      );
    }, wide);
    assert.ok(Number((await camera()).zoom) > Number(wide.zoom), 'one object fits closer than the whole group');
    step('arrangement: fit selected passed');

    // Move lights: the arrow keys orbit the selected preset light and save its role
    // position; brackets change the selection; Escape returns to orbiting the camera.
    await page.getByRole('button', { name: 'Move lights', exact: true }).click();
    assert.equal(await preview.getAttribute('data-move-light'), 'true');
    assert.match(await page.locator('[data-studio-camera-note]').textContent() ?? '', /Key light selected/);
    const lightValue = (key: string) =>
      page.locator('[data-lolly-studio]').evaluate((el, key) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values[key], key);
    assert.deepEqual(await lightValue('keyPosition'), { x: -3.6, y: 6.8, z: 4 });
    await preview.focus();
    await preview.press('ArrowLeft');
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      const key = marker && JSON.parse(marker.dataset.lollyStudio!).values.keyPosition;
      return marker?.dataset.studioState === 'ready' && key && (key.x !== -3.6 || key.z !== 4);
    });
    const keyMoved = await lightValue('keyPosition');
    assert.ok(Math.hypot(keyMoved.x + 3.6, keyMoved.z - 4) > 0.2, JSON.stringify(keyMoved));
    assert.ok(Math.abs(keyMoved.y - 6.8) < 0.01, 'azimuth keys keep the height');
    await preview.press(']');
    assert.match(await page.locator('[data-studio-camera-note]').textContent() ?? '', /Fill light selected/);
    await preview.press('+');
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      const fill = marker && JSON.parse(marker.dataset.lollyStudio!).values.fillPosition;
      return marker?.dataset.studioState === 'ready' && fill && fill.x !== 5;
    });
    const fillMoved = await lightValue('fillPosition');
    assert.ok(Math.hypot(fillMoved.x, fillMoved.y - 1.5, fillMoved.z) > Math.hypot(5, 1.5, 4) + 0.3, JSON.stringify(fillMoved));
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      const fill = marker && JSON.parse(marker.dataset.lollyStudio!).values.fillPosition;
      return marker?.dataset.studioState === 'ready' && fill && fill.x === 5 && fill.y === 3 && fill.z === 4;
    });
    assert.deepEqual(await lightValue('keyPosition'), keyMoved, 'undo is one light at a time');
    await preview.press('Escape');
    assert.equal(await preview.getAttribute('data-move-light'), 'false');
    assert.equal(await page.locator('[data-studio-orbit]').getAttribute('aria-pressed'), 'true');
    // Switching modes and leaving them never touches the saved objects.
    assert.equal((await objects()).length, 3);
    step('arrangement: move lights passed');

    // Camera path: two keys captured from the live view make a move; Play path turns
    // the preview into a clip and undo takes the keys away again.
    const clipMs = () => page.locator('[data-lolly-studio]').evaluate((el) => (el as HTMLElement).dataset.clipMs);
    await page.getByRole('button', { name: 'Add camera key', exact: true }).click();
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.cameraKeys?.length === 1;
    });
    const beforeTurn = Number((await camera()).azimuth);
    await preview.focus();
    await preview.press('Shift+ArrowRight');
    await page.waitForFunction((azimuth) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.camera.azimuth === azimuth + 10;
    }, beforeTurn);
    await page.getByRole('button', { name: 'Add camera key', exact: true }).click();
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.cameraKeys?.length === 2;
    });
    const savedKeys = await page.locator('[data-lolly-studio]').evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.cameraKeys);
    assert.deepEqual(savedKeys.map((k: { at: number }) => k.at), [0, 100]);
    assert.equal(savedKeys[1].azimuth - savedKeys[0].azimuth, 10);
    assert.equal(await clipMs(), '0', 'keys alone do not make a clip');
    await page.getByRole('button', { name: 'Play path', exact: true }).click();
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-lolly-studio]')?.dataset.clipMs === '5000');
    assert.equal(await page.locator('[data-studio-play]').getAttribute('aria-pressed'), 'true');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-lolly-studio]')?.dataset.clipMs === '0');
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.cameraKeys?.length === 1;
    });
    step('arrangement: camera keys passed');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('3D Studio sets words in the brand font on the live shell, alone and inside an arrangement', {
  skip: !origin && 'Set STUDIO_SHELL_URL to a running web shell.',
  timeout: 600_000,
}, async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.STUDIO_NATIVE
      ? { executablePath: chromium.executablePath(), args: ['--use-angle=metal'] }
      : {}),
  });
  const errors: string[] = [];
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
    page.setDefaultTimeout(90000);
    await page.routeWebSocket(/127\.0\.0\.1/, (socket) => socket.close());
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/t/3d-studio?source=text&words=SUSE&wordWeight=800&samples=8&outputMode=object&c2pa=0&width=360&height=360`);
    await page.locator('[data-studio-state="ready"]').waitFor();
    const info = () => page.locator('[data-studio-info]').textContent();
    assert.match((await info()) ?? '', /1: paint:words/);
    step('words: the brand font shaped and extruded');
    // The frame is the real render: a solid glyph body and clear pixels around it.
    const alpha = await page.locator('.lolly-studio-canvas').evaluate((canvas) => {
      const c = canvas as HTMLCanvasElement;
      const copy = document.createElement('canvas');
      copy.width = c.width;
      copy.height = c.height;
      const ctx = copy.getContext('2d')!;
      ctx.drawImage(c, 0, 0);
      const px = ctx.getImageData(0, 0, copy.width, copy.height).data;
      let solid = 0, clear = 0;
      for (let i = 3; i < px.length; i += 4) { if (px[i] === 255) solid++; else if (px[i] === 0) clear++; }
      return { solid, clear };
    });
    assert.ok(alpha.solid > 1000 && alpha.clear > 1000, JSON.stringify(alpha));
    await page.evaluate(() => (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('words', 'Open\nSource'));
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.words === 'Open\nSource';
    });
    step('words: two lines re-shaped');
    await page.evaluate(() => (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('wordFont', 'display'));
    await page.locator('[data-studio-state="ready"]').waitFor();
    await page.evaluate(() => (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('source', 'arrangement'));
    await page.locator('[data-studio-state="ready"]').waitFor();
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-lolly-canvas]') as any;
      const rows = canvas.__lollyModel().find((i: { id: string }) => i.id === 'objects').value;
      canvas.__lollyCommit('objects', [...rows, { kind: 'text', text: 'Geeko', scale: 0.6 }]);
    });
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      const rows = marker && JSON.parse(marker.dataset.lollyStudio!).values.objects;
      return marker?.dataset.studioState === 'ready' && rows?.length === 4 && rows[3].name === 'Geeko';
    });
    assert.match((await info()) ?? '', /4 of 4 objects visible/);
    step('words: a text object joined the arrangement');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
