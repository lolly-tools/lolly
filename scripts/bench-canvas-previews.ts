// SPDX-License-Identifier: MPL-2.0
/** Incoming overlay feedback with actual Design markup, scoped styles and viewport work.
 * node scripts/bench-canvas-previews.ts --json=/absolute/report.json
 */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { cpus, arch, platform } from 'node:os';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { chromium } from 'playwright';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from '../tests/helpers/host.ts';
import type { CollabSession, CollabSessionHandle } from '../shells/web/src/lib/collab-session.ts';
import type { CanvasPreview } from '@lolly-tools/core/canvas-interaction-v1';
import type { CanvasFeedbackSample } from '../shells/web/src/lib/canvas-feedback.ts';

declare global { interface Window {
  previewProbe: { mountCanvasInteractions: typeof import('../shells/web/src/views/tool-canvas-interactions.ts').mountCanvasInteractions;
    registerCollabSurface: typeof import('../shells/web/src/lib/collab-surface.ts').registerCollabSurface;
    canvasProjection: typeof import('../shells/web/src/views/canvas-projection.ts').canvasProjection };
  previewFixture: { move(run: number): { ms: number; outlines: number; details: number }; check(): { intact: boolean; details: number; nativeTypography: boolean }; dispose(): void };
} }
const root = fileURLToPath(new URL('../', import.meta.url)), output = process.argv.find(arg => arg.startsWith('--json='))?.slice(7);
const boxes: Array<Record<string, string | number> & { id: string }> = Array.from({ length: 50 }, (_, i) => ({ id: `f${i}`, kind: 'frame', x: i % 5 * 900, y: Math.floor(i / 5) * 650, w: 800, h: 600, order: i, bg: '#fff', stroke: '#456', strokeW: 2.5 }));
for (let i = 0; i < 3000; i++) { const f = i % 50, p = Math.floor(i / 50); boxes.push({ id: `b${i}`, kind: 'text', frame: `f${f}`, x: f % 5 * 900 + 20 + p % 10 * 70, y: Math.floor(f / 5) * 650 + 20 + Math.floor(p / 10) * 75, w: 60, h: 45, rot: 0, text: `Label ${i}`, fontSize: 14 }); }
const tool = await loadTool('design', path => readFile(`${root}community/${path}`, 'utf8'));
const runtime = await createRuntime(tool, baseHost(), { boxes }), html = runtime.getHydrated();
const model = JSON.stringify(runtime.getModel().find(input => input.id === 'boxes')!.value);
const bundle = await build({ stdin: { contents: `export {mountCanvasInteractions} from './shells/web/src/views/tool-canvas-interactions.ts'; export {registerCollabSurface} from './shells/web/src/lib/collab-surface.ts'; export {canvasProjection} from './shells/web/src/views/canvas-projection.ts';`, resolveDir: root, loader: 'ts' }, bundle: true, write: false, format: 'iife', globalName: 'previewProbe', platform: 'browser', loader: { '.css': 'empty' } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const report: { environment: object; note: string; rows: object[] } = {
  environment: { date: new Date().toISOString(), browser: browser.version(), node: process.version, cpu: cpus()[0]?.model, arch: arch(), platform: platform() },
  note: 'Actual incoming overlay, derived projection and Design markup: 50 artboards/3000 text objects. Six new claims per case; outline creation and following presentation opportunity separated from detailed refinement. Starts at the received-state callback; transport and preceding engine hooks excluded. Fourfold CPU throttle is a lab multiplier. Concurrent machine load is uncontrolled.', rows: [],
};
const summarize = (values: number[]) => { const sorted = [...values].sort((a, b) => a - b); return { medianMs: sorted[sorted.length >> 1], p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], samples: values }; };
try {
  for (const cpu of [1, 4]) for (const [selected, allVisible] of [[1, false], [20, false], [100, false], [100, true]] as const) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const cdp = await page.context().newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
    await page.setContent('<style>#stage{position:relative;width:1440px;height:900px;overflow:hidden}#art{position:absolute;width:4500px;height:6500px;transform-origin:0 0}#layer{position:absolute;inset:0;pointer-events:none}</style><div id="stage"><div id="art"></div><div id="layer"></div></div>');
    await page.addStyleTag({ content: await readFile(`${root}community/design/styles.css`, 'utf8') }); await page.addScriptTag({ content: bundle.outputFiles[0]!.text });
    await page.evaluate(({ html, model, selected, allVisible }) => {
      const art = document.getElementById('art')!, layer = document.getElementById('layer')!, runtime = {};
      const boxes = JSON.parse(model) as Array<{ id: string; x: number; y: number; w: number; h: number; rot: number }>;
      art.innerHTML = html; const zoom = allVisible ? .6 : 1; art.style.transform = `scale(${zoom})`;
      const ids = Array.from({ length: selected }, (_, i) => `b${allVisible ? i < 60 ? i * 50 : (i - 60) * 50 + 1 : i}`);
      const claim = { id: 'claim', owner: 'peer', name: 'Alice', expiresAt: Date.now() + 10000, target: { kind: 'transform' as const, collection: 'boxes', ids } };
      const peer = { id: 'peer', away: false, state: { name: 'Alice', color: '#123456', selection: ids, location: 'page', preview: undefined as CanvasPreview | undefined } };
      const session = { state: () => ({ role: 'writer', connection: 'live' }), presence: { roster: () => [peer] }, updateSurface: () => {}, subscribe: () => () => {} } as unknown as CollabSession;
      const handle = { claims: { available: () => true, owner: () => 'self', list: () => [claim], subscribe: () => () => {}, release: () => {} } } as unknown as CollabSessionHandle;
      const projection = window.previewProbe.canvasProjection(art, () => boxes, { idField: 'id', xField: 'x', yField: 'y', wField: 'w', hField: 'h', rotationField: 'rot' });
      const camera = () => { const rect = art.getBoundingClientRect(); return (point: { x: number; y: number }) => ({ x: rect.left + point.x * zoom, y: rect.top + point.y * zoom }); };
      const off = window.previewProbe.registerCollabSurface(runtime, { id: () => 'page', collection: 'boxes', element: () => art, selection: () => [], subscribe: () => () => {}, object: id => projection.snapshot()(id), toClient: point => camera()(point), snapshot: () => ({ object: projection.snapshot(), toClient: camera() }) });
      const ui = window.previewProbe.mountCanvasInteractions(runtime, handle, session, layer)!;
      const rows = ids.map(id => { const box = boxes.find(box => box.id === id)!; return { id, x: box.x, y: box.y, w: box.w, h: box.h, rot: box.rot }; }), original = art.outerHTML;
      window.__lollyCanvasFeedback = { enabled: true, samples: [] };
      window.previewFixture = {
        move(run) {
          window.__lollyCanvasFeedback!.samples = []; claim.id = `claim${run}`;
          peer.state.preview = { claimId: claim.id, collection: 'boxes', kind: 'move', phase: 'active', objects: rows.map(row => ({ ...row, x: row.x + run, y: row.y + run })) };
          const start = performance.now(); ui.reanchor();
          return { ms: performance.now() - start, outlines: layer.querySelectorAll('.collab-preview-ghost').length, details: layer.querySelectorAll('.collab-preview-content').length };
        },
        check() {
          const clones = [...layer.querySelectorAll<HTMLElement>('.collab-preview-content')];
          return { intact: art.outerHTML === original, details: clones.length, nativeTypography: clones.every(clone => {
            const id = clone.parentElement!.getAttribute('data-collab-object')!, source = art.querySelector(`[data-box-id="${id}"] .lolly-box-text`)!;
            return clone.querySelector<HTMLElement>('.lolly-box-text')!.style.fontSize === getComputedStyle(source).fontSize && !clone.querySelector('[id]');
          }) };
        }, dispose() { ui.teardown(); off(); projection.dispose(); },
      };
    }, { html, model, selected, allVisible });
    const cold: number[] = [], outlines: number[] = [], details: number[] = [];
    let visibleDetails = 0;
    for (let run = 1; run <= 6; run++) {
      const first = await page.evaluate(run => window.previewFixture.move(run), run);
      assert.equal(first.outlines, selected); assert.equal(first.details, 0, 'First feedback must not wait for cloned artwork'); cold.push(first.ms);
      await page.waitForFunction(() => window.__lollyCanvasFeedback!.samples.some(sample => sample.lane === 'remote-detail'));
      const samples: CanvasFeedbackSample[] = await page.evaluate(() => window.__lollyCanvasFeedback!.samples);
      outlines.push(samples.find(sample => sample.lane === 'remote-outline')!.opportunityMs);
      details.push(samples.find(sample => sample.lane === 'remote-detail')!.opportunityMs);
      const check = await page.evaluate(() => window.previewFixture.check());
      assert.ok(check.intact && check.nativeTypography); assert.ok(check.details > 0); if (allVisible) assert.equal(check.details, selected); visibleDetails = check.details;
    }
    report.rows.push({ cpu, selected, allVisible, visibleDetails, outlineApplied: summarize(cold), outlinePresentationOpportunity: summarize(outlines), detailPresentationOpportunity: summarize(details), artworkIntactAndTypographyPreserved: true });
    await page.evaluate(() => window.previewFixture.dispose()); await page.close();
  }
  console.log(JSON.stringify(report, null, 2)); if (output) await writeFile(output, JSON.stringify(report, null, 2) + '\n');
} finally { await browser.close(); }
