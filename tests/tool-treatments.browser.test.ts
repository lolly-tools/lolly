// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import test, { after } from 'node:test';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { loadTool } from '../engine/src/loader.ts';
import type { InputValue } from '../engine/src/inputs.ts';
import { closeBrowser, getBrowser } from '../packages/node-shell/src/browsers.ts';
import { baseHost } from './helpers/host.ts';

const skip = !process.env.LOLLY_TOOL_LAYOUT_TEST && 'set LOLLY_TOOL_LAYOUT_TEST=1';
const ids = ['brief', 'scorecard', 'email', 'week', 'pricing-table', 'link-card'];
const fetchTool = (path: string) => readFile(new URL('../community/' + path, import.meta.url), 'utf8');
const doc = JSON.parse(await readFile(new URL('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));
const host = () => baseHost({ color: makeColorApi(), tokens: {
  get: async (opts = {}) => createTokenSet(doc, opts),
  resolve: async (path: string, opts = {}) => createTokenSet(doc, opts).resolve(path),
}, assets: { get: async () => null, query: async () => [] } });
after(() => closeBrowser());

for (const id of ids) {
  test(`${id}: responsive layouts fit and motion seeks deterministically`, { skip, timeout: 120_000 }, async () => {
    const browser = await getBrowser();
    const page = await browser.newPage({ viewport: { width: 1800, height: 1500 } });
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    const tool = await loadTool(id, fetchTool);
    const rt = await createRuntime(tool, host(), { motion: 'rise' });
    try {
      const layouts = tool.manifest.inputs.find(i => i.id === (id === 'link-card' ? 'contentLayout' : 'layout'))!.options!;
      for (const layout of layouts) {
        await rt.setInput(id === 'link-card' ? 'contentLayout' : 'layout', layout.value);
        for (const [width, height] of [[1600, 900], [1000, 1000], [800, 1200]]) {
          await page.setContent(`<style>body{margin:0}#stage{width:${width}px;height:${height}px;position:relative}${tool.styles || ''}</style><div id="stage">${rt.getHydrated()}</div>`);
          await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
          const result = await page.evaluate(() => {
            const root = document.querySelector('[data-content-surface]')!;
            const clock = root.querySelector('canvas') as HTMLCanvasElement & { __lollyFrameDriven: boolean; __lollyFrameRender(t: number, seconds?: number): void };
            assertClock(clock);
            function assertClock(value: typeof clock) { if (typeof value?.__lollyFrameRender !== 'function') throw new Error('No export frame clock'); }
            clock.__lollyFrameDriven = true;
            const items = [...root.querySelectorAll<HTMLElement>('[data-reveal]')].filter(el => el.getClientRects().length > 0);
            if (items.length < 2) throw new Error('The scene must reveal its content, including rows or body copy');
            if ([...root.querySelectorAll('.qs-row')].some(row => !row.hasAttribute('data-reveal'))) throw new Error('Every score row needs a reveal');
            clock.__lollyFrameRender(0.12, 4);
            const first = items.map(el => el.style.cssText);
            clock.__lollyFrameRender(0.8, 4);
            clock.__lollyFrameRender(0.12, 4);
            const repeated = items.map(el => el.style.cssText);
            clock.__lollyFrameRender(0);
            const settled = items.every(el => !el.style.opacity && !el.style.transform);
            const overflow = [...root.querySelectorAll<HTMLElement>('[data-content-fit]')]
              .filter(el => el.clientHeight > 0 && (el.scrollHeight > el.clientHeight + 3 || el.scrollWidth > el.clientWidth + 3))
              .map(el => ({ name: el.className, height: [el.clientHeight, el.scrollHeight], width: [el.clientWidth, el.scrollWidth] }));
            return { first, repeated, settled, overflow, scale: (root as HTMLElement).style.getPropertyValue('--content-fit') };
          });
          assert.deepEqual(result.first, result.repeated, 'seeking is independent of the previous frame');
          assert.ok(result.settled, 'still exports show all content');
          assert.deepEqual(result.overflow, [], `${layout.value} ${width}x${height} scale=${result.scale}`);
          if (process.env.LOLLY_TOOL_LAYOUT_SHOTS && layout === layouts[0]) {
            await mkdir(process.env.LOLLY_TOOL_LAYOUT_SHOTS, { recursive: true });
            await page.locator('#stage').screenshot({ path: `${process.env.LOLLY_TOOL_LAYOUT_SHOTS}/${id}-${width}x${height}.png` });
          }
        }
      }
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.setContent(`<style>#stage{width:1600px;height:900px;position:relative}${tool.styles || ''}</style><div id="stage">${rt.getHydrated()}</div>`);
      const reduced = await page.evaluate(() => {
        const root = document.querySelector('[data-content-surface]')!;
        const clock = root.querySelector('canvas') as HTMLCanvasElement & { __lollyFrameRender(t: number, seconds?: number): void };
        const items = [...root.querySelectorAll<HTMLElement>('[data-reveal]')];
        const preview = items.every(el => !el.style.opacity && !el.style.transform);
        clock.__lollyFrameRender(0.1, 4);
        const exported = items.some(el => !!el.style.opacity);
        clock.__lollyFrameRender(0);
        return { preview, exported };
      });
      assert.ok(reduced.preview, 'reduced motion keeps the live preview still');
      assert.ok(reduced.exported, 'an explicit motion export keeps the authored motion');
      assert.deepEqual(errors, []);
    } finally { rt.destroy(); await page.close(); }
  });
}

test('longer copy and denser tables fit without silently clipping the message', { skip, timeout: 120_000 }, async () => {
  const browser = await getBrowser();
  const page = await browser.newPage({ viewport: { width: 1800, height: 1500 } });
  const cases: Array<[string, Record<string, InputValue>]> = [
    ['brief', { body: '# Quarterly account review\n\n' + Array.from({ length: 10 }, (_, i) => `- **Priority ${i + 1}:** ${'Confirm the plan with the whole team before the next review. '.repeat(2)}`).join('\n') }],
    ['scorecard', { criteria: { columns: ['Criterion', 'Score', 'Evidence'], rows: Array.from({ length: 16 }, (_, i) => [`Review area ${i + 1}`, '75%', 'The team has reviewed the evidence and confirmed the next action.']) } }],
    ['email', { body: 'Subject: Your next steps\n\n' + 'We have reviewed the plan with the team. The next step is to agree the dates and confirm who owns each task.\n\n'.repeat(18) }],
    ['link-card', { heading: 'A considered approach to building better services with the whole team', body: 'Start with the people who use the service. Listen to their experience, agree a useful next step, and make room to learn from the result.', contentLayout: 'stack' }],
  ];
  try {
    for (const [id, values] of cases) {
      const tool = await loadTool(id, fetchTool);
      const rt = await createRuntime(tool, host(), values);
      try {
        for (const [width, height] of [[800, 1200], [1600, 900]]) {
          await page.setContent(`<style>body{margin:0}#stage{width:${width}px;height:${height}px;position:relative}${tool.styles || ''}</style><div id="stage">${rt.getHydrated()}</div>`);
          await page.evaluate(async () => { await document.fonts.ready; await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
          const overflow = await page.locator('[data-content-fit-warning]').isVisible();
          assert.equal(overflow, false, `${id} ${width}x${height} has room for its content`);
        }
      } finally { rt.destroy(); }
    }
    const tool = await loadTool('email', fetchTool);
    const rt = await createRuntime(tool, host(), { body: 'Full message\n\n' + 'A\n\n'.repeat(1500) });
    await page.setContent(`<style>#stage{width:300px;height:180px;position:relative}${tool.styles || ''}</style><div id="stage">${rt.getHydrated()}</div>`);
    await page.evaluate(async () => { await document.fonts.ready; });
    assert.ok(await page.locator('[data-content-fit-warning]').isVisible(), 'a canvas that cannot hold the copy explains how to repair it');
    rt.destroy();
  } finally { await page.close(); }
});
