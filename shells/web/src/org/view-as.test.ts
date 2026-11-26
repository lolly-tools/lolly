// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';
import { JSDOM } from 'jsdom';
import {
  clearCatalogCaches, markViewEnded, mountViewAsBanner, openViewAsSheet,
  startViewAs, stopViewAs, viewingAs, viewAsHeader, VIEW_AS_DB, type ViewAsState,
} from './view-as.ts';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const KEY = 'lolly-view-as';
const state = (): ViewAsState => ({
  token: 'view-token', expiresAt: new Date(Date.now() + 60_000).toISOString(),
  programme: { id: 'p1', name: 'Resellers, EMEA' }, company: { id: 'c1', name: 'Northwind IT' },
});
let session: MemoryStorage;
let local: MemoryStorage;
let reloads: number;
let deletions: string[];
const saved = new Map<string, PropertyDescriptor | undefined>();
function install(key: string, value: unknown): void {
  if (!saved.has(key)) saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}

beforeEach(() => {
  session = new MemoryStorage();
  local = new MemoryStorage();
  reloads = 0;
  deletions = [];
  install('sessionStorage', session);
  install('localStorage', local);
  install('location', { origin: 'https://work.test', reload: () => { reloads++; } });
  install('indexedDB', { deleteDatabase(name: string) {
    deletions.push(name);
    const request = {} as IDBOpenDBRequest;
    queueMicrotask(() => request.onsuccess?.call(request, new Event('success')));
    return request;
  } });
});

afterEach(() => {
  for (const [key, descriptor] of saved) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
  saved.clear();
});

test('state parsing drops malformed and expired values', () => {
  assert.equal(viewingAs(), null);
  const valid = state();
  for (const value of ['{', 'null', '[]', '{}', JSON.stringify({ ...valid, token: '' }),
    JSON.stringify({ ...valid, token: 'bad\ntoken' }), JSON.stringify({ ...valid, programme: null }),
    JSON.stringify({ ...valid, token: 'bad\u0000token' }),
    JSON.stringify({ ...valid, company: { id: 'c1' } }), JSON.stringify({ ...valid, expiresAt: 'tomorrow' }),
    JSON.stringify({ ...valid, expiresAt: new Date(Date.now() - 1).toISOString() })]) {
    session.setItem(KEY, value);
    assert.equal(viewingAs(), null, value);
    assert.equal(session.getItem(KEY), null);
  }
});

test('a valid tab state supplies the viewing header with or without a company', () => {
  const valid = state();
  session.setItem(KEY, JSON.stringify(valid));
  assert.deepEqual(viewingAs(), valid);
  assert.equal(viewAsHeader(), valid.token);
  delete valid.company;
  session.setItem(KEY, JSON.stringify(valid));
  assert.deepEqual(viewingAs(), valid);
  session.clear();
  assert.equal(viewAsHeader(), null);
});

test('catalog clearing removes only catalog keys and the exact tool index key', () => {
  const keep = ['sbt-catalog', 'sbt-tool-index:other', 'lolly-profile', 'lang', KEY];
  for (const key of [...keep, 'sbt-catalog:tool-index', 'sbt-catalog:assets-index', 'sbt-catalog:future', 'sbt-tool-index']) local.setItem(key, 'saved');
  clearCatalogCaches();
  assert.equal(local.length, keep.length);
  for (const key of keep) assert.equal(local.getItem(key), 'saved');
});

test('starting a view stores the 201 state, clears catalog caches and reloads', async () => {
  const valid = state();
  local.setItem('sbt-tool-index', 'old');
  const result = await startViewAs(async (url, init) => {
    assert.equal(url, '/api/v1/programmes/p%2F1/view-as');
    assert.equal(init?.method, 'POST');
    assert.equal(init?.credentials, 'same-origin');
    assert.deepEqual(JSON.parse(String(init?.body)), { company: 'c1' });
    return Response.json(valid, { status: 201 });
  }, 'p/1', 'c1');
  assert.equal(result, null);
  assert.deepEqual(viewingAs(), valid);
  assert.equal(local.getItem('sbt-tool-index'), null);
  assert.equal(reloads, 1);
});

