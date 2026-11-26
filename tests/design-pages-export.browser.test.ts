// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import test from 'node:test';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';
import { webGpuLaunchArgs } from '../packages/node-shell/src/webgpu-launch.ts';
import type { Runtime } from '../engine/src/runtime.ts';
import { designRecordEnvironment } from '../engine/src/metadata.ts';
import type { ExportMeta } from '../engine/src/bridge/host-v1.ts';

const origin = process.env.LOLLY_HIERARCHY_TEST_URL ?? process.env.LOLLY_IMPORT_TEST_URL ?? process.env.LOLLY_EXPORT_TEST_URL;
test('detached Design export contains every page while the editor keeps its active page', { skip: origin ? false : 'Set LOLLY_HIERARCHY_TEST_URL to a local web shell.', timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage();
    const seed = [{ id: 'seed', kind: 'box', x: 20, y: 20, w: 100, h: 80, bg: '#88cc99' }];
    await page.goto(`${origin}/t/design?${new URLSearchParams({ boxes: JSON.stringify(seed), c2pa: '0', imprint: '0' })}`);
    await page.locator('#tool-canvas [data-penpot-doc]').waitFor({ state: 'attached' });
    const result = await page.evaluate(async () => {
      const paths = ['/src/bridge/tool-loader.ts', '/src/lib/mount-runtime.ts', '/src/pro/render-export.ts', '/src/lib/host-ref.ts'];
      const [tools, runtimes, exports, hosts] = await Promise.all(paths.map(path => import(path)));
      const host = hosts.getHostRef(), tool = await tools.getTool('design');
      const values = {
        pages: [{ id: 'one', name: 'First' }, { id: 'two', name: 'Second' }, { id: 'loose', name: 'Loose' }, { id: 'empty', name: 'Empty' }],
        boxes: [
          { id: 'f1', kind: 'frame', pageId: 'one', name: 'First board', x: 0, y: 0, w: 320, h: 240 },
          { id: 'g1', kind: 'group', frame: 'f1', x: 20, y: 20, w: 100, h: 80 },
          { id: 'leaf', kind: 'box', group: 'g1', x: 20, y: 20, w: 100, h: 80, bg: '#88cc99' },
          { id: 'f2', kind: 'frame', pageId: 'two', name: 'Second board', x: 0, y: 0, w: 320, h: 240 },
          { id: 'other', kind: 'box', frame: 'f2', x: 50, y: 50, w: 100, h: 100, bg: '#cc88aa' },
          { id: 'loose-box', kind: 'box', pageId: 'loose', x: 40, y: 40, w: 100, h: 100, bg: '#99aaff' },
        ],
      };
      const runtime = await runtimes.createToolRuntime(tool, host, values, { viewState: { pageId: 'two' } });
      const before = JSON.stringify(runtime.getModel()), preview = runtime.getHydrated(), live = document.getElementById('tool-canvas')!.innerHTML;
      let capture: { canvas: HTMLElement; runtime: Runtime; destroy(): void } | undefined;
      try {
        const mounted: NonNullable<typeof capture> = await exports.mountDocumentExport(tool, host, runtime, { width: 320, height: 240 });
        capture = mounted;
        const surfaces = [...mounted.canvas.querySelectorAll('[data-pdf-page]')].map(node => node.getAttribute('data-frame-id'));
        const blob = await mounted.runtime.export(mounted.canvas, 'pdf', { width: 320, height: 240, watermark: false, c2pa: false });
        return {
          surfaces, pdf: [...new Uint8Array(await blob.arrayBuffer())],
          modelUnchanged: JSON.stringify(runtime.getModel()) === before,
          previewUnchanged: runtime.getHydrated() === preview, view: runtime.getViewState(),
          liveUnchanged: document.getElementById('tool-canvas')!.innerHTML === live,
        };
      } finally { capture?.destroy(); runtime.destroy(); }
    });
    assert.deepEqual(result.surfaces, ['f1', 'f2', '__page-export:loose', '__page-export:empty']);
    assert.equal((await PDFDocument.load(new Uint8Array(result.pdf))).getPageCount(), 4);
    assert.equal(result.modelUnchanged, true); assert.equal(result.previewUnchanged, true);
    assert.equal(result.liveUnchanged, true); assert.deepEqual(result.view, { pageId: 'two' });
    assert.equal(await page.locator('.pro-export-canvas').count(), 0, 'capture teardown removes its offscreen stage');
  } finally { await browser.close(); }
});

