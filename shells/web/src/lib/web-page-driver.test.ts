// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { createWebPageDriver, getWebPageDriver } from './web-page-driver.ts';

function fixture(url = 'https://outside.test/demo') {
  const dom = new JSDOM('<!doctype html><body><div id="marker"><iframe data-web-live></iframe></div></body>', { url: 'https://deck.test/', pretendToBeVisual: true });
  const marker = dom.window.document.getElementById('marker')!;
  const frame = marker.querySelector('iframe')!; frame.src = url;
  marker.dataset.webView = '1200';
  for (const [key, value] of Object.entries({ clientWidth: 600, clientHeight: 300 })) Object.defineProperty(marker, key, { value });
  const posts: { data: Record<string, unknown>; origin: string }[] = [];
  frame.contentWindow!.postMessage = ((data: Record<string, unknown>, origin: string) => { posts.push({ data, origin }); }) as typeof window.postMessage;
  return { dom, marker, frame, posts };
}
test('handover preserves the clicked child focus while keeping the same authenticated message', () => {
  const f = fixture('https://deck.test/demo');
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  let focused = 0; const focus = f.frame.focus.bind(f.frame);
  f.frame.focus = () => { focused++; focus(); };
  try {
    driver.handKeyboard(true); assert.equal(focused, 1); assert.equal(f.frame.tabIndex, 0);
    const child = f.frame.contentDocument!; child.open(); child.write('<!doctype html><body></body>'); child.close();
    const input = child.createElement('input'); child.body.append(input);
    input.value = 'keep this selection'; input.focus(); input.setSelectionRange(5, 9);
    driver.handKeyboard(true);
    assert.equal(focused, 1); assert.equal(child.activeElement, input); assert.equal(input.selectionStart, 5); assert.equal(input.selectionEnd, 9);
    assert.equal(f.posts.at(-1)?.data.kind, 'handover'); assert.equal(f.posts.at(-1)?.data.hand, true); assert.equal(f.posts.at(-1)?.origin, 'https://deck.test');
    driver.handKeyboard(false); assert.equal(f.frame.tabIndex, -1); assert.equal(f.posts.at(-1)?.data.hand, false);
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('outside driver pans a chosen tall viewport without navigation, clamps depth, and resets size', () => {
  const f = fixture();
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  try {
    driver.configure({ mode: 'pan', pageLength: 3200, start: 0 });
    assert.equal(driver.scrollTo(800), true);
    assert.deepEqual(driver.depth(), { y: 800, max: 2600 });
    assert.equal(f.frame.style.height, '3200px');
    assert.equal(f.frame.style.transform, 'scale(0.5) translateY(-800px)');
    assert.equal(f.frame.src, 'https://outside.test/demo');
    driver.scrollTo(1e9); assert.equal(driver.depth()!.y, 2600);
    assert.equal(driver.scrollTo('#name'), false);
    assert.equal(driver.scrollTo('50%'), true, 'Pan percentages use the chosen viewport range');
    assert.equal(driver.depth()!.y, 1300);
    driver.configure({ mode: 'none', pageLength: 0, start: 0 });
    assert.equal(f.frame.style.height, '600px');
    assert.equal(f.frame.style.transform, 'scale(0.5)');
    assert.equal(driver.depth(), null);
    assert.equal(getWebPageDriver(f.marker as unknown as HTMLElement), driver);
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('receiver accepts only its exact window and origin and keeps replies out of document state', () => {
  const f = fixture(); const events: string[] = [];
  f.marker.addEventListener('lolly:web-driver-change', () => events.push('changed'));
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  const send = (data: unknown, origin = 'https://outside.test', source: unknown = f.frame.contentWindow): void => {
    f.dom.window.dispatchEvent(new f.dom.window.MessageEvent('message', { data, origin, source: source as Window }));
  };
  try {
    const ready = { type: 'lolly:present', v: 1, kind: 'ready', can: ['key', 'scroll', 'depth'], private: 'no' };
    send(ready, 'https://evil.test'); send(ready, 'https://outside.test', {});
    assert.equal(driver.capabilities.backend, 'outside');
    send(ready); assert.equal(driver.capabilities.backend, 'receiver');
    assert.equal(driver.capabilities.checking, false); assert.equal(events.length, 2);
    send({ type: 'lolly:present', v: 1, kind: 'depth', y: 500, max: 400 });
    assert.deepEqual(driver.depth(), { y: 400, max: 400 });
    send({ type: 'lolly:present', v: 1, kind: 'depth', y: NaN, max: 100 });
    assert.deepEqual(driver.depth(), { y: 400, max: 400 });
    assert.equal(events.length, 2, 'depth updates do not rebuild inspector capability rows');
    driver.key('ArrowDown'); driver.scrollTo('50%'); driver.setFocused(true); driver.setSlideActive(true);
    assert.ok(f.posts.every(post => post.origin === 'https://outside.test'));
    assert.ok(f.posts.some(post => post.data.kind === 'scroll' && post.data.to === '50%'));
    assert.equal(f.marker.dataset.interactOpts, undefined, 'the receiver never writes authored options');
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('configure reads new marker options while preserving the existing frame', () => {
  const f = fixture(); f.marker.dataset.interactOpts = 'mode=pan;len=4000;start=640';
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  try {
    assert.equal(driver.depth()!.y, 640);
    f.marker.dataset.interactOpts = 'mode=pan;len=5000'; driver.configure();
    assert.equal(driver.depth()!.y, 640);
    assert.equal(driver.depth()!.max, 4400);
    assert.equal(createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement), driver);
  } finally { driver.destroy(); f.dom.window.close(); }
});
test('capability observers can query registry during creation and destruction without remounting', () => {
  const f = fixture(); const seen: unknown[] = [];
  f.marker.addEventListener('lolly:web-driver-change', () => seen.push(getWebPageDriver(f.marker as unknown as HTMLElement)));
  const driver = createWebPageDriver(f.frame as unknown as HTMLIFrameElement, f.marker as unknown as HTMLElement);
  try {
    assert.equal(seen.length, 1); assert.equal(seen[0], driver);
    driver.destroy(); assert.equal(seen.at(-1), null);
    assert.equal(getWebPageDriver(f.marker as unknown as HTMLElement), null);
  } finally { driver.destroy(); f.dom.window.close(); }
});
