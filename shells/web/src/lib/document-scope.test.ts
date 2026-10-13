// SPDX-License-Identifier: MPL-2.0
/**
 * Document ownership without a stage overlay. Unclaimed mounts retain the ordinary
 * device save and leave prompt; claimed mounts keep provider lifecycle, scoped Save
 * and Leave behavior without rendering the former chip or its menu.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/document-scope.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/t/poster', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
for (const k of ['HTMLElement', 'Element', 'Node', 'Event', 'CustomEvent'] as const) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => { setTimeout(() => cb(0), 0); return 0; }) as typeof requestAnimationFrame;
globalThis.addEventListener = dom.window.addEventListener.bind(dom.window);
globalThis.removeEventListener = dom.window.removeEventListener.bind(dom.window);

const scope = await import('./document-scope.ts');
const { registerSessionSource } = await import('./session-source.ts');
type Mount = import('./document-scope.ts').DocumentScopeMount;

const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 30));

function makeView(): HTMLElement {
  const view = document.createElement('div');
  view.innerHTML = '<aside><div id="tool-inputs"></div></aside><div class="tool-stage" id="tool-stage"><div id="tool-canvas"></div></div>';
  document.body.append(view);
  return view;
}

function makeMount(view: HTMLElement, over: Partial<Mount> = {}): Mount {
  return {
    toolId: 'poster',
    view,
    document: () => ({ inputs: { headline: 'Hi' } }),
    unsaved: () => false,
    saveOnDevice: async () => true,
    ...over,
  };
}

test('dormant: no provider and no workspace draws nothing and routes nothing', async () => {
  scope._resetDocumentScopeForTests();
  const view = makeView();
  const before = view.innerHTML;
  const stop = scope.mountDocumentScope(makeMount(view));
  await settle();
  assert.equal(view.innerHTML, before, 'the tool view is byte-identical');
  assert.equal(scope.saveInDocumentScope('poster'), null, 'Save saves on this device as before');
  assert.equal(scope.documentLeavePrompt(), null, 'the ordinary leave dialog');
  assert.equal(scope.documentScopeClaimed('poster'), false);
  stop();
  view.remove();
});

test('a workspace with no claim leaves the tool stage unchanged', async () => {
  scope._resetDocumentScopeForTests();
  const off = registerSessionSource({
    label: 'lolly.ing', listProjects: async () => [], listSessions: async () => [], fetchSession: async () => null,
  });
  const view = makeView();
  const before = view.innerHTML;
  const stop = scope.mountDocumentScope(makeMount(view));
  await settle();
  assert.equal(view.innerHTML, before, 'no overlay obscures the tool controls');
  assert.equal(scope.documentScopeClaimed(), false);
  assert.equal(scope.documentLeavePrompt(), null);
  assert.equal(scope.saveInDocumentScope('poster'), null, 'nothing claims it, so Save stays on this device');
  stop();
  assert.equal(view.querySelector('.document-scope'), null);
  off();
  view.remove();
});

test('a claiming provider keeps save, leave and attach behavior without a chip or menu', async () => {
  scope._resetDocumentScopeForTests();
  let claims = true;
  let saves = 0;
  const attached: string[] = [];
  let menuReads = 0;
  const off = scope.registerDocumentScope({
    chip: (m) => claims ? { label: 'Brand refresh · Can edit', role: 'edit', ...(m.unsaved() ? { state: 'Not saved yet' } : {}) } : null,
    save: async () => { saves++; return true; },
    leavePrompt: () => 'Save changes to Brand refresh?',
    menu: () => { menuReads++; return []; },
    attach: (m) => { attached.push(`on:${m.toolId}`); return () => attached.push('off'); },
  });
  const view = makeView();
  const before = view.innerHTML;
  const stop = scope.mountDocumentScope(makeMount(view));
  await settle();
  assert.equal(view.innerHTML, before);
  assert.equal(menuReads, 0, 'the removed menu is never requested');
  assert.deepEqual(attached, ['on:poster']);
  assert.equal(scope.documentScopeClaimed('poster'), true);
  assert.equal(scope.documentScopeClaimed('chart'), false, 'only the mounted tool');
  assert.equal(scope.documentLeavePrompt(), 'Save changes to Brand refresh?');
  assert.equal(await scope.saveInDocumentScope('poster'), true);
  assert.equal(saves, 1);
  assert.equal(scope.saveInDocumentScope('chart'), null, 'another tool is not this mount');

  // A non-bubbling edit event still refreshes the provider attachment.
  claims = false;
  view.querySelector('#tool-canvas')!.dispatchEvent(new dom.window.Event('lolly-session-status'));
  await settle();
  assert.deepEqual(attached, ['on:poster', 'off']);
  claims = true;
  scope.notifyDocumentScopeChange();
  assert.deepEqual(attached, ['on:poster', 'off', 'on:poster']);

  // The claim ends (a viewer made their own copy): provider detached.
  claims = false;
  scope.notifyDocumentScopeChange();
  await settle();
  assert.deepEqual(attached, ['on:poster', 'off', 'on:poster', 'off']);
  assert.equal(view.innerHTML, before, 'scope changes do not add a stage overlay');
  assert.equal(menuReads, 0);
  assert.equal(scope.saveInDocumentScope('poster'), null);
  stop();
  off();
  view.remove();
});

test('the mount teardown detaches the provider and forgets the mount', async () => {
  scope._resetDocumentScopeForTests();
  const events: string[] = [];
  scope.registerDocumentScope({
    chip: () => ({ label: 'X · View only', role: 'view' }),
    attach: () => { events.push('attach'); return () => events.push('detach'); },
  });
  const view = makeView();
  const stop = scope.mountDocumentScope(makeMount(view));
  await settle();
  stop();
  stop();
  assert.deepEqual(events, ['attach', 'detach'], 'once each, however often teardown runs');
  assert.equal(scope.documentScopeClaimed(), false);
  assert.equal(view.querySelector('.document-scope'), null);
  view.remove();
  scope._resetDocumentScopeForTests();
});

test('one provider failing is its own: the next is still asked', async () => {
  scope._resetDocumentScopeForTests();
  const errors: unknown[] = [];
  const orig = console.error;
  console.error = (e: unknown) => { errors.push(e); };
  try {
    scope.registerDocumentScope({ chip: () => ({ label: 'Second', role: 'edit' }) });
    scope.registerDocumentScope({ chip: () => { throw new Error('boom'); } });
    const view = makeView();
    const stop = scope.mountDocumentScope(makeMount(view));
    await settle();
    assert.equal(scope.documentScopeClaimed('poster'), true);
    assert.equal(view.querySelector('.document-scope'), null);
    stop();
    view.remove();
  } finally {
    console.error = orig;
  }
  assert.ok(errors.length >= 1);
  scope._resetDocumentScopeForTests();
});
