// SPDX-License-Identifier: MPL-2.0
/**
 * A saved-document open in the tool view (views/tool/open-document.ts): the card goes
 * up for a slot, and a stopped open unwinds without touching a view it no longer owns.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/tool/open-document.test.ts
 *
 * The tool view itself is not mounted: the context carries just the pieces these
 * functions read (the view element, the mount's lifecycle, the runtime, the design-
 * system listener), so each assertion is about what the unwind releases.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/tool/design?slot=s1', pretendToBeVisual: true });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.history = dom.window.history as unknown as typeof globalThis.history;
globalThis.location = dom.window.location as unknown as typeof globalThis.location;
for (const k of ['HTMLElement', 'Element', 'Node', 'Event', 'sessionStorage', 'requestAnimationFrame'] as const) {
  (globalThis as Record<string, unknown>)[k] = (dom.window as unknown as Record<string, unknown>)[k];
}
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { begin, race, abandon, finish, stopped } = await import('./open-document.ts');
const { noteOpenIntent } = await import('../../lib/open-intent.ts');
const { MountLifecycle } = await import('../../lib/mount-lifecycle.ts');
const { OPEN_PROGRESS_DELAY_MS } = await import('../../components/open-progress.ts');
type Ctx = Parameters<typeof begin>[0];

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
const card = (): HTMLDialogElement | null => document.querySelector<HTMLDialogElement>('dialog.open-progress');

function context(settled: Promise<void> = new Promise(() => {})) {
  const viewEl = document.createElement('div') as Ctx['viewEl'];
  viewEl.innerHTML = '<div class="tool-stage"></div>';
  document.body.appendChild(viewEl);
  const lifecycle = new MountLifecycle();
  let destroyed = 0;
  let cleanups = 0;
  const tview = {
    viewEl,
    mountLifecycle: lifecycle,
    loadingTimer: setTimeout(() => {}, 0),
    designSystem: { onDesignSystemChanged: () => {} },
    runtime: { destroy: () => { destroyed += 1; }, whenSettled: () => settled },
  } as unknown as Ctx;
  return {
    tview,
    viewEl,
    lifecycle,
    destroyed: () => destroyed,
    cleanups: () => cleanups,
    armCleanup() { viewEl._cleanup = () => { cleanups += 1; }; },
    dispose() { viewEl.remove(); for (const d of document.querySelectorAll('dialog')) d.remove(); },
  };
}

/** Wait for the card, then press its Cancel. */
async function pressCancel(): Promise<void> {
  await sleep(OPEN_PROGRESS_DELAY_MS + 30);
  const btn = card()?.querySelector<HTMLButtonElement>('[data-act="cancel"]');
  assert.ok(btn, 'the card is up with its Cancel');
  btn!.click();
}

test('a mount with no slot gets no card and no leave guard', async () => {
  const c = context();
  try {
    begin(c.tview, null);
    assert.equal(c.tview.openCard, null);
    assert.equal(c.viewEl._beforeLeave, undefined);
    assert.equal(stopped(c.tview), false);
    assert.equal(await race(c.tview, Promise.resolve()), true);
    await finish(c.tview);
    await sleep(OPEN_PROGRESS_DELAY_MS + 30);
    assert.equal(card(), null);
  } finally { c.dispose(); }
});

test('a scripted export of a slot gets no card', () => {
  const c = context();
  try {
    (c.tview as { urlParams: string }).urlParams = 'slot=s1&format=png&export';
    begin(c.tview, 's1');
    assert.equal(c.tview.openCard, null, 'nobody is watching, and a modal would make the page inert');
    assert.equal(c.viewEl._beforeLeave, undefined);
  } finally { c.dispose(); }
});

test('the card names the document its opener noted, for that slot only', async () => {
  const c = context();
  try {
    noteOpenIntent({ slot: 'other', name: 'Not this one' });
    begin(c.tview, 's1');
    await sleep(OPEN_PROGRESS_DELAY_MS + 30);
    assert.equal(card()?.querySelector('.modal-title')?.textContent, 'Opening document', 'a note for another slot is ignored');
    c.tview.openCard?.close();

    noteOpenIntent({ slot: 's1', name: 'Quarterly deck' });
    begin(c.tview, 's1');
    await sleep(OPEN_PROGRESS_DELAY_MS + 30);
    assert.equal(card()?.querySelector('.modal-title')?.textContent, 'Opening Quarterly deck');
    c.tview.openCard?.close();
  } finally { c.dispose(); }
});

