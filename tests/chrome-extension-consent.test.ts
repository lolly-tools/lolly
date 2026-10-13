// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

type RecordValue = Record<string, any>;
const directory = new URL('../shells/chrome-extension/', import.meta.url);

function harness() {
  let now = 1000;
  let nextId = 10;
  let activeDocument = 'caller-document';
  const timers = new Map<number, { callback: () => void; due: number; interval?: number }>();
  const events = (): RecordValue => {
    const listeners = new Set<(...args: any[]) => void>();
    return { addListener(fn: (...args: any[]) => void) { listeners.add(fn); }, removeListener(fn: (...args: any[]) => void) { listeners.delete(fn); }, emit(...args: any[]) { for (const fn of [...listeners]) fn(...args); } };
  };
  const schedule = (callback: () => void, delay: number, interval?: number): number => {
    const id = nextId++;
    timers.set(id, { callback, due: now + delay, ...(interval ? { interval } : {}) });
    return id;
  };
  const advance = (ms: number): void => {
    now += ms;
    for (let turn = 0; turn < 100; turn++) {
      const ready = [...timers].filter(([, timer]) => timer.due <= now);
      if (!ready.length) break;
      for (const [id, timer] of ready) {
        timers.delete(id);
        if (timer.interval) timers.set(id, { ...timer, due: now + timer.interval });
        timer.callback();
      }
    }
  };
  const tabs = new Map<number, RecordValue>([[1, { id: 1, windowId: 2, url: 'https://lolly.tools/#/tool/url-shot', status: 'complete' }]]);
  const windows: RecordValue[] = [];
  const operations: RecordValue[] = [];
  const caller = { id: 'fixture-extension', origin: 'https://lolly.tools', url: tabs.get(1)!.url, frameId: 0, documentId: activeDocument, documentLifecycle: 'active', tab: { ...tabs.get(1)! } };
  let redirectedTarget: string | undefined;
  let permissionGranted = true;
  let holdRead = false;
  const chrome: RecordValue = {
    runtime: { id: caller.id, onMessage: events(), getURL: (path: string) => `chrome-extension://${caller.id}/${path}`, getPlatformInfo: async () => ({}) },
    storage: { session: { get: async () => ({}), set: async () => {} } },
    permissions: { contains: async () => permissionGranted },
    tabs: {
      onUpdated: events(), onRemoved: events(),
      get: async (id: number) => { if (!tabs.has(id)) throw new Error('No tab'); return tabs.get(id); },
      query: async ({ windowId }: RecordValue) => [...tabs.values()].filter(tab => tab.windowId === windowId),
      sendMessage: async (_id: number, _msg: unknown, opts: RecordValue) => {
        if (opts.documentId !== activeDocument || opts.frameId !== 0) throw new Error('No requesting document');
        return { url: tabs.get(1)!.url, origin: new URL(tabs.get(1)!.url).origin };
      },
      create: async ({ url }: RecordValue) => {
        const tab = { id: nextId++, windowId: 2, url: redirectedTarget ?? url, status: 'complete' };
        tabs.set(tab.id, tab); operations.push({ type: 'open-target', url }); return tab;
      },
      remove: async (id: number) => { tabs.delete(id); chrome.tabs.onRemoved.emit(id); operations.push({ type: 'close-tab', id }); },
    },
    windows: {
      onRemoved: events(),
      create: async (opts: RecordValue) => {
        const id = nextId++;
        const win = { id, ...opts, tabs: [{ id: nextId++, windowId: id, url: opts.url }] };
        tabs.set(win.tabs[0]!.id, win.tabs[0]!); windows.push(win); return win;
      },
      remove: async (id: number) => { chrome.windows.onRemoved.emit(id); },
    },
    debugger: {
      attach: async () => { operations.push({ type: 'debugger-attach' }); },
      detach: async () => {},
      sendCommand: async (_target: unknown, method: string) => { operations.push({ type: method }); return { data: 'AA==' }; },
    },
    scripting: { executeScript: async () => {
      operations.push({ type: 'read-page' });
      if (holdRead) return new Promise(() => {});
      return [{ result: { html: '<main>Fixture page</main>', cssTexts: [], assets: [], finalUrl: 'https://target.example.test/page' } }];
    } },
  };
  const context = vm.createContext({
    chrome, URL, crypto: { randomUUID: () => `request-${nextId++}` },
    Date: class extends Date { static now(): number { return now; } },
    setTimeout: (fn: () => void, ms: number) => schedule(fn, ms), clearTimeout: (id: number) => timers.delete(id),
    setInterval: (fn: () => void, ms: number) => schedule(fn, ms, ms), clearInterval: (id: number) => timers.delete(id),
    importScripts: (...files: string[]) => { for (const file of files) vm.runInContext(readFileSync(new URL(file, directory), 'utf8'), context); },
  });
  vm.runInContext(readFileSync(new URL('background.js', directory), 'utf8'), context);
  const dispatch = (message: RecordValue, sender: RecordValue = caller): Promise<RecordValue> => new Promise(resolve => {
    chrome.runtime.onMessage.emit(message, sender, resolve);
  });
  const settle = async (): Promise<void> => { for (let i = 0; i < 200; i++) { await Promise.resolve(); advance(0); } };
  const consent = (): { sender: RecordValue; requestId: string } => {
    const win = windows.at(-1)!;
    const tab = win.tabs[0]!;
    return { requestId: new URL(tab.url).searchParams.get('request')!, sender: {
      id: caller.id, origin: `chrome-extension://${caller.id}`, url: tab.url, frameId: 0,
      documentId: 'consent-document', documentLifecycle: 'active', tab: { ...tab },
    } };
  };
  return { caller, dispatch, settle, consent, chrome, windows, operations, advance, tabs,
    setDocument(value: string) { activeDocument = value; },
    setRedirect(value: string) { redirectedTarget = value; },
    setPermission(value: boolean) { permissionGranted = value; },
    holdRead() { holdRead = true; },
  };
}