test('programme-wide starts omit company and errors leave storage and the page alone', async () => {
  local.setItem('sbt-tool-index', 'old');
  const result = await startViewAs(async (_url, init) => {
    assert.deepEqual(JSON.parse(String(init?.body)), {});
    return Response.json({ error: { message: 'You do not manage this programme.' } }, { status: 403 });
  }, 'p1');
  assert.equal(result, 'You do not manage this programme.');
  assert.equal(session.getItem(KEY), null);
  assert.equal(local.getItem('sbt-tool-index'), 'old');
  assert.equal(reloads, 0);
  assert.ok(await startViewAs(async () => new Response('', { status: 500 }), 'p1'));
  assert.ok(await startViewAs(async () => Response.json({}, { status: 201 }), 'p1'));
  assert.ok(await startViewAs(async () => { throw new Error('offline'); }, 'p1'));
  assert.equal(reloads, 0);
});

test('stopping posts the token, deletes the viewing database, clears caches and reloads', async () => {
  session.setItem(KEY, JSON.stringify(state()));
  session.setItem('other-tab-setting', 'keep');
  local.setItem('sbt-catalog:assets-index', 'old');
  await stopViewAs(async (url, init) => {
    assert.equal(url, '/api/v1/view-as/end');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { token: 'view-token' });
    assert.equal(session.getItem(KEY) !== null, true);
    return new Response(null, { status: 204 });
  });
  assert.deepEqual(deletions, [VIEW_AS_DB]);
  assert.equal(session.getItem(KEY), null);
  assert.equal(session.getItem('other-tab-setting'), 'keep');
  assert.equal(local.getItem('sbt-catalog:assets-index'), null);
  assert.equal(reloads, 1);
});

test('stopping still clears the tab when the server fails or database deletion blocks or errors', async () => {
  for (const event of ['blocked', 'error'] as const) {
    session.setItem(KEY, JSON.stringify(state()));
    install('indexedDB', { deleteDatabase() {
      const request = {} as IDBOpenDBRequest;
      queueMicrotask(() => request[`on${event}`]?.call(request, new Event(event) as IDBVersionChangeEvent));
      return request;
    } });
    await stopViewAs(async () => { throw new Error('offline'); });
    assert.equal(session.getItem(KEY), null);
  }
  assert.equal(reloads, 2);
});

test('database deletion has a two second limit', async (ctx) => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  install('indexedDB', { deleteDatabase: () => ({}) });
  const stopped = stopViewAs(async () => new Response(null, { status: 204 }));
  assert.equal(reloads, 0);
  ctx.mock.timers.tick(2000);
  await stopped;
  assert.equal(reloads, 1);
});

