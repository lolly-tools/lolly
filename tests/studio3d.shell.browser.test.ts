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
    // The picker's own file input: the page holds a second input that also takes .glb.
    const upload = page.locator('.asset-picker-dialog input[type="file"][accept*=".glb"]');
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
    // The right arrow turns the camera as a drag to the right does: 5 degrees, saved
    // once the keys pause, so each pause is one undo step.
    await preview.press('ArrowRight');
    await waitCamera({ azimuth: Number(values.camera.azimuth) - 5 });
    assert.equal(await preview.evaluate(el => document.activeElement === el), true);
    await preview.press('ArrowRight');
    await waitCamera({ azimuth: Number(values.camera.azimuth) - 10 });
    await page.keyboard.press('ControlOrMeta+z');
    await waitCamera({ azimuth: Number(values.camera.azimuth) - 5 });
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

test('3D Studio arranges several objects: click selects, drags move with no mode, keys nudge, undo restores', {
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
    assert.match(await page.locator('[data-lolly-studio]').getAttribute('data-studio-notes') ?? '', /5 of 5 objects visible/);
    // The notes open from the Info control at the end of the bar, and Escape closes them.
    await page.getByRole('button', { name: 'Source notes', exact: true }).click();
    assert.match(await page.getByRole('dialog', { name: 'Source notes', exact: true }).locator('[data-studio-info]').textContent() ?? '', /5 of 5 objects visible/);
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog', { name: 'Source notes', exact: true }).count(), 0);
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

    // The frame offers the library flow; there is no Orbit or Move mode to choose.
    assert.equal(await page.getByRole('button', { name: 'Add objects', exact: true }).count(), 1);
    assert.equal(await page.locator('[data-studio-orbit], [data-studio-move]').count(), 0);
    const label = () => page.locator('[data-studio-object-label]').getAttribute('aria-label');
    const handles = page.locator('[data-studio-handles]');
    // A plain click on the sphere selects it and shows its handles.
    const preview = page.locator('.lolly-studio-canvas');
    const box = (await preview.boundingBox())!;
    // The default sphere sits right of centre at the default camera.
    const hitSphere = { x: box.width * 0.68, y: box.height * 0.6 };
    assert.equal(await handles.evaluate((el) => (el as HTMLElement).hidden), true, 'nothing selected at first');
    await preview.click({ position: hitSphere });
    await waitObjects('active === 2');
    assert.match((await label()) ?? '', /2 of 3: Sphere/);
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === false);
    assert.equal(await page.locator('.stage-kit-handle[data-studio-handle="turn"]').isVisible(), true);
    // The click was a pointer press: the canvas has the keys but shows no focus ring.
    assert.equal(await preview.evaluate((el) => document.activeElement === el && !el.matches(':focus-visible')), true);
    step('arrangement: a click selected the sphere and showed its handles');
    // A drag that starts on an object moves it with no mode, selecting it first: one step.
    await page.evaluate(() =>
      (document.querySelector('[data-lolly-canvas]') as any).__lollyCommit('activeObject', 1)
    );
    await waitObjects('active === 1');
    const from = (await objects())[1];
    await page.mouse.move(box.x + hitSphere.x, box.y + hitSphere.y);
    await page.mouse.down();
    await page.mouse.move(box.x + hitSphere.x - 40, box.y + hitSphere.y - 10, { steps: 6 });
    await page.mouse.move(box.x + hitSphere.x - 80, box.y + hitSphere.y - 20, { steps: 6 });
    await page.mouse.up();
    await waitObjects(`objects[1].x !== ${JSON.stringify(from.x)} && active === 2`);
    const dragged = (await objects())[1];
    assert.notEqual(dragged.x, from.x);
    assert.equal(dragged.y, from.y, 'a move along the floor writes no height');
    assert.equal((await objects())[0].x, initial[0].x, 'the badge did not move');
    step('arrangement: a drag selected and moved the sphere');
    await page.keyboard.press('ControlOrMeta+z');
    await waitObjects(`objects[1].x === ${JSON.stringify(from.x)} && active === 1`);
    step('arrangement: one undo put back the move and the selection');
    await page.keyboard.press('ControlOrMeta+Shift+z');
    await waitObjects('active === 2');

    // Keyboard: with the sphere selected the arrows nudge it, the full stop turns it and
    // a bracket selects the next object; each is one undo step.
    await preview.focus();
    const at = (await objects())[1];
    await preview.press('ArrowRight');
    await waitObjects(`Math.abs(objects[1].x - (${JSON.stringify(at.x)} + 0.1)) < 1e-6`);
    await preview.press('Shift+ArrowUp');
    await waitObjects(`Math.abs(objects[1].z - (${JSON.stringify(at.z ?? 0)} - 0.5)) < 1e-6`);
    await preview.press('.');
    await waitObjects('objects[1].rotY === 5');
    await preview.press(']');
    await waitObjects('active === 3');
    assert.match((await label()) ?? '', /3 of 3: Box/);
    await page.keyboard.press('ControlOrMeta+z');
    await waitObjects('active === 2');
    await page.keyboard.press('ControlOrMeta+z');
    await waitObjects('!objects[1].rotY');
    step('arrangement: keyboard nudges, turn, select and undo passed');

    // Escape clears the selection, and the arrow keys orbit the camera again; the left
    // arrow turns it as a drag to the left does.
    await preview.press('Escape');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === true);
    assert.match(await page.locator('[data-stage-status]').textContent() ?? '', /Click an object or press Enter to select it/);
    const orbitBefore = await camera();
    await preview.press('ArrowLeft');
    await page.waitForFunction((azimuth) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return (
        marker?.dataset.studioState === 'ready' &&
        // A saved view is rounded to two places, and the view before the key may be an
        // unrounded one from an earlier drag, so the step is checked within a hundredth.
        Math.abs(JSON.parse(marker.dataset.lollyStudio!).values.camera.azimuth - (azimuth + 5)) < 0.01
      );
    }, Number(orbitBefore.azimuth));
    step('arrangement: escape cleared the selection and the arrows orbit');

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
    assert.match(await page.locator('[data-stage-status]').textContent() ?? '', /Key light selected/);
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
    assert.match(await page.locator('[data-stage-status]').textContent() ?? '', /Fill light selected/);
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
    assert.equal(await page.locator('[data-studio-lights]').getAttribute('aria-pressed'), 'false');
    // Switching modes and leaving them never touches the saved objects.
    assert.equal((await objects()).length, 3);
    step('arrangement: move lights passed');

    // Camera path: two keys captured from the live view make a move; Play path turns
    // the preview into a clip and undo takes the keys away again.
    const clipMs = () => page.locator('[data-lolly-studio]').evaluate((el) => (el as HTMLElement).dataset.clipMs);
    await page.getByRole('button', { name: 'Add key', exact: true }).click();
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.cameraKeys?.length === 1;
    });
    const beforeTurn = Number((await camera()).azimuth);
    await preview.focus();
    await preview.press('Shift+ArrowRight');
    await page.waitForFunction((azimuth) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.camera.azimuth === azimuth - 15;
    }, beforeTurn);
    await page.getByRole('button', { name: 'Add key', exact: true }).click();
    await page.waitForFunction(() => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.cameraKeys?.length === 2;
    });
    const savedKeys = await page.locator('[data-lolly-studio]').evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.cameraKeys);
    assert.deepEqual(savedKeys.map((k: { at: number }) => k.at), [0, 100]);
    assert.equal(savedKeys[1].azimuth - savedKeys[0].azimuth, -15);
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

