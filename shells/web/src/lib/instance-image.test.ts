// SPDX-License-Identifier: MPL-2.0
/**
 * lib/instance-image.ts: in the apps a picture on the connected instance is read with
 * the person's session through the native transport; every other picture, and every
 * picture in a browser, keeps its plain `src`, and the session goes nowhere else.
 *
 * Run directly:  node --test shells/web/src/lib/instance-image.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://tauri.localhost/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location as unknown as Location;
globalThis.Event = dom.window.Event as unknown as typeof Event;
let made = 0;
URL.createObjectURL = () => `blob:https://tauri.localhost/picture-${++made}`;
URL.revokeObjectURL = () => {};

const { _setBaseForTests, setInstanceSession } = await import('./instance.ts');
const { hydrateInstanceImages, setInstanceImage } = await import('./instance-image.ts');

const WORK = 'https://work.example';
const FILE = `${WORK}/api/v1/projects/p1/files/f1`;
interface NativeRequest { url: string; headers: Array<[string, string]>; maxResponseBytes?: number }
const requests: NativeRequest[] = [];
let answer: (request: NativeRequest) => { status: number; headers: Array<[string, string]>; body: number[] } =
  () => ({ status: 200, headers: [['content-type', 'image/png']], body: [137, 80, 78, 71] });

function native(on: boolean): void {
  const w = window as unknown as { __TAURI_INTERNALS__?: unknown };
  if (!on) { delete w.__TAURI_INTERNALS__; return; }
  w.__TAURI_INTERNALS__ = { invoke: async (_command: string, args: { request: NativeRequest }) => {
    requests.push(args.request);
    return { statusText: '', url: args.request.url, ...answer(args.request) };
  } };
}

const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 10));
const picture = (): HTMLImageElement => document.body.appendChild(document.createElement('img'));

test.beforeEach(async () => {
  requests.length = 0;
  document.body.replaceChildren();
  answer = () => ({ status: 200, headers: [['content-type', 'image/png']], body: [137, 80, 78, 71] });
  native(true);
  _setBaseForTests(WORK);
  await setInstanceSession('lw_session=mine');
});
test.after(async () => { await setInstanceSession(null); _setBaseForTests(''); native(false); });

test('in the apps a picture on the instance is read with the session and shown from its bytes', async () => {
  const img = picture();
  assert.equal(setInstanceImage(img, FILE), true);
  assert.equal(img.getAttribute('src'), null, 'the web view is not asked for an address it would be refused');
  await settle();
  assert.equal(requests.length, 1);
  assert.equal(requests[0]!.url, FILE);
  assert.equal(new Headers(requests[0]!.headers).get('cookie'), 'lw_session=mine');
  assert.equal(requests[0]!.maxResponseBytes, 32 * 1024 * 1024);
  assert.match(img.src, /^blob:/);
});

test('a picture anywhere else keeps its address, and the session is not sent', async () => {
  for (const url of ['https://other.example/picture.png', 'blob:https://tauri.localhost/local', '/catalog/assets/logo.svg', `${WORK}.evil.example/api/v1/projects/p1/files/f1`]) {
    const img = picture();
    assert.equal(setInstanceImage(img, url), false, url);
    assert.equal(img.getAttribute('src'), url);
  }
  await settle();
  assert.equal(requests.length, 0, 'no request of this module\'s own, so no session to send');
});

test('in a browser nothing changes: the page is the instance', async () => {
  native(false);
  const img = picture();
  assert.equal(setInstanceImage(img, FILE), false);
  assert.equal(img.getAttribute('src'), FILE);
  await settle();
  assert.equal(requests.length, 0);
});

test('a refused picture, or an answer that is not a picture, raises the element\'s own error', async () => {
  for (const reply of [
    { status: 401, headers: [] as Array<[string, string]>, body: [] as number[] },
    { status: 200, headers: [['content-type', 'text/html']] as Array<[string, string]>, body: [60] },
  ]) {
    answer = () => reply;
    const img = picture();
    let errors = 0;
    img.addEventListener('error', () => { errors++; });
    setInstanceImage(img, FILE);
    await settle();
    assert.equal(errors, 1);
    assert.equal(img.getAttribute('src'), null);
  }
});

test('markup already built: only the instance\'s pictures are taken over', async () => {
  document.body.innerHTML = `<div id="grid"><img class="a" src="${FILE}" alt=""><img class="b" src="https://other.example/x.png" alt=""><img class="c" src="blob:https://tauri.localhost/y" alt=""></div>`;
  hydrateInstanceImages(document.getElementById('grid')!);
  await settle();
  assert.deepEqual(requests.map(request => request.url), [FILE]);
  assert.match(document.querySelector<HTMLImageElement>('.a')!.src, /^blob:https:\/\/tauri\.localhost\/picture-/);
  assert.equal(document.querySelector('.b')!.getAttribute('src'), 'https://other.example/x.png');
  assert.equal(document.querySelector('.c')!.getAttribute('src'), 'blob:https://tauri.localhost/y');
});

test('the surfaces that draw team pictures go through this module', async () => {
  const { readFileSync } = await import('node:fs');
  const source = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8');
  assert.match(source('../components/project-asset-page.ts'), /setInstanceImage\(image, opts\.url\)/);
  assert.match(source('../components/asset-file-list.ts'), /setInstanceImage\(img, instancePath\(file\.thumbnail\)\)/);
  assert.match(source('../org/team-project-view.ts'), /hydrateInstanceImages\(grid\)/);
});

test('a request that is usually local takes the instance transport only for the instance', async (ctx) => {
  const { fetchMaybeInstance } = await import('./instance.ts');
  const plain: Array<{ url: string; cookie: string | null }> = [];
  ctx.mock.method(globalThis, 'fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    plain.push({ url: String(input), cookie: new Headers(init?.headers).get('cookie') });
    return new Response('local');
  });
  await fetchMaybeInstance(`${WORK}/tools/design/styles.css`);
  assert.deepEqual(requests.map(request => request.url), [`${WORK}/tools/design/styles.css`]);
  assert.equal(new Headers(requests[0]!.headers).get('cookie'), 'lw_session=mine');
  assert.equal(plain.length, 0);
  for (const url of ['blob:https://tauri.localhost/font', 'https://fonts.example/face.woff2', '/tools/design/styles.css']) await fetchMaybeInstance(url);
  assert.equal(requests.length, 1, 'nothing else goes to the native side');
  assert.deepEqual(plain, [
    { url: 'blob:https://tauri.localhost/font', cookie: null },
    { url: 'https://fonts.example/face.woff2', cookie: null },
    { url: '/tools/design/styles.css', cookie: null },
  ]);
  // The Design tool's compiler reads its sources, images and fonts this way.
  const { readFileSync } = await import('node:fs');
  const compile = readFileSync(new URL('./design-tool-compile.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(compile, /[^.\w]fetch\(/);
  assert.equal(compile.match(/fetchMaybeInstance\(/g)?.length, 4);
});