const request = { type: 'lolly-capture', spec: { url: 'https://target.example.test/page', waitMs: 0 } };

test('only active, exact-origin, top-level browser senders can request approval', async () => {
  for (const change of [
    { id: 'other-extension' }, { origin: 'https://preview.lolly.tools' }, { frameId: 1 },
    { documentId: '' }, { documentLifecycle: 'prerender' }, { url: 'https://other.example.test/' },
    { tab: { id: 1, url: 'https://other.example.test/' } },
  ]) {
    const h = harness();
    const response = await h.dispatch(request, { ...h.caller, ...change });
    assert.equal(response.ok, false);
    assert.equal(h.windows.length, 0);
    assert.equal(h.operations.length, 0);
  }
});

test('opening approval reads no target, and approval is bound to its protected page', async () => {
  const h = harness();
  const result = h.dispatch(request);
  await h.settle();
  assert.equal(h.windows.length, 1);
  assert.equal(h.operations.length, 0);
  const { requestId, sender } = h.consent();
  assert.equal((await h.dispatch({ type: 'lolly-capture/approve', requestId }, h.caller)).ok, false);
  assert.equal((await h.dispatch({ type: 'lolly-capture/approve', requestId }, { ...sender, tab: { ...sender.tab, id: 999 } })).ok, false);
  const shown = await h.dispatch({ type: 'lolly-capture/consent', requestId }, sender);
  assert.equal(shown.origin, 'https://lolly.tools');
  assert.equal(shown.target, request.spec.url);
  assert.equal(shown.permissionPattern, 'https://target.example.test/*');
  assert.equal((await h.dispatch({ type: 'lolly-capture/approve', requestId }, { ...sender, documentId: 'replacement-document' })).ok, false);
  await h.dispatch({ type: 'lolly-capture/cancel', requestId }, sender);
  assert.equal((await result).ok, false);
  assert.equal(h.operations.length, 0);
});

test('a competing request does not replace the pending approval', async () => {
  const h = harness();
  const result = h.dispatch(request);
  await h.settle();
  const first = h.consent();
  assert.equal((await h.dispatch({ type: 'lolly-capture/site', url: 'https://second.example.test/' })).ok, false);
  assert.equal(h.windows.length, 1);
  assert.equal((await h.dispatch({ type: 'lolly-capture/consent', requestId: first.requestId }, first.sender)).target, request.spec.url);
  await h.dispatch({ type: 'lolly-capture/cancel', requestId: first.requestId }, first.sender);
  await result;
});

test('expiry and closing approval cancel without page access; old approvals cannot be replayed', async () => {
  for (const mode of ['expire', 'close']) {
    const h = harness();
    const result = h.dispatch(request);
    await h.settle();
    const first = h.consent();
    if (mode === 'expire') h.advance(30_000);
    else h.chrome.windows.onRemoved.emit(first.sender.tab.windowId);
    assert.equal((await result).ok, false);
    const next = h.dispatch(request);
    await h.settle();
    assert.equal((await h.dispatch({ type: 'lolly-capture/approve', requestId: first.requestId }, first.sender)).ok, false);
    const second = h.consent();
    await h.dispatch({ type: 'lolly-capture/cancel', requestId: second.requestId }, second.sender);
    await next;
    assert.equal(h.operations.length, 0);
  }
});