test('the banner mounts once, measures its height, stays on Escape and reports an ended view', () => {
  session.setItem(KEY, JSON.stringify(state()));
  const dom = new JSDOM('<!doctype html><body></body>');
  const doc = dom.window.document;
  let measure: (() => void) | undefined;
  Object.defineProperty(dom.window, 'ResizeObserver', { value: class {
    constructor(fn: () => void) { measure = fn; }
    observe(): void {}
  } });
  let stops = 0;
  mountViewAsBanner(doc, () => { stops++; });
  mountViewAsBanner(doc, () => { stops++; });
  const banner = doc.querySelector<HTMLElement>('.view-as-banner')!;
  assert.equal(doc.querySelectorAll('.view-as-banner').length, 1);
  assert.equal(banner.getAttribute('role'), 'status');
  assert.match(banner.textContent!, /Viewing as Northwind IT · Resellers, EMEA/);
  assert.match(banner.textContent!, /Changes are not saved to the partner's account\./);
  assert.equal(doc.documentElement.dataset.viewingAs, '');
  banner.getBoundingClientRect = () => ({ height: 82.5 }) as DOMRect;
  measure?.();
  assert.equal(doc.documentElement.style.getPropertyValue('--view-as-h'), '83px');
  doc.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape' }));
  assert.equal(banner.isConnected, true);
  markViewEnded(doc);
  assert.equal(doc.querySelector('.view-as-banner-title')?.textContent, 'This view has ended.');
  doc.querySelector<HTMLButtonElement>('button')!.click();
  assert.equal(stops, 1);
  dom.window.close();
});

test('the sheet fills both selects, shows server errors inline and closes on Escape', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://work.test' });
  install('window', dom.window);
  install('document', dom.window.document);
  install('Element', dom.window.Element);
  install('HTMLElement', dom.window.HTMLElement);
  install('Node', dom.window.Node);
  const proto = dom.window.HTMLDialogElement.prototype;
  proto.showModal = function () { this.setAttribute('open', ''); };
  proto.close = function () { this.removeAttribute('open'); };
  const routes: string[] = [];
  const closed = openViewAsSheet({ fetchImpl: async (url) => {
    routes.push(url);
    if (url === '/api/v1/programmes') return Response.json({ programmes: [state().programme] });
    if (url.endsWith('/people')) return Response.json({ companies: [state().company] });
    return Response.json({ error: { message: 'Start refused.' } }, { status: 403 });
  } });
  for (let i = 0; i < 100 && !dom.window.document.querySelector<HTMLSelectElement>('select')?.options.length; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  const doc = dom.window.document;
  const selects = doc.querySelectorAll('select');
  assert.equal(selects[0]?.options[0]?.text, 'Resellers, EMEA');
  assert.equal(selects[1]?.options[0]?.text, 'Everyone in the programme');
  assert.equal(selects[1]?.options[1]?.text, 'Northwind IT');
  selects[1]!.value = 'c1';
  doc.querySelector<HTMLButtonElement>('.modal-primary')!.click();
  for (let i = 0; i < 100 && doc.querySelector<HTMLElement>('.view-as-error')?.hidden; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(doc.querySelector('.view-as-error')?.textContent, 'Start refused.');
  doc.querySelector('dialog')!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await closed;
  assert.equal(doc.querySelector('dialog'), null);
  assert.deepEqual(routes, ['/api/v1/programmes', '/api/v1/programmes/p1/people', '/api/v1/programmes/p1/view-as']);
  dom.window.close();
});

test('the account menu probes programme access lazily once and offers Stop viewing without probing', async () => {
  const dom = new JSDOM('<!doctype html><body><button id="avatar"></button><div id="menu"></div></body>', { url: 'https://work.test' });
  install('window', dom.window);
  install('document', dom.window.document);
  const { mountAccountChip } = await import('./account-chip.ts');
  const doc = dom.window.document;
  const into = doc.getElementById('menu')!;
  const deps = {
    account: () => ({ workspace: 'Partners', member: { email: 'admin@example.test', name: 'Admin' }, inbox: null }),
    consoleUrl: () => null, signInUrl: () => null, signOut: async () => true, workspaceOrigin: 'https://work.test',
  };
  let probes = 0;
  install('fetch', async (url: string) => {
    assert.equal(url, '/api/v1/programmes');
    probes++;
    return Response.json({ programmes: [state().programme] });
  });
  const detachChip = mountAccountChip(into, deps);
  assert.equal(probes, 0);
  detachChip();
  const menu = { trigger: doc.getElementById('avatar')!, close() {}, reopen() {} };
  let detach = mountAccountChip(into, deps, menu);
  for (let i = 0; i < 100 && !into.querySelector('[data-account-act="view-as"]'); i++) await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(into.querySelector('[data-account-act="view-as"]')?.textContent, 'View as partner…');
  assert.equal(probes, 1);
  detach();
  into.replaceChildren();
  detach = mountAccountChip(into, deps, menu);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(probes, 1);
  detach();
  into.replaceChildren();
  session.setItem(KEY, JSON.stringify(state()));
  detach = mountAccountChip(into, deps, menu);
  assert.equal(into.querySelector('[data-account-act="view-as-stop"]')?.textContent, 'Stop viewing');
  assert.equal(into.querySelector('[data-account-act="view-as"]'), null);
  assert.equal(probes, 1);
  detach();
  dom.window.close();
});

test('a denied or empty programme probe stays cached and offers no viewing action', async () => {
  const dom = new JSDOM('<!doctype html><body><button id="avatar"></button><div id="menu"></div></body>', { url: 'https://work.test' });
  install('window', dom.window);
  install('document', dom.window.document);
  const doc = dom.window.document;
  const into = doc.getElementById('menu')!;
  const deps = {
    account: () => ({ workspace: 'Partners', member: { email: 'member@example.test', name: 'Member' }, inbox: null }),
    consoleUrl: () => null, signInUrl: () => null, signOut: async () => true, workspaceOrigin: 'https://work.test',
  };
  const menu = { trigger: doc.getElementById('avatar')!, close() {}, reopen() {} };
  for (const outcome of ['denied', 'empty', 'offline']) {
    let probes = 0;
    install('fetch', async () => {
      probes++;
      if (outcome === 'offline') throw new Error('offline');
      return outcome === 'denied' ? new Response(null, { status: 403 }) : Response.json({ programmes: [] });
    });
    const url = new URL(`./account-chip.ts?view-as-probe=${outcome}`, import.meta.url);
    const { mountAccountChip } = await import(url.href) as typeof import('./account-chip.ts');
    for (let render = 0; render < 2; render++) {
      into.replaceChildren();
      const detach = mountAccountChip(into, deps, menu);
      await new Promise((resolve) => setTimeout(resolve, 5));
      assert.equal(into.querySelector('[data-account-act="view-as"]'), null);
      detach();
    }
    assert.equal(probes, 1);
  }
  dom.window.close();
});

test('switching programmes ignores an older company response', async () => {
  const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://work.test' });
  install('window', dom.window);
  install('document', dom.window.document);
  const proto = dom.window.HTMLDialogElement.prototype;
  proto.showModal = function () { this.setAttribute('open', ''); };
  proto.close = function () { this.removeAttribute('open'); };
  let first: ((response: Response) => void) | undefined;
  const closed = openViewAsSheet({
    programmes: [{ id: 'p1', name: 'First programme' }, { id: 'p2', name: 'Second programme' }],
    fetchImpl: async (url) => {
      if (url.includes('/p1/')) return new Promise<Response>((resolve) => { first = resolve; });
      return Response.json({ companies: [{ id: 'c2', name: 'Second company' }] });
    },
  });
  for (let i = 0; i < 100 && !first; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  const doc = dom.window.document;
  const programme = doc.querySelectorAll('select')[0]!;
  programme.value = 'p2';
  programme.dispatchEvent(new dom.window.Event('change'));
  for (let i = 0; i < 100 && doc.querySelectorAll('select')[1]?.options.length !== 2; i++) await new Promise((resolve) => setTimeout(resolve, 5));
  first!(Response.json({ companies: [{ id: 'c1', name: 'First company' }] }));
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(doc.querySelectorAll('select')[1]?.options[1]?.text, 'Second company');
  doc.querySelector('dialog')!.dispatchEvent(new dom.window.Event('cancel', { cancelable: true }));
  await closed;
  dom.window.close();
});

test('viewing prevents work sockets, agent pairing, live-agent requests and device-agent runs', async () => {
  session.setItem(KEY, JSON.stringify(state()));
  const { createWorkCollabProvider } = await import('./collab-provider.ts');
  let sockets = 0;
  const provider = createWorkCollabProvider('session-1', {
    clientId: 'device-1', url: 'wss://work.test/ws/collab/session-1',
    socket: class { constructor() { sockets++; throw new Error('unexpected socket'); } } as unknown as import('./collab-protocol.ts').CollabSocketCtor,
    store: { load: async () => null, save: async () => {}, clear: async () => {} },
  });
  await provider.connect();
  assert.equal(sockets, 0);
  assert.equal(provider.state().status, 'closed');
  provider.close();
  const { pairWithAgent } = await import('../lib/live-agent-connect.ts');
  const editor: import('../lib/live-agent.ts').LiveEditor = {
    tool: 'design', engine: 'test', surface: 'web', rows: () => [], size: () => ({ width: 1, height: 1 }), selection: () => [],
    fieldDefault: (_id, fallback) => fallback, commit: async () => null, topEntry: () => null,
    undo() {}, look: async () => ({ svg: '<svg/>', width: 1, height: 1 }),
  };
  await assert.rejects(pairWithAgent({ port: 52817, secret: 'K7QF9XMB' }, editor, {
    makeSocket: () => { sockets++; throw new Error('unexpected socket'); },
  }), { reason: 'viewing-as' });
  assert.equal(sockets, 0);
  const { createLiveSession } = await import('../lib/live-agent.ts');
  const live = createLiveSession(editor);
  const reply = JSON.parse(await live.handle(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'hello', params: { protocol: 'live-v1', client: 'test' } })));
  assert.equal(reply.error.message, 'Not while viewing as a partner');
  assert.equal(live.connected(), false);
  const { runDeviceAgent } = await import('../lib/device-agents.ts');
  const result = await runDeviceAgent({
    invoke: async () => { throw new Error('unexpected device call'); },
    agent: { id: 'codex', kind: 'cli', label: 'Codex', path: '/codex', version: null, runnable: true },
    editor, request: 'Change the title',
  });
  assert.deepEqual(result, { status: 'failed', reason: 'refused', detail: 'Not while viewing as a partner' });
});
