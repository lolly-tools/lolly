// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createMockHost } from '../packages/core/src/mock-host.ts';
import { inspectPreparation, applyPreparation } from '../engine/src/prepare.ts';
import type { PreparationRequest } from '../shells/web/src/lib/prepare-worker.ts';
import { registerSendTarget, unregisterSendTarget } from '../shells/web/src/lib/send-target.ts';
import { mountPreparationPanel } from '../shells/web/src/components/prepare/panel.ts';

class TestWorker {
  onmessage?: (event: { data: unknown }) => void;
  onerror?: () => void;
  stopped = false;
  static active = new Set<TestWorker>();
  constructor() { TestWorker.active.add(this); }
  terminate(): void { this.stopped = true; TestWorker.active.delete(this); }
  postMessage(request: PreparationRequest): void {
    void (async () => {
      try {
        const result = request.action === 'inspect' ? await inspectPreparation(request.sources, request.rules)
          : await applyPreparation(request.sources, request.inspection!, request.choices ?? [], request.remove);
        if (!this.stopped) this.onmessage?.({ data: { result } });
      } catch (error) { if (!this.stopped) this.onmessage?.({ data: { error: (error as Error).message } }); }
    })();
  }
}
async function until(check: () => boolean): Promise<void> {
  for (let i = 0; i < 100; i++) { if (check()) return; await new Promise(r => setTimeout(r, 5)); }
  assert.fail('Expected UI state did not appear');
}
test('shared review copies chosen bytes, avoids persistence and clears stale output and private state', async () => {
  const dom = new JSDOM('<main></main>', { url: 'https://local.test/#/prepare' });
  const saved = new Map(['window', 'document', 'Worker'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  Object.defineProperty(globalThis, 'window', { configurable: true, value: dom.window });
  Object.defineProperty(globalThis, 'document', { configurable: true, value: dom.window.document });
  Object.defineProperty(globalThis, 'Worker', { configurable: true, value: TestWorker });
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  const root = document.querySelector<HTMLElement>('main')!, host = createMockHost();
  const exported: { name: string; bytes: string }[] = [];
  host.export.download = async (blob, name) => { exported.push({ name, bytes: await blob.text() }); };
  let retained: { blob: Blob; meta: Record<string, unknown> } | undefined;
  Object.assign(host.assets, { _uploadUserAsset: async (record: { blob: Blob; meta: Record<string, unknown> }) => { retained = record; } });
  let sent = 0, cancelled = true;
  registerSendTarget({ id: 'prepare-test', kind: 'gdrive', label: 'Synthetic Drive', available: () => true, prepare: async () => cancelled ? null : { folder: 'chosen' }, send: async payload => { assert.equal(new TextDecoder().decode(payload.bytes), 'password=replacement'); assert.deepEqual(payload.choice, { folder: 'chosen' }); assert(!JSON.stringify(payload).includes('my-private-value')); sent++; return { label: 'Sent' }; } });
  const dispose = mountPreparationPanel(root, host);
  const click = (selector: string): void => { root.querySelector<HTMLButtonElement>(selector)!.click(); };
  try {
    const input = root.querySelector<HTMLTextAreaElement>('[data-text]')!;
    input.value = 'password=my-private-value'; input.dispatchEvent(new dom.window.Event('input'));
    click('[data-inspect]'); await until(() => Boolean(root.querySelector('[data-group]')));
    const replacement = root.querySelector<HTMLInputElement>('[data-replacement]')!; replacement.value = 'replacement'; replacement.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    click('[data-preview]'); await until(() => Boolean(root.querySelector('[data-copy]')));
    click('[data-copy]'); await until(() => host.inspect.clipboardText.length === 1);
    assert.equal(host.inspect.clipboardText[0], 'password=replacement');
    assert.equal(sent, 0);
    const send = [...root.querySelectorAll<HTMLButtonElement>('button')].find(b => b.textContent === 'Synthetic Drive')!;
    assert(send); send.click(); await new Promise(r => setTimeout(r, 5)); assert.equal(sent, 0);
    cancelled = false; send.click(); await until(() => sent === 1);
    assert.equal(host.inspect.state.size, 0); assert.equal(host.inspect.logs.length, 0); assert.equal(retained, undefined);
    click('[data-report]'); await until(() => exported.length === 1); assert(!exported[0]!.bytes.includes('my-private-value'));
    click('[data-library]'); await until(() => retained !== undefined);
    assert.equal(await retained!.blob.text(), 'password=replacement'); assert(!JSON.stringify(retained!.meta).includes('my-private-value'));
    click('[data-recipe-save]'); await until(() => exported.length === 2); assert(!exported[1]!.bytes.includes('replacement')); assert(!exported[1]!.bytes.includes('my-private-value'));
    input.value = 'password=changed'; input.dispatchEvent(new dom.window.Event('input'));
    assert.equal(root.querySelector('[data-copy]'), null); assert.equal(root.querySelector('[data-group]'), null);
    click('[data-inspect]'); await until(() => Boolean(root.querySelector('[data-group]')));
    click('[data-unchanged]'); await until(() => Boolean(root.querySelector('[data-copy]')));
    click('[data-copy]'); await until(() => host.inspect.clipboardText.length === 2); assert.equal(host.inspect.clipboardText[1], 'password=changed');
    click('[data-reset]'); await until(() => input.value === ''); assert(!root.textContent!.includes('my-private-value'));
    input.value = 'password=cancel-me'; click('[data-inspect]'); await new Promise(r => setTimeout(r, 0)); dispose();
    assert.equal(TestWorker.active.size, 0); assert.equal(root.childElementCount, 0); assert.equal(window.location.hash, '#/prepare');
  } finally {
    unregisterSendTarget('prepare-test'); dispose(); dom.window.close();
    for (const [key, descriptor] of saved) { if (descriptor) Object.defineProperty(globalThis, key, descriptor); else Reflect.deleteProperty(globalThis, key); }
  }
});
