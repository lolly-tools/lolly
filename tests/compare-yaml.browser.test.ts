// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page, type Locator } from 'playwright';
import { shellSettled } from './helpers/shell-settled.ts';
import { yamlEquivalentBefore, yamlEquivalentAfter, yamlChangedBefore, yamlChangedAfter, yamlRefusedBefore, yamlRefusedAfter } from './helpers/compare-yaml-fixtures.ts';

const origin = process.env.LOLLY_HISTORY_TEST_URL || process.env.LOLLY_EXPORT_TEST_URL;
const skip = origin ? false : 'Set LOLLY_HISTORY_TEST_URL or LOLLY_EXPORT_TEST_URL (serve the web shell locally)';
if (origin) assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(origin).hostname));
const digest = (text: string): string => createHash('sha256').update(text).digest('hex');
const file = (text: string, name: string) => ({ name, mimeType: 'application/yaml', buffer: Buffer.from(text) });
interface WorkerRecord {
  beforeKind: string; afterKind: string; beforeHash?: string; afterHash?: string; terminated: boolean;
  result?: { mode: string; equality: string; byteEquality: string; completeness: string; limitations: string[]; summary: { total: number }; changes: unknown[] };
}
interface ProviderRecord { changed: boolean; gets: Array<{ id: string; version?: string }>; reads: string[] }
declare global {
  interface Window { __yamlWorkers: WorkerRecord[]; __yamlProvider?: ProviderRecord; __yamlAbortAfterPost?: () => void }
}

async function watchWorkers(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.__yamlWorkers = [];
    const Original = window.Worker;
    window.Worker = class extends Original {
      private comparison: WorkerRecord | undefined;
      private observesComparison = false;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        this.observesComparison = String(url).includes('compare-worker');
        if (this.observesComparison) {
          this.addEventListener('message', ({ data }) => { if (this.comparison && data.result) this.comparison.result = data.result; });
        }
      }
      override postMessage(message: unknown, transfer: Transferable[]): void;
      override postMessage(message: unknown, options?: StructuredSerializeOptions): void;
      override postMessage(message: unknown, options?: Transferable[] | StructuredSerializeOptions): void {
        const input = message as { request?: { before: { content: { kind: string }; bytes?: Uint8Array }; after: { content: { kind: string }; bytes?: Uint8Array } } };
        if (this.observesComparison && input.request) {
          const record: WorkerRecord = { beforeKind: input.request.before.content.kind, afterKind: input.request.after.content.kind, terminated: false };
          this.comparison = record; window.__yamlWorkers.push(record);
          const hash = async (bytes?: Uint8Array): Promise<string | undefined> => bytes
            ? [...new Uint8Array(await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)))].map(value => value.toString(16).padStart(2, '0')).join('') : undefined;
          void Promise.all([hash(input.request.before.bytes), hash(input.request.after.bytes)]).then(([before, after]) => { record.beforeHash = before; record.afterHash = after; });
        }
        if (Array.isArray(options)) super.postMessage(message, options); else super.postMessage(message, options);
        if (this.observesComparison && window.__yamlAbortAfterPost) {
          const abort = window.__yamlAbortAfterPost; delete window.__yamlAbortAfterPost; abort();
        }
      }
      override terminate(): void { if (this.comparison) this.comparison.terminated = true; super.terminate(); }
    };
  });
}
async function lastWorker(page: Page): Promise<WorkerRecord> {
  await page.waitForFunction(() => { const job = window.__yamlWorkers.at(-1); return !!job?.result && !!job.beforeHash && !!job.afterHash; });
  return page.evaluate(() => window.__yamlWorkers.at(-1)!);
}
async function report(root: Locator, page: Page): Promise<string> {
  const pending = page.waitForEvent('download'); await root.getByRole('button', { name: 'Download comparison report', exact: true }).click();
  const stream = await (await pending).createReadStream(); let text = ''; for await (const chunk of stream!) text += chunk.toString(); return text;
}
async function privateState(page: Page, requests: string[]): Promise<void> {
  const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage }, url: location.href }));
  assert.doesNotMatch(stored, /PRIVATE_YAML_|CONFIDENTIAL_YAML_/);
  assert.doesNotMatch(requests.join('\n'), /PRIVATE_YAML_|CONFIDENTIAL_YAML_/);
}
async function refused(root: Locator): Promise<void> {
  await root.getByText(/YAML.*(?:unsupported|not supported|could not|cannot|unavailable|refused)/i).first().waitFor();
  const diagnostics = await root.locator('[role="status"], .compare-limit').allTextContents();
  assert.doesNotMatch(diagnostics.join('\n'), /PRIVATE_YAML_ANCHOR|CONFIDENTIAL_YAML_PARSER_|line \d|column \d/i);
  assert.equal(await root.locator('.compare-change').count(), 0);
}

