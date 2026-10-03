// SPDX-License-Identifier: MPL-2.0
import { afterEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { AutomaticWorkCollabDeps } from './collab-auto-join.ts';
const dom = new JSDOM('<main id="view"><button id="edit">Edit</button></main>', { url: 'https://instance.test/#/tool/design', pretendToBeVisual: true });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location,
  localStorage: dom.window.localStorage, sessionStorage: dom.window.sessionStorage,
  requestAnimationFrame: dom.window.requestAnimationFrame.bind(dom.window) });
const { registerAutomaticWorkCollab } = await import('./collab-auto-join.ts');
const { publishToolReady } = await import('../lib/tool-ready.ts');
const { adoptTeamSessionOrigin, _clearTeamSessionOriginForTests } = await import('./team-session-origin.ts');
const view = document.querySelector<HTMLElement>('#view')!;
let stop: (() => void) | undefined;
let leave: (() => void) | undefined;
afterEach(() => { leave?.(); stop?.(); _clearTeamSessionOriginForTests(); });
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 20));
function ready(collaborative = false): void {
  leave = publishToolReady({ toolId: 'design', view, collaborative });
}
function shared(): void { adoptTeamSessionOrigin({ toolId: 'design', sessionId: 'ses_canvas', projectId: 'prj_team', rev: 1 }); }

test('a shared canvas joins automatically and blocks edits while the seat is pending', async () => {
  shared();
  let finish: (() => void) | undefined;
  let calls = 0;
  let wanted: (() => boolean) | undefined;
  const join: AutomaticWorkCollabDeps['join'] = async (ctx, deps) => {
    calls++;
    assert.equal(ctx.sessionId, 'ses_canvas');
    wanted = deps?.stillWanted;
    await new Promise<void>(resolve => { finish = resolve; });
    return { ok: true };
  };
  stop = registerAutomaticWorkCollab({ canJoin: () => true, join });
  ready();
  await settle();
  assert.equal(calls, 1);
  assert.equal(wanted?.(), true);
  const pending = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true });
  document.querySelector('#edit')!.dispatchEvent(pending);
  assert.equal(pending.defaultPrevented, true);
  finish!();
  await settle();
  assert.equal(view.querySelector('.collab-auto-status'), null);
  const live = new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true });
  document.querySelector('#edit')!.dispatchEvent(live);
  assert.equal(live.defaultPrevented, false);
});

test('local documents and existing collab mounts stay dormant', async () => {
  let calls = 0;
  stop = registerAutomaticWorkCollab({ canJoin: () => true, join: async () => { calls++; return { ok: true }; } });
  ready();
  await settle();
  assert.equal(calls, 0);
  assert.equal(view.querySelector('.collab-auto-status'), null);
  leave!();
  shared();
  ready(true);
  await settle();
  assert.equal(calls, 0);
});

test('late registration joins a shared document already open; leaving invalidates delivery', async () => {
  shared();
  ready();
  let wanted: (() => boolean) | undefined;
  let finish: (() => void) | undefined;
  stop = registerAutomaticWorkCollab({ canJoin: () => true, join: async (_ctx, deps) => {
    wanted = deps?.stillWanted;
    await new Promise<void>(resolve => { finish = resolve; });
    return { ok: true };
  } });
  await settle();
  assert.equal(wanted?.(), true);
  leave!();
  assert.equal(wanted?.(), false);
  assert.equal(view.querySelector('.collab-auto-status'), null);
  finish!();
  await settle();
  assert.equal(view.querySelector('.collab-auto-status'), null);
});

test('a refused join shows its reason and a working retry', async () => {
  shared();
  let attempts = 0;
  stop = registerAutomaticWorkCollab({ canJoin: () => true, join: async () => {
    attempts++;
    return attempts === 1 ? { ok: false, reason: 'refused', message: 'The room refused this connection.' } : { ok: true };
  } });
  ready();
  await settle();
  assert.match(view.querySelector('.collab-auto-status')!.textContent!, /room refused/);
  const retry = view.querySelector<HTMLButtonElement>('.collab-auto-status button')!;
  assert.equal(retry.hidden, false);
  retry.click();
  await settle();
  assert.equal(attempts, 2);
  assert.equal(view.querySelector('.collab-auto-status'), null);
});

test('an unexpected connection failure leaves a visible retry instead of rejecting at boot', async () => {
  shared();
  stop = registerAutomaticWorkCollab({ canJoin: () => true, join: async () => { throw new Error('transport unavailable'); } });
  ready();
  await settle();
  assert.match(view.querySelector('.collab-auto-status')!.textContent!, /could not be reached/);
  assert.equal(view.querySelector<HTMLButtonElement>('.collab-auto-status button')!.hidden, false);
});