test('3D Studio handles on the selected object: the ring turns in 15 degree steps, the squares lift and scale, one undo step each', {
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
    await page.goto(`${origin}/t/3d-studio?source=arrangement&samples=8&c2pa=0&width=360&height=360`);
    await page.locator('[data-studio-state="ready"]').waitFor();
    const values = () =>
      page.locator('[data-lolly-studio]').evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values);
    const waitValues = (check: string) =>
      page.waitForFunction((check) => {
        const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
        if (marker?.dataset.studioState !== 'ready') return false;
        const v = JSON.parse(marker.dataset.lollyStudio!).values;
        return new Function('objects', 'v', `return ${check}`)(v.objects, v);
      }, check);
    const undo = () => page.keyboard.press('ControlOrMeta+z');
    const chip = page.locator('[data-studio-chip]');
    const centre = async (kind: string) => {
      const b = (await page.locator(`.stage-kit-handle[data-studio-handle="${kind}"]`).boundingBox())!;
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    };
    /** Press a handle, drag it through two points, read the chip, and leave the button down. */
    const grab = async (kind: string, path: Array<[number, number]>) => {
      const at = await centre(kind);
      await page.mouse.move(at.x, at.y);
      await page.mouse.down();
      for (const [dx, dy] of path) await page.mouse.move(at.x + dx, at.y + dy, { steps: 4 });
      return (await chip.textContent()) ?? '';
    };

    const preview = page.locator('.lolly-studio-canvas');
    const box = (await preview.boundingBox())!;
    await preview.click({ position: { x: box.width * 0.68, y: box.height * 0.6 } });
    await waitValues('v.activeObject === 2');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === false);
    // The handles sit on the stage at screen size, beside the picture, out of the artwork.
    const layer = await page.evaluate(() => {
      const el = document.querySelector('[data-studio-handles]')!.parentElement!;
      return {
        kit: el.classList.contains('stage-kit-layer'),
        inCanvas: document.querySelector('#tool-canvas')!.contains(el),
        hidden: el.hasAttribute('data-export-hide') && el.hasAttribute('data-live-hide'),
        ring: !!document.querySelector('[data-studio-ring]')?.getAttribute('d'),
      };
    });
    assert.deepEqual(layer, { kit: true, inCanvas: false, hidden: true, ring: true });
    step('handles: the selected sphere shows its ring and squares');

    // Turn: the knob drags round the ring, the chip reads the turn, and it snaps to 15.
    const turnText = await grab('turn', [[30, -4], [60, -12]]);
    assert.match(turnText, /^Turn -?\d+°$/);
    const shown = Number(/-?\d+/.exec(turnText)![0]);
    assert.equal(shown % 15, 0, `snapped to 15 degrees: ${turnText}`);
    assert.notEqual(shown, 0, 'the drag turned the sphere');
    await page.mouse.up();
    await waitValues(`objects[1].rotY === ${shown}`);
    assert.equal(await chip.isVisible(), false, 'the chip goes on release');
    await undo();
    await waitValues('!objects[1].rotY');
    step('handles: the ring turned the sphere in a 15 degree step, one undo step');

    // Lift: the top square raises the sphere, and a drag down past the stage rests it there.
    const liftText = await grab('lift', [[0, -25], [0, -50]]);
    assert.match(liftText, /^Lift \d+\.\d\d$/);
    await page.mouse.up();
    await waitValues('objects[1].y > 0.05');
    const lifted = (await values()).objects[1].y;
    await grab('lift', [[0, 100], [0, 200]]);
    assert.equal(await chip.textContent(), 'Lift 0.00');
    await page.mouse.up();
    await waitValues('objects[1].y === 0');
    await undo();
    await waitValues(`objects[1].y === ${lifted}`);
    await undo();
    await waitValues('!objects[1].y');
    step('handles: the top square lifted the sphere and rested it on the stage, one step each');

    // Scale: the corner square scales the sphere from the ring's centre.
    const before = (await values()).objects[1].scale;
    const scaleText = await grab('scale', [[20, -20], [40, -40]]);
    assert.match(scaleText, /^Scale \d+ %$/);
    await page.mouse.up();
    await waitValues(`objects[1].scale > ${before}`);
    assert.equal(Math.round((await values()).objects[1].scale * 100), Number(/\d+/.exec(scaleText)![0]));
    await undo();
    await waitValues(`objects[1].scale === ${before}`);
    step('handles: the corner square scaled the sphere, one undo step');

    // Duplicate adds a selected copy beside the sphere, and Delete takes an object out;
    // each is one undo step.
    await page.getByRole('button', { name: 'Duplicate', exact: true }).click();
    await waitValues('objects.length === 4 && v.activeObject === 4');
    assert.equal((await values()).objects[3].name, 'Sphere copy');
    await undo();
    await waitValues('objects.length === 3 && v.activeObject === 2');
    await preview.focus();
    await preview.press('Delete');
    await waitValues('objects.length === 2 && objects.every((row) => row.name !== "Sphere")');
    await undo();
    await waitValues('objects.length === 3 && objects[1].name === "Sphere"');
    await preview.click({ position: { x: box.width * 0.68, y: box.height * 0.6 } });
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === false);
    step('handles: Duplicate and Delete, one undo step each');

    // Tilt keeps the ring as the outline and puts the other handles away until it ends.
    const knobShown = () => page.locator('.stage-kit-handle[data-studio-handle="turn"]').isVisible();
    await page.getByRole('button', { name: 'Tilt', exact: true }).click();
    assert.equal(await preview.getAttribute('data-tilt-object'), 'true');
    assert.equal(await knobShown(), false);
    assert.equal(await page.locator('[data-studio-ring]').isVisible(), true);
    await preview.press('Escape');
    assert.equal(await preview.getAttribute('data-tilt-object'), 'false');
    assert.equal(await knobShown(), true);
    step('handles: Tilt shows the ring alone');

    // Escape in the middle of a drag puts the object back and saves nothing.
    await grab('scale', [[20, -20], [40, -40]]);
    await page.keyboard.press('Escape');
    await page.mouse.up();
    assert.equal(await chip.isVisible(), false);
    await page.waitForTimeout(400);
    assert.equal((await values()).objects[1].scale, before, 'a cancelled drag saves nothing');
    // A second Escape clears the selection, and a mode hides the handles too.
    await preview.press('Escape');
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === true);
    step('handles: Escape cancelled a drag, then cleared the selection');

    // A lone subject gets the same handles, through its own position input.
    await page.goto(`${origin}/t/3d-studio?source=primitive&primitive=sphere&samples=8&c2pa=0&width=360&height=360`);
    await page.locator('[data-studio-state="ready"]').waitFor();
    const lone = (await values()).position;
    const subject = (await preview.boundingBox())!;
    await preview.click({ position: { x: subject.width / 2, y: subject.height * 0.55 } });
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === false);
    assert.equal(await page.locator('[data-studio-duplicate]:not([hidden])').count(), 0, 'a lone subject has no copy to make');
    await grab('lift', [[0, -25], [0, -50]]);
    await page.mouse.up();
    await waitValues(`v.position.y > ${lone.y}`);
    assert.equal((await values()).position.x, lone.x, 'a lift keeps the place on the floor');
    await undo();
    await waitValues(`v.position.y === ${lone.y}`);
    step('handles: a lone subject lifted through its position, one undo step');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('3D Studio keeps the object in reach: actions by the selection, Enter to select, a zoom kept through a drag, and a motion that hides the handles', {
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
    const values = () =>
      page.locator('#tool-canvas [data-lolly-studio]').evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values);
    const waitValues = (check: string) =>
      page.waitForFunction((check) => {
        const marker = document.querySelector<HTMLElement>('#tool-canvas [data-lolly-studio]');
        if (marker?.dataset.studioState !== 'ready') return false;
        const v = JSON.parse(marker.dataset.lollyStudio!).values;
        return new Function('objects', 'v', `return ${check}`)(v.objects, v);
      }, check);
    const handlesShown = (shown: boolean) =>
      page.waitForFunction((shown) => (document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === false) === shown, shown);
    const preview = page.locator('#tool-canvas .lolly-studio-canvas');
    const float = page.locator('.stage-kit-float');

    await page.goto(`${origin}/t/3d-studio?source=arrangement&samples=8&c2pa=0&width=360&height=360`);
    await page.locator('#tool-canvas [data-studio-state="ready"]').waitFor();
    const box = (await preview.boundingBox())!;
    await preview.click({ position: { x: box.width * 0.68, y: box.height * 0.6 } });
    await waitValues('v.activeObject === 2');
    await handlesShown(true);

    // The object's actions stand by the selection, under the ring, and not in the bar.
    await float.waitFor({ state: 'visible' });
    const placed = await page.evaluate(() => {
      const host = document.querySelector<HTMLElement>('.stage-kit-float')!;
      const ring = document.querySelector('[data-studio-ring]')!.getBoundingClientRect();
      const at = host.getBoundingClientRect();
      const stage = document.querySelector('#tool-stage')!.getBoundingClientRect();
      return {
        names: [...host.querySelectorAll('button:not([hidden])')].map((b) => b.getAttribute('aria-label')),
        inBar: !!document.querySelector('.stage-kit-bar [data-studio-duplicate]'),
        hiddenFromReaders: !!host.closest('[aria-hidden="true"]'),
        underRing: at.top >= ring.bottom,
        centred: Math.abs((at.left + at.right) / 2 - (ring.left + ring.right) / 2) < 12,
        onStage: at.left >= stage.left && at.right <= stage.right && at.bottom <= stage.bottom,
      };
    });
    assert.deepEqual(placed, {
      names: ['Duplicate', 'Remove', 'Rest on the stage', 'Tilt'],
      inBar: false, hiddenFromReaders: false, underRing: true, centred: true, onStage: true,
    });
    step('reach: the object bar stands under the ring');

    // A wheel zoom waits 400 ms for a pause before it saves. A handle drag that starts
    // in that time used to be ended by the save's repaint; now both are kept.
    const zoom0 = Number((await values())['camera.zoom'] ?? (await values()).camera?.zoom ?? 1);
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
    await page.mouse.wheel(0, -240);
    const knob = (await page.locator('.stage-kit-handle[data-studio-handle="turn"]').boundingBox())!;
    await page.mouse.move(knob.x + knob.width / 2, knob.y + knob.height / 2);
    await page.mouse.down();
    await page.mouse.move(knob.x + 40, knob.y - 6, { steps: 4 });
    await page.mouse.move(knob.x + 70, knob.y - 14, { steps: 4 });
    await page.mouse.up();
    await waitValues('!!objects[1].rotY');
    const after = await values();
    const zoom1 = Number(after['camera.zoom'] ?? after.camera?.zoom ?? 1);
    assert.notEqual(zoom1, zoom0, 'the zoom that waited through the drag is saved');
    assert.equal(Number(after.objects[1].rotY) % 15, 0, 'and the drag turned the object');
    await page.keyboard.press('ControlOrMeta+z');
    await waitValues('!objects[1].rotY');
    assert.equal(Number((await values())['camera.zoom'] ?? (await values()).camera?.zoom ?? 1), zoom1, 'the turn is its own undo step');
    step('reach: a zoom just before a handle drag is kept');

    // Escape clears the selection; Enter selects again from the keyboard.
    await preview.focus();
    await page.keyboard.press('Escape');
    await handlesShown(false);
    assert.equal(await float.isVisible(), false, 'no selection, no object bar');
    await page.keyboard.press('Enter');
    await handlesShown(true);
    await float.waitFor({ state: 'visible' });
    step('reach: Enter selects');

    // A lone subject has no list to choose from, so Enter is its only keyboard way in.
    await page.goto(`${origin}/t/3d-studio?samples=8&c2pa=0&width=360&height=360`);
    await page.locator('#tool-canvas [data-studio-state="ready"]').waitFor();
    await preview.focus();
    await page.keyboard.press('Enter');
    await handlesShown(true);
    await float.waitFor({ state: 'visible' });
    assert.deepEqual(
      await float.locator('button:not([hidden])').evaluateAll((els) => els.map((b) => b.getAttribute('aria-label'))),
      ['Rest on the stage', 'Tilt']
    );
    step('reach: a lone subject is selected by Enter');

    // A turntable moves the object off its rest place, where the handles would stand.
    await page.goto(`${origin}/t/3d-studio?source=arrangement&motion=turntable&samples=8&c2pa=0&width=360&height=360`);
    await page.locator('#tool-canvas [data-studio-state="ready"]').waitFor();
    const moving = (await preview.boundingBox())!;
    await preview.focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => /Motion is Still image/.test(document.querySelector('[data-stage-status]')?.textContent ?? ''));
    await handlesShown(false);
    await float.waitFor({ state: 'visible' });
    const foot = (await float.boundingBox())!;
    assert.ok(foot.y + foot.height <= moving.y + moving.height && foot.y > moving.y + moving.height / 2, 'the actions stand at the foot of the picture');
    step('reach: a motion hides the handles and keeps the actions');

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
    const info = () => page.locator('[data-lolly-studio]').getAttribute('data-studio-notes');
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

