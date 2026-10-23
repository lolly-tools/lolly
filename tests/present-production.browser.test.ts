// SPDX-License-Identifier: MPL-2.0
/** LOLLY_PRESENT_TEST_URL=http://127.0.0.1:5184 node --test tests/present-production.browser.test.ts */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';

const origin = process.env.LOLLY_PRESENT_TEST_URL;
const output = process.env.LOLLY_PRESENT_TEST_OUTPUT ?? '/tmp/lolly-presentation-260';
const skip = origin ? false : 'set LOLLY_PRESENT_TEST_URL to a local Vite shell to exercise presentation output';

test('Countdown publishes one live timer into clean output and private preview', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/#/tool/countdown-timer`);
    await shellSettled(page);
    await page.locator('.ct-input').waitFor();
    const popup = page.waitForEvent('popup');
    await page.getByRole('button', { name: 'Present with camera', exact: true }).click();
    const controls = await popup;
    await controls.getByLabel('Countdown duration').fill('0:10');
    await controls.getByRole('button', { name: 'Start timer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pr-program .pr-countdown-time')?.textContent === '0:09');
    assert.equal(await controls.locator('.pr-sp-now .pr-countdown-time').textContent(), '0:09');
    assert.equal(await page.locator('.pr-program').locator('button,input,.ct-hint,.ct-controls').count(), 0);
    await controls.getByRole('button', { name: 'Pause timer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pr-program .pr-countdown')?.getAttribute('data-state') === 'paused');
    const time = await page.locator('.pr-program .pr-countdown-time').textContent();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('.pr-program .pr-countdown-time').textContent(), time);
    await controls.getByRole('button', { name: 'Resume timer', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('.pr-program .pr-countdown')?.getAttribute('data-state') === 'running');
    await controls.getByRole('button', { name: 'Apply prepared scene' }).click();
    await controls.getByRole('status').filter({ hasText: 'Scene applied.' }).waitFor();
    const ringColor = await page.locator('.pr-program .pr-countdown-ring').evaluate(el => getComputedStyle(el).stroke);
    assert.equal(ringColor, 'rgb(255, 255, 255)');
    await page.screenshot({ path: `${output}/countdown-audience.png` });
    await controls.screenshot({ path: `${output}/countdown-controls.png` });
    await controls.close();
    await page.waitForFunction(() => !document.querySelector<HTMLElement>('.pr-program-holding')?.hidden);
    assert.equal(await page.locator('.ct-root').getAttribute('data-state'), 'paused', 'losing private control pauses the source');
    const reopened = page.waitForEvent('popup'); await page.keyboard.press('s'); const next = await reopened;
    await next.getByRole('button', { name: 'End presentation' }).click();
    assert.equal(await page.locator('.ct-root').evaluate(el => (el as HTMLElement).inert), false);
    assert.equal(await page.locator('.pr-countdown').count(), 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('Design saves the composition with its document and reopens without acquiring a camera', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${origin}/#/tool/design?template=slide-deck`);
    await shellSettled(page);
    async function openControls() {
      await page.getByRole('button', { name: 'Present options', exact: true }).click();
      const popup = page.waitForEvent('popup');
      await page.getByRole('menuitem', { name: 'Present with camera', exact: true }).click();
      const controls = await popup;
      await controls.getByRole('heading', { name: 'Presentation', exact: true }).waitFor();
      await controls.waitForFunction(() => getComputedStyle(document.querySelector('.pr-speaker')!).display === 'grid');
      return controls;
    }
    const controls = await openControls();
    await controls.getByText('Framing', { exact: true }).click();
    await controls.getByText('Logo', { exact: true }).click();
    await controls.getByLabel('Lower-third name', { exact: true }).fill('Saved presenter');
    await controls.getByLabel('Camera crop zoom', { exact: true }).fill('2');
    await controls.getByLabel('Logo image', { exact: true }).setInputFiles({ name: 'presentation-logo.svg', mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="64"><rect width="160" height="64" fill="#ffffff"/><text x="12" y="42" font-size="30">LOLLY</text></svg>') });
    await controls.getByRole('status').filter({ hasText: 'Logo prepared.' }).waitFor();
    await controls.getByRole('button', { name: 'Apply prepared scene' }).click();
    await controls.getByRole('status').filter({ hasText: 'Scene applied.' }).waitFor();
    await controls.getByText('Framing', { exact: true }).click();
    await controls.getByText('Logo', { exact: true }).click();
    await controls.getByRole('button', { name: 'Start camera', exact: true }).click();
    await controls.getByRole('status').filter({ hasText: 'Camera ready.' }).waitFor();
    await controls.locator('.pr-prepared-camera video').evaluate(async (video: HTMLVideoElement) => {
      await new Promise<void>(resolve => video.requestVideoFrameCallback(() => resolve()));
    });
    await controls.screenshot({ path: `${output}/design-controls-refined.png` });
    await controls.setViewportSize({ width: 460, height: 850 });
    await controls.getByRole('button', { name: 'Apply prepared scene' }).scrollIntoViewIfNeeded();
    assert.equal(await controls.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await controls.screenshot({ path: `${output}/design-controls-narrow.png` });
    await controls.getByRole('button', { name: 'End presentation' }).click();
    await page.waitForFunction(() => !!history.state?.lollyHistory?.slot).catch(async error => {
      const context = await page.evaluate(() => ({ state: history.state, route: location.hash,
        notices: [...document.querySelectorAll('[role="status"],[role="alert"]')].map(el => el.textContent) }));
      throw new Error(`${String(error)}; presentation save context: ${JSON.stringify({ ...context, errors })}`);
    });
    const saved = await page.evaluate(async () => {
      const path = '/src/lib/host-ref.ts';
      return (await import(path)).getHostRef().state.load(history.state.lollyHistory.slot);
    });
    assert.equal(saved.__presentation.lower.title, 'Saved presenter');
    assert.equal(saved.__presentation.logo.asset.source, 'user');
    assert.equal(saved.__presentation.logo.asset.format, 'svg');
    assert.ok(saved.__presentation.logo.asset.version);
    await page.reload();
    const reopened = await openControls();
    await reopened.getByText('Framing', { exact: true }).click();
    assert.equal(await reopened.getByLabel('Lower-third name', { exact: true }).inputValue(), 'Saved presenter');
    assert.equal(await reopened.getByLabel('Camera crop zoom', { exact: true }).inputValue(), '2');
    assert.equal(await page.locator('.pr-program-camera video').evaluate(el => (el as HTMLVideoElement).srcObject), null);
    await page.locator('.pr-program-logo').waitFor({ state: 'visible' });
    await reopened.getByRole('button', { name: 'End presentation' }).click();
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('clean output keeps camera and graphics through navigation, private Apply and popup loss', { skip, timeout: 90_000 }, async () => {
  assert.ok(['localhost', '127.0.0.1'].includes(new URL(origin!).hostname));
  await mkdir(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const css = await readFile(new URL('../shells/web/src/styles/parts/present.css', import.meta.url), 'utf8');
    const page = await context.newPage();
    const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
    await context.route(`${origin}/production-fixture`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <html><head><title>Presentation test</title><style>${css}</style>
      <style>[hidden]{display:none!important}body{margin:0;font-family:system-ui}button{padding:8px}.lolly-frame-page{box-sizing:border-box;padding:80px;color:white;font-size:64px}</style></head>
      <body><button id="open">Open presentation</button><div id="source">
      <div class="lolly-frame-page" data-frame-id="one" data-frame-notes="PRIVATE ONE" style="width:1280px;height:720px;background:#164b47">Opening slide</div>
      <div class="lolly-frame-page" data-frame-id="two" data-frame-notes="PRIVATE TWO" style="width:1280px;height:720px;background:#393f6b">Second slide</div>
      <div class="lolly-frame-page" data-frame-id="three" data-frame-notes="PRIVATE THREE" style="width:1280px;height:720px;background:#624325">Closing slide</div></div>
      <script type="module">
      import { openPresentMode } from '/src/views/present-mode.ts';
      window.fixture = { saved: null, recordings: [] };
      document.querySelector('#open').onclick = () => {
        const controlsWindow = window.open('', 'lolly-speaker', 'popup=yes,width=1280,height=900');
        window.fixture.controller = openPresentMode({ source: document.querySelector('#source'), transition: 'none', production: {
          controlsWindow, scene: window.fixture.saved,
          resolveLogo: async asset => ({source:'user',type:'vector',id:asset.id,format:'svg',url:'data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="64"><rect width="160" height="64" fill="white"/><text x="18" y="44" font-size="32">LOLLY</text></svg>')}),
          uploadLogo: async () => ({id:'user/test-logo',version:'1',source:'user',format:'svg',type:'vector'}),
          saveScene: scene => window.fixture.saved = scene,
          saveRecording: async blob => window.fixture.recordings.push(blob),
        }});
      };
      </script></body></html>` }));
    await page.goto(`${origin}/production-fixture`);
    await page.waitForFunction(() => !!(window as any).fixture);
    const popupPromise = page.waitForEvent('popup'); await page.locator('#open').click();
    const controls = await popupPromise; controls.on('pageerror', e => errors.push(e.message));
    await controls.getByRole('heading', { name: 'Presentation', exact: true }).waitFor();
    await controls.waitForFunction(() => getComputedStyle(document.querySelector('.pr-speaker')!).display === 'grid');
    assert.equal(await page.locator('.pr-speaker').count(), 0);
    assert.equal(await page.locator('.pr-hud').isVisible(), false);
    assert.equal(await page.locator('.pr-note').isVisible(), false);
    assert.equal(await page.locator('.pr-program-camera').isVisible(), false);
    await controls.getByRole('button', { name: 'Start camera', exact: true }).click();
    await controls.getByRole('status').filter({ hasText: 'Camera ready.' }).waitFor();
    await controls.getByText('Framing', { exact: true }).click();
    await controls.getByText('Logo', { exact: true }).click();
    await controls.getByLabel('Camera crop zoom', { exact: true }).fill('1.7');
    await controls.getByLabel('Camera left', { exact: true }).fill('880');
    await controls.getByLabel('Lower-third name', { exact: true }).fill('Alex Presenter');
    await controls.getByLabel('Lower-third detail', { exact: true }).fill('Product update');
    assert.equal(await page.locator('.pr-program-lower').textContent(), '');
    await controls.getByLabel('Logo image', { exact: true }).setInputFiles({ name: 'logo.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') });
    await controls.getByRole('status').filter({ hasText: 'Logo prepared.' }).waitFor();
    await controls.getByRole('button', { name: 'Apply prepared scene', exact: true }).click();
    await controls.getByRole('status').filter({ hasText: 'Scene applied.' }).waitFor();
    await controls.getByRole('button', { name: 'Show lower third', exact: true }).click();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.pr-program-lower')!).opacity === '1');
    const camera = await page.locator('.pr-program-camera').boundingBox(); assert.equal(camera!.x, 880);
    await page.screenshot({ path: `${output}/audience-inset.png` });
    await controls.screenshot({ path: `${output}/private-controls.png` });
    const trackId = await page.locator('.pr-program-camera video').evaluate(el => (el as HTMLVideoElement).srcObject instanceof MediaStream && ((el as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0]!.id);
    await controls.getByRole('button', { name: 'Next', exact: true }).click();
    await controls.locator('.pr-sp-notes').filter({ hasText: 'PRIVATE TWO' }).waitFor();
    assert.equal(await page.locator('.pr-program-lower strong').textContent(), 'Alex Presenter');
    assert.equal(await page.locator('.pr-program-logo').isVisible(), true);
    assert.equal(await page.locator('.pr-program-camera video').evaluate(el => ((el as HTMLVideoElement).srcObject as MediaStream).getVideoTracks()[0]!.id), trackId);
    await controls.getByLabel('Prepared scene', { exact: true }).selectOption('side');
    await controls.getByRole('button', { name: 'Apply prepared scene', exact: true }).click();
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.pr-program-content')!.style.width === '880px');
    await page.screenshot({ path: `${output}/audience-side.png` });
    await page.keyboard.press('o'); assert.equal(await page.locator('.pr-overview').count(), 0);
    assert.equal(await page.locator('.pr-program-holding').isVisible(), true);
    await controls.getByRole('button', { name: 'Apply prepared scene', exact: true }).click();
    await page.waitForFunction(() => document.querySelector<HTMLElement>('.pr-program-holding')!.hidden);
    await controls.close();
    await page.waitForFunction(() => !document.querySelector<HTMLElement>('.pr-program-holding')!.hidden);
    assert.equal(await page.locator('.pr-program-camera video').evaluate(el => (el as HTMLVideoElement).srcObject), null);
    assert.equal(await page.locator('.pr-speaker').count(), 0);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('.pr-production').count(), 1);
    await page.evaluate(() => (window as any).fixture.controller.close());
    assert.equal(await page.locator('.pr-stage').count(), 0);
    const reopenedPromise = page.waitForEvent('popup'); await page.locator('#open').click(); const reopened = await reopenedPromise;
    await reopened.getByRole('heading', { name: 'Presentation', exact: true }).waitFor();
    assert.equal(await reopened.getByLabel('Camera crop zoom', { exact: true }).inputValue(), '1.7');
    assert.equal(await page.locator('.pr-program-camera video').evaluate(el => (el as HTMLVideoElement).srcObject), null);
    assert.equal(await page.locator('.pr-program-lower-on').count(), 0);
    await page.evaluate(() => (window as any).fixture.controller.close());
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

for (const [microphone, cancel] of [[false, false], [true, false], [false, true]]) test(`region capture ${cancel ? 'cancels an active take' : `records playable 720p output ${microphone ? 'with microphone' : 'silently'}`}`, { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [
    '--auto-accept-this-tab-capture', '--use-fake-device-for-media-stream',
    '--auto-select-tab-capture-source-by-title=Lolly recording test',
  ] });
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['camera', 'microphone'] });
    const page = await context.newPage();
    await context.route(`${origin}/production-recording`, route => route.fulfill({ contentType: 'text/html', body: `<!doctype html>
      <title>Lolly recording test</title><style>body{margin:0}#surface{display:flow-root;width:1280px;height:720px;background:#164b47;color:white;position:relative}#logo{position:absolute;right:32px;top:32px}#lower{position:absolute;bottom:32px;left:32px;animation:move 1s alternate infinite}@keyframes move{to{transform:translateX(80px)}}video{width:320px;height:240px;position:absolute;right:32px;bottom:32px}</style>
      <div id="surface"><h1>Shared slide</h1><strong id="logo">LOLLY</strong><span id="lower">Alex Presenter</span><video muted playsinline></video></div>
      <button id="record">Record</button><button id="stop">Stop</button><p>PRIVATE CONTROLS</p>
      <script type="module">
      import { recordProduction, productionRecordingSupported } from '/src/views/present-production/recording.ts';
      window.result={supported:productionRecordingSupported()};
      let session; const abort=new AbortController(); const video=document.querySelector('video');
      const display=navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getDisplayMedia=async opts=>{const stream=await display(opts);window.result.capture=stream;return stream};
      const camera=document.createElement('canvas');camera.width=320;camera.height=240;const c=camera.getContext('2d');let frame=0;setInterval(()=>{c.fillStyle='#508030';c.fillRect(0,0,320,240);c.fillStyle='white';c.fillText('Camera fixture '+frame++,30,80)},33);video.srcObject=camera.captureStream(30); await video.play();
      document.querySelector('#record').onclick=async()=>{try{session=await recordProduction(document.querySelector('#surface'),${microphone},abort.signal);window.result.started=true}catch(e){window.result.error=e.message}};
      document.querySelector('#stop').onclick=async()=>{${cancel ? 'abort.abort();' : ''}const blob=await ${cancel ? 'session.finished' : 'session.stop()'};window.result.bytes=blob.size;${cancel ? "window.result.cameraLive=video.srcObject.getVideoTracks()[0].readyState;window.result.captureStopped=window.result.capture.getTracks().every(t=>t.readyState==='ended');window.result.done=true;return;" : ''}const playback=document.createElement('video');playback.src=URL.createObjectURL(blob);playback.muted=true;await playback.play();window.result.width=playback.videoWidth;window.result.height=playback.videoHeight;window.result.cameraLive=video.srcObject.getVideoTracks()[0].readyState;const frame=document.createElement('canvas');frame.width=1280;frame.height=720;const ctx=frame.getContext('2d');ctx.drawImage(playback,0,0);window.result.edge=[...ctx.getImageData(8,712,1,1).data];window.result.done=true;window.result.blob=blob;};
      window.result.ready=true;
      </script>` }));
    await page.goto(`${origin}/production-recording`);
    await page.waitForFunction(() => (window as any).result?.ready);
    assert.equal(await page.evaluate(() => (window as any).result.supported), true);
    await page.locator('#record').click();
    await page.waitForFunction(() => (window as any).result.started || (window as any).result.error);
    assert.equal(await page.evaluate(() => (window as any).result.error), undefined);
    await page.waitForTimeout(2200);
    await page.locator('#stop').click();
    await page.waitForFunction(() => (window as any).result.done);
    const result = await page.evaluate(() => { const { blob, capture, ...rest } = (window as any).result; return rest; });
    if (cancel) {
      assert.equal(result.bytes, 0); assert.equal(result.captureStopped, true); assert.equal(result.cameraLive, 'live');
      return;
    }
    assert.equal(result.width, 1280); assert.equal(result.height, 720); assert.ok(result.bytes > 1000);
    assert.equal(result.cameraLive, 'live', 'recording teardown does not stop the producer camera');
    assert.ok(Math.abs(result.edge[0]-22)<8 && Math.abs(result.edge[1]-75)<8 && Math.abs(result.edge[2]-71)<8, 'the lower edge contains audience pixels, not the private controls below');
    await mkdir(output, { recursive: true });
    const bytes = await page.evaluate(async () => [...new Uint8Array(await (window as any).result.blob.arrayBuffer())]);
    await writeFile(`${output}/presentation${microphone ? '-microphone' : ''}.webm`, new Uint8Array(bytes));
  } finally { await browser.close(); }
});
