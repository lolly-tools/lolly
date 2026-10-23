// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_PRESENT_TEST_URL;
declare global { interface Window { __presentationCameraProbe: { requests: MediaStreamConstraints[]; tracks: MediaStreamTrack[] } } }

test('private framing, camera selection and saved scenes stay separate from the audience', {
  skip: origin ? false : 'set LOLLY_PRESENT_TEST_URL to a local Vite shell', timeout: 90_000,
}, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.addInitScript(() => {
      const media = navigator.mediaDevices, acquire = media.getUserMedia.bind(media);
      const probe = { requests: [] as MediaStreamConstraints[], tracks: [] as MediaStreamTrack[] };
      window.__presentationCameraProbe = probe;
      Object.defineProperty(media, 'enumerateDevices', { value: async () => ['camera-a', 'camera-b'].map(deviceId => ({ deviceId, kind: 'videoinput', label: deviceId })) });
      Object.defineProperty(media, 'getUserMedia', { value: async (constraints: MediaStreamConstraints) => {
        probe.requests.push(constraints); const stream = await acquire({ video: true, audio: false });
        probe.tracks.push(...stream.getVideoTracks()); return stream;
      } });
      Object.defineProperty(navigator, 'mediaDevices', { value: media });
    });
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${origin}/#/tool/countdown-timer`);
    await shellSettled(page);
    const opened = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Present with camera', exact: true }).click();
    const controls = await opened;
    await controls.getByText('Framing', { exact: true }).click();
    const move = controls.getByLabel('Move camera', { exact: true });
    await move.focus(); await controls.keyboard.press('Shift+ArrowLeft');
    assert.equal(await controls.getByLabel('Camera left', { exact: true }).inputValue(), '910');
    assert.equal(await page.locator('.pr-program-camera').evaluate(el => (el as HTMLElement).style.left), '920px');
    await controls.getByLabel('Resize camera', { exact: true }).click(); await controls.keyboard.press('Shift+ArrowLeft');
    assert.equal(await controls.getByLabel('Camera width', { exact: true }).inputValue(), '310');
    const bounds = await move.boundingBox(); assert.ok(bounds);
    await controls.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
    await controls.mouse.down(); await controls.mouse.move(bounds.x - 300, bounds.y - 200, { steps: 5 }); await controls.mouse.up();
    const left = Number(await controls.getByLabel('Camera left', { exact: true }).inputValue()); assert.ok(left < 910 && left >= 0);
    await controls.getByLabel('Camera corner radius').fill('24'); await controls.getByLabel('Camera border width').fill('3');
    await controls.getByText('Saved scenes', { exact: true }).click();
    await controls.getByLabel('Scene name', { exact: true }).fill('Opening');
    await controls.getByRole('button', { name: 'Save scene', exact: true }).click();
    await controls.getByRole('status').filter({ hasText: 'Scene saved. Apply to show it.' }).waitFor();
    assert.equal(await page.locator('.pr-program-camera').evaluate(el => (el as HTMLElement).style.left), '920px');
    await controls.getByLabel('Saved scene', { exact: true }).selectOption('');
    await controls.getByLabel('Prepared scene', { exact: true }).selectOption('camera');
    await controls.getByLabel('Scene name', { exact: true }).fill('Speaker');
    await controls.getByRole('button', { name: 'Save scene', exact: true }).click();
    await controls.getByLabel('Saved scene', { exact: true }).selectOption({ label: 'Opening' });
    assert.equal(await controls.getByLabel('Prepared scene', { exact: true }).inputValue(), 'inset');
    await controls.getByRole('button', { name: 'Apply prepared scene' }).click();
    await controls.getByRole('status').filter({ hasText: 'Scene applied.' }).waitFor();
    assert.equal(await page.locator('.pr-program-camera').evaluate(el => (el as HTMLElement).style.left), `${left}px`);
    assert.equal(await page.locator('.pr-program-camera').evaluate(el => (el as HTMLElement).style.borderRadius), '24px');
    await controls.getByRole('button', { name: 'Start camera', exact: true }).click();
    await controls.getByRole('status').filter({ hasText: 'Camera ready.' }).waitFor();
    await controls.getByLabel('Camera device', { exact: true }).selectOption('camera-b');
    await page.waitForFunction(() => window.__presentationCameraProbe.requests.length === 2 && window.__presentationCameraProbe.tracks.length === 2);
    assert.deepEqual(await page.evaluate(() => (window.__presentationCameraProbe.requests[1]!.video as MediaTrackConstraints).deviceId), { exact: 'camera-b' });
    assert.equal(await page.evaluate(() => window.__presentationCameraProbe.tracks[0]!.readyState), 'ended');
    await controls.waitForFunction(() => (document.querySelector('.pr-prepared-camera video') as HTMLVideoElement)?.readyState >= 2);
    await controls.setViewportSize({ width: 460, height: 850 });
    await controls.getByText('Framing', { exact: true }).scrollIntoViewIfNeeded();
    await controls.locator('.pr-framing-feed video').evaluate(async (video: HTMLVideoElement) => {
      await new Promise<void>(resolve => video.requestVideoFrameCallback(() => resolve()));
    });
    assert.equal(await controls.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await controls.screenshot({ path: '/tmp/lolly-presentation-260/m1-framing-narrow.png' });
    await controls.setViewportSize({ width: 1280, height: 900 });
    await controls.getByText('Framing', { exact: true }).click();
    await controls.getByText('Saved scenes', { exact: true }).click();
    await controls.screenshot({ path: '/tmp/lolly-presentation-260/m1-prepared-controls.png' });
    await controls.getByRole('button', { name: 'End presentation' }).click();
    const again = page.waitForEvent('popup'); await page.getByRole('button', { name: 'Present with camera', exact: true }).click();
    const reopened = await again;
    await reopened.getByText('Saved scenes', { exact: true }).click();
    assert.equal(await reopened.getByLabel('Saved scene', { exact: true }).locator('option').count(), 3);
    assert.equal(await reopened.getByLabel('Camera device', { exact: true }).inputValue(), '');
    assert.equal(await page.evaluate(() => window.__presentationCameraProbe.requests.length), 2);
    await reopened.getByLabel('Saved scene', { exact: true }).selectOption({ label: 'Speaker' });
    assert.equal(await reopened.getByLabel('Prepared scene', { exact: true }).inputValue(), 'camera');
    assert.equal(await page.locator('.pr-program-camera').evaluate(el => (el as HTMLElement).style.width), '310px');
    await reopened.getByRole('button', { name: 'Delete scene', exact: true }).click();
    assert.equal(await reopened.getByLabel('Saved scene', { exact: true }).locator('option').count(), 2);
    await reopened.getByRole('button', { name: 'End presentation' }).click();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('a late logo upload cannot replace a selected saved scene', {
  skip: origin ? false : 'set LOLLY_PRESENT_TEST_URL to a local Vite shell', timeout: 30_000,
}, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(origin!);
    const result = await page.evaluate(async base => {
      const { mountProductionControls } = await import(`${base}/src/views/present-production/controls.ts`) as typeof import('../shells/web/src/views/present-production/controls.ts');
      const { readScene } = await import(`${base}/src/views/present-production/scene.ts`) as typeof import('../shells/web/src/views/present-production/scene.ts');
      const scene = readScene({ version: 1, prepared: [{ id: 'opening', name: 'Opening', scene: { version: 1, layout: 'content' } }] });
      type Logo = import('../shells/web/src/views/present-production/scene.ts').LogoAsset;
      let resolveUpload!: (logo: Logo) => void;
      const upload = new Promise<Logo>(resolve => { resolveUpload = resolve; });
      const applied: typeof scene[] = [], saved: unknown[] = [];
      const host = document.createElement('div'); document.body.append(host);
      const controls = mountProductionControls(document, host, { scene,
        apply: async value => { applied.push(readScene(value)); return true; }, camera: () => {}, cue: () => {}, record: () => {}, close: () => {},
        recordingSupported: false, savePrepared: value => saved.push(value), upload: () => upload,
      });
      const button = (name: string) => [...host.querySelectorAll('button')].find(el => el.textContent === name)!;
      const file = host.querySelector<HTMLInputElement>('input[type=file]')!, transfer = new DataTransfer();
      transfer.items.add(new File(['logo'], 'logo.png', { type: 'image/png' })); file.files = transfer.files;
      file.dispatchEvent(new Event('change'));
      const name = host.querySelector<HTMLInputElement>('[aria-label="Scene name"]')!; name.value = 'Pending';
      button('Save scene').click();
      const blocked = host.textContent!.includes('Wait for the logo to finish loading.') && saved.length === 0;
      const choice = host.querySelector<HTMLSelectElement>('[aria-label="Saved scene"]')!;
      choice.value = 'opening'; choice.dispatchEvent(new Event('change'));
      resolveUpload({ id: 'late-logo', source: 'user', format: 'png' }); await upload; await Promise.resolve();
      button('Apply scene').click(); await Promise.resolve();
      const result = { blocked, layout: applied[0]?.layout, logo: applied[0]?.logo.asset };
      controls.dispose(); host.remove(); return result;
    }, origin!);
    assert.deepEqual(result, { blocked: true, layout: 'content', logo: null });
  } finally { await browser.close(); }
});

