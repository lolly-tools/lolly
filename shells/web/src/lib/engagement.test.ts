// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { JSDOM } from 'jsdom';
import { ENGAGED_AFTER_MS, isEngaged, resetEngagementForTest, whenEngaged } from './engagement.ts';

/** A fresh visit: a document, mocked timers, and a visibility the test can change. */
function visit(t: TestContext) {
  const dom = new JSDOM('<!doctype html><input id="field"><select id="pick"><option>a</option></select>', { url: 'http://localhost/' });
  const win = dom.window;
  let visibility = 'visible';
  Object.defineProperty(win.document, 'visibilityState', { get: () => visibility, configurable: true });
  const had = { document: Reflect.get(globalThis, 'document'), ric: Reflect.get(globalThis, 'requestIdleCallback') };
  Object.assign(globalThis, { document: win.document });
  Reflect.deleteProperty(globalThis, 'requestIdleCallback');
  t.mock.timers.enable({ apis: ['setTimeout'] });
  resetEngagementForTest();
  t.after(() => {
    resetEngagementForTest();
    Object.assign(globalThis, { document: had.document });
    if (had.ric) Object.assign(globalThis, { requestIdleCallback: had.ric });
    win.close();
  });
  return {
    win,
    edit: (type: 'input' | 'change', id = 'field') => win.document.getElementById(id)!.dispatchEvent(new win.Event(type, { bubbles: true })),
    hide: () => { visibility = 'hidden'; },
    show: () => { visibility = 'visible'; win.document.dispatchEvent(new win.Event('visibilitychange')); },
  };
}

test('a person who only looks in is not engaged, and nothing runs', (t) => {
  visit(t);
  let ran = 0;
  whenEngaged(() => { ran += 1; });
  t.mock.timers.tick(ENGAGED_AFTER_MS - 1);
  assert.equal(ran, 0);
  assert.equal(isEngaged(), false);
});

test('a first edit counts at once, and every waiting caller runs once', (t) => {
  const v = visit(t);
  const ran: string[] = [];
  whenEngaged(() => { ran.push('a'); });
  whenEngaged(() => { ran.push('b'); });
  v.edit('input');
  assert.deepEqual(ran, ['a', 'b']);
  assert.equal(isEngaged(), true);
  v.edit('input');
  v.edit('change', 'pick');
  t.mock.timers.tick(ENGAGED_AFTER_MS * 2);
  assert.deepEqual(ran, ['a', 'b'], 'later edits and the timer run nothing twice');
});

test('a choice from a menu counts as an edit', (t) => {
  const v = visit(t);
  let ran = 0;
  whenEngaged(() => { ran += 1; });
  v.edit('change', 'pick');
  assert.equal(ran, 1);
});

test('a stay of half a minute with the page in view counts', (t) => {
  visit(t);
  let ran = 0;
  whenEngaged(() => { ran += 1; });
  t.mock.timers.tick(ENGAGED_AFTER_MS);
  assert.equal(ran, 1);
});

test('a tab left in the background does not count until it has been in view for the stay', (t) => {
  const v = visit(t);
  let ran = 0;
  whenEngaged(() => { ran += 1; });
  v.hide();
  t.mock.timers.tick(ENGAGED_AFTER_MS * 3);
  assert.equal(ran, 0, 'hidden for a long time is not a person at work');
  v.show();
  t.mock.timers.tick(ENGAGED_AFTER_MS - 1);
  assert.equal(ran, 0);
  t.mock.timers.tick(1);
  assert.equal(ran, 1);
});

test('once engaged, a later caller runs after a short wait and not in the same turn', (t) => {
  const v = visit(t);
  whenEngaged(() => {});
  v.edit('input');
  let ran = 0;
  whenEngaged(() => { ran += 1; });
  assert.equal(ran, 0, 'a tool that is opening is not interrupted');
  t.mock.timers.tick(0);
  assert.equal(ran, 1);
});
