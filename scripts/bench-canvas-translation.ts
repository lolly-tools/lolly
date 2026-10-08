// SPDX-License-Identifier: MPL-2.0
/** Real guarded patch versus full DOM replacement, including synchronous layout.
 * node scripts/bench-canvas-translation.ts [--json=/absolute/report.json]
 * This isolates paint cost; it excludes engine hydration and template scripts.
 */
import { writeFileSync } from 'node:fs';
import { cpus, platform, arch } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';

const output = process.argv.find(arg => arg.startsWith('--json='))?.slice(7);
const bundle = await build({
  entryPoints: [fileURLToPath(new URL('../shells/web/src/views/canvas-translation.ts', import.meta.url))],
  bundle: true, write: false, format: 'iife', globalName: 'translationProbe', platform: 'browser',
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
try {
  const page = await browser.newPage();
  await page.setContent('<style>#surface{position:relative;width:4000px;height:4000px;contain:layout}.lolly-box{position:absolute;width:120px;height:80px;border-radius:8px;background:#cdd;font:13px system-ui;padding:6px}</style><div id="surface"></div>');
  await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
  const rows = await page.evaluate(() => {
    const host = document.querySelector<HTMLElement>('#surface')!;
    const { cacheCanvasTranslations, patchCanvasTranslations } = (window as unknown as { translationProbe: {
      cacheCanvasTranslations(root: HTMLElement, html: string): void;
      patchCanvasTranslations(root: HTMLElement, before: string, after: string, plan: Array<{ id: string; x: number; y: number }>): boolean;
    } }).translationProbe;
    const summarize = (samples: number[]) => {
      const sorted = samples.slice().sort((a, b) => a - b);
      return { medianMs: sorted[sorted.length >> 1], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], samples };
    };
    return [100, 1000, 5000].flatMap(count => [1, 20, 100].filter(selected => selected <= count).map(selected => {
      const parts = Array.from({ length: count }, (_, i) => `<div class="lolly-box" data-box-id="b${i}" style="left:${i % 30 * 125}px;top:${Math.floor(i / 30) * 85}px"><span>Label ${i}</span></div>`);
      const before = parts.join('');
      const indices = Array.from({ length: selected }, (_, i) => Math.floor(i * count / selected));
      const full: number[] = [], guarded: number[] = [], seed: number[] = [];
      for (let run = 0; run < 12; run++) {
        const plan = indices.map(i => ({ id: `b${i}`, x: i % 30 * 125 + run + 1, y: Math.floor(i / 30) * 85 + run + 1 }));
        const changed = parts.slice();
        for (const [position, i] of indices.entries()) {
          const patch = plan[position]!;
          changed[i] = `<div class="lolly-box" data-box-id="b${i}" style="left:${patch.x}px;top:${patch.y}px"><span>Label ${i}</span></div>`;
        }
        const after = changed.join('');
        for (const mode of run % 2 ? ['guarded', 'full'] : ['full', 'guarded']) {
          host.innerHTML = before;
          if (mode === 'guarded') {
            const start = performance.now(); cacheCanvasTranslations(host, before);
            if (run >= 2) seed.push(performance.now() - start);
          }
          void host.offsetHeight;
          const oldNodes = indices.map(i => host.children[i]);
          const start = performance.now();
          if (mode === 'full') host.innerHTML = after;
          else if (!patchCanvasTranslations(host, before, after, plan)) throw new Error('Guarded patch refused fixture');
          void host.offsetHeight;
          const elapsed = performance.now() - start;
          if (mode === 'guarded' && indices.some((i, position) => host.children[i] !== oldNodes[position])) throw new Error('Patch remounted content');
          for (const [position, i] of indices.entries()) {
            const node = host.children[i] as HTMLElement, patch = plan[position]!;
            if (node.style.left !== `${patch.x}px` || node.style.top !== `${patch.y}px`) throw new Error('Translation differs from full paint');
          }
          if (run >= 2) (mode === 'full' ? full : guarded).push(elapsed);
        }
      }
      return { count, selected, full: summarize(full), guarded: summarize(guarded), fullPaintCacheSetup: summarize(seed) };
    }));
  });
  const report = { generated: new Date().toISOString(), environment: { node: process.version, browser: browser.version(), platform: platform(), arch: arch(), cpu: cpus()[0]?.model }, note: 'Ten local samples after two warmups, alternating order. Cache setup belongs to full paints and is reported separately. Concurrent machine load is uncontrolled. No engine hydration or template-script cost.', rows };
  console.log(JSON.stringify(report, null, 2));
  if (output) writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
