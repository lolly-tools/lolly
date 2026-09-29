// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { browserInstalled, getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';

test('exact SVG sampling freezes additive SMIL and CSS pixels, then restores clocks on success and failure', { skip: browserInstalled() ? false : 'Install Chromium to sample animated SVG pixels', timeout: 120_000 }, async () => {
  const bundled = await build({ stdin: { contents: "import { captureSvgTime } from './shells/web/src/bridge/sequence-svg-clock.ts'; globalThis.captureSvgTime = captureSvgTime;", resolveDir: process.cwd() }, bundle: true, write: false, format: 'iife', platform: 'browser' });
  const browser = await getBrowser();
  const context = await browser.newContext();
  const page = await context.newPage();
  try {
    await page.addScriptTag({ content: bundled.outputFiles[0]!.text });
    const result = await page.evaluate(async () => {
      const capture = (globalThis as unknown as { captureSvgTime<T>(box: HTMLElement, seconds: number, read: () => Promise<T>): Promise<T> }).captureSvgTime;
      const box = document.createElement('div');
      box.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"><style>.colour { fill: red; } @keyframes fade { from { opacity: 0; } to { opacity: 1; } } .fading { animation: fade 2s linear infinite; }</style><rect width="20" height="20" fill="white"><animate attributeName="x" from="0" to="80" dur="2s"/><animate attributeName="x" from="0" to="40" additive="sum" dur="2s"/></rect><rect class="colour" y="20" width="120" height="20"><animate attributeName="fill" from="red" to="blue" dur="2s"/></rect><rect class="fading" y="40" width="120" height="20" fill="white"/></svg>';
      document.body.append(box);
      const svg = box.querySelector('svg')!;
      svg.pauseAnimations(); svg.setCurrentTime(0.125);
      for (const animation of box.getAnimations({ subtree: true })) { animation.pause(); animation.currentTime = 125; }
      const original = box.innerHTML;
      const read = async () => {
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml' }));
        try {
          const image = new Image(); image.src = url; await image.decode();
          const canvas = document.createElement('canvas'); canvas.width = 120; canvas.height = 60;
          const ctx = canvas.getContext('2d')!; ctx.drawImage(image, 0, 0);
          return [5, 35, 95].map(x => [...ctx.getImageData(x, 10, 1, 1).data]).concat([
            [...ctx.getImageData(5, 30, 1, 1).data], [...ctx.getImageData(5, 50, 1, 1).data],
          ]);
        } finally { URL.revokeObjectURL(url); }
      };
      const early = await capture(box, 0.5, read);
      const late = await capture(box, 1.5, read);
      let failed = false;
      try { await capture(box, 1, async () => { throw new Error('capture failed'); }); } catch { failed = true; }
      return { early, late, failed, original, restored: box.innerHTML, svgTime: svg.getCurrentTime(), paused: svg.animationsPaused(), animationTimes: box.getAnimations({ subtree: true }).map(animation => [animation.currentTime, animation.playState]) };
    });
    assert.equal(result.early[0]![3], 0); assert.equal(result.early[1]![3], 255); assert.equal(result.early[2]![3], 0);
    assert.equal(result.late[1]![3], 0); assert.equal(result.late[2]![3], 255);
    assert.ok(Math.abs(result.early[3]![0]! - 191) <= 1 && Math.abs(result.early[3]![2]! - 64) <= 1);
    assert.ok(Math.abs(result.late[3]![0]! - 64) <= 1 && Math.abs(result.late[3]![2]! - 191) <= 1);
    assert.ok(Math.abs(result.early[4]![3]! - 64) <= 1); assert.ok(Math.abs(result.late[4]![3]! - 191) <= 1);
    assert.equal(result.failed, true);
    // Chrome can retain an empty style attribute after clearing SVG inline styles.
    assert.equal(result.restored.replaceAll(' style=""', ''), result.original);
    assert.equal(result.paused, true);
    assert.equal(result.svgTime, 0.125); assert.deepEqual(result.animationTimes, [[125, 'paused']]);
  } finally { await context.close(); await closeBrowser(); }
});