test('3D Studio moves its camera on the canvas: wrap, keys, wheel, pan, frame and views, one undo step each', {
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
    await page.goto(`${origin}/t/3d-studio?source=arrangement&samples=8&c2pa=0&width=360&height=360`);
    await page.locator('[data-studio-state="ready"]').waitFor();
    type Camera = Record<string, number>;
    const camera = (): Promise<Camera> =>
      page.locator('[data-lolly-studio]').evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.camera);
    const waitCamera = (check: string) =>
      page.waitForFunction((check) => {
        const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
        if (marker?.dataset.studioState !== 'ready') return false;
        return new Function('camera', `return ${check}`)(JSON.parse(marker.dataset.lollyStudio!).values.camera);
      }, check);
    const undo = () => page.keyboard.press('ControlOrMeta+z');

    // The controls sit on the stage beside the picture, not in the artwork.
    const layout = await page.evaluate(() => {
      const kit = document.querySelector<HTMLElement>('.stage-kit')!;
      const canvas = document.querySelector<HTMLElement>('#tool-canvas')!;
      const bar = kit.querySelector('.stage-kit-bar')!.getBoundingClientRect();
      const art = canvas.getBoundingClientRect();
      return {
        inStage: kit.parentElement?.classList.contains('tool-stage'),
        inCanvas: canvas.contains(kit),
        hidden: kit.hasAttribute('data-export-hide') && kit.hasAttribute('data-live-hide'),
        clear: bar.bottom <= art.top,
        owned: document.querySelector('.lolly-studio-canvas')!.getAttribute('data-stage-gestures'),
      };
    });
    assert.deepEqual(layout, { inStage: true, inCanvas: false, hidden: true, clear: true, owned: 'own' });
    step('navigation: the bar is beside the picture');

    // The orbit wraps past the seam: a drag to the left of 100 px turns 30 degrees.
    await page.evaluate(() => {
      const canvas = document.querySelector('[data-lolly-canvas]') as any;
      const value = canvas.__lollyModel().find((i: { id: string }) => i.id === 'camera').value;
      canvas.__lollyCommit('camera', { ...value, azimuth: 170 });
    });
    await waitCamera('camera.azimuth === 170');
    const preview = page.locator('.lolly-studio-canvas');
    const box = (await preview.boundingBox())!;
    // Empty floor near the top left, so the press selects nothing.
    const empty = { x: box.x + box.width * 0.15, y: box.y + box.height * 0.15 };
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down();
    await page.mouse.move(empty.x - 50, empty.y, { steps: 5 });
    await page.mouse.move(empty.x - 100, empty.y, { steps: 5 });
    await page.mouse.up();
    await waitCamera('Math.abs(camera.azimuth + 160) < 0.01');
    await undo();
    await waitCamera('camera.azimuth === 170');
    step('navigation: the orbit wraps and is one undo step');

    // The left arrow turns the way a drag to the left does.
    await preview.focus();
    await preview.press('ArrowLeft');
    await waitCamera('camera.azimuth === 175');
    await preview.press('Shift+ArrowLeft');
    await waitCamera('camera.azimuth === -170');
    await undo();
    await waitCamera('camera.azimuth === 175');
    await undo();
    await waitCamera('camera.azimuth === 170');
    step('navigation: arrow keys follow the drag and wrap');

    // A plain wheel zooms the camera, not the stage, and a burst is one undo step.
    const before = await camera();
    // One burst of wheel events, sent in one task so a slow software GPU cannot space them
    // past the pause that ends a burst.
    await preview.evaluate((canvas, at) => {
      for (let i = 0; i < 4; i++)
        canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -60, clientX: at.x, clientY: at.y, bubbles: true, cancelable: true }));
    }, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
    await waitCamera(`camera.zoom > ${before.zoom}`);
    assert.equal(await page.locator('#tool-canvas-outer').evaluate((el) => (el as HTMLElement).style.transform), '', 'the stage did not zoom');
    await undo();
    await waitCamera(`camera.zoom === ${before.zoom}`);
    step('navigation: the wheel zooms the camera in one step');

    // Shift-drag pans the target in the view plane, saved through the pan inputs.
    await page.keyboard.down('Shift');
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down();
    await page.mouse.move(empty.x + 60, empty.y + 30, { steps: 6 });
    await page.mouse.up();
    await page.keyboard.up('Shift');
    await waitCamera('Math.abs(camera.panX) + Math.abs(camera.panY) + Math.abs(camera.panZ) > 0.05');
    await undo();
    await waitCamera('!camera.panX && !camera.panY && !camera.panZ');
    // A middle-button drag pans too.
    await page.mouse.move(empty.x, empty.y);
    await page.mouse.down({ button: 'middle' });
    await page.mouse.move(empty.x - 40, empty.y + 20, { steps: 6 });
    await page.mouse.up({ button: 'middle' });
    await waitCamera('Math.abs(camera.panX) + Math.abs(camera.panY) + Math.abs(camera.panZ) > 0.05');
    assert.equal(await page.locator('#tool-canvas-outer').evaluate((el) => (el as HTMLElement).style.transform), '', 'the stage did not pan');
    step('navigation: Shift-drag and a middle drag pan the camera');

    // 0 puts the camera back; the stage's own 0 (fit the view) never hears the key.
    await preview.focus();
    await preview.press('0');
    await waitCamera('camera.azimuth === 25 && camera.elevation === 14 && camera.zoom === 1 && !camera.panX && !camera.panY && !camera.panZ');
    step('navigation: 0 resets the camera');

    // A double-click on empty space frames everything.
    const rest = await camera();
    await page.mouse.dblclick(empty.x, empty.y);
    await waitCamera(`camera.zoom !== ${rest.zoom}`);
    step('navigation: double-click frames');

    // The View menu: Front sets the angle in one step.
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitemradio', { name: 'Front', exact: true }).click();
    await waitCamera('camera.azimuth === 0 && camera.elevation === 0');
    const framed = await camera();
    await undo();
    await waitCamera(`camera.azimuth === ${rest.azimuth} && camera.elevation === ${rest.elevation}`);
    assert.notEqual(framed.zoom, undefined);
    step('navigation: View presets');

    // Ctrl or Cmd with the wheel stays the stage's zoom.
    const held = await camera();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -120);
    await page.keyboard.up('Control');
    await page.waitForFunction(() => /scale/.test((document.querySelector('#tool-canvas-outer') as HTMLElement).style.transform));
    await page.waitForTimeout(600);
    assert.equal((await camera()).zoom, held.zoom, 'the camera did not zoom');
    step('navigation: Ctrl with the wheel zooms the stage');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});