for (const hold of [false, true]) test(`saved scenes survive a pending Apply${hold ? ' interrupted by holding' : ''}`, {
  skip: origin ? false : 'set LOLLY_PRESENT_TEST_URL to a local Vite shell', timeout: 30_000,
}, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage(); await page.goto(origin!);
    const result = await page.evaluate(async ({ base, hold }) => {
      const { mountPresentationProduction } = await import(`${base}/src/views/present-production.ts`) as typeof import('../shells/web/src/views/present-production.ts');
      const { readScene } = await import(`${base}/src/views/present-production/scene.ts`) as typeof import('../shells/web/src/views/present-production/scene.ts');
      type Asset = import('@lolly-tools/core/host-v1').AssetRef;
      let resolveLogo!: (asset: Asset) => void;
      const pendingLogo = new Promise<Asset>(resolve => { resolveLogo = resolve; });
      const asset: Asset = { id: 'prepared-logo', source: 'user', format: 'svg', type: 'vector',
        url: 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="8" height="8"/%3E' };
      let saved = readScene();
      const stage = document.createElement('div'), frames = document.createElement('div'), host = document.createElement('div');
      stage.append(frames); document.body.append(stage, host);
      const production = mountPresentationProduction(stage, frames, { controlsWindow: window,
        resolveLogo: () => pendingLogo, uploadLogo: async () => asset, saveScene: value => { saved = readScene(value); }, saveRecording: async () => {},
      }, () => {}, () => {});
      production.controls(document, host);
      const button = (name: string) => [...host.querySelectorAll('button')].find(el => el.textContent === name)!;
      const wait = async (read: () => boolean) => {
        for (let i = 0; i < 100; i++) { if (read()) return; await new Promise(resolve => setTimeout(resolve, 10)); }
        throw new Error('Presentation action did not complete');
      };
      const file = host.querySelector<HTMLInputElement>('input[type=file]')!, transfer = new DataTransfer();
      transfer.items.add(new File(['logo'], 'logo.svg', { type: 'image/svg+xml' })); file.files = transfer.files;
      file.dispatchEvent(new Event('change'));
      await wait(() => host.textContent!.includes('Logo prepared.'));
      button('Apply scene').click();
      host.querySelector<HTMLInputElement>('[aria-label="Scene name"]')!.value = 'Opening'; button('Save scene').click();
      const disabled = button('Apply scene').disabled;
      if (hold) production.hold();
      resolveLogo(asset); await wait(() => host.textContent!.includes(hold ? 'Scene was not applied.' : 'Scene applied.'));
      const result = { disabled, names: saved.prepared.map(item => item.name), logo: saved.logo.asset?.id ?? null,
        holding: !stage.querySelector<HTMLElement>('.pr-program-holding')!.hidden };
      production.dispose(); stage.remove(); host.remove(); return result;
    }, { base: origin!, hold });
    assert.deepEqual(result, { disabled: true, names: ['Opening'], logo: hold ? null : 'prepared-logo', holding: hold });
  } finally { await browser.close(); }
});