test('approval requires site permission and the original requesting document', async () => {
  for (const mode of ['permission', 'document']) {
    const h = harness();
    const result = h.dispatch(request);
    await h.settle();
    const consent = h.consent();
    if (mode === 'permission') h.setPermission(false);
    else h.setDocument('new-caller-document');
    await h.dispatch({ type: 'lolly-capture/approve', requestId: consent.requestId }, consent.sender);
    await h.settle();
    assert.equal((await result).ok, false);
    assert.equal(h.operations.length, 0);
  }
});

test('one approval enables one bounded screenshot and cannot be reused', async () => {
  const h = harness();
  const result = h.dispatch(request);
  await h.settle();
  const consent = h.consent();
  await h.dispatch({ type: 'lolly-capture/approve', requestId: consent.requestId }, consent.sender);
  await h.settle();
  assert.equal((await result).dataUrl, 'data:image/png;base64,AA==');
  assert.equal(h.operations.filter(op => op.type === 'Page.captureScreenshot').length, 1);
  assert.equal(h.operations.filter(op => op.type === 'open-target').length, 1);
  assert.equal((await h.dispatch({ type: 'lolly-capture/approve', requestId: consent.requestId }, consent.sender)).ok, false);
});

test('a cross-origin target navigation ends the request before reading or capture', async () => {
  for (const type of ['lolly-capture', 'lolly-capture/site']) {
    const h = harness();
    h.setRedirect('https://other.example.test/');
    const result = h.dispatch(type === 'lolly-capture' ? request : { type, url: request.spec.url });
    await h.settle();
    const consent = h.consent();
    await h.dispatch({ type: 'lolly-capture/approve', requestId: consent.requestId }, consent.sender);
    await h.settle();
    h.advance(600); await h.settle();
    assert.equal((await result).ok, false);
    assert.equal(h.operations.some(op => op.type === 'read-page' || op.type === 'debugger-attach'), false);
  }
});

test('page contents return only after consent, and an unfinished read expires', async () => {
  for (const timeout of [false, true]) {
    const h = harness();
    if (timeout) h.holdRead();
    const result = h.dispatch({ type: 'lolly-capture/site', url: request.spec.url });
    await h.settle();
    assert.equal(h.operations.length, 0);
    const consent = h.consent();
    await h.dispatch({ type: 'lolly-capture/approve', requestId: consent.requestId }, consent.sender);
    await h.settle(); h.advance(600); await h.settle();
    if (timeout) { h.advance(55_000); await h.settle(); }
    const response = await result;
    assert.equal(response.ok, !timeout);
    if (!timeout) assert.equal(response.html, '<main>Fixture page</main>');
    assert.equal(h.operations.filter(op => op.type === 'read-page').length, 1);
    assert.equal(h.tabs.size, 2);
  }
});

test('protected approval requests site access only from a trusted button click', async () => {
  const nodes = new Map<string, RecordValue>();
  const calls: string[] = [];
  const info = { ok: true, requestId: 'fixture', origin: 'https://lolly.tools', target: request.spec.url, reading: 'page contents', permissionPattern: 'https://target.example.test/*', expiresAt: Date.now() + 30_000 };
  const document = { getElementById(id: string) {
    if (!nodes.has(id)) nodes.set(id, { disabled: id === 'approve', textContent: '', addEventListener(_event: string, callback: (event: unknown) => void) { this.click = callback; } });
    return nodes.get(id);
  } };
  const chrome = { runtime: { lastError: undefined, async sendMessage(msg: RecordValue) { calls.push(msg.type); return msg.type === 'lolly-capture/consent' ? info : { ok: true }; } }, permissions: { request(_opts: unknown, callback: (granted: boolean) => void) { calls.push('permissions'); callback(true); } } };
  vm.runInNewContext(readFileSync(new URL('consent.js', directory), 'utf8'), { URL, location: { href: 'chrome-extension://fixture/consent.html?request=fixture' }, document, chrome, window: { close() {} } });
  for (let i = 0; i < 20; i++) await Promise.resolve();
  nodes.get('approve')!.click({ isTrusted: false });
  assert.deepEqual(calls, ['lolly-capture/consent']);
  nodes.get('approve')!.click({ isTrusted: true });
  assert.deepEqual(calls, ['lolly-capture/consent', 'permissions', 'lolly-capture/approve']);
});
