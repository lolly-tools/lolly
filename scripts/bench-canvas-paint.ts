// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas paint baseline (plans/98 §9) - the BROWSER half of the harness. Where
 * bench-canvas.ts measures the DOM-free hot paths in node, this drives a real headless
 * Chrome to measure the thing node cannot: actual DOM paint / layout cost of the two
 * paint strategies over N boxes.
 *
 *   full   the CURRENT paint (views/tool.ts): `contentEl.innerHTML = <all N boxes>` then
 *          a forced reflow - re-parse + re-create + re-lay-out every box, every edit.
 *   patch  the PHASE-A paint (plans/98 §5): mutate only the damaged box's node in place - 
 *          a geometry move is a `transform` write (no layout invalidation).
 *
 * The delta is what the damage stream buys: an edit that touches one box should cost O(1),
 * not O(document). Runs on the system Chrome via playwright-core (channel:'chrome'),
 * headless, so it CIs.
 *
 * Usage:  node scripts/bench-canvas-paint.ts [--json=<path>]
 */
import { writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const args = new Map(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([^=]+)=(.*)$/);
  return m ? ([m[1], m[2]] as const) : ([a.replace(/^--/, ''), 'true'] as const);
}));
const JSON_OUT = args.get('json');

const HARNESS = `<!doctype html><html><head><meta charset=utf8><style>
  * { box-sizing: border-box; margin: 0; }
  #canvas { position: relative; width: 4000px; height: 4000px; contain: layout; }
  .lolly-box { position: absolute; border-radius: 8px; background: #cdd; color: #123;
    font: 13px/1.3 system-ui, sans-serif; padding: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.2); }
  .lolly-box .t { pointer-events: none; }
</style></head><body><div id=canvas></div></body></html>`;

interface Row { n: number; fullMs: number; patchGeomMs: number; patchStyleMs: number }

async function main(): Promise<void> {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(HARNESS);

  const rows: Row[] = await page.evaluate((): Row[] => {
    const host = document.getElementById('canvas')!;
    const median = (xs: number[]): number => { xs.sort((a, b) => a - b); return xs[xs.length >> 1]!; };
    const boxHtml = (i: number): string =>
      `<div class="lolly-box" style="left:${(i * 37) % 3600}px;top:${(i * 53) % 3600}px;width:120px;height:80px;transform:rotate(${i % 40}deg)"><div class="t">Box ${i} label copy</div></div>`;

    const out: Row[] = [];
    for (const n of [1000, 5000, 10000]) {
      const all = new Array(n);
      for (let i = 0; i < n; i++) all[i] = boxHtml(i);
      const allHtml = all.join('');

      // full: innerHTML swap of ALL boxes + forced reflow (the current per-edit paint)
      const fulls: number[] = [];
      for (let r = 0; r < 6; r++) {
        const t0 = performance.now();
        host.innerHTML = allHtml;
        void host.offsetHeight; // force synchronous layout
        fulls.push(performance.now() - t0);
      }

      // doc now mounted with n boxes; measure single-box damage patches
      const kids = host.children;
      const patchGeom: number[] = [];
      const patchStyle: number[] = [];
      for (let r = 0; r < 30; r++) {
        const el = kids[(r * 7919) % n] as HTMLElement;
        // geometry lane: a transform write (transforms don't invalidate layout)
        let t0 = performance.now();
        el.style.transform = `translate(${r}px, ${r}px) rotate(${r % 40}deg)`;
        void host.offsetHeight;
        patchGeom.push(performance.now() - t0);
        // content lane: a layout-affecting change to one node
        const el2 = kids[(r * 104729) % n] as HTMLElement;
        t0 = performance.now();
        el2.style.width = `${100 + (r % 60)}px`;
        void host.offsetHeight;
        patchStyle.push(performance.now() - t0);
      }
      out.push({ n, fullMs: median(fulls), patchGeomMs: median(patchGeom), patchStyleMs: median(patchStyle) });
    }
    return out;
  });

  await browser.close();

  const f = (x: number, d = 2): string => x.toFixed(d);
  const pad = (s: string, w: number): string => s.padStart(w);
  console.log(`\ncanvas PAINT baseline — real headless Chrome (plans/98 §9 browser half)\n`);
  console.log('  boxes │  full innerHTML+reflow │  patch geom (transform)   patch style (1 node)  │  full ÷ geom');
  console.log('  ──────┼────────────────────────┼──────────────────────────────────────────────────┼────────────');
  for (const r of rows) {
    console.log(
      `  ${pad(String(r.n), 5)} │ ${pad(f(r.fullMs) + 'ms', 20)} │ ${pad(f(r.patchGeomMs) + 'ms', 22)} ${pad(f(r.patchStyleMs) + 'ms', 22)} │ ${pad(f(r.fullMs / Math.max(r.patchGeomMs, 0.001), 0) + '×', 10)}`,
    );
  }
  const worst = rows[rows.length - 1]!;
  console.log(`\ninterpretation (${worst.n} boxes, real Chrome):`);
  console.log(`  • the current per-edit paint (full innerHTML swap + reflow) is ${f(worst.fullMs)}ms — ${f((worst.fullMs / 16.7) * 100, 0)}% of a 16.7ms frame, EVERY edit, regardless of what changed.`);
  console.log(`  • a Phase-A geometry patch (transform on one node) is ${f(worst.patchGeomMs)}ms (${f(worst.fullMs / Math.max(worst.patchGeomMs, 0.001), 0)}× cheaper); a single-node layout change is ${f(worst.patchStyleMs)}ms.`);
  console.log(`  • this is why the damage stream (patch |damage| nodes) is the paint-loop win, not just a nicety.\n`);

  if (JSON_OUT) {
    writeFileSync(JSON_OUT, JSON.stringify({ engine: 'chrome-headless', rows }, null, 2));
    console.log(`baseline written → ${JSON_OUT}\n`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