test('3D Studio on a phone: a pinch zooms the camera, two fingers pan, and the bar stays on screen', {
  skip: !origin && 'Set STUDIO_SHELL_URL to a running web shell.',
  timeout: 600_000,
}, async () => {
  const browser = await chromium.launch({ headless: true });
  const errors: string[] = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
    const page = await context.newPage();
    page.setDefaultTimeout(90000);
    await page.routeWebSocket(/127\.0\.0\.1/, (socket) => socket.close());
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(`${origin}/t/3d-studio?source=primitive&primitive=sphere&samples=8&c2pa=0&width=360&height=360`);
    await page.locator('[data-studio-state="ready"]').waitFor();
    const camera = (): Promise<Record<string, number>> =>
      page.locator('[data-lolly-studio]').evaluate((el) => JSON.parse((el as HTMLElement).dataset.lollyStudio!).values.camera);
    const before = await camera();
    const box = (await page.locator('.lolly-studio-canvas').boundingBox())!;
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    const cdp = await context.newCDPSession(page);
    const touch = (type: 'touchStart' | 'touchMove' | 'touchEnd', points: Array<[number, number]>) =>
      cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map(([x, y], id) => ({ x, y, id })) });
    await touch('touchStart', [[cx - 20, cy], [cx + 20, cy]]);
    for (let i = 1; i <= 8; i++) await touch('touchMove', [[cx - 20 - i * 6, cy + i * 2], [cx + 20 + i * 6, cy + i * 2]]);
    await touch('touchEnd', []);
    await page.waitForFunction((zoom) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.camera.zoom > zoom;
    }, Number(before.zoom));
    const after = await camera();
    assert.ok(Math.abs(after.panY ?? 0) + Math.abs(after.panX ?? 0) + Math.abs(after.panZ ?? 0) > 0, 'the moving midpoint panned');
    const state = await page.evaluate(() => {
      const bar = document.querySelector('.stage-kit-bar')!.getBoundingClientRect();
      const pill = document.querySelector('.render-pill')!.getBoundingClientRect();
      return {
        stage: (document.querySelector('#tool-canvas-outer') as HTMLElement).style.transform,
        onScreen: bar.top >= 0 && bar.bottom <= innerHeight && bar.left >= 0 && bar.right <= innerWidth,
        clearOfPill: bar.bottom <= pill.top,
      };
    });
    assert.deepEqual(state, { stage: '', onScreen: true, clearOfPill: true });
    await page.keyboard.press('ControlOrMeta+z');
    await page.waitForFunction((zoom) => {
      const marker = document.querySelector<HTMLElement>('[data-lolly-studio]');
      return marker?.dataset.studioState === 'ready' && JSON.parse(marker.dataset.lollyStudio!).values.camera.zoom === zoom;
    }, Number(before.zoom));
    step('phone: pinch zoomed the camera in one step and the bar stayed on screen');
    // A tap on the subject selects it; the handles take their touch sizes and the status
    // line its touch wording.
    await touch('touchStart', [[cx, cy]]);
    await touch('touchEnd', []);
    await page.waitForFunction(() => document.querySelector<HTMLElement>('[data-studio-handles]')?.hidden === false);
    const sizes = await page.evaluate(() =>
      ['turn', 'lift', 'scale'].map((kind) => document.querySelector(`.stage-kit-handle[data-studio-handle="${kind}"]`)!.getBoundingClientRect().width)
    );
    assert.deepEqual(sizes, [18, 16, 16]);
    assert.match(await page.locator('[data-stage-status]').textContent() ?? '', /^Drag to move\./);
    step('phone: a tap selected the subject and the handles took their touch sizes');
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
