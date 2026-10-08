// SPDX-License-Identifier: MPL-2.0
/** Compare one cached Design slide with the live DOM capture route; generated camera only. */
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import { mkdir, writeFile } from 'node:fs/promises';
const origin = process.env.LOLLY_PRESENT_TEST_URL ?? 'http://127.0.0.1:5184';
if (!['127.0.0.1', 'localhost'].includes(new URL(origin).hostname)) throw new Error('Serve a local web shell for this probe');
const output = process.argv[2] ?? '/tmp/lolly-presentation-260/static';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: 'chromium', headless: true, args: webGpuLaunchArgs('auto') });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${origin}/#/tool/design?template=slide-deck&present`);
  await page.locator('.pr-page.pr-active').waitFor();
  const result = await page.evaluate(async () => {
    const path = '/src/lib/host-ref.ts';
    const { getHostRef } = await import(path);
    const page = document.querySelector<HTMLElement>('.pr-page.pr-active')!;
    const width = page.clientWidth, height = page.clientHeight;
    const holder = document.createElement('div'); holder.className = 'pr-scope';
    Object.assign(holder.style, { position: 'absolute', left: '-10000px', top: '0', width: `${width}px`, height: `${height}px` });
    const unscaled = page.cloneNode(true) as HTMLElement;
    unscaled.className = 'lolly-frame-page';
    Object.assign(unscaled.style, { position: 'relative', left: '0', top: '0', transform: 'none', margin: '0' });
    holder.append(unscaled); document.querySelector('.pr-stage')!.append(holder);
    const before = performance.now();
    let blob: Blob;
    try { blob = await getHostRef().export.render(unscaled, 'png', { width, height, watermark: false, embedMeta: false }); }
    finally { holder.remove(); }
    const rasterMs = performance.now() - before;
    const decodeStart = performance.now(), slide = await createImageBitmap(blob, { resizeWidth: 1280, resizeHeight: 720 }), decodeMs = performance.now() - decodeStart;
    const camera = document.createElement('canvas'); camera.width = 640; camera.height = 480;
    const cameraCtx = camera.getContext('2d')!; let tick = 0;
    const timer = setInterval(() => { cameraCtx.fillStyle = `rgb(80,${128 + (++tick % 2)},48)`; cameraCtx.fillRect(0, 0, 640, 480); }, 1000 / 30);
    const video = document.createElement('video'); video.muted = true; const stream = camera.captureStream(30); video.srcObject = stream; await video.play();
    const output = document.createElement('canvas'); output.width = 1280; output.height = 720;
    const ctx = output.getContext('2d')!, durations: number[] = [];
    try {
      for (let i = 0; i < 140; i++) {
        await new Promise<void>(resolve => video.requestVideoFrameCallback(() => resolve()));
        const at = performance.now();
        ctx.drawImage(slide, 0, 0, 1280, 720); ctx.drawImage(video, 920, 440, 320, 240);
        ctx.fillStyle = '#102237'; ctx.fillRect(40, 590, 540, 90); ctx.fillStyle = 'white'; ctx.font = '32px system-ui'; ctx.fillText('Alex Presenter', 64, 648);
        ctx.font = '28px system-ui'; ctx.fillText('LOLLY', 1120, 64);
        ctx.getImageData(0, 0, 1, 1);
        if (i >= 20) durations.push(performance.now() - at);
      }
      durations.sort((a, b) => a - b);
      const screenshot = output.toDataURL('image/png');
      return { rasterMs, decodeMs, sourceWidth: width, sourceHeight: height, cachedWidth: slide.width, cachedHeight: slide.height, pngBytes: blob.size,
        medianMs: durations[Math.floor(durations.length / 2)], p95Ms: durations[Math.floor(durations.length * 0.95)], maxMs: durations.at(-1), screenshot };
    } finally { clearInterval(timer); for (const track of stream.getTracks()) track.stop(); video.srcObject = null; slide.close(); }
  });
  const { screenshot, ...measurements } = result;
  await writeFile(`${output}/composition.png`, Buffer.from(screenshot.split(',')[1]!, 'base64'));
  await writeFile(`${output}/result.json`, JSON.stringify({ at: new Date().toISOString(), browser: browser.version(), ...measurements }, null, 2));
  console.log(JSON.stringify(measurements));
} finally { await browser.close(); }
