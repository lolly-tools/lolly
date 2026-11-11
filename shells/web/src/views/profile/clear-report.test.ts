// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" when part of the clear does not finish (views/profile/clear-report.ts).
 * Those failures used to reach only the log while the app restarted as if everything
 * had gone. Now the person is told what is still on the device and what to do:
 *
 *   - the dialog lists each part left behind in plain words, and says to try again or,
 *     on the web, to clear the site's data in the browser (the apps say to reopen and
 *     clear again);
 *   - Try again runs the whole clear again, as many times as asked, until it finishes;
 *   - Restart Lolly, Escape or the backdrop goes on to the restart with what is left;
 *   - a clear that finished, or whose only error was a slow tab, asks nothing;
 *   - every run's errors still go to the log.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/views/profile/clear-report.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { ClearAllReport, UnclearedPart } from '../../lib/clear-all-data.ts';

// jsdom before the dialog module loads: it has <dialog> but neither showModal() nor close().
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/profile' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.history = dom.window.history;
g.location = dom.window.location;
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };
const win = dom.window as unknown as { __TAURI_INTERNALS__?: { invoke: () => void } };

const { askToClearAgain, clearUntilDone } = await import('./clear-report.ts');

/** A report as clearAllLollyData returns one, with only the fields this module reads filled in. */
function report(failedSteps: string[], errors: string[] = failedSteps.map((s) => `${s}: refused`)): ClearAllReport {
  return { stores: [], databases: [], serviceWorkers: [], caches: [], files: [], localKeys: 0, sessionKeys: 0, cleared: [], tabs: { seen: 0, ready: 0 }, errors, failedSteps };
}

const open = (): HTMLDialogElement => {
  const dlg = document.querySelector<HTMLDialogElement>('[data-dialog-tag="clear-report"]');
  assert.ok(dlg, 'the dialog is open');
  return dlg;
};

test('the dialog says what is still here and what to do, and Try again asks for another run', async () => {
  const answer = askToClearAgain(['database', 'offline']);
  const dlg = open();
  assert.equal(dlg.querySelector('.modal-title')!.textContent, 'Some of your data was not cleared');
  assert.deepEqual([...dlg.querySelectorAll('.modal-items li')].map((li) => li.textContent),
    ['Some saved work, uploads or settings', 'Offline copies, downloaded models or caches']);
  const message = dlg.querySelector('.modal-msg')!.textContent ?? '';
  assert.match(message, /Try again\./);
  assert.match(message, /clear this site’s data in your browser’s settings/);
  assert.equal(dlg.querySelector('[data-act="cancel"]')!.textContent, 'Restart Lolly', 'dismissing says what it does');
  const again = dlg.querySelector<HTMLElement>('[data-choice="again"]')!;
  assert.equal(again.textContent, 'Try again');
  again.click();
  assert.equal(await answer, true);
  assert.equal(document.querySelector('[data-dialog-tag="clear-report"]'), null, 'and it closes');
});

test('Restart Lolly goes on with what is left', async () => {
  const answer = askToClearAgain(['files']);
  open().querySelector<HTMLElement>('[data-act="cancel"]')!.click();
  assert.equal(await answer, false);
});

test('the apps say to reopen and clear again, since they have no site data to clear', async () => {
  win.__TAURI_INTERNALS__ = { invoke() {} };
  try {
    const answer = askToClearAgain(['app-files']);
    const dlg = open();
    assert.match(dlg.querySelector('.modal-msg')!.textContent ?? '', /close Lolly, open the app again and clear once more/);
    assert.doesNotMatch(dlg.querySelector('.modal-msg')!.textContent ?? '', /browser/);
    assert.deepEqual([...dlg.querySelectorAll('.modal-items li')].map((li) => li.textContent), ['Saved sessions and other files the app keeps on this device']);
    dlg.querySelector<HTMLElement>('[data-act="cancel"]')!.click();
    assert.equal(await answer, false);
  } finally { delete win.__TAURI_INTERNALS__; }
});

test('a partial clear asks, runs again on Try again, and stops once the clear finishes', async () => {
  const runs = [report(['indexeddb', 'caches']), report(['caches']), report([])];
  const asked: UnclearedPart[][] = [];
  const logged: string[][] = [];
  const last = await clearUntilDone(async () => runs.shift()!, {
    ask: async (parts) => { asked.push([...parts]); return true; },
    log: (errors) => { logged.push(errors); },
  });
  assert.deepEqual(asked, [['database', 'offline'], ['offline']], 'each time, only what that run left');
  assert.deepEqual(last.failedSteps, [], 'the report handed back is the run that finished');
  assert.equal(runs.length, 0, 'three runs');
  assert.deepEqual(logged, [['indexeddb: refused', 'caches: refused'], ['caches: refused']], 'every failed run still reaches the log');
});

test('choosing to restart returns the partial report after one run', async () => {
  let runs = 0;
  const last = await clearUntilDone(async () => { runs += 1; return report(['opfs']); }, { ask: async () => false });
  assert.equal(runs, 1);
  assert.deepEqual(last.failedSteps, ['opfs']);
});

test('nothing is asked when the clear finished, or when only a slow tab or Sync complained', async () => {
  let asked = 0;
  const logged: string[][] = [];
  const opts = { ask: async () => { asked += 1; return true; }, log: (errors: string[]) => { logged.push(errors); } };
  await clearUntilDone(async () => report([]), opts);
  await clearUntilDone(async () => report(['tabs', 'sync'], ['tabs: 1 of 2 did not confirm they stopped writing', 'sync: offline']), opts);
  assert.equal(asked, 0);
  assert.equal(logged.length, 1, 'the slow tab is still logged');
});
