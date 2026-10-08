// SPDX-License-Identifier: MPL-2.0
/** Real pointer feedback and engine-to-paint edit measurements. No physical display claim.
 * LOLLY_WEB_DIST=/absolute/dist node scripts/bench-canvas-feedback.ts --json=/absolute/report.json
 * --cpu=1 selects one throttle; --profile=/absolute/profile.json records incremental-edit stacks.
 */
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { cpus, platform, arch } from 'node:os';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import type { CanvasFeedbackSample } from '../shells/web/src/lib/canvas-feedback.ts';
import { serveCanvasBuild } from './lib/canvas-browser-server.ts';

declare global { interface Window { __lollySetInput?: (id: string, value: unknown) => void } }
const output = process.argv.find(arg => arg.startsWith('--json='))?.slice(7);
const runs = Number(process.argv.find(arg => arg.startsWith('--runs='))?.slice(7) ?? 8);
const cpuOption = process.argv.find(arg => arg.startsWith('--cpu='))?.slice(6);
const rates = cpuOption ? [Number(cpuOption)] : [1, 4];
const profilePath = process.argv.find(arg => arg.startsWith('--profile='))?.slice(10);
assert.ok(Number.isInteger(runs) && runs >= 3 && runs <= 30);
assert.ok(rates.every(rate => Number.isFinite(rate) && rate >= 1 && rate <= 20));
const summarize = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { medianMs: sorted[sorted.length >> 1], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], samples: values }; };
const boxes: Array<Record<string, string | number> & { id: string }> = Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, kind: 'frame', x: i % 5 * 900, y: Math.floor(i / 5) * 650, w: 800, h: 600, order: i, bg: '#fff', stroke: '#456', strokeW: 2.5 }));
for (let i = 0; i < 3000; i++) {
  const f = i % 50, position = Math.floor(i / 50);
  boxes.push({ id: `b${i}`, kind: 'text', frame: `f${f}`, x: f % 5 * 900 + 20 + position % 10 * 70, y: Math.floor(f / 5) * 650 + 20 + Math.floor(position / 10) * 75,
    w: 60, h: 45, rot: 0, text: `Label ${i}`, fontSize: 14, fg: '#152135', bg: '', shape: 'rect' });
}
const server = await serveCanvasBuild(), browser = await chromium.launch({ channel: 'chrome', headless: true, args: webGpuLaunchArgs('auto') });
const report: { environment: object; note: string; rows: object[] } = {
  environment: { date: new Date().toISOString(), node: process.version, browser: browser.version(), cpu: cpus()[0]?.model, platform: platform(), arch: arch(), viewport: { width: 1440, height: 1000 } },
  note: '50 artboards/3000 text objects; warm production session. Real pointer events include scheduling, gesture code, hooks and DOM work. Two rAF callbacks give a presentation opportunity, not physical display latency. CPU throttling is a lab multiplier, not a named device. Content edits use the existing debug setter and are reported separately from pointer input. Transport is excluded. Concurrent machine load is uncontrolled.', rows: [],
};
try {
  for (const cpu of rates) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.addInitScript(() => { window.__lollyCanvasFeedback = { enabled: true, samples: [] }; });
    await page.goto(`${server.url}/#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`, { waitUntil: 'load' });
    const selector = '#tool-canvas .lolly-box[data-box-id="b0"]';
    await page.locator(selector).waitFor({ timeout: 60000 });
    await page.locator('.view-loading').waitFor({ state: 'detached', timeout: 60000 });
    await page.locator('.view-fade').waitFor({ state: 'detached', timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(700);
    await page.locator('.fc-nav-row[data-id="f0"]').dispatchEvent('click');
    await page.locator(selector).evaluate(node => new Promise<void>(resolve => {
      let previous = '', stable = 0;
      const check = () => {
        const rect = node.getBoundingClientRect(), signature = [rect.x, rect.y, rect.width, rect.height].join('|');
        stable = signature === previous ? stable + 1 : 0; previous = signature;
        if (stable >= 4) resolve(); else requestAnimationFrame(check);
      };
      requestAnimationFrame(check);
    }));
    await page.waitForTimeout(1000);
    console.log(`CPU ${cpu}: warm pointer fixture ready`);
    const samples: CanvasFeedbackSample[] = [];
    for (let run = 0; run < runs; run++) {
      await page.evaluate(() => { window.__lollyCanvasFeedback!.samples = []; });
      const bounds = await page.locator(selector).boundingBox(); assert.ok(bounds);
      const x = bounds.x + bounds.width / 2, y = bounds.y + bounds.height / 2;
      const hit = await page.evaluate(({ x, y }) => {
        const node = document.elementFromPoint(x, y);
        return { id: node?.closest('[data-box-id]')?.getAttribute('data-box-id'), html: node?.outerHTML.slice(0, 600), parent: node?.parentElement?.outerHTML.slice(0, 800) };
      }, { x, y });
      if (hit.id !== 'b0') {
        if (output) await page.screenshot({ path: output.replace(/\.json$/, '-pointer.png') });
        console.log(JSON.stringify({ bounds, hit }));
      }
      assert.equal(hit.id, 'b0', 'The pointer fixture must hit the intended object');
      await page.mouse.move(x, y); await page.mouse.down();
      const direction = run % 2 ? -1 : 1;
      await page.mouse.move(x + 12 * direction, y + 9 * direction, { steps: 6 }); await page.mouse.up();
      await page.waitForFunction(() => window.__lollyCanvasFeedback!.samples.some(sample => sample.lane === 'pointer-commit'), { timeout: 30000 });
      samples.push(...await page.evaluate(() => window.__lollyCanvasFeedback!.samples));
    }
    for (const lane of ['pointer-preview', 'pointer-commit'] as const) {
      const selected = samples.filter(sample => sample.lane === lane); assert.ok(selected.length);
      report.rows.push({ cpu, phase: lane, applied: summarize(selected.map(sample => sample.appliedMs)), presentationOpportunity: summarize(selected.map(sample => sample.opportunityMs)) });
    }
    for (const fast of [false, true]) {
      console.log(`CPU ${cpu}: ${fast ? 'incremental' : 'full'} content edits`);
      if (!fast) await page.goto(`${server.url}/?canvasfastpath=0#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`, { waitUntil: 'load' });
      else await page.goto(`${server.url}/#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`, { waitUntil: 'load' });
      await page.locator(selector).waitFor({ timeout: 60000 }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(700);
      await page.locator('.view-loading').waitFor({ state: 'detached', timeout: 60000 });
      if (profilePath && fast && cpu === rates[0]) { await cdp.send('Profiler.enable'); await cdp.send('Profiler.setSamplingInterval', { interval: 1000 }); await cdp.send('Profiler.start'); }
      const edits: Array<{ appliedMs: number; opportunityMs: number; retained: boolean }> = [];
      for (let run = 0; run < runs; run++) {
        edits.push(await page.evaluate(({ boxes, run }) => new Promise<{ appliedMs: number; opportunityMs: number; retained: boolean }>((resolve, reject) => {
          const root = document.querySelector('#tool-canvas')!, original = root.querySelector('[data-box-id="b1"]')!, text = `Edited ${run}`;
          const start = performance.now();
          const timeout = setTimeout(() => { root.removeEventListener('lolly-canvas-painted', painted); reject(new Error('Content edit did not reach its expected paint')); }, 15000);
          const painted = () => {
            if (root.querySelector('[data-box-id="b0"] .lolly-box-text')?.textContent !== text) return;
            root.removeEventListener('lolly-canvas-painted', painted);
            clearTimeout(timeout);
            const appliedMs = performance.now() - start;
            requestAnimationFrame(() => requestAnimationFrame(() => resolve({ appliedMs, opportunityMs: performance.now() - start, retained: original.isConnected })));
          };
          root.addEventListener('lolly-canvas-painted', painted);
          window.__lollySetInput!('boxes', boxes.map(box => box.id === 'b0' ? { ...box, text, fontSize: 14 + run % 2, w: 65 + run % 2 } : box));
        }), { boxes, run }));
      }
      assert.ok(!fast || edits.every(edit => edit.retained), 'Incremental content edits must retain untouched nodes');
      if (profilePath && fast && cpu === rates[0]) { const { profile } = await cdp.send('Profiler.stop'); writeFileSync(profilePath, JSON.stringify(profile) + '\n'); }
      report.rows.push({ cpu, phase: fast ? 'incremental-content' : 'full-content', applied: summarize(edits.map(edit => edit.appliedMs)), presentationOpportunity: summarize(edits.map(edit => edit.opportunityMs)), untouchedNodesRetained: edits.every(edit => edit.retained) });
    }
    await page.close();
  }
  console.log(JSON.stringify(report, null, 2)); if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); await server.close(); }
