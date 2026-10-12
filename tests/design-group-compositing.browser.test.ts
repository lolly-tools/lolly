// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';

const run = promisify(execFile);
const origin = process.env.LOLLY_HIERARCHY_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL;
const artifacts = process.env.LOLLY_GROUP_TEST_ARTIFACTS ?? '/Users/andy/Build/lolly/plans/artifacts/306-followup';
const cases = [
  { id: 'collective', outer: 50, inner: 100, blend: 'normal', background: '#ffffff', expected: [[255,128,128],[128,128,255],[128,128,255]] },
  { id: 'nested', outer: 50, inner: 50, blend: 'normal', background: '#ffffff', expected: [[255,128,128],[191,128,191],[191,191,255]] },
  { id: 'blend', outer: 100, inner: 100, blend: 'multiply', background: '#80ff80', expected: [[128,0,0],[0,0,128],[0,0,128]] },
];
const near = (actual: number[], expected: number[], label: string) => {
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(actual[i]! - expected[i]!) <= 4, `${label}: got ${actual}, expected ${expected}`);
};

test('collective and nested group appearance agrees in PNG, vector SVG and bounded PDF page capture', { skip: origin ? false : 'Set LOLLY_HIERARCHY_TEST_URL to a local shell.', timeout: 120_000 }, async () => {
  await mkdir(artifacts, { recursive: true });
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/t/design?c2pa=0&imprint=0`);
    await page.locator('#tool-canvas [data-penpot-doc]').waitFor({ state: 'attached' });
    for (const fixture of cases) {
      const result = await page.evaluate(async fixture => {
        const paths = ['/src/bridge/tool-loader.ts', '/src/lib/mount-runtime.ts', '/src/pro/render-export.ts', '/src/lib/host-ref.ts', '/src/bridge/export.ts'];
        const [tools, runtimes, exports, hosts, bridge] = await Promise.all(paths.map(path => import(path)));
        const host = hosts.getHostRef(), tool = await tools.getTool('design');
        const values = { pages: [{ id: 'one', name: 'Artwork' }], boxes: [
          { id: 'f', kind: 'frame', pageId: 'one', x: 100, y: 50, w: 200, h: 100, bg: fixture.background },
          { id: 'outer', kind: 'group', frame: 'f', x: 100, y: 50, w: 150, h: 100, opacity: fixture.outer, blend: fixture.blend },
          { id: 'red', kind: 'box', group: 'outer', x: 100, y: 50, w: 100, h: 100, bg: '#ff0000' },
          { id: 'inner', kind: 'group', group: 'outer', x: 150, y: 50, w: 100, h: 100, opacity: fixture.inner },
          { id: 'blue', kind: 'box', group: 'inner', x: 150, y: 50, w: 100, h: 100, bg: '#0000ff' },
        ] };
        const runtime = await runtimes.createToolRuntime(tool, host, values);
        const mounted = await exports.mountDocumentExport(tool, host, runtime, { width: 200, height: 100 });
        try {
          const node = mounted.canvas.querySelector('[data-pdf-page]') as HTMLElement;
          const settings = { width: 200, height: 100, watermark: false, c2pa: false, imprint: false };
          const png = await mounted.runtime.export(node, 'png', settings);
          const svg = await mounted.runtime.export(node, 'svg', settings);
          const pdf = await mounted.runtime.export(node, 'pdf', { ...settings, width: '50mm', height: '25mm' });
          const sample = async (blob: Blob) => {
            const image = new Image(), url = URL.createObjectURL(blob); image.src = url; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = 200; canvas.height = 100;
            const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0, 200, 100); URL.revokeObjectURL(url);
            return [25,75,125].map(x => [...context.getImageData(x, 50, 1, 1).data].slice(0, 3));
          };
          let refusal = '';
          try { await bridge.renderPdf(node, { ...settings, rasterFallback: false }); } catch (error) { refusal = String((error as Error).message); }
          return { png: await sample(png), svgPixels: await sample(svg), svg: await svg.text(), pdf: [...new Uint8Array(await pdf.arrayBuffer())], refusal,
            indices: [...node.querySelectorAll('[data-canvas-input]')].map(el => el.getAttribute('data-canvas-input')),
            parent: node.querySelector('[data-box-id="blue"]')?.parentElement?.getAttribute('data-design-group'),
          };
        } finally { mounted.destroy(); runtime.destroy(); }
      }, fixture);
      for (const [n, expected] of fixture.expected.entries()) {
        near(result.png[n]!, expected, `${fixture.id} PNG ${n}`);
        near(result.svgPixels[n]!, expected, `${fixture.id} SVG ${n}`);
      }
      assert.equal(result.parent, 'inner'); assert.deepEqual(result.indices, ['boxes:2','boxes:4']);
      assert.equal((result.svg.match(/<image\b/g) || []).length, 0, 'SVG keeps group paint vector');
      assert.match(result.svg, /isolation:isolate/);
      if (fixture.blend !== 'normal') assert.match(result.svg, /mix-blend-mode:multiply/);
      assert.match(result.refusal, /Enable raster fallback/);
      const pdfPath = join(artifacts, `group-${fixture.id}.pdf`), prefix = join(artifacts, `group-${fixture.id}`);
      await writeFile(pdfPath, new Uint8Array(result.pdf)); await writeFile(`${prefix}.svg`, result.svg);
      const parsed = await PDFDocument.load(new Uint8Array(result.pdf));
      assert.equal(parsed.getPageCount(), 1);
      const size = parsed.getPage(0).getSize();
      assert.ok(Math.abs(size.width - 50 * 72 / 25.4) < .1); assert.ok(Math.abs(size.height - 25 * 72 / 25.4) < .1);
      await run('pdftoppm', ['-scale-to-x','200','-scale-to-y','100','-singlefile',pdfPath,prefix]);
      const ppm = await readFile(`${prefix}.ppm`), header = /^P6\s+(\d+)\s+(\d+)\s+(\d+)\s/.exec(ppm.subarray(0, 64).toString('latin1'))!;
      assert.equal(Number(header[1]), 200); assert.equal(Number(header[2]), 100);
      const rgb = ppm.subarray(header[0].length);
      for (const [n, x] of [25,75,125].entries()) near([...rgb.subarray((50 * 200 + x) * 3, (50 * 200 + x) * 3 + 3)], fixture.expected[n]!, `${fixture.id} PDF ${n}`);
    }
  } finally { await browser.close(); }
});