// The export card reads the live runtime; a multi-page download renders through a
// second runtime (mountDocumentExport). That runtime must record the same partner
// (Lolly Work plans/82 M3), or the card would name a partner the files do not hold.
test('a two-page Design export records the partner the card shows, in every file it writes', { skip: origin ? false : 'Set LOLLY_HIERARCHY_TEST_URL to a local web shell.', timeout: 120_000 }, async () => {
  const browser = await chromium.launch({ headless: true, args: webGpuLaunchArgs('software') });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/t/design?${new URLSearchParams({ c2pa: '0', imprint: '0' })}`);
    await page.locator('#tool-canvas [data-penpot-doc]').waitFor({ state: 'attached' });
    const result = await page.evaluate(async () => {
      const paths = ['/src/bridge/tool-loader.ts', '/src/lib/mount-runtime.ts', '/src/pro/render-export.ts', '/src/lib/host-ref.ts', '/src/lib/made-with.ts'];
      const [tools, runtimes, exports, hosts, madeWith] = await Promise.all(paths.map(path => import(path)));
      const host = hosts.getHostRef(), tool = await tools.getTool('design');
      const values = {
        pages: [{ id: 'one', name: 'First' }, { id: 'two', name: 'Second' }],
        boxes: [
          { id: 'f1', kind: 'frame', pageId: 'one', name: 'First board', x: 0, y: 0, w: 320, h: 240 },
          { id: 'a', kind: 'box', frame: 'f1', x: 20, y: 20, w: 100, h: 80, bg: '#88cc99' },
          { id: 'f2', kind: 'frame', pageId: 'two', name: 'Second board', x: 0, y: 0, w: 320, h: 240 },
          { id: 'b', kind: 'box', frame: 'f2', x: 50, y: 50, w: 100, h: 100, bg: '#cc88aa' },
        ],
      };
      const partner = { company: { id: 'northwind-it', label: 'Northwind IT', revision: 3 }, programme: { id: 'resellers-emea', label: 'Resellers, EMEA' } };
      const runtime = await runtimes.createToolRuntime(tool, host, values);
      runtime.setPartner(partner);
      const preview = await runtime.madeWithPreview();
      const card = preview ? madeWith.madeWithWords(preview.record) : '';
      const mounted = await exports.mountDocumentExport(tool, host, runtime, { width: 320, height: 240 });
      try {
        const files: Record<string, unknown> = {};
        for (const format of ['pdf', 'svg']) {
          const blob = await mounted.runtime.export(mounted.canvas, format, { width: 320, height: 240, watermark: false, c2pa: false });
          const meta = mounted.runtime.lastExportMeta;
          files[format] = { meta, bytes: [...new Uint8Array(await blob.arrayBuffer())] };
        }
        return { card, files };
      } finally { mounted.destroy(); runtime.destroy(); }
    });
    assert.match(result.card, /Partner: Northwind IT \(Resellers, EMEA\)$/, 'the card names the partner');
    for (const format of ['pdf', 'svg']) {
      const env = designRecordEnvironment((result.files[format] as { meta: ExportMeta }).meta);
      assert.deepEqual(Object.keys(env).filter((k) => k.startsWith('partner')).sort(),
        ['partnerCompany', 'partnerCompanyLabel', 'partnerProfileRevision', 'partnerProgramme', 'partnerProgrammeLabel'], `${format}: the five credential keys`);
      assert.equal(env.partnerCompanyLabel, 'Northwind IT');
    }
    // Read back from the files' own bytes.
    const pdf = await PDFDocument.load(new Uint8Array((result.files.pdf as { bytes: number[] }).bytes), { updateMetadata: false });
    assert.match(pdf.getKeywords() ?? '', /Partner: Northwind IT/, 'the PDF keyword');
    const svg = new TextDecoder().decode(new Uint8Array((result.files.svg as { bytes: number[] }).bytes));
    assert.ok(svg.includes('<lolly:PartnerCompanyLabel>Northwind IT</lolly:PartnerCompanyLabel>'), 'the SVG metadata');
    assert.ok(svg.includes('<lolly:PartnerProgrammeLabel>Resellers, EMEA</lolly:PartnerProgrammeLabel>'));
  } finally { await browser.close(); }
});
