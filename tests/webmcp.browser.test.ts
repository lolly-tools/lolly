// SPDX-License-Identifier: MPL-2.0
/** Exercises browser tool registration against the mounted web shell with a test modelContext. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { Page } from 'playwright';
import { getBrowser, closeBrowser } from '../packages/node-shell/src/browsers.ts';
import type { SiteToolDefinition } from '../shells/web/src/lib/site-tools.ts';
import type { LiveDocumentV1 } from '../packages/core/src/live-v1.ts';

type ToolWindow = Window & { siteTestTools?: Map<string, SiteToolDefinition> };
const origin = process.env.LOLLY_EXPORT_TEST_URL;
type ContextResult = { tool?: { id: string }; capabilities: { document: boolean; editDocument: boolean } };
async function call<T>(page: Page, name: string, args: Record<string, unknown> = {}): Promise<T> {
  return await page.evaluate(async ([toolName, input]) => {
    const tools = (window as ToolWindow).siteTestTools;
    const tool = tools?.get(toolName);
    if (!tool) throw new Error(`Site tool missing: ${toolName}. Available: ${[...tools?.keys() ?? []].join(', ')}. Page: ${location.href}`);
    return tool.execute(input);
  }, [name, args] as const) as T;
}
async function waitContext(page: Page, ready: (context: ContextResult) => boolean): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const result = await call<ContextResult>(page, 'lolly_read_context');
    if (ready(result)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error(`The site-tool context did not become ready: ${JSON.stringify(await call(page, 'lolly_read_context'))}. Page: ${(await page.locator('body').innerText()).slice(-1500)}`);
}

test('Lolly site tools discover tools and edit the mounted document through visible agent controls', {
  skip: origin ? false : 'no browser origin (set LOLLY_EXPORT_TEST_URL to a local web shell)', timeout: 180_000,
}, async () => {
  const browser = await getBrowser({ graphics: 'auto' });
  const context = await browser.newContext({ serviceWorkers: 'block', hasTouch: true, viewport: { width: 1440, height: 1000 } });
  try {
    await context.addInitScript(() => {
      const tools = new Map<string, SiteToolDefinition>(); (window as ToolWindow).siteTestTools = tools;
      Object.defineProperty(document, 'modelContext', { value: { registerTool(tool: SiteToolDefinition) { tools.set(tool.name, tool); }, unregisterTool(name: string) { tools.delete(name); } } });
    });
    const page = await context.newPage(); page.setDefaultTimeout(30_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => {
      if (dialog.type() === 'beforeunload') await dialog.accept();
      else { errors.push(`Unexpected browser dialog: ${dialog.type()}`); await dialog.dismiss(); }
    });
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.error(message.text()); });
    await page.goto(`${origin}/#/tool/qr-code?url=https%3A%2F%2Fexample.com`);
    await page.waitForFunction(() => (window as ToolWindow).siteTestTools?.has('lolly_undo_document_changes'));
    await waitContext(page, context => context.tool?.id === 'qr-code');
    const described = await call<{ inputs: Array<{ id: string; value: unknown }> }>(page, 'lolly_describe_tool', { id: 'qr-code' });
    assert.equal(described.inputs.find(input => input.id === 'url')?.value, 'https://example.com');
    const found = await call<{ items: Array<{ id: string }>; total: number }>(page, 'lolly_search_tools', { query: 'design', limit: 1 });
    assert.equal(found.items.length, 1); assert.ok(found.total >= 1);
    await assert.rejects(call(page, 'lolly_read_document'), /Open a Design document/);
    const boxes = [{ id: 'site-title', kind: 'text', x: 50, y: 50, w: 500, h: 100, text: 'Hello', fg: '#222222', fontSize: 36 }];
    await page.goto(`${origin}/#/tool/design?boxes=${encodeURIComponent(JSON.stringify(boxes))}`);
    await page.waitForFunction(() => (window as ToolWindow).siteTestTools?.has('lolly_undo_document_changes'));
    await waitContext(page, context => context.capabilities.document);
    const doc = await call<LiveDocumentV1>(page, 'lolly_read_document', { ids: ['site-title'] });
    const documentContext = await call<{ layerFields: unknown[] }>(page, 'lolly_read_document_context', { documentId: doc.documentId });
    assert.ok(documentContext.layerFields.length > 0);
    assert.equal(doc.rows.length, 1);
    const args = { documentId: doc.documentId, ifRevision: doc.revision, transactionId: 'browser-move', label: 'Update title', layerPatches: [{ id: 'site-title', set: { text: 'Hello agents' } }] };
    await call(page, 'lolly_apply_document_changes', args);
    assert.equal((await call<{ replayed: boolean }>(page, 'lolly_apply_document_changes', args)).replayed, true);
    await page.locator('#tool-canvas').getByText('Hello agents', { exact: true }).waitFor();
    const preview = await call<{ svg: string }>(page, 'lolly_preview_document', { documentId: doc.documentId });
    assert.match(preview.svg, /<svg/);
    await page.locator('.collab-stack').click();
    await page.locator('.collab-roster').getByText('Browser agent', { exact: true }).waitFor();
    await page.locator('[data-agent-action="pause"]').click();
    const paused = await call<{ capabilities: { editDocument: boolean } }>(page, 'lolly_read_context');
    assert.equal(paused.capabilities.editDocument, false);
    await assert.rejects(call(page, 'lolly_apply_document_changes', { ...args, transactionId: 'paused' }), /paused/);
    await page.locator('[data-agent-action="pause"]').click();
    await call(page, 'lolly_undo_document_changes', { documentId: doc.documentId });
    const undone = await call<LiveDocumentV1>(page, 'lolly_read_document', { ids: ['site-title'] });
    assert.equal((undone.rows[0] as { text: string }).text, 'Hello');
    await page.locator('[data-agent-action="disconnect"]').click();
    await assert.rejects(call(page, 'lolly_read_document'), /disconnected/);
    // The touch roster closes by popping its history entry before we leave.
    await page.evaluate(async () => {
      const path = '/src/lib/overlay-back.ts';
      const { overlaysClosed } = await import(path);
      await overlaysClosed();
    });
    await page.goto(`${origin}/#/p`);
    await page.waitForFunction(() => (window as ToolWindow).siteTestTools?.has('lolly_read_project'));
    await page.locator('.projects').waitFor();
    assert.equal((await call<{ kind: string }>(page, 'lolly_read_project')).kind, 'local');
    await assert.rejects(call(page, 'lolly_read_document'), /Open a Design document/);
    await page.goto(`${origin}/#/a`);
    await page.locator('.updz-input').setInputFiles({ name: 'Inspector.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" fill="#ff3300"/></svg>') });
    const tile = page.locator('.cat-tile').filter({ hasText: 'Inspector.svg' });
    await tile.locator('.cat-tile-open').click();
    const inspector = page.locator('dialog.cat-details');
    await inspector.locator('.cat-edit-toolbar').waitFor();
    const provenance = await inspector.locator('.cat-details-provenance').boundingBox(), sharing = await inspector.locator('.cat-details-actions').boundingBox();
    assert.ok(provenance && sharing && provenance.y < sharing.y);
    const theme = inspector.locator('.cat-inspect-theme'), initialTheme = await theme.getAttribute('data-theme');
    await theme.click(); assert.notEqual(await theme.getAttribute('data-theme'), initialTheme);
    await inspector.getByRole('button', { name: 'Claim authorship', exact: true }).click();
    await page.locator('.modal-input').fill('Ada Example');
    await page.getByRole('button', { name: 'Save declaration', exact: true }).click();
    await inspector.locator('[data-authorship]').getByText('Ada Example · self-declared', { exact: true }).waitFor();
    await inspector.locator('[data-act="origin-partial"]').click();
    // The control becomes pressed after its asynchronous metadata save completes.
    await inspector.locator('[data-act="origin-partial"][aria-pressed="true"]').waitFor();
    const uploaded = await call<{ items: Array<{ id: string }> }>(page, 'lolly_search_assets', { scope: 'uploads', query: 'Inspector.svg' });
    assert.equal(uploaded.items.length, 1);
    const metadata = await call<{ authorDeclaration: { name: string }; aiDisclosure: { kind: string; declaredByUser: boolean } }>(page, 'lolly_describe_asset', { scope: 'uploads', id: uploaded.items[0]!.id });
    assert.equal(metadata.authorDeclaration.name, 'Ada Example'); assert.deepEqual(metadata.aiDisclosure, { kind: 'partial', declaredByUser: true });
    await page.goto(`${origin}/#/a?asset=${encodeURIComponent(uploaded.items[0]!.id)}`);
    await page.waitForFunction(() => (window as ToolWindow).siteTestTools?.has('lolly_describe_asset'));
    await inspector.locator('[data-act="origin-partial"][aria-pressed="true"]').waitFor();
    const reopened = await call<typeof metadata>(page, 'lolly_describe_asset', { scope: 'uploads', id: uploaded.items[0]!.id });
    assert.equal(reopened.authorDeclaration.name, 'Ada Example'); assert.deepEqual(reopened.aiDisclosure, { kind: 'partial', declaredByUser: true });
    await inspector.locator('[data-act="close"]').click();
    await page.locator('.updz-input').setInputFiles({ name: 'Inspector-font.ttf', mimeType: 'font/ttf', buffer: await readFile(new URL('./fixtures/text-composition/fonts/notosansarabic/NotoSansArabic[wdth,wght].ttf', import.meta.url)) });
    await page.locator('.cat-tile').filter({ hasText: 'Inspector-font.ttf' }).waitFor();
    const fonts = await call<{ items: Array<{ id: string }> }>(page, 'lolly_search_assets', { scope: 'uploads', type: 'font', limit: 1 });
    assert.equal(fonts.items.length, 1);
    await page.goto(`${origin}/#/a?asset=${encodeURIComponent(fonts.items[0]!.id)}`);
    await page.locator('dialog.cat-details .asset-format-viewer').waitFor();
    assert.equal(await page.locator('dialog.cat-details .cat-edit-toolbar').isVisible(), true);
    assert.equal(await page.locator('dialog.cat-details .cat-inspect-theme').isVisible(), true);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${origin}/#/a?asset=${encodeURIComponent(uploaded.items[0]!.id)}`);
    const crop = page.locator('dialog.cat-details .cat-edit-tool[data-act="crop"]');
    const cropBox = await crop.boundingBox(); assert.ok(cropBox);
    await page.touchscreen.tap(cropBox.x + 18, cropBox.y + cropBox.height / 2);
    assert.equal(await crop.getAttribute('aria-expanded'), 'true');
    assert.equal(await page.locator('.cat-crop-work').count(), 0);
    const arrow = await crop.locator('.cat-edit-arrow').boundingBox(); assert.ok(arrow);
    await page.touchscreen.tap(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2);
    await page.locator('.cat-crop-work').waitFor();
    assert.deepEqual(errors, []);
    const plain = await browser.newContext({ serviceWorkers: 'block' });
    try {
      const unenhanced = await plain.newPage(), requests: string[] = [];
      unenhanced.on('request', request => requests.push(request.url()));
      await unenhanced.goto(`${origin}/#/tool/qr-code?url=https%3A%2F%2Fexample.com`);
      await unenhanced.locator('#tool-canvas').waitFor();
      assert.equal(requests.some(url => url.includes('site-tools-discovery')), false);
    } finally { await plain.close(); }
  } finally { await context.close(); await closeBrowser(); }
});
