// SPDX-License-Identifier: MPL-2.0
/**
 * lib/instance-set-aside-prompt.ts: in the apps the connect step opens once by itself
 * for an instance that was set aside, only at a quiet moment, and never again after
 * the person closes the step. In a browser only the note is shown.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/instance-set-aside-prompt.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body><main id="view"><p class="loading">Loading</p></main></body></html>', { url: 'https://tauri.localhost/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.localStorage = dom.window.localStorage;

const { offerSetAsideInstance, quietForSheet, _resetSetAsidePromptForTests } = await import('./instance-set-aside-prompt.ts');
type Deps = NonNullable<Parameters<typeof offerSetAsideInstance>[2]>;

const WORK = 'https://work.example';
const log = (): void => {};
const tick = (ms = 30): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));
/** Wait for `done`, with room for a slow machine; the assertion after it reports a miss. */
async function until(done: () => boolean): Promise<void> {
  for (let i = 0; i < 2000 && !done(); i++) await tick(5);
}

/** Stand-ins for the shell, the screen and the sheet; every call is recorded. */
function harness(over: Partial<Deps> = {}): { deps: Partial<Deps>; opened: string[]; notes: Array<{ door: (() => void) | undefined; again: boolean }>; close(): void; state: { quiet: boolean; setAside: boolean } } {
  const opened: string[] = [];
  const notes: Array<{ door: (() => void) | undefined; again: boolean }> = [];
  const state = { quiet: true, setAside: true };
  let closeStep: (() => void) | null = null;
  return {
    opened, notes, state,
    close() { closeStep?.(); closeStep = null; },
    deps: {
      apps: () => true,
      quiet: () => state.quiet,
      settled: async () => {},
      open: (base) => { opened.push(base); return new Promise<void>(resolve => { closeStep = resolve; }); },
      note: (_base, door, again = false) => { notes.push({ door, again }); },
      stillSetAside: () => state.setAside,
      waitMs: 60000,
      checkMs: 5,
      ...over,
    },
  };
}

test.beforeEach(() => { _resetSetAsidePromptForTests(); });

test('in the apps the connect step opens once by itself, with the address', async () => {
  const h = harness();
  void offerSetAsideInstance(WORK, log, h.deps);
  assert.equal(h.notes.length, 1, 'the note is shown at once');
  assert.equal(typeof h.notes[0]!.door, 'function', 'and is a door to the step');
  await until(() => h.opened.length > 0);
  assert.deepEqual(h.opened, [WORK]);
  // A later sync in the same page load reports the set-aside again: nothing more opens.
  void offerSetAsideInstance(WORK, log, h.deps);
  await tick();
  assert.deepEqual(h.opened, [WORK]);
  h.close();
});

test('closing the step does not open the step again, and the note comes back as the door', async () => {
  const h = harness();
  const done = offerSetAsideInstance(WORK, log, h.deps);
  await until(() => h.opened.length > 0);
  h.close();
  await done;
  await tick(60);
  assert.deepEqual(h.opened, [WORK], 'no loop');
  assert.deepEqual(h.notes.map(note => note.again), [false, true]);
  // The person may still open the step from the note.
  h.notes.at(-1)!.door!();
  await until(() => h.opened.length > 1);
  assert.deepEqual(h.opened, [WORK, WORK]);
  h.close();
});

test('in a browser only the note is shown, with no door', async () => {
  const h = harness({ apps: () => false });
  await offerSetAsideInstance(WORK, log, h.deps);
  await tick();
  assert.deepEqual(h.opened, []);
  assert.deepEqual(h.notes, [{ door: undefined, again: false }]);
});

test('the step waits while another dialog is up, and opens when the screen is quiet', async () => {
  const h = harness();
  h.state.quiet = false;
  void offerSetAsideInstance(WORK, log, h.deps);
  await tick(60);
  assert.deepEqual(h.opened, [], 'nothing opens over another dialog');
  h.state.quiet = true;
  await until(() => h.opened.length > 0);
  assert.deepEqual(h.opened, [WORK]);
  h.close();
});

