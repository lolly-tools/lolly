// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import type { ViteDevServer } from 'vite';
import type { SiteToolDefinition } from '../shells/web/src/lib/site-tools.ts';

type ToolWindow = Window & { readinessTools: Map<string, SiteToolDefinition>; cleanPaints: number; documentReady: boolean };

test('WebMCP document actions wait for the initial clean Design paint', { timeout: 120_000 }, async (t) => {
  let server: ViteDevServer | undefined;
  t.after(async () => { await server?.close(); });
  let origin = process.env.LOLLY_EXPORT_TEST_URL;
  if (!origin) {
    const { createServer } = await import('vite');
    server = await createServer({ root: fileURLToPath(new URL('../shells/web', import.meta.url)), server: { host: '127.0.0.1', port: 0 }, logLevel: 'error' });
    await server.listen();
    origin = server.resolvedUrls!.local[0]!;
  }
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  let release!: () => void, requested!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const chromeRequested = new Promise<void>(resolve => { requested = resolve; });
  await page.route('**/src/views/design-topbar.ts', async route => { requested(); await held; await route.continue(); });
  await context.addInitScript(() => {
    const state = window as unknown as ToolWindow;
    state.readinessTools = new Map(); state.cleanPaints = 0; state.documentReady = false;
    Object.defineProperty(document, 'modelContext', { value: {
      registerTool(tool: SiteToolDefinition) { state.readinessTools.set(tool.name, tool); },
      unregisterTool(name: string) { state.readinessTools.delete(name); },
    } });
    document.addEventListener('lolly-canvas-painted', () => { state.cleanPaints++; }, true);
    const sample = async (): Promise<void> => {
      const tool = state.readinessTools.get('lolly_read_context');
      if (tool) state.documentReady = ((await tool.execute({})) as { capabilities: { document: boolean } }).capabilities.document;
      requestAnimationFrame(() => { void sample(); });
    };
    requestAnimationFrame(() => { void sample(); });
  });
  const call = (name: string, args: Record<string, unknown> = {}) => page.evaluate(async ([name, args]) => (window as unknown as ToolWindow).readinessTools.get(name)!.execute(args), [name, args] as const);
  const capabilities = async () => (await call('lolly_read_context') as { capabilities: { document: boolean; editDocument: boolean } }).capabilities;
  try {
    const boxes = Array.from({ length: 9 }, (_, i) => ({ id: `page-${i}`, kind: 'frame', x: i * 2000, y: 0, w: 1920, h: 1080, order: i, bg: '#ffffff' }));
    await page.goto(`${origin}/design?${new URLSearchParams({ boxes: JSON.stringify(boxes), c2pa: '0', imprint: '0' })}`, { waitUntil: 'domcontentloaded' });
    await chromeRequested;
    await page.waitForFunction(() => (window as unknown as ToolWindow).readinessTools.has('lolly_preview_document'));
    // Keep chrome held while the independently loaded editor modules settle.
    await page.evaluate(() => new Promise<void>(resolve => { let frames = 0; const tick = (): void => { if (++frames > 130) resolve(); else requestAnimationFrame(tick); }; requestAnimationFrame(tick); }));
    assert.equal(await page.evaluate(() => (window as unknown as ToolWindow).cleanPaints), 0);
    assert.equal((await capabilities()).document, false);
    assert.equal((await capabilities()).editDocument, false);
    await assert.rejects(call('lolly_read_document'), /Open a Design document/);
    await assert.rejects(call('lolly_preview_document', { documentId: 'loading' }), /Open a Design document/);
    release();
    await page.waitForFunction(() => (window as unknown as ToolWindow).documentReady);
    assert.ok(await page.evaluate(() => (window as unknown as ToolWindow).cleanPaints) > 0);
    const doc = await call('lolly_read_document') as { documentId: string };
    const preview = await call('lolly_preview_document', { documentId: doc.documentId }) as { svg: string };
    assert.match(preview.svg, /<svg/);
    const artboards = await page.evaluate(svg => Array.from(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelectorAll('rect')).filter(rect => rect.getAttribute('fill') === 'rgb(255,255,255)').map(rect => Number(rect.getAttribute('x'))), preview.svg);
    assert.deepEqual(artboards, boxes.map(box => box.x));
    await page.evaluate(() => { (window as unknown as ToolWindow).documentReady = false; window.dispatchEvent(new CustomEvent('lolly:remount')); });
    await page.waitForFunction(() => (window as unknown as ToolWindow).documentReady);
    await call('lolly_read_document');
    assert.deepEqual(errors, []);
  } finally {
    release(); await context.close(); await browser.close();
  }
});