test('a navigation away mid-open: the view is left to the next route', async () => {
  const c = context();
  try {
    begin(c.tview, 's1');
    c.armCleanup();
    assert.equal(await c.viewEl._beforeLeave!(), true, 'the guard never refuses a leave');
    assert.equal(stopped(c.tview), true);
    abandon(c.tview);
    assert.equal(c.lifecycle.disposed, true, 'this mount\'s own resources go');
    assert.equal(c.destroyed(), 1, 'and its runtime');
    assert.equal(c.cleanups(), 0, 'the router already ran the teardown; the one on the view now is not this mount\'s to run');
    assert.ok(c.viewEl.querySelector('.tool-stage'), 'and the view is not cleared under the next route');
  } finally { c.dispose(); }
});

test('Cancel mid-open: the teardown runs once, the view is cleared, and the person goes back', async () => {
  const c = context();
  const navs: string[] = [];
  const onNav = (): void => { navs.push(location.pathname + location.hash); };
  window.addEventListener('lolly:navigate', onNav);
  try {
    begin(c.tview, 's1');
    c.armCleanup();
    await pressCancel();
    assert.equal(stopped(c.tview), true);
    abandon(c.tview);
    assert.equal(c.cleanups(), 1, 'the teardown the mount had built so far ran');
    assert.equal(c.viewEl._cleanup, undefined, 'and is gone, so the router cannot run it twice');
    assert.equal(c.viewEl._beforeLeave, undefined);
    assert.equal(c.viewEl.childElementCount, 0, 'the half-built view is cleared');
    assert.equal(c.lifecycle.disposed, true);
    assert.equal(c.destroyed(), 1);
    assert.equal(card(), null, 'the card is down');
    assert.deepEqual(navs, ['/#/'], 'no previous view recorded, so Home, the same answer the back pill gives');
  } finally {
    window.removeEventListener('lolly:navigate', onNav);
    history.replaceState(null, '', '/#/tool/design?slot=s1');
    c.dispose();
  }
});

test('a raced step that loses to Cancel is not waited for, and its runtime is destroyed when it ends', async () => {
  const c = context();
  try {
    begin(c.tview, 's1');
    let finishStep!: () => void;
    const step = new Promise<void>((r) => { finishStep = r; });
    const raced = race(c.tview, step);
    await pressCancel();
    assert.equal(await raced, false, 'the open does not wait for the step');
    assert.equal(c.destroyed(), 0);
    finishStep();
    await sleep(0);
    assert.equal(c.destroyed(), 1, 'the runtime the step made is destroyed once it arrives');
    c.tview.openCard?.close();
  } finally { c.dispose(); }
});

test('a step that ends first carries the open on', async () => {
  const c = context();
  try {
    begin(c.tview, 's1');
    assert.equal(await race(c.tview, Promise.resolve()), true);
    assert.equal(c.destroyed(), 0);
    c.tview.openCard?.close();
  } finally { c.dispose(); }
});

test('the card holds until the runtime settles, then lifts', async () => {
  let settle!: () => void;
  const c = context(new Promise<void>((r) => { settle = r; }));
  try {
    begin(c.tview, 's1');
    const done = finish(c.tview);
    await sleep(OPEN_PROGRESS_DELAY_MS + 30);
    assert.equal(card()?.querySelector('.open-progress-step')?.textContent, 'Finishing the layout');
    settle();
    await done;
    assert.equal(card(), null, 'the laid-out document is painted and the card is gone');
    assert.equal(c.destroyed(), 0, 'an open that finished keeps its runtime');
  } finally { c.dispose(); }
});

test('finished layouts show as "Laying out text: n of total" for a composed-text document', async () => {
  const { noteTextLayoutDone } = await import('../../lib/text-layout-progress.ts');
  const c = context();
  try {
    Object.assign(c.tview, {
      tool: { manifest: { inputs: [{ id: 'boxes', type: 'blocks', canvas: { textDocumentInput: 'textDocument' } }] } },
      initialValues: { textDocument: JSON.stringify({ stories: [{}, {}, {}, {}] }) },
    });
    begin(c.tview, 's1');
    await sleep(OPEN_PROGRESS_DELAY_MS + 30);
    noteTextLayoutDone();
    assert.equal(card()?.querySelector('.open-progress-count')?.textContent, '1 of 4');
    noteTextLayoutDone();
    assert.equal(card()?.querySelector('.open-progress-count')?.textContent, '2 of 4');
    c.tview.openCard?.close();
    noteTextLayoutDone();
    assert.equal(card(), null, 'a closed card stops listening');
  } finally { c.dispose(); }
});