test('YAML utility uses the real worker, separates structure from Text, refuses unsafe syntax and keeps private reports', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const errors: string[] = [], requests: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url() + (request.postData() ?? '')));
  try {
    await watchWorkers(page); await page.goto(`${origin}/#/compare?mode=yaml`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const mode = page.getByLabel('Comparison mode', { exact: true }); assert.equal(await mode.inputValue(), 'yaml');
    await page.getByLabel('Before file', { exact: true }).setInputFiles(file(yamlEquivalentBefore, 'CONFIDENTIAL_YAML_before.yaml'));
    await page.getByLabel('After file', { exact: true }).setInputFiles(file(yamlEquivalentAfter, 'CONFIDENTIAL_YAML_after.yml'));
    await page.getByRole('button', { name: 'Compare', exact: true }).click();
    await page.getByText('The compared content is equivalent with these options.', { exact: true }).waitFor();
    const semantic = await lastWorker(page); assert.equal(semantic.beforeKind, 'yaml'); assert.equal(semantic.afterKind, 'yaml');
    assert.equal(semantic.result?.mode, 'structure'); assert.equal(semantic.result?.byteEquality, 'different');
    assert.equal(semantic.beforeHash, digest(yamlEquivalentBefore)); assert.equal(semantic.afterHash, digest(yamlEquivalentAfter));
    assert.doesNotMatch(await report(page.locator('.compare-panel'), page), /PRIVATE_YAML_|CONFIDENTIAL_YAML_|service|replicas|text-0/);
    await mode.selectOption('text'); await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.locator('.compare-change').first().waitFor();
    const literal = await lastWorker(page); assert.equal(literal.result?.mode, 'text'); assert.ok(literal.result!.summary.total > 0);
    assert.equal(literal.beforeHash, semantic.beforeHash); assert.equal(literal.afterHash, semantic.afterHash);
    await mode.selectOption('yaml');
    await page.getByLabel('Before file', { exact: true }).setInputFiles(file(yamlRefusedBefore, 'before.yaml'));
    await page.getByLabel('After file', { exact: true }).setInputFiles(file(yamlRefusedAfter, 'after.yaml'));
    await page.getByRole('button', { name: 'Compare', exact: true }).click(); await refused(page.locator('.compare-panel'));
    const refusedReport = await report(page.locator('.compare-panel'), page);
    assert.equal(JSON.parse(refusedReport).equality, 'undetermined'); assert.equal(JSON.parse(refusedReport).completeness, 'partial');
    assert.doesNotMatch(refusedReport, /PRIVATE_YAML_|CONFIDENTIAL_YAML_|before.yaml|after.yaml|anchors|limitations/);
    const evidence = process.env.LOLLY_YAML_EVIDENCE_DIR || 'plans/229-yaml-evidence-20261012'; mkdirSync(evidence, { recursive: true });
    await page.screenshot({ path: join(evidence, 'yaml-refusal-mobile.png'), fullPage: true });
    await mode.selectOption('text'); await page.getByRole('button', { name: 'Compare', exact: true }).click(); await page.locator('.compare-change').first().waitFor();
    const fallback = await lastWorker(page); assert.equal(fallback.beforeHash, digest(yamlRefusedBefore)); assert.equal(fallback.afterHash, digest(yamlRefusedAfter));
    assert.equal(fallback.result?.completeness, 'complete'); assert.deepEqual(fallback.result!.limitations, []);
    assert.equal(await page.locator('.compare-change[open]').count(), 0);
    await page.getByRole('button', { name: 'Next change', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal(await page.locator('.compare-change summary').first().evaluate(element => element === document.activeElement), true);
    await page.keyboard.press('Enter'); await page.locator('.compare-change[open]').first().waitFor();
    assert.doesNotMatch(await report(page.locator('.compare-panel'), page), /PRIVATE_YAML_|CONFIDENTIAL_YAML_|before.yaml|after.yaml/);
    await page.evaluate(() => { document.documentElement.dataset.a11yText = 'large'; document.documentElement.dataset.a11yContrast = 'high'; document.documentElement.dataset.a11yMotion = 'reduce'; });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: join(evidence, 'yaml-text-fallback-mobile.png'), fullPage: true });
    await page.locator('.compare-panel').evaluate(panel => {
      const buttons = [...panel.querySelectorAll('button')]; buttons.find(button => button.textContent === 'Compare again')!.click(); buttons.find(button => button.textContent === 'Cancel comparison')!.click();
    });
    await page.getByText('Comparison cancelled.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__yamlWorkers.at(-1)!.terminated), true);
    assert.equal(await page.locator('.compare-change').count(), 0);
    const cancellation = await page.evaluate(async () => {
      const hostPath = '/src/lib/host-ref.ts', host = (await import(hostPath)).getHostRef(), controller = new AbortController();
      const source = { identity: { id: 'yaml-cancel', kind: 'text', label: 'Cancel fixture' }, content: { kind: 'yaml', text: Array.from({ length: 5_000 }, (_value, index) => `key${index}: ${index}`).join('\n') } };
      window.__yamlAbortAfterPost = () => controller.abort();
      const pending = host.compare.run({ version: 1, before: source, after: source, options: { mode: 'structure' } }, { signal: controller.signal });
      try { await pending; return 'resolved'; } catch (error) { return error instanceof Error ? error.name : 'unknown'; }
    });
    assert.equal(cancellation, 'AbortError');
    assert.deepEqual(await page.evaluate(() => { const job = window.__yamlWorkers.at(-1)!; return { kind: job.beforeKind, terminated: job.terminated, result: job.result }; }), { kind: 'yaml', terminated: true, result: undefined });
    await privateState(page, requests); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('YAML utility, catalog and verified operation compare the same bytes and options through the worker', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  try {
    await watchWorkers(page); await page.goto(`${origin}/#/compare?mode=yaml`, { waitUntil: 'networkidle' }); await shellSettled(page);
    const evidence = await page.evaluate(async ({ before, after }) => {
      const hostPath = '/src/lib/host-ref.ts', sourcePath = '/src/lib/compare-sources.ts', operationPath = '/src/lib/compare-operation-sources.ts', assetPath = '/src/lib/compare-asset-sources.ts', panelPath = '/src/components/compare-operation.ts';
      const host = (await import(hostPath)).getHostRef(), sources = await import(sourcePath), operations = await import(operationPath), assets = await import(assetPath);
      const files = [new File([before], 'CONFIDENTIAL_YAML_original.yaml'), new File([after], 'CONFIDENTIAL_YAML_copy.yml')];
      const utility = await Promise.all(files.map(file => sources.comparisonFileSource(file, 'yaml'))), operation = await operations.operationComparisonPair(files[0], files[1], host);
      const assetHost = { assets: { get: async (id: string) => ({ id, format: 'yaml', version: 'captured' }), bytes: async (ref: { id: string }) => new Uint8Array(await files[Number(ref.id)]!.arrayBuffer()) } };
      const asset = await assets.comparisonAssetPair([{ id: '0', format: 'yaml', version: 'captured' }, { id: '1', format: 'yaml', version: 'captured' }], assetHost);
      const requests = [{ version: 1, before: utility[0], after: utility[1] }, operation.request, asset.request];
      const results = await Promise.all(requests.map(request => host.compare.run({ ...request, options: { mode: 'structure', arrayAlignment: 'id', maxChanges: 20 } })));
      const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', await files[0]!.arrayBuffer()))].map(value => value.toString(16).padStart(2, '0')).join('');
      (await import(panelPath)).openOperationComparison(host, files[1], { expected: { name: 'CONFIDENTIAL_YAML_original.yaml', mime: '', format: 'yaml', size: files[0]!.size, sha256 } });
      return results.map(result => ({ summary: result.summary, changes: result.changes, mode: result.mode, equality: result.equality, byteEquality: result.byteEquality, options: result.options }));
    }, { before: yamlChangedBefore, after: yamlChangedAfter });
    assert.deepEqual(evidence[0], evidence[1]); assert.deepEqual(evidence[1], evidence[2]); assert.equal(evidence[0]!.mode, 'structure');
    const dialog = page.getByRole('dialog', { name: 'Compare original and copy' });
    await dialog.getByLabel('Choose the original file').setInputFiles(file(yamlChangedBefore.replace('north', 'wrong'), 'wrong.yaml'));
    await dialog.getByText('That file does not match the recorded original.', { exact: true }).waitFor();
    assert.equal(await dialog.locator('.compare-change').count(), 0);
    await dialog.getByLabel('Choose the original file').setInputFiles(file(yamlChangedBefore, 'renamed.txt'));
    const mode = dialog.getByLabel('YAML comparison', { exact: true }); await mode.waitFor(); assert.equal(await mode.inputValue(), 'yaml');
    await dialog.getByLabel('Match array items by unique id', { exact: true }).check(); await dialog.getByText(`${evidence[0]!.summary.total} changes found`, { exact: true }).waitFor();
    const structured = await lastWorker(page); assert.equal(structured.beforeHash, digest(yamlChangedBefore)); assert.equal(structured.afterHash, digest(yamlChangedAfter));
    await mode.selectOption('text'); await dialog.getByLabel('Text comparison detail', { exact: true }).waitFor(); await dialog.locator('.compare-change').first().waitFor();
    const text = await lastWorker(page); assert.equal(text.result?.mode, 'text'); assert.equal(text.beforeHash, structured.beforeHash); assert.equal(text.afterHash, structured.afterHash);
    assert.doesNotMatch(await report(dialog, page), /PRIVATE_YAML_|CONFIDENTIAL_YAML_|renamed.txt|north|south/);
    await dialog.getByRole('button', { name: 'Close comparison' }).focus(); await page.keyboard.press('Enter'); await dialog.waitFor({ state: 'detached' });
    assert.ok(await page.evaluate(() => window.__yamlWorkers.length >= 6));
  } finally { await browser.close(); }
});

test('catalog YAML fallback reuses captured current and pinned bytes after provider changes', { skip, timeout: 90_000 }, async () => {
  const browser = await chromium.launch(), page = await browser.newPage();
  const errors: string[] = [], requests: string[] = []; page.on('pageerror', error => errors.push(error.message)); page.on('request', request => requests.push(request.url() + (request.postData() ?? '')));
  try {
    await watchWorkers(page); await page.goto(`${origin}/#/compare`, { waitUntil: 'networkidle' }); await shellSettled(page);
    await page.evaluate(async ({ before, after }) => {
      const hostPath = '/src/lib/host-ref.ts', panelPath = '/src/components/compare-assets.ts'; const host = (await import(hostPath)).getHostRef();
      const state: ProviderRecord = { changed: false, gets: [], reads: [] }; window.__yamlProvider = state;
      const assetHost = { ...host, assets: { ...host.assets,
        get: async (id: string, options: { version?: string }) => { state.gets.push({ id, version: options.version }); return { id, format: id === 'before' ? 'yaml' : 'yml', version: options.version ?? (state.changed ? 'updated-current' : 'captured-current'), meta: { name: `CONFIDENTIAL_YAML_${id}` } }; },
        bytes: async (ref: { id: string }) => { state.reads.push(ref.id); return new TextEncoder().encode(state.changed ? 'changed_provider: PRIVATE_YAML_NEW_BYTES\n' : ref.id === 'before' ? before : after); },
      } };
      (await import(panelPath)).openAssetComparison(assetHost, [{ id: 'before', format: 'yaml' }, { id: 'after', format: 'yml', version: 'captured-pin' }]);
    }, { before: yamlRefusedBefore, after: yamlRefusedAfter });
    const dialog = page.getByRole('dialog', { name: 'Compare assets' }), mode = dialog.getByLabel('YAML comparison', { exact: true });
    await mode.waitFor(); await refused(dialog); assert.equal(await mode.inputValue(), 'yaml');
    await page.evaluate(() => { window.__yamlProvider!.changed = true; });
    await mode.selectOption('text'); await dialog.locator('.compare-change').first().waitFor(); const fallback = await lastWorker(page);
    assert.equal(fallback.beforeHash, digest(yamlRefusedBefore)); assert.equal(fallback.afterHash, digest(yamlRefusedAfter)); assert.equal(fallback.result?.mode, 'text');
    assert.equal(fallback.result?.completeness, 'complete'); assert.deepEqual(fallback.result!.limitations, []);
    assert.deepEqual(await page.evaluate(() => window.__yamlProvider!.gets), [{ id: 'before', version: undefined }, { id: 'after', version: 'captured-pin' }]);
    assert.deepEqual(await page.evaluate(() => window.__yamlProvider!.reads), ['before', 'after']);
    assert.doesNotMatch(await report(dialog, page), /PRIVATE_YAML_|CONFIDENTIAL_YAML_|captured-current|captured-pin/);
    await mode.selectOption('yaml'); await refused(dialog);
    assert.deepEqual(await page.evaluate(() => window.__yamlProvider!.reads), ['before', 'after']);
    await mode.selectOption('text'); await dialog.locator('.compare-change').first().waitFor(); const again = await lastWorker(page);
    assert.equal(again.beforeHash, fallback.beforeHash); assert.equal(again.afterHash, fallback.afterHash);
    await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'detached' });
    await privateState(page, requests); assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
