// SPDX-License-Identifier: MPL-2.0
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { wireDeviceCodeSignIn } from './device-sign-in.ts';
import { _setBaseForTests, hasInstanceSession, instanceFetch, setInstanceSession } from '../lib/instance.ts';

const dom = new JSDOM('<body><main></main></body>', { url: 'tauri://localhost/' });
globalThis.window = dom.window as unknown as Window & typeof globalThis;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { userAgent: 'iPhone', maxTouchPoints: 1 } });
let requests: Array<{ url: string; headers: Array<[string, string]> }> = [];
let commands: Array<{ cmd: string; args: Record<string, unknown> }> = [];
let answer: (url: string) => unknown | Promise<unknown>;
let stop: (() => void) | undefined;

beforeEach(async () => {
  _setBaseForTests('https://work.example');
  await setInstanceSession(null);
  requests = []; commands = [];
  answer = url => url.endsWith('/token') ? { status: 'approved', cookie: 'lw_session=approved-session' }
    : { deviceCode: 'opaque', userCode: 'ABCD-EFGH', verificationUri: 'https://work.example/activate', interval: 2 };
  (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = { invoke: async (cmd: string, args: Record<string, unknown>) => {
    commands.push({ cmd, args });
    if (cmd !== 'remote_fetch') return {};
    const request = args.request as typeof requests[number];
    requests.push(request);
    return { status: 200, statusText: 'OK', url: request.url,
      headers: [['content-type', 'application/json']], body: [...new TextEncoder().encode(JSON.stringify(await answer(request.url)))] };
  } };
  document.body.innerHTML = '<div id="sign-in"></div>';
});
afterEach(async () => { stop?.(); stop = undefined; await setInstanceSession(null); document.body.innerHTML = ''; });
const flush = async (): Promise<void> => { for (let i = 0; i < 4; i++) await new Promise(resolve => setImmediate(resolve)); };
const click = (selector: string): void => { const button = document.querySelector<HTMLButtonElement>(selector); assert.ok(button); button.click(); };

test('iOS sign-in opens the system browser and attaches the approved session to subsequent instance reads', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  let signedIn = false;
  stop = wireDeviceCodeSignIn(document.getElementById('sign-in')!, () => { signedIn = true; });
  click('#org-gate-device-btn'); await flush();
  assert.match(document.body.textContent ?? '', /ABCD-EFGH/);
  click('[data-device-open]'); await flush();
  const opened = commands.find(c => c.cmd === 'plugin:lolly-auth|authenticate');
  assert.equal(opened?.args.url, 'https://work.example/activate?code=ABCD-EFGH');
  assert.equal(opened?.args.ephemeral, false);
  ctx.mock.timers.tick(2000); await flush();
  assert.equal(signedIn, true);
  assert.equal(hasInstanceSession(), true);
  await instanceFetch('https://work.example/catalog/assets/index.json');
  assert.equal(new Map(requests.at(-1)!.headers).get('cookie'), 'lw_session=approved-session');
});

test('a closed sign-in cannot install a late approved session', async ctx => {
  ctx.mock.timers.enable({ apis: ['setTimeout'] });
  let approve!: (body: unknown) => void;
  answer = url => url.endsWith('/token') ? new Promise(resolve => { approve = resolve; })
    : { deviceCode: 'opaque', userCode: 'ABCD-EFGH', verificationUri: 'https://work.example/activate', interval: 2 };
  let signedIn = false;
  stop = wireDeviceCodeSignIn(document.getElementById('sign-in')!, () => { signedIn = true; });
  click('#org-gate-device-btn'); await flush();
  ctx.mock.timers.tick(2000); await flush();
  stop();
  approve({ status: 'approved', cookie: 'lw_session=late' }); await flush();
  assert.equal(signedIn, false);
  assert.equal(hasInstanceSession(), false);
});

test('an instance cannot send the sign-in browser to another origin', async () => {
  answer = () => ({ deviceCode: 'opaque', userCode: 'ABCD-EFGH', verificationUri: 'https://foreign.example/activate' });
  stop = wireDeviceCodeSignIn(document.getElementById('sign-in')!);
  click('#org-gate-device-btn'); await flush();
  assert.equal(document.querySelector('[data-device-open]'), null);
  assert.match(document.body.textContent ?? '', /usable code sign-in/);
});
