// SPDX-License-Identifier: MPL-2.0
/** Photo preset import through the mounted Darkroom shell, including URL state. */
import assert from 'node:assert/strict';
import test from 'node:test';
import { chromium } from 'playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { readIdmlSpreads } from '../engine/src/idml-read.ts';
import { readCameraRawPreset } from '../engine/src/camera-raw-preset.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { serializeUrlState, parseUrlState } from '../engine/src/url-mode.ts';
import { expandQuery } from '../engine/src/url-pack.ts';
import { groupedIdmlParts } from './fixtures/adobe/grouped-layout.ts';
import { baseHost } from './helpers/host.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_EXPORT_TEST_URL;
test('Adobe preset import reaches Darkroom controls and URL', { skip: origin ? false : 'no browser origin (set LOLLY_EXPORT_TEST_URL to a local web shell)', timeout: 90000 }, async () => {
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block' });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(new URL('/t/darkroom', origin!).href, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.getByRole('button', { name: 'Import Adobe photo preset', exact: true }).waitFor();
    await page.getByText('Blank canvas', { exact: true }).click();
    const input = page.locator('input[accept=".xmp,.lrtemplate"]');
    await input.setInputFiles(new URL('./fixtures/adobe/preset.xmp', import.meta.url).pathname);
    await page.waitForFunction(() => {
      const params = new URLSearchParams(location.search);
      return params.get('exposure') === '0.75' && params.get('contrast') === '12' && params.get('saturation') === '80' && params.get('highlights') === '-35';
    });
    const notes = page.locator('#tool-sidebar p').filter({ hasText: 'Unmapped settings: Temperature, CameraProfile.' });
    assert.equal(await notes.isVisible(), true);
    await input.setInputFiles(new URL('./fixtures/adobe/preset.xmp', import.meta.url).pathname);
    await page.waitForFunction(() => Array.from(document.querySelectorAll<HTMLButtonElement>('#tool-sidebar button')).some(button => button.textContent === 'Import Adobe photo preset' && !button.disabled));
    assert.equal(new URL(page.url()).searchParams.get('exposure'), '0.75');
    await input.setInputFiles({ name: 'legacy.lrtemplate', mimeType: 'text/plain', buffer: Buffer.from('s = { Exposure2012 = 1 }') });
    await page.locator('#tool-sidebar p').filter({ hasText: 'Lua is never executed.' }).waitFor();
    assert.equal(new URL(page.url()).searchParams.get('exposure'), '0.75');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Adobe layout loop preset reaches the canvas and a finished video', { skip: origin ? false : 'no browser origin (set LOLLY_EXPORT_TEST_URL to a local web shell)', timeout: 180000 }, async () => {
  const dom = new JSDOM('');
  const [layout] = await readIdmlSpreads(groupedIdmlParts(), source => new dom.window.DOMParser().parseFromString(source, 'application/xml'));
  const design = await loadTool('design', path => readFile(new URL(`../community/${path}`, import.meta.url), 'utf8'));
  const photoPreset = readCameraRawPreset(await readFile(new URL('./fixtures/adobe/preset.xmp', import.meta.url), 'utf8'), source => new dom.window.DOMParser().parseFromString(source, 'application/xml'));
  const runtime = await createRuntime(design, baseHost(), { boxes: layout!.boxes as InputValue });
  const query = serializeUrlState(runtime.getModel()); runtime.destroy();
  const browser = await chromium.launch({ args: ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader'] });
  try {
    const page = await browser.newPage({ serviceWorkers: 'block', viewport: { width: 1280, height: 900 } });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const ids = layout!.boxes.map(box => String((box as { id: string }).id));
    await page.goto(new URL(`/t/design?${query}&width=640&height=360&_sel=${encodeURIComponent(ids.join(','))}`, origin!).href, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.locator(`.lolly-box[data-box-id="${ids[1]}"]`).click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Choreograph…', exact: true }).click();
    const preset = page.locator('[data-choreo-quick="drift-loop"]');
    try { await preset.waitFor({ timeout: 15000 }); }
    catch (error) {
      await mkdir('plans/artifacts/297', { recursive: true });
      await page.screenshot({ path: 'plans/artifacts/297/layout-loop-failure.png' });
      throw new Error(`${String(error)}\n${await page.locator('body').innerText()}\n${errors.join('\n')}`);
    }
    await preset.click();
    await page.locator('.fc-choreo-panel').waitFor({ state: 'detached' });
    await page.waitForFunction(() => document.querySelectorAll('[data-t-kf]').length >= 3);
    await page.locator('.tl-panel').waitFor({ timeout: 15000 });
    const state = parseUrlState(await expandQuery(new URL(page.url()).searchParams.toString()), design.manifest);
    const rows = state.values.boxes as Record<string, InputValue>[];
    assert.equal(rows.length, 3); assert.ok(rows.every(box => String(box.kf).includes('t6000')));
    assert.equal(rows[0]!.kf, rows[1]!.kf, 'imported group shares a track');
    const output = process.env.LOLLY_ADOBE_TEST_OUTPUT ?? 'plans/artifacts/297';
    await mkdir(output, { recursive: true });
    await page.screenshot({ path: `${output}/imported-layout-loop.png` });
    const clips = await page.evaluate(async source => {
      const { values, photoValues } = JSON.parse(source) as { values: Record<string, unknown>; photoValues: Record<string, number> };
      const hostPath = '/src/lib/host-ref.ts', exportPath = '/src/pro/render-export.ts';
      const host = (await import(hostPath)).getHostRef();
      const { blob } = await (await import(exportPath)).renderRowToBlob({ toolId: 'design', values }, host,
        { format: 'webm', width: 640, height: 360, watermark: false, embedMeta: false, c2pa: false });
      const toolPath = '/src/bridge/tool-loader.ts', runtimePath = '/src/lib/mount-runtime.ts', videoPath = '/src/lib/video-jobs.ts';
      const darkroom = await (await import(toolPath)).getTool('darkroom');
      const runtime = await (await import(runtimePath)).createToolRuntime(darkroom, host, photoValues);
      try {
        const look = JSON.parse(runtime.getHydratedText('{{videoLook}}')) as { v: number; on: number; cube: string };
        if (look.v !== 1 || look.on !== 1) throw new Error('Imported photo look was not published.');
        const { mediabunnyFrameReader, makeGradeOp, videoEncodeWriter, runFramePipeline } = await import(videoPath);
        const reader = await mediabunnyFrameReader(blob, 0);
        const fps = reader.fps;
        const writer = await videoEncodeWriter({ width: reader.width, height: reader.height, fps, bitrate: 1000000, format: 'webm' });
        const grade = makeGradeOp({ cubeText: look.cube, lutIntensity: 1, grain: 0, grainSize: 1, vignette: 0, seed: 1, fps: 0, bitrate: 1000000 });
        let frames = 0;
        const processed = await runFramePipeline(reader, grade, writer, { onProgress: (done: number) => { frames = done; } });
        if (!processed.result) throw new Error('Photo look video was not encoded.');
        return { loop: [...new Uint8Array(await blob.arrayBuffer())], graded: [...new Uint8Array(await processed.result.blob.arrayBuffer())], fps, frames };
      } finally { runtime.destroy(); }
    }, JSON.stringify({ values: state.values, photoValues: photoPreset.values }));
    assert.equal(clips.fps, 30); assert.equal(clips.frames, 180);
    for (const [name, bytes] of [['imported-layout-loop', clips.loop], ['imported-layout-photo-look', clips.graded]] as const) {
      assert.ok(bytes.length > 1000, 'a real encoded clip is produced');
      assert.deepEqual(bytes.slice(0, 4), [0x1a, 0x45, 0xdf, 0xa3], 'WebM container');
      await writeFile(`${output}/${name}.webm`, new Uint8Array(bytes));
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