test('with no quiet moment in time the step does not open, and the note stays the way back', async () => {
  const h = harness({ waitMs: 40 });
  h.state.quiet = false;
  await offerSetAsideInstance(WORK, log, h.deps);
  h.state.quiet = true;
  await tick(60);
  assert.deepEqual(h.opened, []);
  assert.equal(typeof h.notes[0]!.door, 'function');
});

test('the step waits for the first-run welcome to settle', async () => {
  let settle!: () => void;
  const h = harness({ settled: () => new Promise<void>(resolve => { settle = resolve; }) });
  void offerSetAsideInstance(WORK, log, h.deps);
  await tick(60);
  assert.deepEqual(h.opened, []);
  settle();
  await until(() => h.opened.length > 0);
  assert.deepEqual(h.opened, [WORK]);
  h.close();
});

test('an instance the person connected to again meanwhile opens nothing', async () => {
  const h = harness();
  h.state.setAside = false;
  await offerSetAsideInstance(WORK, log, h.deps);
  await tick();
  assert.deepEqual(h.opened, []);
});

test('a quiet screen is a drawn view with no boot screen, no dialog and no sign-in gate', () => {
  const view = document.getElementById('view')!;
  assert.equal(quietForSheet(), false, 'the boot screen is still up');
  view.innerHTML = '<section class="gallery"></section>';
  assert.equal(quietForSheet(), true);
  const dialog = document.body.appendChild(document.createElement('dialog'));
  dialog.setAttribute('open', '');
  assert.equal(quietForSheet(), false, 'another dialog is up');
  dialog.remove();
  view.innerHTML = '<section class="org-gate"></section>';
  assert.equal(quietForSheet(), false, 'a sign-in gate is up');
  view.innerHTML = '';
  assert.equal(quietForSheet(), false, 'nothing is drawn yet');
});

test('the self-opened step starts its own check in the apps, and accepts nothing', async () => {
  const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
  dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
  dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };
  globalThis.history = dom.window.history as unknown as History;
  globalThis.Element = dom.window.Element as unknown as typeof Element;
  const instance = await import('./instance.ts');
  const rows = new Map<string, unknown>();
  instance._setProfileDbForTests(async () => ({
    get: async (_s: string, key: string) => rows.get(key),
    put: async (_s: string, value: unknown, key: string) => { rows.set(key, value); return key; },
    delete: async (_s: string, key: string) => { rows.delete(key); },
  }) as never);
  const asked: string[] = [];
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  w.__TAURI_INTERNALS__ = { invoke: async (_command: string, args: { request: { url: string } }) => {
    asked.push(args.request.url);
    const gated = args.request.url.endsWith('/api/v1/instance');
    return { status: gated ? 200 : 404, statusText: '', url: args.request.url, headers: [['content-type', 'application/json']],
      body: gated ? [...new TextEncoder().encode(JSON.stringify({ name: 'Work', accessMode: 'gated' }))] : [] };
  } };
  try {
    const { openInstanceSheet } = await import('../components/instance-sheet.ts');
    const closed = openInstanceSheet({ log }, { start: 'connect', url: WORK, check: true });
    const sheet = document.querySelector<HTMLElement>('.instance-sheet')!;
    assert.equal(sheet.querySelector<HTMLInputElement>('#instance-url')!.value, WORK);
    for (let i = 0; i < 400 && !sheet.querySelector('[data-act="connect-confirm"]'); i++) await tick(5);
    assert.ok(sheet.querySelector('[data-act="connect-confirm"]'), 'the check ran with no tap, and the choice is on screen');
    assert.equal(asked[0], `${WORK}/api/v1/instance`);
    assert.equal(rows.size, 0, 'nothing is saved: no instance chosen, no key accepted');
    assert.equal(instance.getInstanceBase(), '');
    assert.equal(instance.instanceCatalogKeyId(), '');
    sheet.dispatchEvent(new dom.window.Event('cancel'));
    await closed;
    assert.equal(rows.size, 0, 'closing accepts nothing');
  } finally {
    delete w.__TAURI_INTERNALS__;
    instance._setProfileDbForTests(null);
  }
});
